import axios from "axios";
import crypto from "crypto";
import path from "path";
import CrmLeadFile from "../model/CrmLeadFile";
import { agencyOwner, saveFile } from "../helpers/storage";
import { signedFileUrl } from "../helpers/privateFiles";
import { parseJsonValue } from "../helpers/json";
import { waCredentials } from "./meta";
import { peekMetaConfig } from "./metaSettings";
import { logActivity } from "./leadIngestion";

const MAX_BYTES = 25 * 1024 * 1024;
const MEDIA_TYPES = new Set(["document", "image"]);

const graphUrl = (p: string) => {
    const e = peekMetaConfig();
    return `${e.graphBase}/${e.version}/${p.replace(/^\/+/, "")}`;
};

const extOf = (mime?: string | null, filename?: string | null) => {
    const fromName = filename ? path.extname(filename) : "";
    if (fromName && fromName.length <= 8) return fromName.toLowerCase();
    const map: Record<string, string> = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/msword": ".doc",
    };
    return (mime && map[mime]) || ".bin";
};

const safeWamid = (id: string) => String(id).replace(/\W/g, "").slice(0, 80);

export type WhatsappMediaRef = {
    wamid: string;
    storage_name: string;
    original_name: string | null;
    mime: string | null;
    size: number;
    url: string;
};

export const presentLeadFile = (row: any) => {
    const d = row?.dataValues || row;
    return {
        uuid: d.uuid,
        original_name: d.original_name || d.storage_name,
        mime: d.mime,
        size: d.size,
        source: d.source,
        wamid: d.wamid,
        url: signedFileUrl("lead_files", d.storage_name),
        createdAt: d.createdAt,
    };
};

export const whatsappMediaPayload = (message: any): { mediaId: string; mime?: string; filename?: string; caption?: string } | null => {
    const type = String(message?.type || "");
    if (!MEDIA_TYPES.has(type)) return null;
    const part = message[type];
    const mediaId = part?.id ? String(part.id) : null;
    if (!mediaId) return null;
    return {
        mediaId,
        mime: part.mime_type || null,
        filename: type === "document" ? part.filename || null : null,
        caption: part.caption || null,
    };
};

const downloadMedia = async (accessToken: string, mediaId: string) => {
    const { data: meta } = await axios.get(graphUrl(mediaId), { params: { access_token: accessToken }, timeout: 20000 });
    const url = meta?.url;
    if (!url) throw new Error("Meta did not return a media URL");
    const { data, headers } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
    });
    const buffer = Buffer.from(data);
    if (buffer.length > MAX_BYTES) throw new Error("File is too large");
    return { buffer, mime: meta.mime_type || headers["content-type"] || null, size: buffer.length };
};

const leadFileExists = async (leadId: number, wamid: string) => {
    const found = await CrmLeadFile.findOne({ where: { lead_id: leadId, wamid }, attributes: ["id"] });
    return Boolean(found);
};

/** Download WhatsApp media and store on the lead; returns null when not a supported attachment or duplicate wamid. */
export const attachWhatsappMediaToLead = async (opts: {
    agencyUuid: string;
    leadId: number;
    integration: any;
    message: any;
    wamid?: string | null;
    activityMessage?: string;
}) => {
    const wamid = opts.wamid || opts.message?.id || null;
    const payload = whatsappMediaPayload(opts.message);
    if (!payload || !wamid) return null;
    if (await leadFileExists(opts.leadId, wamid)) return null;

    const credentials = waCredentials(opts.integration);
    const token = credentials?.access_token;
    if (!token) return null;

    let downloaded: { buffer: Buffer; mime: string | null; size: number };
    try {
        downloaded = await downloadMedia(token, payload.mediaId);
    } catch (error) {
        console.error("WhatsApp media download failed", wamid, error);
        return null;
    }

    const original = payload.filename || (opts.message.type === "image" ? `whatsapp-image${extOf(downloaded.mime)}` : `whatsapp-file${extOf(downloaded.mime)}`);
    const storage = `wa_${safeWamid(wamid)}_${crypto.randomUUID().slice(0, 8)}${extOf(downloaded.mime, original)}`;
    let storage_name: string;
    try {
        storage_name = await saveFile({
            owner: agencyOwner(opts.agencyUuid),
            folder: "lead_files",
            name: storage,
            body: downloaded.buffer,
            contentType: downloaded.mime || undefined,
        });
    } catch (error) {
        console.error("WhatsApp media save failed", wamid, error);
        return null;
    }

    const row: any = await CrmLeadFile.create({
        agency_uuid: opts.agencyUuid,
        lead_id: opts.leadId,
        storage_name,
        original_name: original.slice(0, 255),
        mime: downloaded.mime,
        size: downloaded.size,
        source: "whatsapp",
        wamid,
    });

    const url = signedFileUrl("lead_files", storage_name);
    const label = opts.message.type === "image" ? "Photo" : "Document";
    const text = opts.activityMessage || `Received: ${label}: ${original}${payload.caption ? ` — ${payload.caption}` : ""}`;
    const activity = await logActivity(opts.leadId, opts.agencyUuid, "whatsapp", text.slice(0, 4000), null, {
        direction: "in",
        wamid,
        file_uuid: row.dataValues.uuid,
        file_name: original,
        file_url: url,
        mime: downloaded.mime,
    });
    await CrmLeadFile.update({ activity_id: activity.dataValues.id }, { where: { id: row.dataValues.id } });

    return presentLeadFile(row);
};

