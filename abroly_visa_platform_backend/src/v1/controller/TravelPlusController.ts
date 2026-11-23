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
            const rows: any[] = await LeadIntegration.findAll({ where: { agency_uuid: accessOf(req).agencyUuid, type: "whatsapp" }, attributes: ["id", "uuid", "name", "status", "branch_id", "createdAt"], raw: true });
            return ok(res, "WhatsApp numbers", rows);
        } catch (error) { return fail(res, error, "whatsappNumbers"); }
    }
}

// ---------------------------------------------------------------- public package pages (free lead source)

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const inr = (paise: number) => `₹${Math.round(Number(paise) / 100).toLocaleString("en-IN")}`;
const shell = (title: string, color: string, body: string, desc = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<style>:root{--b:${color}}*{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;background:#f8fafc}.w{max-width:960px;margin:0 auto;padding:16px}
header{background:var(--b);color:#fff;border-radius:16px;padding:18px 20px;display:flex;gap:12px;align-items:center}header img{width:46px;height:46px;border-radius:10px;background:#fff;object-fit:contain}h1{margin:0;font-size:22px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:14px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;display:block}
.card img,.hero{width:100%;height:170px;object-fit:cover;background:#e5e7eb;display:block}.hero{height:260px;border-radius:14px;margin-top:14px}.p{padding:14px 16px}.price{font-size:20px;font-weight:700}.m{color:#6b7280;font-size:13px}
.box{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px;margin-top:14px}.cols{display:grid;grid-template-columns:1.4fr 1fr;gap:14px}@media(max-width:760px){.cols{grid-template-columns:1fr}}
label{display:block;font-size:13px;color:#374151;margin:8px 0 4px}input,textarea{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:10px;font:inherit}button{margin-top:12px;width:100%;border:0;border-radius:10px;padding:12px;background:var(--b);color:#fff;font:600 15px system-ui;cursor:pointer}
.ok{background:#ecfdf5;border-color:#a7f3d0}.day{border-top:1px solid #f1f5f9;padding:8px 0}.hp{position:absolute;left:-9999px}footer{color:#6b7280;font-size:13px;text-align:center;padding:18px}</style></head><body><div class="w">${body}</div></body></html>`;

const agencyFor = async (where: any) => Agent.findOne({ where: { ...where, role: "agent" }, attributes: ["uuid", "app_name", "username", "primary_color", "support_number", "support_email", "favicon_url"], raw: true }) as Promise<any>;
const head = (ag: any) => {
    const logo = ag?.favicon_url ? (String(ag.favicon_url).startsWith("http") ? ag.favicon_url : publicFileUrl("profiles", ag.favicon_url)) : null;
    return `<header>${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><h1>${esc(ag?.app_name || ag?.username || "Holiday packages")}</h1><div>${esc([ag?.support_number, ag?.support_email].filter(Boolean).join(" · "))}</div></div></header>`;
};
const colorOf = (ag: any) => (/^#[0-9a-f]{3,8}$/i.test(ag?.primary_color || "") ? ag.primary_color : "#0f5bd8");

/** GET /public/travel/packages/:agencyUuid - the agency's package catalogue. */
export const publicCatalogue = async (req: Request, res: Response) => {
    try {
        const ag = await agencyFor({ uuid: String(req.params.agency || "") });
        if (!ag || !(await hasModule(ag.uuid, "itinerary"))) return res.status(404).send("Not found");
        const today = new Date().toISOString().slice(0, 10);
        const rows: any[] = await TourPackage.findAll({ where: { agency_uuid: ag.uuid, status: "active", [Op.or]: [{ valid_to: null }, { valid_to: { [Op.gte]: today } }] }, order: [["title", "ASC"]], raw: true });
        const cards = rows.filter((p) => p.public_slug).map((p) => `<a class="card" href="${esc(`${req.baseUrl}/package/${p.public_slug}`)}">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : `<div class="hero" style="height:170px;border-radius:0;margin:0"></div>`}<div class="p"><b>${esc(p.title)}</b><div class="m">${esc([p.destination, `${p.nights}N/${Number(p.nights) + 1}D`].filter(Boolean).join(" · "))}</div><div class="price">${inr(p.price_pp)} <span class="m">per person</span></div></div></a>`).join("");
        return res.status(200).send(shell(`${ag.app_name || ag.username} - holiday packages`, colorOf(ag), `${head(ag)}<div class="grid">${cards || `<p class="m">New packages are coming soon.</p>`}</div><footer>Prices per person. Ask us for a custom trip.</footer>`, "Holiday packages"));
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
        const dayHtml = (Array.isArray(days) ? days : []).map((d: any, i: number) => `<div class="day"><b>Day ${i + 1}: ${esc(d.title)}</b>${(d.items || []).length ? `<div class="m">${(d.items || []).map((x: any) => esc(x.text)).join(" · ")}</div>` : ""}</div>`).join("");
        const form = sent ? `<div class="box ok"><b>Thank you!</b><p>We have your enquiry and will call you shortly.</p></div>` : `<form class="box" method="post" action="${esc(req.originalUrl.split("?")[0])}">
            <b>Enquire about this trip</b>
            <label>Your name</label><input name="name" required maxlength="100">
            <label>Mobile / WhatsApp</label><input name="phone" required inputmode="tel" maxlength="20">
            <label>Email (optional)</label><input name="email" type="email" maxlength="120">
            <label>Travel date</label><input name="travel_date" type="date">
            <label>Travellers</label><input name="travellers" type="number" min="1" max="50" value="2">
            <label>Anything else?</label><textarea name="message" rows="2" maxlength="1000"></textarea>
            <input class="hp" name="website" tabindex="-1" autocomplete="off">
            <button>Send enquiry</button></form>`;
        const body = `${head(ag)}${p.image_url ? `<img class="hero" src="${esc(p.image_url)}" alt="">` : ""}
            <div class="cols"><div class="box"><h1 style="font-size:24px">${esc(p.title)}</h1><div class="m">${esc([p.destination, `${p.nights}N/${Number(p.nights) + 1}D`].filter(Boolean).join(" · "))}</div>
            <div class="price" style="margin-top:6px">${inr(p.price_pp)} <span class="m">per person</span></div>${p.valid_to ? `<div class="m">Valid till ${esc(p.valid_to)}</div>` : ""}
            ${p.highlights ? `<p>${esc(p.highlights).replace(/\n/g, "<br>")}</p>` : ""}${dayHtml ? `<h3>Day by day</h3>${dayHtml}` : ""}
            ${it?.inclusions ? `<h3>Included</h3><p>${esc(it.inclusions).replace(/\n/g, "<br>")}</p>` : ""}${it?.exclusions ? `<h3>Not included</h3><p>${esc(it.exclusions).replace(/\n/g, "<br>")}</p>` : ""}</div>
            <div>${form}</div></div><footer><a href="${esc(`${req.baseUrl}/packages/${p.agency_uuid}`)}">See all packages</a></footer>`;
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src * data:; style-src 'unsafe-inline'; form-action 'self'");
        return res.status(200).send(shell(p.title, colorOf(ag), body, `${p.title} - ${inr(p.price_pp)} per person`));
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
