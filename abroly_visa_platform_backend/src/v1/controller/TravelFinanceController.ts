import { Response } from "express";
import { Op } from "sequelize";
import sequelize from "../../config/dbconfig";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, leadScope } from "../../helpers/access";
import User from "../../model/User";
import CrmLead from "../../model/CrmLead";
import ClientInvoice from "../../model/ClientInvoice";
import { Booking, BookingService, CreditNote, TravelSupplier } from "../../model/Travel";
import { audit } from "../../services/audit";
import {
    nextTravelNumber, redactCost, seesCost, serviceCost, supplierNetPaid, supplierOwed, supplierRefundDue, toPaise, toRupees,
} from "../../services/travel";
import { recalcBookingCost } from "./TravelController";

/**
 * Travel CRM money after the sale: what we owe suppliers and when, real profit per trip (credit notes and
 * cancellation charges included), cancelling a service or a whole booking, and refunds both ways
 * (to the client through a credit note, from the supplier against what they keep).
 */

const str = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).replace(/\u0000/g, "").trim().slice(0, max) || null);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const ok = (res: Response, message: string, data?: any) => returnHelper(res, 200, true, message, data);
const no = (res: Response, message: string) => returnHelper(res, 200, false, message);
const fail = (res: Response, error: any, where: string) => {
    if (!error?.expose) console.error(`TravelFinanceController.${where}`, error);
    return returnHelper(res, 200, false, error?.expose ? error.message : "Something went wrong, please try again");
};
const userError = (message: string) => Object.assign(new Error(message), { expose: true });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const isMoneyRole = (req: RequestWithUser) => { const a = accessOf(req); return a.isOwner || a.teamRole === "accounts"; };

/** Same visibility as the booking screens: whole agency, own branch, or own / own leads' bookings. */
const bookingScope = async (req: RequestWithUser) => {
    const a = accessOf(req);
    const base: any = { agency_uuid: a.agencyUuid };
    if (a.isOwner || a.teamRole === "accounts" || a.seesAll) return base;
    if ((a.teamRole === "branch_manager" || a.teamRole === "operations") && a.branchId) return { ...base, branch_id: a.branchId };
    if (a.teamRole === "operations") return base;
    const leads: any[] = await CrmLead.findAll({ where: leadScope(req), attributes: ["id"], raw: true });
    return { ...base, [Op.or]: [{ created_by: a.userId }, { crm_lead_id: { [Op.in]: leads.map((l) => l.id).concat([-1]) } }] };
};
const scopedBooking = async (req: RequestWithUser, uuid: string) => Booking.findOne({ where: { ...(await bookingScope(req)), uuid } }) as Promise<any>;
const scopedService = async (req: RequestWithUser, uuid: string) => {
    const s: any = await BookingService.findOne({ where: { agency_uuid: accessOf(req).agencyUuid, uuid } });
    if (!s) return null;
    const b: any = await Booking.findOne({ where: { ...(await bookingScope(req)), id: s.dataValues.booking_id } });
    return b ? { service: s, booking: b } : null;
};

/**
 * Credit note against the booking's invoice: lowers the invoice (GST and TCS in proportion, instalments from
 * the last one back) and records how much selling value was given up. Paid above the new total = refund due.
 */
