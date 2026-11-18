import { saveFile, agencyOwner } from "../../helpers/storage";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { caseScope } from "../../helpers/access";
import { signedFileUrl } from "../../helpers/privateFiles";
import AgencyLeads from "../../model/AgencyLeads";
import UniversityApplication, { UNI_APP_STATUSES } from "../../model/UniversityApplication";
import Commission from "../../model/Commission";
import { audit } from "../../services/audit";
import { CASE_STAGES } from "./CaseController";

/**
 * University applications inside a visa case: a student applies to several universities,
 * each with its own status (applied → offer → conditional → unconditional → CAS / I-20 → deposit paid)
 * and its own offer letters.
 */

export const UNI_STATUS_LABEL: Record<string, string> = {
    shortlisted: "Shortlisted", applied: "Applied", offer: "Offer received", conditional: "Conditional offer",
    unconditional: "Unconditional offer", cas: "CAS / I-20 / CoE", deposit_paid: "Deposit paid", rejected: "Rejected", withdrawn: "Withdrawn",
};

// a university result moves the visa case forward (never back)
const CASE_STAGE_FOR: Record<string, string> = {
    applied: "application", offer: "offer", conditional: "offer", unconditional: "offer", cas: "funds", deposit_paid: "funds",
};

const ALLOWED = /\.(pdf|docx?|jpe?g|png|webp)$/i;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 3 },
    fileFilter: (_req, file, cb) => (ALLOWED.test(file.originalname) ? cb(null, true) : cb(new Error("Please upload a PDF, Word file or image"))),
}).array("files", 3);

export const offerUpload = (req: Request, res: Response, next: NextFunction) =>
    upload(req, res, (err: any) => {
        if (!err) return next();
        const msg = err.code === "LIMIT_FILE_SIZE" ? "Each file can be up to 10 MB" : err.code === "LIMIT_FILE_COUNT" ? "Up to 3 files at a time" : err.message || "Upload failed";
        return returnHelper(res, 200, false, msg);
    });

const toMinor = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v) * 100));
const fromMinor = (v: any) => (v === null || v === undefined ? null : Number(v) / 100);
const date = (v: any) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);
const text = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
const today = () => new Date().toISOString().slice(0, 10);

export const presentApp = (a: any, commissions: any[] = []) => {
    const x = a.toJSON ? a.toJSON() : a;
    const files = Array.isArray(x.offer_files) ? x.offer_files : [];
    return {
        id: x.id,
        case_id: x.case_id,
        university: x.university,
        course: x.course,
        campus: x.campus,
        intake: x.intake,
        application_ref: x.application_ref,
        status: x.status,
        status_label: UNI_STATUS_LABEL[x.status] || x.status,
        applied_on: x.applied_on,
        offer_on: x.offer_on,
        currency: x.currency,
        tuition_fee: fromMinor(x.tuition_fee),
        deposit_amount: fromMinor(x.deposit_amount),
        deposit_paid_on: x.deposit_paid_on,
        is_final: Boolean(x.is_final),
        notes: x.notes,
        offer_files: files.map((f: any, i: number) => ({ index: i, name: f.original, size: f.size, at: f.at, url: signedFileUrl("student_docs", f.name) })),
        commissions: commissions.filter((c) => c.university_app_id === x.id).map((c) => ({
            id: c.id, status: c.status, currency: c.currency, amount_expected: fromMinor(c.amount_expected), amount_received: fromMinor(c.amount_received),
        })),
        status_updated_at: x.status_updated_at,
        createdAt: x.createdAt,
    };
};

const findCase = (req: RequestWithUser, id: any) => AgencyLeads.findOne({ where: { ...caseScope(req), id: Number(id) || 0 } });

/** The application and its case, only if this person may see the case. */
const findApp = async (req: RequestWithUser, appId: any) => {
    const app: any = await UniversityApplication.findOne({ where: { id: Number(appId) || 0, agency_uuid: (req.user?.user as any)?.agent_uuid } });
    if (!app) return null;
    const c: any = await findCase(req, app.dataValues.case_id);
    return c ? { app, c } : null;
};

/** Move the case forward when a university result needs it. */
const advanceCase = async (c: any, status: string) => {
    const target = CASE_STAGE_FOR[status];
    if (!target || c.dataValues.status !== "visa_progress") return;
    const order = CASE_STAGES as readonly string[];
    if (order.indexOf(target) > order.indexOf(c.dataValues.case_stage || "documents")) {
        await AgencyLeads.update({ case_stage: target, stage_updated_at: new Date() }, { where: { id: c.dataValues.id } });
    }
};

