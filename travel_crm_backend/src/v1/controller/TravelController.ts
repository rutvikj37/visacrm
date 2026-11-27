import crypto from "crypto";
import { Response } from "express";
import { Op } from "sequelize";
import sequelize from "../../config/dbconfig";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, leadScope } from "../../helpers/access";
import { decryptPii, encryptPii } from "../../helpers/crypto";
import Agent from "../../model/Agent";
import User from "../../model/User";
import CrmLead from "../../model/CrmLead";
import ClientInvoice from "../../model/ClientInvoice";
import { Booking, BookingService, BookingTraveller, Itinerary, LibraryItem, Quotation, SupplierRate, TourPackage, TravelSupplier } from "../../model/Travel";
import { audit } from "../../services/audit";
import { ingestLead, logActivity } from "../../services/leadIngestion";
import { hasModule } from "../../services/modules";
import {
    cleanLines, getTravelTax, lineCost, lineHidden, lineMarkup, nextTravelNumber, quoteOptionTotals, redactCost, seesCost, storedLines,
    SERVICE_TYPES, splitGst, stateOfGstin, toPaise, toRupees, totalsInRupees,
    SUPPLIER_MONEY_COLS, serviceCost, supplierOwed, supplierRefundDue,
} from "../../services/travel";
import { nextNumber, readBilling } from "./FeesController";
import { travelDashboard } from "../../services/travelDashboard";
import { runTrigger } from "../../services/messaging";

/**
 * Travel CRM for agencies: /api/v1/travel/...
 * Module guards (itinerary, bookings, suppliers) run in validateAgent from the URL (services/modules.ts).
 * Amounts are rupees in the API and paise in the database. Cost and margin are removed for roles
 * that may not see them (services/travel.ts → redactCost).
 */

const str = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).replace(/\u0000/g, "").trim().slice(0, max) || null);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const int = (v: any, fallback = 0, max = 100000) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
};
const ok = (res: Response, message: string, data?: any) => returnHelper(res, 200, true, message, data);
const no = (res: Response, message: string) => returnHelper(res, 200, false, message);
const fail = (res: Response, error: any, where: string) => {
    console.error(`TravelController.${where}`, error);
    return returnHelper(res, 200, false, error?.expose ? error.message : "Something went wrong, please try again");
};
class UserError extends Error { expose = true; }

const ctx = (req: RequestWithUser) => {
    const a = accessOf(req);
    return { ...a, agencyUuid: a.agencyUuid };
};

/** Records a team member may see: owner / accounts / whole-agency roles see all; branch roles their branch; others their own. */
const recordScope = async (req: RequestWithUser) => {
    const a = accessOf(req);
    const base: any = { agency_uuid: a.agencyUuid };
    if (a.isOwner || a.teamRole === "accounts" || a.seesAll) return base;
    if ((a.teamRole === "branch_manager" || a.teamRole === "operations") && a.branchId) return { ...base, branch_id: a.branchId };
    if (a.teamRole === "operations") return base;
    const leads: any[] = await CrmLead.findAll({ where: leadScope(req), attributes: ["id"], raw: true });
    return { ...base, [Op.or]: [{ created_by: a.userId }, { crm_lead_id: { [Op.in]: leads.map((l) => l.id).concat([-1]) } }] };
};

const findLead = async (req: RequestWithUser, uuid?: string | null) => {
    if (!uuid) return null;
    return CrmLead.findOne({ where: { ...leadScope(req), uuid } }) as Promise<any>;
};

const agencyBrand = async (agencyUuid: string) => {
    const ag: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["id", "uuid", "username", "app_name", "primary_color", "support_number", "support_email", "agency_address", "favicon_url", "billing_settings", "sudomain", "domain"],
        raw: true,
    });
    return ag;
};

// ---------------------------------------------------------------- presenters

const presentLibrary = (x: any) => ({
    id: x.uuid, type: x.type, name: x.name, destination: x.destination, star: x.star, description: x.description,
    photos: Array.isArray(x.photos) ? x.photos : [], default_supplier_id: x.default_supplier_id,
});

const presentSupplier = (x: any) => ({
    id: x.uuid, db_id: x.id, type: x.type, name: x.name, contact_name: x.contact_name, phone: x.phone, email: x.email,
    city: x.city, country: x.country, gstin: x.gstin, pan: x.pan, notes: x.notes, has_bank: Boolean(x.bank_enc),
});

const presentRate = (x: any) => ({
    id: x.uuid, db_id: x.id, supplier_id: x.supplier_id, service: x.service, service_type: x.service_type, room_type: x.room_type,
    meal_plan: x.meal_plan, pax_type: x.pax_type, season: x.season, valid_from: x.valid_from, valid_to: x.valid_to,
    cost: toRupees(x.cost), currency: x.currency, supplier_name: x.supplier?.name,
});

const isUrl = (u: any) => /^https?:\/\//.test(String(u || ""));
/** Photo list from `images` (new) or a single `image` (older itineraries); http(s) URLs only. */
const photos = (x: any, max: number) => {
    const list = Array.isArray(x?.images) ? x.images : x?.image ? [x.image] : [];
    return [...new Set(list.filter(isUrl).map((u: any) => String(u).slice(0, 500)))].slice(0, max) as string[];
};
const cleanDays = (raw: any) => {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 60).map((d: any, i: number) => {
        const dayImages = photos(d, 8);
        return {
            day: i + 1,
            title: str(d?.title, 200) || `Day ${i + 1}`,
            city: str(d?.city, 120),
            notes: str(d?.notes, 3000),
            images: dayImages,
            image: dayImages[0] || null, // first photo, kept for older screens
            items: (Array.isArray(d?.items) ? d.items : []).slice(0, 30).map((it: any) => {
                const itemImages = photos(it, 6);
                return {
                    type: ["hotel", "sightseeing", "transfer", "meal", "flight", "activity", "note"].includes(it?.type) ? it.type : "note",
                    text: str(it?.text, 1000) || "",
                    library_item_id: it?.library_item_id ? String(it.library_item_id).slice(0, 64) : null,
                    images: itemImages,
                    image: itemImages[0] || null,
                };
            }).filter((it: any) => it.text),
        };
    });
};

const presentItinerary = (x: any, lead?: any) => ({
    id: x.uuid, title: x.title, destination: x.destination, nights: x.nights, start_date: x.start_date, is_template: Boolean(x.is_template),
    days: Array.isArray(x.days) ? x.days : [], inclusions: x.inclusions, exclusions: x.exclusions, terms: x.terms,
    cancellation_policy: x.cancellation_policy, status: x.status, client_note: x.client_note,
    share_token: x.share_token, theme: x.theme || "classic", cover_image: x.cover_image || null,
    lead: lead ? { id: lead.uuid, name: lead.name } : undefined, updatedAt: x.updatedAt,
});

const optionTotals = (q: any, opt: any) => quoteOptionTotals(q, opt);
const cleanLinesFromStored = storedLines;

/** Trip block of the quote builder: domestic / international, state, place, dates. */
const cleanTrip = (raw: any) => {
    const t = raw && typeof raw === "object" ? raw : {};
    const start = date(t.start_date), end = date(t.end_date);
    return {
        destination_type: t.destination_type === "international" ? "international" : "domestic",
        state: str(t.state, 80), place: str(t.place, 200), country: str(t.country, 80),
        start_date: start, end_date: end && start && end < start ? start : end,
    };
};
const cleanTravellers = (raw: any) => (Array.isArray(raw) ? raw : []).slice(0, 40)
    .map((t: any) => ({ name: str(t?.name, 120), pax_type: ["adult", "child", "infant"].includes(t?.pax_type) ? t.pax_type : "adult", age: t?.age === "" || t?.age === null || t?.age === undefined ? null : int(t.age, 0, 120) }))
    .filter((t: any) => t.name);
const cleanPaymentTerms = (raw: any) => (Array.isArray(raw) ? raw : []).slice(0, 8).map((p: any, i: number) => ({
    label: str(p?.label, 60) || `Instalment ${i + 1}`,
    percent: Math.max(0, Math.min(100, Math.round(Number(p?.percent) * 100) / 100 || 0)),
    due: ["booking", "before_travel", "date"].includes(p?.due) ? p.due : "booking",
    days: p?.due === "before_travel" ? int(p?.days, 0, 365) : null,
    date: p?.due === "date" ? date(p?.date) : null,
})).filter((p: any) => p.percent > 0);
const THEMES = ["classic", "modern", "elegant"];
const cleanDesign = (raw: any) => {
    const d = raw && typeof raw === "object" ? raw : {};
    return {
        theme: THEMES.includes(d.theme) ? d.theme : "classic",
        cover_image: isUrl(d.cover_image) ? String(d.cover_image).slice(0, 500) : null,
        show_price: d.show_price === undefined ? true : Boolean(d.show_price),
        show_breakup: d.show_breakup === undefined ? true : Boolean(d.show_breakup),
        show_per_person: d.show_per_person === undefined ? true : Boolean(d.show_per_person),
    };
};

const presentQuote = (x: any, lead?: any) => {
    const options = (Array.isArray(x.options) ? x.options : []).map((o: any) => {
        const lines = cleanLinesFromStored(o.lines);
        return {
            name: o.name,
            lines: lines.map((l) => ({
                ...l, unit_cost: toRupees(l.unit_cost), markup_value: l.markup_type === "flat" ? toRupees(l.markup_value) : l.markup_value,
                hidden_markup: toRupees(lineHidden(l)),
                line_cost: toRupees(lineCost(l)), line_markup: toRupees(lineMarkup(l)), line_sell: toRupees(lineCost(l) + lineMarkup(l)),
            })),
            totals: totalsInRupees(optionTotals(x, o)),
        };
    });
    return {
        id: x.uuid, number: x.number, version: x.version, title: x.title, status: x.status, is_international: Boolean(x.is_international),
        adults: x.adults, children: x.children, infants: x.infants, billing_mode: x.billing_mode, gst_percent: Number(x.gst_percent),
        tcs_percent: Number(x.tcs_percent), discount: toRupees(x.discount), chosen_option: x.chosen_option, valid_until: x.valid_until,
        notes: x.notes, sent_at: x.sent_at, options, cost_total: toRupees(x.cost_total), sell_total: toRupees(x.sell_total),
        kind: x.kind || "quote", trip: cleanTrip(x.trip), travellers: Array.isArray(x.travellers) ? x.travellers : [],
        cost_mode: x.cost_mode === "combined" ? "combined" : "per_service", gst_inclusive: Boolean(x.gst_inclusive),
        inclusions: x.inclusions || "", exclusions: x.exclusions || "", terms: x.terms || "",
        payment_terms: Array.isArray(x.payment_terms) ? x.payment_terms : [], internal_notes: x.internal_notes || "",
        design: cleanDesign(x.design), step: Number(x.step) || 1,
        itinerary_id: x.itinerary?.uuid || null, lead: lead ? { id: lead.uuid, name: lead.name, phone: `${lead.country_code || ""}${lead.phone_number || ""}`, email: lead.email || null } : undefined,
        createdAt: x.createdAt,
    };
};

