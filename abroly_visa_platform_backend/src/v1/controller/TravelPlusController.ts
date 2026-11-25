import crypto from "crypto";
import path from "path";
import multer from "multer";
import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, leadScope } from "../../helpers/access";
import { agencyOwner, publicFileUrl, saveFile } from "../../helpers/storage";
import Agent from "../../model/Agent";
import User from "../../model/User";
import CrmLead, { CRM_LEAD_STATUSES } from "../../model/CrmLead";
import LeadIntegration from "../../model/LeadIntegration";
import MessageTemplate from "../../model/MessageTemplate";
import { Booking, BookingService, BookingTraveller, ClientMember, Itinerary, Quotation, TourPackage, TravelSupplier } from "../../model/Travel";
import { ingestLead, logActivity } from "../../services/leadIngestion";
import { sendTemplate } from "../../services/messaging";
import { sendWhatsappText } from "../../services/meta";
import { hasModule } from "../../services/modules";
import { seesCost, toPaise, toRupees } from "../../services/travel";
import { Brand, itineraryPdf, quotePdf, vouchersPdf } from "../../services/travelPdf";
import { publicApiBase } from "./TravelController";

/**
 * Travel CRM, third part:
 *   sales pipeline (prospect tracker), contacts directory, photo uploads for itineraries and library,
 *   PDFs (itinerary, quote, vouchers), WhatsApp sending through the agency's own number (Meta Cloud API)
 *   with templates per travel event, and public package pages with an enquiry form that creates a lead.
 */

const str = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).replace(/\u0000/g, "").trim().slice(0, max) || null);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const ok = (res: Response, message: string, data?: any) => returnHelper(res, 200, true, message, data);
const no = (res: Response, message: string) => returnHelper(res, 200, false, message);
const fail = (res: Response, error: any, where: string) => {
    console.error(`TravelPlusController.${where}`, error);
    return returnHelper(res, 200, false, error?.expose ? error.message : "Something went wrong, please try again");
};

const OPEN_STAGES = ["new", "contacted", "follow_up", "interested", "counselling"];

// ---------------------------------------------------------------- photo uploads (public, used on client pages)

// one or many photos at once: field "files" (up to 10) or "file"
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => cb(null, /\.(jpe?g|png|webp)$/i.test(file.originalname) && /^image\//.test(file.mimetype)),
}).fields([{ name: "files", maxCount: 10 }, { name: "file", maxCount: 1 }]);
export const travelImageUpload = (req: Request, res: Response, next: NextFunction) =>
    imageUpload(req, res, (err: any) => (err ? returnHelper(res, 200, false, err.code === "LIMIT_FILE_SIZE" ? "Each photo can be up to 5 MB" : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? "Up to 10 photos at a time" : err.message || "Upload failed") : next()));

// ---------------------------------------------------------------- PDFs (layouts in services/travelPdf.ts)

/** Agency look and billing details for PDFs. */
export const pdfBrand = async (agencyUuid: string): Promise<Brand> => {
    const a: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["app_name", "username", "primary_color", "support_number", "support_email", "agency_address", "favicon_url", "billing_settings"], raw: true });
    let billing: any = {}; try { billing = a?.billing_settings ? JSON.parse(a.billing_settings) : {}; } catch { billing = {}; }
    return {
        name: billing.legal_name || a?.app_name || a?.username || "Travel agency",
        color: /^#[0-9a-f]{6}$/i.test(a?.primary_color || "") ? a.primary_color : "#0f5bd8",
        phone: a?.support_number || "", email: a?.support_email || "", address: billing.address || a?.agency_address || "",
        logo: a?.favicon_url ? (String(a.favicon_url).startsWith("http") ? a.favicon_url : publicFileUrl("profiles", a.favicon_url)) : null,
        gstin: billing.gstin || "", upi: billing.upi_id || "", bank: billing.bank_details || "",
        review: /^https:\/\//.test(String(billing.google_review_url || "")) ? billing.google_review_url : "", rating: billing.google_rating || "",
    };
};

/** Itinerary PDF (also used by the public client page). */
export const renderItineraryPdf = async (res: Response, it: any, quote: any, agencyUuid: string) => {
    const lead: any = it?.dataValues?.crm_lead_id ? await CrmLead.findByPk(it.dataValues.crm_lead_id, { attributes: ["name"], raw: true }) : null;
    return itineraryPdf(res, await pdfBrand(agencyUuid), it, quote, lead ? { name: lead.name } : null);
};

class TravelPlusController {
    // ------------------------------------------------------------ sales pipeline (prospect tracker)