export const issueCreditNote = async (t: any, o: { agencyUuid: string; booking: any; amount: number; reason: string; userId: number }) => {
    const inv: any = await ClientInvoice.findByPk(o.booking.dataValues.invoice_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!inv) throw userError("The booking's invoice was not found");
    const total = Number(inv.dataValues.total);
    const amount = o.amount;
    if (amount > total) throw userError(`The invoice total is only Rs ${toRupees(total)}`);
    const gstShare = total > 0 ? Math.round(Number(inv.dataValues.gst_amount) * amount / total) : 0;
    const tcsShare = total > 0 ? Math.round(Number(inv.dataValues.tcs_amount || 0) * amount / total) : 0;
    const newTotal = total - amount;
    const paid = Number(inv.dataValues.amount_paid);
    const refundDue = Math.max(0, paid - newTotal);
    const scale = total > 0 ? newTotal / total : 0;
    let inst = Array.isArray(inv.installments) ? inv.installments.map((i: any) => ({ ...i })) : null;
    if (inst) {
        let left = amount;
        for (let i = inst.length - 1; i >= 0 && left > 0; i--) { const cut = Math.min(left, Number(inst[i].amount)); inst[i].amount = Number(inst[i].amount) - cut; left -= cut; }
        inst = inst.filter((i: any) => i.amount > 0);
        if (!inst.length) inst = null;
    }
    await inv.update({
        total: newTotal, gst_amount: Number(inv.dataValues.gst_amount) - gstShare, tcs_amount: Number(inv.dataValues.tcs_amount || 0) - tcsShare,
        cgst: Math.round(Number(inv.dataValues.cgst || 0) * scale), sgst: Math.round(Number(inv.dataValues.sgst || 0) * scale), igst: Math.round(Number(inv.dataValues.igst || 0) * scale),
        installments: inst, status: newTotal === 0 ? (paid > 0 ? "paid" : "cancelled") : paid >= newTotal ? "paid" : paid > 0 ? "partial" : "unpaid",
    }, { transaction: t });
    const number = await nextTravelNumber(CreditNote, "number", o.agencyUuid, "CN", t);
    const note = await CreditNote.create({
        agency_uuid: o.agencyUuid, number, invoice_id: inv.dataValues.id, booking_id: o.booking.dataValues.id, amount,
        gst_amount: gstShare, taxable_value: amount - gstShare, reason: o.reason, refund_due: refundDue, issue_date: today(), created_by: o.userId,
    }, { transaction: t });
    // selling value given up = credit less the taxes that went with it
    await Booking.increment({ credited: Math.max(0, amount - gstShare - tcsShare) }, { where: { id: o.booking.dataValues.id }, transaction: t });
    return note as any;
};

const svcRow = (x: any) => ({
    id: x.uuid, type: x.type, description: x.description, status: x.status, service_date: x.service_date,
    supplier: x.supplier ? { id: x.supplier.uuid, name: x.supplier.name, phone: x.supplier.phone } : null,
    cost: toRupees(serviceCost(x)), paid: toRupees(supplierNetPaid(x)), owed: toRupees(supplierOwed(x)), refund_due: toRupees(supplierRefundDue(x)),
    due_date: x.supplier_due_date, overdue: Boolean(x.supplier_due_date && x.supplier_due_date < today() && supplierOwed(x) > 0),
    booking: x.booking ? { id: x.booking.uuid, booking_no: x.booking.booking_no, title: x.booking.title, start_date: x.booking.start_date, status: x.booking.status } : null,
});

/** One booking's money, both sides. */
const bookingMoney = (b: any, services: any[], inv: any | null, notes: any[]) => {
    const sell = Number(b.total_sell || 0), credited = Number(b.credited || 0);
    const live = services.filter((s) => s.status !== "cancelled");
    const supplierCost = live.reduce((a, s) => a + Number(s.cost || 0), 0);
    const cancelCharges = services.filter((s) => s.status === "cancelled").reduce((a, s) => a + Number(s.cancel_charge || 0), 0);
    const netSell = sell - credited, netCost = supplierCost + cancelCharges;
    const received = inv ? Number(inv.amount_paid || 0) : 0;
    const refunded = notes.reduce((a, n) => a + Number(n.refunded || 0), 0);
    const refundDue = notes.reduce((a, n) => a + Math.max(0, Number(n.refund_due || 0) - Number(n.refunded || 0)), 0);
    const supPaid = services.reduce((a, s) => a + supplierNetPaid(s), 0);
    return {
        sell, credited, net_sell: netSell, supplier_cost: supplierCost, cancel_charges: cancelCharges, net_cost: netCost,
        real_profit: netSell - netCost, margin_pct: netSell > 0 ? Math.round((netSell - netCost) * 1000 / netSell) / 10 : 0,
        invoiced: inv ? Number(inv.total || 0) : 0, received, refunded, client_refund_due: refundDue, client_balance: inv ? Math.max(0, Number(inv.total) - received) : 0,
        supplier_paid: supPaid, supplier_owed: services.reduce((a, s) => a + supplierOwed(s), 0), supplier_refund_due: services.reduce((a, s) => a + supplierRefundDue(s), 0),
        cash_position: received - supPaid,
    };
};
const moneyOut = (m: ReturnType<typeof bookingMoney>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, k === "margin_pct" ? v : toRupees(v)]));

