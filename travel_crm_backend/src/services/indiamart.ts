import axios from "axios";
import LeadIntegration from "../model/LeadIntegration";
import { decryptJson } from "../helpers/crypto";
import { parseJsonValue } from "../helpers/json";
import { ingestLead, LeadInput, LeadValidationError } from "./leadIngestion";

/**
 * IndiaMART Lead Manager (CRM API v2).
 *
 * Pull: GET https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=KEY&start_time=..&end_time=..
 *   - dates in IST, "DD-Mon-YYYY HH:MM:SS"
 *   - IndiaMART allows roughly one call per 5 minutes per key and a window of at most 7 days
 *   - a key that is not used for 7 days expires, so the scheduled pull also keeps it alive
 * Push: IndiaMART can also POST each new lead to our webhook (see publicLeadRoutes) with the same record shape.
 */

const PULL_URL = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/";
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FIRST_SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;
const OVERLAP_MS = 10 * 60 * 1000; // re-read the last 10 minutes; duplicates are skipped by UNIQUE_QUERY_ID
export const MIN_PULL_INTERVAL_MS = 5 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a date as IndiaMART expects, in IST (UTC+5:30). */
export const formatIndiamartDate = (date: Date): string => {
    const ist = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(ist.getUTCDate())}-${MONTHS[ist.getUTCMonth()]}-${ist.getUTCFullYear()} ` +
        `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
};

/** Map one IndiaMART enquiry record to our lead fields. */
export const mapIndiamartRecord = (record: Record<string, any>): LeadInput => {
    const subject = record.SUBJECT ? String(record.SUBJECT) : "";
    const message = record.QUERY_MESSAGE ? String(record.QUERY_MESSAGE).replace(/<br\s*\/?>/gi, "\n") : "";
    return {
        name: record.SENDER_NAME || record.SENDER_COMPANY || null,
        phone: record.SENDER_MOBILE || record.SENDER_MOBILE_ALT || record.SENDER_PHONE || null,
        email: record.SENDER_EMAIL || record.SENDER_EMAIL_ALT || null,
        city: record.SENDER_CITY || null,
        interested_course: record.QUERY_PRODUCT_NAME || record.QUERY_MCAT_NAME || null,
        message: [subject, message].filter(Boolean).join("\n").trim() || null,
        source_ref: record.UNIQUE_QUERY_ID ? String(record.UNIQUE_QUERY_ID) : null,
        extra: {
            query_type: record.QUERY_TYPE || null,
            query_time: record.QUERY_TIME || null,
            company: record.SENDER_COMPANY || null,
            address: record.SENDER_ADDRESS || null,
            state: record.SENDER_STATE || null,
            pincode: record.SENDER_PINCODE || null,
            country_iso: record.SENDER_COUNTRY_ISO || null,
        },
    };
};

/** Import a list of IndiaMART records for an integration. Returns counts. */
export const importIndiamartRecords = async (integration: any, records: any[]) => {
    let created = 0, duplicates = 0, failed = 0;
    for (const record of records) {
        try {
            const result = await ingestLead({
                agencyUuid: integration.dataValues.agency_uuid,
                source: "indiamart",
                input: mapIndiamartRecord(record),
                integrationId: integration.dataValues.id,
            });
            if (result.created) created++; else duplicates++;
        } catch (error) {
            failed++;
            if (!(error instanceof LeadValidationError)) console.error("IndiaMART record import failed", error);
        }
    }
    return { created, duplicates, failed };
};

/** Pull new enquiries for one IndiaMART integration. */
export const pullIndiamart = async (integration: any) => {
    const credentials = decryptJson<{ crm_key: string }>(integration.dataValues.credentials);
    if (!credentials?.crm_key) {
        await LeadIntegration.update({ last_error: "IndiaMART CRM key missing" }, { where: { id: integration.dataValues.id } });
        return { ok: false, message: "IndiaMART CRM key missing" };
    }

    const now = new Date();
    // remember every attempt (also failed ones) so we never call IndiaMART more than once per 5 minutes
    await LeadIntegration.update(
        { settings: { ...(parseJsonValue(integration.dataValues.settings) || {}), last_attempt_at: now.toISOString() } },
        { where: { id: integration.dataValues.id } },
    );
    const last = integration.dataValues.last_synced_at ? new Date(integration.dataValues.last_synced_at) : null;
    let start = last ? new Date(last.getTime() - OVERLAP_MS) : new Date(now.getTime() - FIRST_SYNC_WINDOW_MS);
    if (now.getTime() - start.getTime() > MAX_WINDOW_MS) start = new Date(now.getTime() - MAX_WINDOW_MS + 60 * 1000);

    try {
        const response = await axios.get(PULL_URL, {
            params: {
                glusr_crm_key: credentials.crm_key,
                start_time: formatIndiamartDate(start),
                end_time: formatIndiamartDate(now),
            },
            timeout: 30000,
        });
        const body = response.data || {};
        const code = Number(body.CODE);

        // 204 = no new leads in this window
        if (code === 204 || (code === 200 && (!body.RESPONSE || body.RESPONSE.length === 0))) {
            await LeadIntegration.update({ last_synced_at: now, last_error: null }, { where: { id: integration.dataValues.id } });
            return { ok: true, created: 0, duplicates: 0, failed: 0 };
        }
        if (code !== 200 || !Array.isArray(body.RESPONSE)) {
            const message = body.MESSAGE || `IndiaMART returned code ${body.CODE}`;
            await LeadIntegration.update({ last_error: String(message).slice(0, 1000) }, { where: { id: integration.dataValues.id } });
            return { ok: false, message };
        }

        const counts = await importIndiamartRecords(integration, body.RESPONSE);
        await LeadIntegration.update({ last_synced_at: now, last_error: null }, { where: { id: integration.dataValues.id } });
        return { ok: true, ...counts };
    } catch (error: any) {
        const message = error?.response?.data?.MESSAGE || error?.message || "IndiaMART request failed";
        await LeadIntegration.update({ last_error: String(message).slice(0, 1000) }, { where: { id: integration.dataValues.id } });
        return { ok: false, message };
    }
};

/** Milliseconds until this integration may call IndiaMART again (0 = now). */
export const indiamartWaitMs = (integration: any): number => {
    const times = [integration.dataValues.last_synced_at, parseJsonValue(integration.dataValues.settings)?.last_attempt_at]
        .filter(Boolean).map((t: any) => new Date(t).getTime()).filter((t: number) => !isNaN(t));
    const last = times.length ? Math.max(...times) : 0;
    return Math.max(0, MIN_PULL_INTERVAL_MS - (Date.now() - last));
};

/** Pull all active IndiaMART integrations. Called by the scheduler. */
export const pullAllIndiamart = async () => {
    const integrations = await LeadIntegration.findAll({ where: { type: "indiamart", status: "active" } });
    for (const integration of integrations as any[]) {
        if (indiamartWaitMs(integration) > 0) continue;
        const result = await pullIndiamart(integration);
        if (!result.ok) console.warn(`IndiaMART pull failed for integration ${integration.dataValues.id}: ${result.message}`);
    }
};
