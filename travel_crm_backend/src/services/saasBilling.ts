import { Op } from "sequelize";
import Agent from "../model/Agent";
import PlatformSetting from "../model/PlatformSetting";
import SaasCoupon from "../model/SaasCoupon";
import SaasPayment from "../model/SaasPayment";
import SaasPlan from "../model/SaasPlan";
import { parseJsonValue } from "../helpers/json";
import { SaasError } from "./saasError";

/**
 * Money side of subscriptions: platform GST details, agency billing details, coupons, price quotes
 * and GST tax invoices.
 *
 * Amounts are paise. A plan price is either GST-inclusive (default, what the agency pays is the plan price)
 * or GST-exclusive (GST is added at checkout) - see billing.prices_include_gst.
 * Invoices are fixed when a payment becomes paid (seller/buyer are copied onto the payment), so later
 * changes to settings never change an old invoice.
 */

export const GST_STATES: Record<string, string> = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
    "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
    "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/;

export interface PlatformBilling {
    legal_name: string;
    gstin: string;
    address: string;
    state_code: string;
    email: string;
    phone: string;
    sac_code: string;
    gst_percent: number;
    prices_include_gst: boolean;
    invoice_prefix: string;
    terms: string;
}

const DEFAULT_BILLING: PlatformBilling = {
    legal_name: "", gstin: "", address: "", state_code: "", email: "", phone: "",
    sac_code: "998315", gst_percent: 18, prices_include_gst: true, invoice_prefix: "INV", terms: "",
};

export const getPlatformBilling = async (): Promise<PlatformBilling> => {
    const row: any = await PlatformSetting.findOne({ where: { key: "billing" } });
    const v = parseJsonValue(row?.get("value")) || {};
    return {
        ...DEFAULT_BILLING,
        ...v,
        legal_name: v.legal_name || process.env.SAAS_LEGAL_NAME || "",
        email: v.email || process.env.SAAS_SUPPORT_EMAIL || "",
        phone: v.phone || process.env.SAAS_SUPPORT_PHONE || "",
        gst_percent: Number.isFinite(Number(v.gst_percent)) ? Number(v.gst_percent) : DEFAULT_BILLING.gst_percent,
        prices_include_gst: v.prices_include_gst === undefined ? true : Boolean(v.prices_include_gst),
    };
};

export const savePlatformBilling = async (body: any) => {
    const gstin = String(body?.gstin || "").trim().toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) throw new SaasError("GSTIN should be 15 characters, e.g. 24ABCDE1234F1Z5");
    const gst = Number(body?.gst_percent ?? 18);
    if (!Number.isFinite(gst) || gst < 0 || gst > 28) throw new SaasError("GST % must be between 0 and 28");
    let state = String(body?.state_code || "").trim();
    if (gstin) state = gstin.slice(0, 2);
    if (state && !GST_STATES[state]) throw new SaasError("Please choose a valid state");
    const prefix = String(body?.invoice_prefix || "INV").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "INV";
    const value: PlatformBilling = {
        legal_name: String(body?.legal_name || "").trim().slice(0, 255),
        gstin,
        address: String(body?.address || "").trim().slice(0, 1000),
        state_code: state,
        email: String(body?.email || "").trim().slice(0, 255),
        phone: String(body?.phone || "").trim().slice(0, 50),
        sac_code: String(body?.sac_code || "998315").trim().replace(/[^0-9]/g, "").slice(0, 8) || "998315",
        gst_percent: gst,
        prices_include_gst: body?.prices_include_gst === undefined ? true : Boolean(body.prices_include_gst),
        invoice_prefix: prefix,
        terms: String(body?.terms || "").trim().slice(0, 2000),
    };
    const [row]: any = await PlatformSetting.findOrCreate({ where: { key: "billing" }, defaults: { key: "billing", value } });
    await row.update({ value });
    return value;
};

// ---------------------------------------------------------------- agency (buyer) details

const readJson = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw) || {}; } catch { return {}; }
};

