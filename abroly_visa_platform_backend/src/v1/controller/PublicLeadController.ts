import { Request, Response } from "express";
import LeadIntegration from "../../model/LeadIntegration";
import { ingestLead, LeadValidationError } from "../../services/leadIngestion";
import { mapRecordToLeadInput } from "../../services/leadImport";
import { importIndiamartRecords } from "../../services/indiamart";
import { decryptJson } from "../../helpers/crypto";
import { mapGoogleLead, mapJustdialLead, mapSulekhaLead, sameKey } from "../../services/leadPush";

/**
 * Public (no login) endpoints that receive leads from outside:
 *   POST /api/v1/public/leads/website/:key    - agency's website form / landing page / Zapier / Pabbly
 *   POST /api/v1/public/leads/indiamart/:key  - IndiaMART push API
 *   POST /api/v1/public/leads/google/:key     - Google Ads lead form webhook (checks google_key)
 *   GET|POST /api/v1/public/leads/justdial/:key - Justdial lead push
 *   GET|POST /api/v1/public/leads/sulekha/:key  - Sulekha lead push
 *
 * The :key is a random per-integration key, so the URL never exposes which agency it belongs to.
 */

// --- very small in-memory rate limit (per worker): 30 requests / minute per key + IP ---
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

const rateLimited = (bucket: string): boolean => {
    const now = Date.now();
    const entry = hits.get(bucket);
    if (!entry || entry.resetAt < now) {
        hits.set(bucket, { count: 1, resetAt: now + WINDOW_MS });
        if (hits.size > 10000) {
            for (const [key, value] of hits) if (value.resetAt < now) hits.delete(key);
        }
        return false;
    }
    entry.count++;
    return entry.count > MAX_PER_WINDOW;
};

const clientIp = (req: Request) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

const isFormPost = (req: Request) => (req.headers["content-type"] || "").includes("application/x-www-form-urlencoded")
    || (req.headers["content-type"] || "").includes("multipart/form-data");

const safeRedirect = (value: any): string | null => {
    if (!value || typeof value !== "string") return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch {
        return null;
    }
};

const findActive = async (key: string, type: "website" | "indiamart" | "google" | "justdial" | "sulekha") => {
    if (!key || !/^[a-f0-9]{20,64}$/.test(key)) return null;
    return LeadIntegration.findOne({ where: { public_key: key, type, status: "active" } });
};

class PublicLeadController {
    async website(req: Request, res: Response) {
        const redirectTo = safeRedirect(req.body?._redirect);
        const reply = (status: number, success: boolean, message: string) => {
            if (isFormPost(req) && redirectTo && success) return res.redirect(303, redirectTo);
            if (isFormPost(req) && !redirectTo) {
                return res.status(status).type("html").send(
                    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
                    `<div style="font-family:sans-serif;max-width:480px;margin:15vh auto;text-align:center;padding:16px">` +
                    `<h2>${success ? "Thank you!" : "Sorry"}</h2><p>${success ? "We have received your enquiry and will contact you soon." : message}</p></div>`,
                );
            }
            return res.status(status).json({ success, message });
        };

        try {
            const key = String(req.params.key || "");
            if (rateLimited(`w:${key}:${clientIp(req)}`)) return reply(429, false, "Too many requests, please try again in a minute");

            const integration: any = await findActive(key, "website");
            if (!integration) return reply(404, false, "This form is not active");

            const body = req.body && typeof req.body === "object" ? req.body : {};
            // honeypot fields - bots fill hidden inputs, people do not
            if (body._gotcha || body._honeypot) return reply(200, true, "Thank you");

            const input = mapRecordToLeadInput(body);
            input.campaign = input.campaign || (body._form ? String(body._form).slice(0, 100) : integration.dataValues.name);
            const pageUrl = body._page || req.get("referer");
            if (pageUrl) input.extra = { ...(input.extra || {}), page_url: String(pageUrl).slice(0, 500) };

            await ingestLead({
                agencyUuid: integration.dataValues.agency_uuid,
                source: "website",
                input,
                integrationId: integration.dataValues.id,
            });
            return reply(200, true, "Thank you! We will contact you soon.");
        } catch (error) {
            if (error instanceof LeadValidationError) return reply(200, false, error.message);
            console.error("public website lead failed", error);
            return reply(500, false, "Something went wrong, please try again");
        }
    }

