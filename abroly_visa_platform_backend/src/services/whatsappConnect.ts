import LeadIntegration from "../model/LeadIntegration";
import { decryptJson, encryptJson, generatePublicKey } from "../helpers/crypto";
import { parseJsonValue } from "../helpers/json";
import { assertSourceAllowed } from "./saas";
import { verifyWhatsapp } from "./meta";

/**
 * Connect (or update) an agency's WhatsApp Cloud API number as a lead source.
 * Used by the agency owner (Leads > Lead sources) and by the platform admin on the agency's page,
 * so both go through the same checks: plan allows WhatsApp, the token works with Meta, and the
 * number is not already connected to another agency.
 *
 * body: { access_token, phone_number_id, waba_id, app_secret?, add_number? }
 */
export const connectWhatsapp = async (agencyUuid: string, body: any): Promise<{ ok: boolean; message: string }> => {
    try {
        await assertSourceAllowed(agencyUuid, "whatsapp");
    } catch (e: any) {
        return { ok: false, message: e.message };
    }

    const accessToken = String(body?.access_token || "").trim();
    const phoneNumberId = String(body?.phone_number_id || "").replace(/\D/g, "");
    const wabaId = String(body?.waba_id || "").replace(/\D/g, "");
    const appSecretInput = String(body?.app_secret || "").trim();
    if (appSecretInput && !/^[a-f0-9]{16,64}$/i.test(appSecretInput)) return { ok: false, message: "The App secret looks wrong - copy it from your Meta app: App settings > Basic" };
    if (accessToken.length < 20 || /\s/.test(accessToken)) return { ok: false, message: "Please paste a valid permanent access token" };
    if (!phoneNumberId) return { ok: false, message: "Please enter the Phone number ID" };
    if (!wabaId) return { ok: false, message: "Please enter the WhatsApp Business Account ID" };

    const other = await LeadIntegration.findOne({
        where: { type: "whatsapp", external_id: phoneNumberId, status: "active" },
        attributes: ["agency_uuid"],
    }) as any;
    if (other && other.dataValues.agency_uuid !== agencyUuid) {
        return { ok: false, message: "This WhatsApp number is already connected to another account" };
    }

    let info: any;
    try {
        info = await verifyWhatsapp(accessToken, phoneNumberId, wabaId);
    } catch (error: any) {
        const raw = String(error?.message || "request failed");
        // Phone verify failed — usually bad token, wrong Phone number ID, or token lacks messaging access
        if (/does not exist|missing permissions|Unsupported/i.test(raw)) {
            return {
                ok: false,
                message: `WhatsApp could not verify Phone number ID ${phoneNumberId}: ${raw}. Check the ID from WhatsApp → API Setup, and that this permanent token belongs to a system user with that WhatsApp asset assigned.`,
            };
        }
        return { ok: false, message: `WhatsApp said: ${raw}` };
    }

    const { subscription_warning, ...phoneInfo } = info;
    // "add another number": a second (third...) WhatsApp number; otherwise update the first one
    const existing: any = body?.add_number
        ? await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "whatsapp", external_id: phoneNumberId } })
        : await LeadIntegration.findOne({ where: { agency_uuid: agencyUuid, type: "whatsapp" }, order: [["id", "ASC"]] });
    const prevSettings = existing ? (parseJsonValue(existing.dataValues.settings) || {}) : {};
    const values: any = {
        name: phoneInfo.verified_name ? `${phoneInfo.verified_name} (${phoneInfo.display_phone_number})` : phoneInfo.display_phone_number || "WhatsApp",
        external_id: phoneNumberId,
        // keep review-first preference when reconnecting the same number
        settings: {
            ...prevSettings,
            ...phoneInfo,
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            waba_subscribed: !subscription_warning,
            auto_create_leads: prevSettings.auto_create_leads !== false,
        },
        status: "active",
        // surface subscribe issues on the card without blocking connect (outbound still works)
        last_error: subscription_warning || null,
    };
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

    const connected = `WhatsApp connected: ${phoneInfo.display_phone_number || phoneNumberId}`;
    if (subscription_warning) {
        return { ok: true, message: `${connected}. ${subscription_warning}` };
    }
    return { ok: true, message: connected };
};