const readFields = (b: any) => {
    const fields: any = {};
    if ("university" in b) fields.university = text(b.university);
    if ("course" in b) fields.course = text(b.course);
    if ("campus" in b) fields.campus = text(b.campus);
    if ("intake" in b) fields.intake = text(b.intake, 50);
    if ("application_ref" in b) fields.application_ref = text(b.application_ref, 100);
    if ("applied_on" in b) fields.applied_on = date(b.applied_on);
    if ("offer_on" in b) fields.offer_on = date(b.offer_on);
    if ("deposit_paid_on" in b) fields.deposit_paid_on = date(b.deposit_paid_on);
    if ("currency" in b) fields.currency = b.currency ? String(b.currency).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || null : null;
    if ("tuition_fee" in b) fields.tuition_fee = toMinor(b.tuition_fee);
    if ("deposit_amount" in b) fields.deposit_amount = toMinor(b.deposit_amount);
    if ("notes" in b) fields.notes = text(b.notes, 4000);
    return fields;
};

class UniversityAppController {
    // GET /crm/cases/:id/universities
    async list(req: RequestWithUser, res: Response) {
        try {
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            const apps: any[] = await UniversityApplication.findAll({ where: { case_id: c.dataValues.id }, order: [["is_final", "DESC"], ["createdAt", "ASC"]] });
            const commissions: any[] = apps.length ? await Commission.findAll({ where: { university_app_id: apps.map((a) => a.dataValues.id) }, raw: true }) : [];
            return returnHelper(res, 200, true, "Applications", { applications: apps.map((a) => presentApp(a, commissions)), statuses: UNI_APP_STATUSES.map((k) => ({ key: k, label: UNI_STATUS_LABEL[k] })) });
        } catch (error) {
            console.error("university apps list failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/:id/universities { university, course?, campus?, intake?, status?, ... }
    async create(req: RequestWithUser, res: Response) {
        try {
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            const fields = readFields(req.body || {});
            if (!fields.university) return returnHelper(res, 200, false, "Please enter the university name");
            const status = (UNI_APP_STATUSES as readonly string[]).includes(String(req.body?.status)) ? String(req.body.status) : "shortlisted";
            const count = await UniversityApplication.count({ where: { case_id: c.dataValues.id } });
            if (count >= 30) return returnHelper(res, 200, false, "A case can have up to 30 university applications");
            const app: any = await UniversityApplication.create({
                ...fields, status, status_updated_at: new Date(),
                ...(status === "applied" && !fields.applied_on && { applied_on: today() }),
                agency_uuid: c.dataValues.agent_uuid, case_id: c.dataValues.id, student_id: c.dataValues.user_id, created_by: Number((req.user?.user as any)?.id) || null,
            });
            await advanceCase(c, status);
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "university_added", summary: `University added: ${fields.university} (${UNI_STATUS_LABEL[status]})` });
            return returnHelper(res, 200, true, "University added", { application: presentApp(app) });
        } catch (error) {
            console.error("university app create failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/universities/:appId { any field, status? }
    async update(req: RequestWithUser, res: Response) {
        try {
            const found = await findApp(req, req.params.appId);
            if (!found) return returnHelper(res, 200, false, "Application not found");
            const { app, c } = found;
            const b = req.body || {};
            const fields = readFields(b);
            if ("university" in fields && !fields.university) return returnHelper(res, 200, false, "Please enter the university name");
            const old = app.dataValues.status;
            if (b.status !== undefined) {
                if (!(UNI_APP_STATUSES as readonly string[]).includes(String(b.status))) return returnHelper(res, 200, false, "Invalid status");
                fields.status = String(b.status);
                if (fields.status !== old) {
                    fields.status_updated_at = new Date();
                    // fill the date of the step if nobody entered it
                    if (fields.status === "applied" && !app.dataValues.applied_on && !fields.applied_on) fields.applied_on = today();
                    if (["offer", "conditional", "unconditional"].includes(fields.status) && !app.dataValues.offer_on && !fields.offer_on) fields.offer_on = today();
                    if (fields.status === "deposit_paid" && !app.dataValues.deposit_paid_on && !fields.deposit_paid_on) fields.deposit_paid_on = today();
                }
            }
            await UniversityApplication.update(fields, { where: { id: app.dataValues.id } });
            if (fields.status && fields.status !== old) {
                await advanceCase(c, fields.status);
                audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "university_status", summary: `${app.dataValues.university}: ${UNI_STATUS_LABEL[old]} → ${UNI_STATUS_LABEL[fields.status]}`, meta: { app_id: app.dataValues.id, from: old, to: fields.status } });
            }
            const fresh: any = await UniversityApplication.findByPk(app.dataValues.id);
            return returnHelper(res, 200, true, fields.status && fields.status !== old ? `Status: ${UNI_STATUS_LABEL[fields.status]}` : "Saved", { application: presentApp(fresh) });
        } catch (error) {
            console.error("university app update failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/universities/:appId/final  - the university the student goes with (copied to the case)
    async markFinal(req: RequestWithUser, res: Response) {
        try {
            const found = await findApp(req, req.params.appId);
            if (!found) return returnHelper(res, 200, false, "Application not found");
            const { app, c } = found;
            await UniversityApplication.update({ is_final: false }, { where: { case_id: c.dataValues.id } });
            await UniversityApplication.update({ is_final: true }, { where: { id: app.dataValues.id } });
            await AgencyLeads.update({ university: app.dataValues.university }, { where: { id: c.dataValues.id } });
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "university_final", summary: `Final choice: ${app.dataValues.university}` });
            return returnHelper(res, 200, true, `${app.dataValues.university} is now the final choice`);
        } catch (error) {
            console.error("university app final failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/universities/:appId/files (multipart "files")
    async addFiles(req: RequestWithUser, res: Response) {
        try {
            const found = await findApp(req, req.params.appId);
            if (!found) return returnHelper(res, 200, false, "Application not found");
            const { app, c } = found;
            const files = (req.files as Express.Multer.File[]) || [];
            if (!files.length) return returnHelper(res, 200, false, "Please choose a file");
            const existing = Array.isArray(app.get("offer_files")) ? app.get("offer_files") : [];
            if (existing.length + files.length > 10) return returnHelper(res, 200, false, "Up to 10 files per university");
            const saved = await Promise.all(files.map(async (f) => {
                const original = path.basename(f.originalname).replace(/[^\w.\- ()]+/g, "_").slice(-120) || "offer";
                const name = await saveFile({ owner: agencyOwner(c.dataValues.agent_uuid), folder: "student_docs", name: `offer_${crypto.randomUUID()}${path.extname(original).toLowerCase()}`, body: f.buffer, contentType: f.mimetype });
                return { name, original, size: f.size, mime: f.mimetype, at: new Date().toISOString() };
            }));
            await UniversityApplication.update({ offer_files: [...existing, ...saved] }, { where: { id: app.dataValues.id } });
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "university_file", summary: `${app.dataValues.university}: ${saved.map((s) => s.original).join(", ")} uploaded` });
            const fresh: any = await UniversityApplication.findByPk(app.dataValues.id);
            return returnHelper(res, 200, true, saved.length > 1 ? "Files uploaded" : "File uploaded", { application: presentApp(fresh) });
        } catch (error) {
            console.error("university app files failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/universities/:appId/files/remove { index }
    async removeFile(req: RequestWithUser, res: Response) {
        try {
            const found = await findApp(req, req.params.appId);
            if (!found) return returnHelper(res, 200, false, "Application not found");
            const { app, c } = found;
            const existing = Array.isArray(app.get("offer_files")) ? [...app.get("offer_files")] : [];
            const index = Number(req.body?.index);
            if (!Number.isInteger(index) || !existing[index]) return returnHelper(res, 200, false, "File not found");
            const [removed] = existing.splice(index, 1);
            await UniversityApplication.update({ offer_files: existing }, { where: { id: app.dataValues.id } });
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "university_file", summary: `${app.dataValues.university}: ${removed.original} removed` });
            return returnHelper(res, 200, true, "File removed");
        } catch (error) {
            console.error("university app remove file failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/universities/:appId/delete
    async remove(req: RequestWithUser, res: Response) {
        try {
            const found = await findApp(req, req.params.appId);
            if (!found) return returnHelper(res, 200, false, "Application not found");
            const { app, c } = found;
            const linked = await Commission.count({ where: { university_app_id: app.dataValues.id, status: ["invoiced", "received"] } });
            if (linked) return returnHelper(res, 200, false, "This university has an invoiced or received commission - cancel that first");
            await UniversityApplication.destroy({ where: { id: app.dataValues.id } });
            await Commission.destroy({ where: { university_app_id: app.dataValues.id } });
            if (app.dataValues.is_final && c.dataValues.university === app.dataValues.university) await AgencyLeads.update({ university: null }, { where: { id: c.dataValues.id } });
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "university_removed", summary: `University removed: ${app.dataValues.university}` });
            return returnHelper(res, 200, true, "University removed");
        } catch (error) {
            console.error("university app delete failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new UniversityAppController();
