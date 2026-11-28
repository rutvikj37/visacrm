import axios from "axios";
import { leadRecipients, notifyLater } from "./notifications";
import crypto from "crypto";
import Jwt from "jsonwebtoken";
import { Op, Sequelize } from "sequelize";
import LeadIntegration from "../model/LeadIntegration";
import CrmLead from "../model/CrmLead";
import CrmLeadActivity from "../model/CrmLeadActivity";
import { decryptJson, encryptJson, generatePublicKey } from "../helpers/crypto";
import { parseJsonValue } from "../helpers/json";
import { ingestLead, logActivity, normalizePhone, LeadInput, LeadValidationError } from "./leadIngestion";
import { mapRecordToLeadInput } from "./leadImport";
import { metaConfiguredFrom, peekMetaConfig, refreshMetaConfig } from "./metaSettings";
import { autoCreateLeads, upsertPendingWhatsapp } from "./whatsappPending";
import { attachWhatsappMediaToLead, whatsappMediaPayload } from "./whatsappLeadMedia";

/**
 * Meta (Facebook / Instagram Lead Ads + WhatsApp Cloud API).
 *
 * One Meta app for the whole platform. Credentials from env and/or PlatformSetting key "meta"
 * (SaaS admin → Meta / Facebook). Agencies connect their own Pages / WhatsApp number.
 *
 *   META_APP_ID, META_APP_SECRET         - from developers.facebook.com (or admin UI)
 *   META_WEBHOOK_VERIFY_TOKEN            - any random string, also entered in the Meta app webhook settings
 *   META_LOGIN_CONFIG_ID (optional)      - Facebook Login for Business configuration id
 *   META_GRAPH_VERSION (optional)        - default v21.0
 *   META_GRAPH_BASE (optional)           - default https://graph.facebook.com (override only for tests)
 *   PUBLIC_API_URL                       - used for the OAuth redirect URL
 */

export class MetaError extends Error { }

const env = () => peekMetaConfig();

/** Ensure DB-backed Meta settings are loaded (call on Meta request paths). */
export const ensureMetaConfig = () => refreshMetaConfig();

export const metaConfigured = () => metaConfiguredFrom(env());

const graphUrl = (path: string) => `${env().graphBase}/${env().version}/${path.replace(/^\/+/, "")}`;

const graphError = (error: any) => {
    const fb = error?.response?.data?.error;
    const err = new MetaError(fb?.error_user_msg || fb?.message || error?.message || "Meta request failed");
    (err as any).code = fb?.code;
    (err as any).subcode = fb?.error_subcode;
    return err;
};

const graphGet = async (path: string, params: Record<string, any>) => {
    try {
        const { data } = await axios.get(path.startsWith("http") ? path : graphUrl(path), { params, timeout: 20000 });
        return data;
    } catch (error) {
        throw graphError(error);
    }
};

const graphPost = async (path: string, body: any, params: Record<string, any> = {}, headers: Record<string, string> = {}) => {
    try {
        const { data } = await axios.post(graphUrl(path), body, { params, headers, timeout: 20000 });
        return data;
    } catch (error) {
        throw graphError(error);
    }
};

// ---------------------------------------------------------------- webhooks

/** Check X-Hub-Signature-256 against the raw request body (platform app secret unless one is given). */
export const verifyWebhookSignature = (rawBody: Buffer | undefined, header: string | undefined, appSecret?: string | null) => {
    const secret = appSecret || env().appSecret;
    if (!secret || !rawBody || !header || !header.startsWith("sha256=")) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const given = header.slice("sha256=".length);
    if (given.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
};

export const webhookVerifyToken = () => env().verifyToken;

// ---------------------------------------------------------------- Facebook login

// instagram_*: DMs of the Instagram business account linked to a Page (needs Meta app review like leads_retrieval)
const OAUTH_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "leads_retrieval", "business_management", "instagram_basic", "instagram_manage_messages", "pages_messaging"];
const stateSecret = () => `${process.env.ACCESS_TOKEN_SECRET || ""}:meta-oauth`;

export const oauthRedirectUri = () => `${env().publicApi}/v1/public/meta/oauth/callback`;

