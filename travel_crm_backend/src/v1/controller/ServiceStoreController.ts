import crypto from "crypto";
import axios from "axios";
import { Response } from "express";
import { Op, fn, col } from "sequelize";
import sequelize from "../../config/dbconfig";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf } from "../../helpers/access";
import { decryptJson, encryptJson, maskSecret } from "../../helpers/crypto";
import Agent from "../../model/Agent";
import User from "../../model/User";
import AgencyLeads from "../../model/AgencyLeads";
import AgencyBranch from "../../model/AgencyBranch";
import AgencyService from "../../model/AgencyService";
import ClientInvoice from "../../model/ClientInvoice";
import ClientPayment from "../../model/ClientPayment";
import ServiceOrder from "../../model/ServiceOrder";
import { audit } from "../../services/audit";
import { notifyLater, agencyOwnerId } from "../../services/notifications";
import { studentPortalUrl } from "../../services/leadConversion";
import { createOrderForInvoice } from "./ServiceOrderController";
import { RZP, canManage, nextNumber, readBilling, recordPayment, toPaise, toRupees } from "./FeesController";

/**
 * Services store: an agency sells its own services (coaching, SOP writing, visa file charges ...) to its students.
 * The student buys in the student portal and pays with Razorpay Checkout on the AGENCY's own Razorpay account.
 * Flow: student asks for an order -> Razorpay order (notes carry service + student) -> Checkout -> verify signature
 * -> a paid GST invoice in Client fees (service_id set) with its receipt. Nothing is written before the payment
 * is verified, so abandoned checkouts leave no unpaid invoices behind.
 */

const today = () => new Date().toISOString().slice(0, 10);

const present = (s: any, stats?: { sold: number; revenue: number }) => {
    const d = s.dataValues || s;
    const price = Number(d.price);
    const gst = Number(d.gst_percent || 0);
    const gstAmount = Math.round((price * gst) / 100);
    return {
        id: d.uuid, name: d.name, category: d.category, description: d.description, delivery: d.delivery,
        price: toRupees(price), gst_percent: gst, gst_amount: toRupees(gstAmount), total: toRupees(price + gstAmount),
        active: Boolean(d.active), sort_order: d.sort_order,
        ...(stats ? { sold: stats.sold, revenue: toRupees(stats.revenue) } : {}),
    };
};

/** The agency's Razorpay keys, decrypted (null when not set up). */
const agencyKeys = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["billing_credentials"] });
    const c = decryptJson<{ key_id: string; key_secret: string }>(agency?.dataValues?.billing_credentials);
    return c?.key_id && c?.key_secret ? c : null;
};

const rzpError = (error: any) => error?.response?.data?.error?.description || error?.message || "request failed";

class ServiceStoreController {
    // ------------------------------------------------------------------ agency panel