    /** GET /travel/pipeline - open travel deals by stage with value, priority, close date, owner; win rate and average deal. */
    async pipeline(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const where: any = { ...leadScope(req), business_line: "travel" };
            if (req.query.owner) where.assigned_to = Number(req.query.owner) || null;
            const leads: any[] = await CrmLead.findAll({
                where: { ...where, status: { [Op.in]: OPEN_STAGES } },
                attributes: ["id", "uuid", "name", "status", "assigned_to", "deal_value", "budget", "priority", "expected_close", "destinations", "travel_start", "nights", "adults", "children", "phone_normalized", "updatedAt"],
                order: [["updatedAt", "DESC"]], limit: 500,
            });
            const ids = leads.map((l) => l.dataValues.id);
            const quotes: any[] = await Quotation.findAll({ where: { agency_uuid: a.agencyUuid, crm_lead_id: ids.concat([-1]), status: { [Op.in]: ["draft", "sent"] } }, attributes: ["crm_lead_id", "sell_total", "updatedAt"], order: [["updatedAt", "DESC"]], raw: true });
            const quoteBy = new Map<number, number>();
            for (const q of quotes) if (!quoteBy.has(q.crm_lead_id)) quoteBy.set(q.crm_lead_id, Number(q.sell_total));
            const people: any[] = await Agent.findAll({ where: { [Op.or]: [{ uuid: a.agencyUuid, role: "agent" }, { parent_uuid: a.agencyUuid }] }, attributes: ["id", "username"], raw: true });
            const nameOf = new Map(people.map((p) => [p.id, p.username]));
            const deals = leads.map((l) => {
                const d = l.dataValues;
                const value = d.deal_value != null ? Number(d.deal_value) : quoteBy.get(d.id) ?? (d.budget != null ? Number(d.budget) : 0);
                return {
                    id: d.uuid, name: d.name, stage: d.status, value: toRupees(value), value_from: d.deal_value != null ? "set" : quoteBy.has(d.id) ? "quote" : d.budget != null ? "budget" : "none",
                    priority: d.priority || "medium", expected_close: d.expected_close, owner_id: d.assigned_to, owner: nameOf.get(d.assigned_to) || "Unassigned",
                    destination: (Array.isArray(d.destinations) ? d.destinations : typeof d.destinations === "string" ? JSON.parse(d.destinations || "[]") : []).join(", "),
                    travel_start: d.travel_start, pax: Number(d.adults || 0) + Number(d.children || 0), phone: String(d.phone_normalized || "").replace(/\D/g, ""), updatedAt: d.updatedAt,
                };
            });
            // win rate and average deal size: travel leads closed in the last 90 days
            const since = new Date(Date.now() - 90 * 864e5);
            const closed: any[] = await CrmLead.findAll({ where: { ...where, status: { [Op.in]: ["converted", "lost"] }, updatedAt: { [Op.gte]: since } }, attributes: ["status", "converted_booking_id"], raw: true });
            const won = closed.filter((c) => c.status === "converted");
            const wonBookings: any[] = await Booking.findAll({ where: { id: won.map((w) => w.converted_booking_id).filter(Boolean).concat([-1]) }, attributes: ["total_sell"], raw: true });
            const avg = wonBookings.length ? wonBookings.reduce((s, b) => s + Number(b.total_sell), 0) / wonBookings.length : 0;
            const today = new Date().toISOString().slice(0, 10);
            return ok(res, "Pipeline", {
                stages: OPEN_STAGES,
                deals,
                stats: {
                    open_deals: deals.length,
                    pipeline_value: Math.round(deals.reduce((s, d) => s + d.value, 0)),
                    win_rate: closed.length ? Math.round(won.length * 1000 / closed.length) / 10 : 0,
                    won_90: won.length, lost_90: closed.length - won.length,
                    avg_deal: toRupees(avg),
                    closing_this_month: deals.filter((d) => d.expected_close && d.expected_close.slice(0, 7) === today.slice(0, 7)).length,
                    overdue_close: deals.filter((d) => d.expected_close && d.expected_close < today).length,
                },
                team: people.map((p) => ({ id: p.id, name: p.username })),
            });
        } catch (error) { return fail(res, error, "pipeline"); }
    }

    /** POST /travel/pipeline/:uuid { stage?, deal_value?, priority?, expected_close? } */
    async updateDeal(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const lead: any = await CrmLead.findOne({ where: { ...leadScope(req), uuid: req.params.uuid } });
            if (!lead) return no(res, "Lead not found");
            const b = req.body || {};
            const u: any = {};
            if (b.deal_value !== undefined) u.deal_value = b.deal_value === null || b.deal_value === "" ? null : Math.max(0, toPaise(b.deal_value));
            if (b.priority !== undefined) u.priority = ["low", "medium", "high"].includes(b.priority) ? b.priority : null;
            if (b.expected_close !== undefined) u.expected_close = date(b.expected_close);
            if (b.stage !== undefined) {
                if (!OPEN_STAGES.includes(b.stage) && b.stage !== "lost") return no(res, "Move the deal to an open stage, or mark it lost. Booking a quote marks it won.");
                if (lead.dataValues.status === "converted") return no(res, "This deal is already booked");
                if (b.stage !== lead.dataValues.status) {
                    u.status = b.stage;
                    if (b.stage === "lost") u.lost_reason = str(b.lost_reason, 500) || "Lost in pipeline";
                    await logActivity(lead.dataValues.id, a.agencyUuid, "status_change", `Status changed from ${lead.dataValues.status} to ${b.stage}`, a.userId, { from: lead.dataValues.status, to: b.stage });
                }
            }
            if (!Object.keys(u).length) return no(res, "Nothing to update");
            await lead.update(u);
            return ok(res, "Deal updated");
        } catch (error) { return fail(res, error, "updateDeal"); }
    }

    // ------------------------------------------------------------ contacts / travellers directory

    /** GET /travel/clients?search=&page= - every client with bookings, family size, last trip and total spend. */
    async clients(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const search = String(req.query.search || "").trim();
            const page = Math.max(1, Number(req.query.page) || 1);
            const scopeBookings: any = { agency_uuid: a.agencyUuid, status: { [Op.ne]: "cancelled" } };
            if (!(a.isOwner || a.teamRole === "accounts" || a.seesAll) && a.branchId) scopeBookings.branch_id = a.branchId;
            const bookings: any[] = await Booking.findAll({ where: scopeBookings, attributes: ["user_id", "total_sell", "start_date", "destination"], raw: true });
            // clients = people with a booking, plus clients with saved family members
            const memberRows: any[] = await ClientMember.findAll({ where: { agency_uuid: a.agencyUuid }, attributes: ["user_id"], raw: true });
            const ids = [...new Set([...bookings.map((b) => b.user_id), ...memberRows.map((m) => m.user_id)])];
            const where: any = { agency_uuid: a.agencyUuid, id: ids.concat([-1]) };
            if (search) {
                const digits = search.replace(/\D/g, "");
                where[Op.or] = [{ username: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }, ...(digits.length >= 3 ? [{ phone_number: { [Op.like]: `%${digits}%` } }] : [])];
            }
            const { rows, count } = await User.findAndCountAll({ where, attributes: ["id", "username", "email", "phone_number", "country_code", "travel_prefs", "createdAt"], order: [["username", "ASC"]], limit: 50, offset: (page - 1) * 50 });
            const today = new Date().toISOString().slice(0, 10);
            const list = rows.map((u: any) => {
                const mine = bookings.filter((b) => b.user_id === u.dataValues.id);
                const past = mine.filter((b) => b.start_date && b.start_date < today).sort((x, y) => y.start_date.localeCompare(x.start_date));
                const next = mine.filter((b) => b.start_date && b.start_date >= today).sort((x, y) => x.start_date.localeCompare(y.start_date))[0];
                let prefs: any = u.dataValues.travel_prefs; if (typeof prefs === "string") { try { prefs = JSON.parse(prefs); } catch { prefs = {}; } }
                return {
                    id: u.dataValues.id, name: u.dataValues.username, email: u.dataValues.email, phone: `${u.dataValues.country_code || ""} ${u.dataValues.phone_number || ""}`.trim(),
                    phone_digits: `${String(u.dataValues.country_code || "").replace(/\D/g, "")}${u.dataValues.phone_number || ""}`,
                    trips: mine.length, spend: toRupees(mine.reduce((s, b) => s + Number(b.total_sell), 0)),
                    last_trip: past[0] ? { date: past[0].start_date, destination: past[0].destination } : null,
                    next_trip: next ? { date: next.start_date, destination: next.destination } : null,
                    family: memberRows.filter((m) => m.user_id === u.dataValues.id).length,
                    birthday: prefs?.birthday || null, anniversary: prefs?.anniversary || null,
                };
            });
            return ok(res, "Clients", { clients: list, total: count, page });
        } catch (error) { return fail(res, error, "clients"); }
    }

    // ------------------------------------------------------------ photos

    /** POST /travel/media (multipart file) - a photo for itineraries, library items or packages; returns a public URL. */
    async uploadImage(req: RequestWithUser, res: Response) {
        try {
            const f = (req as any).files || {};
            const files = [...(f.files || []), ...(f.file || [])] as Express.Multer.File[];
            if (!files.length) return no(res, "Choose JPG, PNG or WebP photos (up to 5 MB each)");
            const owner = agencyOwner(accessOf(req).agencyUuid);
            const urls: string[] = [];
            for (const file of files) {
                const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
                const ref = await saveFile({ owner, folder: "travel_media", name: `${crypto.randomUUID()}${ext}`, body: file.buffer, contentType: file.mimetype });
                const url = publicFileUrl("travel_media", ref);
                urls.push(url && !/^https?:/.test(url) ? `${publicApiBase(req).replace(/\/api$/, "")}/${url.replace(/^\//, "")}` : String(url));
            }
            // `url` stays for screens that upload one photo
            return ok(res, urls.length > 1 ? `${urls.length} photos uploaded` : "Photo uploaded", { url: urls[0], urls });
        } catch (error) { return fail(res, error, "uploadImage"); }
    }

    // ------------------------------------------------------------ PDFs

    async itineraryPdf(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const it: any = await Itinerary.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
            if (!it) return no(res, "Itinerary not found");
            const quote: any = await Quotation.findOne({ where: { agency_uuid: a.agencyUuid, itinerary_id: it.dataValues.id, status: { [Op.ne]: "superseded" } }, order: [["version", "DESC"]] });
            return renderItineraryPdf(res, it, quote, a.agencyUuid);
        } catch (error) { return fail(res, error, "itineraryPdf"); }
    }

    /** GET /travel/quotes/:uuid/pdf - quotation with price breakdown per option, payment details and day plan. */
    async quotePdf(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const q: any = await Quotation.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
            if (!q) return no(res, "Quote not found");
            const it: any = q.dataValues.itinerary_id ? await Itinerary.findByPk(q.dataValues.itinerary_id) : null;
            const lead: any = q.dataValues.crm_lead_id ? await CrmLead.findByPk(q.dataValues.crm_lead_id, { attributes: ["name", "country_code", "phone_number", "email"], raw: true }) : null;
            const client = lead ? { name: lead.name, phone: `${lead.country_code || ""} ${lead.phone_number || ""}`.trim(), email: lead.email } : null;
            return quotePdf(res, await pdfBrand(a.agencyUuid), q, it, client, (q.dataValues.sent_at || q.dataValues.updatedAt || new Date()).toISOString().slice(0, 10));
        } catch (error) { return fail(res, error, "quotePdf"); }
    }

    /** GET /travel/bookings/:uuid/vouchers.pdf[?service=uuid] - one voucher page per hotel / transfer / activity. */
    async vouchersPdf(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const b: any = await Booking.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
            if (!b) return no(res, "Booking not found");
            const [services, pax, client]: any[] = await Promise.all([
                BookingService.findAll({ where: { booking_id: b.dataValues.id, status: { [Op.ne]: "cancelled" }, type: ["hotel", "transfer", "activity", "other"] }, include: [{ model: TravelSupplier, as: "supplier", attributes: ["name", "phone", "city"], required: false }], order: [["service_date", "ASC"], ["id", "ASC"]] }),
                BookingTraveller.findAll({ where: { booking_id: b.dataValues.id }, attributes: ["name", "pax_type", "is_lead"], order: [["is_lead", "DESC"], ["id", "ASC"]], raw: true }),
                User.findByPk(b.dataValues.user_id, { attributes: ["username", "phone_number", "country_code"], raw: true }),
            ]);
            const onlyId = String(req.query.service || "");
            return vouchersPdf(res, await pdfBrand(a.agencyUuid), b, services.filter((s: any) => !onlyId || s.dataValues.uuid === onlyId), pax, client);
        } catch (error) { return fail(res, error, "vouchersPdf"); }
    }

    // ------------------------------------------------------------ WhatsApp through the agency's own number

    /**
     * POST /travel/whatsapp/send { to, text, trigger?, vars?, lead_id? }
     * Uses the agency's approved template for this travel event when one is set up (Messages → When to send),
     * else free text (only inside 24 hours of the client's last message). Returns { sent } or { fallback_url } for wa.me.
     */
    async sendWhatsapp(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const b = req.body || {};
            const to = String(b.to || "").replace(/\D/g, "");
            const text = String(b.text || "").trim().slice(0, 4000);
            const fallback_url = `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
            if (!to || !text) return no(res, "Add a phone number and a message");
            const connected = await LeadIntegration.count({ where: { agency_uuid: a.agencyUuid, type: "whatsapp", status: "active" } });
            if (!connected) return ok(res, "WhatsApp Business is not connected - opening WhatsApp instead", { sent: false, fallback_url, reason: "not_connected" });
            const lead: any = b.lead_id ? await CrmLead.findOne({ where: { ...leadScope(req), uuid: b.lead_id }, attributes: ["id", "integration_id", "source"] }) : await CrmLead.findOne({ where: { agency_uuid: a.agencyUuid, phone_normalized: { [Op.like]: `%${to.slice(-10)}` } }, attributes: ["id", "integration_id", "source"], order: [["id", "DESC"]] });
            const trigger = String(b.trigger || "");
            const template: any = trigger ? await MessageTemplate.findOne({ where: { agency_uuid: a.agencyUuid, trigger, channel: "whatsapp", is_active: 1 } }) : null;
            if (template?.dataValues.wa_template_name) {
                const result = await sendTemplate(template, { name: b.vars?.name || null, phoneDigits: to, leadId: lead?.dataValues.id || null }, { ...(b.vars || {}) });
                if (result.ok) return ok(res, "Sent on WhatsApp", { sent: true, via: "template" });
                return ok(res, `WhatsApp template failed: ${result.error} - opening WhatsApp instead`, { sent: false, fallback_url, reason: "template_failed" });
            }
            try {
                const sent = await sendWhatsappText(a.agencyUuid, { dataValues: { phone_normalized: to, integration_id: lead?.dataValues.integration_id || null } }, text);
                if (lead) await logActivity(lead.dataValues.id, a.agencyUuid, "whatsapp", `Sent: ${text}`, a.userId, { direction: "out", wamid: sent.message_id });
                return ok(res, "Sent on WhatsApp", { sent: true, via: "text" });
            } catch (e: any) {
                return ok(res, `${e?.message || "WhatsApp could not send"} - opening WhatsApp instead`, { sent: false, fallback_url, reason: "window_closed" });
            }
        } catch (error) { return fail(res, error, "sendWhatsapp"); }
    }

    /** GET /travel/whatsapp/numbers - connected numbers (an agency can connect more than one). */
    async whatsappNumbers(req: RequestWithUser, res: Response) {
        try {
            const rows: any[] = await LeadIntegration.findAll({ where: { agency_uuid: accessOf(req).agencyUuid, type: "whatsapp" }, attributes: ["id", "uuid", "name", "status", "branch_id", "settings", "createdAt"], raw: true });
            return ok(res, "WhatsApp numbers", rows);
        } catch (error) { return fail(res, error, "whatsappNumbers"); }
    }
}

// ---------------------------------------------------------------- public package pages (free lead source)

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const inr = (paise: number) => `₹${Math.round(Number(paise) / 100).toLocaleString("en-IN")}`;
const tagOf = (n: number) => (Number(n) > 0 ? `${Number(n) + 1}D${n}N` : "1 DAY");
const listLines = (t?: string | null) => String(t || "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
const tagsOf = (h?: string | null) => String(h || "").split(/\n|,|•|·|\|/).map((x) => x.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
/** Lucide line icons (ISC) as inline SVG. */
const svg = (paths: string, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const I = {
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    palm: '<path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/>',
};
const shell = (title: string, color: string, body: string, desc = "", image = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${image ? `<meta property="og:image" content="${esc(image)}">` : ""}<meta name="theme-color" content="${esc(color)}">
<style>:root{--b:${color};--bt:color-mix(in srgb,var(--b) 10%,#fff);--bd:color-mix(in srgb,var(--b) 75%,#000)}*{box-sizing:border-box}body{margin:0;font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;background:#f6f7fb}a{color:inherit}
.w{max-width:1080px;margin:0 auto;padding:0 18px}.m{color:#6b7280;font-size:13px}svg{flex-shrink:0;vertical-align:middle}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0}.brand{display:flex;align-items:center;gap:10px;text-decoration:none}.brand img{width:42px;height:42px;border-radius:12px;background:#fff;object-fit:contain;border:1px solid #e5e7eb}.brand b{font-size:17px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;padding:10px 18px;background:var(--b);color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none;cursor:pointer}.btn.ghost{background:#fff;color:#111827;border:1px solid #e5e7eb}.btn.wa{background:#16a34a}
.hero{position:relative;overflow:hidden;border-radius:28px;background:var(--b);color:#fff;padding:44px 34px;margin-top:4px}.hero h1{margin:6px 0 8px;font-size:clamp(30px,5vw,52px);line-height:1.05;letter-spacing:-.02em}.hero p{margin:0;max-width:560px;opacity:.9}
.kick{font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.palm{position:absolute;right:-30px;bottom:-40px;opacity:.14;color:#fff}.dots{position:absolute;right:40px;top:30px;width:120px;height:60px;background-image:radial-gradient(#fff 1.2px,transparent 1.3px);background-size:10px 10px;opacity:.35}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.chip{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 12px;font-size:13px;text-decoration:none;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:20px;margin:26px 0}
.card{background:#fff;border-radius:22px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.06);transition:transform .2s,box-shadow .2s}.card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(15,23,42,.14)}
.ph{position:relative;height:220px;background:linear-gradient(135deg,var(--b),var(--bd));overflow:hidden}.ph img{width:100%;height:100%;object-fit:cover;display:block}.ph:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,0) 60%)}
.ph .palm{right:-20px;bottom:-30px;opacity:.18}.tag{position:absolute;left:14px;top:14px;z-index:1;background:#fff;color:var(--b);font-weight:800;border-radius:999px;padding:4px 12px;font-size:14px;letter-spacing:-.01em;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.cap{position:absolute;left:16px;right:16px;bottom:14px;z-index:1;color:#fff}.cap .kick{font-size:11px;opacity:.9;display:flex;align-items:center;gap:5px}.cap h3{margin:2px 0 0;font-size:19px;line-height:1.25}
.cb{padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px;flex:1}.price{font-size:24px;font-weight:800;color:var(--b);line-height:1.1}.price small{font-size:12px;font-weight:500;color:#6b7280}
.pills{display:flex;flex-wrap:wrap;gap:6px}.pill{display:inline-flex;align-items:center;gap:5px;background:var(--bt);color:var(--bd);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600}
.go{margin-top:auto;display:flex;align-items:center;justify-content:space-between;font-weight:600;color:var(--b);font-size:14px;padding-top:6px;border-top:1px solid #f1f5f9}
.banner{position:relative;height:clamp(260px,42vw,420px);border-radius:28px;overflow:hidden;background:linear-gradient(135deg,var(--b),var(--bd))}.banner img{width:100%;height:100%;object-fit:cover;display:block}.banner:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.75),rgba(0,0,0,0) 55%)}
.banner .tag{font-size:18px;padding:6px 16px;left:22px;top:22px}.banner .cap{left:26px;right:26px;bottom:24px}.banner .cap h1{margin:4px 0;font-size:clamp(26px,4.4vw,44px);line-height:1.1;letter-spacing:-.02em}
.cols{display:grid;grid-template-columns:1fr 360px;gap:22px;margin:22px 0 10px;align-items:start}@media(max-width:860px){.cols{grid-template-columns:1fr}}
.box{background:#fff;border-radius:22px;padding:22px;box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.05);margin-bottom:18px}.box h2{margin:0 0 14px;font-size:20px;display:flex;align-items:center;gap:10px}.ic{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--b);color:#fff}
.tl{position:relative;padding-left:46px}.tl:before{content:"";position:absolute;left:15px;top:8px;bottom:8px;border-left:2px dashed color-mix(in srgb,var(--b) 40%,#fff)}
.day{position:relative;border:1px solid #eef0f4;border-radius:18px;padding:14px 16px;margin-bottom:14px;background:#fff}.day .dot{position:absolute;left:-46px;top:12px;width:32px;height:32px;border-radius:50%;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;box-shadow:0 0 0 4px #fff}
.dh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dp{background:var(--b);color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:.06em}.dt{font-weight:800;color:var(--b);text-transform:uppercase;font-size:14px;letter-spacing:.02em}
.day ul{margin:8px 0 0;padding:0;list-style:none}.day li{display:flex;gap:10px;padding:3px 0;font-size:14px;color:#374151}.day li i{font-style:normal;font-weight:700;color:#111827;min-width:46px;font-size:13px}.dimg{display:flex;gap:8px;margin-top:10px;overflow:auto}.dimg img{height:110px;width:170px;object-fit:cover;border-radius:12px;flex-shrink:0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:600px){.two{grid-template-columns:1fr}}.li{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:14px;color:#374151}.li svg{margin-top:3px}.ok-i{color:#16a34a}.no-i{color:#dc2626}
.side{position:sticky;top:16px}.pc{background:var(--b);color:#fff;border-radius:22px;padding:22px;position:relative;overflow:hidden;margin-bottom:16px}.pc .dots{top:18px;right:16px;width:80px;height:40px}.pc .big{font-size:34px;font-weight:800;line-height:1.1}.pc .m{color:rgba(255,255,255,.85)}
label{display:block;font-size:13px;color:#374151;margin:10px 0 4px;font-weight:500}input,textarea{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:11px 12px;font:inherit;background:#fff}input:focus,textarea:focus{outline:2px solid color-mix(in srgb,var(--b) 40%,#fff);border-color:var(--b)}form .btn{width:100%;margin-top:14px;padding:13px}.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.okbox{background:#ecfdf5;border:1px solid #a7f3d0}.hp{position:absolute;left:-9999px}footer{color:#6b7280;font-size:13px;text-align:center;padding:26px 0 34px}</style></head><body><div class="w">${body}</div></body></html>`;

const agencyFor = async (where: any) => Agent.findOne({ where: { ...where, role: "agent" }, attributes: ["uuid", "app_name", "username", "primary_color", "support_number", "support_email", "favicon_url"], raw: true }) as Promise<any>;
const logoOf = (ag: any) => (ag?.favicon_url ? (String(ag.favicon_url).startsWith("http") ? ag.favicon_url : publicFileUrl("profiles", ag.favicon_url)) : null);
const nameOf = (ag: any) => ag?.app_name || ag?.username || "Holiday packages";
const waOf = (ag: any, text: string) => { const digits = String(ag?.support_number || "").replace(/\D/g, ""); return digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}` : ""; };
const topBar = (ag: any, home: string) => {
    const logo = logoOf(ag);
    return `<div class="top"><a class="brand" href="${esc(home)}">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<b>${esc(nameOf(ag))}</b></a>${ag?.support_number ? `<a class="btn ghost" href="tel:${esc(String(ag.support_number).replace(/[^\d+]/g, ""))}">${svg(I.phone, 15)}<span>${esc(ag.support_number)}</span></a>` : ""}</div>`;
};
const colorOf = (ag: any) => (/^#[0-9a-f]{3,8}$/i.test(ag?.primary_color || "") ? ag.primary_color : "#0f5bd8");

/** GET /public/travel/packages/:agencyUuid - the agency's package catalogue. */
export const publicCatalogue = async (req: Request, res: Response) => {
    try {
        const ag = await agencyFor({ uuid: String(req.params.agency || "") });
        if (!ag || !(await hasModule(ag.uuid, "itinerary"))) return res.status(404).send("Not found");
        const today = new Date().toISOString().slice(0, 10);
        const rows: any[] = await TourPackage.findAll({ where: { agency_uuid: ag.uuid, status: "active", [Op.or]: [{ valid_to: null }, { valid_to: { [Op.gte]: today } }] }, order: [["title", "ASC"]], raw: true });
        const list = rows.filter((p) => p.public_slug);
        const cards = list.map((p) => {
            const tags = tagsOf(p.highlights).slice(0, 3);
            return `<a class="card" href="${esc(`${req.baseUrl}/package/${p.public_slug}`)}"><div class="ph">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : `<span class="palm">${svg(I.palm, 190)}</span>`}<span class="tag">${tagOf(p.nights)}</span><div class="cap">${p.destination ? `<div class="kick">${svg(I.pin, 12)}${esc(p.destination)}</div>` : ""}<h3>${esc(p.title)}</h3></div></div>
                <div class="cb"><div><div class="m">Starting from</div><div class="price">${inr(p.price_pp)} <small>/ person</small></div></div>${tags.length ? `<div class="pills">${tags.map((t) => `<span class="pill">${svg(I.spark, 11)}${esc(t)}</span>`).join("")}</div>` : ""}
                <div class="go"><span>${p.nights}N / ${Number(p.nights) + 1}D${p.valid_to ? ` · till ${esc(new Date(`${p.valid_to}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }))}` : ""}</span><span>View trip ${svg(I.arrow, 15)}</span></div></div></a>`;
        }).join("");
        const dests = [...new Set(list.map((p) => String(p.destination || "").trim()).filter(Boolean))];
        const wa = waOf(ag, "Hi! I saw your holiday packages and would like to know more.");
        const body = `${topBar(ag, req.originalUrl.split("?")[0])}
            <section class="hero"><span class="dots"></span><span class="palm">${svg(I.palm, 280)}</span><div class="kick">Plan · Experience · Enjoy</div><h1>Holiday packages</h1><p>Handpicked trips by ${esc(nameOf(ag))}, with hotels, transfers and sightseeing sorted. Pick one or ask us for a custom plan.</p>
            <div class="chips">${dests.slice(0, 8).map((d) => `<span class="chip">${svg(I.pin, 13)}${esc(d)}</span>`).join("")}${wa ? `<a class="chip" href="${esc(wa)}">${svg(I.chat, 13)}Chat on WhatsApp</a>` : ""}</div></section>
            <div class="grid">${cards || `<p class="m">New packages are coming soon.</p>`}</div><footer>Prices are per person and depend on availability. Ask us for a custom trip.</footer>`;
        return res.status(200).send(shell(`${nameOf(ag)} - holiday packages`, colorOf(ag), body, `Holiday packages by ${nameOf(ag)}`, list.find((p) => p.image_url)?.image_url || ""));
    } catch (error) { console.error("publicCatalogue", error); return res.status(500).send("Something went wrong"); }
};