/** URL that starts "Connect Facebook" for an agency. returnUrl = where to send the browser back. */
export const buildOAuthUrl = (agencyUuid: string, userId: number, returnUrl: string) => {
    const e = env();
    if (!metaConfigured().facebook) throw new MetaError("Facebook is not set up on this platform yet");
    const state = Jwt.sign({ a: agencyUuid, u: userId, r: returnUrl, n: crypto.randomBytes(8).toString("hex") }, stateSecret(), { expiresIn: "15m" });
    const params = new URLSearchParams({
        client_id: e.appId,
        redirect_uri: oauthRedirectUri(),
        state,
        response_type: "code",
    });
    if (e.configId) params.set("config_id", e.configId);
    else params.set("scope", OAUTH_SCOPES.join(","));
    return `https://www.facebook.com/${e.version}/dialog/oauth?${params.toString()}`;
};

export const readOAuthState = (state: string) => {
    try {
        const data: any = Jwt.verify(state, stateSecret());
        return { agencyUuid: String(data.a), userId: Number(data.u), returnUrl: String(data.r || "") };
    } catch {
        return null;
    }
};

/**
 * Finish "Connect Facebook": swap the code for a long-lived token, then subscribe every Page the
 * person granted to the leadgen webhook. Page tokens made from a long-lived user token do not expire.
 */
export const connectFacebookPages = async (agencyUuid: string, code: string) => {
    const e = env();
    const short = await graphGet("oauth/access_token", {
        client_id: e.appId, client_secret: e.appSecret, redirect_uri: oauthRedirectUri(), code,
    });
    const long = await graphGet("oauth/access_token", {
        grant_type: "fb_exchange_token", client_id: e.appId, client_secret: e.appSecret, fb_exchange_token: short.access_token,
    });
    const pagesResponse = await graphGet("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: 100, access_token: long.access_token });
    const pages: any[] = pagesResponse?.data || [];

    const connected: string[] = [];
    const connectedInstagram: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const page of pages) {
        if (!page?.id || !page?.access_token) continue;
        // a page can feed only one agency, otherwise we would not know where its leads belong
        const other: any = await LeadIntegration.findOne({
            where: { type: "facebook", external_id: String(page.id), status: "active", agency_uuid: { [Op.ne]: agencyUuid } },
            attributes: ["id"],
        });
        if (other) {
            skipped.push({ name: page.name, reason: "already connected to another agency" });
            continue;
        }
        const ig = page.instagram_business_account?.id ? page.instagram_business_account : null;
        let igSubscribed = false;
        try {
            // "messages" also brings Instagram DMs of the linked account (when the app has instagram_manage_messages)
            if (ig) {
                try {
                    await graphPost(`${page.id}/subscribed_apps`, null, { subscribed_fields: "leadgen,messages", access_token: page.access_token });
                    igSubscribed = true;
                } catch {
                    await graphPost(`${page.id}/subscribed_apps`, null, { subscribed_fields: "leadgen", access_token: page.access_token });
                }
            } else {
                await graphPost(`${page.id}/subscribed_apps`, null, { subscribed_fields: "leadgen", access_token: page.access_token });
            }
        } catch (error: any) {
            skipped.push({ name: page.name, reason: error.message });
            continue;
        }
        if (ig) await saveInstagramAccount(agencyUuid, page, ig, igSubscribed, connectedInstagram, skipped);
        const existing: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "facebook", external_id: String(page.id) } });
        const values = {
            name: page.name || `Page ${page.id}`,
            credentials: encryptJson({ page_access_token: page.access_token }),
            settings: { page_id: String(page.id), page_name: page.name || null },
            status: "active",
            last_error: null,
        };
        if (existing) await LeadIntegration.update(values, { where: { id: existing.dataValues.id } });
        else await LeadIntegration.create({ ...values, agency_uuid: agencyUuid, type: "facebook", external_id: String(page.id), public_key: generatePublicKey() });
        connected.push(page.name || String(page.id));
    }
    return { connected, instagram: connectedInstagram, skipped, total: pages.length };
};

/**
 * Connect one Facebook Page with a Page access token (no OAuth).
 * Useful when the agency already has a token, or for pull-sync before App Review.
 * Real-time webhooks still need the platform Meta app + Page subscribed to leadgen.
 */