const presentService = (x: any) => ({
    id: x.uuid, type: x.type, description: x.description, supplier_id: x.supplier_id, supplier_name: x.supplier?.name || null,
    confirmation_no: x.confirmation_no, status: x.status, service_date: x.service_date, end_date: x.end_date,
    cost: toRupees(x.cost), sell: toRupees(x.sell), details: x.details || {}, supplier_due_date: x.supplier_due_date,
    supplier_paid: toRupees(x.supplier_paid), supplier_due: toRupees(supplierOwed(x)),
    supplier_payments: (Array.isArray(x.supplier_payments) ? x.supplier_payments : []).map((p: any) => ({ ...p, amount: toRupees(p.amount) })),
    cancelled_at: x.cancelled_at || null, supplier_cancel_charge: x.status === "cancelled" ? toRupees(x.cancel_charge || 0) : null,
    supplier_refunded: toRupees(x.supplier_refunded || 0), supplier_refund_due: toRupees(supplierRefundDue(x)),
    supplier_refunds: (Array.isArray(x.supplier_refunds) ? x.supplier_refunds : []).map((p: any) => ({ ...p, amount: toRupees(p.amount) })),
});

const presentTraveller = (x: any) => ({
    id: x.uuid, pax_type: x.pax_type, name: x.name, dob: x.dob, gender: x.gender, nationality: x.nationality,
    passport_masked: x.passport_last4 ? `••••${x.passport_last4}` : null, passport_expiry: x.passport_expiry,
    has_pan: Boolean(x.pan_enc), meal_pref: x.meal_pref, seat_pref: x.seat_pref, is_lead: Boolean(x.is_lead),
});

const bookingTax = (b: any) => {
    const sell = Number(b.total_sell || 0), cost = Number(b.total_cost || 0);
    const taxable = b.billing_mode === "margin" ? Math.max(0, sell - cost - Number(b.hidden_markup || 0)) : sell;
    const gst = Math.round(taxable * Number(b.gst_percent || 0) / 100);
    const tcs = b.is_international ? Math.round((sell + gst) * Number(b.tcs_percent || 0) / 100) : 0;
    // real profit: selling value less credit notes, less what suppliers really keep (cancellation charges included)
    return { taxable, gst, tcs, total: sell + gst + tcs, profit: sell - Number(b.credited || 0) - cost };
};

const presentBooking = (x: any) => {
    const t = bookingTax(x);
    return {
        id: x.uuid, booking_no: x.booking_no, title: x.title, destination: x.destination, is_international: Boolean(x.is_international),
        start_date: x.start_date, end_date: x.end_date, status: x.status, notes: x.notes,
        total_sell: toRupees(x.total_sell), total_cost: toRupees(x.total_cost), discount: toRupees(x.discount),
        billing_mode: x.billing_mode, gst_percent: Number(x.gst_percent), tcs_percent: Number(x.tcs_percent),
        gst: toRupees(t.gst), tcs: toRupees(t.tcs), client_total: toRupees(t.total), profit: toRupees(t.profit),
        credited: toRupees(x.credited || 0), cancel_reason: x.cancel_reason || null, cancelled_at: x.cancelled_at || null,
        cancel_charge: x.cancel_charge === null || x.cancel_charge === undefined ? null : toRupees(x.cancel_charge),
        client: x.client ? { id: x.client.id, name: x.client.username, phone: `${x.client.country_code || ""} ${x.client.phone_number || ""}`.trim(), email: x.client.email } : undefined,
        ops_owner_id: x.ops_owner_id, invoice_id: x.invoice?.uuid || null, invoice_number: x.invoice?.number || null,
        lead_id: x.lead?.uuid || null, quotation_id: x.quotation?.uuid || null, itinerary_id: x.itinerary?.uuid || null, createdAt: x.createdAt,
    };
};

/** total_cost = what suppliers really keep: full cost of live services plus cancellation charges of cancelled ones. */
export const recalcBookingCost = async (bookingId: number, t?: any) => {
    const rows: any[] = await BookingService.findAll({ where: { booking_id: bookingId }, attributes: ["status", "cost", "cancel_charge"], raw: true, transaction: t });
    await Booking.update({ total_cost: rows.reduce((a, r) => a + serviceCost(r), 0) }, { where: { id: bookingId }, transaction: t });
};

// ---------------------------------------------------------------- controller

