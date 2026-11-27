import { Op } from "sequelize";
import CrmLead from "../model/CrmLead";
import ClientInvoice from "../model/ClientInvoice";
import User from "../model/User";
import { Booking, BookingService, Quotation, TravelSupplier } from "../model/Travel";
import { accessOf, leadScope } from "../helpers/access";
import { RequestWithUser } from "../utils/types";
import { seesCost, supplierOwed, toRupees } from "./travel";

/**
 * Business overview for the travel dashboard and the Live Trips page:
 *   period KPIs with change vs the previous period, daily revenue / profit / bookings, customer outstanding,
 *   vendor dues, recent activity, all-time summary, payment follow-ups (overdue / due now / this week /
 *   this month, from invoice instalments), lead follow-ups, live and upcoming trips, conversion rates.
 * Revenue is the selling value before tax; profit is selling value less credit notes less what suppliers keep.
 */

const IST = 330 * 60000;
const day = (offset = 0) => new Date(Date.now() + IST + offset * 864e5).toISOString().slice(0, 10);
const istDate = (d: any) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
const OPEN_LEAD = ["new", "contacted", "follow_up", "interested", "counselling"];
const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : now ? 100 : 0);

/** Bookings a team member may see (same rules as the rest of the travel CRM). */
export const bookingScope = async (req: RequestWithUser) => {
    const a = accessOf(req);
    const base: any = { agency_uuid: a.agencyUuid };
    if (a.isOwner || a.teamRole === "accounts" || a.seesAll) return base;
    if ((a.teamRole === "branch_manager" || a.teamRole === "operations") && a.branchId) return { ...base, branch_id: a.branchId };
    if (a.teamRole === "operations") return base;
    const leads: any[] = await CrmLead.findAll({ where: leadScope(req), attributes: ["id"], raw: true });
    return { ...base, [Op.or]: [{ created_by: a.userId }, { crm_lead_id: { [Op.in]: leads.map((l) => l.id).concat([-1]) } }] };
};

const profitOf = (b: any) => Number(b.total_sell || 0) - Number(b.credited || 0) - Number(b.total_cost || 0);
const phoneOf = (u: any) => `${String(u?.country_code || "").replace(/\D/g, "")}${u?.phone_number || ""}`;

/** Unpaid parts of an invoice's instalments (or its single balance), oldest first. */
const unpaidParts = (inv: any) => {
    const total = Number(inv.total || 0), paid = Number(inv.amount_paid || 0);
    if (total - paid <= 0 || inv.status === "cancelled") return [];
    const list = Array.isArray(inv.installments) ? inv.installments : [];
    if (!list.length) return [{ label: "Balance", amount: total - paid, due_date: inv.due_date || null }];
    let left = paid;
    const out: any[] = [];
    for (const i of list) {
        const amt = Number(i.amount || 0);
        if (left >= amt) { left -= amt; continue; }
        out.push({ label: i.label, amount: amt - left, due_date: i.due_date || null });
        left = 0;
    }
    return out;
};