class TravelFinanceController {
    /** GET /travel/finance/payables - every rupee owed to suppliers (by supplier, with due dates) and refunds both ways. */
    async payables(req: RequestWithUser, res: Response) {
        try {
            if (!seesCost(req)) return no(res, "Your role can not see supplier costs");
            const a = accessOf(req);
            const bWhere: any = await bookingScope(req);
            const bookings: any[] = await Booking.findAll({ where: bWhere, attributes: ["id"], raw: true });
            const ids = bookings.map((b) => b.id);
            const rows: any[] = ids.length ? await BookingService.findAll({
                where: { agency_uuid: a.agencyUuid, booking_id: ids },
                include: [{ model: TravelSupplier, as: "supplier", attributes: ["uuid", "name", "phone"], required: false }, { model: Booking, as: "booking", attributes: ["uuid", "booking_no", "title", "start_date", "status"], required: false }],
                order: [["supplier_due_date", "ASC"], ["service_date", "ASC"]],
            }) : [];
            const t = today(), in7 = addDays(t, 7), month = t.slice(0, 7);
            const list = rows.map((r) => r.toJSON() as any)
                // old data: a booking cancelled before cancellation charges existed still has live services
                .filter((x) => !(x.booking?.status === "cancelled" && x.status !== "cancelled"));
            let paidThisMonth = 0;
            for (const x of list) for (const p of Array.isArray(x.supplier_payments) ? x.supplier_payments : []) if (String(p.paid_at || "").slice(0, 7) === month) paidThisMonth += Number(p.amount || 0);
            const owing = list.filter((x) => supplierOwed(x) > 0);
            const bySupplier = new Map<string, any>();
            for (const x of owing) {
                const k = x.supplier?.uuid || "none";
                const g = bySupplier.get(k) || { id: x.supplier?.uuid || null, name: x.supplier?.name || "No supplier set", phone: x.supplier?.phone || null, owed: 0, overdue: 0, services: [] as any[] };
                const owed = supplierOwed(x);
                g.owed += owed; if (x.supplier_due_date && x.supplier_due_date < t) g.overdue += owed;
                g.services.push(svcRow(x)); bySupplier.set(k, g);
            }
            const suppliers = [...bySupplier.values()].sort((p, q) => q.overdue - p.overdue || q.owed - p.owed).map((g) => ({ ...g, owed: toRupees(g.owed), overdue: toRupees(g.overdue) }));
            const supplierRefunds = list.filter((x) => supplierRefundDue(x) > 0).map(svcRow);
            const notes: any[] = await CreditNote.findAll({ where: { agency_uuid: a.agencyUuid, booking_id: ids.concat([-1]) }, order: [["issue_date", "DESC"]], raw: true });
            const open = notes.filter((n) => Number(n.refund_due) > Number(n.refunded));
            const nb: any[] = await Booking.findAll({ where: { id: open.map((n) => n.booking_id).concat([-1]) }, attributes: ["id", "uuid", "booking_no", "title", "user_id"], raw: true });
            const clients: any[] = await User.findAll({ where: { id: nb.map((b) => b.user_id).concat([-1]) }, attributes: ["id", "username"], raw: true });
            const clientRefunds = open.map((n) => {
                const b = nb.find((x) => x.id === n.booking_id);
                return { id: n.uuid, number: n.number, issue_date: n.issue_date, reason: n.reason, due: toRupees(Number(n.refund_due) - Number(n.refunded)), refunded: toRupees(n.refunded), booking: b ? { id: b.uuid, booking_no: b.booking_no, title: b.title } : null, client: clients.find((c) => c.id === b?.user_id)?.username || "" };
            });
            const sum = (xs: any[], f: (x: any) => number) => xs.reduce((s, x) => s + f(x), 0);
            return ok(res, "Payables", {
                kpis: {
                    owed: toRupees(sum(owing, supplierOwed)),
                    overdue: toRupees(sum(owing.filter((x) => x.supplier_due_date && x.supplier_due_date < t), supplierOwed)),
                    due_7: toRupees(sum(owing.filter((x) => x.supplier_due_date && x.supplier_due_date >= t && x.supplier_due_date <= in7), supplierOwed)),
                    no_due_date: owing.filter((x) => !x.supplier_due_date).length,
                    paid_this_month: toRupees(paidThisMonth),
                    supplier_refunds_due: toRupees(sum(list, supplierRefundDue)),
                    client_refunds_due: toRupees(sum(open, (n) => Number(n.refund_due) - Number(n.refunded))),
                },
                suppliers, supplier_refunds: supplierRefunds, client_refunds: clientRefunds, can_pay: isMoneyRole(req),
            });
        } catch (error) { return fail(res, error, "payables"); }
    }

