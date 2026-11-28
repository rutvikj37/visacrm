import { Response } from "express";
import { Op, Sequelize } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, leadScope } from "../../helpers/access";
import CrmLead from "../../model/CrmLead";
import CrmLeadActivity from "../../model/CrmLeadActivity";
import LeadIntegration from "../../model/LeadIntegration";
import WhatsappPendingChat from "../../model/WhatsappPendingChat";
import Agent from "../../model/Agent";
import { branchFilter } from "../../services/branches";
import {
    countPendingUnread,
    dismissPendingWhatsapp,
    presentPending,
    presentPendingThread,
    promotePendingWhatsapp,
} from "../../services/whatsappPending";

/**
 * Shared WhatsApp + Instagram inbox. Messages already live on each lead's timeline (activities of type
 * whatsapp / instagram with meta.direction in|out); this groups them into chats the team can answer.
 * Replies go through the existing /crm/leads/:uuid/whatsapp|instagram endpoints.
 */

const CHANNELS = ["whatsapp", "instagram"] as const;
const WINDOW_MS = 24 * 3600 * 1000; // Meta only allows free-form replies within 24h of the person's last message
const metaOf = (a: any) => { const m = a?.meta; if (!m || typeof m !== "string") return m || {}; try { return JSON.parse(m); } catch { return {}; } };
const direction = (a: any) => (metaOf(a).direction === "in" ? "in" : "out");
// activities store "Received: text" / "Sent: text" - show only the text in the chat
const clean = (m: any) => String(m || "").replace(/^(Received|Sent):\s*/, "");

/** Friendlier line for inbox list + search when the stored text is a Meta placeholder. */
const humanizeChatText = (raw: string) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (/^\[document\]/i.test(s)) return "Document";
    if (/^\[image\]/i.test(s)) return "Photo";
    if (/^\[unsupported\]/i.test(s) || s === "[unsupported]") return "Unsupported message type";
    if (/^\[(\w+)\]$/i.test(s)) return s.slice(1, -1).replace(/_/g, " ");
    return s;
};

const inboxPreview = (row: any) => {
    if (!row) return "";
    const meta = metaOf(row.dataValues || row);
    const raw = clean(row.dataValues?.message ?? row.message);
    if (meta?.file_url) {
        const name = meta.file_name || "attachment";
        const isImg = String(meta.mime || "").startsWith("image/") || /^(\[image\]|Photo)/i.test(raw);
        return isImg ? `Photo: ${name}` : `Document: ${name}`;
    }
    return humanizeChatText(raw);
};

// literal: Sequelize would escape the "$" of a JSON path passed as a value
const isInbound = Sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(\`CrmLeadActivity\`.\`meta\`, '$.direction')) = 'in'`);

/** Leads (in this person's scope) that have chat messages, newest chat first. */
const chatLeads = async (req: RequestWithUser, channel: string, extra: Record<string, any> = {}) => {
    const agencyUuid = accessOf(req).agencyUuid;
    const types = CHANNELS.includes(channel as any) ? [channel] : [...CHANNELS];
    const agg: any[] = await CrmLeadActivity.findAll({
        attributes: ["lead_id", [Sequelize.fn("MAX", Sequelize.col("id")), "last_id"]],
        where: { agency_uuid: agencyUuid, type: types },
        group: ["lead_id"], raw: true,
    });
    if (!agg.length) return { leads: [] as any[], lastIds: new Map<number, number>(), types };
    const lastIds = new Map<number, number>(agg.map((r) => [Number(r.lead_id), Number(r.last_id)]));
    const where: any = { ...leadScope(req), ...branchFilter(req), id: [...lastIds.keys()], ...extra };
    const leads: any[] = await CrmLead.findAll({
        where,
        attributes: ["id", "uuid", "name", "phone_normalized", "source", "source_ref", "status", "assigned_to", "branch_id", "interested_country", "chat_read_at"],
    });
    return { leads, lastIds, types };
};

/** Inbound messages per lead after it was last read (and when the last inbound message came). */
const inboundStats = async (agencyUuid: string, leadIds: number[], types: string[]) => {
    const stats = new Map<number, { unread: number; lastIn: Record<string, Date> }>();
    if (!leadIds.length) return { stats, rows: [] as any[] };
    const rows: any[] = await CrmLeadActivity.findAll({
        attributes: ["lead_id", "type", "createdAt"],
        where: { agency_uuid: agencyUuid, lead_id: leadIds, type: types, createdAt: { [Op.gte]: new Date(Date.now() - 60 * 24 * 3600 * 1000) }, [Op.and]: [isInbound] },
        raw: true,
    });
    for (const r of rows) {
        const s = stats.get(Number(r.lead_id)) || { unread: 0, lastIn: {} };
        const at = new Date(r.createdAt);
        if (!s.lastIn[r.type] || s.lastIn[r.type] < at) s.lastIn[r.type] = at;
        stats.set(Number(r.lead_id), s);
    }
    return { stats, rows };
};

