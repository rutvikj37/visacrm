import { Response } from "express";
import { Op, Sequelize } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import MessageTemplate, { MESSAGE_TRIGGERS } from "../../model/MessageTemplate";
import CrmLead, { CRM_LEAD_SOURCES, CRM_LEAD_STATUSES } from "../../model/CrmLead";
import LeadIntegration from "../../model/LeadIntegration";
import { MESSAGE_VARIABLES, renderText, sendTemplate } from "../../services/messaging";
import { studentPortalUrl } from "../../services/leadConversion";
import { mailEnabled } from "../../services/mailer";
import { HOT_SCORE, WARM_SCORE } from "../../services/leadScore";

/** Message templates, automations and broadcasts (agency owner). */

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, isOwner: user.role === "agent" };
};
const MAX_BROADCAST = 500;

const present = (t: any) => {
    const x = t.toJSON();
    return {
        id: x.uuid, name: x.name, channel: x.channel, trigger: x.trigger, subject: x.subject, body: x.body,
        wa_template_name: x.wa_template_name, wa_language: x.wa_language, wa_variables: Array.isArray(x.wa_variables) ? x.wa_variables : [],
        is_active: Number(x.is_active) === 1, sent_count: x.sent_count, failed_count: x.failed_count, last_error: x.last_error,
    };
};

const readBody = (b: any) => {
    const name = String(b?.name || "").trim().slice(0, 100);
    if (!name) throw new Error("Please give the message a name");
    const channel = b?.channel === "email" ? "email" : "whatsapp";
    const trigger = (MESSAGE_TRIGGERS as readonly string[]).includes(b?.trigger) ? b.trigger : "manual";
    const body = String(b?.body || "").trim().slice(0, 4000);
    if (!body) throw new Error("Please write the message");
    const waName = channel === "whatsapp" ? String(b?.wa_template_name || "").trim().toLowerCase().slice(0, 100) : "";
    if (waName && !/^[a-z0-9_]+$/.test(waName)) throw new Error("WhatsApp template name uses small letters, numbers and _ only (copy it from WhatsApp Manager)");
    if (channel === "whatsapp" && trigger !== "manual" && !waName) throw new Error("Automatic WhatsApp messages need an approved template name");
    const vars = Array.isArray(b?.wa_variables) ? b.wa_variables.filter((v: any) => MESSAGE_VARIABLES.includes(v)).slice(0, 10) : [];
    return {
        name, channel, trigger, body,
        subject: channel === "email" ? String(b?.subject || name).trim().slice(0, 200) : null,
        wa_template_name: waName || null, wa_language: waName ? String(b?.wa_language || "en").trim().slice(0, 10) : null, wa_variables: waName ? vars : null,
        is_active: b?.is_active === false ? 0 : 1,
    };
};