export const connectFacebookPageToken = async (agencyUuid: string, pageIdRaw: string, pageAccessToken: string, pageNameHint?: string) => {
    const pageId = String(pageIdRaw || "").replace(/\D/g, "");
    const token = String(pageAccessToken || "").trim();
    if (!pageId) throw new MetaError("Please enter the Facebook Page ID");
    if (token.length < 20 || /\s/.test(token)) throw new MetaError("Please paste a valid Page access token");

    let info: any;
    try {
        info = await graphGet(pageId, { fields: "id,name,instagram_business_account{id,username}", access_token: token });
    } catch (error: any) {
        throw new MetaError(`Facebook said: ${error.message}`);
    }
    if (String(info?.id) !== pageId) throw new MetaError("That token does not match this Page ID");

    const other: any = await LeadIntegration.findOne({
        where: { type: "facebook", external_id: pageId, status: "active", agency_uuid: { [Op.ne]: agencyUuid } },
        attributes: ["id"],
    });
    if (other) throw new MetaError("This Facebook Page is already connected to another agency");

    const page = { id: pageId, name: info?.name || pageNameHint || `Page ${pageId}`, access_token: token, instagram_business_account: info?.instagram_business_account || null };
    const ig = page.instagram_business_account?.id ? page.instagram_business_account : null;
    let igSubscribed = false;
    let subscribeError: string | null = null;
    try {
        if (ig) {
            try {
                await graphPost(`${pageId}/subscribed_apps`, null, { subscribed_fields: "leadgen,messages", access_token: token });
                igSubscribed = true;
            } catch {
                await graphPost(`${pageId}/subscribed_apps`, null, { subscribed_fields: "leadgen", access_token: token });
            }
        } else {
            await graphPost(`${pageId}/subscribed_apps`, null, { subscribed_fields: "leadgen", access_token: token });
        }
    } catch (error: any) {
        // token may still work for manual "Fetch last 7 days" even if subscribe fails
        subscribeError = error.message || "Could not subscribe this Page to lead webhooks";
    }

    const connectedInstagram: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    if (ig) await saveInstagramAccount(agencyUuid, page, ig, igSubscribed, connectedInstagram, skipped);

    const existing: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "facebook", external_id: pageId } });
    const values = {
        name: page.name,
        credentials: encryptJson({ page_access_token: token }),
        settings: { page_id: pageId, page_name: page.name, connected_via: "page_token" },
        status: "active",
        last_error: subscribeError,
    };
    if (existing) await LeadIntegration.update(values, { where: { id: existing.dataValues.id } });
    else await LeadIntegration.create({ ...values, agency_uuid: agencyUuid, type: "facebook", external_id: pageId, public_key: generatePublicKey() });

    return {
        name: page.name,
        instagram: connectedInstagram,
        webhook_subscribed: !subscribeError,
        warning: subscribeError,
    };
};

// ---------------------------------------------------------------- Instagram DMs

/** Instagram business account linked to a connected Page -> its own lead source (type instagram). */
const saveInstagramAccount = async (agencyUuid: string, page: any, ig: any, subscribed: boolean, connected: string[], skipped: { name: string; reason: string }[]) => {
    const label = ig.username ? `@${ig.username}` : `Instagram ${ig.id}`;
    const other: any = await LeadIntegration.findOne({
        where: { type: "instagram", external_id: String(ig.id), status: "active", agency_uuid: { [Op.ne]: agencyUuid } }, attributes: ["id"],
    });
    if (other) {
        skipped.push({ name: label, reason: "already connected to another agency" });
        return;
    }
    const values = {
        name: label,
        credentials: encryptJson({ page_access_token: page.access_token }),
        settings: { page_id: String(page.id), page_name: page.name || null, username: ig.username || null, messages_subscribed: subscribed },
        status: "active",
        last_error: subscribed ? null : "Instagram messages could not be switched on - the app may still need instagram_manage_messages approval",
    };
    const existing: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "instagram", external_id: String(ig.id) } });
    if (existing) await LeadIntegration.update(values, { where: { id: existing.dataValues.id } });
    else await LeadIntegration.create({ ...values, agency_uuid: agencyUuid, type: "instagram", external_id: String(ig.id), public_key: generatePublicKey() });
    connected.push(label);
};

