import { Op } from "sequelize";
import PlatformSetting from "../model/PlatformSetting";
import { accessOf } from "../helpers/access";
import { RequestWithUser } from "../utils/types";

/**
 * Travel CRM rules shared by the travel controller, leads and invoices:
 * enquiry fields, quote costing (markup, GST, TCS), tax settings, numbering and cost hiding.
 * Money is paise inside, rupees in the API.
 */

export const toPaise = (v: any) => Math.round(Number(v || 0) * 100);
export const toRupees = (v: any) => Math.round(Number(v || 0)) / 100;
const str = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).replace(/\u0000/g, "").trim().slice(0, max) || null);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const int = (v: any, max = 1000) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
};

// ---------------------------------------------------------------- enquiry fields (LD-01)

export const HOTEL_CATEGORIES = ["budget", "3_star", "4_star", "5_star", "luxury"];
export const TRIP_TYPES = ["family", "honeymoon", "group", "solo", "friends", "corporate", "pilgrimage", "adventure"];

/** Travel enquiry fields from a request body. Only keys present in the body are returned (safe for updates). */
export const cleanTravelLeadFields = (body: any): Record<string, any> => {
    const b = body || {};
    const out: Record<string, any> = {};
    const has = (k: string) => b[k] !== undefined;
    if (has("business_line")) out.business_line = b.business_line === "travel" ? "travel" : "visa";
    if (has("destinations")) {
        const list = Array.isArray(b.destinations) ? b.destinations : String(b.destinations || "").split(",");
        const clean = list.map((d: any) => str(d, 80)).filter(Boolean).slice(0, 10);
        out.destinations = clean.length ? clean : null;
    }
    if (has("travel_start")) out.travel_start = date(b.travel_start);
    if (has("travel_end")) out.travel_end = date(b.travel_end);
    if (has("travel_month")) out.travel_month = /^\d{4}-\d{2}$/.test(String(b.travel_month || "")) ? String(b.travel_month) : null;
    if (has("nights")) out.nights = int(b.nights, 90);
    if (has("adults")) out.adults = int(b.adults, 99);
    if (has("children")) out.children = int(b.children, 99);
    if (has("infants")) out.infants = int(b.infants, 99);
    if (has("child_ages")) {
        const ages = (Array.isArray(b.child_ages) ? b.child_ages : String(b.child_ages || "").split(",")).map((a: any) => int(a, 17)).filter((a: any) => a !== null);
        out.child_ages = ages.length ? ages.slice(0, 20) : null;
    }
    if (has("budget")) out.budget = b.budget === null || b.budget === "" ? null : toPaise(b.budget);
    if (has("hotel_category")) out.hotel_category = HOTEL_CATEGORIES.includes(b.hotel_category) ? b.hotel_category : null;
    if (has("trip_type")) out.trip_type = TRIP_TYPES.includes(b.trip_type) ? b.trip_type : str(b.trip_type, 40);
    if (has("departure_city")) out.departure_city = str(b.departure_city);
    // any travel field means it is a travel enquiry
    if (!out.business_line && Object.keys(out).length) out.business_line = "travel";
    return out;
};