export const travelOverview = async (req: RequestWithUser, daysIn: number) => {
    const a = accessOf(req);
    const cost = seesCost(req);
    const days = [7, 30, 90, 365].includes(daysIn) ? daysIn : 30;
    const today = day();
    const from = new Date(Date.now() - days * 864e5), prevFrom = new Date(Date.now() - 2 * days * 864e5);
    const scope = await bookingScope(req);

    // ---- bookings: this period, previous period, all time
    const all: any[] = await Booking.findAll({ where: { ...scope, status: { [Op.ne]: "cancelled" } }, attributes: ["id", "uuid", "booking_no", "title", "destination", "total_sell", "total_cost", "credited", "createdAt"], raw: true });
    const inRange = all.filter((b) => new Date(b.createdAt) >= from);
    const prev = all.filter((b) => new Date(b.createdAt) >= prevFrom && new Date(b.createdAt) < from);
    const revenue = inRange.reduce((s, b) => s + Number(b.total_sell), 0), revenuePrev = prev.reduce((s, b) => s + Number(b.total_sell), 0);
    const profit = inRange.reduce((s, b) => s + profitOf(b), 0), profitPrev = prev.reduce((s, b) => s + profitOf(b), 0);

    // ---- daily series (weeks for a year)
    const series: { date: string; revenue: number; profit?: number; bookings: number }[] = [];
    const step = days === 365 ? 7 : 1;
    for (let i = days - 1; i >= 0; i -= step) {
        const start = day(-i), end = day(-i + step - 1);
        const rows = inRange.filter((b) => { const d = istDate(b.createdAt); return d >= start && d <= end; });
        series.push({ date: start, bookings: rows.length, revenue: toRupees(rows.reduce((s, b) => s + Number(b.total_sell), 0)), ...(cost ? { profit: toRupees(rows.reduce((s, b) => s + profitOf(b), 0)) } : {}) });
    }

    // ---- customer outstanding and payment follow-ups (invoices of bookings in scope)
    const allowed = new Set((await Booking.findAll({ where: scope, attributes: ["id"], raw: true }) as any[]).map((b) => b.id));
    const invoices: any[] = await ClientInvoice.findAll({
        where: { agency_uuid: a.agencyUuid, booking_id: { [Op.ne]: null }, status: { [Op.in]: ["unpaid", "partial"] } },
        include: [{ model: User, as: "student", attributes: ["username", "phone_number", "country_code"], required: false }], limit: 500,
    });
    const bookingBy = new Map((await Booking.findAll({ where: { id: invoices.map((i) => i.dataValues.booking_id).concat([-1]) }, attributes: ["id", "uuid", "booking_no", "title", "start_date"], raw: true }) as any[]).map((b) => [b.id, b]));
    let outstanding = 0;
    const buckets = { overdue: [] as any[], due_now: [] as any[], this_week: [] as any[], this_month: [] as any[] };
    const in7 = day(7), in30 = day(30);
    for (const inv of invoices) {
        const x = inv.toJSON();
        if (!allowed.has(x.booking_id)) continue;
        outstanding += Math.max(0, Number(x.total) - Number(x.amount_paid));
        const bk: any = bookingBy.get(x.booking_id);
        for (const p of unpaidParts(x)) {
            const due = p.due_date || bk?.start_date || null;
            const item = {
                invoice_id: x.uuid, invoice_no: x.number, label: p.label, amount: toRupees(p.amount), due_date: due,
                client: x.student?.username || null, phone: phoneOf(x.student), booking_id: bk?.uuid || null, booking_no: bk?.booking_no || null, trip: bk?.title || x.title,
                link: x.payment_link_url || null,
            };
            if (!due) buckets.this_month.push(item);
            else if (due < today) buckets.overdue.push(item);
            else if (due === today) buckets.due_now.push(item);
            else if (due <= in7) buckets.this_week.push(item);
            else if (due <= in30) buckets.this_month.push(item);
        }
    }
    for (const k of Object.keys(buckets) as (keyof typeof buckets)[]) buckets[k].sort((x, y) => String(x.due_date || "9").localeCompare(String(y.due_date || "9")));

    // ---- vendor dues (cost roles)
    let vendorDues = 0;
    if (cost) {
        const svc: any[] = await BookingService.findAll({ where: { agency_uuid: a.agencyUuid, booking_id: { [Op.in]: [...allowed].concat([-1]) } }, attributes: ["status", "cost", "cancel_charge", "supplier_paid", "supplier_refunded"], raw: true });
        vendorDues = svc.reduce((s, r) => s + supplierOwed(r), 0);
    }

    // ---- quotes: recent activity and conversion
    const quotes: any[] = await Quotation.findAll({ where: { ...scope, status: { [Op.ne]: "superseded" } }, attributes: ["uuid", "number", "title", "status", "sell_total", "crm_lead_id", "createdAt", "updatedAt"], order: [["updatedAt", "DESC"]], raw: true });
    const quotesInRange = quotes.filter((q) => new Date(q.createdAt) >= from);
    const leadIds = [...new Set(quotes.slice(0, 10).map((q) => q.crm_lead_id).filter(Boolean))];
    const leadNames = new Map((await CrmLead.findAll({ where: { id: leadIds.concat([-1]) }, attributes: ["id", "name"], raw: true }) as any[]).map((l) => [l.id, l.name]));
    const recent = [
        ...quotes.slice(0, 8).map((q) => ({ kind: "quote", id: q.uuid, number: q.number, title: q.title, who: leadNames.get(q.crm_lead_id) || null, amount: toRupees(q.sell_total), status: q.status, at: q.updatedAt })),
        ...[...all].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()).slice(0, 8).map((b) => ({ kind: "booking", id: b.uuid, number: b.booking_no, title: b.title, who: b.destination || null, amount: toRupees(b.total_sell), status: "confirmed", at: b.createdAt })),
    ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime()).slice(0, 8);

    // ---- leads: follow-ups (missed and due today) and lead → won in the period
    const leadWhere = { ...leadScope(req), business_line: "travel" };
    const endOfToday = new Date(`${today}T23:59:59+05:30`), startOfToday = new Date(`${today}T00:00:00+05:30`);
    const fu: any[] = await CrmLead.findAll({
        where: { ...leadWhere, status: { [Op.in]: OPEN_LEAD }, next_follow_up_at: { [Op.ne]: null, [Op.lte]: endOfToday } },
        attributes: ["uuid", "name", "phone_normalized", "next_follow_up_at", "follow_up_note", "status", "destinations"], order: [["next_follow_up_at", "ASC"]], limit: 40, raw: true,
    });
    const followups = fu.map((l) => ({ id: l.uuid, name: l.name, phone: String(l.phone_normalized || "").replace(/\D/g, ""), at: l.next_follow_up_at, note: l.follow_up_note, missed: new Date(l.next_follow_up_at) < startOfToday, destinations: Array.isArray(l.destinations) ? l.destinations : (() => { try { return JSON.parse(l.destinations || "[]"); } catch { return []; } })() }));
    const periodLeads: any[] = await CrmLead.findAll({ where: { ...leadWhere, createdAt: { [Op.gte]: from } }, attributes: ["status"], raw: true });

    // ---- trips: live today and departing in the next 7 days
    const trips = await tripLists(req, scope, 7);

    return {
        days,
        kpis: {
            bookings: inRange.length, bookings_change: pct(inRange.length, prev.length),
            revenue: toRupees(revenue), revenue_change: pct(revenue, revenuePrev),
            ...(cost ? { profit: toRupees(profit), profit_change: pct(profit, profitPrev), vendor_dues: toRupees(vendorDues) } : {}),
            customer_outstanding: toRupees(outstanding),
        },
        series,
        recent,
        all_time: {
            revenue: toRupees(all.reduce((s, b) => s + Number(b.total_sell), 0)),
            ...(cost ? { profit: toRupees(all.reduce((s, b) => s + profitOf(b), 0)) } : {}),
            pending_payments: toRupees(outstanding),
            quotes: quotes.length, quotes_booked: quotes.filter((q) => q.status === "accepted").length,
            quote_conversion: quotes.length ? Math.round((quotes.filter((q) => q.status === "accepted").length / quotes.length) * 1000) / 10 : 0,
        },
        payment_followups: buckets,
        lead_followups: { missed: followups.filter((f) => f.missed), today: followups.filter((f) => !f.missed) },
        trips: { live: trips.live.slice(0, 8), upcoming: trips.upcoming.slice(0, 8) },
        conversion: {
            leads: periodLeads.length, leads_won: periodLeads.filter((l) => l.status === "converted").length,
            lead_rate: periodLeads.length ? Math.round((periodLeads.filter((l) => l.status === "converted").length / periodLeads.length) * 1000) / 10 : 0,
            quotes: quotesInRange.length, quotes_booked: quotesInRange.filter((q) => q.status === "accepted").length,
            quote_rate: quotesInRange.length ? Math.round((quotesInRange.filter((q) => q.status === "accepted").length / quotesInRange.length) * 1000) / 10 : null,
        },
        sees_cost: cost,
    };
};