    /** GET /travel/finance/profit?from&to - real profit per trip (by start date), cancelled trips included. */
    async profit(req: RequestWithUser, res: Response) {
        try {
            if (!seesCost(req)) return no(res, "Your role can not see profit");
            const t = today();
            const from = date(req.query.from) || `${addDays(t, -60).slice(0, 7)}-01`;
            const to = date(req.query.to) || addDays(t, 90);
            const where: any = { ...(await bookingScope(req)), start_date: { [Op.between]: [from, to] } };
            const bookings: any[] = await Booking.findAll({
                where, order: [["start_date", "ASC"]], limit: 500,
                include: [{ model: User, as: "client", attributes: ["username"], required: false }, { model: ClientInvoice, as: "invoice", attributes: ["total", "amount_paid"], required: false }],
            });
            const ids = bookings.map((b) => b.dataValues.id);
            const [services, notes]: any[][] = await Promise.all([
                BookingService.findAll({ where: { booking_id: ids.concat([-1]) }, raw: true }),
                CreditNote.findAll({ where: { booking_id: ids.concat([-1]) }, raw: true }),
            ]);
            const rows = bookings.map((r) => {
                const b = r.toJSON() as any;
                const m = bookingMoney(b, services.filter((s) => s.booking_id === b.id), b.invoice, notes.filter((n) => n.booking_id === b.id));
                return { id: b.uuid, booking_no: b.booking_no, title: b.title, destination: b.destination, client: b.client?.username || "", start_date: b.start_date, end_date: b.end_date, status: b.status, m };
            });
            const total: any = {};
            for (const r of rows) for (const [k, v] of Object.entries(r.m)) if (k !== "margin_pct") total[k] = (total[k] || 0) + (v as number);
            total.margin_pct = total.net_sell > 0 ? Math.round(total.real_profit * 1000 / total.net_sell) / 10 : 0;
            const loss = rows.filter((r) => r.m.real_profit < 0).length;
            return ok(res, "Profit by trip", {
                from, to, loss_making: loss,
                totals: moneyOut(total), trips: rows.map(({ m, ...r }) => ({ ...r, ...moneyOut(m) })),
            });
        } catch (error) { return fail(res, error, "profit"); }
    }

    /** GET /travel/bookings/:uuid/finance - the profit card on a booking. */
    async bookingFinance(req: RequestWithUser, res: Response) {
        try {
            const b: any = await scopedBooking(req, req.params.uuid);
            if (!b) return no(res, "Booking not found");
            const [services, notes, inv]: any[] = await Promise.all([
                BookingService.findAll({ where: { booking_id: b.dataValues.id }, raw: true }),
                CreditNote.findAll({ where: { booking_id: b.dataValues.id }, order: [["createdAt", "DESC"]], raw: true }),
                b.dataValues.invoice_id ? ClientInvoice.findByPk(b.dataValues.invoice_id, { raw: true }) : null,
            ]);
            const m = moneyOut(bookingMoney(b.dataValues, services, inv, notes));
            return ok(res, "Booking money", redactCost({ ...m, has_invoice: Boolean(inv), can_money: isMoneyRole(req), can_cancel: isMoneyRole(req) || accessOf(req).teamRole === "branch_manager" }, req));
        } catch (error) { return fail(res, error, "bookingFinance"); }
    }