const describeIgMessage = (message: any): string => {
    if (message?.text) return String(message.text);
    const att = Array.isArray(message?.attachments) ? message.attachments[0] : null;
    if (att?.type === "story_mention") return "[mentioned you in their story]";
    if (att?.type) return `[${att.type}]`;
    if (message?.reply_to?.story) return "[replied to your story]";
    return "[message]";
};

const igAlreadyLogged = async (leadId: number, mid?: string | null) => {
    if (!mid) return false;
    // escape LIKE wildcards (ids can contain "_"); quotes can not appear in the JSON value we match
    const safe = String(mid).replace(/"/g, "").replace(/[\\%_]/g, "\\$&");
    const found = await CrmLeadActivity.findOne({
        where: { lead_id: leadId, type: "instagram", [Op.and]: [Sequelize.where(Sequelize.cast(Sequelize.col("meta"), "CHAR"), { [Op.like]: `%"mid":"${safe}"%` })] },
        attributes: ["id"],
    });
    return Boolean(found);
};

/**
 * Webhook object "instagram": entry.id = our Instagram account, messaging[] = DMs.
 * New person -> new lead (known only by Instagram id until they share a phone / email); known person -> timeline.
 */
export const handleInstagramEntry = async (entry: any) => {
    const igId = entry?.id ? String(entry.id) : null;
    if (!igId || !Array.isArray(entry?.messaging)) return;
    const integration: any = await LeadIntegration.findOne({ where: { type: "instagram", external_id: igId, status: "active" } });
    if (!integration) return;
    const agencyUuid = integration.dataValues.agency_uuid;
    const token = pageToken(integration);

    for (const event of entry.messaging) {
        const message = event?.message;
        const senderId = event?.sender?.id ? String(event.sender.id) : null;
        if (!message || message.is_echo || !senderId || senderId === igId) continue;
        const text = describeIgMessage(message).slice(0, 4000);

        const existing: any = await CrmLead.findOne({ where: { agency_uuid: agencyUuid, source: "instagram", source_ref: senderId }, order: [["id", "DESC"]] });
        if (existing) {
            if (await igAlreadyLogged(existing.dataValues.id, message.mid)) continue;
            await logActivity(existing.dataValues.id, agencyUuid, "instagram", `Received: ${text}`, null, { direction: "in", mid: message.mid || null });
            await CrmLead.update({ last_activity_at: new Date() }, { where: { id: existing.dataValues.id } });
            notifyLater({
                agencyUuid, recipientIds: await leadRecipients(agencyUuid, existing.dataValues.assigned_to), type: "whatsapp_message",
                title: `Instagram message from ${existing.dataValues.name || "a lead"}`, body: text.slice(0, 200),
                link: `/crm/leads/${existing.dataValues.uuid}`,
                dedupeKey: `ig:${existing.dataValues.id}:${new Date().toISOString().slice(0, 13)}`,
            });
            continue;
        }
        let profile: any = null;
        if (token) {
            try { profile = await graphGet(senderId, { fields: "name,username", access_token: token }); } catch { profile = null; }
        }
        // a phone number or email in the first message makes the lead reachable outside Instagram
        const phoneMatch = text.match(/(\+?\d[\d\s-]{8,14}\d)/);
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
        try {
            const result = await ingestLead({
                agencyUuid, source: "instagram", integrationId: integration.dataValues.id, allowNoContact: true,
                input: {
                    name: profile?.name || (profile?.username ? `@${profile.username}` : null),
                    phone: phoneMatch ? phoneMatch[1] : null,
                    email: emailMatch ? emailMatch[0] : null,
                    message: text,
                    campaign: integration.dataValues.name,
                    source_ref: senderId,
                    extra: { instagram_username: profile?.username || null, instagram_account: integration.dataValues.name },
                },
            });
            await logActivity(result.lead.dataValues.id, agencyUuid, "instagram", `Received: ${text}`, null, { direction: "in", mid: message.mid || null });
        } catch (error) {
            if (!(error instanceof LeadValidationError)) console.error("Instagram inbound failed", error);
        }
    }
};

/** Reply to an Instagram lead from the CRM (Instagram allows replies within 24 hours of their last message). */
export const sendInstagramText = async (agencyUuid: string, lead: any, body: string) => {
    const l = lead.dataValues || lead;
    if (l.source !== "instagram" || !l.source_ref) throw new MetaError("This lead did not come from Instagram");
    const integration: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "instagram", status: "active", ...(l.integration_id ? { id: l.integration_id } : {}) } });
    if (!integration) throw new MetaError("Connect your Instagram account (via Facebook) in Lead Sources first");
    const token = pageToken(integration);
    if (!token) throw new MetaError("Instagram connection is incomplete - please reconnect Facebook");
    try {
        const result = await graphPost("me/messages", { recipient: { id: l.source_ref }, message: { text: body } }, { access_token: token });
        return { message_id: result?.message_id || null };
    } catch (error: any) {
        if (error.code === 10 || /outside of allowed window/i.test(error.message || "")) {
            throw new MetaError("Instagram only allows replies within 24 hours of the person's last message. Reply from the Instagram app instead.");
        }
        throw error;
    }
};

