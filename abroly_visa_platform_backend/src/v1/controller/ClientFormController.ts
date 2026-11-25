import crypto from "crypto";
import path from "path";
import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import ClientForm from "../../model/ClientForm";
import ClientFormAssignment from "../../model/ClientFormAssignment";
import ClientFormSubmission from "../../model/ClientFormSubmission";
import CrmLead from "../../model/CrmLead";
import User from "../../model/User";
import Agent from "../../model/Agent";
import { agencyOwner } from "../../helpers/storage";
import { saveFile } from "../../helpers/storage";
import { mailEnabled, sendMail, agencyBrand } from "../../services/mailer";
import { ingestLead, logActivity } from "../../services/leadIngestion";
import {
    buildFormShare,
    extractContactFromAnswers,
    formPublicUrl,
    matchContacts,
    newShareToken,
    presentAnswers,
    presentForm,
    sanitizeFields,
    sanitizeSettings,
    findPublishedByToken,
    FormField,
} from "../../services/clientForms";

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, userId: Number(user.id), isOwner: user.role === "agent" };
};

const loadOwn = async (agencyUuid: string, uuid: string) =>
    ClientForm.findOne({ where: { uuid, agency_uuid: agencyUuid } }) as Promise<any>;

const readFormBody = (body: any) => {
    const name = String(body?.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Please give the form a name");
    return {
        name,
        description: body?.description ? String(body.description).trim().slice(0, 2000) : null,
        fields: sanitizeFields(body?.fields),
        settings: sanitizeSettings(body?.settings),
    };
};

const agencyBrandLite = async (agencyUuid: string) => {
    const a: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["app_name", "username", "primary_color", "favicon_url", "support_number", "support_email"],
        raw: true,
    });
    return a ? {
        name: a.app_name || a.username || "Agency",
        primary_color: a.primary_color || "#0f5bd8",
        favicon_url: a.favicon_url || null,
        support_number: a.support_number || null,
        support_email: a.support_email || null,
    } : { name: "Agency", primary_color: "#0f5bd8", favicon_url: null, support_number: null, support_email: null };
};

const parseAnswersJson = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
};

/** Validate + normalize answers against field defs; uploads already mapped into answers. */
const validateAnswers = (fields: FormField[], answers: Record<string, any>) => {
    const clean: Record<string, any> = {};
    for (const f of fields) {
        let v = answers[f.id];
        if (v === undefined || v === null || v === "") {
            if (f.required) throw new Error(`Please fill: ${f.label}`);
            continue;
        }
        if (f.type === "multi_choice") {
            const arr = Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean);
            const allowed = new Set(f.options || []);
            const picked = arr.map(String).filter((x) => allowed.has(x)).slice(0, 40);
            if (f.required && !picked.length) throw new Error(`Please fill: ${f.label}`);
            if (picked.length) clean[f.id] = picked;
            continue;
        }
        if (f.type === "single_choice" || f.type === "yes_no") {
            const s = String(v).trim();
            if (f.type === "yes_no" && !["Yes", "No", "yes", "no", "true", "false"].includes(s)) {
                throw new Error(`Invalid answer for: ${f.label}`);
            }
            if (f.type === "single_choice" && f.options?.length && !f.options.includes(s)) {
                throw new Error(`Invalid answer for: ${f.label}`);
            }
            clean[f.id] = f.type === "yes_no" ? (/^(yes|true)$/i.test(s) ? "Yes" : "No") : s.slice(0, 500);
            continue;
        }
        if (f.type === "file") {
            if (typeof v !== "object" || !v.file) {
                if (f.required) throw new Error(`Please upload: ${f.label}`);
                continue;
            }
            clean[f.id] = { file: String(v.file), name: String(v.name || "file").slice(0, 255) };
            continue;
        }
        if (f.type === "email") {
            const s = String(v).trim().slice(0, 255);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error(`Invalid email for: ${f.label}`);
            clean[f.id] = s;
            continue;
        }
        if (f.type === "number") {
            const n = Number(v);
            if (Number.isNaN(n)) throw new Error(`Invalid number for: ${f.label}`);
            clean[f.id] = String(n);
            continue;
        }
        clean[f.id] = String(v).trim().slice(0, f.type === "long_text" ? 5000 : 500);
    }
    return clean;
};

