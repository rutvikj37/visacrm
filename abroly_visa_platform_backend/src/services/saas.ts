import axios from "axios";
import { notifyLater } from "./notifications";
import crypto from "crypto";
import { NextFunction, Response } from "express";
import { Op } from "sequelize";
import sequelize from "../config/dbconfig";
import Agent from "../model/Agent";
import SaasPlan from "../model/SaasPlan";
import SaasSubscription from "../model/SaasSubscription";
import SaasPayment from "../model/SaasPayment";
import { RequestWithUser } from "../utils/types";
import { returnHelper } from "../helpers/returnHelper";

/**
 * SaaS access for agencies.
 *
 * Access is still decided by Agent.expires_at (checked in authMiddleware). This service keeps it in step
 * with plans, trials and payments, and checks plan limits.
 *
 *   trial          - assigned by the platform admin (custom number of days)
 *   paid           - admin recorded a payment, or the agency paid with Razorpay
 *   complimentary  - admin gave free time
 *
 * Razorpay env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 */

import { SaasError } from "./saasError";
import { issueInvoice, quotePlan } from "./saasBilling";
export { SaasError };

export const LEAD_SOURCE_FEATURES = [
    { key: "website", label: "Website forms" },
    { key: "csv", label: "CSV / Excel import" },
    { key: "indiamart", label: "IndiaMART" },
    { key: "facebook", label: "Facebook / Instagram Lead Ads" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "instagram", label: "Instagram DMs" },
    { key: "google", label: "Google Ads lead forms" },
    { key: "justdial", label: "Justdial" },
    { key: "sulekha", label: "Sulekha" },
];

export const ADDON_FEATURES = [
    { key: "jobs", label: "Job posts" },
    { key: "side_banner", label: "Achievement banners" },
    { key: "service_requests", label: "Health insurance & SIM card requests" },
    { key: "event_banners", label: "Event banners" },
    { key: "language_prep", label: "Language preparation" },
];

const SOURCE_KEYS = LEAD_SOURCE_FEATURES.map((f) => f.key);
const ADDON_KEYS = ADDON_FEATURES.map((f) => f.key);
const DAY = 24 * 60 * 60 * 1000;

export const cleanFeatures = (raw: any) => ({
    sources: Array.isArray(raw?.sources) ? raw.sources.filter((k: string) => SOURCE_KEYS.includes(k)) : [],
    addons: Array.isArray(raw?.addons) ? raw.addons.filter((k: string) => ADDON_KEYS.includes(k)) : [],
});

/** Default plans: 6 and 12 months, full features. */
const DEFAULT_PLANS = [
    {
        name: "6 Months",
        description: "Full CRM access for 6 months.",
        price_monthly: 19999,
        price_yearly: 0,
        duration_months: 6,
        max_team_members: null,
        sort_order: 1,
        features: { sources: SOURCE_KEYS, addons: ADDON_KEYS },
        status: "active",
    },
    {
        name: "12 Months",
        description: "Full CRM access for 12 months.",
        price_monthly: 0,
        price_yearly: 24999,
        duration_months: 12,
        max_team_members: null,
        sort_order: 2,
        features: { sources: SOURCE_KEYS, addons: ADDON_KEYS },
        status: "active",
    },
];

const OLD_DEFAULT_NAMES = ["Starter", "Growth", "Pro"];

/** Create the 6/12 month plans if missing; keep them full-featured; retire old Starter/Growth/Pro. */
export const ensureDefaultPlans = async () => {
    const keptIds: number[] = [];
    for (const plan of DEFAULT_PLANS) {
        const existing: any = await SaasPlan.findOne({ where: { name: plan.name }, paranoid: false });
        if (!existing) {
            const created: any = await SaasPlan.create(plan as any);
            keptIds.push(created.dataValues.id);
            continue;
        }
        if (existing.dataValues.deletedAt) await existing.restore();
        await existing.update({
            description: plan.description,
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly,
            duration_months: plan.duration_months,
            max_team_members: null,
            features: plan.features,
            status: "active",
            sort_order: plan.sort_order,
        });
        keptIds.push(existing.dataValues.id);
    }

    const twelve: any = await SaasPlan.findOne({ where: { name: "12 Months" } });
    const oldPlans: any[] = await SaasPlan.findAll({ where: { name: OLD_DEFAULT_NAMES }, paranoid: false });
    const oldIds = oldPlans.map((p) => p.dataValues.id);
    if (twelve && oldIds.length) {
        await Agent.update({ saas_plan_id: twelve.dataValues.id }, { where: { role: "agent", saas_plan_id: oldIds } });
    }
    if (oldIds.length) await SaasPlan.destroy({ where: { id: oldIds } });
};

