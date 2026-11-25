import crypto from "crypto";
import { Op } from "sequelize";
import ClientForm from "../model/ClientForm";
import CrmLead from "../model/CrmLead";
import User from "../model/User";
import { studentPortalUrl } from "./leadConversion";
import { normalizePhone } from "./leadIngestion";
import { signedFileUrl } from "../helpers/privateFiles";

export const FORM_FIELD_TYPES = [
    "short_text", "long_text", "email", "phone", "number", "date",
    "single_choice", "multi_choice", "yes_no", "file",
] as const;
export type FormFieldType = typeof FORM_FIELD_TYPES[number];

export interface FormField {
    id: string;
    label: string;
    type: FormFieldType;
    required?: boolean;
    options?: string[];
    help?: string;
}

export interface FormSettings {
    thank_you_message?: string;
    allow_multiple?: boolean;
    collect_contact?: boolean;
}

const CHOICE_TYPES = new Set(["single_choice", "multi_choice"]);

const newFieldId = () => crypto.randomBytes(6).toString("hex");

export const newShareToken = () => crypto.randomBytes(18).toString("hex");

export const sanitizeFields = (raw: any): FormField[] => {
    if (!Array.isArray(raw)) return [];
    const out: FormField[] = [];
    for (const item of raw.slice(0, 80)) {
        const label = String(item?.label || "").trim().slice(0, 255);
        if (!label) continue;
        const type = FORM_FIELD_TYPES.includes(item?.type) ? item.type as FormFieldType : "short_text";
        const id = String(item?.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || newFieldId();
        const field: FormField = {
            id,
            label,
            type,
            required: Boolean(item?.required),
        };
        const help = String(item?.help || "").trim().slice(0, 500);
        if (help) field.help = help;
        if (CHOICE_TYPES.has(type)) {
            const opts = Array.isArray(item?.options)
                ? item.options.map((o: any) => String(o || "").trim().slice(0, 120)).filter(Boolean).slice(0, 40)
                : [];
            field.options = opts.length ? opts : ["Option 1"];
        }
        out.push(field);
    }
    return out;
};

export const sanitizeSettings = (raw: any): FormSettings => ({
    thank_you_message: raw?.thank_you_message ? String(raw.thank_you_message).trim().slice(0, 1000) : "",
    allow_multiple: raw?.allow_multiple !== false,
    collect_contact: raw?.collect_contact !== false,
});

export const presentForm = (row: any, extras: Record<string, any> = {}) => {
    const d = row.toJSON ? row.toJSON() : row;
    const fields = Array.isArray(d.fields) ? d.fields : [];
    const settings = sanitizeSettings(d.settings || {});
    return {
        id: d.uuid,
        name: d.name,
        description: d.description || "",
        fields,
        field_count: fields.length,
        status: d.status,
        share_token: d.share_token || null,
        settings,
        created_by: d.created_by,
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
        ...extras,
    };
};

export const formPublicUrl = async (agencyUuid: string, token: string | null | undefined) => {
    if (!token) return null;
    const { base } = await studentPortalUrl(agencyUuid);
    return base ? `${base}/f/${token}` : null;
};

export const buildFormShare = async (agencyUuid: string, form: any, contact?: { name?: string | null; phone?: string | null; email?: string | null; phone_normalized?: string | null }) => {
    const d = form.toJSON ? form.toJSON() : form;
    const url = await formPublicUrl(agencyUuid, d.share_token);
    const { agencyName } = await studentPortalUrl(agencyUuid);
    const firstName = (contact?.name || "").split(" ")[0] || "there";
    const message =
        `Hi ${firstName}, please fill this form from ${agencyName}: ${d.name}` +
        (url ? `\n\n${url}` : "\n\n(Your agency will share the link.)");
    const digits = String(contact?.phone_normalized || contact?.phone || "").replace(/\D/g, "");
    return {
        form_url: url,
        message,
        whatsapp_url: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null,
        email: contact?.email || null,
        email_url: contact?.email
            ? `mailto:${contact.email}?subject=${encodeURIComponent(`Please fill: ${d.name}`)}&body=${encodeURIComponent(message)}`
            : null,
        portal_configured: Boolean(url),
        agency_name: agencyName,
        subject: `Please fill: ${d.name}`,
    };
};

/** Match phone/email to an existing lead or student in this agency (no create). */
export const matchContacts = async (agencyUuid: string, phoneRaw?: string | null, emailRaw?: string | null) => {
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
    const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

    let lead: any = null;
    let student: any = null;

    const or: any[] = [];
    if (phone?.normalized) or.push({ phone_normalized: phone.normalized });
    if (validEmail) or.push({ email: validEmail });
    if (or.length) {
        lead = await CrmLead.findOne({
            where: { agency_uuid: agencyUuid, status: { [Op.ne]: "converted" }, [Op.or]: or },
            order: [["updatedAt", "DESC"]],
        });
        if (!lead) {
            lead = await CrmLead.findOne({
                where: { agency_uuid: agencyUuid, [Op.or]: or },
                order: [["updatedAt", "DESC"]],
            });
        }
    }

    if (phone?.phone_number) {
        student = await User.findOne({
            where: {
                agency_uuid: agencyUuid,
                user_type: "user",
                phone_number: phone.phone_number,
                ...(phone.country_code ? { country_code: phone.country_code } : {}),
            },
        });
    }
    if (!student && validEmail) {
        student = await User.findOne({ where: { agency_uuid: agencyUuid, user_type: "user", email: validEmail } });
    }

    return {
        lead_id: lead?.dataValues?.id || null,
        lead_uuid: lead?.dataValues?.uuid || null,
        student_id: student?.dataValues?.id || null,
        phone: phone || null,
        email: validEmail,
    };
};

export const findPublishedByToken = async (token: string) => {
    if (!/^[a-f0-9]{24,64}$/i.test(token)) return null;
    const form: any = await ClientForm.findOne({ where: { share_token: token, status: "published" } });
    return form || null;
};

/** Turn stored file keys into signed URLs for agency viewing. */
export const presentAnswers = (fields: FormField[], answers: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const f of fields || []) {
        const v = answers?.[f.id];
        if (v == null || v === "") continue;
        if (f.type === "file" && typeof v === "object" && v.file) {
            out[f.id] = {
                name: v.name || "file",
                url: signedFileUrl("student_docs", v.file),
            };
        } else {
            out[f.id] = v;
        }
    }
    return out;
};

export const extractContactFromAnswers = (fields: FormField[], answers: Record<string, any>, bodyContact?: { name?: string; email?: string; phone?: string }) => {
    let name = String(bodyContact?.name || "").trim().slice(0, 255) || null;
    let email = String(bodyContact?.email || "").trim().slice(0, 255) || null;
    let phone = String(bodyContact?.phone || "").trim().slice(0, 40) || null;

    for (const f of fields || []) {
        const v = answers?.[f.id];
        if (v == null || v === "") continue;
        const s = Array.isArray(v) ? v.join(", ") : String(v);
        if (!name && /name/i.test(f.label) && f.type === "short_text") name = s.slice(0, 255);
        if (!email && f.type === "email") email = s.slice(0, 255);
        if (!phone && f.type === "phone") phone = s.slice(0, 40);
    }
    return { name, email, phone };
};