const audienceWhere = (agencyUuid: string, f: any) => {
    const where: any = { agency_uuid: agencyUuid };
    if (f?.status === "open") where.status = { [Op.notIn]: ["converted", "lost", "junk"] };
    else if ((CRM_LEAD_STATUSES as readonly string[]).includes(f?.status)) where.status = f.status;
    else where.status = { [Op.ne]: "junk" };
    if ((CRM_LEAD_SOURCES as readonly string[]).includes(f?.source)) where.source = f.source;
    if (f?.temperature === "hot") where.score = { [Op.gte]: HOT_SCORE };
    else if (f?.temperature === "warm") where.score = { [Op.gte]: WARM_SCORE, [Op.lt]: HOT_SCORE };
    else if (f?.temperature === "cold") where.score = { [Op.lt]: WARM_SCORE };
    if (f?.country) where.interested_country = String(f.country).slice(0, 100);
    if (f?.tag) {
        const tag = String(f.tag).trim().slice(0, 40).replace(/["%_\\]/g, "");
        where[Op.and] = [Sequelize.where(Sequelize.cast(Sequelize.col("tags"), "CHAR"), { [Op.like]: `%"${tag}"%` })];
    }
    return where;
};

class MessagingController {
    // GET /crm/messages/templates
    async list(req: RequestWithUser, res: Response) {
        const { agencyUuid } = ctx(req);
        const rows = await MessageTemplate.findAll({ where: { agency_uuid: agencyUuid }, order: [["trigger", "ASC"], ["name", "ASC"]] });
        const whatsapp = await LeadIntegration.count({ where: { agency_uuid: agencyUuid, type: "whatsapp", status: "active" } });
        return returnHelper(res, 200, true, "Templates", {
            templates: rows.map(present), variables: MESSAGE_VARIABLES, triggers: MESSAGE_TRIGGERS,
            whatsapp_connected: whatsapp > 0, email_available: mailEnabled(),
        });
    }

    // POST /crm/messages/templates { id?, ...fields }
    async save(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage messages");
            let data;
            try { data = readBody(req.body); } catch (e: any) { return returnHelper(res, 200, false, e.message); }
            if (req.body?.id) {
                const [n] = await MessageTemplate.update(data, { where: { uuid: req.body.id, agency_uuid: agencyUuid } });
                if (!n) return returnHelper(res, 200, false, "Message not found");
                return returnHelper(res, 200, true, "Message saved");
            }
            if (await MessageTemplate.count({ where: { agency_uuid: agencyUuid } }) >= 50) return returnHelper(res, 200, false, "You can keep up to 50 messages");
            await MessageTemplate.create({ ...data, agency_uuid: agencyUuid });
            return returnHelper(res, 200, true, "Message saved");
        } catch (error) {
            console.error("save message template failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/messages/templates/:id/delete
    async remove(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage messages");
        const n = await MessageTemplate.destroy({ where: { uuid: req.params.id, agency_uuid: agencyUuid } });
        return returnHelper(res, 200, Boolean(n), n ? "Message deleted" : "Message not found");
    }

    // POST /crm/messages/audience { filters }  - how many leads a broadcast would reach
    async audience(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can send broadcasts");
        const where = audienceWhere(agencyUuid, req.body?.filters || {});
        const [total, withPhone, withEmail] = await Promise.all([
            CrmLead.count({ where }),
            CrmLead.count({ where: { ...where, phone_normalized: { [Op.ne]: null } } }),
            CrmLead.count({ where: { ...where, email: { [Op.ne]: null } } }),
        ]);
        return returnHelper(res, 200, true, "Audience", { total, with_phone: withPhone, with_email: withEmail, max: MAX_BROADCAST });
    }

    // POST /crm/messages/broadcast { template_id, filters }
    async broadcast(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can send broadcasts");
            const template: any = await MessageTemplate.findOne({ where: { uuid: req.body?.template_id, agency_uuid: agencyUuid } });
            if (!template) return returnHelper(res, 200, false, "Message not found");
            const t = template.dataValues;
            if (t.channel === "whatsapp" && !t.wa_template_name) return returnHelper(res, 200, false, "WhatsApp broadcasts need an approved template name on the message");
            if (t.channel === "email" && !mailEnabled()) return returnHelper(res, 200, false, "Email sending is not set up on this platform yet");
            const where = audienceWhere(agencyUuid, req.body?.filters || {});
            where[t.channel === "email" ? "email" : "phone_normalized"] = { [Op.ne]: null };
            const leads: any[] = await CrmLead.findAll({ where, attributes: ["id", "name", "phone_normalized", "email", "interested_country"], order: [["score", "DESC"]], limit: MAX_BROADCAST });
            if (!leads.length) return returnHelper(res, 200, false, "No leads match these filters");

            const { base, agencyName } = await studentPortalUrl(agencyUuid);
            // send in the background, one by one, so the request returns immediately
            setImmediate(async () => {
                for (const lead of leads) {
                    const l = lead.dataValues;
                    await sendTemplate(template, { name: l.name, phoneDigits: l.phone_normalized, email: l.email, leadId: l.id }, { agency: agencyName, portal_link: base ? `${base}/login` : "", country: l.interested_country || "" });
                    await new Promise((r) => setTimeout(r, 150));
                }
            });
            return returnHelper(res, 200, true, `Sending to ${leads.length} lead(s). Results appear on the message card in a few minutes.`, { count: leads.length });
        } catch (error) {
            console.error("broadcast failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/messages/preview { body, subject? }
    async preview(req: RequestWithUser, res: Response) {
        const { base, agencyName } = await studentPortalUrl(ctx(req).agencyUuid);
        const vars = { name: "Rahul", agency: agencyName, country: "Canada", portal_link: base ? `${base}/login` : "https://your-portal", amount: "Rs 25,000", due_date: "15 Dec 2026", pending_count: 3 };
        return returnHelper(res, 200, true, "Preview", { body: renderText(String(req.body?.body || ""), vars), subject: renderText(String(req.body?.subject || ""), vars) });
    }
}

export default new MessagingController();