/**
 * Travel fields from form answers that were not mapped to a known column (Facebook / Google lead forms,
 * website webhooks, CSV columns): keys like "travel_date", "no_of_adults", "budget", "destination".
 * Returns {} unless the answers clearly describe a trip, so visa forms with a "country" question stay visa leads.
 */
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
const parseDate = (v: any) => {
    const s = String(v || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); // dd/mm/yyyy (India)
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const firstInt = (v: any) => { const m = String(v ?? "").match(/\d+/); return m ? Number(m[0]) : null; };
export const travelFromExtra = (extra: any): Record<string, any> => {
    if (!extra || typeof extra !== "object") return {};
    const out: Record<string, any> = {};
    let strong = false;
    for (const [key, value] of Object.entries(extra)) {
        if (value === null || value === undefined || value === "") continue;
        const k = norm(key);
        if (/(traveldate|departuredate|checkin|startdate|dateoftravel|fromdate)/.test(k)) { const d = parseDate(value); if (d) { out.travel_start = d; strong = true; } }
        else if (/(returndate|checkout|enddate|todate)/.test(k)) { const d = parseDate(value); if (d) { out.travel_end = d; strong = true; } }
        else if (/(travelmonth|monthoftravel|whenareyou)/.test(k)) { const d = parseDate(`1 ${value}`); if (d) { out.travel_month = d.slice(0, 7); strong = true; } }
        else if (/(nights|duration|noofdays|days)/.test(k)) { const n = firstInt(value); if (n !== null) { out.nights = /day/.test(k) ? Math.max(0, n - 1) : n; strong = true; } }
        else if (/(adult|travell?ers|noofpeople|pax|guests)/.test(k)) { const n = firstInt(value); if (n !== null) { out.adults = n; strong = true; } }
        else if (/(child|kids)/.test(k)) { const n = firstInt(value); if (n !== null) { out.children = n; strong = true; } }
        else if (/infant/.test(k)) { const n = firstInt(value); if (n !== null) { out.infants = n; strong = true; } }
        else if (/budget/.test(k)) { const n = Number(String(value).replace(/[^\d.]/g, "")); if (n > 0) { out.budget = toPaise(n); strong = true; } }
        else if (/(hotel|star)/.test(k)) { strong = true; const v = String(value).toLowerCase(); out.hotel_category = /lux/.test(v) ? "luxury" : /5/.test(v) ? "5_star" : /4/.test(v) ? "4_star" : /3/.test(v) ? "3_star" : /budget/.test(v) ? "budget" : null; }
        else if (/(triptype|occasion|purpose|holidaytype)/.test(k)) { out.trip_type = String(value).toLowerCase().slice(0, 40); strong = true; }
        else if (/(departurecity|fromcity|leavingfrom|startingfrom)/.test(k)) { out.departure_city = String(value).slice(0, 255); strong = true; }
        else if (/(destination|wheretogo|place|package)/.test(k)) { out.destinations = String(value).split(/[,/&]| and /).map((x) => x.trim()).filter(Boolean).slice(0, 10); }
    }
    if (!strong) return {};
    out.business_line = "travel";
    return out;
};

export const presentTravelLead = (l: any) => ({
    business_line: l.business_line || "visa",
    destinations: Array.isArray(l.destinations) ? l.destinations : [],
    travel_start: l.travel_start || null,
    travel_end: l.travel_end || null,
    travel_month: l.travel_month || null,
    nights: l.nights ?? null,
    adults: l.adults ?? null,
    children: l.children ?? null,
    child_ages: Array.isArray(l.child_ages) ? l.child_ages : [],
    infants: l.infants ?? null,
    budget: l.budget === null || l.budget === undefined ? null : toRupees(l.budget),
    hotel_category: l.hotel_category || null,
    trip_type: l.trip_type || null,
    departure_city: l.departure_city || null,
    converted_booking_id: l.converted_booking_id || null,
});

// ---------------------------------------------------------------- tax settings (Super Admin)

export interface TravelTax {
    gst_full_value_percent: number; // tour operator, GST on the whole package
    gst_margin_percent: number;     // GST on the service charge / markup only
    sac_full_value: string;
    sac_margin: string;
    tcs_overseas_percent: number;   // TCS on overseas tour packages
    tcs_no_pan_percent: number;     // when the traveller has no PAN
    tcs_on_gst: boolean;            // TCS calculated on the amount including GST
}

/** Defaults to be confirmed by each agency's CA; the BRD gives TCS 2% from 1 April 2026. */
export const DEFAULT_TRAVEL_TAX: TravelTax = {
    gst_full_value_percent: 5,
    gst_margin_percent: 18,
    sac_full_value: "998552",
    sac_margin: "998555",
    tcs_overseas_percent: 2,
    tcs_no_pan_percent: 20,
    tcs_on_gst: true,
};

const pct = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : fallback;
};

export const cleanTravelTax = (raw: any): TravelTax => ({
    gst_full_value_percent: pct(raw?.gst_full_value_percent, DEFAULT_TRAVEL_TAX.gst_full_value_percent),
    gst_margin_percent: pct(raw?.gst_margin_percent, DEFAULT_TRAVEL_TAX.gst_margin_percent),
    sac_full_value: str(raw?.sac_full_value, 10) || DEFAULT_TRAVEL_TAX.sac_full_value,
    sac_margin: str(raw?.sac_margin, 10) || DEFAULT_TRAVEL_TAX.sac_margin,
    tcs_overseas_percent: pct(raw?.tcs_overseas_percent, DEFAULT_TRAVEL_TAX.tcs_overseas_percent),
    tcs_no_pan_percent: pct(raw?.tcs_no_pan_percent, DEFAULT_TRAVEL_TAX.tcs_no_pan_percent),
    tcs_on_gst: raw?.tcs_on_gst === undefined ? DEFAULT_TRAVEL_TAX.tcs_on_gst : Boolean(raw.tcs_on_gst),
});

export const getTravelTax = async (): Promise<TravelTax> => {
    const row: any = await PlatformSetting.findOne({ where: { key: "travel_tax" } });
    return cleanTravelTax(row?.value || {});
};

export const saveTravelTax = async (raw: any) => {
    const value = cleanTravelTax(raw);
    const row: any = await PlatformSetting.findOne({ where: { key: "travel_tax" } });
    if (row) await row.update({ value });
    else await PlatformSetting.create({ key: "travel_tax", value });
    return value;
};

// ---------------------------------------------------------------- quote costing (QT-01..QT-04)

export const SERVICE_TYPES = ["hotel", "flight", "transfer", "activity", "meal", "visa", "insurance", "forex", "other"];

