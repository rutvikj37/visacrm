import { Response } from "express";
import { assertSourceAllowed } from "../../services/saas";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import LeadIntegration from "../../model/LeadIntegration";
import { decryptJson, encryptJson, generatePublicKey, maskSecret } from "../../helpers/crypto";
import { indiamartWaitMs, pullIndiamart } from "../../services/indiamart";
import { syncFacebookPage } from "../../services/meta";

/**
 * Lead sources an agency connects (agency owner only).
 * Credentials are stored encrypted and only ever returned masked.
 */

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, isOwner: user.role === "agent" };
};

/** Public base URL of this API, used to build webhook URLs shown to the agency. */
const publicApiBase = (req: RequestWithUser) => {
    if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/+$/, "");
    const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
    const host = req.get("x-forwarded-host") || req.get("host");
    return `${proto}://${host}/api`;
};

export const presentIntegration = (req: RequestWithUser, integration: any) => {
    const data = integration.toJSON ? integration.toJSON() : integration;
    const credentials = decryptJson<Record<string, string>>(data.credentials);
    const base = publicApiBase(req);
    return {
        uuid: data.uuid,
        type: data.type,
        name: data.name,
        status: data.status,
        settings: data.settings,
        branch_id: data.branch_id || null,
        last_synced_at: data.last_synced_at,
        last_lead_at: data.last_lead_at,
        last_error: data.last_error,
        leads_received: data.leads_received,
        createdAt: data.createdAt,
        crm_key_masked: credentials?.crm_key ? maskSecret(credentials.crm_key) : null,
        webhook_url:
            data.type === "website" ? `${base}/v1/public/leads/website/${data.public_key}`
                : data.type === "indiamart" ? `${base}/v1/public/leads/indiamart/${data.public_key}`
                    : data.type === "whatsapp" ? `${base}/v1/public/meta/whatsapp/${data.public_key}`
                        : ["google", "justdial", "sulekha"].includes(data.type) ? `${base}/v1/public/leads/${data.type}/${data.public_key}`
                            : null,
        // Google Ads: the "Key" field of the lead form webhook (not secret enough to hide - it only lets Google post leads)
        google_key: data.type === "google" ? credentials?.google_key || null : undefined,
        // WhatsApp: verify token for the webhook link, and whether the agency's own app secret is saved
        verify_token: data.type === "whatsapp" ? credentials?.verify_token || null : undefined,
        app_secret_saved: data.type === "whatsapp" ? Boolean(credentials?.app_secret) : undefined,
    };
};

const findOwned = (req: RequestWithUser) =>
    LeadIntegration.findOne({ where: { uuid: req.params.uuid, agency_uuid: ctx(req).agencyUuid } });

