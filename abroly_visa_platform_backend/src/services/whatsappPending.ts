import WhatsappPendingChat from "../model/WhatsappPendingChat";
import LeadIntegration from "../model/LeadIntegration";
import { parseJsonValue } from "../helpers/json";
import { ingestLead, logActivity } from "./leadIngestion";
import { leadRecipients, notifyLater } from "./notifications";

const MAX_MESSAGES = 100;

export type PendingMessage = { wamid?: string | null; text: string; at: string };

/** Default true (current behaviour). Review-first when settings.auto_create_leads === false. */
export const autoCreateLeads = (integration: any): boolean => {
    const settings = parseJsonValue(integration?.dataValues?.settings ?? integration?.settings) || {};
    return settings.auto_create_leads !== false;
};

const asMessages = (raw: any): PendingMessage[] => {
    const list = parseJsonValue(raw);
    return Array.isArray(list) ? list : [];
};

/** Append an inbound WhatsApp message to a pending chat (or reopen a dismissed one). */
export const upsertPendingWhatsapp = async (opts: {
    agencyUuid: string;
    integrationId: number;
    phoneNormalized: string;
    profileName?: string | null;
    text: string;
    wamid?: string | null;
    campaign?: string | null;
    extra?: Record<string, any> | null;
}) => {
    const { agencyUuid, integrationId, phoneNormalized, text, wamid } = opts;
    let row: any = await WhatsappPendingChat.findOne({
        where: { agency_uuid: agencyUuid, phone_normalized: phoneNormalized, status: "pending" },
    });
    if (!row) {
        row = await WhatsappPendingChat.findOne({
            where: { agency_uuid: agencyUuid, phone_normalized: phoneNormalized, status: "dismissed" },
            order: [["updatedAt", "DESC"]],
        });
    }

    const at = new Date().toISOString();
    if (row) {
        const messages = asMessages(row.dataValues.messages);
        if (wamid && messages.some((m) => m.wamid && m.wamid === wamid)) return row;
        messages.push({ wamid: wamid || null, text, at });
        while (messages.length > MAX_MESSAGES) messages.shift();
        await WhatsappPendingChat.update({
            status: "pending",
            integration_id: integrationId,
            profile_name: opts.profileName || row.dataValues.profile_name || null,
            last_message: text.slice(0, 4000),
            last_message_at: new Date(),
            message_count: messages.length,
            messages,
            campaign: opts.campaign || row.dataValues.campaign || null,
            extra: opts.extra || row.dataValues.extra || null,
            lead_id: null,
        }, { where: { id: row.dataValues.id } });
        return WhatsappPendingChat.findByPk(row.dataValues.id);
    }

    return WhatsappPendingChat.create({
        agency_uuid: agencyUuid,
        integration_id: integrationId,
        phone_normalized: phoneNormalized,
        profile_name: opts.profileName || null,
        last_message: text.slice(0, 4000),
        last_message_at: new Date(),
        message_count: 1,
        messages: [{ wamid: wamid || null, text, at }],
        campaign: opts.campaign || null,
        extra: opts.extra || null,
        status: "pending",
    });
};

export const presentPending = (row: any) => {
    const d = row.toJSON ? row.toJSON() : row.dataValues || row;
    const messages = asMessages(d.messages);
    const readAt = d.read_at ? new Date(d.read_at) : null;
    const unread = messages.filter((m) => !readAt || new Date(m.at) > readAt).length;
    return {
        uuid: d.uuid,
        pending: true,
        name: d.profile_name || "WhatsApp contact",
        phone_normalized: d.phone_normalized,
        last_message: d.last_message || "",
        last_at: d.last_message_at,
        message_count: d.message_count || messages.length,
        unread: unread || (readAt ? 0 : 1),
        campaign: d.campaign || null,
        status: d.status,
        channel: "whatsapp",
        last_direction: "in",
        assigned_name: null,
        window_open: d.last_message_at ? Date.now() - new Date(d.last_message_at).getTime() < 24 * 3600 * 1000 : false,
    };
};