export interface QuoteLine {
    service_type: string;
    description: string;
    supplier_id: number | null;
    rate_id: number | null;
    qty: number;       // rooms / pax / vehicles
    nights: number;    // multiplier for per-night services, 0 = once
    unit_cost: number; // paise
    markup_type: "percent" | "flat";
    markup_value: number; // percent, or paise when flat
}

export const cleanLines = (raw: any): QuoteLine[] => {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 60).map((l: any) => ({
        service_type: SERVICE_TYPES.includes(l?.service_type) ? l.service_type : "other",
        description: str(l?.description, 300) || "Service",
        supplier_id: l?.supplier_id ? Number(l.supplier_id) || null : null,
        rate_id: l?.rate_id ? Number(l.rate_id) || null : null,
        qty: Math.max(1, int(l?.qty, 999) || 1),
        nights: int(l?.nights, 90) || 0,
        unit_cost: Math.max(0, toPaise(l?.unit_cost)),
        markup_type: l?.markup_type === "flat" ? "flat" : "percent",
        markup_value: l?.markup_type === "flat" ? Math.max(0, toPaise(l?.markup_value)) : pct(l?.markup_value, 0),
    }));
};

export const lineCost = (l: QuoteLine) => l.unit_cost * l.qty * Math.max(1, l.nights);
export const lineMarkup = (l: QuoteLine) => (l.markup_type === "flat" ? l.markup_value : Math.round(lineCost(l) * l.markup_value / 100));

export interface QuoteTotals {
    cost: number;
    markup: number;
    discount: number;
    sell: number;        // cost + markup - discount (before tax)
    taxable: number;
    gst: number;
    tcs: number;
    total: number;       // what the client pays
    profit: number;      // sell - cost
    per_person: number;
}

export const quoteTotals = (lines: QuoteLine[], o: { discount: number; billingMode: "full_value" | "margin"; gstPercent: number; tcsPercent: number; international: boolean; travellers: number; tcsOnGst?: boolean }): QuoteTotals => {
    const cost = lines.reduce((a, l) => a + lineCost(l), 0);
    const markup = lines.reduce((a, l) => a + lineMarkup(l), 0);
    const discount = Math.min(Math.max(0, o.discount), cost + markup);
    const sell = cost + markup - discount;
    const taxable = o.billingMode === "margin" ? Math.max(0, sell - cost) : sell;
    const gst = Math.round(taxable * o.gstPercent / 100);
    const tcsBase = o.tcsOnGst === false ? sell : sell + gst;
    const tcs = o.international ? Math.round(tcsBase * o.tcsPercent / 100) : 0;
    const total = sell + gst + tcs;
    return { cost, markup, discount, sell, taxable, gst, tcs, total, profit: sell - cost, per_person: Math.round(total / Math.max(1, o.travellers)) };
};

export const totalsInRupees = (t: QuoteTotals) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, toRupees(v)]));

// ---------------------------------------------------------------- GST split by place of supply

/** First two digits of a GSTIN are the state code. */
export const stateOfGstin = (gstin?: string | null) => (/^\d{2}/.test(String(gstin || "")) ? String(gstin).slice(0, 2) : null);

export const splitGst = (gst: number, agencyState: string | null, placeOfSupply: string | null) => {
    const inter = Boolean(agencyState && placeOfSupply && agencyState !== placeOfSupply);
    if (inter) return { cgst: 0, sgst: 0, igst: gst };
    const half = Math.floor(gst / 2);
    return { cgst: gst - half, sgst: half, igst: 0 };
};

// ---------------------------------------------------------------- numbering

export const nextTravelNumber = async (model: any, field: string, agencyUuid: string, prefix: string, t?: any) => {
    const count = await model.count({ where: { agency_uuid: agencyUuid, [field]: { [Op.like]: `${prefix}-%` } }, paranoid: false, transaction: t });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

// ---------------------------------------------------------------- who sees cost and margin (QT-02)

export const seesCost = (req: RequestWithUser) => {
    // set by travelGuard from the agency's permission matrix
    const fromMatrix = (req as any).travelSeesCost;
    if (typeof fromMatrix === "boolean") return fromMatrix;
    const a = accessOf(req);
    return a.isOwner || a.teamRole === "accounts" || a.teamRole === "branch_manager";
};

/** Remove cost, markup and profit from an object tree for roles that may not see them. */
const COST_KEYS = new Set(["unit_cost", "cost", "markup", "markup_type", "markup_value", "profit", "cost_total", "total_cost", "supplier_paid", "supplier_payments", "supplier_due", "supplier_overdue", "profit_this_month", "supplier_payable", "supplier_paid_total", "line_cost", "line_markup"]);
export const redactCost = <T>(value: T, req: RequestWithUser): T => {
    if (seesCost(req)) return value;
    const walk = (v: any): any => {
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === "object" && !(v instanceof Date)) {
            const out: any = {};
            for (const [k, x] of Object.entries(v)) if (!COST_KEYS.has(k)) out[k] = walk(x);
            return out;
        }
        return v;
    };
    return walk(value);
};