class LeadIntegrationController {
    // GET /crm/integrations
    async list(req: RequestWithUser, res: Response) {
        try {
            const integrations = await LeadIntegration.findAll({
                where: { agency_uuid: ctx(req).agencyUuid },
                order: [["createdAt", "ASC"]],
            });
            return returnHelper(res, 200, true, "Integrations fetched", integrations.map((i) => presentIntegration(req, i)));
        } catch (error) {
            console.error("list integrations failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/website  { name? }
    async createWebsite(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            try { await assertSourceAllowed(ctx(req).agencyUuid, "website"); } catch (e: any) { return returnHelper(res, 200, false, e.message); }
            const count = await LeadIntegration.count({ where: { agency_uuid: agencyUuid, type: "website" } });
            if (count >= 10) return returnHelper(res, 200, false, "You can create up to 10 website forms");

            const name = req.body?.name ? String(req.body.name).trim().slice(0, 100) : `Website form ${count + 1}`;
            const integration = await LeadIntegration.create({
                agency_uuid: agencyUuid,
                type: "website",
                name,
                public_key: generatePublicKey(),
                status: "active",
            });
            return returnHelper(res, 200, true, "Website form created", presentIntegration(req, integration));
        } catch (error) {
            console.error("create website integration failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/indiamart  { crm_key, name? }  - create or replace the key
    async saveIndiamart(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            try { await assertSourceAllowed(ctx(req).agencyUuid, "indiamart"); } catch (e: any) { return returnHelper(res, 200, false, e.message); }
            const crmKey = req.body?.crm_key ? String(req.body.crm_key).trim() : "";
            if (crmKey.length < 10 || crmKey.length > 200 || /\s/.test(crmKey)) {
                return returnHelper(res, 200, false, "Please paste a valid IndiaMART CRM key (Lead Manager > Import/Export Leads > CRM integration)");
            }
            const name = req.body?.name ? String(req.body.name).trim().slice(0, 100) : "IndiaMART";

            let integration: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "indiamart" } });
            if (integration) {
                await LeadIntegration.update(
                    { credentials: encryptJson({ crm_key: crmKey }), name, status: "active", last_error: null },
                    { where: { id: integration.dataValues.id } },
                );
                integration = await LeadIntegration.findByPk(integration.dataValues.id);
            } else {
                integration = await LeadIntegration.create({
                    agency_uuid: agencyUuid,
                    type: "indiamart",
                    name,
                    public_key: generatePublicKey(),
                    credentials: encryptJson({ crm_key: crmKey }),
                    status: "active",
                });
            }

            // first pull straight away so the agency sees it working (unless we called IndiaMART very recently)
            if (indiamartWaitMs(integration) > 0) {
                return returnHelper(res, 200, true, "Key saved. New leads will be fetched within 10 minutes.", presentIntegration(req, integration));
            }
            const result = await pullIndiamart(integration);
            const fresh = await LeadIntegration.findByPk(integration.dataValues.id);
            if (!result.ok) {
                return returnHelper(res, 200, true, `Saved, but IndiaMART said: ${result.message}`, presentIntegration(req, fresh));
            }
            return returnHelper(res, 200, true, `IndiaMART connected - ${result.created || 0} new lead(s) imported`, presentIntegration(req, fresh));
        } catch (error) {
            console.error("save indiamart integration failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/push { type: google | justdial | sulekha, name? }  - create (or return) the webhook for a source
    async createPush(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            const type = String(req.body?.type || "");
            if (!["google", "justdial", "sulekha"].includes(type)) return returnHelper(res, 200, false, "Unknown lead source");
            try { await assertSourceAllowed(agencyUuid, type); } catch (e: any) { return returnHelper(res, 200, false, e.message); }
            const existing: any = await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type } });
            if (existing) {
                if (existing.dataValues.status !== "active") await LeadIntegration.update({ status: "active" }, { where: { id: existing.dataValues.id } });
                return returnHelper(res, 200, true, "Already set up", presentIntegration(req, await LeadIntegration.findByPk(existing.dataValues.id)));
            }
            const label: Record<string, string> = { google: "Google Ads lead forms", justdial: "Justdial", sulekha: "Sulekha" };
            const integration = await LeadIntegration.create({
                agency_uuid: agencyUuid, type, public_key: generatePublicKey(), status: "active",
                name: req.body?.name ? String(req.body.name).trim().slice(0, 100) : label[type],
                credentials: type === "google" ? encryptJson({ google_key: generatePublicKey().slice(0, 24) }) : null,
            });
            return returnHelper(res, 200, true, `${label[type]} link created`, presentIntegration(req, integration));
        } catch (error) {
            console.error("create push integration failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/:uuid/sync  - pull IndiaMART now
    async syncNow(req: RequestWithUser, res: Response) {
        try {
            if (!ctx(req).isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            const integration: any = await findOwned(req);
            if (!integration) return returnHelper(res, 200, false, "Integration not found");
            if (integration.dataValues.status !== "active") return returnHelper(res, 200, false, "Turn the integration on first");
            if (integration.dataValues.type === "facebook") {
                try {
                    const r = await syncFacebookPage(integration, 7);
                    const fresh = await LeadIntegration.findByPk(integration.dataValues.id);
                    return returnHelper(res, 200, true, `Sync done (last 7 days) - ${r.created} new, ${r.duplicates} already imported`, presentIntegration(req, fresh));
                } catch (error: any) {
                    const fresh = await LeadIntegration.findByPk(integration.dataValues.id);
                    return returnHelper(res, 200, false, `Facebook said: ${error.message}`, presentIntegration(req, fresh));
                }
            }
            if (integration.dataValues.type !== "indiamart") return returnHelper(res, 200, false, "This source can not be synced manually");

            const waitMs = indiamartWaitMs(integration);
            if (waitMs > 0) {
                return returnHelper(res, 200, false, `IndiaMART allows one sync every 5 minutes. Try again in ${Math.ceil(waitMs / 60000)} minute(s).`);
            }
            const result = await pullIndiamart(integration);
            const fresh = await LeadIntegration.findByPk(integration.dataValues.id);
            if (!result.ok) return returnHelper(res, 200, false, `IndiaMART said: ${result.message}`, presentIntegration(req, fresh));
            return returnHelper(res, 200, true, `Sync done - ${result.created || 0} new, ${result.duplicates || 0} already imported`, presentIntegration(req, fresh));
        } catch (error) {
            console.error("sync integration failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/:uuid/toggle
    async toggle(req: RequestWithUser, res: Response) {
        try {
            if (!ctx(req).isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            const integration: any = await findOwned(req);
            if (!integration) return returnHelper(res, 200, false, "Integration not found");
            const status = integration.dataValues.status === "active" ? "inactive" : "active";
            await LeadIntegration.update({ status }, { where: { id: integration.dataValues.id } });
            return returnHelper(res, 200, true, status === "active" ? "Integration turned on" : "Integration turned off", { status });
        } catch (error) {
            console.error("toggle integration failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/:uuid/regenerate_key - old webhook URL stops working
    async regenerateKey(req: RequestWithUser, res: Response) {
        try {
            if (!ctx(req).isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            const integration: any = await findOwned(req);
            if (!integration) return returnHelper(res, 200, false, "Integration not found");
            const updates: Record<string, any> = { public_key: generatePublicKey() };
            if (integration.dataValues.type === "google") updates.credentials = encryptJson({ google_key: generatePublicKey().slice(0, 24) });
            await LeadIntegration.update(updates, { where: { id: integration.dataValues.id } });
            const fresh = await LeadIntegration.findByPk(integration.dataValues.id);
            return returnHelper(res, 200, true, "New URL generated - update it on your website", presentIntegration(req, fresh));
        } catch (error) {
            console.error("regenerate key failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/:uuid/delete
    async remove(req: RequestWithUser, res: Response) {
        try {
            if (!ctx(req).isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage integrations");
            const integration: any = await findOwned(req);
            if (!integration) return returnHelper(res, 200, false, "Integration not found");
            await LeadIntegration.destroy({ where: { id: integration.dataValues.id } });
            return returnHelper(res, 200, true, "Integration removed. Leads already received are kept.");
        } catch (error) {
            console.error("delete integration failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new LeadIntegrationController();