/** GET /public/travel/package/:slug - one package with its day plan and an enquiry form. */
export const publicPackage = async (req: Request, res: Response) => {
    try {
        const p: any = await TourPackage.findOne({ where: { public_slug: String(req.params.slug || ""), status: "active" }, raw: true });
        if (!p || !(await hasModule(p.agency_uuid, "itinerary"))) return res.status(404).send("This package is not available.");
        const ag = await agencyFor({ uuid: p.agency_uuid });
        const it: any = p.itinerary_id ? await Itinerary.findByPk(p.itinerary_id, { attributes: ["days", "inclusions", "exclusions"], raw: true }) : null;
        let days: any = it?.days; if (typeof days === "string") { try { days = JSON.parse(days); } catch { days = []; } }
        const sent = req.query.sent === "1";
        const TIME = /^\s*(\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)\s*[-–—:]?\s+/i;
        const pics = (x: any): string[] => (Array.isArray(x?.images) && x.images.length ? x.images : x?.image ? [x.image] : []);
        const dayHtml = (Array.isArray(days) ? days : []).map((d: any, i: number) => {
            const items = (d.items || []).filter((x: any) => String(x.text || "").trim());
            const imgs = [...new Set([...pics(d), ...items.flatMap(pics)])].slice(0, 3) as string[];
            return `<div class="day"><span class="dot">${i + 1}</span><div class="dh"><span class="dp">DAY ${i + 1}</span><span class="dt">${esc(d.title)}</span>${d.city ? `<span class="m">${svg(I.pin, 12)} ${esc(d.city)}</span>` : ""}</div>
                ${items.length ? `<ul>${items.map((x: any) => { const m = String(x.text).match(TIME); return `<li>${m ? `<i>${esc(m[1].toUpperCase())}</i><span>${esc(String(x.text).slice(m[0].length))}</span>` : `<span>${esc(x.text)}</span>`}</li>`; }).join("")}</ul>` : ""}
                ${d.notes ? `<div class="m" style="margin-top:6px">${esc(d.notes)}</div>` : ""}${imgs.length ? `<div class="dimg">${imgs.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>` : ""}</div>`;
        }).join("");
        const inc = listLines(it?.inclusions), exc = listLines(it?.exclusions), tags = tagsOf(p.highlights);
        const wa = waOf(ag, `Hi! I'm interested in "${p.title}" (${inr(p.price_pp)} per person). Please share details.`);
        const form = sent ? `<div class="box okbox"><h2>${svg(I.check, 20)} Thank you!</h2><p style="margin:0">We have your enquiry and will call you shortly.</p></div>` : `<form class="box" method="post" action="${esc(req.originalUrl.split("?")[0])}">
            <h2 style="margin-bottom:4px">Enquire about this trip</h2><div class="m">We reply within a few hours.</div>
            <label>Your name</label><input name="name" required maxlength="100" autocomplete="name">
            <label>Mobile / WhatsApp</label><input name="phone" required inputmode="tel" maxlength="20" autocomplete="tel">
            <label>Email (optional)</label><input name="email" type="email" maxlength="120" autocomplete="email">
            <div class="row2"><div><label>Travel date</label><input name="travel_date" type="date"></div><div><label>Travellers</label><input name="travellers" type="number" min="1" max="50" value="2"></div></div>
            <label>Anything else?</label><textarea name="message" rows="2" maxlength="1000"></textarea>
            <input class="hp" name="website" tabindex="-1" autocomplete="off">
            <button class="btn">Send enquiry ${svg(I.arrow, 16)}</button></form>`;
        const body = `${topBar(ag, `${req.baseUrl}/packages/${p.agency_uuid}`)}
            <div class="banner">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : `<span class="palm" style="position:absolute;right:-30px;bottom:-40px;opacity:.16;color:#fff">${svg(I.palm, 320)}</span>`}<span class="tag">${tagOf(p.nights)}</span>
                <div class="cap">${p.destination ? `<div class="kick">${svg(I.pin, 13)} ${esc(p.destination)}</div>` : ""}<h1>${esc(p.title)}</h1><div style="opacity:.9">${p.nights} nights / ${Number(p.nights) + 1} days</div></div></div>
            <div class="cols"><div>
                ${tags.length ? `<div class="box"><h2><span class="ic">${svg(I.spark, 16)}</span>Highlights</h2><div class="pills">${tags.map((t) => `<span class="pill" style="font-size:13px;padding:6px 12px">${esc(t)}</span>`).join("")}</div></div>` : ""}
                ${dayHtml ? `<div class="box"><h2><span class="ic">${svg(I.cal, 16)}</span>Day by day</h2><div class="tl">${dayHtml}</div></div>` : ""}
                ${inc.length || exc.length ? `<div class="box"><h2><span class="ic">${svg(I.check, 16)}</span>What's included</h2><div class="two"><div><b>Included</b>${inc.map((t) => `<div class="li"><span class="ok-i">${svg(I.check, 15)}</span>${esc(t)}</div>`).join("") || `<div class="m">As per the day plan</div>`}</div><div><b>Not included</b>${exc.map((t) => `<div class="li"><span class="no-i">${svg(I.x, 15)}</span>${esc(t)}</div>`).join("") || `<div class="m">Anything not listed as included</div>`}</div></div></div>` : ""}
            </div><div class="side">
                <div class="pc"><span class="dots"></span><div class="kick" style="opacity:.85;font-size:11px">Starting from</div><div class="big">${inr(p.price_pp)}</div><div class="m">per person${p.valid_to ? ` · valid till ${esc(new Date(`${p.valid_to}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }))}` : ""}</div>
                ${wa ? `<a class="btn wa" style="margin-top:16px;width:100%" href="${esc(wa)}">${svg(I.chat, 16)} Chat on WhatsApp</a>` : ""}</div>
                ${form}</div></div>
            <footer><a href="${esc(`${req.baseUrl}/packages/${p.agency_uuid}`)}">See all packages</a> · ${esc(nameOf(ag))}</footer>`;
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src * data:; style-src 'unsafe-inline'; form-action 'self'");
        return res.status(200).send(shell(p.title, colorOf(ag), body, `${p.title} - ${inr(p.price_pp)} per person`, p.image_url || ""));
    } catch (error) { console.error("publicPackage", error); return res.status(500).send("Something went wrong"); }
};

