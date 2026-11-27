import { Op } from "sequelize";
import CrmLead from "../model/CrmLead";
import ClientInvoice from "../model/ClientInvoice";
import User from "../model/User";
import { Booking, BookingService, BookingTraveller, Quotation, TravelSupplier } from "../model/Travel";
import { accessOf, leadScope } from "../helpers/access";
import { RequestWithUser } from "../utils/types";
import { hasModule } from "./modules";
import { seesCost, supplierOwed, toRupees } from "./travel";
import { presentInvoice } from "../v1/controller/FeesController";

/**
 * Travel dashboard (RP-01): the numbers a travel agency runs on, and the lists of things to act on today.
 *   KPIs: enquiries, conversion, sales, profit, money to collect, open quote value, departures
 *   Act on: quotes to chase, trips leaving soon that are not ready, travelling now, client payments due,
 *           supplier payments due, plus the enquiry funnel, top destinations and sales by month.
 * Scoped like the rest of the travel CRM; cost and profit only for roles that may see them.
 */

const day = (offset = 0) => new Date(Date.now() + 330 * 60000 + offset * 864e5).toISOString().slice(0, 10); // IST
const FUNNEL = ["new", "contacted", "follow_up", "interested", "counselling", "converted", "lost"];

const bookingScopeWhere = async (req: RequestWithUser) => {
    const a = accessOf(req);
    const base: any = { agency_uuid: a.agencyUuid };
    if (a.isOwner || a.teamRole === "accounts" || a.seesAll) return base;
    if ((a.teamRole === "branch_manager" || a.teamRole === "operations") && a.branchId) return { ...base, branch_id: a.branchId };
    if (a.teamRole === "operations") return base;
    const leads: any[] = await CrmLead.findAll({ where: leadScope(req), attributes: ["id"], raw: true });
    return { ...base, [Op.or]: [{ created_by: a.userId }, { crm_lead_id: { [Op.in]: leads.map((l) => l.id).concat([-1]) } }] };
};

