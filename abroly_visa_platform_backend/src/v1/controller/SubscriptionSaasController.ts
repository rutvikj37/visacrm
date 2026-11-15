import { Request, Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import SaasPlan from "../../model/SaasPlan";
import SaasPayment from "../../model/SaasPayment";
import {
    ADDON_FEATURES, LEAD_SOURCE_FEATURES, SaasError, createRazorpayOrder, fulfillRazorpayOrder, getAgencyAccess, presentPlan,
    razorpayEnabled, verifyCheckoutSignature, verifyRazorpayWebhook,
} from "../../services/saas";
import sequelize from "../../config/dbconfig";
import { recordPaymentFailure } from "../../services/saasFollowups";
import { GST_STATES, getAgencyBilling, getPlatformBilling, loadInvoice, quotePlan, saveAgencyBilling } from "../../services/saasBilling";

/** Agency side: my subscription, renew online with Razorpay. */

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, isOwner: user.role === "agent" };
};

class SubscriptionSaasController {
    // GET /crm/subscription
    async mine(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            const access = await getAgencyAccess(agencyUuid);
            if (!access) return returnHelper(res, 200, false, "Agency not found");
            const plans = isOwner
                ? (await SaasPlan.findAll({ where: { status: "active" }, order: [["sort_order", "ASC"], ["id", "ASC"]] })).map(presentPlan)
                : [];
            const payments = isOwner
                ? (await SaasPayment.findAll({
                    where: { agency_uuid: agencyUuid, status: "paid" },
                    include: [{ model: SaasPlan, as: "plan", attributes: ["name"], required: false }],
                    order: [["paid_at", "DESC"]],
                    limit: 20,
                })).map((p: any) => {
                    const x = p.toJSON();
                    return { id: x.uuid, plan: x.plan?.name || null, months: x.months, amount: Number(x.amount) / 100, method: x.method, paid_at: x.paid_at, invoice_number: x.invoice_number || null, has_invoice: Number(x.amount) > 0, discount: Number(x.discount || 0) / 100, coupon_code: x.coupon_code || null };
                })
                : [];
            return returnHelper(res, 200, true, "Subscription", {
                ...access,
                plans,
                payments,
                features: { sources: LEAD_SOURCE_FEATURES, addons: ADDON_FEATURES },
                razorpay_enabled: razorpayEnabled(),
                pricing: isOwner ? await (async () => { const b = await getPlatformBilling(); return { gst_percent: b.gst_percent, prices_include_gst: b.prices_include_gst }; })() : null,
                support: { phone: process.env.SAAS_SUPPORT_PHONE || null, email: process.env.SAAS_SUPPORT_EMAIL || null },
            });
        } catch (error) {
            console.error("my subscription failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/subscription/razorpay/order { plan_id, billing: "monthly" | "yearly" }
    async createOrder(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can pay");
            const billing = req.body?.billing === "yearly" ? "yearly" : "monthly";
            const order = await createRazorpayOrder(agencyUuid, String(req.body?.plan_id || ""), billing, req.body?.coupon);
            return returnHelper(res, 200, true, "Order created", order);
        } catch (error: any) {
            if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
            console.error("razorpay order failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/subscription/quote { plan_id, billing, coupon }  - price with coupon and GST before paying
    async quote(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can pay");
            const billing = req.body?.billing === "yearly" ? "yearly" : "monthly";
            const q = await quotePlan(agencyUuid, String(req.body?.plan_id || ""), billing, req.body?.coupon);
            return returnHelper(res, 200, true, q.coupon ? "Coupon applied" : "Price", q.view);
        } catch (error: any) {
            if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
            console.error("subscription quote failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/subscription/billing  - details printed on my subscription invoices
    async billingDetails(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can see billing details");
            return returnHelper(res, 200, true, "Billing details", { ...(await getAgencyBilling(agencyUuid)), states: GST_STATES });
        } catch (error: any) {
            if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
            console.error("billing details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/subscription/billing { legal_name, gstin, address, state_code }
    async saveBillingDetails(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can change billing details");
            const data = await saveAgencyBilling(agencyUuid, req.body || {});
            return returnHelper(res, 200, true, "Billing details saved. They will appear on your next invoices.", data);
        } catch (error: any) {
            if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
            console.error("save billing details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/subscription/invoices/:uuid
    async invoice(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can see invoices");
            return returnHelper(res, 200, true, "Invoice", await loadInvoice(req.params.uuid, agencyUuid, sequelize));
        } catch (error: any) {
            if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
            console.error("subscription invoice failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/subscription/razorpay/failed { order_id, reason }  - checkout reported a failure
    async paymentFailed(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const orderId = String(req.body?.order_id || "");
            if (!orderId) return returnHelper(res, 200, false, "Order missing");
            await recordPaymentFailure({ orderId, reason: req.body?.reason ? String(req.body.reason) : null, agencyUuid });
            return returnHelper(res, 200, true, "Noted");
        } catch (error) {
            console.error("payment failed report failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/subscription/razorpay/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    async verifyPayment(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
            if (!orderId || !paymentId || !signature) return returnHelper(res, 200, false, "Payment details missing");
            if (!verifyCheckoutSignature(String(orderId), String(paymentId), String(signature))) {
                return returnHelper(res, 200, false, "Payment could not be verified. If money was deducted, it will be confirmed automatically within a few minutes.");
            }
            const payment: any = await SaasPayment.findOne({ where: { razorpay_order_id: orderId, agency_uuid: agencyUuid } });
            if (!payment) return returnHelper(res, 200, false, "Payment not found");
            const result = await fulfillRazorpayOrder(String(orderId), String(paymentId));
            const access = await getAgencyAccess(agencyUuid);
            return returnHelper(res, 200, true, result.already ? "Payment already confirmed" : "Payment successful - thank you!", access);
        } catch (error: any) {
            if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
            console.error("razorpay verify failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /public/razorpay/webhook  - backup in case the browser closed before verify
    async webhook(req: Request, res: Response) {
        if (!verifyRazorpayWebhook((req as any).rawBody, req.get("x-razorpay-signature"))) return res.sendStatus(401);
        try {
            const event = req.body?.event;
            const payment = req.body?.payload?.payment?.entity;
            if ((event === "payment.captured" || event === "order.paid") && payment?.order_id && payment?.id) {
                await fulfillRazorpayOrder(String(payment.order_id), String(payment.id), Number(payment.amount));
            } else if (event === "payment.failed" && payment?.order_id) {
                await recordPaymentFailure({ orderId: String(payment.order_id), reason: payment.error_description || payment.error_reason || null });
            }
        } catch (error: any) {
            // unknown order (e.g. not ours) - acknowledge so Razorpay stops retrying
            if (!(error instanceof SaasError)) console.error("razorpay webhook failed", error);
        }
        return res.status(200).json({ ok: true });
    }
}

export default new SubscriptionSaasController();
