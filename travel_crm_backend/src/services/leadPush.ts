import crypto from "crypto";
import { LeadInput } from "./leadIngestion";
import { mapRecordToLeadInput } from "./leadImport";

/**
 * Turn what Google Ads, Justdial and Sulekha send into a LeadInput.
 * Justdial / Sulekha field names differ between accounts, so we accept the common variants and keep
 * everything else in `extra` (shown on the lead).
 */

const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());

/** Google Ads lead form webhook: { lead_id, google_key, user_column_data: [{ column_id, column_name, string_value }], campaign_id, form_id, is_test } */
export const mapGoogleLead = (body: any): LeadInput => {
    const cols: any[] = Array.isArray(body?.user_column_data) ? body.user_column_data : [];
    const get = (...ids: string[]) => str(cols.find((c) => ids.includes(String(c?.column_id || "").toUpperCase()))?.string_value);
    const extra: Record<string, string> = {};
    const known = new Set(["FULL_NAME", "FIRST_NAME", "LAST_NAME", "PHONE_NUMBER", "EMAIL", "WORK_EMAIL", "CITY", "COUNTRY", "WORK_PHONE"]);
    let course = "", country = "", message = "";
    for (const c of cols) {
        const id = String(c?.column_id || "").toUpperCase();
        if (known.has(id)) continue;
        const label = str(c?.column_name) || id;
        const value = str(c?.string_value);
        if (!value) continue;
        // custom questions agencies usually add
        const l = label.toLowerCase();
        if (!country && /country|destination/.test(l)) country = value;
        else if (!course && /course|program|study|service/.test(l)) course = value;
        else if (!message && /message|question|comment|query/.test(l)) message = value;
        else if (Object.keys(extra).length < 30) extra[label.slice(0, 60)] = value.slice(0, 1000);
    }
    const first = get("FIRST_NAME"), last = get("LAST_NAME");
    if (body?.campaign_id) extra.google_campaign_id = str(body.campaign_id);
    if (body?.form_id) extra.google_form_id = str(body.form_id);
    if (body?.gcl_id) extra.gclid = str(body.gcl_id);
    return {
        name: get("FULL_NAME") || `${first} ${last}`.trim() || null,
        phone: get("PHONE_NUMBER", "WORK_PHONE") || null,
        email: get("EMAIL", "WORK_EMAIL") || null,
        city: get("CITY") || null,
        interested_country: country || null,
        interested_course: course || null,
        message: message || null,
        campaign: body?.campaign_name ? str(body.campaign_name) : body?.campaign_id ? `Google Ads campaign ${str(body.campaign_id)}` : "Google Ads",
        source_ref: str(body?.lead_id) || null,
        extra: Object.keys(extra).length ? extra : null,
        tags: body?.is_test ? ["test"] : null,
    };
};

/** Same key check without leaking timing. */
export const sameKey = (a: string, b: string) => {
    const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
    return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Justdial lead push (GET query or POST): leadid, name, prefix, mobile, phone, email, category, city, area, pincode, date, time ... */
export const mapJustdialLead = (raw: Record<string, any>): LeadInput => {
    const r: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw || {})) r[k.toLowerCase()] = v;
    const input = mapRecordToLeadInput(raw);
    const name = [str(r.prefix), str(r.name)].filter(Boolean).join(" ") || input.name || null;
    const area = [str(r.area), str(r.brancharea)].filter(Boolean)[0];
    const message = [str(r.category) && `Searched for: ${str(r.category)}`, area && `Area: ${area}`, input.message].filter(Boolean).join(" · ");
    return {
        ...input,
        name,
        phone: str(r.mobile) || str(r.phone) || input.phone || null,
        city: str(r.city) || input.city || null,
        message: message || null,
        campaign: str(r.category) || "Justdial",
        source_ref: str(r.leadid) || str(r.lead_id) || input.source_ref || null,
    };
};

/** Sulekha lead push (JSON or form). Accepts lead_id / leadId, name, mobile / phone, email, city, need / service / requirement ... */
export const mapSulekhaLead = (raw: Record<string, any>): LeadInput => {
    // some accounts wrap the lead: { lead: {...} } or { data: {...} }
    const body = raw?.lead && typeof raw.lead === "object" ? raw.lead : raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;
    const r: Record<string, any> = {};
    for (const [k, v] of Object.entries(body || {})) r[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v;
    const input = mapRecordToLeadInput(body);
    const need = str(r.need) || str(r.servicename) || str(r.categoryname) || str(r.category) || str(r.subcategory);
    return {
        ...input,
        name: input.name || str(r.customername) || str(r.username) || null,
        phone: input.phone || str(r.mobileno) || str(r.customermobile) || null,
        email: input.email || str(r.customeremail) || null,
        city: input.city || str(r.cityname) || str(r.locality) || null,
        interested_course: input.interested_course || need || null,
        message: input.message || str(r.description) || str(r.details) || null,
        campaign: need || "Sulekha",
        source_ref: input.source_ref || str(r.leadid) || str(r.enquiryid) || str(r.requirementid) || null,
    };
};