// ---------------------------------------------------------------- Lead Ads

const LEAD_FIELDS = "id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform,is_organic";

/** Map a Lead Ads lead (field_data) to our fields, including custom questions like "which_country...". */
export const mapFacebookLead = (lead: any): LeadInput => {
    const flat: Record<string, string> = {};
    for (const field of lead?.field_data || []) {
        if (!field?.name) continue;
        flat[field.name] = (field.values || []).join(", ");
    }
    const input = mapRecordToLeadInput(flat);
    // custom questions: guess by words in the question key
    const extra: Record<string, any> = { ...(input.extra || {}) };
    for (const [key, value] of Object.entries(extra)) {
        const k = key.toLowerCase();
        if (!input.interested_country && /(country|destination)/.test(k)) { input.interested_country = String(value); delete extra[key]; }
        else if (!input.interested_course && /(course|program|study|degree)/.test(k)) { input.interested_course = String(value); delete extra[key]; }
        else if (!input.intake && /(intake|when|start)/.test(k)) { input.intake = String(value); delete extra[key]; }
        else if (!input.visa_type && /visa/.test(k)) { input.visa_type = String(value); delete extra[key]; }
        else if (!input.city && /(city|location)/.test(k)) { input.city = String(value); delete extra[key]; }
    }
    input.extra = {
        ...extra,
        platform: lead?.platform === "ig" ? "Instagram" : lead?.platform === "fb" ? "Facebook" : lead?.platform || null,
        ad_name: lead?.ad_name || null,
        adset_name: lead?.adset_name || null,
        form_id: lead?.form_id || null,
        organic: lead?.is_organic ?? null,
    };
    input.campaign = lead?.campaign_name || lead?.ad_name || input.campaign || null;
    input.source_ref = lead?.id ? String(lead.id) : null;
    return input;
};

const pageToken = (integration: any) => decryptJson<{ page_access_token: string }>(integration.dataValues.credentials)?.page_access_token || null;

const markError = (integration: any, message: string) =>
    LeadIntegration.update({ last_error: message.slice(0, 1000) }, { where: { id: integration.dataValues.id } });

const importFacebookLead = async (integration: any, lead: any) =>
    ingestLead({
        agencyUuid: integration.dataValues.agency_uuid,
        source: "facebook",
        input: mapFacebookLead(lead),
        integrationId: integration.dataValues.id,
    });

/** Webhook "leadgen" change -> fetch the lead with the page token -> CRM. */
export const handleLeadgenChange = async (value: any) => {
    const pageId = value?.page_id ? String(value.page_id) : null;
    const leadgenId = value?.leadgen_id ? String(value.leadgen_id) : null;
    if (!pageId || !leadgenId) return;
    const integration: any = await LeadIntegration.findOne({ where: { type: "facebook", external_id: pageId, status: "active" } });
    if (!integration) return;
    const token = pageToken(integration);
    if (!token) return markError(integration, "Page token missing - please reconnect Facebook");
    try {
        const lead = await graphGet(leadgenId, { fields: LEAD_FIELDS, access_token: token });
        await importFacebookLead(integration, lead);
        await LeadIntegration.update({ last_error: null }, { where: { id: integration.dataValues.id } });
    } catch (error: any) {
        if (error instanceof LeadValidationError) return;
        await markError(integration, error.message || "Could not fetch the lead from Facebook");
    }
};