    async indiamart(req: Request, res: Response) {
        // IndiaMART expects a 200 reply quickly; anything else makes it retry
        try {
            const key = String(req.params.key || "");
            if (rateLimited(`i:${key}:${clientIp(req)}`)) return res.status(429).json({ code: 429, status: "Too many requests" });

            const integration: any = await findActive(key, "indiamart");
            if (!integration) return res.status(404).json({ code: 404, status: "Integration not found" });

            const payload = req.body?.RESPONSE ?? req.body;
            const records = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? [payload] : [];
            const valid = records.filter((r: any) => r && (r.SENDER_MOBILE || r.SENDER_EMAIL || r.SENDER_MOBILE_ALT));
            if (valid.length) await importIndiamartRecords(integration, valid.slice(0, 100));

            return res.status(200).json({ code: 200, status: "Success" });
        } catch (error) {
            console.error("public indiamart push failed", error);
            return res.status(500).json({ code: 500, status: "Error" });
        }
    }

    async google(req: Request, res: Response) {
        // Google expects 200 with an empty JSON body; a 4xx shows an error in Google Ads when testing
        try {
            const key = String(req.params.key || "");
            if (rateLimited(`g:${key}:${clientIp(req)}`)) return res.status(429).json({});
            const integration: any = await findActive(key, "google");
            if (!integration) return res.status(404).json({ error: "Webhook not active" });
            const expected = decryptJson<{ google_key: string }>(integration.dataValues.credentials)?.google_key || "";
            if (!sameKey(String(req.body?.google_key || ""), expected)) return res.status(403).json({ error: "Key does not match" });
            await ingestLead({
                agencyUuid: integration.dataValues.agency_uuid, source: "google", input: mapGoogleLead(req.body), integrationId: integration.dataValues.id,
            });
            return res.status(200).json({});
        } catch (error) {
            if (error instanceof LeadValidationError) return res.status(200).json({}); // nothing usable - do not make Google retry
            console.error("google lead webhook failed", error);
            return res.status(500).json({});
        }
    }

    async justdial(req: Request, res: Response) {
        // Justdial checks for the text RECEIVED
        try {
            const key = String(req.params.key || "");
            if (rateLimited(`j:${key}:${clientIp(req)}`)) return res.status(429).type("text").send("TOO MANY REQUESTS");
            const integration: any = await findActive(key, "justdial");
            if (!integration) return res.status(404).type("text").send("NOT FOUND");
            const raw = { ...(req.query || {}), ...(req.body && typeof req.body === "object" ? req.body : {}) } as Record<string, any>;
            await ingestLead({ agencyUuid: integration.dataValues.agency_uuid, source: "justdial", input: mapJustdialLead(raw), integrationId: integration.dataValues.id });
            return res.status(200).type("text").send("RECEIVED");
        } catch (error) {
            if (error instanceof LeadValidationError) return res.status(200).type("text").send("RECEIVED");
            console.error("justdial push failed", error);
            return res.status(500).type("text").send("ERROR");
        }
    }

    async sulekha(req: Request, res: Response) {
        try {
            const key = String(req.params.key || "");
            if (rateLimited(`s:${key}:${clientIp(req)}`)) return res.status(429).json({ success: false, message: "Too many requests" });
            const integration: any = await findActive(key, "sulekha");
            if (!integration) return res.status(404).json({ success: false, message: "Not found" });
            const raw = { ...(req.query || {}), ...(req.body && typeof req.body === "object" ? req.body : {}) } as Record<string, any>;
            const list = Array.isArray(raw.leads) ? raw.leads : [raw];
            let saved = 0;
            for (const item of list.slice(0, 50)) {
                try {
                    await ingestLead({ agencyUuid: integration.dataValues.agency_uuid, source: "sulekha", input: mapSulekhaLead(item), integrationId: integration.dataValues.id });
                    saved++;
                } catch (error) {
                    if (!(error instanceof LeadValidationError)) throw error;
                }
            }
            return res.status(200).json({ success: true, message: "Received", saved });
        } catch (error) {
            console.error("sulekha push failed", error);
            return res.status(500).json({ success: false, message: "Error" });
        }
    }
}

export default new PublicLeadController();
