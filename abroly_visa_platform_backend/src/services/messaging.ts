import { Op } from "sequelize";
import MessageTemplate from "../model/MessageTemplate";
import Agent from "../model/Agent";
import User from "../model/User";
import CrmLead from "../model/CrmLead";
import CrmLeadActivity from "../model/CrmLeadActivity";
import AgencyLeads from "../model/AgencyLeads";
import Step from "../model/Step";
import Question from "../model/Question";
import ClientInvoice from "../model/ClientInvoice";
import { agencyBrand, sendMail } from "./mailer";
import { sendWhatsappTemplate, sendWhatsappText } from "./meta";
import { studentPortalUrl } from "./leadConversion";

/**
 * Messages to leads and students (not to the team - that is services/notifications.ts).
 *
 *   manual             - broadcast to chosen leads
 *   lead_created       - welcome message when a new lead arrives
 *   lead_converted     - when a lead becomes a visa case
 *   documents_pending  - reminder while the student still owes documents (at most every 3 days)
 *   fee_due            - reminder when a fee is due within 2 days or overdue (at most every 3 days)
 *
 * WhatsApp messages sent automatically must use a template approved in WhatsApp Manager
 * (free text only works within 24 hours of the person's last message).
 */

export interface Recipient {
    name?: string | null;
    phoneDigits?: string | null; // country code + number, digits only
    email?: string | null;
    leadId?: number | null;      // logged on this lead's timeline when known
}

export const MESSAGE_VARIABLES = ["name", "agency", "country", "portal_link", "amount", "due_date", "pending_count"];
const DAY = 24 * 60 * 60 * 1000;

export const renderText = (text: string, vars: Record<string, any>) =>
    String(text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => {
        const v = vars[String(key).toLowerCase()];
        return v === undefined || v === null ? "" : String(v);
    });

const agencyVars = async (agencyUuid: string) => {
    const { base, agencyName } = await studentPortalUrl(agencyUuid);
    return { agency: agencyName, portal_link: base ? `${base}/login` : "" };
};

/** Send one template to one person. Never throws; returns whether it went out. */
export const sendTemplate = async (template: any, recipient: Recipient, vars: Record<string, any>): Promise<{ ok: boolean; error?: string }> => {
    const t = template.dataValues || template;
    const firstName = String(recipient.name || "").trim().split(" ")[0] || "there";
    const all = { ...vars, name: vars.name || firstName };
    const text = renderText(t.body, all);
    let ok = false, error: string | undefined;
    try {
        if (t.channel === "email") {
            if (!recipient.email) throw new Error("No email address");
            ok = await sendMail(recipient.email, renderText(t.subject || t.name, all), text, null, await agencyBrand(t.agency_uuid));
            if (!ok) throw new Error("Email is not set up or the mail server refused it");
        } else {
            if (!recipient.phoneDigits) throw new Error("No phone number");
            if (t.wa_template_name) {
                const order: string[] = Array.isArray(t.wa_variables) ? t.wa_variables : [];
                await sendWhatsappTemplate(t.agency_uuid, recipient.phoneDigits, t.wa_template_name, t.wa_language || "en", order.map((k) => String((all as any)[k] ?? "")));
            } else {
                await sendWhatsappText(t.agency_uuid, { dataValues: { phone_normalized: recipient.phoneDigits } }, text);
            }
            ok = true;
        }
    } catch (e: any) {
        error = String(e?.message || "Send failed").slice(0, 500);
    }
    try {
        if (ok) await MessageTemplate.increment("sent_count", { where: { id: t.id } });
        else await MessageTemplate.update({ failed_count: (Number(t.failed_count) || 0) + 1, last_error: error }, { where: { id: t.id } });
        if (ok && recipient.leadId) {
            await CrmLeadActivity.create({
                lead_id: recipient.leadId, agency_uuid: t.agency_uuid, type: t.channel === "email" ? "email" : "whatsapp",
                message: `Sent (${t.name}): ${text}`.slice(0, 5000), created_by: null, meta: { direction: "out", auto: true, template: t.uuid },
            });
        }
    } catch (e) { console.error("message log failed", e); }
    return { ok, error };
};

/** Send every active template of an agency for a trigger. Fire-and-forget. */
export const runTrigger = (agencyUuid: string, trigger: string, recipient: Recipient, vars: Record<string, any> = {}) => {
    setImmediate(async () => {
        try {
            const templates = await MessageTemplate.findAll({ where: { agency_uuid: agencyUuid, trigger, is_active: 1 } });
            if (!templates.length) return;
            const base = await agencyVars(agencyUuid);
            for (const template of templates) await sendTemplate(template, recipient, { ...base, ...vars });
        } catch (error) {
            console.error(`message trigger ${trigger} failed`, error);
        }
    });
};