/**
 * The agency's billing details live in Agent.billing_settings (shared with its client invoices).
 * Pass the transaction when the agency may have been created in it (e.g. invoice issued while creating the agency).
 */
export const getAgencyBilling = async (agencyUuid: string, t?: any) => {
    const agency: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["uuid", "username", "app_name", "email", "phone_number", "country_code", "agency_address", "billing_settings"],
        ...(t ? { transaction: t } : {}),
    });
    if (!agency) throw new SaasError("Agency not found");
    const a = agency.dataValues;
    const b = readJson(a.billing_settings);
    const gstin = String(b.gstin || "").toUpperCase();
    return {
        legal_name: b.legal_name || a.app_name || a.username || "",
        gstin,
        address: b.address || a.agency_address || "",
        state_code: gstin ? gstin.slice(0, 2) : String(b.state_code || ""),
        email: a.email || "",
        phone: a.phone_number ? `${a.country_code || "+91"} ${a.phone_number}` : "",
    };
};

export const saveAgencyBilling = async (agencyUuid: string, body: any) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "billing_settings"] });
    if (!agency) throw new SaasError("Agency not found");
    const gstin = String(body?.gstin || "").trim().toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) throw new SaasError("GSTIN should be 15 characters, e.g. 24ABCDE1234F1Z5");
    let state = String(body?.state_code || "").trim();
    if (gstin) state = gstin.slice(0, 2);
    if (state && !GST_STATES[state]) throw new SaasError("Please choose a valid state");
    const current = readJson(agency.dataValues.billing_settings);
    const next = {
        ...current,
        legal_name: String(body?.legal_name || "").trim().slice(0, 255),
        gstin,
        address: String(body?.address || "").trim().slice(0, 1000),
        state_code: state,
    };
    await Agent.update({ billing_settings: JSON.stringify(next) }, { where: { id: agency.dataValues.id } });
    return getAgencyBilling(agencyUuid);
};

// ---------------------------------------------------------------- coupons

export const normalizeCode = (code: any) => String(code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);

export const couponUses = async (couponId: number, agencyUuid?: string) =>
    SaasPayment.count({ where: { coupon_id: couponId, status: "paid", ...(agencyUuid ? { agency_uuid: agencyUuid } : {}) } });

/** Throws a friendly SaasError when the code can not be used for this agency / plan / billing. */
export const findUsableCoupon = async (rawCode: any, agencyUuid: string, planId: number, billing: "monthly" | "yearly") => {
    const code = normalizeCode(rawCode);
    if (!code) return null;
    const coupon: any = await SaasCoupon.findOne({ where: { code } });
    const c = coupon?.dataValues;
    if (!c || c.status !== "active") throw new SaasError("This coupon code is not valid");
    const now = Date.now();
    if (c.valid_from && new Date(c.valid_from).getTime() > now) throw new SaasError("This coupon is not active yet");
    if (c.valid_until && new Date(c.valid_until).getTime() < now) throw new SaasError("This coupon has expired");
    const plans = coupon.get("plan_ids");
    if (Array.isArray(plans) && plans.length && !plans.map(Number).includes(Number(planId))) throw new SaasError("This coupon is not valid for this plan");
    if (c.billing !== "any" && c.billing !== billing) throw new SaasError(`This coupon is only for ${c.billing} billing`);
    if (c.max_uses && (await couponUses(c.id)) >= c.max_uses) throw new SaasError("This coupon has been fully used");
    if (c.per_agency_limit && (await couponUses(c.id, agencyUuid)) >= c.per_agency_limit) throw new SaasError("You have already used this coupon");
    return coupon;
};

const discountFor = (coupon: any, listPaise: number) => {
    if (!coupon) return 0;
    const c = coupon.dataValues || coupon;
    let d = c.kind === "flat" ? Number(c.value) * 100 : Math.round((listPaise * Number(c.value)) / 100);
    if (c.kind === "percent" && c.max_discount) d = Math.min(d, Number(c.max_discount) * 100);
    return Math.max(0, Math.min(d, listPaise));
};