    /**
     * POST /travel/bookings/services/:uuid/cancel { supplier_charge, client_credit?, reason? }
     * Cancels one service: the supplier keeps `supplier_charge`; anything paid above that is a supplier refund due.
     * `client_credit` (incl. GST) issues a credit note to the client, or lowers the selling price if not invoiced yet.
     */
    async cancelService(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const found = await scopedService(req, req.params.uuid);
            if (!found) return no(res, "Service not found");
            const s = found.service.dataValues;
            if (s.status === "cancelled") return no(res, "This service is already cancelled");
            if (found.booking.dataValues.status === "cancelled") return no(res, "The booking is cancelled");
            const charge = seesCost(req) ? Math.max(0, toPaise(req.body?.supplier_charge)) : 0;
            if (charge > Number(s.cost)) return no(res, `The cancellation charge can not be more than the cost (Rs ${toRupees(s.cost)})`);
            const credit = Math.max(0, toPaise(req.body?.client_credit));
            if (credit && !isMoneyRole(req)) return no(res, "Only the owner or Accounts can give the client a credit");
            const reason = str(req.body?.reason, 300) || `${s.description} cancelled`;
            const note: any = await sequelize.transaction(async (t: any) => {
                await found.service.update({ status: "cancelled", cancel_charge: charge, cancelled_at: today() }, { transaction: t });
                await recalcBookingCost(found.booking.dataValues.id, t);
                if (!credit) return null;
                if (found.booking.dataValues.invoice_id) return issueCreditNote(t, { agencyUuid: a.agencyUuid, booking: found.booking, amount: credit, reason, userId: a.userId });
                const sell = Number(found.booking.dataValues.total_sell);
                await found.booking.update({ total_sell: Math.max(0, sell - credit) }, { transaction: t });
                return null;
            });
            const after: any = await BookingService.findByPk(s.id, { raw: true });
            const back = supplierRefundDue(after);
            audit(req, { entity: "booking", entityId: found.booking.dataValues.id, branchId: found.booking.dataValues.branch_id, action: "service_cancelled", summary: `${found.booking.dataValues.booking_no}: ${s.description} cancelled, supplier keeps Rs ${toRupees(charge)}${credit ? `, client credit Rs ${toRupees(credit)}` : ""}` });
            const bits = [`Service cancelled`];
            if (back) bits.push(`supplier to refund Rs ${toRupees(back)}`);
            if (supplierOwed(after)) bits.push(`still to pay the supplier Rs ${toRupees(supplierOwed(after))}`);
            if (note) bits.push(`credit note ${note.dataValues.number}${Number(note.dataValues.refund_due) ? `, refund Rs ${toRupees(note.dataValues.refund_due)} to the client` : ""}`);
            return ok(res, bits.join(" · "));
        } catch (error) { return fail(res, error, "cancelService"); }
    }

    /**
     * POST /travel/bookings/:uuid/cancel { reason, client_charge, services: [{ id, supplier_charge }] }
     * Cancels the whole trip. client_charge = what the client still pays in total (incl. GST); the rest of the
     * invoice is credited, and whatever they paid above the charge becomes a refund due.
     */
    async cancelBooking(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!(isMoneyRole(req) || a.teamRole === "branch_manager")) return no(res, "Only the owner, Accounts or a branch manager can cancel a booking");
            const booking: any = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            if (booking.dataValues.status === "cancelled") return no(res, "This booking is already cancelled");
            const reason = str(req.body?.reason, 500);
            if (!reason) return no(res, "Enter why the trip is cancelled");
            const clientCharge = Math.max(0, toPaise(req.body?.client_charge));
            const given = new Map<string, number>((Array.isArray(req.body?.services) ? req.body.services : []).map((x: any) => [String(x?.id), Math.max(0, toPaise(x?.supplier_charge))]));
            const result: any = await sequelize.transaction(async (t: any) => {
                const services: any[] = await BookingService.findAll({ where: { booking_id: booking.dataValues.id, status: { [Op.ne]: "cancelled" } }, transaction: t, lock: t.LOCK.UPDATE });
                for (const s of services) {
                    const charge = Math.min(Number(s.dataValues.cost), given.get(s.dataValues.uuid) || 0);
                    await s.update({ status: "cancelled", cancel_charge: charge, cancelled_at: today() }, { transaction: t });
                }
                await recalcBookingCost(booking.dataValues.id, t);
                let note: any = null;
                if (booking.dataValues.invoice_id) {
                    const inv: any = await ClientInvoice.findByPk(booking.dataValues.invoice_id, { transaction: t, attributes: ["total"] });
                    const total = Number(inv?.dataValues.total || 0);
                    if (clientCharge > total) throw userError(`The charge can not be more than the invoice total (Rs ${toRupees(total)})`);
                    if (total - clientCharge > 0) note = await issueCreditNote(t, { agencyUuid: a.agencyUuid, booking, amount: total - clientCharge, reason: `Trip cancelled: ${reason}`.slice(0, 500), userId: a.userId });
                } else {
                    // not invoiced yet: the charge becomes the selling value, to invoice later if anything is due
                    await booking.update({ total_sell: Math.min(Number(booking.dataValues.total_sell), clientCharge) }, { transaction: t });
                }
                await booking.update({ status: "cancelled", cancel_reason: reason, cancelled_at: today(), cancel_charge: clientCharge }, { transaction: t });
                return { note, services: services.length };
            });
            const svc: any[] = await BookingService.findAll({ where: { booking_id: booking.dataValues.id }, raw: true });
            const back = svc.reduce((s, x) => s + supplierRefundDue(x), 0);
            const owe = svc.reduce((s, x) => s + supplierOwed(x), 0);
            audit(req, { entity: "booking", entityId: booking.dataValues.id, branchId: booking.dataValues.branch_id, action: "cancelled", summary: `Booking ${booking.dataValues.booking_no} cancelled (${reason}); client charge Rs ${toRupees(clientCharge)}${result.note ? `, credit note ${result.note.dataValues.number}` : ""}` });
            const bits = ["Booking cancelled"];
            if (result.note && Number(result.note.dataValues.refund_due)) bits.push(`refund Rs ${toRupees(result.note.dataValues.refund_due)} to the client (credit note ${result.note.dataValues.number})`);
            else if (result.note) bits.push(`credit note ${result.note.dataValues.number}`);
            if (back) bits.push(`suppliers to refund Rs ${toRupees(back)}`);
            if (owe) bits.push(`still to pay suppliers Rs ${toRupees(owe)}`);
            return ok(res, bits.join(" · "));
        } catch (error) { return fail(res, error, "cancelBooking"); }
    }

    /** POST /travel/bookings/services/:uuid/supplier_refund { amount, received_at?, reference? } - money back from a supplier. */
    async supplierRefund(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!isMoneyRole(req)) return no(res, "Only the owner or Accounts can record supplier refunds");
            const found = await scopedService(req, req.params.uuid);
            if (!found) return no(res, "Service not found");
            const s = found.service.dataValues;
            const due = supplierRefundDue(s);
            const amount = toPaise(req.body?.amount);
            if (!(amount > 0)) return no(res, "Enter the amount received");
            if (amount > due) return no(res, due ? `Only Rs ${toRupees(due)} is due back from the supplier on this service` : "Nothing is due back from the supplier on this service");
            const list = Array.isArray(found.service.supplier_refunds) ? found.service.supplier_refunds : [];
            list.push({ amount, received_at: date(req.body?.received_at) || today(), reference: str(req.body?.reference, 80), by: a.userId });
            await found.service.update({ supplier_refunded: Number(s.supplier_refunded || 0) + amount, supplier_refunds: list });
            audit(req, { entity: "booking", entityId: found.booking.dataValues.id, branchId: found.booking.dataValues.branch_id, action: "supplier_refund", summary: `Supplier refund Rs ${toRupees(amount)} received on ${found.booking.dataValues.booking_no} (${s.description})` });
            return ok(res, "Supplier refund recorded");
        } catch (error) { return fail(res, error, "supplierRefund"); }
    }
}

export default new TravelFinanceController();