export type PendingStoredFile = {
    wamid: string;
    storage_name: string;
    original_name: string | null;
    mime: string | null;
    size: number;
    at: string;
};

/** Download media for a review-first pending chat; stored on pending.extra.pending_files until promote. */
export const stashWhatsappMediaForPending = async (opts: {
    agencyUuid: string;
    integration: any;
    message: any;
    wamid?: string | null;
    extra: Record<string, any> | null;
}) => {
    const wamid = opts.wamid || opts.message?.id || null;
    const payload = whatsappMediaPayload(opts.message);
    if (!payload || !wamid) return opts.extra;

    const extra = { ...(opts.extra || {}) };
    const list: PendingStoredFile[] = Array.isArray(extra.pending_files) ? [...extra.pending_files] : [];
    if (list.some((f) => f.wamid === wamid)) return extra;

    const credentials = waCredentials(opts.integration);
    const token = credentials?.access_token;
    if (!token) return extra;

    try {
        const downloaded = await downloadMedia(token, payload.mediaId);
        const original = payload.filename || (opts.message.type === "image" ? `whatsapp-image${extOf(downloaded.mime)}` : `whatsapp-file${extOf(downloaded.mime)}`);
        const storage = `wa_${safeWamid(wamid)}_${crypto.randomUUID().slice(0, 8)}${extOf(downloaded.mime, original)}`;
        const storage_name = await saveFile({
            owner: agencyOwner(opts.agencyUuid),
            folder: "lead_files",
            name: storage,
            body: downloaded.buffer,
            contentType: downloaded.mime || undefined,
        });
        list.push({
            wamid,
            storage_name,
            original_name: original.slice(0, 255),
            mime: downloaded.mime,
            size: downloaded.size,
            at: new Date().toISOString(),
        });
        while (list.length > 50) list.shift();
        extra.pending_files = list;
    } catch (error) {
        console.error("WhatsApp pending media failed", wamid, error);
    }
    return extra;
};

/** Move pending_files from promote flow onto the new lead. */
export const promotePendingFilesToLead = async (agencyUuid: string, leadId: number, extra: any) => {
    const raw = parseJsonValue(extra);
    const pending: PendingStoredFile[] = Array.isArray(raw?.pending_files) ? raw.pending_files : [];
    for (const f of pending) {
        if (!f.wamid || !f.storage_name) continue;
        if (await leadFileExists(leadId, f.wamid)) continue;
        const row: any = await CrmLeadFile.create({
            agency_uuid: agencyUuid,
            lead_id: leadId,
            storage_name: f.storage_name,
            original_name: f.original_name,
            mime: f.mime,
            size: f.size,
            source: "whatsapp",
            wamid: f.wamid,
        });
        const url = signedFileUrl("lead_files", f.storage_name);
        const activity = await logActivity(leadId, agencyUuid, "whatsapp", `Received: ${f.original_name || "WhatsApp file"} (while in review inbox)`, null, {
            direction: "in",
            wamid: f.wamid,
            from_pending: true,
            file_uuid: row.dataValues.uuid,
            file_name: f.original_name,
            file_url: url,
        });
        await CrmLeadFile.update({ activity_id: activity.dataValues.id }, { where: { id: row.dataValues.id } });
    }
};