export const describeCoupon = (coupon: any) => {
    const c = coupon?.dataValues || coupon;
    if (!c) return null;
    const off = c.kind === "flat" ? `Rs ${Number(c.value).toLocaleString("en-IN")} off` : `${c.value}% off${c.max_discount ? ` (up to Rs ${Number(c.max_discount).toLocaleString("en-IN")})` : ""}`;
    return { code: c.code, label: off, description: c.description || null };
};

// ---------------------------------------------------------------- quote

/** Package price for a plan (6 mo → price_monthly, 12 mo → price_yearly). */
export const planPackagePrice = (plan: any) => {
    const p = plan?.dataValues || plan || {};
    const duration = Number(p.duration_months);
    if (duration === 12) return Number(p.price_yearly) || Number(p.price_monthly) || 0;
    if (duration === 6) return Number(p.price_monthly) || Number(p.price_yearly) || 0;
    return 0;
};

/** Price of a plan for an agency, with an optional coupon. Uses plan duration (6/12 months). */
export const quotePlan = async (agencyUuid: string, planUuid: string, billing: "monthly" | "yearly", couponCode?: any) => {
    const plan: any = await SaasPlan.findOne({ where: { uuid: planUuid, status: "active" } });
    if (!plan) throw new SaasError("Plan not found");
    const duration = Number(plan.dataValues.duration_months);
    const months = duration === 6 || duration === 12 ? duration : (billing === "yearly" ? 12 : 1);
    const effectiveBilling: "monthly" | "yearly" = months === 12 ? "yearly" : "monthly";
    const rupees = planPackagePrice(plan) || (billing === "yearly" ? Number(plan.dataValues.price_yearly) : Number(plan.dataValues.price_monthly));
    if (!rupees || rupees <= 0) throw new SaasError("This plan can not be bought online. Please contact us.");
    const settings = await getPlatformBilling();
    const coupon = await findUsableCoupon(couponCode, agencyUuid, plan.dataValues.id, effectiveBilling);
    const list = rupees * 100;
    const discount = discountFor(coupon, list);
    const afterDiscount = list - discount;
    const gstAdded = settings.prices_include_gst ? 0 : Math.round((afterDiscount * settings.gst_percent) / 100);
    const total = afterDiscount + gstAdded;
    return {
        plan,
        coupon,
        months,
        list_amount: list,
        discount,
        gst_added: gstAdded,
        total,
        view: {
            plan_name: plan.dataValues.name,
            billing: effectiveBilling,
            months,
            price: list / 100,
            discount: discount / 100,
            gst_percent: settings.gst_percent,
            prices_include_gst: settings.prices_include_gst,
            gst_added: gstAdded / 100,
            total: total / 100,
            coupon: describeCoupon(coupon),
        },
    };
};

// ---------------------------------------------------------------- invoices