export const presentPendingThread = (row: any) => {
    const d = row.toJSON ? row.toJSON() : row.dataValues || row;
    const messages = asMessages(d.messages).map((m, i) => ({
        id: m.wamid || `p${i}`,
        channel: "whatsapp",
        direction: "in" as const,
        text: m.text,
        at: m.at,
        by: null,
    }));
    return {
        pending: true,
        lead: {
            uuid: d.uuid,
            name: d.profile_name || "WhatsApp contact",
            phone_normalized: d.phone_normalized,
            status: "pending_review",
            source: "whatsapp",
            country: null,
            course: null,
            assigned_name: null,
        },
        messages,
        channels: {
            whatsapp: { connected: true, possible: true, window_open: false, window_ends_at: null },
            instagram: { connected: false, possible: false, window_open: false, window_ends_at: null },
        },
    };
};

/** Turn a pending chat into a CRM lead and copy messages onto the timeline. */
export const promotePendingWhatsapp = async (agencyUuid: string, pendingUuid: string, createdBy: number | null = null) => {
    const row: any = await WhatsappPendingChat.findOne({
        where: { uuid: pendingUuid, agency_uuid: agencyUuid, status: "pending" },
    });
    if (!row) return { ok: false as const, message: "Pending chat not found" };

    const d = row.dataValues;
    const messages = asMessages(d.messages);
    const firstText = messages[0]?.text || d.last_message || "";

    const result = await ingestLead({
        agencyUuid,
        source: "whatsapp",
        integrationId: d.integration_id,
        createdBy,
        input: {
            name: d.profile_name || null,
            phone: `+${d.phone_normalized}`,
            message: firstText,
            campaign: d.campaign || null,
            extra: d.extra || null,
        },
    });

    const leadId = result.lead.dataValues.id;
    const leadUuid = result.lead.dataValues.uuid;
    const existingWamids = new Set<string>();

    for (const m of messages) {
        if (m.wamid && existingWamids.has(m.wamid)) continue;
        if (m.wamid) existingWamids.add(m.wamid);
        await logActivity(leadId, agencyUuid, "whatsapp", `Received: ${m.text}`, null, {
            direction: "in",
            wamid: m.wamid || null,
            from_pending: true,
        });
    }

    await WhatsappPendingChat.update({
        status: "converted",
        lead_id: leadId,
        read_at: new Date(),
    }, { where: { id: d.id } });

    notifyLater({
        agencyUuid,
        recipientIds: await leadRecipients(agencyUuid, result.lead.dataValues.assigned_to),
        type: "new_lead",
        title: `WhatsApp lead: ${d.profile_name || d.phone_normalized}`,
        body: (d.last_message || "").slice(0, 200),
        link: `/crm/leads/${leadUuid}`,
        dedupeKey: `wa-promote:${leadId}`,
    });

    return { ok: true as const, message: "Added as lead", lead_uuid: leadUuid, lead: result.lead };
};

export const dismissPendingWhatsapp = async (agencyUuid: string, pendingUuid: string) => {
    const row: any = await WhatsappPendingChat.findOne({
        where: { uuid: pendingUuid, agency_uuid: agencyUuid, status: "pending" },
    });
    if (!row) return { ok: false as const, message: "Pending chat not found" };
    await WhatsappPendingChat.update({ status: "dismissed", read_at: new Date() }, { where: { id: row.dataValues.id } });
    return { ok: true as const, message: "Dismissed. This chat will not become a lead." };
};

export const setWhatsappAutoCreate = async (agencyUuid: string, integrationUuid: string, autoCreate: boolean) => {
    const row: any = await LeadIntegration.findOne({
        where: { uuid: integrationUuid, agency_uuid: agencyUuid, type: "whatsapp" },
    });
    if (!row) return { ok: false as const, message: "WhatsApp number not found" };
    const settings = { ...(parseJsonValue(row.dataValues.settings) || {}), auto_create_leads: autoCreate };
    await LeadIntegration.update({ settings }, { where: { id: row.dataValues.id } });
    return {
        ok: true as const,
        message: autoCreate
            ? "New WhatsApp chats will become leads automatically."
            : "New WhatsApp chats stay in the inbox until you add them as leads.",
        auto_create_leads: autoCreate,
    };
};

export const countPendingUnread = async (agencyUuid: string) => {
    return WhatsappPendingChat.count({ where: { agency_uuid: agencyUuid, status: "pending" } });
};