export const travelDashboard = async (req: RequestWithUser) => {
    const a = accessOf(req);
    const cost = seesCost(req);
    const today = day(), in7 = day(7), in14 = day(14), in30 = day(30);
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthStartDate = new Date(`${monthStart}T00:00:00+05:30`);
    const scope = await bookingScopeWhere(req);
    const bookingsOn = await hasModule(a.agencyUuid, "bookings");
    const leadWhere = { ...leadScope(req), business_line: "travel" };

    // ---- enquiries and conversion (this month)
    const monthLeads: any[] = await CrmLead.findAll({ where: { ...leadWhere, createdAt: { [Op.gte]: monthStartDate } }, attributes: ["status"], raw: true });
    const converted = monthLeads.filter((l) => l.status === "converted").length;
    const funnel = FUNNEL.map((key) => ({ key, count: monthLeads.filter((l) => l.status === key).length }));
    const openEnquiries = await CrmLead.count({ where: { ...leadWhere, status: { [Op.in]: ["new", "contacted", "follow_up", "interested", "counselling"] } } });

    // ---- quotes
    const openQuotes: any[] = await Quotation.findAll({ where: { ...scope, status: { [Op.in]: ["draft", "sent"] } }, attributes: ["uuid", "number", "version", "title", "status", "sell_total", "sent_at", "valid_until", "crm_lead_id", "updatedAt"], raw: true });
    const chase = openQuotes.filter((q) => q.status === "sent" && q.sent_at && new Date(q.sent_at).getTime() < Date.now() - 2 * 864e5)
        .sort((x, y) => new Date(x.sent_at).getTime() - new Date(y.sent_at).getTime()).slice(0, 8);
    const chaseLeads: any[] = await CrmLead.findAll({ where: { id: chase.map((q) => q.crm_lead_id).filter(Boolean).concat([-1]) }, attributes: ["id", "uuid", "name", "phone_normalized"], raw: true });
    const leadBy = new Map(chaseLeads.map((l) => [l.id, l]));

    // ---- bookings
    const monthBookings: any[] = await Booking.findAll({ where: { ...scope, status: { [Op.ne]: "cancelled" }, createdAt: { [Op.gte]: monthStartDate } }, attributes: ["total_sell", "total_cost", "credited"], raw: true });
    const sales = monthBookings.reduce((s, b) => s + Number(b.total_sell), 0);
    const profit = monthBookings.reduce((s, b) => s + Number(b.total_sell) - Number(b.credited || 0) - Number(b.total_cost), 0);

    const soon: any[] = bookingsOn ? await Booking.findAll({
        where: { ...scope, status: { [Op.in]: ["confirmed", "in_progress"] }, start_date: { [Op.between]: [today, in30] } },
        include: [{ model: User, as: "client", attributes: ["id", "username", "phone_number", "country_code"], required: false }, { model: ClientInvoice, as: "invoice", attributes: ["total", "amount_paid", "status"], required: false }],
        order: [["start_date", "ASC"]], limit: 60,
    }) : [];
    const travelling: any[] = bookingsOn ? await Booking.findAll({
        where: { ...scope, status: { [Op.ne]: "cancelled" }, start_date: { [Op.lte]: today }, end_date: { [Op.gte]: today } },
        include: [{ model: User, as: "client", attributes: ["username", "phone_number", "country_code"], required: false }], order: [["end_date", "ASC"]], limit: 20,
    }) : [];

    // readiness of trips leaving in the next 14 days
    const soonIds = soon.map((b: any) => b.dataValues.id);
    const [svcRows, paxRows]: any[] = await Promise.all([
        BookingService.findAll({ where: { booking_id: soonIds.concat([-1]), status: "requested" }, attributes: ["booking_id"], raw: true }),
        BookingTraveller.findAll({ where: { booking_id: soonIds.concat([-1]) }, attributes: ["booking_id", "passport_last4", "pan_enc", "is_lead"], raw: true }),
    ]);
    const attention = soon.filter((b: any) => b.dataValues.start_date <= in14).map((b: any) => {
        const x = b.toJSON();
        const issues: string[] = [];
        const pending = svcRows.filter((s: any) => s.booking_id === x.id).length;
        if (pending) issues.push(`${pending} service${pending > 1 ? "s" : ""} not confirmed`);
        const pax = paxRows.filter((p: any) => p.booking_id === x.id);
        if (x.is_international && pax.some((p: any) => !p.passport_last4)) issues.push("passport missing");
        if (x.is_international && Number(x.tcs_percent) > 0 && !pax.some((p: any) => p.is_lead && p.pan_enc)) issues.push("PAN missing");
        if (!x.invoice_id) issues.push("no invoice");
        else if (x.invoice && Number(x.invoice.total) > Number(x.invoice.amount_paid)) issues.push(`₹${(toRupees(Number(x.invoice.total) - Number(x.invoice.amount_paid))).toLocaleString("en-IN")} unpaid`);
        return { id: x.uuid, booking_no: x.booking_no, title: x.title, client: x.client?.username, start_date: x.start_date, issues };
    }).filter((t) => t.issues.length);

    // ---- money to collect from clients (invoices of travel bookings)
    const invoices: any[] = bookingsOn ? await ClientInvoice.findAll({
        where: { agency_uuid: a.agencyUuid, booking_id: { [Op.ne]: null }, status: { [Op.in]: ["unpaid", "partial"] } },
        include: [{ model: User, as: "student", attributes: ["username", "phone_number", "country_code"], required: false }], limit: 300,
    }) : [];
    const allowedBookings = new Set((await Booking.findAll({ where: scope, attributes: ["id"], raw: true }) as any[]).map((b) => b.id));
    let toCollect = 0, overdueCollect = 0;
    const dueSoon: any[] = [];
    for (const inv of invoices) {
        if (!allowedBookings.has(inv.dataValues.booking_id)) continue;
        const p = presentInvoice(inv);
        toCollect += p.balance;
        if (p.overdue) overdueCollect += p.balance;
        const due = p.next_due?.due_date;
        if (p.next_due && due && due <= in7) dueSoon.push({ id: p.id, number: p.number, client: p.student?.name, phone: p.student?.phone_digits, amount: p.next_due.amount, due_date: due, overdue: p.overdue, link: p.payment_link_url });
    }
    dueSoon.sort((x, y) => String(x.due_date).localeCompare(String(y.due_date)));

    // ---- supplier payments due (cost roles only)
    let supplierDue: any[] = [];
    if (cost && (await hasModule(a.agencyUuid, "suppliers"))) {
        const rows: any[] = await BookingService.findAll({
            where: { agency_uuid: a.agencyUuid, supplier_id: { [Op.ne]: null }, supplier_due_date: { [Op.lte]: in7 } },
            include: [{ model: TravelSupplier, as: "supplier", attributes: ["name"], required: false }, { model: Booking, as: "booking", attributes: ["uuid", "booking_no", "status"], required: false }],
            order: [["supplier_due_date", "ASC"]], limit: 50,
        });
        supplierDue = rows.map((r) => r.toJSON() as any).filter((x) => x.booking && !(x.booking.status === "cancelled" && x.status !== "cancelled") && supplierOwed(x) > 0)
            .map((x) => ({ booking_id: x.booking.uuid, booking_no: x.booking.booking_no, supplier: x.supplier?.name, service: x.description, due: toRupees(supplierOwed(x)), due_date: x.supplier_due_date, overdue: x.supplier_due_date < today })).slice(0, 10);
    }

    // ---- top destinations (90 days) and sales by month (6 months)
    const since90 = new Date(Date.now() - 90 * 864e5);
    const recent: any[] = await Booking.findAll({ where: { ...scope, status: { [Op.ne]: "cancelled" }, createdAt: { [Op.gte]: new Date(Date.now() - 183 * 864e5) } }, attributes: ["destination", "total_sell", "total_cost", "credited", "createdAt"], raw: true });
    const destMap = new Map<string, { name: string; bookings: number; sales: number }>();
    for (const b of recent.filter((r) => new Date(r.createdAt) >= since90)) {
        const k = (b.destination || "Not set").split(",")[0].trim();
        const g = destMap.get(k) || { name: k, bookings: 0, sales: 0 };
        g.bookings += 1; g.sales += Number(b.total_sell); destMap.set(k, g);
    }
    const months: { month: string; sales: number; profit?: number; bookings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7);
        const rows = recent.filter((r) => new Date(r.createdAt).toISOString().slice(0, 7) === key);
        months.push({ month: key, bookings: rows.length, sales: toRupees(rows.reduce((s, r) => s + Number(r.total_sell), 0)), ...(cost ? { profit: toRupees(rows.reduce((s, r) => s + Number(r.total_sell) - Number(r.credited || 0) - Number(r.total_cost), 0)) } : {}) });
    }

    const trip = (b: any) => { const x = b.toJSON ? b.toJSON() : b; return { id: x.uuid, booking_no: x.booking_no, title: x.title, destination: x.destination, client: x.client?.username, phone: `${String(x.client?.country_code || "").replace(/\D/g, "")}${x.client?.phone_number || ""}`, start_date: x.start_date, end_date: x.end_date, status: x.status }; };

    return {
        kpis: {
            enquiries_month: monthLeads.length,
            open_enquiries: openEnquiries,
            conversion_rate: monthLeads.length ? Math.round(converted * 1000 / monthLeads.length) / 10 : 0,
            bookings_month: monthBookings.length,
            sales_month: toRupees(sales),
            ...(cost ? { profit_month: toRupees(profit), margin_pct: sales ? Math.round(profit * 1000 / sales) / 10 : 0 } : {}),
            to_collect: Math.round(toCollect * 100) / 100,
            overdue_collect: Math.round(overdueCollect * 100) / 100,
            open_quotes: openQuotes.length,
            pipeline_value: toRupees(openQuotes.reduce((s, q) => s + Number(q.sell_total || 0), 0)),
            departures_7: soon.filter((b: any) => b.dataValues.start_date <= in7).length,
            departures_30: soon.length,
            travelling_now: travelling.length,
        },
        quotes_to_chase: chase.map((q) => { const l: any = leadBy.get(q.crm_lead_id); return { id: q.uuid, number: q.number, version: q.version, title: q.title, total: toRupees(q.sell_total), sent_at: q.sent_at, lead: l ? { id: l.uuid, name: l.name, phone: String(l.phone_normalized || "").replace(/\D/g, "") } : null }; }),
        trips_attention: attention,
        travelling_now: travelling.map(trip),
        departures: soon.slice(0, 10).map(trip),
        payments_due: dueSoon.slice(0, 10),
        supplier_due: supplierDue,
        funnel,
        top_destinations: [...destMap.values()].sort((x, y) => y.bookings - x.bookings).slice(0, 6).map((g) => ({ ...g, sales: toRupees(g.sales) })),
        months,
        sees_cost: cost,
    };
};