/** Trips on the road today and departing within `ahead` days, with what is happening today and what is still open. */
const tripLists = async (req: RequestWithUser, scope: any, ahead: number) => {
    const today = day(), until = day(ahead);
    const rows: any[] = await Booking.findAll({
        where: { ...scope, status: { [Op.in]: ["confirmed", "in_progress"] }, start_date: { [Op.ne]: null, [Op.lte]: until }, [Op.or]: [{ end_date: { [Op.gte]: today } }, { end_date: null, start_date: { [Op.gte]: today } }] },
        include: [{ model: User, as: "client", attributes: ["username", "phone_number", "country_code"], required: false }, { model: ClientInvoice, as: "invoice", attributes: ["total", "amount_paid"], required: false }],
        order: [["start_date", "ASC"]], limit: 100,
    });
    const ids = rows.map((r) => r.dataValues.id);
    const svc: any[] = await BookingService.findAll({
        where: { booking_id: ids.concat([-1]) }, attributes: ["booking_id", "type", "description", "status", "service_date", "end_date", "confirmation_no", "details", "supplier_id"],
        include: [{ model: TravelSupplier, as: "supplier", attributes: ["name", "phone"], required: false }], order: [["service_date", "ASC"]],
    });
    const out = rows.map((r) => {
        const x = r.toJSON();
        const mine = svc.map((s) => s.toJSON()).filter((s: any) => s.booking_id === x.id && s.status !== "cancelled");
        const totalDays = x.end_date ? Math.max(1, Math.round((Date.parse(x.end_date) - Date.parse(x.start_date)) / 864e5) + 1) : 1;
        const dayNo = Math.round((Date.parse(today) - Date.parse(x.start_date)) / 864e5) + 1;
        const live = x.start_date <= today && (x.end_date || x.start_date) >= today;
        const on = (s: any) => s.service_date === today || (s.service_date && s.end_date && s.service_date <= today && s.end_date > today);
        const balance = x.invoice ? Math.max(0, Number(x.invoice.total) - Number(x.invoice.amount_paid)) : null;
        return {
            id: x.uuid, booking_no: x.booking_no, title: x.title, destination: x.destination, is_international: Boolean(x.is_international),
            start_date: x.start_date, end_date: x.end_date, live, day_no: live ? dayNo : null, total_days: totalDays,
            starts_in: live ? 0 : Math.round((Date.parse(x.start_date) - Date.parse(today)) / 864e5),
            client: x.client?.username || null, phone: phoneOf(x.client),
            today: mine.filter(on).map((s: any) => ({ type: s.type, description: s.description, status: s.status, confirmation_no: s.confirmation_no, supplier: s.supplier?.name || null, supplier_phone: s.supplier?.phone || null, time: s.details?.pickup_time || s.details?.time || s.details?.depart_time || null })),
            next: mine.filter((s: any) => s.service_date && s.service_date > today).slice(0, 2).map((s: any) => ({ type: s.type, description: s.description, date: s.service_date })),
            pending_services: mine.filter((s: any) => s.status === "requested").length,
            services: mine.length,
            invoice: x.invoice_id ? { balance: balance === null ? null : toRupees(balance) } : null,
            ops_owner_id: x.ops_owner_id,
        };
    });
    return { live: out.filter((t) => t.live), upcoming: out.filter((t) => !t.live) };
};

/** Live Trips page: everything on the road today and the next 30 days. */
export const liveTrips = async (req: RequestWithUser) => {
    const scope = await bookingScope(req);
    const t = await tripLists(req, scope, 30);
    return { ...t, today: day() };
};