const mapUploadedFiles = async (agencyUuid: string, fields: FormField[], files: Express.Multer.File[] | undefined, answers: Record<string, any>) => {
    const byField = new Map<string, Express.Multer.File>();
    for (const file of files || []) {
        // fieldname: file_<fieldId> or just fieldId
        const key = String(file.fieldname || "").replace(/^file_/, "");
        if (key) byField.set(key, file);
    }
    const owner = agencyOwner(agencyUuid);
    for (const f of fields) {
        if (f.type !== "file") continue;
        const file = byField.get(f.id);
        if (!file) continue;
        const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 12) || "";
        const name = `${crypto.randomUUID()}${ext}`;
        const ref = await saveFile({
            owner,
            folder: "student_docs",
            name,
            body: file.buffer,
            contentType: file.mimetype,
        });
        answers[f.id] = { file: ref, name: path.basename(file.originalname || name).slice(0, 255) };
    }
    return answers;
};

const presentSubmission = (sub: any, form?: any) => {
    const d = sub.toJSON ? sub.toJSON() : sub;
    const fields: FormField[] = Array.isArray(form?.fields) ? form.fields : (form?.dataValues?.fields || []);
    return {
        id: d.uuid,
        form_id: form?.uuid || form?.dataValues?.uuid || null,
        answers: presentAnswers(fields, d.answers || {}),
        raw_answers: d.answers || {},
        contact_name: d.contact_name,
        contact_email: d.contact_email,
        contact_phone: d.contact_phone,
        source: d.source,
        lead_id: d.lead_id,
        student_id: d.student_id,
        assignment_id: d.assignment_id,
        createdAt: d.createdAt,
    };
};