/** Pull recent leads of every form on the page (catches anything a webhook missed). */
export const syncFacebookPage = async (integration: any, days = 7) => {
    const token = pageToken(integration);
    if (!token) throw new MetaError("Page token missing - please reconnect Facebook");
    const pageId = integration.dataValues.external_id;
    const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    let created = 0, duplicates = 0, failed = 0;
    try {
        const forms = await graphGet(`${pageId}/leadgen_forms`, { fields: "id,name,status", limit: 100, access_token: token });
        for (const form of forms?.data || []) {
            let next: string | null = null;
            let page = 0;
            do {
                const result: any = next
                    ? await graphGet(next, {})
                    : await graphGet(`${form.id}/leads`, {
                        fields: LEAD_FIELDS,
                        limit: 100,
                        filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
                        access_token: token,
                    });
                for (const lead of result?.data || []) {
                    try {
                        const r = await importFacebookLead(integration, { ...lead, campaign_name: lead.campaign_name || form.name });
                        if (r.created) created++; else duplicates++;
                    } catch {
                        failed++;
                    }
                }
                next = result?.paging?.next || null;
                page++;
            } while (next && page < 20);
        }
        await LeadIntegration.update({ last_synced_at: new Date(), last_error: null }, { where: { id: integration.dataValues.id } });
        return { created, duplicates, failed };
    } catch (error: any) {
        await markError(integration, error.message || "Facebook sync failed");
        throw error;
    }
};

// ---------------------------------------------------------------- WhatsApp Cloud API

export const waCredentials = (integration: any) =>
    decryptJson<{ access_token: string; phone_number_id: string; waba_id?: string; app_secret?: string; verify_token?: string }>(integration.dataValues.credentials);

/**
 * Check the agency's WhatsApp credentials (phone must work with the token).
 * Also try to subscribe our app to their WABA for webhooks. Subscription is best-effort:
 * if the system user token cannot manage that WABA (not assigned / wrong id), we still
 * return phone info so Connect can save credentials; the caller gets a warning to fix Meta.
 */
export const verifyWhatsapp = async (accessToken: string, phoneNumberId: string, wabaId?: string) => {
    const info = await graphGet(phoneNumberId, {
        fields: "display_phone_number,verified_name,quality_rating",
        access_token: accessToken,
    });
    let subscription_warning: string | null = null;
    if (wabaId) {
        try {
            await graphPost(`${wabaId}/subscribed_apps`, null, {}, { Authorization: `Bearer ${accessToken}` });
        } catch (error: any) {
            const raw = String(error?.message || "");
            const looksLikeAccess =
                /does not exist|missing permissions|does not support this operation|Unsupported post request|#100|#200|#10/i.test(raw);
            subscription_warning = looksLikeAccess
                ? `Number verified, but webhook subscribe failed for WhatsApp Business Account ${wabaId}. In Meta Business Settings → Users → System users, open the system user for this token → Assign assets → add this WhatsApp account (Manage). Confirm the WhatsApp Business Account ID from WhatsApp → API Setup, then reconnect. Until then, set the webhook URL shown after connect and subscribe to messages in Meta.`
                : `Number verified, but webhook subscribe failed: ${raw}. Set the webhook URL shown after connect in Meta (WhatsApp → Configuration) and subscribe to messages, or fix WABA access and reconnect.`;
        }
    }
    return {
        display_phone_number: info?.display_phone_number || null,
        verified_name: info?.verified_name || null,
        quality_rating: info?.quality_rating || null,
        subscription_warning,
    };
};

const describeMessage = (message: any): string => {
    switch (message?.type) {
        case "text": return message.text?.body || "";
        case "button": return message.button?.text || "[button]";
        case "interactive":
            return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "[interactive reply]";
        case "image": {
            const cap = message.image?.caption;
            return cap ? `Photo: ${cap}` : "Photo";
        }
        case "document": {
            const name = message.document?.filename;
            const cap = message.document?.caption;
            if (name && cap) return `Document: ${name} — ${cap}`;
            if (name) return `Document: ${name}`;
            return "Document";
        }
        case "video": return message.video?.caption ? `Video: ${message.video.caption}` : "Video";
        case "audio": return "Voice message";
        case "sticker": return "Sticker";
        case "location": return "Location";
        case "contacts": return "Contact card";
        case "unsupported": return "Unsupported message type";
        default: return message?.type ? `WhatsApp: ${message.type}` : "Message";
    }
};