    // GET /crm/services  - the agency's services with sales, and whether Razorpay is ready
    async list(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const rows: any[] = await AgencyService.findAll({ where: { agency_uuid: a.agencyUuid }, order: [["sort_order", "ASC"], ["id", "ASC"]] });
            const sales: any[] = rows.length ? await ClientInvoice.findAll({
                where: { agency_uuid: a.agencyUuid, service_id: rows.map((r) => r.dataValues.id), status: { [Op.ne]: "cancelled" } },
                attributes: ["service_id", [fn("COUNT", col("id")), "sold"], [fn("SUM", col("amount_paid")), "revenue"]],
                group: ["service_id"], raw: true,
            }) : [];
            const bySvc = new Map(sales.map((x) => [Number(x.service_id), { sold: Number(x.sold), revenue: Number(x.revenue || 0) }]));
            const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
            const last30: any = await ClientInvoice.findOne({
                where: { agency_uuid: a.agencyUuid, service_id: { [Op.ne]: null }, status: { [Op.ne]: "cancelled" }, createdAt: { [Op.gte]: since } },
                attributes: [[fn("COUNT", col("id")), "orders"], [fn("SUM", col("amount_paid")), "revenue"]], raw: true,
            });
            const { base } = await studentPortalUrl(a.agencyUuid);
            return returnHelper(res, 200, true, "Services", {
                services: rows.map((r) => present(r, bySvc.get(r.dataValues.id) || { sold: 0, revenue: 0 })),
                razorpay_ready: Boolean(await agencyKeys(a.agencyUuid)),
                portal_url: base ? `${base}/services` : null,
                last_30_days: { orders: Number(last30?.orders || 0), revenue: toRupees(last30?.revenue || 0) },
                can_manage: canManage(req),
            });
        } catch (error) {
            console.error("services list failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/services { id?, name, category?, description?, delivery?, price, gst_percent?, active?, sort_order? }  (owner / accounts)
    async save(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can change services");
            const b = req.body || {};
            const name = String(b.name || "").trim().slice(0, 255);
            if (!name) return returnHelper(res, 200, false, "Please enter the service name");
            const price = toPaise(b.price);
            if (!Number.isFinite(price) || price < 100) return returnHelper(res, 200, false, "Price must be at least Rs 1");
            if (price > 100000000) return returnHelper(res, 200, false, "Price is too high");
            const gst = Number(b.gst_percent || 0);
            if (!Number.isFinite(gst) || gst < 0 || gst > 28) return returnHelper(res, 200, false, "GST % must be between 0 and 28");
            const values = {
                name, price, gst_percent: gst,
                category: b.category ? String(b.category).trim().slice(0, 60) : null,
                description: b.description ? String(b.description).trim().slice(0, 3000) : null,
                delivery: b.delivery ? String(b.delivery).trim().slice(0, 120) : null,
                active: b.active !== false,
                sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0,
            };
            if (b.id) {
                const s: any = await AgencyService.findOne({ where: { uuid: String(b.id), agency_uuid: a.agencyUuid } });
                if (!s) return returnHelper(res, 200, false, "Service not found");
                await AgencyService.update(values, { where: { id: s.dataValues.id } });
                audit(req, { entity: "settings", entityId: s.dataValues.id, action: "service_updated", summary: `Service updated: ${name} - Rs ${toRupees(price).toLocaleString("en-IN")}${values.active ? "" : " (hidden)"}` });
                return returnHelper(res, 200, true, "Service saved");
            }
            const created: any = await AgencyService.create({ ...values, agency_uuid: a.agencyUuid, created_by: a.userId });
            audit(req, { entity: "settings", entityId: created.dataValues.id, action: "service_added", summary: `Service added: ${name} - Rs ${toRupees(price).toLocaleString("en-IN")}` });
            return returnHelper(res, 200, true, "Service added", { id: created.dataValues.uuid });
        } catch (error) {
            console.error("service save failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/services/:uuid/delete  (owner / accounts) - past invoices stay
    async remove(req: RequestWithUser, res: Response) {
        const a = accessOf(req);
        if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can change services");
        const s: any = await AgencyService.findOne({ where: { uuid: req.params.uuid, agency_uuid: a.agencyUuid } });
        if (!s) return returnHelper(res, 200, false, "Service not found");
        await AgencyService.destroy({ where: { id: s.dataValues.id } });
        audit(req, { entity: "settings", entityId: s.dataValues.id, action: "service_deleted", summary: `Service removed: ${s.dataValues.name}` });
        return returnHelper(res, 200, true, "Service removed - invoices already paid stay in Client fees");
    }

    // GET /crm/services/orders?page=  - purchases from the store, newest first
    async orders(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = 25;
            const { rows, count } = await ClientInvoice.findAndCountAll({
                where: { agency_uuid: a.agencyUuid, service_id: { [Op.ne]: null } },
                include: [{ model: User, as: "student", attributes: ["id", "username", "country_code", "phone_number"], required: false }],
                order: [["id", "DESC"]], limit, offset: (page - 1) * limit,
            });
            const services: any[] = await AgencyService.findAll({ where: { agency_uuid: a.agencyUuid }, attributes: ["id", "name"], paranoid: false, raw: true });
            const nameOf = new Map(services.map((s) => [Number(s.id), s.name]));
            return returnHelper(res, 200, true, "Orders", {
                orders: rows.map((r: any) => {
                    const x = r.toJSON();
                    return {
                        invoice_id: x.uuid, number: x.number, service: nameOf.get(Number(x.service_id)) || x.title, total: toRupees(x.total),
                        paid: toRupees(x.amount_paid), status: x.status, at: x.createdAt, case_id: x.case_id,
                        student: x.student ? { name: x.student.username, phone: `${x.student.country_code || ""} ${x.student.phone_number || ""}`.trim() } : null,
                    };
                }),
                total: count, pages: Math.ceil(count / limit), page,
            });
        } catch (error) {
            console.error("service orders failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/payment_settings  - Razorpay connection of the agency (secret never returned)
    async paymentSettings(req: RequestWithUser, res: Response) {
        const a = accessOf(req);
        const keys = await agencyKeys(a.agencyUuid);
        const agency: any = await Agent.findOne({ where: { uuid: a.agencyUuid, role: "agent" }, attributes: ["billing_settings"] });
        const billing = readBilling(agency?.dataValues?.billing_settings);
        return returnHelper(res, 200, true, "Payment settings", {
            razorpay_key_id: keys?.key_id || "", razorpay_secret_masked: keys?.key_secret ? maskSecret(keys.key_secret) : null,
            mode: keys?.key_id ? (keys.key_id.startsWith("rzp_live_") ? "live" : "test") : null,
            connected: Boolean(keys), can_edit: a.isOwner,
            gstin: billing.gstin, legal_name: billing.legal_name, default_gst_percent: billing.default_gst_percent,
        });
    }

    // POST /crm/payment_settings { razorpay_key_id, razorpay_key_secret? , remove? }  (owner) - keys are checked with Razorpay before saving
    async savePaymentSettings(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!a.isOwner) return returnHelper(res, 200, false, "Only the agency owner can change payment settings");
            if (req.body?.remove) {
                await Agent.update({ billing_credentials: null }, { where: { uuid: a.agencyUuid, role: "agent" } });
                audit(req, { entity: "settings", action: "razorpay_removed", summary: "Razorpay disconnected" });
                return returnHelper(res, 200, true, "Razorpay disconnected - students can no longer pay online");
            }
            const keyId = String(req.body?.razorpay_key_id || "").trim();
            let secret = String(req.body?.razorpay_key_secret || "").trim();
            if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) return returnHelper(res, 200, false, "Key ID looks like rzp_live_XXXXXXXX or rzp_test_XXXXXXXX");
            const previous = await agencyKeys(a.agencyUuid);
            if (!secret && previous?.key_id === keyId) secret = previous.key_secret;
            if (!secret) return returnHelper(res, 200, false, "Please enter the Key Secret");
            // check the pair with Razorpay so a typo is caught now, not when a student tries to pay
            try {
                await axios.get(`${RZP()}/v1/orders`, { params: { count: 1 }, auth: { username: keyId, password: secret }, timeout: 15000 });
            } catch (error: any) {
                const status = error?.response?.status;
                if (status === 401) return returnHelper(res, 200, false, "Razorpay did not accept these keys - please copy them again from Razorpay Dashboard > Settings > API Keys");
                return returnHelper(res, 200, false, `Could not reach Razorpay to check the keys: ${rzpError(error)}`);
            }
            await Agent.update({ billing_credentials: encryptJson({ key_id: keyId, key_secret: secret }) }, { where: { uuid: a.agencyUuid, role: "agent" } });
            audit(req, { entity: "settings", action: "razorpay_connected", summary: `Razorpay connected (${keyId.startsWith("rzp_live_") ? "live" : "test"} mode)` });
            return returnHelper(res, 200, true, `Razorpay connected in ${keyId.startsWith("rzp_live_") ? "live" : "test"} mode`);
        } catch (error) {
            console.error("save payment settings failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // ------------------------------------------------------------------ student portal

    // GET /student/services  - the services of my agency
    async studentList(req: RequestWithUser, res: Response) {
        try {
            const student: any = await User.findOne({ where: { id: req.id }, attributes: ["id", "agency_uuid"] });
            if (!student?.dataValues?.agency_uuid) return returnHelper(res, 200, true, "Services", { services: [], can_pay: false });
            const agencyUuid = student.dataValues.agency_uuid;
            const rows: any[] = await AgencyService.findAll({ where: { agency_uuid: agencyUuid, active: true }, order: [["sort_order", "ASC"], ["id", "ASC"]] });
            const mine: any[] = await ClientInvoice.findAll({
                where: { student_id: student.dataValues.id, agency_uuid: agencyUuid, service_id: { [Op.ne]: null }, status: { [Op.ne]: "cancelled" } },
                attributes: ["uuid", "number", "service_id", "total", "createdAt"], order: [["id", "DESC"]], raw: true,
            });
            const names = new Map(rows.map((r) => [r.dataValues.id, r.dataValues.name]));
            return returnHelper(res, 200, true, "Services", {
                services: rows.map((r) => present(r)),
                can_pay: Boolean(await agencyKeys(agencyUuid)),
                purchases: mine.map((m) => ({ invoice_id: m.uuid, number: m.number, service: names.get(m.service_id) || "Service", total: toRupees(m.total), at: m.createdAt })),
            });
        } catch (error) {
            console.error("student services failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /student/services/:uuid/order  - Razorpay order on the agency's account
    async studentOrder(req: RequestWithUser, res: Response) {
        try {
            const student: any = await User.findOne({ where: { id: req.id }, attributes: ["id", "agency_uuid", "username", "email", "country_code", "phone_number"] });
            const agencyUuid = student?.dataValues?.agency_uuid;
            if (!agencyUuid) return returnHelper(res, 200, false, "Your account is not linked to an agency");
            const svc: any = await AgencyService.findOne({ where: { uuid: req.params.uuid, agency_uuid: agencyUuid, active: true } });
            if (!svc) return returnHelper(res, 200, false, "This service is not available any more");
            const keys = await agencyKeys(agencyUuid);
            if (!keys) return returnHelper(res, 200, false, "Online payment is not set up yet - please contact your counsellor");
            const price = Number(svc.dataValues.price);
            const amount = price + Math.round((price * Number(svc.dataValues.gst_percent || 0)) / 100);
            let order: any;
            try {
                order = (await axios.post(`${RZP()}/v1/orders`, {
                    amount, currency: "INR", receipt: `svc-${Date.now().toString(36)}`,
                    notes: { kind: "service", service_uuid: svc.dataValues.uuid, student_id: String(student.dataValues.id), agency_uuid: agencyUuid },
                }, { auth: { username: keys.key_id, password: keys.key_secret }, timeout: 20000 })).data;
            } catch (error: any) {
                return returnHelper(res, 200, false, `Payment could not be started: ${rzpError(error)}`);
            }
            const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["app_name", "username", "favicon_url", "primary_color"] });
            const s = student.dataValues;
            return returnHelper(res, 200, true, "Order", {
                key_id: keys.key_id, order_id: order.id, amount, currency: "INR",
                name: agency?.dataValues?.app_name || agency?.dataValues?.username || "Agency",
                description: svc.dataValues.name, image: agency?.dataValues?.favicon_url || undefined, color: agency?.dataValues?.primary_color || "#0f5bd8",
                prefill: { name: s.username || "", email: s.email || "", contact: s.phone_number ? `${s.country_code || "+91"}${s.phone_number}` : "" },
            });
        } catch (error) {
            console.error("student service order failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /student/services/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    async studentVerify(req: RequestWithUser, res: Response) {
        try {
            const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
            if (!orderId || !paymentId || !signature) return returnHelper(res, 200, false, "Payment details are missing");
            const student: any = await User.findOne({ where: { id: req.id }, attributes: ["id", "agency_uuid", "username"] });
            const agencyUuid = student?.dataValues?.agency_uuid;
            const keys = agencyUuid ? await agencyKeys(agencyUuid) : null;
            if (!keys) return returnHelper(res, 200, false, "Online payment is not set up");
            // 1. the signature proves the payment came from Razorpay for this order
            const expected = crypto.createHmac("sha256", keys.key_secret).update(`${orderId}|${paymentId}`).digest("hex");
            const ok = expected.length === String(signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
            if (!ok) return returnHelper(res, 200, false, "Payment could not be verified - if money was taken, your counsellor will confirm it");
            // already recorded (page refreshed, double click)?
            const existing: any = await ClientPayment.findOne({ where: { agency_uuid: agencyUuid, reference: paymentId }, attributes: ["invoice_id", "receipt_number"] });
            if (existing) {
                const inv: any = await ClientInvoice.findByPk(existing.dataValues.invoice_id, { attributes: ["uuid", "number"] });
                const ord: any = inv ? await ServiceOrder.findOne({ where: { invoice_id: existing.dataValues.invoice_id }, attributes: ["uuid"] }) : null;
                return returnHelper(res, 200, true, "Payment received", { invoice_id: inv?.dataValues?.uuid, number: inv?.dataValues?.number, receipt_number: existing.dataValues.receipt_number, order_id: ord?.dataValues?.uuid });
            }
            // 2. the order itself says what was bought, by whom, for how much (never trust the browser for that)
            let order: any;
            try {
                order = (await axios.get(`${RZP()}/v1/orders/${encodeURIComponent(orderId)}`, { auth: { username: keys.key_id, password: keys.key_secret }, timeout: 20000 })).data;
            } catch (error: any) {
                return returnHelper(res, 200, false, `Could not confirm the payment with Razorpay: ${rzpError(error)}`);
            }
            const notes = order?.notes || {};
            if (notes.kind !== "service" || String(notes.student_id) !== String(student.dataValues.id) || notes.agency_uuid !== agencyUuid) {
                return returnHelper(res, 200, false, "This payment does not belong to your account");
            }
            const svc: any = await AgencyService.findOne({ where: { uuid: notes.service_uuid, agency_uuid: agencyUuid }, paranoid: false });
            if (!svc) return returnHelper(res, 200, false, "Service not found");
            const amount = Number(order.amount);
            const price = Number(svc.dataValues.price);
            const gst = Number(svc.dataValues.gst_percent || 0);
            // the paid amount is the truth; split it into price + GST at the rate used for the order
            const subtotal = Math.round(amount / (1 + gst / 100));
            const gstAmount = amount - subtotal;

            // bill from the branch of the student's latest case, with that branch's number series
            const latest: any = await AgencyLeads.findOne({ where: { user_id: student.dataValues.id, agent_uuid: agencyUuid }, attributes: ["id", "branch_id", "assign_id"], order: [["id", "DESC"]] });
            const branchId = latest?.dataValues?.branch_id || null;
            const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["billing_settings"] });
            const branch: any = branchId ? await AgencyBranch.findByPk(branchId, { attributes: ["invoice_prefix"] }) : null;
            const prefix = branch?.dataValues?.invoice_prefix || readBilling(agency?.dataValues?.billing_settings).invoice_prefix;

            let invoice: any = null;
            for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
                try {
                    invoice = await sequelize.transaction(async (t: any) => ClientInvoice.create({
                        agency_uuid: agencyUuid, number: await nextNumber(agencyUuid, prefix, t), student_id: student.dataValues.id,
                        case_id: latest?.dataValues?.id || null, branch_id: branchId, service_id: svc.dataValues.id,
                        title: svc.dataValues.name, items: [{ description: svc.dataValues.name, amount: subtotal }],
                        subtotal, gst_percent: gst, gst_amount: gstAmount, total: amount,
                        issue_date: today(), due_date: today(), installments: null,
                        notes: "Bought online in the student portal", created_by: null,
                    }, { transaction: t }));
                } catch (error: any) {
                    if (error?.name !== "SequelizeUniqueConstraintError" || attempt === 2) throw error;
                }
            }
            const payment: any = await recordPayment(invoice, amount, "razorpay", { reference: paymentId, note: `Services store - order ${orderId}`, userId: null });
            const serviceOrder: any = await createOrderForInvoice(invoice);
            audit(null, {
                agencyUuid, entity: "invoice", entityId: invoice.dataValues.id, branchId, action: "service_bought",
                summary: `${student.dataValues.username || "A student"} bought "${svc.dataValues.name}" online - Rs ${toRupees(amount).toLocaleString("en-IN")} (${invoice.dataValues.number})`,
                meta: { case_id: latest?.dataValues?.id || null, service_id: svc.dataValues.id, price_now: toRupees(price) },
                actor: { type: "student", id: Number(student.dataValues.id), name: student.dataValues.username || "Student" },
            });
            const owner = await agencyOwnerId(agencyUuid);
            notifyLater({
                agencyUuid, recipientIds: [owner, latest?.dataValues?.assign_id].filter(Boolean) as number[], type: "payment_received",
                title: `${student.dataValues.username || "A student"} bought ${svc.dataValues.name}`,
                body: `Rs ${toRupees(amount).toLocaleString("en-IN")} paid online · ${invoice.dataValues.number}`,
                link: serviceOrder ? `/services/orders/${serviceOrder.dataValues.uuid}` : `/fees/${invoice.dataValues.uuid}`, email: true,
            });
            return returnHelper(res, 200, true, "Payment received - thank you!", { invoice_id: invoice.dataValues.uuid, number: invoice.dataValues.number, receipt_number: payment?.dataValues?.receipt_number, order_id: serviceOrder?.dataValues?.uuid });
        } catch (error) {
            console.error("student service verify failed", error);
            return returnHelper(res, 500, false, "Something went wrong - if money was taken, your counsellor will confirm it");
        }
    }
}

export default new ServiceStoreController();