/** POST /public/travel/package/:slug - enquiry form → travel lead (source "website", campaign = package). */
export const publicPackageEnquiry = async (req: Request, res: Response) => {
    try {
        const p: any = await TourPackage.findOne({ where: { public_slug: String(req.params.slug || ""), status: "active" }, raw: true });
        if (!p || !(await hasModule(p.agency_uuid, "itinerary"))) return res.status(404).send("Not found");
        const b = req.body || {};
        const back = `${req.originalUrl.split("?")[0]}?sent=1`;
        if (b.website) return res.redirect(303, back); // bot filled the hidden field
        const phone = String(b.phone || "").replace(/[^\d+]/g, "");
        if (phone.replace(/\D/g, "").length < 8) return res.status(400).send("Please go back and enter a valid phone number.");
        const travellers = Math.min(50, Math.max(1, Number(b.travellers) || 2));
        await ingestLead({
            agencyUuid: p.agency_uuid, source: "website",
            input: {
                name: str(b.name, 100), phone, email: str(b.email, 120), message: str(b.message, 1000) || `Enquiry for ${p.title}`, campaign: `Package: ${p.title}`.slice(0, 255),
                travel: { business_line: "travel", destinations: p.destination ? [p.destination] : null, travel_start: date(b.travel_date), nights: p.nights, adults: travellers, deal_value: Number(p.price_pp) * travellers },
            },
        });
        return res.redirect(303, back);
    } catch (error: any) {
        console.error("publicPackageEnquiry", error);
        return res.status(400).send(error?.message || "Could not send your enquiry. Please try again.");
    }
};

export default new TravelPlusController();