export const presentPlan = (plan: any) => {
    if (!plan) return null;
    const p = plan.toJSON ? plan.toJSON() : plan;
    const duration = p.duration_months == null ? null : Number(p.duration_months);
    return {
        id: p.uuid,
        name: p.name,
        description: p.description,
        price_monthly: Number(p.price_monthly) || 0,
        price_yearly: Number(p.price_yearly) || 0,
        duration_months: Number.isFinite(duration) && duration! > 0 ? duration : null,
        max_team_members: p.max_team_members === null || p.max_team_members === undefined ? null : Number(p.max_team_members),
        features: cleanFeatures(p.features),
        status: p.status,
        sort_order: p.sort_order,
    };
};

/** Suggested package price for recording a manual payment. */
export const planPackagePrice = (plan: any) => {
    const p = plan?.toJSON ? plan.toJSON() : plan;
    if (!p) return 0;
    const months = Number(p.duration_months || 0);
    if (months === 12) return Number(p.price_yearly || p.price_monthly || 0);
    if (months > 0) return Number(p.price_monthly || 0);
    return Number(p.price_monthly || 0);
};

const findAgency = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" } });
    if (!agency) throw new SaasError("Agency not found");
    return agency;
};

/** What an agency has right now. */
export const getAgencyAccess = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["id", "uuid", "username", "expires_at", "saas_plan_id", "saas_kind", "status"],
    });
    if (!agency) return null;
    const plan: any = agency.dataValues.saas_plan_id ? await SaasPlan.findByPk(agency.dataValues.saas_plan_id) : null;
    const endsAt = agency.dataValues.expires_at ? new Date(agency.dataValues.expires_at) : null;
    const msLeft = endsAt ? endsAt.getTime() - Date.now() : -1;
    const teamCount = await Agent.count({ where: { parent_id: agency.dataValues.id } });
    return {
        agency_id: agency.dataValues.id,
        plan: presentPlan(plan),
        kind: agency.dataValues.saas_kind,
        ends_at: endsAt,
        expired: msLeft <= 0,
        days_left: msLeft > 0 ? Math.ceil(msLeft / DAY) : 0,
        team_count: teamCount,
        status: agency.dataValues.status,
    };
};

/** Save a new access period and move the agency's expiry date. */
export const applyPeriod = async (opts: {
    agencyUuid: string;
    planId: number | null;
    kind: "trial" | "paid" | "complimentary";
    startsAt: Date;
    endsAt: Date;
    paymentId?: number | null;
    note?: string | null;
    adminId?: number | null;
    transaction?: any;
}) => {
    if (opts.endsAt <= opts.startsAt) throw new SaasError("End date must be after the start date");
    const t = opts.transaction;
    const sub: any = await SaasSubscription.create({
        agency_uuid: opts.agencyUuid,
        plan_id: opts.planId,
        kind: opts.kind,
        starts_at: opts.startsAt,
        ends_at: opts.endsAt,
        payment_id: opts.paymentId || null,
        note: opts.note || null,
        created_by_admin: opts.adminId || null,
    }, { transaction: t });
    await Agent.update(
        { expires_at: opts.endsAt, saas_plan_id: opts.planId, saas_kind: opts.kind },
        { where: { uuid: opts.agencyUuid, role: "agent" }, transaction: t },
    );
    return sub;
};

/** Paid time is added after the current end date (so renewing early never loses days). */
export const extensionStart = (agency: any) => {
    const current = agency?.dataValues?.expires_at ? new Date(agency.dataValues.expires_at) : null;
    return current && current.getTime() > Date.now() ? current : new Date();
};

export const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0); // 31 Jan + 1 month = 28/29 Feb
    return d;
};