class TravelController {
    // GET /travel/summary - dashboard tiles: departures, money this month, supplier dues, open quotes
    async summary(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const today = new Date().toISOString().slice(0, 10);
            const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
            const monthStart = `${today.slice(0, 7)}-01`;
            const scope = await recordScope(req);
            const [upcoming, monthBookings, openQuotes, enquiries] = await Promise.all([
                (await hasModule(agencyUuid, "bookings")) ? Booking.findAll({
                    where: { ...scope, status: { [Op.ne]: "cancelled" }, start_date: { [Op.between]: [today, in30] } },
                    include: [{ model: User, as: "client", attributes: ["id", "username", "country_code", "phone_number"], required: false }],
                    order: [["start_date", "ASC"]], limit: 10,
                }) : [],
                Booking.findAll({ where: { ...scope, status: { [Op.ne]: "cancelled" }, createdAt: { [Op.gte]: new Date(monthStart) } }, raw: true }),
                Quotation.count({ where: { ...scope, status: { [Op.in]: ["draft", "sent"] } } }),
                CrmLead.count({ where: { ...leadScope(req), business_line: "travel", createdAt: { [Op.gte]: new Date(monthStart) } } }),
            ]);
            const sell = monthBookings.reduce((a: number, b: any) => a + Number(b.total_sell || 0), 0);
            const cost = monthBookings.reduce((a: number, b: any) => a + Number(b.total_cost || 0) + Number(b.credited || 0), 0);
            const dueRows: any[] = await BookingService.findAll({
                where: { agency_uuid: agencyUuid, supplier_id: { [Op.ne]: null } },
                attributes: SUPPLIER_MONEY_COLS, raw: true,
            });
            const supplierDue = dueRows.reduce((a, r) => a + supplierOwed(r), 0);
            const supplierOverdue = dueRows.filter((r) => r.supplier_due_date && r.supplier_due_date < today).reduce((a, r) => a + supplierOwed(r), 0);
            const data = {
                enquiries_this_month: enquiries,
                bookings_this_month: monthBookings.length,
                revenue_this_month: toRupees(sell),
                profit_this_month: toRupees(sell - cost),
                open_quotes: openQuotes,
                supplier_due: toRupees(supplierDue),
                supplier_overdue: toRupees(supplierOverdue),
                upcoming: (upcoming as any[]).map((b) => presentBooking(b.toJSON())),
            };
            return ok(res, "Summary", redactCost(data, req));
        } catch (error) { return fail(res, error, "summary"); }
    }

    // GET /travel/dashboard - travel KPIs and today's action lists (Today page, Travel desk)
    async dashboard(req: RequestWithUser, res: Response) {
        try {
            return ok(res, "Travel dashboard", await travelDashboard(req));
        } catch (error) { return fail(res, error, "dashboard"); }
    }

    // ------------------------------------------------------------ library

    async listLibrary(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const where: any = { agency_uuid: agencyUuid };
            if (req.query.type) where.type = String(req.query.type);
            if (req.query.search) where[Op.or] = [{ name: { [Op.like]: `%${req.query.search}%` } }, { destination: { [Op.like]: `%${req.query.search}%` } }];
            const rows = await LibraryItem.findAll({ where, order: [["destination", "ASC"], ["name", "ASC"]], limit: 500 });
            return ok(res, "Library", rows.map((r: any) => presentLibrary(r.toJSON())));
        } catch (error) { return fail(res, error, "listLibrary"); }
    }

    async saveLibrary(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const b = req.body || {};
            const name = str(b.name);
            if (!name) return no(res, "Please enter a name");
            const values = {
                type: ["destination", "hotel", "activity", "transfer", "meal", "note"].includes(b.type) ? b.type : "activity",
                name, destination: str(b.destination), star: b.star ? int(b.star, 0, 7) : null, description: str(b.description, 5000),
                photos: Array.isArray(b.photos) ? b.photos.map((p: any) => str(p, 500)).filter(Boolean).slice(0, 8) : null,
            };
            if (req.params.uuid) {
                const row: any = await LibraryItem.findOne({ where: { agency_uuid: agencyUuid, uuid: req.params.uuid } });
                if (!row) return no(res, "Item not found");
                await row.update(values);
                return ok(res, "Saved", presentLibrary(row.toJSON()));
            }
            const row: any = await LibraryItem.create({ ...values, agency_uuid: agencyUuid, created_by: userId });
            return ok(res, "Added to library", presentLibrary(row.toJSON()));
        } catch (error) { return fail(res, error, "saveLibrary"); }
    }

    async deleteLibrary(req: RequestWithUser, res: Response) {
        try {
            const n = await LibraryItem.destroy({ where: { agency_uuid: ctx(req).agencyUuid, uuid: req.params.uuid } });
            return n ? ok(res, "Removed") : no(res, "Item not found");
        } catch (error) { return fail(res, error, "deleteLibrary"); }
    }

    // ------------------------------------------------------------ suppliers

    async listSuppliers(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const where: any = { agency_uuid: agencyUuid };
            if (req.query.type) where.type = String(req.query.type);
            if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` };
            const rows: any[] = await TravelSupplier.findAll({ where, order: [["name", "ASC"]], limit: 500 });
            const dues: any[] = await BookingService.findAll({
                where: { agency_uuid: agencyUuid, supplier_id: { [Op.in]: rows.map((r) => r.dataValues.id).concat([-1]) } },
                attributes: ["supplier_id", ...SUPPLIER_MONEY_COLS], raw: true,
            });
            const dueBy = new Map<number, number>();
            for (const d of dues) dueBy.set(d.supplier_id, (dueBy.get(d.supplier_id) || 0) + supplierOwed(d));
            const data = rows.map((r) => ({ ...presentSupplier(r.toJSON()), supplier_due: toRupees(dueBy.get(r.dataValues.id) || 0) }));
            return ok(res, "Suppliers", redactCost(data, req));
        } catch (error) { return fail(res, error, "listSuppliers"); }
    }

    async supplierDetails(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const s: any = await TravelSupplier.findOne({ where: { agency_uuid: agencyUuid, uuid: req.params.uuid } });
            if (!s) return no(res, "Supplier not found");
            const [rates, services] = await Promise.all([
                SupplierRate.findAll({ where: { agency_uuid: agencyUuid, supplier_id: s.dataValues.id }, order: [["service", "ASC"], ["valid_from", "ASC"]] }),
                BookingService.findAll({
                    where: { agency_uuid: agencyUuid, supplier_id: s.dataValues.id },
                    include: [{ model: Booking, as: "booking", attributes: ["uuid", "booking_no", "title", "start_date"], required: false }],
                    order: [["service_date", "DESC"]], limit: 200,
                }),
            ]);
            const ledger = services.map((x: any) => {
                const j = x.toJSON();
                return { ...presentService(j), booking: j.booking ? { id: j.booking.uuid, booking_no: j.booking.booking_no, title: j.booking.title, start_date: j.booking.start_date } : null };
            });
            const data = {
                supplier: presentSupplier(s.toJSON()),
                rates: rates.map((r: any) => presentRate(r.toJSON())),
                ledger,
                supplier_payable: toRupees(services.reduce((a: number, x: any) => a + serviceCost(x.dataValues), 0)),
                supplier_paid_total: toRupees(services.reduce((a: number, x: any) => a + Number(x.dataValues.supplier_paid) - Number(x.dataValues.supplier_refunded || 0), 0)),
                supplier_due: toRupees(services.reduce((a: number, x: any) => a + supplierOwed(x.dataValues), 0)),
                supplier_refund_due: toRupees(services.reduce((a: number, x: any) => a + supplierRefundDue(x.dataValues), 0)),
            };
            return ok(res, "Supplier", redactCost(data, req));
        } catch (error) { return fail(res, error, "supplierDetails"); }
    }

    async saveSupplier(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const b = req.body || {};
            const name = str(b.name);
            if (!name) return no(res, "Please enter the supplier name");
            const gstin = str(b.gstin, 20);
            if (gstin && !/^\d{2}[A-Z0-9]{13}$/i.test(gstin)) return no(res, "GSTIN should be 15 characters, starting with the 2-digit state code");
            const values: any = {
                type: ["hotel", "dmc", "transport", "airline", "activity", "other"].includes(b.type) ? b.type : "other",
                name, contact_name: str(b.contact_name), phone: str(b.phone, 40), email: str(b.email), city: str(b.city), country: str(b.country),
                gstin: gstin ? gstin.toUpperCase() : null, pan: str(b.pan, 12), notes: str(b.notes, 3000),
            };
            if (b.bank_details) values.bank_enc = encryptPii(String(b.bank_details).slice(0, 1000));
            if (req.params.uuid) {
                const row: any = await TravelSupplier.findOne({ where: { agency_uuid: agencyUuid, uuid: req.params.uuid } });
                if (!row) return no(res, "Supplier not found");
                await row.update(values);
                return ok(res, "Supplier saved", presentSupplier(row.toJSON()));
            }
            const row: any = await TravelSupplier.create({ ...values, agency_uuid: agencyUuid, created_by: userId });
            return ok(res, "Supplier added", presentSupplier(row.toJSON()));
        } catch (error) { return fail(res, error, "saveSupplier"); }
    }

    async deleteSupplier(req: RequestWithUser, res: Response) {
        try {
            const n = await TravelSupplier.destroy({ where: { agency_uuid: ctx(req).agencyUuid, uuid: req.params.uuid } });
            return n ? ok(res, "Supplier removed") : no(res, "Supplier not found");
        } catch (error) { return fail(res, error, "deleteSupplier"); }
    }

    // GET /travel/suppliers/rates?search= - rate picker for quotes
    async searchRates(req: RequestWithUser, res: Response) {
        try {
            if (!seesCost(req)) return ok(res, "Rates", []);
            const { agencyUuid } = ctx(req);
            const where: any = { agency_uuid: agencyUuid };
            if (req.query.search) where.service = { [Op.like]: `%${req.query.search}%` };
            if (req.query.ids) where.id = String(req.query.ids).split(",").map(Number).filter(Boolean).slice(0, 60);
            const on = date(req.query.date);
            if (on) Object.assign(where, { [Op.and]: [{ [Op.or]: [{ valid_from: null }, { valid_from: { [Op.lte]: on } }] }, { [Op.or]: [{ valid_to: null }, { valid_to: { [Op.gte]: on } }] }] });
            const rows = await SupplierRate.findAll({ where, include: [{ model: TravelSupplier, as: "supplier", attributes: ["name"], required: false }], limit: 50, order: [["service", "ASC"]] });
            return ok(res, "Rates", rows.map((r: any) => presentRate(r.toJSON())));
        } catch (error) { return fail(res, error, "searchRates"); }
    }

    async saveRate(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const s: any = await TravelSupplier.findOne({ where: { agency_uuid: agencyUuid, uuid: req.params.uuid }, attributes: ["id"] });
            if (!s) return no(res, "Supplier not found");
            const b = req.body || {};
            const service = str(b.service);
            if (!service) return no(res, "Please describe the service, e.g. Deluxe room");
            const row: any = await SupplierRate.create({
                agency_uuid: agencyUuid, supplier_id: s.dataValues.id, service,
                service_type: ["hotel", "transfer", "activity", "flight", "meal", "visa", "insurance", "other"].includes(b.service_type) ? b.service_type : "other",
                room_type: str(b.room_type), meal_plan: str(b.meal_plan, 20),
                pax_type: ["per_room", "per_adult", "per_child", "per_infant", "per_unit"].includes(b.pax_type) ? b.pax_type : "per_unit",
                season: str(b.season), valid_from: date(b.valid_from), valid_to: date(b.valid_to), cost: toPaise(b.cost), currency: str(b.currency, 3) || "INR",
            });
            return ok(res, "Rate added", presentRate(row.toJSON()));
        } catch (error) { return fail(res, error, "saveRate"); }
    }

    async deleteRate(req: RequestWithUser, res: Response) {
        try {
            const n = await SupplierRate.destroy({ where: { agency_uuid: ctx(req).agencyUuid, uuid: req.params.uuid } });
            return n ? ok(res, "Rate removed") : no(res, "Rate not found");
        } catch (error) { return fail(res, error, "deleteRate"); }
    }

    // ------------------------------------------------------------ itineraries

    async listItineraries(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const where: any = req.query.templates === "1" ? { agency_uuid: ctx(req).agencyUuid, is_template: true } : { ...scope, is_template: false };
            if (req.query.lead) {
                const lead = await findLead(req, String(req.query.lead));
                if (!lead) return ok(res, "Itineraries", []);
                where.crm_lead_id = lead.dataValues.id;
            }
            if (req.query.search) where.title = { [Op.like]: `%${req.query.search}%` };
            const rows: any[] = await Itinerary.findAll({ where, order: [["updatedAt", "DESC"]], limit: 200 });
            const leads: any[] = await CrmLead.findAll({ where: { id: rows.map((r) => r.dataValues.crm_lead_id).filter(Boolean).concat([-1]) }, attributes: ["id", "uuid", "name"], raw: true });
            const byId = new Map(leads.map((l) => [l.id, l]));
            return ok(res, "Itineraries", rows.map((r) => presentItinerary(r.toJSON(), byId.get(r.dataValues.crm_lead_id))));
        } catch (error) { return fail(res, error, "listItineraries"); }
    }

    // POST /travel/itineraries { title?, lead_id?, template_id?, copy_from?, is_template? }
    async createItinerary(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, branchId } = ctx(req);
            const b = req.body || {};
            const lead = await findLead(req, b.lead_id);
            if (b.lead_id && !lead) return no(res, "Lead not found");
            let source: any = null;
            const fromId = b.template_id || b.copy_from;
            if (fromId) {
                source = await Itinerary.findOne({ where: { agency_uuid: agencyUuid, uuid: fromId } });
                if (!source) return no(res, "Template not found");
            }
            const s = source ? source.toJSON() : {};
            const l = lead ? lead.toJSON() : {};
            const nights = source ? s.nights : int(b.nights || l.nights, 0, 90);
            const destination = str(b.destination) || s.destination || (Array.isArray(l.destinations) ? l.destinations.join(", ") : null) || l.interested_country || null;
            const days = source ? s.days : Array.from({ length: Math.max(1, nights + 1) }, (_, i) => ({ day: i + 1, title: i === 0 ? "Arrival" : `Day ${i + 1}`, city: null, notes: null, items: [] }));
            const row: any = await Itinerary.create({
                agency_uuid: agencyUuid, crm_lead_id: lead?.dataValues.id || null, is_template: Boolean(b.is_template),
                title: str(b.title) || (source ? s.title : null) || `${destination || "Trip"} ${nights}N/${nights + 1}D`,
                destination, nights, start_date: date(b.start_date) || l.travel_start || null, days,
                inclusions: s.inclusions || null, exclusions: s.exclusions || null, terms: s.terms || null, cancellation_policy: s.cancellation_policy || null,
                theme: s.theme || "classic", cover_image: s.cover_image || null,
                branch_id: lead?.dataValues.branch_id || branchId || null, created_by: userId,
            });
            if (lead) await logActivity(lead.dataValues.id, agencyUuid, "note", `Itinerary created: ${row.dataValues.title}`, userId);
            return ok(res, "Itinerary created", presentItinerary(row.toJSON(), l.uuid ? l : null));
        } catch (error) { return fail(res, error, "createItinerary"); }
    }

    async itineraryDetails(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Itinerary.findOne({ where: { [Op.or]: [scope, { agency_uuid: ctx(req).agencyUuid, is_template: true }], uuid: req.params.uuid } });
            if (!row) return no(res, "Itinerary not found");
            const lead: any = row.dataValues.crm_lead_id ? await CrmLead.findByPk(row.dataValues.crm_lead_id, { attributes: ["uuid", "name", "country_code", "phone_number"] }) : null;
            const quotes = await Quotation.findAll({ where: { agency_uuid: ctx(req).agencyUuid, itinerary_id: row.dataValues.id }, attributes: ["uuid", "number", "version", "status", "sell_total"], order: [["version", "DESC"]] });
            return ok(res, "Itinerary", {
                ...presentItinerary(row.toJSON(), lead?.toJSON()),
                lead_phone: lead ? `${lead.dataValues.country_code || ""}${lead.dataValues.phone_number || ""}` : null,
                quotes: quotes.map((q: any) => ({ id: q.dataValues.uuid, number: q.dataValues.number, version: q.dataValues.version, status: q.dataValues.status, sell_total: toRupees(q.dataValues.sell_total) })),
            });
        } catch (error) { return fail(res, error, "itineraryDetails"); }
    }

    async updateItinerary(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Itinerary.findOne({ where: { [Op.or]: [scope, { agency_uuid: ctx(req).agencyUuid, is_template: true }], uuid: req.params.uuid } });
            if (!row) return no(res, "Itinerary not found");
            const b = req.body || {};
            const updates: any = {};
            if (b.title !== undefined) updates.title = str(b.title) || row.dataValues.title;
            if (b.destination !== undefined) updates.destination = str(b.destination);
            if (b.start_date !== undefined) updates.start_date = date(b.start_date);
            if (b.days !== undefined) { updates.days = cleanDays(b.days); updates.nights = Math.max(0, updates.days.length - 1); }
            for (const k of ["inclusions", "exclusions", "terms", "cancellation_policy"]) if (b[k] !== undefined) updates[k] = str(b[k], 8000);
            if (b.is_template !== undefined) updates.is_template = Boolean(b.is_template);
            if (b.theme !== undefined) updates.theme = ["classic", "modern", "elegant"].includes(b.theme) ? b.theme : "classic";
            if (b.cover_image !== undefined) updates.cover_image = /^https?:\/\//.test(String(b.cover_image || "")) ? String(b.cover_image).slice(0, 500) : null;
            await row.update(updates);
            return ok(res, "Itinerary saved", presentItinerary(row.toJSON()));
        } catch (error) { return fail(res, error, "updateItinerary"); }
    }

    async deleteItinerary(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const n = await Itinerary.destroy({ where: { [Op.or]: [scope, { agency_uuid: ctx(req).agencyUuid, is_template: true }], uuid: req.params.uuid } });
            return n ? ok(res, "Itinerary deleted") : no(res, "Itinerary not found");
        } catch (error) { return fail(res, error, "deleteItinerary"); }
    }

    // POST /travel/itineraries/:uuid/share - public link the client can open, accept or ask for changes
    async shareItinerary(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Itinerary.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Itinerary not found");
            const token = row.dataValues.share_token || crypto.randomBytes(18).toString("hex");
            await row.update({ share_token: token, status: row.dataValues.status === "draft" ? "sent" : row.dataValues.status });
            return ok(res, "Share link ready", { token, url: `${publicApiBase(req)}/v1/public/travel/itinerary/${token}` });
        } catch (error) { return fail(res, error, "shareItinerary"); }
    }

    // ------------------------------------------------------------ quotations

    async listQuotes(req: RequestWithUser, res: Response) {
        try {
            const where: any = await recordScope(req);
            if (req.query.lead) {
                const lead = await findLead(req, String(req.query.lead));
                if (!lead) return ok(res, "Quotes", []);
                where.crm_lead_id = lead.dataValues.id;
            }
            if (req.query.status) where.status = String(req.query.status);
            const rows: any[] = await Quotation.findAll({ where, order: [["updatedAt", "DESC"]], limit: 200, include: [{ model: Itinerary, as: "itinerary", attributes: ["uuid"], required: false }] });
            const leads: any[] = await CrmLead.findAll({ where: { id: rows.map((r) => r.dataValues.crm_lead_id).filter(Boolean).concat([-1]) }, attributes: ["id", "uuid", "name", "country_code", "phone_number", "email"], raw: true });
            const byId = new Map(leads.map((l) => [l.id, l]));
            const data = rows.map((r) => {
                const p = presentQuote(r.toJSON(), byId.get(r.dataValues.crm_lead_id));
                const chosen: any = p.options[p.chosen_option ?? 0] || p.options[0];
                return { ...p, options: undefined, option_count: p.options.length, profit: chosen?.totals?.profit ?? 0, total: chosen?.totals?.total ?? p.sell_total };
            });
            return ok(res, "Quotes", redactCost(data, req));
        } catch (error) { return fail(res, error, "listQuotes"); }
    }

    // POST /travel/quotes { lead_id?, itinerary_id?, title? }
    async createQuote(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, branchId } = ctx(req);
            const b = req.body || {};
            const lead = await findLead(req, b.lead_id);
            if (b.lead_id && !lead) return no(res, "Lead not found");
            let itinerary: any = null;
            // quote from a fixed package: copy its day plan for this lead and start with the package price
            let pkg: any = null;
            if (b.package_id) {
                pkg = await TourPackage.findOne({ where: { agency_uuid: agencyUuid, uuid: b.package_id } });
                if (!pkg) return no(res, "Package not found");
                if (pkg.dataValues.itinerary_id && !b.itinerary_id) {
                    const tpl: any = await Itinerary.findByPk(pkg.dataValues.itinerary_id);
                    if (tpl) {
                        const t = tpl.toJSON();
                        itinerary = await Itinerary.create({
                            agency_uuid: agencyUuid, crm_lead_id: lead?.dataValues.id || null, is_template: false, title: pkg.dataValues.title, destination: t.destination || pkg.dataValues.destination,
                            nights: t.nights, days: t.days, inclusions: t.inclusions, exclusions: t.exclusions, terms: t.terms, cancellation_policy: t.cancellation_policy,
                            theme: t.theme || "classic", cover_image: t.cover_image || pkg.dataValues.image_url || null, start_date: lead?.dataValues.travel_start || null,
                            branch_id: lead?.dataValues.branch_id || branchId || null, created_by: userId,
                        });
                    }
                }
            }
            if (b.itinerary_id) {
                itinerary = await Itinerary.findOne({ where: { agency_uuid: agencyUuid, uuid: b.itinerary_id } });
                if (!itinerary) return no(res, "Itinerary not found");
            }
            const tax = await getTravelTax();
            const l = lead ? lead.toJSON() : {};
            const trip = b.trip ? cleanTrip(b.trip) : null;
            const destination = trip?.place || itinerary?.dataValues.destination || (Array.isArray(l.destinations) ? l.destinations.join(", ") : "") || l.interested_country || "";
            const international = trip ? trip.destination_type === "international" : b.is_international !== undefined ? Boolean(b.is_international) : Boolean(destination && !/india|goa|kerala|kashmir|rajasthan|himachal|ladakh|andaman|sikkim|uttarakhand|meghalaya|assam/i.test(destination));
            const number = await nextTravelNumber(Quotation, "number", agencyUuid, "QT");
            const row: any = await Quotation.create({
                agency_uuid: agencyUuid, number, crm_lead_id: lead?.dataValues.id || itinerary?.dataValues.crm_lead_id || null,
                itinerary_id: itinerary?.dataValues.id || null, version: 1,
                title: str(b.title) || pkg?.dataValues.title || itinerary?.dataValues.title || (destination ? `${destination} trip` : "Trip quote"),
                is_international: international, adults: l.adults || 2, children: l.children || 0, infants: l.infants || 0,
                package_id: pkg?.dataValues.id || null,
                options: [{ name: "Standard", lines: pkg ? [{ service_type: "other", description: `${pkg.dataValues.title} (per person)`, supplier_id: null, rate_id: null, qty: Math.max(1, (l.adults || 2) + (l.children || 0)), nights: 0, unit_cost: Number(pkg.dataValues.price_pp), markup_type: "percent", markup_value: 0 }] : [] }], billing_mode: "full_value",
                gst_percent: tax.gst_full_value_percent, tcs_percent: international ? tax.tcs_overseas_percent : 0,
                valid_until: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
                branch_id: lead?.dataValues.branch_id || branchId || null, created_by: userId,
                kind: b.kind === "quote_itinerary" || itinerary ? "quote_itinerary" : "quote",
                trip: trip || {
                    destination_type: international ? "international" : "domestic", state: null, place: destination || null, country: null,
                    start_date: itinerary?.dataValues.start_date || l.travel_start || null, end_date: l.travel_end || null,
                },
                cost_mode: pkg ? "combined" : "per_service", design: cleanDesign({ cover_image: itinerary?.dataValues.cover_image, theme: itinerary?.dataValues.theme }),
            });
            return ok(res, "Quote created", { id: row.dataValues.uuid });
        } catch (error) { return fail(res, error, "createQuote"); }
    }

    async quoteDetails(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid }, include: [{ model: Itinerary, as: "itinerary", attributes: ["uuid", "title", "share_token", "nights", "start_date"], required: false }] });
            if (!row) return no(res, "Quote not found");
            const lead: any = row.dataValues.crm_lead_id ? await CrmLead.findByPk(row.dataValues.crm_lead_id, { attributes: ["uuid", "name", "country_code", "phone_number", "email", "nights", "travel_start"] }) : null;
            const versions = await Quotation.findAll({
                where: { agency_uuid: ctx(req).agencyUuid, [Op.or]: [{ id: row.dataValues.parent_id || row.dataValues.id }, { parent_id: row.dataValues.parent_id || row.dataValues.id }] },
                attributes: ["uuid", "version", "status"], order: [["version", "ASC"]],
            });
            const booking: any = await Booking.findOne({ where: { agency_uuid: ctx(req).agencyUuid, quotation_id: row.dataValues.id }, attributes: ["uuid", "booking_no"] });
            const tax = await getTravelTax();
            const data = {
                ...presentQuote(row.toJSON(), lead?.toJSON()),
                itinerary: row.dataValues.itinerary ? { id: row.dataValues.itinerary.uuid, title: row.dataValues.itinerary.title, share_token: row.dataValues.itinerary.share_token } : null,
                versions: versions.map((v: any) => ({ id: v.dataValues.uuid, version: v.dataValues.version, status: v.dataValues.status })),
                booking: booking ? { id: booking.dataValues.uuid, booking_no: booking.dataValues.booking_no } : null,
                sees_cost: seesCost(req),
                // used to price rates automatically: nights for per-night rates, date for the right season
                trip: { nights: row.dataValues.itinerary?.nights ?? lead?.dataValues.nights ?? 0, travel_date: row.dataValues.itinerary?.start_date || lead?.dataValues.travel_start || null },
                tax_defaults: { gst_full_value_percent: tax.gst_full_value_percent, gst_margin_percent: tax.gst_margin_percent, tcs_overseas_percent: tax.tcs_overseas_percent },
            };
            return ok(res, "Quote", redactCost(data, req));
        } catch (error) { return fail(res, error, "quoteDetails"); }
    }

    // POST /travel/quotes/:uuid/update { title, adults, children, infants, is_international, billing_mode, gst_percent, tcs_percent, discount, options:[{name, lines}], valid_until, notes, chosen_option }
    async updateQuote(req: RequestWithUser, res: Response) {
        try {
            if (!seesCost(req)) return no(res, "Your role can not change quote prices. Ask a manager.");
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Quote not found");
            if (["accepted", "superseded"].includes(row.dataValues.status)) return no(res, "This version is closed. Make a new version to change it.");
            const b = req.body || {};
            const u: any = {};
            if (b.title !== undefined) u.title = str(b.title) || row.dataValues.title;
            for (const k of ["adults", "children", "infants"]) if (b[k] !== undefined) u[k] = int(b[k], 0, 99);
            if (b.is_international !== undefined) u.is_international = Boolean(b.is_international);
            if (b.billing_mode !== undefined) u.billing_mode = b.billing_mode === "margin" ? "margin" : "full_value";
            for (const k of ["gst_percent", "tcs_percent"]) if (b[k] !== undefined) { const n = Number(b[k]); if (!Number.isFinite(n) || n < 0 || n > 50) return no(res, "Tax rates must be between 0 and 50%"); u[k] = n; }
            if (b.discount !== undefined) u.discount = Math.max(0, toPaise(b.discount));
            if (b.valid_until !== undefined) u.valid_until = date(b.valid_until);
            if (b.notes !== undefined) u.notes = str(b.notes, 5000);
            if (b.options !== undefined) {
                if (!Array.isArray(b.options) || !b.options.length) return no(res, "A quote needs at least one option");
                if (b.options.length > 3) return no(res, "Up to 3 options (for example Standard, Deluxe, Luxury)");
                u.options = b.options.map((o: any, i: number) => ({ name: str(o?.name, 60) || ["Standard", "Deluxe", "Luxury"][i], lines: cleanLines(o?.lines) }));
            }
            if (b.chosen_option !== undefined) u.chosen_option = b.chosen_option === null ? null : int(b.chosen_option, 0, 2);
            if (b.trip !== undefined) { u.trip = cleanTrip(b.trip); u.is_international = u.trip.destination_type === "international"; }
            if (b.travellers !== undefined) u.travellers = cleanTravellers(b.travellers);
            if (b.cost_mode !== undefined) u.cost_mode = b.cost_mode === "combined" ? "combined" : "per_service";
            if (b.gst_inclusive !== undefined) u.gst_inclusive = Boolean(b.gst_inclusive);
            for (const k of ["inclusions", "exclusions", "terms", "internal_notes"]) if (b[k] !== undefined) u[k] = str(b[k], 10000);
            if (b.payment_terms !== undefined) {
                u.payment_terms = cleanPaymentTerms(b.payment_terms);
                const sum = u.payment_terms.reduce((a: number, p: any) => a + p.percent, 0);
                if (u.payment_terms.length && Math.abs(sum - 100) > 0.01) return no(res, `Payment terms add up to ${sum}% - they must add up to 100%`);
            }
            if (b.design !== undefined) u.design = cleanDesign(b.design);
            if (b.step !== undefined) u.step = Math.max(Number(row.dataValues.step) || 1, int(b.step, 1, 7));
            const merged = { ...row.toJSON(), ...u };
            const opt = (merged.options || [])[merged.chosen_option ?? 0] || (merged.options || [])[0];
            const t = optionTotals(merged, opt);
            u.cost_total = t.cost;
            u.sell_total = t.total;
            await row.update(u);
            return ok(res, "Quote saved", { totals: totalsInRupees(t) });
        } catch (error) { return fail(res, error, "updateQuote"); }
    }

    // POST /travel/quotes/:uuid/version - copy into a new version; the old one is marked superseded
    async newQuoteVersion(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Quote not found");
            const rootId = row.dataValues.parent_id || row.dataValues.id;
            const last: any = await Quotation.max("version", { where: { agency_uuid: row.dataValues.agency_uuid, [Op.or]: [{ id: rootId }, { parent_id: rootId }] } });
            const x = row.toJSON();
            const copy: any = await sequelize.transaction(async (t: any) => {
                const created = await Quotation.create({
                    ...x, id: undefined, uuid: undefined, createdAt: undefined, updatedAt: undefined, deletedAt: undefined,
                    version: Number(last || 1) + 1, parent_id: rootId, status: "draft", sent_at: null, created_by: ctx(req).userId,
                }, { transaction: t });
                if (row.dataValues.status !== "accepted") await row.update({ status: "superseded" }, { transaction: t });
                return created;
            });
            return ok(res, `Version ${copy.dataValues.version} created`, { id: copy.dataValues.uuid });
        } catch (error) { return fail(res, error, "newQuoteVersion"); }
    }

    // POST /travel/quotes/:uuid/status { status: sent | rejected | draft }
    async quoteStatus(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Quote not found");
            const status = String(req.body?.status || "");
            if (!["sent", "rejected", "draft"].includes(status)) return no(res, "Unknown status");
            if (row.dataValues.status === "accepted") return no(res, "This quote is already booked");
            await row.update({ status, sent_at: status === "sent" ? new Date() : row.dataValues.sent_at });
            if (row.dataValues.crm_lead_id && status === "sent") {
                await logActivity(row.dataValues.crm_lead_id, row.dataValues.agency_uuid, "note", `Quote ${row.dataValues.number} v${row.dataValues.version} sent`, ctx(req).userId);
            }
            return ok(res, status === "sent" ? "Marked as sent" : "Status updated");
        } catch (error) { return fail(res, error, "quoteStatus"); }
    }

    // POST /travel/quotes/:uuid/book { option?, start_date?, end_date? } - accepted quote → booking with services
    async bookQuote(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Quote not found");
            if (row.dataValues.status === "accepted") return no(res, "This quote is already booked");
            const q = row.toJSON();
            const optIndex = req.body?.option !== undefined ? int(req.body.option, 0, 2) : (q.chosen_option ?? 0);
            const opt = (q.options || [])[optIndex];
            if (!opt || !cleanLinesFromStored(opt.lines).length) return no(res, "Add at least one priced service to this option first");
            const lead: any = q.crm_lead_id ? await CrmLead.findByPk(q.crm_lead_id) : null;
            if (!lead) return no(res, "Link this quote to a lead first - the booking needs the client's phone number");
            if (!lead.dataValues.phone_number) return no(res, "Add the client's phone number to the lead first");
            const itinerary: any = q.itinerary_id ? await Itinerary.findByPk(q.itinerary_id) : null;
            const t = optionTotals(q, opt);
            const lines = cleanLinesFromStored(opt.lines);
            const startDate = date(req.body?.start_date) || q.trip?.start_date || itinerary?.dataValues.start_date || lead.dataValues.travel_start || null;
            const nights = itinerary?.dataValues.nights ?? lead.dataValues.nights ?? 0;
            const endDate = date(req.body?.end_date) || q.trip?.end_date || lead.dataValues.travel_end || (startDate ? new Date(Date.parse(startDate) + nights * 864e5).toISOString().slice(0, 10) : null);

            const booking: any = await sequelize.transaction(async (tx: any) => {
                let client: any = await User.findOne({ where: { phone_number: lead.dataValues.phone_number, country_code: lead.dataValues.country_code, agency_uuid: agencyUuid }, transaction: tx });
                if (!client) {
                    client = await User.create({
                        username: lead.dataValues.name || `Traveller ${lead.dataValues.phone_number}`, phone_number: lead.dataValues.phone_number,
                        country_code: lead.dataValues.country_code, email: lead.dataValues.email, user_type: "user", agency_uuid: agencyUuid,
                    }, { transaction: tx });
                }
                const bookingNo = await nextTravelNumber(Booking, "booking_no", agencyUuid, "BK", tx);
                const created: any = await Booking.create({
                    agency_uuid: agencyUuid, booking_no: bookingNo, crm_lead_id: lead.dataValues.id, quotation_id: q.id, itinerary_id: q.itinerary_id, package_id: q.package_id || null,
                    user_id: client.dataValues.id, title: q.title, destination: q.trip?.place || itinerary?.dataValues.destination || (lead.dataValues.destinations || []).join?.(", ") || null,
                    is_international: q.is_international, start_date: startDate, end_date: endDate, status: "confirmed",
                    total_sell: t.sell, total_cost: t.cost, tax_total: t.gst + t.tcs, discount: t.discount, hidden_markup: t.hidden,
                    billing_mode: q.billing_mode, gst_percent: q.gst_percent, tcs_percent: q.tcs_percent,
                    branch_id: q.branch_id, created_by: userId,
                }, { transaction: tx });
                for (const l of lines) {
                    const dt: any = l.details || {};
                    await BookingService.create({
                        agency_uuid: agencyUuid, booking_id: created.dataValues.id,
                        type: SERVICE_TYPES.includes(l.service_type) ? l.service_type : "other",
                        description: l.description, supplier_id: l.supplier_id || null, status: "requested",
                        service_date: date(dt.check_in || dt.date || dt.travel_date || dt.start_date) || startDate,
                        end_date: date(dt.check_out || dt.end_date) || null,
                        cost: lineCost(l), sell: lineCost(l) + lineMarkup(l),
                        details: { ...dt, qty: l.qty, nights: l.nights, ...(l.vendor ? { vendor: l.vendor } : {}) },
                    }, { transaction: tx });
                }
                // lead traveller from the lead
                await BookingTraveller.create({ agency_uuid: agencyUuid, booking_id: created.dataValues.id, name: lead.dataValues.name || "Lead traveller", pax_type: "adult", is_lead: true }, { transaction: tx });
                await row.update({ status: "accepted", chosen_option: optIndex }, { transaction: tx });
                if (itinerary) await itinerary.update({ status: "accepted", booking_id: created.dataValues.id }, { transaction: tx });
                await CrmLead.update({ status: "converted", converted_at: new Date(), converted_booking_id: created.dataValues.id, converted_student_id: client.dataValues.id }, { where: { id: lead.dataValues.id }, transaction: tx });
                return created;
            });
            await logActivity(lead.dataValues.id, agencyUuid, "converted", `Booked: ${booking.dataValues.booking_no} (${q.title})`, userId, { booking_id: booking.dataValues.id });
            // "booking confirmed" message, if the agency set up a template for it (Messages → When to send)
            runTrigger(agencyUuid, "booking_confirmed", {
                name: lead.dataValues.name, phoneDigits: String(lead.dataValues.phone_normalized || "").replace(/\D/g, "") || null, email: lead.dataValues.email, leadId: lead.dataValues.id,
            }, { trip: q.title, booking_no: booking.dataValues.booking_no, start_date: booking.dataValues.start_date, total: `Rs ${toRupees(optionTotals(q, opt).total).toLocaleString("en-IN")}` });
            audit(req, { entity: "booking", entityId: booking.dataValues.id, branchId: q.branch_id, action: "created", summary: `Booking ${booking.dataValues.booking_no} created from quote ${q.number} v${q.version}` });
            return ok(res, `Booking ${booking.dataValues.booking_no} created`, { id: booking.dataValues.uuid });
        } catch (error) { return fail(res, error, "bookQuote"); }
    }

    // ------------------------------------------------------------ quote builder: customer and day plan

    // GET /travel/quote_customers?search= - leads to pick as the quote's customer
    async quoteCustomers(req: RequestWithUser, res: Response) {
        try {
            const q = String(req.query.search || "").trim().slice(0, 60);
            const where: any = { ...leadScope(req) };
            if (q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { phone_number: { [Op.like]: `%${q.replace(/\D/g, "") || q}%` } }, { email: { [Op.like]: `%${q}%` } }];
            const rows: any[] = await CrmLead.findAll({ where, attributes: ["uuid", "name", "country_code", "phone_number", "email", "city"], order: [["updatedAt", "DESC"]], limit: 20, raw: true });
            return ok(res, "Customers", rows.map((l) => ({ id: l.uuid, name: l.name, phone: `${l.country_code || ""}${l.phone_number || ""}`, email: l.email, city: l.city })));
        } catch (error) { return fail(res, error, "quoteCustomers"); }
    }

    // POST /travel/quotes/:uuid/customer { lead_id } or { name, phone, country_code, email } - pick or add the customer
    async setQuoteCustomer(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner, branchId } = ctx(req);
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Quote not found");
            if (row.dataValues.status === "accepted") return no(res, "This quote is already booked");
            const b = req.body || {};
            let lead: any = null;
            if (b.lead_id) {
                lead = await findLead(req, b.lead_id);
                if (!lead) return no(res, "Customer not found");
            } else {
                if (!str(b.name)) return no(res, "Enter the customer's name");
                const trip = cleanTrip(row.dataValues.trip);
                try {
                    const result = await ingestLead({
                        agencyUuid, source: "manual", createdBy: userId,
                        input: {
                            name: b.name, phone: b.phone, country_code: b.country_code, email: b.email, city: b.city,
                            assigned_to: isOwner ? null : userId, branch_id: isOwner ? null : branchId,
                            travel: {
                                business_line: "travel", destinations: trip.place ? [trip.place] : null, travel_start: trip.start_date, travel_end: trip.end_date,
                                adults: row.dataValues.adults, children: row.dataValues.children, infants: row.dataValues.infants,
                            },
                        } as any,
                    });
                    lead = result.lead;
                } catch (e: any) {
                    if (e?.name === "LeadValidationError" || e?.constructor?.name === "LeadValidationError") return no(res, e.message);
                    throw e;
                }
            }
            await row.update({ crm_lead_id: lead.dataValues.id, branch_id: row.dataValues.branch_id || lead.dataValues.branch_id || null });
            const l = lead.toJSON ? lead.toJSON() : lead;
            return ok(res, "Customer added to the quote", { id: l.uuid, name: l.name, phone: `${l.country_code || ""}${l.phone_number || ""}`, email: l.email });
        } catch (error) { return fail(res, error, "setQuoteCustomer"); }
    }

    // POST /travel/quotes/:uuid/itinerary - day-wise plan from the quote's dates and services (or the linked one)
    async quoteItinerary(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const scope = await recordScope(req);
            const row: any = await Quotation.findOne({ where: { ...scope, uuid: req.params.uuid } });
            if (!row) return no(res, "Quote not found");
            if (row.dataValues.itinerary_id) {
                const it: any = await Itinerary.findByPk(row.dataValues.itinerary_id, { attributes: ["uuid"] });
                if (it) return ok(res, "Itinerary", { id: it.dataValues.uuid, created: false });
            }
            const q = row.toJSON();
            const trip = cleanTrip(q.trip);
            if (!trip.start_date) return no(res, "Add the travel dates on the Trip step first");
            const end = trip.end_date || trip.start_date;
            const dayCount = Math.min(60, Math.max(1, Math.round((Date.parse(end) - Date.parse(trip.start_date)) / 864e5) + 1));
            const dayOf = (d?: string | null) => {
                const v = date(d);
                if (!v) return 0;
                const n = Math.round((Date.parse(v) - Date.parse(trip.start_date as string)) / 864e5);
                return n >= 0 && n < dayCount ? n : 0;
            };
            const city = trip.place ? trip.place.split(",")[0].trim() : null;
            const days: any[] = Array.from({ length: dayCount }, (_, i) => ({ day: i + 1, title: i === 0 ? `Arrival${city ? ` in ${city}` : ""}` : i === dayCount - 1 && dayCount > 1 ? "Departure" : `Day ${i + 1}${city ? ` in ${city}` : ""}`, city, notes: null, images: [], image: null, items: [] as any[] }));
            const opt = (q.options || [])[q.chosen_option ?? 0] || (q.options || [])[0];
            const ITEM: Record<string, string> = { hotel: "hotel", flight: "flight", flight_extras: "flight", train: "transfer", bus: "transfer", transfer: "transfer", activity: "activity", admission: "sightseeing", meal: "meal", land_package: "note" };
            for (const l of storedLines(opt?.lines)) {
                const dt: any = l.details || {};
                const type = ITEM[l.service_type] || "note";
                if (["visa", "insurance", "forex", "other"].includes(l.service_type) && !dt.date) continue;
                const d = dayOf(dt.check_in || dt.date || dt.travel_date || dt.start_date);
                days[d].items.push({ type, text: l.description, library_item_id: null, images: [], image: null });
                if (l.service_type === "hotel" && dt.check_in && dt.check_out) {
                    // remind the stay on the following nights too
                    const last = Math.min(dayCount - 1, dayOf(dt.check_out) - 1);
                    for (let i = d + 1; i <= last; i++) days[i].items.push({ type: "hotel", text: `Stay at ${dt.hotel_name || l.description}`, library_item_id: null, images: [], image: null });
                }
            }
            const it: any = await Itinerary.create({
                agency_uuid: agencyUuid, crm_lead_id: q.crm_lead_id || null, is_template: false, title: q.title || (city ? `${city} trip` : "Trip"),
                destination: trip.place, nights: dayCount - 1, start_date: trip.start_date, days,
                inclusions: q.inclusions || null, exclusions: q.exclusions || null, terms: q.terms || null,
                theme: cleanDesign(q.design).theme, cover_image: cleanDesign(q.design).cover_image,
                branch_id: q.branch_id || null, created_by: userId,
            });
            await row.update({ itinerary_id: it.dataValues.id, kind: "quote_itinerary" });
            return ok(res, "Day-wise itinerary created", { id: it.dataValues.uuid, created: true });
        } catch (error) { return fail(res, error, "quoteItinerary"); }
    }

    // ------------------------------------------------------------ packages

    async listPackages(req: RequestWithUser, res: Response) {
        try {
            const where: any = { agency_uuid: ctx(req).agencyUuid };
            if (req.query.status) where.status = String(req.query.status);
            const rows = await TourPackage.findAll({ where, order: [["status", "ASC"], ["title", "ASC"]], include: [{ model: Itinerary, as: "itinerary", attributes: ["uuid", "title"], required: false }] });
            return ok(res, "Packages", rows.map((r: any) => {
                const x = r.toJSON();
                return { id: x.uuid, title: x.title, destination: x.destination, nights: x.nights, price_pp: toRupees(x.price_pp), valid_from: x.valid_from, valid_to: x.valid_to, highlights: x.highlights, image_url: x.image_url, status: x.status, itinerary: x.itinerary ? { id: x.itinerary.uuid, title: x.itinerary.title } : null, public_url: x.public_slug ? `${publicApiBase(req)}/v1/public/travel/package/${x.public_slug}` : null, catalogue_url: `${publicApiBase(req)}/v1/public/travel/packages/${ctx(req).agencyUuid}` };
            }));
        } catch (error) { return fail(res, error, "listPackages"); }
    }

    async savePackage(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const b = req.body || {};
            const title = str(b.title);
            if (!title) return no(res, "Please enter the package name");
            let itineraryId: number | null = null;
            if (b.itinerary_id) {
                const it: any = await Itinerary.findOne({ where: { agency_uuid: agencyUuid, uuid: b.itinerary_id }, attributes: ["id"] });
                if (!it) return no(res, "Itinerary not found");
                itineraryId = it.dataValues.id;
            }
            const values = {
                title, destination: str(b.destination), nights: int(b.nights, 0, 90), itinerary_id: itineraryId, price_pp: toPaise(b.price_pp),
                valid_from: date(b.valid_from), valid_to: date(b.valid_to), highlights: str(b.highlights, 3000), image_url: str(b.image_url, 500),
                status: b.status === "inactive" ? "inactive" : "active",
            };
            const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${crypto.randomBytes(3).toString("hex")}`;
            if (req.params.uuid) {
                const row: any = await TourPackage.findOne({ where: { agency_uuid: agencyUuid, uuid: req.params.uuid } });
                if (!row) return no(res, "Package not found");
                await row.update({ ...values, public_slug: row.dataValues.public_slug || slug });
                return ok(res, "Package saved");
            }
            await TourPackage.create({ ...values, public_slug: slug, agency_uuid: agencyUuid, created_by: userId });
            return ok(res, "Package added");
        } catch (error) { return fail(res, error, "savePackage"); }
    }

    async deletePackage(req: RequestWithUser, res: Response) {
        try {
            const n = await TourPackage.destroy({ where: { agency_uuid: ctx(req).agencyUuid, uuid: req.params.uuid } });
            return n ? ok(res, "Package removed") : no(res, "Package not found");
        } catch (error) { return fail(res, error, "deletePackage"); }
    }

    // ------------------------------------------------------------ bookings

    async listBookings(req: RequestWithUser, res: Response) {
        try {
            const where: any = await recordScope(req);
            const from = date(req.query.from), to = date(req.query.to);
            if (from && to) where[Op.and] = [{ start_date: { [Op.lte]: to } }, { [Op.or]: [{ end_date: { [Op.gte]: from } }, { end_date: null, start_date: { [Op.gte]: from } }] }];
            if (req.query.status) where.status = String(req.query.status);
            if (req.query.when === "upcoming") where.start_date = { [Op.gte]: new Date().toISOString().slice(0, 10) };
            if (req.query.when === "past") where.end_date = { [Op.lt]: new Date().toISOString().slice(0, 10) };
            if (req.query.search) where[Op.or] = [{ booking_no: { [Op.like]: `%${req.query.search}%` } }, { title: { [Op.like]: `%${req.query.search}%` } }, { destination: { [Op.like]: `%${req.query.search}%` } }];
            const rows = await Booking.findAll({
                where, order: [["start_date", req.query.when === "past" ? "DESC" : "ASC"]], limit: 300,
                include: [{ model: User, as: "client", attributes: ["id", "username", "country_code", "phone_number", "email"], required: false }, { model: ClientInvoice, as: "invoice", attributes: ["uuid", "number"], required: false }],
            });
            return ok(res, "Bookings", redactCost(rows.map((r: any) => presentBooking(r.toJSON())), req));
        } catch (error) { return fail(res, error, "listBookings"); }
    }

    private async scopedBooking(req: RequestWithUser, uuid: string) {
        const scope = await recordScope(req);
        return Booking.findOne({ where: { ...scope, uuid } }) as Promise<any>;
    }

    async bookingDetails(req: RequestWithUser, res: Response) {
        try {
            const scope = await recordScope(req);
            const row: any = await Booking.findOne({
                where: { ...scope, uuid: req.params.uuid },
                include: [
                    { model: User, as: "client", attributes: ["id", "username", "country_code", "phone_number", "email"], required: false },
                    { model: ClientInvoice, as: "invoice", attributes: ["uuid", "number", "total", "amount_paid", "status"], required: false },
                    { model: CrmLead, as: "lead", attributes: ["uuid", "name"], required: false },
                    { model: Quotation, as: "quotation", attributes: ["uuid", "number", "version"], required: false },
                    { model: Itinerary, as: "itinerary", attributes: ["uuid", "title", "days", "inclusions", "exclusions", "share_token"], required: false },
                ],
            });
            if (!row) return no(res, "Booking not found");
            const [services, travellers] = await Promise.all([
                BookingService.findAll({ where: { booking_id: row.dataValues.id }, include: [{ model: TravelSupplier, as: "supplier", attributes: ["name", "phone", "email", "city"], required: false }], order: [["service_date", "ASC"], ["id", "ASC"]] }),
                BookingTraveller.findAll({ where: { booking_id: row.dataValues.id }, order: [["is_lead", "DESC"], ["id", "ASC"]] }),
            ]);
            const x = row.toJSON();
            const agency = await agencyBrand(ctx(req).agencyUuid);
            const data = {
                ...presentBooking(x),
                invoice: x.invoice ? { id: x.invoice.uuid, number: x.invoice.number, total: toRupees(x.invoice.total), paid: toRupees(x.invoice.amount_paid), status: x.invoice.status } : null,
                itinerary: x.itinerary ? { id: x.itinerary.uuid, title: x.itinerary.title, days: x.itinerary.days || [], inclusions: x.itinerary.inclusions, exclusions: x.itinerary.exclusions, share_token: x.itinerary.share_token } : null,
                quotation: x.quotation ? { id: x.quotation.uuid, number: x.quotation.number, version: x.quotation.version } : null,
                services: services.map((s: any) => ({ ...presentService(s.toJSON()), supplier_contact: s.dataValues.supplier ? { phone: s.dataValues.supplier.phone, email: s.dataValues.supplier.email, city: s.dataValues.supplier.city } : null })),
                travellers: travellers.map((t: any) => presentTraveller(t.toJSON())),
                agency: agency ? { name: agency.app_name || agency.username, phone: agency.support_number, email: agency.support_email, address: agency.agency_address, color: agency.primary_color } : null,
                sees_cost: seesCost(req),
            };
            return ok(res, "Booking", redactCost(data, req));
        } catch (error) { return fail(res, error, "bookingDetails"); }
    }

    async updateBooking(req: RequestWithUser, res: Response) {
        try {
            const row: any = await this.scopedBooking(req, req.params.uuid);
            if (!row) return no(res, "Booking not found");
            const b = req.body || {};
            const u: any = {};
            if (b.title !== undefined) u.title = str(b.title) || row.dataValues.title;
            if (b.destination !== undefined) u.destination = str(b.destination);
            if (b.start_date !== undefined) u.start_date = date(b.start_date);
            if (b.end_date !== undefined) u.end_date = date(b.end_date);
            if (b.status === "cancelled" && row.dataValues.status !== "cancelled") return no(res, "Use Cancel booking, so charges, the credit note and refunds are worked out");
            if (b.status !== undefined && ["confirmed", "in_progress", "completed"].includes(b.status) && row.dataValues.status !== "cancelled") u.status = b.status;
            if (b.notes !== undefined) u.notes = str(b.notes, 5000);
            if (b.ops_owner_id !== undefined) u.ops_owner_id = b.ops_owner_id ? Number(b.ops_owner_id) : null;
            if (seesCost(req)) {
                if (b.total_sell !== undefined) u.total_sell = Math.max(0, toPaise(b.total_sell));
                if (b.is_international !== undefined) u.is_international = Boolean(b.is_international);
                if (b.billing_mode !== undefined) u.billing_mode = b.billing_mode === "margin" ? "margin" : "full_value";
                for (const k of ["gst_percent", "tcs_percent"]) if (b[k] !== undefined) u[k] = Math.min(50, Math.max(0, Number(b[k]) || 0));
            }
            await row.update(u);
            if (u.status) audit(req, { entity: "booking", entityId: row.dataValues.id, branchId: row.dataValues.branch_id, action: "status", summary: `Booking ${row.dataValues.booking_no}: ${u.status}` });
            return ok(res, "Booking saved");
        } catch (error) { return fail(res, error, "updateBooking"); }
    }

    private async recalcBooking(bookingId: number) {
        await recalcBookingCost(bookingId);
    }

    private async serviceValues(req: RequestWithUser, b: any, existing?: any) {
        const v: any = {};
        if (b.type !== undefined) v.type = ["flight", "hotel", "transfer", "activity", "visa", "insurance", "forex", "other"].includes(b.type) ? b.type : "other";
        if (b.description !== undefined) { v.description = str(b.description, 500); if (!v.description) throw new UserError("Please describe the service"); }
        if (b.confirmation_no !== undefined) v.confirmation_no = str(b.confirmation_no, 80);
        if (b.status !== undefined && ["requested", "confirmed", "cancelled"].includes(b.status)) {
            v.status = b.status;
            const was = existing?.dataValues?.status;
            if (b.status === "cancelled" && was !== "cancelled") v.cancelled_at = new Date().toISOString().slice(0, 10);
            if (b.status !== "cancelled" && was === "cancelled") { v.cancel_charge = null; v.cancelled_at = null; }
        }
        if (b.service_date !== undefined) v.service_date = date(b.service_date);
        if (b.end_date !== undefined) v.end_date = date(b.end_date);
        if (b.details !== undefined && b.details && typeof b.details === "object") {
            const d: any = { ...(existing?.dataValues?.details || {}) };
            for (const [k, val] of Object.entries(b.details).slice(0, 20)) d[String(k).slice(0, 40)] = str(val, 300);
            v.details = d;
        }
        if (b.supplier_id !== undefined) {
            if (!b.supplier_id) v.supplier_id = null;
            else {
                const s: any = await TravelSupplier.findOne({ where: { agency_uuid: ctx(req).agencyUuid, uuid: b.supplier_id }, attributes: ["id"] });
                if (!s) throw new UserError("Supplier not found");
                v.supplier_id = s.dataValues.id;
            }
        }
        if (seesCost(req)) {
            if (b.cost !== undefined) v.cost = Math.max(0, toPaise(b.cost));
            if (b.sell !== undefined) v.sell = Math.max(0, toPaise(b.sell));
            if (b.supplier_due_date !== undefined) v.supplier_due_date = date(b.supplier_due_date);
        }
        return v;
    }

    async addService(req: RequestWithUser, res: Response) {
        try {
            const booking: any = await this.scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const v = await this.serviceValues(req, { type: "other", ...req.body });
            if (!v.description) return no(res, "Please describe the service");
            await BookingService.create({ ...v, agency_uuid: booking.dataValues.agency_uuid, booking_id: booking.dataValues.id });
            await this.recalcBooking(booking.dataValues.id);
            return ok(res, "Service added");
        } catch (error) { return fail(res, error, "addService"); }
    }

    private async scopedService(req: RequestWithUser, uuid: string) {
        const s: any = await BookingService.findOne({ where: { agency_uuid: ctx(req).agencyUuid, uuid } });
        if (!s) return null;
        const scope = await recordScope(req);
        const b: any = await Booking.findOne({ where: { ...scope, id: s.dataValues.booking_id }, attributes: ["id", "booking_no", "branch_id"] });
        return b ? { service: s, booking: b } : null;
    }

    async updateService(req: RequestWithUser, res: Response) {
        try {
            const found = await this.scopedService(req, req.params.uuid);
            if (!found) return no(res, "Service not found");
            const v = await this.serviceValues(req, req.body || {}, found.service);
            await found.service.update(v);
            await this.recalcBooking(found.booking.dataValues.id);
            return ok(res, "Service saved");
        } catch (error) { return fail(res, error, "updateService"); }
    }

    async deleteService(req: RequestWithUser, res: Response) {
        try {
            const found = await this.scopedService(req, req.params.uuid);
            if (!found) return no(res, "Service not found");
            if (Number(found.service.dataValues.supplier_paid) > 0) return no(res, "A supplier payment is recorded on this service. Cancel it instead, with the supplier's cancellation charge.");
            await found.service.destroy();
            await this.recalcBooking(found.booking.dataValues.id);
            return ok(res, "Service removed");
        } catch (error) { return fail(res, error, "deleteService"); }
    }

    // POST /travel/bookings/services/:uuid/supplier_payment { amount, paid_at?, method?, reference? }
    async supplierPayment(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!(a.isOwner || a.teamRole === "accounts")) return no(res, "Only the owner or Accounts can record supplier payments");
            const found = await this.scopedService(req, req.params.uuid);
            if (!found) return no(res, "Service not found");
            const amount = toPaise(req.body?.amount);
            const s = found.service.dataValues;
            const due = supplierOwed(s);
            if (!(amount > 0)) return no(res, "Enter the amount paid");
            if (amount > due) return no(res, `Only Rs ${toRupees(due)} is due to the supplier on this service`);
            const payments = Array.isArray(found.service.supplier_payments) ? found.service.supplier_payments : [];
            payments.push({ amount, paid_at: date(req.body?.paid_at) || new Date().toISOString().slice(0, 10), method: str(req.body?.method, 30) || "bank_transfer", reference: str(req.body?.reference, 80), by: a.userId });
            await found.service.update({ supplier_paid: Number(s.supplier_paid) + amount, supplier_payments: payments });
            audit(req, { entity: "booking", entityId: found.booking.dataValues.id, branchId: found.booking.dataValues.branch_id, action: "supplier_payment", summary: `Supplier payment Rs ${toRupees(amount)} on ${found.booking.dataValues.booking_no} (${s.description})` });
            return ok(res, "Supplier payment recorded");
        } catch (error) { return fail(res, error, "supplierPayment"); }
    }

    private travellerValues(b: any) {
        const v: any = {};
        if (b.name !== undefined) { v.name = str(b.name); if (!v.name) throw new UserError("Please enter the traveller's name as on the passport"); }
        if (b.pax_type !== undefined) v.pax_type = ["adult", "child", "infant"].includes(b.pax_type) ? b.pax_type : "adult";
        if (b.dob !== undefined) v.dob = date(b.dob);
        if (b.gender !== undefined) v.gender = str(b.gender, 10);
        if (b.nationality !== undefined) v.nationality = str(b.nationality, 60);
        if (b.passport_expiry !== undefined) v.passport_expiry = date(b.passport_expiry);
        if (b.meal_pref !== undefined) v.meal_pref = str(b.meal_pref, 60);
        if (b.seat_pref !== undefined) v.seat_pref = str(b.seat_pref, 60);
        if (b.passport_no) {
            const p = String(b.passport_no).replace(/\s/g, "").toUpperCase().slice(0, 20);
            if (!/^[A-Z0-9]{6,20}$/.test(p)) throw new UserError("Passport number looks wrong");
            v.passport_no_enc = encryptPii(p);
            v.passport_last4 = p.slice(-4);
        }
        if (b.pan) {
            const pan = String(b.pan).replace(/\s/g, "").toUpperCase();
            if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) throw new UserError("PAN should look like ABCDE1234F");
            v.pan_enc = encryptPii(pan);
        }
        return v;
    }

    async addTraveller(req: RequestWithUser, res: Response) {
        try {
            const booking: any = await this.scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const v = this.travellerValues({ pax_type: "adult", ...req.body });
            if (!v.name) return no(res, "Please enter the traveller's name as on the passport");
            await BookingTraveller.create({ ...v, agency_uuid: booking.dataValues.agency_uuid, booking_id: booking.dataValues.id });
            return ok(res, "Traveller added");
        } catch (error) { return fail(res, error, "addTraveller"); }
    }

    private async scopedTraveller(req: RequestWithUser, uuid: string) {
        const t: any = await BookingTraveller.findOne({ where: { agency_uuid: ctx(req).agencyUuid, uuid } });
        if (!t) return null;
        const scope = await recordScope(req);
        const b: any = await Booking.findOne({ where: { ...scope, id: t.dataValues.booking_id }, attributes: ["id", "booking_no", "branch_id"] });
        return b ? { traveller: t, booking: b } : null;
    }

    async updateTraveller(req: RequestWithUser, res: Response) {
        try {
            const found = await this.scopedTraveller(req, req.params.uuid);
            if (!found) return no(res, "Traveller not found");
            await found.traveller.update(this.travellerValues(req.body || {}));
            return ok(res, "Traveller saved");
        } catch (error) { return fail(res, error, "updateTraveller"); }
    }

    async deleteTraveller(req: RequestWithUser, res: Response) {
        try {
            const found = await this.scopedTraveller(req, req.params.uuid);
            if (!found) return no(res, "Traveller not found");
            await found.traveller.destroy();
            return ok(res, "Traveller removed");
        } catch (error) { return fail(res, error, "deleteTraveller"); }
    }

    // GET /travel/bookings/travellers/:uuid/reveal - full passport / PAN, every view is logged (DPDP)
    async revealTraveller(req: RequestWithUser, res: Response) {
        try {
            const found = await this.scopedTraveller(req, req.params.uuid);
            if (!found) return no(res, "Traveller not found");
            const t = found.traveller.dataValues;
            audit(req, { entity: "traveller", entityId: t.id, branchId: found.booking.dataValues.branch_id, action: "pii_view", summary: `Viewed passport / PAN of ${t.name} (${found.booking.dataValues.booking_no})`, meta: { ip: req.ip } });
            return ok(res, "Traveller IDs", { passport_no: decryptPii(t.passport_no_enc), pan: decryptPii(t.pan_enc) });
        } catch (error) { return fail(res, error, "revealTraveller"); }
    }

    // POST /travel/bookings/:uuid/invoice { place_of_supply?, installments?: [{label, amount, due_date}], due_date? }
    // GST invoice for the booking with CGST/SGST or IGST and TCS on overseas packages. Uses the normal client fees screens.
    async createInvoice(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!(a.isOwner || a.teamRole === "accounts" || a.teamRole === "branch_manager")) return no(res, "Only the owner, managers or Accounts can raise invoices");
            const booking: any = await this.scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            if (booking.dataValues.invoice_id) return no(res, "This booking already has an invoice");
            const bk = booking.toJSON();
            const tax = await getTravelTax();
            if (bk.is_international && Number(bk.tcs_percent) > 0) {
                const lead: any = await BookingTraveller.findOne({ where: { booking_id: bk.id, is_lead: true } });
                if (!lead?.dataValues.pan_enc) return no(res, "Add the lead traveller's PAN first - it is needed for TCS on overseas packages");
            }
            const agency = await agencyBrand(a.agencyUuid);
            const billing = readBilling(agency?.billing_settings);
            const agencyState = stateOfGstin(billing.gstin);
            const pos = /^\d{2}$/.test(String(req.body?.place_of_supply || "")) ? String(req.body.place_of_supply) : agencyState;
            const t = bookingTax(bk);
            const split = splitGst(t.gst, agencyState, pos);
            const items: any[] = [{ description: `${bk.title} (${bk.booking_no})${bk.billing_mode === "margin" ? ` - service charge Rs ${toRupees(t.taxable)} taxable` : ""}`, amount: bk.total_sell }];
            if (t.tcs > 0) items.push({ description: `TCS @ ${Number(bk.tcs_percent)}% on overseas tour package`, amount: t.tcs });
            const subtotal = items.reduce((s, i) => s + i.amount, 0);
            const total = subtotal + t.gst;
            let installments: any = null;
            if (Array.isArray(req.body?.installments) && req.body.installments.length) {
                const list = req.body.installments.slice(0, 12).map((i: any, n: number) => ({ label: str(i?.label, 60) || `Instalment ${n + 1}`, amount: toPaise(i?.amount), due_date: date(i?.due_date) }));
                if (list.some((i: any) => !(i.amount > 0) || !i.due_date)) return no(res, "Each instalment needs an amount and a due date");
                const sum = list.reduce((s: number, i: any) => s + i.amount, 0);
                if (sum !== total) return no(res, `Instalments add up to Rs ${toRupees(sum)} but the invoice total is Rs ${toRupees(total)}`);
                installments = list.sort((x: any, y: any) => x.due_date.localeCompare(y.due_date));
            }
            const invoice: any = await sequelize.transaction(async (tx: any) => {
                const number = await nextNumber(a.agencyUuid, billing.invoice_prefix || "INV", tx);
                const inv: any = await ClientInvoice.create({
                    agency_uuid: a.agencyUuid, number, student_id: bk.user_id, title: bk.title, items, subtotal,
                    gst_percent: Number(bk.gst_percent), gst_amount: t.gst, total, amount_paid: 0, status: "unpaid",
                    issue_date: new Date().toISOString().slice(0, 10), due_date: installments ? installments[installments.length - 1].due_date : (date(req.body?.due_date) || bk.start_date || null),
                    installments, branch_id: bk.branch_id, booking_id: bk.id, billing_mode: bk.billing_mode,
                    sac_code: bk.billing_mode === "margin" ? tax.sac_margin : tax.sac_full_value, place_of_supply: pos,
                    taxable_value: t.taxable, cgst: split.cgst, sgst: split.sgst, igst: split.igst, tcs_percent: Number(bk.tcs_percent), tcs_amount: t.tcs,
                }, { transaction: tx });
                await booking.update({ invoice_id: inv.dataValues.id, tax_total: t.gst + t.tcs }, { transaction: tx });
                return inv;
            });
            audit(req, { entity: "invoice", entityId: invoice.dataValues.id, branchId: bk.branch_id, action: "created", summary: `Invoice ${invoice.dataValues.number} for booking ${bk.booking_no}: Rs ${toRupees(total)}` });
            return ok(res, `Invoice ${invoice.dataValues.number} created`, { id: invoice.dataValues.uuid });
        } catch (error) { return fail(res, error, "createInvoice"); }
    }
}

/** Base URL of this API as the client sees it (for public share links). */
export const publicApiBase = (req: any) => {
    const env = (process.env.PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
    if (env) return env;
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
    return `${proto}://${req.get("host")}/api`;
};

export default new TravelController();