const studentRecipient = async (studentId: number, agencyUuid: string): Promise<Recipient | null> => {
    const student: any = await User.findByPk(studentId, { attributes: ["id", "username", "phone_number", "country_code", "email"] });
    if (!student) return null;
    const lead: any = await CrmLead.findOne({ where: { agency_uuid: agencyUuid, converted_student_id: studentId }, attributes: ["id"], order: [["id", "DESC"]] });
    const s = student.dataValues;
    return { name: s.username, phoneDigits: s.phone_number ? `${String(s.country_code || "+91").replace(/\D/g, "")}${s.phone_number}` : null, email: s.email, leadId: lead?.dataValues?.id || null };
};

const agenciesWith = async (trigger: string) => {
    const rows: any[] = await MessageTemplate.findAll({ where: { trigger, is_active: 1 }, attributes: ["agency_uuid"], group: ["agency_uuid"], raw: true });
    if (!rows.length) return [];
    const active: any[] = await Agent.findAll({ where: { uuid: rows.map((r) => r.agency_uuid), role: "agent", status: "active", expires_at: { [Op.gt]: new Date() } }, attributes: ["uuid"], raw: true });
    return active.map((a) => a.uuid);
};

/** Daily window for automatic messages to students: 10:00 - 19:00 IST. */
const inSendingHours = () => {
    const hour = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000).getUTCHours();
    return hour >= 10 && hour < 19;
};

/** Students who still owe documents / answers: remind at most once every 3 days. */
export const documentsPendingReminders = async () => {
    if (!inSendingHours()) return;
    for (const agencyUuid of await agenciesWith("documents_pending")) {
        const cases: any[] = await AgencyLeads.findAll({
            where: { agent_uuid: agencyUuid, status: "visa_progress", [Op.or]: [{ docs_reminded_at: null }, { docs_reminded_at: { [Op.lt]: new Date(Date.now() - 3 * DAY) } }] },
            attributes: ["id", "user_id", "selected_country", "createdAt"],
            limit: 300,
        });
        for (const c of cases) {
            const x = c.dataValues;
            if (Date.now() - new Date(x.createdAt).getTime() < DAY) continue; // give them a day first
            const steps: any[] = await Step.findAll({ where: { lead_id: x.id }, attributes: ["id"], raw: true });
            if (!steps.length) continue;
            const pending = await Question.count({ where: { step_id: steps.map((s) => s.id), status: ["pending", "rejected"], question_type: ["text_input", "file_selector"] } });
            if (!pending) continue;
            await AgencyLeads.update({ docs_reminded_at: new Date() }, { where: { id: x.id }, silent: true } as any);
            const recipient = await studentRecipient(x.user_id, agencyUuid);
            if (recipient) runTrigger(agencyUuid, "documents_pending", recipient, { country: x.selected_country || "", pending_count: pending });
        }
    }
};

/** Fees due within 2 days or overdue: remind at most once every 3 days. */
export const feeDueReminders = async () => {
    if (!inSendingHours()) return;
    const soon = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 10);
    for (const agencyUuid of await agenciesWith("fee_due")) {
        const invoices: any[] = await ClientInvoice.findAll({
            where: { agency_uuid: agencyUuid, status: ["unpaid", "partial"], [Op.or]: [{ reminded_at: null }, { reminded_at: { [Op.lt]: new Date(Date.now() - 3 * DAY) } }] },
            limit: 300,
        });
        for (const inv of invoices) {
            const x = inv.toJSON() as any;
            // next unpaid instalment, or the invoice due date
            let remaining = Number(x.amount_paid);
            let due: { amount: number; date: string | null } = { amount: Number(x.total) - Number(x.amount_paid), date: x.due_date };
            for (const i of Array.isArray(x.installments) ? x.installments : []) {
                if (remaining >= Number(i.amount)) { remaining -= Number(i.amount); continue; }
                due = { amount: Number(i.amount) - remaining, date: i.due_date };
                break;
            }
            if (!due.date || String(due.date) > soon || due.amount <= 0) continue;
            await ClientInvoice.update({ reminded_at: new Date() }, { where: { id: x.id } });
            const recipient = await studentRecipient(x.student_id, agencyUuid);
            if (!recipient) continue;
            runTrigger(agencyUuid, "fee_due", recipient, {
                amount: `Rs ${(due.amount / 100).toLocaleString("en-IN")}`,
                due_date: new Date(`${due.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                portal_link: x.payment_link_url || (await agencyVars(agencyUuid)).portal_link,
            });
        }
    }
};