export const assignTrial = async (agencyUuid: string, planId: number | null, days: number, adminId: number, note?: string) => {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new SaasError("Trial days must be between 1 and 365");
    await findAgency(agencyUuid);
    const start = new Date();
    return applyPeriod({ agencyUuid, planId, kind: "trial", startsAt: start, endsAt: new Date(start.getTime() + days * DAY), note: note || `Free trial: ${days} days`, adminId });
};

// ---------------------------------------------------------------- limits

const planFor = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "saas_plan_id"] });
    if (!agency) return { agency: null, plan: null };
    const plan = agency.dataValues.saas_plan_id ? presentPlan(await SaasPlan.findByPk(agency.dataValues.saas_plan_id)) : null;
    return { agency, plan };
};

/**
 * Agencies without a plan (created before plans existed) keep full access, so nothing breaks
 * for them until the admin assigns a plan.
 */
export const assertSourceAllowed = async (agencyUuid: string, source: string) => {
    const { plan } = await planFor(agencyUuid);
    if (!plan) return;
    if (!plan.features.sources.includes(source)) {
        const label = LEAD_SOURCE_FEATURES.find((f) => f.key === source)?.label || source;
        throw new SaasError(`${label} is not included in your ${plan.name} plan. Please upgrade to use it.`);
    }
};

export const assertTeamLimit = async (agencyUuid: string) => {
    const { agency, plan } = await planFor(agencyUuid);
    if (!agency || !plan || plan.max_team_members === null) return;
    const count = await Agent.count({ where: { parent_id: agency.dataValues.id } });
    if (count >= plan.max_team_members) {
        throw new SaasError(`Your ${plan.name} plan allows ${plan.max_team_members} team member(s). Please upgrade to add more.`);
    }
};

/** Express middleware for add-on modules (use after validateAgent). */
export const requireAddon = (key: string) => async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
        const agencyUuid = (req.user?.user as any)?.agent_uuid;
        if (!agencyUuid) return next();
        const { plan } = await planFor(agencyUuid);
        if (plan && !plan.features.addons.includes(key)) {
            const label = ADDON_FEATURES.find((f) => f.key === key)?.label || key;
            return returnHelper(res, 200, false, `${label} is a paid add-on and is not included in your ${plan.name} plan.`);
        }
        return next();
    } catch (error) {
        return next();
    }
};

// ---------------------------------------------------------------- Razorpay

const razorpay = () => ({
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    base: (process.env.RAZORPAY_API_BASE || "https://api.razorpay.com").replace(/\/+$/, ""),
});

export const razorpayEnabled = () => Boolean(razorpay().keyId && razorpay().keySecret);

/**
 * Start an online payment for a plan (optional coupon). A coupon that makes it free (100% off) activates
 * the plan straight away without Razorpay.
 */
export const createRazorpayOrder = async (agencyUuid: string, planUuid: string, billing: "monthly" | "yearly", couponCode?: any) => {
    const quote = await quotePlan(agencyUuid, planUuid, billing, couponCode);
    const plan = quote.plan;
    const base = {
        agency_uuid: agencyUuid, plan_id: plan.dataValues.id, months: quote.months, currency: "INR",
        list_amount: quote.list_amount, discount: quote.discount,
        coupon_id: quote.coupon ? quote.coupon.dataValues.id : null, coupon_code: quote.coupon ? quote.coupon.dataValues.code : null,
    };

    if (quote.total <= 0) {
        const end = await sequelize.transaction(async (t: any) => {
            const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, transaction: t, lock: t.LOCK.UPDATE });
            if (!agency) throw new SaasError("Agency not found");
            const start = extensionStart(agency);
            const ends = addMonths(start, quote.months);
            const payment: any = await SaasPayment.create({ ...base, amount: 0, method: "other", status: "paid", paid_at: new Date(), note: `Coupon ${base.coupon_code} (100% off)` }, { transaction: t });
            await applyPeriod({ agencyUuid, planId: plan.dataValues.id, kind: "paid", startsAt: start, endsAt: ends, paymentId: payment.dataValues.id, note: `Coupon ${base.coupon_code}`, transaction: t });
            return ends;
        });
        return { free: true, ends_at: end, plan_name: plan.dataValues.name, months: quote.months, quote: quote.view };
    }

    if (!razorpayEnabled()) throw new SaasError("Online payment is not available yet. Please contact us to renew.");
    const payment: any = await SaasPayment.create({ ...base, amount: quote.total, method: "razorpay", status: "created" });
    const { keyId, keySecret, base: apiBase } = razorpay();
    try {
        const { data } = await axios.post(`${apiBase}/v1/orders`, {
            amount: quote.total,
            currency: "INR",
            receipt: `saas_${payment.dataValues.id}`,
            notes: { agency_uuid: agencyUuid, plan: plan.dataValues.name, months: String(quote.months), payment_uuid: payment.dataValues.uuid, coupon: base.coupon_code || "" },
        }, { auth: { username: keyId, password: keySecret }, timeout: 20000 });
        await SaasPayment.update({ razorpay_order_id: data.id }, { where: { id: payment.dataValues.id } });
        return { order_id: data.id, amount: data.amount, currency: data.currency, key_id: keyId, plan_name: plan.dataValues.name, months: quote.months, quote: quote.view };
    } catch (error: any) {
        await SaasPayment.update({ status: "failed", note: "Order creation failed", failure_reason: "Could not start the payment", failed_at: new Date(), resolved: true }, { where: { id: payment.dataValues.id } });
        throw new SaasError(error?.response?.data?.error?.description || "Could not start the payment. Please try again.");
    }
};

