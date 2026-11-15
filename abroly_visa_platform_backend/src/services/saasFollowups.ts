import { Op } from "sequelize";
import Agent from "../model/Agent";
import SaasPayment from "../model/SaasPayment";
import SaasPlan from "../model/SaasPlan";
import { notify } from "./notifications";
import { sendMail } from "./mailer";

/**
 * Failed online payments: tell the agency owner right away (bell + email) with the reason and a retry link,
 * tell the platform admin (SAAS_ADMIN_EMAIL), then remind the owner after 1 day and 3 days unless they paid.
 *
 * Only the latest failure of an agency is followed up (older ones are marked resolved), and any successful
 * payment resolves them all (see fulfillRazorpayOrder / admin extend).
 */

const HOUR = 60 * 60 * 1000;
const FOLLOW_UPS = [24 * HOUR, 72 * HOUR]; // after the failure

/** Razorpay wording -> what the owner can do about it. */
const adviceFor = (reason: string) => {
    const r = reason.toLowerCase();
    if (/insufficient|balance|funds/.test(r)) return "It looks like there was not enough balance. You can try another card or UPI.";
    if (/declin|issuer|bank/.test(r)) return "Your bank declined it. Please try another card, UPI or net banking.";
    if (/timeout|timed out|expired|cancel/.test(r)) return "The payment was not completed in time. You can simply try again.";
    if (/otp|authenticat|3ds/.test(r)) return "The OTP / authentication did not complete. Please try again.";
    return "No money was taken. You can try again with any card, UPI or net banking.";
};

const adminEmails = () => String(process.env.SAAS_ADMIN_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
const rupees = (paise: any) => `Rs ${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;

const describe = async (payment: any) => {
    const p = payment.dataValues || payment;
    const [agency, plan]: any[] = await Promise.all([
        Agent.findOne({ where: { uuid: p.agency_uuid, role: "agent" }, attributes: ["id", "username", "app_name", "phone_number", "country_code", "expires_at"] }),
        p.plan_id ? SaasPlan.findByPk(p.plan_id, { attributes: ["name"] }) : null,
    ]);
    return { agency, planName: plan?.dataValues?.name || "your plan", agencyName: agency ? (agency.dataValues.app_name || agency.dataValues.username) : p.agency_uuid };
};

/**
 * Mark a pending online payment as failed (from the browser after checkout fails, or from the Razorpay webhook).
 * Returns false when the order is unknown, already paid or already failed.
 */
export const recordPaymentFailure = async (opts: { orderId: string; reason?: string | null; agencyUuid?: string | null }) => {
    const where: any = { razorpay_order_id: opts.orderId, status: "created" };
    if (opts.agencyUuid) where.agency_uuid = opts.agencyUuid;
    const payment: any = await SaasPayment.findOne({ where });
    if (!payment) {
        // failure reported twice (browser + webhook): keep the more useful reason
        if (opts.reason) await SaasPayment.update({ failure_reason: String(opts.reason).slice(0, 500) }, { where: { razorpay_order_id: opts.orderId, status: "failed", failure_reason: null } });
        return false;
    }
    const p = payment.dataValues;
    const reason = String(opts.reason || "").trim().slice(0, 500) || null;
    const [n] = await SaasPayment.update(
        { status: "failed", failure_reason: reason, failed_at: new Date(), resolved: false, followup_count: 0 },
        { where: { id: p.id, status: "created" } },
    );
    if (!n) return false;
    // only the latest failure of this agency is followed up
    await SaasPayment.update({ resolved: true }, { where: { agency_uuid: p.agency_uuid, status: "failed", resolved: false, id: { [Op.ne]: p.id } } });

    const { agency, planName, agencyName } = await describe(payment);
    if (agency) {
        await notify({
            agencyUuid: p.agency_uuid, recipientIds: [agency.dataValues.id], type: "payment_failed",
            title: "Your payment did not go through",
            body: `${rupees(p.amount)} for the ${planName} plan failed${reason ? ` (${reason})` : ""}. ${adviceFor(reason || "")}`,
            link: "/subscription", email: true, dedupeKey: `payfail:${p.id}`,
        });
    }
    for (const to of adminEmails()) {
        await sendMail(to, `Payment failed: ${agencyName}`, `${agencyName} tried to pay ${rupees(p.amount)} for ${planName} and it failed.\nReason: ${reason || "not given"}\nPhone: ${agency ? `${agency.dataValues.country_code || ""} ${agency.dataValues.phone_number || ""}` : "-"}`);
    }
    return true;
};

/** Scheduler: remind owners of failed payments after 1 and 3 days. */
export const paymentFailureFollowups = async () => {
    const failed: any[] = await SaasPayment.findAll({
        where: { status: "failed", resolved: false, failed_at: { [Op.ne]: null }, followup_count: { [Op.lt]: FOLLOW_UPS.length } },
        limit: 200,
    });
    for (const payment of failed) {
        const p = payment.dataValues;
        const due = FOLLOW_UPS[Number(p.followup_count) || 0];
        if (Date.now() - new Date(p.failed_at).getTime() < due) continue;
        // paid since then (any way) -> nothing to chase
        const paidSince = await SaasPayment.count({ where: { agency_uuid: p.agency_uuid, status: "paid", paid_at: { [Op.gt]: p.failed_at } } });
        if (paidSince) {
            await SaasPayment.update({ resolved: true }, { where: { id: p.id } });
            continue;
        }
        const step = (Number(p.followup_count) || 0) + 1;
        await SaasPayment.update({ followup_count: step, last_followup_at: new Date() }, { where: { id: p.id } });
        const { agency, planName } = await describe(payment);
        if (!agency) continue;
        const ends = agency.dataValues.expires_at ? new Date(agency.dataValues.expires_at) : null;
        const daysLeft = ends ? Math.ceil((ends.getTime() - Date.now()) / (24 * HOUR)) : 0;
        await notify({
            agencyUuid: p.agency_uuid, recipientIds: [agency.dataValues.id], type: "payment_failed",
            title: daysLeft > 0 ? `Complete your ${planName} payment` : "Your access has ended - renew to continue",
            body: `Your last payment of ${rupees(p.amount)} did not go through.${daysLeft > 0 ? ` Your access ends in ${daysLeft} day(s).` : ""} ${adviceFor(p.failure_reason || "")}`,
            link: "/subscription", email: true, dedupeKey: `payfail:${p.id}:${step}`,
        });
    }
};

/** Admin "remind now". */
export const sendFailureReminderNow = async (paymentUuid: string) => {
    const payment: any = await SaasPayment.findOne({ where: { uuid: paymentUuid, status: "failed" } });
    if (!payment) return false;
    const p = payment.dataValues;
    const { agency, planName } = await describe(payment);
    if (!agency) return false;
    const step = (Number(p.followup_count) || 0) + 1;
    await SaasPayment.update({ followup_count: step, last_followup_at: new Date() }, { where: { id: p.id } });
    await notify({
        agencyUuid: p.agency_uuid, recipientIds: [agency.dataValues.id], type: "payment_failed",
        title: `Complete your ${planName} payment`,
        body: `Your payment of ${rupees(p.amount)} did not go through. ${adviceFor(p.failure_reason || "")}`,
        link: "/subscription", email: true, dedupeKey: `payfail:${p.id}:manual:${Date.now()}`,
    });
    return true;
};