/** Indian financial year label of a date, e.g. 2026-11-12 -> "26-27". */
export const financialYear = (d: Date) => {
    const y = d.getFullYear() % 100, m = d.getMonth();
    const start = m >= 3 ? y : (y + 99) % 100;
    return `${String(start).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
};

const nextInvoiceNumber = async (prefix: string, date: Date, t: any) => {
    const fy = financialYear(date);
    const key = `invoice_counter_${fy}`;
    await PlatformSetting.findOrCreate({ where: { key }, defaults: { key, value: { last: 0 } }, transaction: t });
    const row: any = await PlatformSetting.findOne({ where: { key }, transaction: t, lock: t.LOCK.UPDATE });
    const last = Number(parseJsonValue(row.get("value"))?.last) || 0;
    const next = last + 1;
    await row.update({ value: { last: next } }, { transaction: t });
    return `${prefix}/${fy}/${String(next).padStart(4, "0")}`; // GST allows 16 characters: prefix (max 5) + "/" + "26-27" + "/" + 4 digits
};

/** GST split of a GST-inclusive total. Inter-state (IGST) when buyer and seller states differ. */
export const splitGst = (totalPaise: number, gstPercent: number, sellerState: string, buyerState: string) => {
    const taxable = gstPercent > 0 ? Math.round((totalPaise * 100) / (100 + gstPercent)) : totalPaise;
    const tax = totalPaise - taxable;
    const inter = Boolean(sellerState && buyerState && sellerState !== buyerState);
    const cgst = inter ? 0 : Math.floor(tax / 2);
    return { taxable, cgst, sgst: inter ? 0 : tax - cgst, igst: inter ? tax : 0, inter };
};

/**
 * Give a paid payment its tax invoice (number + seller/buyer copy + GST split). Safe to call twice.
 * Call inside the transaction that marks the payment paid; also used lazily for older payments.
 */
export const issueInvoice = async (paymentId: number, t: any) => {
    const payment: any = await SaasPayment.findOne({ where: { id: paymentId }, transaction: t, lock: t.LOCK.UPDATE });
    const p = payment?.dataValues;
    if (!p || p.status !== "paid" || p.invoice_number || !(Number(p.amount) > 0)) return payment;
    const seller = await getPlatformBilling();
    const buyer = await getAgencyBilling(p.agency_uuid, t);
    const date = p.paid_at ? new Date(p.paid_at) : new Date();
    const split = splitGst(Number(p.amount), seller.gst_percent, seller.state_code, buyer.state_code);
    const plan: any = p.plan_id ? await SaasPlan.findByPk(p.plan_id, { transaction: t }) : null;
    const number = await nextInvoiceNumber(seller.invoice_prefix, date, t);
    await SaasPayment.update({
        invoice_number: number,
        invoice_date: date,
        gst_percent: seller.gst_percent,
        taxable_amount: split.taxable,
        cgst: split.cgst, sgst: split.sgst, igst: split.igst,
        seller: { ...seller, state_name: GST_STATES[seller.state_code] || "" },
        buyer: { ...buyer, state_name: GST_STATES[buyer.state_code] || "", plan_name: plan?.dataValues?.name || null },
    }, { where: { id: p.id }, transaction: t });
    return SaasPayment.findOne({ where: { id: p.id }, transaction: t });
};

/** Invoice as shown on screen / printed (rupees). */
export const presentInvoice = (payment: any) => {
    const x = payment.toJSON ? payment.toJSON() : payment;
    const r = (v: any) => Number(v || 0) / 100;
    const seller = parseJsonValue(x.seller) || {}, buyer = parseJsonValue(x.buyer) || {};
    const months = Number(x.months) || null;
    return {
        id: x.uuid,
        number: x.invoice_number,
        date: x.invoice_date,
        seller,
        buyer,
        item: {
            description: `${buyer.plan_name || x.plan?.name || "Subscription"} plan${months ? ` - ${months === 12 ? "1 year" : `${months} month${months > 1 ? "s" : ""}`}` : ""}`,
            sac: seller.sac_code || "998315",
        },
        list_amount: x.list_amount ? r(x.list_amount) : null,
        discount: r(x.discount),
        coupon_code: x.coupon_code || null,
        taxable: r(x.taxable_amount),
        gst_percent: Number(x.gst_percent) || 0,
        cgst: r(x.cgst), sgst: r(x.sgst), igst: r(x.igst),
        total: r(x.amount),
        method: x.method,
        reference: x.razorpay_payment_id || x.reference || null,
        paid_at: x.paid_at,
    };
};

/** Paid payment of an agency (or any agency for admin) with its invoice, issuing it if missing. */
export const loadInvoice = async (paymentUuid: string, agencyUuid: string | null, sequelizeInstance: any) => {
    const where: any = { uuid: paymentUuid, status: "paid", amount: { [Op.gt]: 0 } };
    if (agencyUuid) where.agency_uuid = agencyUuid;
    const payment: any = await SaasPayment.findOne({ where });
    if (!payment) throw new SaasError("Invoice not found");
    if (!payment.dataValues.invoice_number) await sequelizeInstance.transaction((t: any) => issueInvoice(payment.dataValues.id, t));
    const fresh: any = await SaasPayment.findOne({ where: { id: payment.dataValues.id }, include: [{ model: SaasPlan, as: "plan", attributes: ["name"], required: false }] });
    return presentInvoice(fresh);
};