class ConversationController {
    // GET /crm/conversations?channel=all|whatsapp|instagram&filter=all|unread|mine&q=&branch=
    async list(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const channel = String(req.query.channel || "all");
            const filter = String(req.query.filter || "all");
            const q = String(req.query.q || "").trim();
            const extra: any = {};
            if (filter === "mine") extra.assigned_to = a.userId;
            const { leads, lastIds, types } = await chatLeads(req, channel, extra);
            const ids = leads.map((l) => l.dataValues.id);
            const { stats, rows } = await inboundStats(a.agencyUuid, ids, types);

            const lastRows: any[] = ids.length
                ? await CrmLeadActivity.findAll({ where: { id: ids.map((id: number) => lastIds.get(id)) }, attributes: ["id", "lead_id", "type", "message", "meta", "createdAt"] })
                : [];
            const lastBy = new Map(lastRows.map((r) => [Number(r.dataValues.lead_id), r]));
            const people: any[] = await Agent.findAll({ where: { id: [...new Set(leads.map((l) => l.dataValues.assigned_to).filter(Boolean))] }, attributes: ["id", ["username", "name"]], raw: true });
            const nameOf = new Map(people.map((p) => [Number(p.id), p.name]));

            let list = leads.map((l) => {
                const d = l.dataValues;
                const last = lastBy.get(d.id);
                const readAt = d.chat_read_at ? new Date(d.chat_read_at) : null;
                const unread = rows.filter((r: any) => Number(r.lead_id) === d.id && (!readAt || new Date(r.createdAt) > readAt)).length;
                const lastIn = stats.get(d.id)?.lastIn || {};
                return {
                    uuid: d.uuid, name: d.name || (d.source === "instagram" ? "Instagram user" : "Unnamed"), status: d.status,
                    country: d.interested_country, assigned_to: d.assigned_to, assigned_name: nameOf.get(Number(d.assigned_to)) || null,
                    channel: last?.dataValues.type || "whatsapp",
                    last_message: inboxPreview(last), last_direction: direction(last?.dataValues), last_at: last?.dataValues.createdAt,
                    unread,
                    window_open: Object.values(lastIn).some((t: any) => Date.now() - new Date(t).getTime() < WINDOW_MS),
                };
            });
            if (filter === "unread") list = list.filter((c) => c.unread > 0);
            if (q) {
                const s = q.toLowerCase();
                const digits = q.replace(/\D/g, "");
                const phoneOf = new Map(leads.map((l) => [l.dataValues.uuid, String(l.dataValues.phone_normalized || "")]));
                list = list.filter((c) => String(c.name).toLowerCase().includes(s) || (digits.length >= 3 && phoneOf.get(c.uuid)!.includes(digits)) || c.last_message.toLowerCase().includes(s));
            }
            // Review-first WhatsApp chats (not leads yet) — skip for Instagram-only filter
            let pendingList: any[] = [];
            if (channel !== "instagram" && filter !== "mine") {
                const pendingRows: any[] = await WhatsappPendingChat.findAll({
                    where: { agency_uuid: a.agencyUuid, status: "pending" },
                    order: [["last_message_at", "DESC"]],
                    limit: 100,
                });
                pendingList = pendingRows.map(presentPending);
                if (filter === "unread") pendingList = pendingList.filter((c) => c.unread > 0);
                if (q) {
                    const s = q.toLowerCase();
                    const digits = q.replace(/\D/g, "");
                    pendingList = pendingList.filter((c) =>
                        String(c.name).toLowerCase().includes(s)
                        || (digits.length >= 3 && String(c.phone_normalized || "").includes(digits))
                        || String(c.last_message || "").toLowerCase().includes(s));
                }
            }

            list.sort((x, y) => new Date(y.last_at).getTime() - new Date(x.last_at).getTime());
            const merged = [...pendingList, ...list].sort((x, y) => new Date(y.last_at || 0).getTime() - new Date(x.last_at || 0).getTime());
            const unreadChats = merged.filter((c) => c.unread > 0).length;
            return returnHelper(res, 200, true, "Conversations", {
                conversations: merged.slice(0, 200),
                unread_chats: unreadChats,
                pending_count: pendingList.length,
            });
        } catch (error) {
            console.error("conversations failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/conversations/unread  - badge count for the menu
    async unread(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const pending = await countPendingUnread(a.agencyUuid);
            const { leads, types } = await chatLeads(req, "all");
            if (!leads.length) return returnHelper(res, 200, true, "Unread", { unread_chats: pending });
            const readAt = new Map(leads.map((l) => [l.dataValues.id, l.dataValues.chat_read_at ? new Date(l.dataValues.chat_read_at) : null]));
            const { rows } = await inboundStats(a.agencyUuid, [...readAt.keys()], types);
            const unreadLeads = new Set(rows.filter((r: any) => { const t = readAt.get(Number(r.lead_id)); return !t || new Date(r.createdAt) > t; }).map((r: any) => Number(r.lead_id)));
            return returnHelper(res, 200, true, "Unread", { unread_chats: unreadLeads.size + pending });
        } catch (error) {
            console.error("conversations unread failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/conversations/pending/:uuid  - review a chat before it is a lead
    async pendingThread(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const row: any = await WhatsappPendingChat.findOne({
                where: { uuid: req.params.uuid, agency_uuid: a.agencyUuid, status: "pending" },
            });
            if (!row) return returnHelper(res, 200, false, "Pending chat not found");
            await WhatsappPendingChat.update({ read_at: new Date() }, { where: { id: row.dataValues.id } });
            const fresh = await WhatsappPendingChat.findByPk(row.dataValues.id);
            return returnHelper(res, 200, true, "Pending conversation", presentPendingThread(fresh));
        } catch (error) {
            console.error("pending thread failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/conversations/pending/:uuid/promote  - staff marks positive → create lead
    async promotePending(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const result = await promotePendingWhatsapp(a.agencyUuid, req.params.uuid, a.userId || null);
            return returnHelper(res, 200, result.ok, result.message, result.ok ? { lead_uuid: result.lead_uuid } : undefined);
        } catch (error) {
            console.error("promote pending failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/conversations/pending/:uuid/dismiss
    async dismissPending(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const result = await dismissPendingWhatsapp(a.agencyUuid, req.params.uuid);
            return returnHelper(res, 200, result.ok, result.message);
        } catch (error) {
            console.error("dismiss pending failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/conversations/:uuid  - the chat with one lead (marks it read)
    async thread(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const lead: any = await CrmLead.findOne({ where: { ...leadScope(req), uuid: req.params.uuid } });
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            const d = lead.dataValues;
            const rows: any[] = await CrmLeadActivity.findAll({
                where: { lead_id: d.id, agency_uuid: a.agencyUuid, type: [...CHANNELS] },
                order: [["id", "DESC"]], limit: 300,
            });
            rows.reverse();
            const senders: any[] = await Agent.findAll({ where: { id: [...new Set(rows.map((r) => r.dataValues.created_by).filter(Boolean))] }, attributes: ["id", ["username", "name"]], raw: true });
            const senderOf = new Map(senders.map((s) => [Number(s.id), s.name]));
            const lastIn: Record<string, number> = {};
            const messages = rows.map((r) => {
                const x = r.dataValues;
                const dir = direction(x);
                if (dir === "in") lastIn[x.type] = Math.max(lastIn[x.type] || 0, new Date(x.createdAt).getTime());
                const meta = metaOf(x);
                const raw = clean(x.message);
                return {
                    id: x.id, channel: x.type, direction: dir,
                    text: meta.file_url ? inboxPreview(r) : humanizeChatText(raw),
                    raw_text: raw,
                    at: x.createdAt,
                    by: dir === "out" ? (x.created_by ? senderOf.get(Number(x.created_by)) || "Team" : "Automatic") : null,
                    file_url: meta.file_url || null,
                    file_name: meta.file_name || null,
                    mime: meta.mime || null,
                };
            });

            const [wa, ig] = await Promise.all([
                LeadIntegration.count({ where: { agency_uuid: a.agencyUuid, type: "whatsapp", status: "active" } }),
                LeadIntegration.count({ where: { agency_uuid: a.agencyUuid, type: "instagram", status: "active" } }),
            ]);
            const open = (ch: string) => Boolean(lastIn[ch] && Date.now() - lastIn[ch] < WINDOW_MS);
            const channels = {
                whatsapp: { connected: wa > 0, possible: Boolean(d.phone_normalized), window_open: open("whatsapp"), window_ends_at: lastIn.whatsapp ? new Date(lastIn.whatsapp + WINDOW_MS) : null },
                instagram: { connected: ig > 0, possible: d.source === "instagram" && Boolean(d.source_ref), window_open: open("instagram"), window_ends_at: lastIn.instagram ? new Date(lastIn.instagram + WINDOW_MS) : null },
            };
            const assignee: any = d.assigned_to ? await Agent.findOne({ where: { id: d.assigned_to }, attributes: [["username", "name"]], raw: true }) : null;
            await CrmLead.update({ chat_read_at: new Date() }, { where: { id: d.id }, silent: true });
            return returnHelper(res, 200, true, "Conversation", {
                lead: { uuid: d.uuid, name: d.name, phone_normalized: d.phone_normalized, status: d.status, source: d.source, country: d.interested_country, course: d.interested_course, assigned_name: assignee?.name || null },
                messages, channels,
            });
        } catch (error) {
            console.error("conversation thread failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new ConversationController();
