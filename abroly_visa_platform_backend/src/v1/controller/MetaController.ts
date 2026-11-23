import { Request, Response } from "express";
import { leadScope } from "../../helpers/access";
import { assertSourceAllowed } from "../../services/saas";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import LeadIntegration from "../../model/LeadIntegration";
import CrmLead from "../../model/CrmLead";
import { decryptJson, encryptJson, generatePublicKey } from "../../helpers/crypto";
import { logActivity } from "../../services/leadIngestion";
import {
    MetaError, buildOAuthUrl, connectFacebookPages, connectFacebookPageToken, ensureMetaConfig, handleLeadgenChange, handleWhatsappChange, metaConfigured,
    readOAuthState, sendWhatsappText, sendInstagramText, handleInstagramEntry, verifyWebhookSignature, verifyWhatsapp, waCredentials, webhookVerifyToken,
} from "../../services/meta";

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, userId: Number(user.id), isOwner: user.role === "agent" };
};

/** Only send the browser back to an http(s) URL; append our result as query params. */
const backTo = (returnUrl: string, params: Record<string, string>) => {
    try {
        const url = new URL(returnUrl);
        if (!["http:", "https:"].includes(url.protocol)) return null;
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        return url.toString();
    } catch {
        return null;
    }
};

const simplePage = (res: Response, title: string, text: string) =>
    res.status(200).type("html").send(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<div style="font-family:sans-serif;max-width:480px;margin:15vh auto;text-align:center;padding:16px"><h2>${title}</h2><p>${text}</p></div>`,
    );

const findWhatsappByKey = (key: string) =>
    /^[a-f0-9]{20,64}$/.test(key) ? LeadIntegration.findOne({ where: { public_key: key, type: "whatsapp" } }) : Promise.resolve(null);

class MetaController {
    // ------------------------------------------------ public

    // GET /public/meta/webhook  - Meta checks the URL when you save it in the app dashboard
    async webhookVerify(req: Request, res: Response) {
        await ensureMetaConfig();
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];
        if (mode === "subscribe" && token && token === webhookVerifyToken()) {
            return res.status(200).send(String(challenge || ""));
        }
        return res.sendStatus(403);
    }

    // POST /public/meta/webhook  - leadgen (Pages) and messages (WhatsApp)
    async webhookReceive(req: Request, res: Response) {
        await ensureMetaConfig();
        if (!verifyWebhookSignature((req as any).rawBody, req.get("x-hub-signature-256"))) {
            return res.sendStatus(401);
        }
        const body = req.body || {};
        try {
            for (const entry of body.entry || []) {
                // Instagram DMs arrive as entry.messaging (not changes)
                if (body.object === "instagram" && Array.isArray(entry.messaging)) {
                    await handleInstagramEntry(entry);
                    continue;
                }
                for (const change of entry.changes || []) {
                    if (body.object === "page" && change.field === "leadgen") {
                        await handleLeadgenChange(change.value);
                    } else if (body.object === "whatsapp_business_account" && change.field === "messages") {
                        await handleWhatsappChange(change.value);
                    }
                }
            }
        } catch (error) {
            console.error("Meta webhook processing failed", error);
        }
        // always 200 once the signature is valid, otherwise Meta keeps retrying and may disable the webhook
        return res.sendStatus(200);
    }

    // GET /public/meta/whatsapp/:key  - verification for an agency's own WhatsApp webhook link
    async whatsappWebhookVerify(req: Request, res: Response) {
        const integration: any = await findWhatsappByKey(String(req.params.key || ""));
        const token = integration ? waCredentials(integration)?.verify_token : null;
        if (integration && token && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === token) {
            return res.status(200).send(String(req.query["hub.challenge"] || ""));
        }
        return res.sendStatus(403);
    }

    // POST /public/meta/whatsapp/:key  - messages for one agency's number, signed with that agency's app secret
    async whatsappWebhookReceive(req: Request, res: Response) {
        const integration: any = await findWhatsappByKey(String(req.params.key || ""));
        if (!integration) return res.sendStatus(404);
        const appSecret = waCredentials(integration)?.app_secret || null;
        if (!verifyWebhookSignature((req as any).rawBody, req.get("x-hub-signature-256"), appSecret)) return res.sendStatus(401);
        try {
            for (const entry of req.body?.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field === "messages") await handleWhatsappChange(change.value, integration);
                }
            }
        } catch (error) {
            console.error("WhatsApp webhook processing failed", error);
        }
        return res.sendStatus(200);
    }

    // GET /public/meta/oauth/callback?code&state  - Facebook sends the browser here after "Connect"
    async oauthCallback(req: Request, res: Response) {
        await ensureMetaConfig();
        const state = readOAuthState(String(req.query.state || ""));
        if (!state) return simplePage(res, "Link expired", "Please go back to Lead Sources and click Connect Facebook again.");
        const finish = (params: Record<string, string>) => {
            const url = state.returnUrl ? backTo(state.returnUrl, params) : null;
            return url ? res.redirect(303, url) : simplePage(res, params.meta === "connected" ? "Connected" : "Not connected", params.meta_message || "You can close this window.");
        };
        if (req.query.error || !req.query.code) {
            return finish({ meta: "cancelled", meta_message: String(req.query.error_description || "Facebook connection was cancelled") });
        }
        try {
            const result = await connectFacebookPages(state.agencyUuid, String(req.query.code));
            if (!result.connected.length) {
                const why = result.skipped.length ? result.skipped.map((s) => `${s.name}: ${s.reason}`).join("; ") : "No Facebook Pages were selected";
                return finish({ meta: "failed", meta_message: why.slice(0, 300) });
            }
            return finish({
                meta: "connected",
                meta_message: `Connected: ${result.connected.join(", ")}${result.instagram?.length ? `. Instagram: ${result.instagram.join(", ")}` : ""}${result.skipped.length ? `. Skipped: ${result.skipped.map((s) => s.name).join(", ")}` : ""}`.slice(0, 300),
            });
        } catch (error: any) {
            console.error("Facebook connect failed", error?.message);
            return finish({ meta: "failed", meta_message: String(error?.message || "Facebook connection failed").slice(0, 300) });
        }
    }

    // ------------------------------------------------ agency

    // GET /crm/meta/status
    async status(req: RequestWithUser, res: Response) {
        await ensureMetaConfig();
        return returnHelper(res, 200, true, "Meta status", metaConfigured());
    }

    // POST /crm/meta/facebook/connect_url { return_url }
    async facebookConnectUrl(req: RequestWithUser, res: Response) {
        try {
            await ensureMetaConfig();
            const { agencyUuid, userId, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can connect Facebook");
            try { await assertSourceAllowed(ctx(req).agencyUuid, "facebook"); } catch (e: any) { return returnHelper(res, 200, false, e.message); }

            const returnUrl = String(req.body?.return_url || req.get("origin") || "");
            if (!backTo(returnUrl, {})) return returnHelper(res, 200, false, "Invalid return address");
            return returnHelper(res, 200, true, "Redirecting to Facebook", { url: buildOAuthUrl(agencyUuid, userId, returnUrl) });
        } catch (error: any) {
            if (error instanceof MetaError) return returnHelper(res, 200, false, error.message);
            console.error("facebook connect url failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/meta/facebook/page { page_id, page_access_token, page_name? }
    async saveFacebookPage(req: RequestWithUser, res: Response) {
        try {
            await ensureMetaConfig();
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can connect Facebook");
            try { await assertSourceAllowed(agencyUuid, "facebook"); } catch (e: any) { return returnHelper(res, 200, false, e.message); }

            const result = await connectFacebookPageToken(
                agencyUuid,
                String(req.body?.page_id || ""),
                String(req.body?.page_access_token || ""),
                req.body?.page_name ? String(req.body.page_name) : undefined,
            );
            const msg = result.webhook_subscribed
                ? `Connected ${result.name}${result.instagram?.length ? ` (+ Instagram ${result.instagram.join(", ")})` : ""}`
                : `Connected ${result.name} for sync. Real-time webhooks: ${result.warning || "not subscribed yet"}`;
            return returnHelper(res, 200, true, msg, result);
        } catch (error: any) {
            if (error instanceof MetaError) return returnHelper(res, 200, false, error.message);
            console.error("save facebook page failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/meta/whatsapp { access_token, phone_number_id, waba_id }
    async saveWhatsapp(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can connect WhatsApp");
            try { await assertSourceAllowed(ctx(req).agencyUuid, "whatsapp"); } catch (e: any) { return returnHelper(res, 200, false, e.message); }

            const accessToken = String(req.body?.access_token || "").trim();
            const phoneNumberId = String(req.body?.phone_number_id || "").replace(/\D/g, "");
            const wabaId = String(req.body?.waba_id || "").replace(/\D/g, "");
            const appSecretInput = String(req.body?.app_secret || "").trim();
            if (appSecretInput && !/^[a-f0-9]{16,64}$/i.test(appSecretInput)) return returnHelper(res, 200, false, "The App secret looks wrong - copy it from your Meta app: App settings > Basic");
            if (accessToken.length < 20 || /\s/.test(accessToken)) return returnHelper(res, 200, false, "Please paste a valid permanent access token");
            if (!phoneNumberId) return returnHelper(res, 200, false, "Please enter the Phone number ID");
            if (!wabaId) return returnHelper(res, 200, false, "Please enter the WhatsApp Business Account ID");

            const other = await LeadIntegration.findOne({
                where: { type: "whatsapp", external_id: phoneNumberId, status: "active" },
                attributes: ["agency_uuid"],
            }) as any;
            if (other && other.dataValues.agency_uuid !== agencyUuid) {
                return returnHelper(res, 200, false, "This WhatsApp number is already connected to another account");
            }

            let info;
            try {
                info = await verifyWhatsapp(accessToken, phoneNumberId, wabaId);
            } catch (error: any) {
                return returnHelper(res, 200, false, `WhatsApp said: ${error.message}`);
            }

            const values: any = {
                name: info.verified_name ? `${info.verified_name} (${info.display_phone_number})` : info.display_phone_number || "WhatsApp",
                external_id: phoneNumberId,
                credentials: encryptJson({ access_token: accessToken, phone_number_id: phoneNumberId, waba_id: wabaId }),
                settings: { ...info, phone_number_id: phoneNumberId, waba_id: wabaId },
                status: "active",
                last_error: null,
            };
            // "add another number": a second (third...) WhatsApp number; otherwise update the first one
            const existing: any = req.body?.add_number
                ? await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "whatsapp", external_id: phoneNumberId } })
                : await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "whatsapp" }, order: [["id", "ASC"]] });
            const previous = existing ? (decryptJson<any>(existing.dataValues.credentials) || {}) : {};
            values.credentials = encryptJson({
                access_token: accessToken,
                phone_number_id: phoneNumberId,
                waba_id: wabaId,
                // keep the saved secret when the field is left empty on an update
                app_secret: appSecretInput || previous.app_secret || null,
                verify_token: previous.verify_token || generatePublicKey().slice(0, 24),
            });
            if (existing) await LeadIntegration.update(values, { where: { id: existing.dataValues.id } });
            else await LeadIntegration.create({ ...values, agency_uuid: agencyUuid, type: "whatsapp", public_key: generatePublicKey() });
            return returnHelper(res, 200, true, `WhatsApp connected: ${info.display_phone_number || phoneNumberId}`);
        } catch (error) {
            console.error("save whatsapp failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/leads/:uuid/whatsapp { message }
    async sendWhatsapp(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            const message = String(req.body?.message || "").trim();
            if (!message) return returnHelper(res, 200, false, "Please write a message");
            if (message.length > 4000) return returnHelper(res, 200, false, "Message is too long (max 4000 characters)");
            const where: any = { ...leadScope(req), uuid: req.params.uuid };
            const lead: any = await CrmLead.findOne({ where });
            if (!lead) return returnHelper(res, 200, false, "Lead not found");

            const sent = await sendWhatsappText(agencyUuid, lead, message);
            await logActivity(lead.dataValues.id, agencyUuid, "whatsapp", `Sent: ${message}`, userId, { direction: "out", wamid: sent.message_id });
            if (lead.dataValues.status === "new") {
                await CrmLead.update({ status: "contacted" }, { where: { id: lead.dataValues.id } });
                await logActivity(lead.dataValues.id, agencyUuid, "status_change", "Status changed from New to Contacted", userId, { from: "new", to: "contacted" });
            }
            return returnHelper(res, 200, true, "WhatsApp message sent");
        } catch (error: any) {
            if (error instanceof MetaError) return returnHelper(res, 200, false, error.message);
            console.error("send whatsapp failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/leads/:uuid/instagram { message }  - reply to an Instagram DM lead
    async sendInstagram(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const message = String(req.body?.message || "").trim();
            if (!message) return returnHelper(res, 200, false, "Please write a message");
            if (message.length > 1000) return returnHelper(res, 200, false, "Instagram messages can be up to 1000 characters");
            const lead: any = await CrmLead.findOne({ where: { ...leadScope(req), uuid: req.params.uuid } });
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            const sent = await sendInstagramText(agencyUuid, lead, message);
            await logActivity(lead.dataValues.id, agencyUuid, "instagram", `Sent: ${message}`, userId, { direction: "out", mid: sent.message_id });
            if (lead.dataValues.status === "new") {
                await CrmLead.update({ status: "contacted" }, { where: { id: lead.dataValues.id } });
                await logActivity(lead.dataValues.id, agencyUuid, "status_change", "Status changed from New to Contacted", userId, { from: "new", to: "contacted" });
            }
            return returnHelper(res, 200, true, "Instagram message sent");
        } catch (error: any) {
            if (error instanceof MetaError) return returnHelper(res, 200, false, error.message);
            console.error("send instagram failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new MetaController();