// Meta retries webhooks (and our server runs several workers), so check the database for the message id
const alreadyLogged = async (leadId: number, wamid?: string | null) => {
    if (!wamid) return false;
    // escape LIKE wildcards (ids can contain "_"); quotes can not appear in the JSON value we match
    const safe = String(wamid).replace(/"/g, "").replace(/[\\%_]/g, "\\$&");
    const found = await CrmLeadActivity.findOne({
        where: {
            lead_id: leadId,
            type: "whatsapp",
            [Op.and]: [Sequelize.where(Sequelize.cast(Sequelize.col("meta"), "CHAR"), { [Op.like]: `%"wamid":"${safe}"%` })],
        },
        attributes: ["id"],
    });
    return Boolean(found);
};

/** Webhook "messages" change: known number -> timeline; new number -> lead (or pending inbox if review-first). */
export const handleWhatsappChange = async (value: any, onlyIntegration: any = null) => {
    const phoneNumberId = value?.metadata?.phone_number_id ? String(value.metadata.phone_number_id) : null;
    if (!phoneNumberId || !Array.isArray(value?.messages)) return;
    // on an agency's own webhook link, only accept events for that agency's number
    if (onlyIntegration && String(onlyIntegration.dataValues.external_id) !== phoneNumberId) return;
    const integration: any = onlyIntegration && onlyIntegration.dataValues.status === "active"
        ? onlyIntegration
        : await LeadIntegration.findOne({ where: { type: "whatsapp", external_id: phoneNumberId, status: "active" } });
    if (!integration) return;
    const agencyUuid = integration.dataValues.agency_uuid;
    const createLeads = autoCreateLeads(integration);

    for (const message of value.messages) {
        if (!message?.from) continue;
        const contact = (value.contacts || []).find((c: any) => c?.wa_id === message.from) || value.contacts?.[0];
        const text = describeMessage(message).slice(0, 4000);
        const phone = normalizePhone(`+${String(message.from).replace(/\D/g, "")}`);
        if (!phone) continue;

        const existing: any = await CrmLead.findOne({ where: { agency_uuid: agencyUuid, phone_normalized: phone.normalized } });
        if (existing) {
            if (await alreadyLogged(existing.dataValues.id, message.id)) continue;
            const hasMedia = Boolean(whatsappMediaPayload(message));
            if (hasMedia) {
                const saved = await attachWhatsappMediaToLead({
                    agencyUuid,
                    leadId: existing.dataValues.id,
                    integration,
                    message,
                    wamid: message.id || null,
                });
                if (!saved) {
                    await logActivity(existing.dataValues.id, agencyUuid, "whatsapp", `Received: ${text}`, null, { direction: "in", wamid: message.id || null });
                }
            } else {
                await logActivity(existing.dataValues.id, agencyUuid, "whatsapp", `Received: ${text}`, null, { direction: "in", wamid: message.id || null });
            }
            notifyLater({
                agencyUuid, recipientIds: await leadRecipients(agencyUuid, existing.dataValues.assigned_to), type: hasMedia ? "document_uploaded" : "whatsapp_message",
                title: hasMedia ? `WhatsApp file from ${existing.dataValues.name || phone.phone_number}` : `WhatsApp from ${existing.dataValues.name || phone.phone_number}`,
                body: text.slice(0, 200),
                link: `/crm/leads/${existing.dataValues.uuid}`,
                // at most one alert per lead per hour
                dedupeKey: `wa:${existing.dataValues.id}:${new Date().toISOString().slice(0, 13)}`,
            });
            continue;
        }
        const referral = message.referral || null; // click-to-WhatsApp ad
        const campaign = referral?.headline || null;
        const extra = referral ? { ad_source: referral.source_type || null, ad_id: referral.source_id || null, ad_url: referral.source_url || null } : null;

        // Review-first: park in pending inbox until staff taps "Add as lead"
        if (!createLeads) {
            try {
                const pending: any = await upsertPendingWhatsapp({
                    agencyUuid,
                    integrationId: integration.dataValues.id,
                    integration,
                    phoneNormalized: phone.normalized,
                    profileName: contact?.profile?.name || null,
                    text,
                    wamid: message.id || null,
                    campaign,
                    extra,
                    message,
                });
                if (pending) {
                    notifyLater({
                        agencyUuid, recipientIds: await leadRecipients(agencyUuid, null), type: "whatsapp_message",
                        title: `WhatsApp to review: ${contact?.profile?.name || phone.phone_number}`, body: text.slice(0, 200),
                        link: `/crm/inbox?pending=${pending.dataValues?.uuid || pending.uuid}`,
                        dedupeKey: `wa-pending:${pending.dataValues?.id || pending.id}:${new Date().toISOString().slice(0, 13)}`,
                    });
                }
            } catch (error) {
                console.error("WhatsApp pending inbox failed", error);
            }
            continue;
        }

        try {
            const result = await ingestLead({
                agencyUuid,
                source: "whatsapp",
                integrationId: integration.dataValues.id,
                input: {
                    name: contact?.profile?.name || null,
                    phone: `+${phone.normalized}`,
                    message: text,
                    campaign,
                    extra,
                },
            });
            if (whatsappMediaPayload(message)) {
                const saved = await attachWhatsappMediaToLead({
                    agencyUuid,
                    leadId: result.lead.dataValues.id,
                    integration,
                    message,
                    wamid: message.id || null,
                });
                if (!saved) {
                    await logActivity(result.lead.dataValues.id, agencyUuid, "whatsapp", `Received: ${text}`, null, { direction: "in", wamid: message.id || null });
                }
            } else {
                await logActivity(result.lead.dataValues.id, agencyUuid, "whatsapp", `Received: ${text}`, null, { direction: "in", wamid: message.id || null });
            }
        } catch (error) {
            if (!(error instanceof LeadValidationError)) console.error("WhatsApp inbound failed", error);
        }
    }
};

/** Send a WhatsApp text from the CRM (works inside the 24-hour customer service window). */
export const sendWhatsappText = async (agencyUuid: string, lead: any, body: string) => {
    // reply from the number the client wrote to (agencies can connect more than one), else the first one
    const ownId = lead?.dataValues?.integration_id;
    const integration: any = (ownId && await LeadIntegration.findOne({ where: { id: ownId, agency_uuid: agencyUuid, type: "whatsapp", status: "active" } }))
        || await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "whatsapp", status: "active" }, order: [["id", "ASC"]] });
    if (!integration) throw new MetaError("Connect your WhatsApp Business number in Lead Sources first");
    const credentials = waCredentials(integration);
    if (!credentials?.access_token || !credentials?.phone_number_id) throw new MetaError("WhatsApp connection is incomplete - please reconnect");
    const to = String(lead.dataValues.phone_normalized || "").replace(/\D/g, "");
    if (!to) throw new MetaError("This lead has no phone number");
    try {
        const result = await graphPost(
            `${credentials.phone_number_id}/messages`,
            { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body } },
            {},
            { Authorization: `Bearer ${credentials.access_token}` },
        );
        return { message_id: result?.messages?.[0]?.id || null };
    } catch (error: any) {
        if (error.code === 131047) {
            throw new MetaError("The student has not messaged you in the last 24 hours. WhatsApp only allows free text inside that window - send from the WhatsApp app or use an approved template.");
        }
        throw error;
    }
};

export const integrationSettings = (integration: any) => parseJsonValue(integration?.dataValues?.settings) || {};

/**
 * Send an approved WhatsApp template message (works outside the 24-hour window).
 * `params` fill the template body's {{1}}, {{2}} ... in order.
 */
export const sendWhatsappTemplate = async (agencyUuid: string, toDigits: string, templateName: string, language: string, params: string[]) => {
    const integration: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "whatsapp", status: "active" } });
    if (!integration) throw new MetaError("WhatsApp is not connected");
    const credentials = waCredentials(integration);
    if (!credentials?.access_token || !credentials?.phone_number_id) throw new MetaError("WhatsApp connection is incomplete");
    const to = String(toDigits || "").replace(/\D/g, "");
    if (!to) throw new MetaError("No phone number");
    const result = await graphPost(
        `${credentials.phone_number_id}/messages`,
        {
            messaging_product: "whatsapp", to, type: "template",
            template: {
                name: templateName, language: { code: language || "en" },
                ...(params.length && { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text || "-").slice(0, 1000) })) }] }),
            },
        },
        {},
        { Authorization: `Bearer ${credentials.access_token}` },
    );
    return { message_id: result?.messages?.[0]?.id || null };
};