class ClientFormController {
    // GET /crm/forms
    async list(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const rows: any[] = await ClientForm.findAll({
                where: { agency_uuid: agencyUuid, status: { [Op.ne]: "archived" } },
                order: [["updatedAt", "DESC"]],
            });
            const ids = rows.map((r) => r.dataValues.id);
            const counts: Record<number, number> = {};
            if (ids.length) {
                const subs: any[] = await ClientFormSubmission.findAll({
                    where: { form_id: { [Op.in]: ids } },
                    attributes: ["form_id"],
                });
                for (const s of subs) counts[s.dataValues.form_id] = (counts[s.dataValues.form_id] || 0) + 1;
            }
            const items = await Promise.all(rows.map(async (r) => {
                const url = await formPublicUrl(agencyUuid, r.dataValues.share_token);
                return presentForm(r, { submission_count: counts[r.dataValues.id] || 0, public_url: url });
            }));
            return returnHelper(res, 200, true, "Forms fetched", { forms: items });
        } catch (error) {
            console.error("list client forms failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/forms/:id
    async details(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            const submission_count = await ClientFormSubmission.count({ where: { form_id: row.dataValues.id } });
            const public_url = await formPublicUrl(agencyUuid, row.dataValues.share_token);
            return returnHelper(res, 200, true, "Form fetched", presentForm(row, { submission_count, public_url }));
        } catch (error) {
            console.error("client form details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms
    async create(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage forms");
            const count = await ClientForm.count({ where: { agency_uuid: agencyUuid } });
            if (count >= 100) return returnHelper(res, 200, false, "You can keep up to 100 forms");

            if (req.body?.copy_from) {
                const from = await loadOwn(agencyUuid, String(req.body.copy_from));
                if (!from) return returnHelper(res, 200, false, "Form not found");
                const o = from.toJSON();
                const created = await ClientForm.create({
                    agency_uuid: agencyUuid,
                    name: `${o.name} (copy)`.slice(0, 255),
                    description: o.description,
                    fields: o.fields,
                    settings: o.settings,
                    status: "draft",
                    created_by: userId,
                });
                return returnHelper(res, 200, true, "Form duplicated", presentForm(created, { submission_count: 0, public_url: null }));
            }

            let data;
            try { data = readFormBody(req.body); } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }
            const created = await ClientForm.create({
                ...data,
                agency_uuid: agencyUuid,
                status: "draft",
                created_by: userId,
            });
            return returnHelper(res, 200, true, "Form saved", presentForm(created, { submission_count: 0, public_url: null }));
        } catch (error) {
            console.error("create client form failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/update
    async update(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage forms");
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            if (row.dataValues.status === "archived") return returnHelper(res, 200, false, "This form is archived");
            let data;
            try { data = readFormBody(req.body); } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }
            await row.update(data);
            const public_url = await formPublicUrl(agencyUuid, row.dataValues.share_token);
            return returnHelper(res, 200, true, "Form saved", presentForm(row, { public_url }));
        } catch (error) {
            console.error("update client form failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/publish
    async publish(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage forms");
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            const fields = Array.isArray(row.dataValues.fields) ? row.dataValues.fields : [];
            if (!fields.length) return returnHelper(res, 200, false, "Add at least one field before publishing");
            const token = row.dataValues.share_token || newShareToken();
            await row.update({ status: "published", share_token: token });
            const public_url = await formPublicUrl(agencyUuid, token);
            const share = await buildFormShare(agencyUuid, row);
            return returnHelper(res, 200, true, "Form published", { ...presentForm(row, { public_url }), share });
        } catch (error) {
            console.error("publish client form failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/archive
    async archive(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage forms");
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            await row.update({ status: "archived" });
            return returnHelper(res, 200, true, "Form archived");
        } catch (error) {
            console.error("archive client form failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/duplicate  (alias of create with copy_from)
    async duplicate(req: RequestWithUser, res: Response) {
        req.body = { ...(req.body || {}), copy_from: req.params.id };
        return this.create(req, res);
    }

    // GET /crm/forms/:id/share
    async share(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            if (row.dataValues.status !== "published" || !row.dataValues.share_token) {
                return returnHelper(res, 200, false, "Publish the form first to get a share link");
            }
            const share = await buildFormShare(agencyUuid, row);
            return returnHelper(res, 200, true, "Share ready", { ...share, email_available: mailEnabled() });
        } catch (error) {
            console.error("share client form failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/assign  { student_id? | lead_id? | lead_uuid? }
    async assign(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            if (row.dataValues.status !== "published") {
                return returnHelper(res, 200, false, "Publish the form before sending it");
            }

            let lead: any = null;
            let student: any = null;
            const body = req.body || {};
            if (body.lead_uuid || body.lead_id) {
                lead = body.lead_uuid
                    ? await CrmLead.findOne({ where: { uuid: body.lead_uuid, agency_uuid: agencyUuid } })
                    : await CrmLead.findOne({ where: { id: Number(body.lead_id), agency_uuid: agencyUuid } });
                if (!lead) return returnHelper(res, 200, false, "Lead not found");
                if (lead.dataValues.converted_student_id) {
                    student = await User.findOne({
                        where: { id: lead.dataValues.converted_student_id, agency_uuid: agencyUuid, user_type: "user" },
                    });
                }
            }
            if (body.student_id) {
                student = await User.findOne({
                    where: { id: Number(body.student_id), agency_uuid: agencyUuid, user_type: "user" },
                });
                if (!student) return returnHelper(res, 200, false, "Student not found");
            }
            if (!lead && !student) return returnHelper(res, 200, false, "Pick a lead or student to send this form to");

            // reuse pending assignment for same form + target
            const where: any = { form_id: row.dataValues.id, agency_uuid: agencyUuid, status: "pending" };
            if (student) where.student_id = student.dataValues.id;
            else where.lead_id = lead.dataValues.id;

            let assignment: any = await ClientFormAssignment.findOne({ where });
            if (!assignment) {
                assignment = await ClientFormAssignment.create({
                    form_id: row.dataValues.id,
                    agency_uuid: agencyUuid,
                    student_id: student?.dataValues?.id || null,
                    lead_id: lead?.dataValues?.id || null,
                    status: "pending",
                    sent_at: new Date(),
                    created_by: userId,
                });
            } else {
                await assignment.update({ sent_at: new Date() });
            }

            const contact = lead?.dataValues || {
                name: student?.dataValues?.username,
                phone: student?.dataValues?.phone_number,
                email: student?.dataValues?.email,
                phone_normalized: null,
            };
            const share = await buildFormShare(agencyUuid, row, contact);
            if (lead) {
                await logActivity(
                    lead.dataValues.id,
                    agencyUuid,
                    "note",
                    `Form sent: ${row.dataValues.name}`,
                    userId,
                    { kind: "form_assigned", form_id: row.dataValues.uuid, assignment_id: assignment.dataValues.uuid },
                );
            }

            return returnHelper(res, 200, true, "Form assigned", {
                assignment: {
                    id: assignment.dataValues.uuid,
                    status: assignment.dataValues.status,
                    student_id: assignment.dataValues.student_id,
                    lead_id: assignment.dataValues.lead_id,
                },
                share: { ...share, email_available: mailEnabled() },
            });
        } catch (error) {
            console.error("assign client form failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/assign/email  { lead_uuid? | assignment uses share }
    async sendAssignEmail(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            const leadUuid = req.body?.lead_uuid;
            const lead: any = leadUuid
                ? await CrmLead.findOne({ where: { uuid: leadUuid, agency_uuid: agencyUuid } })
                : null;
            const to = String(req.body?.email || lead?.dataValues?.email || "").trim();
            if (!to) return returnHelper(res, 200, false, "No email address to send to");
            if (!mailEnabled()) return returnHelper(res, 200, false, "Email sending is not set up yet");
            const share = await buildFormShare(agencyUuid, row, lead?.dataValues || { email: to, name: req.body?.name });
            const brand = await agencyBrand(agencyUuid);
            const sent = await sendMail(
                to,
                share.subject,
                share.message,
                share.form_url ? { label: "Open form", url: share.form_url } : null,
                brand || { name: share.agency_name },
            );
            return returnHelper(res, 200, sent, sent ? "Email sent" : "Could not send the email", { share });
        } catch (error) {
            console.error("send form email failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/forms/:id/submissions
    async listSubmissions(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            const rows: any[] = await ClientFormSubmission.findAll({
                where: { form_id: row.dataValues.id, agency_uuid: agencyUuid },
                order: [["createdAt", "DESC"]],
                limit: 200,
            });
            return returnHelper(res, 200, true, "Submissions fetched", {
                form: presentForm(row),
                submissions: rows.map((s) => presentSubmission(s, row)),
            });
        } catch (error) {
            console.error("list form submissions failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/forms/:id/submissions/:subId
    async submissionDetails(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            const sub: any = await ClientFormSubmission.findOne({
                where: { uuid: req.params.subId, form_id: row.dataValues.id, agency_uuid: agencyUuid },
            });
            if (!sub) return returnHelper(res, 200, false, "Response not found");
            let lead: any = null;
            if (sub.dataValues.lead_id) {
                lead = await CrmLead.findByPk(sub.dataValues.lead_id, {
                    attributes: ["uuid", "name", "email", "phone_number", "country_code", "status"],
                });
            }
            return returnHelper(res, 200, true, "Response fetched", {
                form: presentForm(row),
                submission: {
                    ...presentSubmission(sub, row),
                    lead: lead ? {
                        id: lead.dataValues.uuid,
                        name: lead.dataValues.name,
                        email: lead.dataValues.email,
                        phone: `${lead.dataValues.country_code || ""} ${lead.dataValues.phone_number || ""}`.trim(),
                        status: lead.dataValues.status,
                    } : null,
                },
            });
        } catch (error) {
            console.error("form submission details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/forms/:id/submissions/:subId/create_lead
    async createLeadFromSubmission(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const row = await loadOwn(agencyUuid, String(req.params.id));
            if (!row) return returnHelper(res, 200, false, "Form not found");
            const sub: any = await ClientFormSubmission.findOne({
                where: { uuid: req.params.subId, form_id: row.dataValues.id, agency_uuid: agencyUuid },
            });
            if (!sub) return returnHelper(res, 200, false, "Response not found");
            if (sub.dataValues.lead_id) {
                const existing: any = await CrmLead.findByPk(sub.dataValues.lead_id);
                return returnHelper(res, 200, true, "Already linked to a lead", {
                    lead: existing ? { id: existing.dataValues.uuid, name: existing.dataValues.name } : null,
                });
            }
            const phone = sub.dataValues.contact_phone;
            const email = sub.dataValues.contact_email;
            if (!phone && !email) {
                return returnHelper(res, 200, false, "This response has no phone or email - add contact fields to the form");
            }
            const result = await ingestLead({
                agencyUuid,
                source: "other",
                createdBy: userId,
                input: {
                    name: sub.dataValues.contact_name || undefined,
                    phone: phone || undefined,
                    email: email || undefined,
                    message: `Submitted form: ${row.dataValues.name}`,
                    campaign: row.dataValues.name,
                    source_ref: `form:${sub.dataValues.uuid}`,
                    extra: { form_id: row.dataValues.uuid, submission_id: sub.dataValues.uuid, answers: sub.dataValues.answers },
                },
            });
            await sub.update({ lead_id: result.lead.dataValues.id });
            return returnHelper(res, 200, true, result.created ? "Lead created" : "Linked to existing lead", {
                lead: { id: result.lead.dataValues.uuid, name: result.lead.dataValues.name, duplicate: result.duplicate },
            });
        } catch (error: any) {
            console.error("create lead from form failed", error);
            return returnHelper(res, 200, false, error?.message || "Could not create lead");
        }
    }

    // ----- Public -----

    // GET /public/forms/:token
    async publicGet(req: any, res: Response) {
        try {
            const form = await findPublishedByToken(String(req.params.token || ""));
            if (!form) return returnHelper(res, 200, false, "Form not found or no longer available");
            const brand = await agencyBrandLite(form.dataValues.agency_uuid);
            const settings = sanitizeSettings(form.dataValues.settings || {});
            return returnHelper(res, 200, true, "Form fetched", {
                id: form.dataValues.uuid,
                name: form.dataValues.name,
                description: form.dataValues.description || "",
                fields: form.dataValues.fields || [],
                settings: {
                    thank_you_message: settings.thank_you_message || "Thank you — we have received your response.",
                    collect_contact: settings.collect_contact !== false,
                },
                agency: brand,
            });
        } catch (error) {
            console.error("public form get failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /public/forms/:token
    async publicSubmit(req: any, res: Response) {
        try {
            const form = await findPublishedByToken(String(req.params.token || ""));
            if (!form) return returnHelper(res, 200, false, "Form not found or no longer available");
            const agencyUuid = form.dataValues.agency_uuid;
            const settings = sanitizeSettings(form.dataValues.settings || {});
            const fields: FormField[] = Array.isArray(form.dataValues.fields) ? form.dataValues.fields : [];

            let answers = parseAnswersJson(req.body?.answers);
            // also accept flat body keys as field ids
            for (const f of fields) {
                if (answers[f.id] == null && req.body?.[f.id] != null) answers[f.id] = req.body[f.id];
            }
            answers = await mapUploadedFiles(agencyUuid, fields, req.files as Express.Multer.File[] | undefined, answers);

            let clean;
            try { clean = validateAnswers(fields, answers); } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }

            const contact = extractContactFromAnswers(fields, clean, {
                name: req.body?.contact_name,
                email: req.body?.contact_email,
                phone: req.body?.contact_phone,
            });
            if (settings.collect_contact !== false && !contact.email && !contact.phone) {
                // soft: still allow if form has no email/phone fields; otherwise require
                const hasContactField = fields.some((f) => f.type === "email" || f.type === "phone" || /name/i.test(f.label));
                if (hasContactField && fields.some((f) => (f.type === "email" || f.type === "phone") && f.required)) {
                    return returnHelper(res, 200, false, "Please provide your contact details");
                }
            }

            const matched = await matchContacts(agencyUuid, contact.phone, contact.email);

            // complete a pending assignment for this form + lead/student when one exists
            let assignmentId: number | null = null;
            const assignOr: any[] = [];
            if (matched.student_id) assignOr.push({ student_id: matched.student_id });
            if (matched.lead_id) assignOr.push({ lead_id: matched.lead_id });
            let assignment: any = null;
            if (assignOr.length) {
                assignment = await ClientFormAssignment.findOne({
                    where: {
                        form_id: form.dataValues.id,
                        agency_uuid: agencyUuid,
                        status: "pending",
                        [Op.or]: assignOr,
                    },
                    order: [["sent_at", "DESC"]],
                });
            }

            const sub: any = await ClientFormSubmission.create({
                form_id: form.dataValues.id,
                agency_uuid: agencyUuid,
                answers: clean,
                contact_name: contact.name,
                contact_email: matched.email || contact.email,
                contact_phone: contact.phone,
                source: "public",
                student_id: matched.student_id || assignment?.dataValues?.student_id || null,
                lead_id: matched.lead_id || assignment?.dataValues?.lead_id || null,
                assignment_id: assignment?.dataValues?.id || null,
            });
            assignmentId = assignment?.dataValues?.id || null;
            if (assignment) {
                await assignment.update({
                    status: "completed",
                    completed_at: new Date(),
                    submission_id: sub.dataValues.id,
                });
            }

            const leadId = sub.dataValues.lead_id;
            if (leadId) {
                await logActivity(
                    leadId,
                    agencyUuid,
                    "note",
                    `Form submitted: ${form.dataValues.name}`,
                    null,
                    { kind: "form_submission", form_id: form.dataValues.uuid, submission_id: sub.dataValues.uuid, assignment_id: assignmentId },
                );
            }

            return returnHelper(res, 200, true, "Response submitted", {
                thank_you_message: settings.thank_you_message || "Thank you — we have received your response.",
                submission_id: sub.dataValues.uuid,
            });
        } catch (error) {
            console.error("public form submit failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // ----- Student portal -----

    // GET /student/forms
    async studentList(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            const studentId = Number(user.id);
            const agencyUuid = user.agency_uuid as string;
            const rows: any[] = await ClientFormAssignment.findAll({
                where: { agency_uuid: agencyUuid, student_id: studentId, status: "pending" },
                order: [["sent_at", "DESC"], ["createdAt", "DESC"]],
            });
            const formIds = [...new Set(rows.map((r) => r.dataValues.form_id))];
            const forms: any[] = formIds.length
                ? await ClientForm.findAll({ where: { id: { [Op.in]: formIds }, status: "published" } })
                : [];
            const byId = new Map(forms.map((f) => [f.dataValues.id, f]));
            const items = rows
                .map((a) => {
                    const f = byId.get(a.dataValues.form_id);
                    if (!f) return null;
                    return {
                        assignment_id: a.dataValues.uuid,
                        status: a.dataValues.status,
                        sent_at: a.dataValues.sent_at,
                        form: {
                            id: f.dataValues.uuid,
                            name: f.dataValues.name,
                            description: f.dataValues.description || "",
                            field_count: (f.dataValues.fields || []).length,
                        },
                    };
                })
                .filter(Boolean);
            return returnHelper(res, 200, true, "Forms fetched", { forms: items });
        } catch (error) {
            console.error("student forms list failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /student/forms/:assignmentId
    async studentDetails(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            const studentId = Number(user.id);
            const agencyUuid = user.agency_uuid as string;
            const assignment: any = await ClientFormAssignment.findOne({
                where: { uuid: req.params.assignmentId, agency_uuid: agencyUuid, student_id: studentId },
            });
            if (!assignment) return returnHelper(res, 200, false, "Form not found");
            const form: any = await ClientForm.findOne({
                where: { id: assignment.dataValues.form_id, agency_uuid: agencyUuid, status: "published" },
            });
            if (!form) return returnHelper(res, 200, false, "Form not found or no longer available");
            const brand = await agencyBrandLite(agencyUuid);
            const settings = sanitizeSettings(form.dataValues.settings || {});
            return returnHelper(res, 200, true, "Form fetched", {
                assignment_id: assignment.dataValues.uuid,
                status: assignment.dataValues.status,
                id: form.dataValues.uuid,
                name: form.dataValues.name,
                description: form.dataValues.description || "",
                fields: form.dataValues.fields || [],
                settings: {
                    thank_you_message: settings.thank_you_message || "Thank you — we have received your response.",
                    collect_contact: settings.collect_contact !== false,
                },
                agency: brand,
                completed: assignment.dataValues.status === "completed",
            });
        } catch (error) {
            console.error("student form details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /student/forms/:assignmentId/submit
    async studentSubmit(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            const studentId = Number(user.id);
            const agencyUuid = user.agency_uuid as string;
            const assignment: any = await ClientFormAssignment.findOne({
                where: { uuid: req.params.assignmentId, agency_uuid: agencyUuid, student_id: studentId },
            });
            if (!assignment) return returnHelper(res, 200, false, "Form not found");
            if (assignment.dataValues.status === "completed") {
                return returnHelper(res, 200, false, "You already submitted this form");
            }
            const form: any = await ClientForm.findOne({
                where: { id: assignment.dataValues.form_id, agency_uuid: agencyUuid, status: "published" },
            });
            if (!form) return returnHelper(res, 200, false, "Form not found or no longer available");
            const fields: FormField[] = Array.isArray(form.dataValues.fields) ? form.dataValues.fields : [];
            const settings = sanitizeSettings(form.dataValues.settings || {});

            let answers = parseAnswersJson(req.body?.answers);
            for (const f of fields) {
                if (answers[f.id] == null && req.body?.[f.id] != null) answers[f.id] = req.body[f.id];
            }
            answers = await mapUploadedFiles(agencyUuid, fields, req.files as Express.Multer.File[] | undefined, answers);

            let clean;
            try { clean = validateAnswers(fields, answers); } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }

            const contact = extractContactFromAnswers(fields, clean, {
                name: req.body?.contact_name || user.username,
                email: req.body?.contact_email || user.email,
                phone: req.body?.contact_phone || user.phone_number,
            });

            const sub: any = await ClientFormSubmission.create({
                form_id: form.dataValues.id,
                agency_uuid: agencyUuid,
                answers: clean,
                contact_name: contact.name || user.username || null,
                contact_email: contact.email || user.email || null,
                contact_phone: contact.phone || user.phone_number || null,
                source: "portal",
                student_id: studentId,
                lead_id: assignment.dataValues.lead_id || null,
                assignment_id: assignment.dataValues.id,
            });
            await assignment.update({
                status: "completed",
                completed_at: new Date(),
                submission_id: sub.dataValues.id,
            });

            if (assignment.dataValues.lead_id) {
                await logActivity(
                    assignment.dataValues.lead_id,
                    agencyUuid,
                    "note",
                    `Form submitted (portal): ${form.dataValues.name}`,
                    null,
                    { kind: "form_submission", form_id: form.dataValues.uuid, submission_id: sub.dataValues.uuid },
                );
            }

            return returnHelper(res, 200, true, "Response submitted", {
                thank_you_message: settings.thank_you_message || "Thank you — we have received your response.",
                submission_id: sub.dataValues.uuid,
            });
        } catch (error) {
            console.error("student form submit failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new ClientFormController();