const safeEqualHex = (a: string, b: string) =>
    a.length === b.length && /^[a-f0-9]+$/i.test(a) && crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

/** Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export const verifyCheckoutSignature = (orderId: string, paymentId: string, signature: string) => {
    const expected = crypto.createHmac("sha256", razorpay().keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    return safeEqualHex(String(signature || ""), expected);
};

export const verifyRazorpayWebhook = (rawBody: Buffer | undefined, signature: string | undefined) => {
    const secret = razorpay().webhookSecret;
    if (!secret || !rawBody || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqualHex(signature, expected);
};

/** Mark an order paid and extend the agency. Safe to call twice (checkout + webhook). */
export const fulfillRazorpayOrder = async (orderId: string, paymentId: string, amountPaise?: number) => {
    return sequelize.transaction(async (t: any) => {
        const payment: any = await SaasPayment.findOne({ where: { razorpay_order_id: orderId }, transaction: t, lock: t.LOCK.UPDATE });
        if (!payment) throw new SaasError("Payment not found");
        if (payment.dataValues.status === "paid") return { already: true, payment };
        if (amountPaise !== undefined && Number(amountPaise) !== Number(payment.dataValues.amount)) {
            throw new SaasError("Paid amount does not match the order");
        }
        const agency: any = await Agent.findOne({ where: { uuid: payment.dataValues.agency_uuid, role: "agent" }, transaction: t });
        if (!agency) throw new SaasError("Agency not found");
        const start = extensionStart(agency);
        const end = addMonths(start, Number(payment.dataValues.months) || 1);
        await SaasPayment.update(
            { status: "paid", razorpay_payment_id: paymentId, paid_at: new Date() },
            { where: { id: payment.dataValues.id }, transaction: t },
        );
        await applyPeriod({
            agencyUuid: payment.dataValues.agency_uuid,
            planId: payment.dataValues.plan_id,
            kind: "paid",
            startsAt: start,
            endsAt: end,
            paymentId: payment.dataValues.id,
            note: `Online payment (Razorpay ${paymentId})`,
            transaction: t,
        });
        await issueInvoice(payment.dataValues.id, t);
        // an earlier failed attempt of this agency is now settled
        await SaasPayment.update({ resolved: true }, { where: { agency_uuid: payment.dataValues.agency_uuid, status: "failed", resolved: false }, transaction: t });
        notifyLater({
            agencyUuid: payment.dataValues.agency_uuid, recipientIds: [agency.dataValues.id], type: "payment_received",
            title: "Payment received - thank you!",
            body: `Rs ${(Number(payment.dataValues.amount) / 100).toLocaleString("en-IN")} received. Your access is extended until ${end.toDateString()}.`,
            link: "/subscription", email: true,
        });
        return { already: false, payment, ends_at: end };
    });
};

/** Agencies whose access ends within `days` (for the admin dashboard). */
export const expiringSoon = (days: number) =>
    Agent.count({ where: { role: "agent", expires_at: { [Op.between]: [new Date(), new Date(Date.now() + days * DAY)] } } });
