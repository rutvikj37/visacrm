import crypto from "crypto";
import path from "path";
import multer from "multer";
import ExcelJS from "exceljs";
import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import sequelize from "../../config/dbconfig";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, leadScope } from "../../helpers/access";
import { decryptPii, encryptPii } from "../../helpers/crypto";
import { agencyOwner, deleteFile, publicFileUrl, saveFile } from "../../helpers/storage";
import { signedFileUrl } from "../../helpers/privateFiles";
import Agent from "../../model/Agent";
import User from "../../model/User";
import CrmLead from "../../model/CrmLead";
import ClientInvoice from "../../model/ClientInvoice";
import ClientPayment from "../../model/ClientPayment";
import { Booking, BookingDocument, BookingService, BookingTraveller, ClientMember, CreditNote, Itinerary, TourPackage, TravelSupplier, TravelTarget } from "../../model/Travel";
import { audit } from "../../services/audit";
import { agencyBrand, mailEnabled, sendMail } from "../../services/mailer";
import { hasModule } from "../../services/modules";
import { DEFAULT_PERMISSIONS, LEAD_STAGE_KEYS, PERM_ACTIONS, PERM_MODULES, PERM_ROLES, can, leadStagesFor, saveTravelSettings, travelSettingsFor } from "../../services/travelAccess";
import { seesCost, supplierOwed, toPaise, toRupees } from "../../services/travel";
import { publicApiBase } from "./TravelController";
import { pdfBrand } from "./TravelPlusController";
import { vouchersPdf } from "../../services/travelPdf";
import { issueCreditNote } from "./TravelFinanceController";

/**
 * Travel CRM, second part: settings and permissions, calendar feed, client profiles, booking documents and
 * the public trip kit, credit notes and refunds, reports with Excel export (incl. TCS), targets, and erasing
 * a client's personal data on request (DPDP).
 */

const str = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).replace(/\u0000/g, "").trim().slice(0, max) || null);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const ok = (res: Response, message: string, data?: any) => returnHelper(res, 200, true, message, data);
const no = (res: Response, message: string) => returnHelper(res, 200, false, message);
const fail = (res: Response, error: any, where: string) => {
    console.error(`TravelExtraController.${where}`, error);
    return returnHelper(res, 200, false, error?.expose ? error.message : "Something went wrong, please try again");
};
const today = () => new Date().toISOString().slice(0, 10);
const tokenSecret = () => process.env.ACCESS_TOKEN_SECRET || process.env.INTEGRATION_ENCRYPTION_KEY || "travel";

// ---------------------------------------------------------------- uploads (VC-02)

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => cb(null, /\.(pdf|jpe?g|png|webp|heic|docx?)$/i.test(file.originalname)),
}).array("files", 5);
export const travelUpload = (req: Request, res: Response, next: NextFunction) =>
    upload(req, res, (err: any) => {
        if (!err) return next();
        return returnHelper(res, 200, false, err.code === "LIMIT_FILE_SIZE" ? "Each file can be up to 15 MB" : err.code === "LIMIT_FILE_COUNT" ? "Up to 5 files at a time" : err.message || "Upload failed");
    });

// ---------------------------------------------------------------- calendar feed token (LD-06)

/** Personal secret link: HMAC of the team member id, so no table is needed. Rotating ACCESS_TOKEN_SECRET resets all links. */
const calendarToken = (agentId: number) => `${agentId}-${crypto.createHmac("sha256", tokenSecret()).update(`cal:${agentId}`).digest("hex").slice(0, 32)}`;
const agentFromCalendarToken = (token: string) => {
    const m = /^(\d+)-([a-f0-9]{32})$/.exec(token || "");
    if (!m) return null;
    const id = Number(m[1]);
    return crypto.timingSafeEqual(Buffer.from(calendarToken(id)), Buffer.from(token)) ? id : null;
};
const ics = (v: any) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDay = (s: string) => s.replace(/-/g, "");

const presentMember = (x: any) => ({
    id: x.uuid, name: x.name, relation: x.relation, pax_type: x.pax_type, dob: x.dob, anniversary: x.anniversary, nationality: x.nationality,
    passport_masked: x.passport_last4 ? `••••${x.passport_last4}` : null, passport_expiry: x.passport_expiry, has_pan: Boolean(x.pan_enc),
    meal_pref: x.meal_pref, seat_pref: x.seat_pref,
});

const scopedBooking = async (req: RequestWithUser, uuid: string) => {
    const a = accessOf(req);
    const where: any = { agency_uuid: a.agencyUuid, uuid };
    if (!(a.isOwner || a.teamRole === "accounts" || a.seesAll) && (a.teamRole === "branch_manager" || a.teamRole === "operations") && a.branchId) where.branch_id = a.branchId;
    const b: any = await Booking.findOne({ where });
    if (!b) return null;
    if (a.isOwner || ["accounts", "branch_manager", "operations"].includes(a.teamRole) || a.seesAll) return b;
    // counsellors: bookings they made or of leads they can see
    if (b.dataValues.created_by === a.userId) return b;
    const lead = b.dataValues.crm_lead_id ? await CrmLead.findOne({ where: { ...leadScope(req), id: b.dataValues.crm_lead_id }, attributes: ["id"] }) : null;
    return lead ? b : null;
};

class TravelExtraController {
    // ------------------------------------------------------------ settings & permissions (owner)

    async getSettings(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const [settings, stages, team] = await Promise.all([
                travelSettingsFor(a.agencyUuid),
                leadStagesFor(a.agencyUuid),
                Agent.findAll({ where: { [Op.or]: [{ uuid: a.agencyUuid, role: "agent" }, { parent_uuid: a.agencyUuid }], status: "active" }, attributes: ["id", "username", "team_role", "role"], raw: true }),
            ]);
            return ok(res, "Travel settings", {
                ...settings, stages, defaults: DEFAULT_PERMISSIONS, modules: PERM_MODULES, actions: PERM_ACTIONS, roles: PERM_ROLES, stage_keys: LEAD_STAGE_KEYS,
                team: team.map((t: any) => ({ id: t.id, name: t.username, role: t.role === "agent" ? "owner" : t.team_role })),
                is_owner: a.isOwner,
                calendar_url: `${publicApiBase(req)}/v1/public/travel/calendar/${calendarToken(a.userId)}.ics`,
            });
        } catch (error) { return fail(res, error, "getSettings"); }
    }

    async saveSettings(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const b = req.body || {};
            // anyone who builds quotes may add to the saved inclusions / exclusions / terms
            const onlyLibrary = Object.keys(b).every((k) => k === "quote_library");
            if (!a.isOwner && !onlyLibrary) return no(res, "Only the agency owner can change these settings");
            const patch: any = {};
            for (const k of ["lead_stages", "destination_rules", "discount_approval_pct", "permissions", "emergency_contacts", "quote_library"]) if (b[k] !== undefined) patch[k] = b[k];
            const saved = await saveTravelSettings(a.agencyUuid, patch);
            audit(req, { entity: "settings", action: "travel_settings", summary: `Travel settings changed: ${Object.keys(patch).join(", ")}` });
            return ok(res, "Settings saved", saved);
        } catch (error) { return fail(res, error, "saveSettings"); }
    }

    // ------------------------------------------------------------ calendar feed

    /** GET /public/travel/calendar/:token.ics - follow-ups and departures; Google Calendar can subscribe to it. */
    async calendarFeed(req: Request, res: Response) {
        try {
            const agentId = agentFromCalendarToken(String(req.params.token || "").replace(/\.ics$/, ""));
            if (!agentId) return res.status(404).send("Not found");
            const me: any = await Agent.findOne({ where: { id: agentId, status: "active" }, attributes: ["id", "uuid", "role", "parent_uuid", "username"], raw: true });
            if (!me) return res.status(404).send("Not found");
            const agencyUuid = me.role === "agent" ? me.uuid : me.parent_uuid;
            const owner = me.role === "agent";
            const since = new Date(Date.now() - 30 * 864e5);
            const leads: any[] = await CrmLead.findAll({
                where: { agency_uuid: agencyUuid, next_follow_up_at: { [Op.gte]: since }, status: { [Op.notIn]: ["converted", "lost", "junk"] }, ...(owner ? {} : { assigned_to: agentId }) },
                attributes: ["uuid", "name", "phone_number", "country_code", "next_follow_up_at", "follow_up_note"], limit: 500, raw: true,
            });
            const bookings: any[] = (await hasModule(agencyUuid, "bookings")) ? await Booking.findAll({
                where: { agency_uuid: agencyUuid, status: { [Op.ne]: "cancelled" }, start_date: { [Op.gte]: since.toISOString().slice(0, 10) }, ...(owner ? {} : { [Op.or]: [{ created_by: agentId }, { ops_owner_id: agentId }] }) },
                attributes: ["uuid", "booking_no", "title", "start_date", "end_date", "destination"], limit: 500, raw: true,
            }) : [];
            const stamp = icsDate(new Date());
            const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TechX CRM//Travel//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${ics(`TechX CRM - ${me.username}`)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
            for (const l of leads) {
                const start = new Date(l.next_follow_up_at);
                lines.push("BEGIN:VEVENT", `UID:fu-${l.uuid}@techxcrm`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(new Date(start.getTime() + 15 * 60000))}`,
                    `SUMMARY:${ics(`Follow up: ${l.name || "lead"}`)}`, `DESCRIPTION:${ics([`${l.country_code || ""} ${l.phone_number || ""}`.trim(), l.follow_up_note].filter(Boolean).join("\n"))}`, "END:VEVENT");
            }
            for (const b of bookings) {
                if (!b.start_date) continue;
                const end = b.end_date && b.end_date >= b.start_date ? new Date(Date.parse(b.end_date) + 864e5).toISOString().slice(0, 10) : new Date(Date.parse(b.start_date) + 864e5).toISOString().slice(0, 10);
                lines.push("BEGIN:VEVENT", `UID:bk-${b.uuid}@techxcrm`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDay(b.start_date)}`, `DTEND;VALUE=DATE:${icsDay(end)}`,
                    `SUMMARY:${ics(`✈ ${b.booking_no} ${b.title}`)}`, `LOCATION:${ics(b.destination || "")}`, "END:VEVENT");
            }
            lines.push("END:VCALENDAR");
            res.setHeader("Content-Type", "text/calendar; charset=utf-8");
            res.setHeader("Cache-Control", "private, max-age=600");
            return res.status(200).send(lines.join("\r\n"));
        } catch (error) {
            console.error("calendarFeed", error);
            return res.status(500).send("Calendar unavailable");
        }
    }

    // ------------------------------------------------------------ client profile (CP-01)

    async clientProfile(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const client: any = await User.findOne({ where: { id: Number(req.params.id), agency_uuid: a.agencyUuid }, attributes: ["id", "username", "email", "phone_number", "country_code", "travel_prefs", "createdAt"] });
            if (!client) return no(res, "Client not found");
            const [members, bookings] = await Promise.all([
                ClientMember.findAll({ where: { agency_uuid: a.agencyUuid, user_id: client.dataValues.id }, order: [["name", "ASC"]] }),
                Booking.findAll({ where: { agency_uuid: a.agencyUuid, user_id: client.dataValues.id }, attributes: ["uuid", "booking_no", "title", "destination", "start_date", "end_date", "status", "total_sell"], order: [["start_date", "DESC"]] }),
            ]);
            let prefs: any = client.dataValues.travel_prefs;
            if (typeof prefs === "string") { try { prefs = JSON.parse(prefs); } catch { prefs = {}; } }
            return ok(res, "Client", {
                client: { id: client.dataValues.id, name: client.dataValues.username, email: client.dataValues.email, phone: `${client.dataValues.country_code || ""} ${client.dataValues.phone_number || ""}`.trim(), client_since: client.dataValues.createdAt },
                prefs: prefs || {},
                members: members.map((m: any) => presentMember(m.toJSON())),
                trips: bookings.map((b: any) => ({ id: b.dataValues.uuid, booking_no: b.dataValues.booking_no, title: b.dataValues.title, destination: b.dataValues.destination, start_date: b.dataValues.start_date, end_date: b.dataValues.end_date, status: b.dataValues.status, value: toRupees(b.dataValues.total_sell) })),
            });
        } catch (error) { return fail(res, error, "clientProfile"); }
    }

    async saveClientPrefs(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const client: any = await User.findOne({ where: { id: Number(req.params.id), agency_uuid: a.agencyUuid }, attributes: ["id"] });
            if (!client) return no(res, "Client not found");
            const b = req.body || {};
            const prefs = {
                meal: str(b.meal, 60), seat: str(b.seat, 60), hotel: str(b.hotel, 60), room: str(b.room, 60), interests: str(b.interests, 300),
                notes: str(b.notes, 1000), birthday: date(b.birthday), anniversary: date(b.anniversary),
            };
            await User.update({ travel_prefs: prefs }, { where: { id: client.dataValues.id } });
            return ok(res, "Preferences saved", prefs);
        } catch (error) { return fail(res, error, "saveClientPrefs"); }
    }

    private memberValues(b: any) {
        const v: any = {};
        if (b.name !== undefined) { v.name = str(b.name); if (!v.name) throw Object.assign(new Error("Please enter the name as on the passport"), { expose: true }); }
        for (const k of ["relation", "nationality", "meal_pref", "seat_pref"]) if (b[k] !== undefined) v[k] = str(b[k], 60);
        if (b.pax_type !== undefined) v.pax_type = ["adult", "child", "infant"].includes(b.pax_type) ? b.pax_type : "adult";
        for (const k of ["dob", "anniversary", "passport_expiry"]) if (b[k] !== undefined) v[k] = date(b[k]);
        if (b.passport_no) {
            const p = String(b.passport_no).replace(/\s/g, "").toUpperCase().slice(0, 20);
            if (!/^[A-Z0-9]{6,20}$/.test(p)) throw Object.assign(new Error("Passport number looks wrong"), { expose: true });
            v.passport_no_enc = encryptPii(p); v.passport_last4 = p.slice(-4);
        }
        if (b.pan) {
            const pan = String(b.pan).replace(/\s/g, "").toUpperCase();
            if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) throw Object.assign(new Error("PAN should look like ABCDE1234F"), { expose: true });
            v.pan_enc = encryptPii(pan);
        }
        return v;
    }

    async addMember(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const client: any = await User.findOne({ where: { id: Number(req.params.id), agency_uuid: a.agencyUuid }, attributes: ["id"] });
            if (!client) return no(res, "Client not found");
            const v = this.memberValues({ pax_type: "adult", ...req.body });
            if (!v.name) return no(res, "Please enter the name as on the passport");
            await ClientMember.create({ ...v, agency_uuid: a.agencyUuid, user_id: client.dataValues.id });
            return ok(res, "Family member added");
        } catch (error) { return fail(res, error, "addMember"); }
    }

    async updateMember(req: RequestWithUser, res: Response) {
        try {
            const m: any = await ClientMember.findOne({ where: { agency_uuid: accessOf(req).agencyUuid, uuid: req.params.uuid } });
            if (!m) return no(res, "Not found");
            await m.update(this.memberValues(req.body || {}));
            return ok(res, "Saved");
        } catch (error) { return fail(res, error, "updateMember"); }
    }

    async deleteMember(req: RequestWithUser, res: Response) {
        try {
            const n = await ClientMember.destroy({ where: { agency_uuid: accessOf(req).agencyUuid, uuid: req.params.uuid } });
            return n ? ok(res, "Removed") : no(res, "Not found");
        } catch (error) { return fail(res, error, "deleteMember"); }
    }

    /** POST /travel/bookings/:uuid/travellers/from_member { member_id } - copy a family member onto a booking (IDs stay encrypted). */
    async travellerFromMember(req: RequestWithUser, res: Response) {
        try {
            const booking = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const m: any = await ClientMember.findOne({ where: { agency_uuid: booking.dataValues.agency_uuid, uuid: req.body?.member_id, user_id: booking.dataValues.user_id } });
            if (!m) return no(res, "Family member not found");
            const x = m.toJSON();
            await BookingTraveller.create({
                agency_uuid: x.agency_uuid, booking_id: booking.dataValues.id, name: x.name, pax_type: x.pax_type, dob: x.dob, nationality: x.nationality,
                passport_no_enc: x.passport_no_enc, passport_last4: x.passport_last4, passport_expiry: x.passport_expiry, pan_enc: x.pan_enc, meal_pref: x.meal_pref, seat_pref: x.seat_pref,
            });
            return ok(res, `${x.name} added to the booking`);
        } catch (error) { return fail(res, error, "travellerFromMember"); }
    }

    /** POST /travel/bookings/travellers/:uuid/save_to_profile - keep a traveller in the client's family list for next time. */
    async travellerToMember(req: RequestWithUser, res: Response) {
        try {
            const t: any = await BookingTraveller.findOne({ where: { agency_uuid: accessOf(req).agencyUuid, uuid: req.params.uuid } });
            if (!t) return no(res, "Traveller not found");
            const booking = await Booking.findByPk(t.dataValues.booking_id) as any;
            if (!booking || !(await scopedBooking(req, booking.dataValues.uuid))) return no(res, "Traveller not found");
            const x = t.toJSON();
            const existing: any = await ClientMember.findOne({ where: { agency_uuid: x.agency_uuid, user_id: booking.dataValues.user_id, name: x.name } });
            const values = { name: x.name, pax_type: x.pax_type, dob: x.dob, nationality: x.nationality, passport_no_enc: x.passport_no_enc, passport_last4: x.passport_last4, passport_expiry: x.passport_expiry, pan_enc: x.pan_enc, meal_pref: x.meal_pref, seat_pref: x.seat_pref };
            if (existing) await existing.update(values); else await ClientMember.create({ ...values, agency_uuid: x.agency_uuid, user_id: booking.dataValues.user_id });
            return ok(res, "Saved to the client's profile");
        } catch (error) { return fail(res, error, "travellerToMember"); }
    }

    // ------------------------------------------------------------ booking documents and trip kit (VC-02)

    async listDocuments(req: RequestWithUser, res: Response) {
        try {
            const booking = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const docs = await BookingDocument.findAll({ where: { booking_id: booking.dataValues.id }, order: [["createdAt", "DESC"]] });
            return ok(res, "Documents", docs.map((d: any) => ({ id: d.dataValues.uuid, kind: d.dataValues.kind, name: d.dataValues.name, size: d.dataValues.size, share_with_client: Boolean(d.dataValues.share_with_client), url: signedFileUrl("travel_docs", d.dataValues.file_ref), createdAt: d.dataValues.createdAt })));
        } catch (error) { return fail(res, error, "listDocuments"); }
    }

    async uploadDocuments(req: RequestWithUser, res: Response) {
        try {
            const booking = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const files = ((req as any).files || []) as Express.Multer.File[];
            if (!files.length) return no(res, "Choose a PDF or image (up to 15 MB)");
            const kind = ["ticket", "visa", "insurance", "voucher", "passport", "other"].includes(req.body?.kind) ? req.body.kind : "other";
            for (const f of files) {
                const original = path.basename(f.originalname).replace(/[^\w.\- ()]+/g, "_").slice(-120) || "file";
                const ref = await saveFile({ owner: agencyOwner(booking.dataValues.agency_uuid), folder: "travel_docs", name: `${crypto.randomUUID()}${path.extname(original).toLowerCase()}`, body: f.buffer, contentType: f.mimetype });
                await BookingDocument.create({ agency_uuid: booking.dataValues.agency_uuid, booking_id: booking.dataValues.id, kind, name: original, file_ref: ref, size: f.size, share_with_client: kind !== "passport", uploaded_by: accessOf(req).userId });
            }
            return ok(res, files.length > 1 ? `${files.length} files uploaded` : "File uploaded");
        } catch (error) { return fail(res, error, "uploadDocuments"); }
    }

    async deleteDocument(req: RequestWithUser, res: Response) {
        try {
            const d: any = await BookingDocument.findOne({ where: { agency_uuid: accessOf(req).agencyUuid, uuid: req.params.uuid } });
            if (!d) return no(res, "Not found");
            const booking: any = await Booking.findByPk(d.dataValues.booking_id);
            if (!booking || !(await scopedBooking(req, booking.dataValues.uuid))) return no(res, "Not found");
            await deleteFile("travel_docs", d.dataValues.file_ref);
            await d.destroy({ force: true });
            return ok(res, "Removed");
        } catch (error) { return fail(res, error, "deleteDocument"); }
    }

    /** POST /travel/bookings/:uuid/kit { email?: boolean } - public trip kit link; optionally email it to the client. */
    async tripKit(req: RequestWithUser, res: Response) {
        try {
            const booking = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const token = booking.dataValues.share_token || crypto.randomBytes(18).toString("hex");
            if (!booking.dataValues.share_token) await booking.update({ share_token: token });
            const url = `${publicApiBase(req)}/v1/public/travel/kit/${token}`;
            if (req.body?.email) {
                const client: any = await User.findByPk(booking.dataValues.user_id, { attributes: ["username", "email"] });
                if (!client?.dataValues.email) return no(res, "Add the client's email address first");
                if (!mailEnabled()) return no(res, "Email is not set up on this server");
                const brand = await agencyBrand(booking.dataValues.agency_uuid);
                const sent = await sendMail(client.dataValues.email, `Your trip documents: ${booking.dataValues.title} (${booking.dataValues.booking_no})`,
                    `Hi ${String(client.dataValues.username || "").split(" ")[0]},\n\nYour trip ${booking.dataValues.title} is confirmed. Your day plan, confirmation numbers, vouchers and tickets are on one page - open it any time before and during the trip.\n\nHave a wonderful trip!`,
                    { label: "Open my trip kit", url }, brand);
                if (!sent) return no(res, "The email could not be sent. Please try again.");
                audit(req, { entity: "booking", entityId: booking.dataValues.id, branchId: booking.dataValues.branch_id, action: "kit_email", summary: `Trip kit emailed for ${booking.dataValues.booking_no}` });
                return ok(res, `Trip kit emailed to ${client.dataValues.email}`, { url });
            }
            return ok(res, "Trip kit link ready", { url });
        } catch (error) { return fail(res, error, "tripKit"); }
    }

    // ------------------------------------------------------------ credit notes and refunds (PY-03, PY-07)

    /** POST /travel/bookings/:uuid/credit_note { amount, reason } - lowers the booking's invoice by `amount` (incl. GST). */
    async createCreditNote(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!(a.isOwner || a.teamRole === "accounts")) return no(res, "Only the owner or Accounts can issue credit notes");
            const booking = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            if (!booking.dataValues.invoice_id) return no(res, "Raise the invoice first - a credit note always refers to an invoice");
            const amount = toPaise(req.body?.amount);
            const reason = str(req.body?.reason, 500);
            if (!(amount > 0)) return no(res, "Enter the amount to credit");
            if (!reason) return no(res, "Enter the reason, e.g. hotel cancelled");
            const note: any = await sequelize.transaction((t: any) => issueCreditNote(t, { agencyUuid: a.agencyUuid, booking, amount, reason, userId: a.userId }));
            audit(req, { entity: "invoice", entityId: booking.dataValues.invoice_id, branchId: booking.dataValues.branch_id, action: "credit_note", summary: `Credit note ${note.dataValues.number}: Rs ${toRupees(amount)} on ${booking.dataValues.booking_no} (${reason})${note.dataValues.refund_due ? ` - refund due Rs ${toRupees(note.dataValues.refund_due)}` : ""}` });
            return ok(res, `Credit note ${note.dataValues.number} issued${note.dataValues.refund_due ? ` - refund Rs ${toRupees(note.dataValues.refund_due)} to the client` : ""}`);
        } catch (error) { return fail(res, error, "createCreditNote"); }
    }

    async listCreditNotes(req: RequestWithUser, res: Response) {
        try {
            const booking = await scopedBooking(req, req.params.uuid);
            if (!booking) return no(res, "Booking not found");
            const rows = await CreditNote.findAll({ where: { booking_id: booking.dataValues.id }, order: [["createdAt", "DESC"]] });
            return ok(res, "Credit notes", rows.map((r: any) => ({ id: r.dataValues.uuid, number: r.dataValues.number, amount: toRupees(r.dataValues.amount), gst: toRupees(r.dataValues.gst_amount), reason: r.dataValues.reason, refund_due: toRupees(r.dataValues.refund_due), refunded: toRupees(r.dataValues.refunded), refund_reference: r.dataValues.refund_reference, issue_date: r.dataValues.issue_date })));
        } catch (error) { return fail(res, error, "listCreditNotes"); }
    }

    /** POST /travel/credit_notes/:uuid/refund { amount, reference } - money paid back to the client. */
    async recordRefund(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!(a.isOwner || a.teamRole === "accounts")) return no(res, "Only the owner or Accounts can record refunds");
            const note: any = await CreditNote.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
            if (!note) return no(res, "Credit note not found");
            const amount = toPaise(req.body?.amount);
            const left = Number(note.dataValues.refund_due) - Number(note.dataValues.refunded);
            if (!(amount > 0) || amount > left) return no(res, `Up to Rs ${toRupees(left)} can be refunded on this credit note`);
            await sequelize.transaction(async (t: any) => {
                await note.update({ refunded: Number(note.dataValues.refunded) + amount, refund_reference: str(req.body?.reference, 120) }, { transaction: t });
                const inv: any = await ClientInvoice.findByPk(note.dataValues.invoice_id, { transaction: t, lock: t.LOCK.UPDATE });
                const n = await ClientPayment.count({ where: { agency_uuid: a.agencyUuid }, paranoid: false, transaction: t });
                // refund = negative receipt so "received" stays true
                await ClientPayment.create({ agency_uuid: a.agencyUuid, invoice_id: inv.dataValues.id, receipt_number: `RCPT-${String(n + 1).padStart(4, "0")}`, amount: -amount, method: "bank_transfer", reference: str(req.body?.reference, 120), note: `Refund against ${note.dataValues.number}`, paid_at: new Date(), received_by: a.userId }, { transaction: t });
                await inv.update({ amount_paid: Number(inv.dataValues.amount_paid) - amount }, { transaction: t });
            });
            audit(req, { entity: "invoice", entityId: note.dataValues.invoice_id, action: "refund", summary: `Refund Rs ${toRupees(amount)} against ${note.dataValues.number}` });
            return ok(res, "Refund recorded");
        } catch (error) { return fail(res, error, "recordRefund"); }
    }

    // ------------------------------------------------------------ reports (RP-02, RP-03, RP-04) and targets

    private async reportData(req: RequestWithUser) {
        const a = accessOf(req);
        const from = date(req.query.from) || `${today().slice(0, 7)}-01`;
        const to = date(req.query.to) || today();
        const where: any = { agency_uuid: a.agencyUuid, status: { [Op.ne]: "cancelled" }, createdAt: { [Op.between]: [new Date(`${from}T00:00:00+05:30`), new Date(`${to}T23:59:59+05:30`)] } };
        if (!(a.isOwner || a.teamRole === "accounts" || a.seesAll) && a.branchId) where.branch_id = a.branchId;
        const bookings: any[] = await Booking.findAll({ where, raw: true, order: [["createdAt", "ASC"]] });
        const leadIds = bookings.map((b) => b.crm_lead_id).filter(Boolean);
        const [leads, people, clients, enquiries] = await Promise.all([
            CrmLead.findAll({ where: { id: leadIds.concat([-1]) }, attributes: ["id", "source", "assigned_to", "name"], raw: true }),
            Agent.findAll({ where: { [Op.or]: [{ uuid: a.agencyUuid, role: "agent" }, { parent_uuid: a.agencyUuid }] }, attributes: ["id", "username"], raw: true }),
            User.findAll({ where: { id: bookings.map((b) => b.user_id).concat([-1]) }, attributes: ["id", "username"], raw: true }),
            CrmLead.findAll({ where: { agency_uuid: a.agencyUuid, business_line: "travel", createdAt: where.createdAt }, attributes: ["id", "source", "status", "assigned_to"], raw: true }),
        ]);
        const leadBy = new Map(leads.map((l: any) => [l.id, l]));
        const nameOf = new Map(people.map((p: any) => [p.id, p.username]));
        const clientOf = new Map(clients.map((c: any) => [c.id, c.username]));
        const rows = bookings.map((b) => {
            const lead: any = leadBy.get(b.crm_lead_id) || {};
            const agentId = lead.assigned_to || b.created_by;
            return {
                booking_no: b.booking_no, created: String(b.createdAt).slice(0, 10), month: new Date(b.createdAt).toISOString().slice(0, 7), client: clientOf.get(b.user_id) || "",
                title: b.title, destination: b.destination || "Not set", source: lead.source || "manual", agent_id: agentId, agent: nameOf.get(agentId) || "Unassigned",
                start_date: b.start_date, sell: Number(b.total_sell) - Number(b.credited || 0), cost: Number(b.total_cost), tax: Number(b.tax_total), profit: Number(b.total_sell) - Number(b.credited || 0) - Number(b.total_cost), international: Boolean(b.is_international),
            };
        });
        const group = (key: "agent" | "destination" | "source" | "month") => {
            const m = new Map<string, { name: string; bookings: number; sell: number; profit: number; agent_id?: number }>();
            for (const r of rows) {
                const k = String(r[key]);
                const g = m.get(k) || { name: k, bookings: 0, sell: 0, profit: 0, ...(key === "agent" ? { agent_id: r.agent_id } : {}) };
                g.bookings += 1; g.sell += r.sell; g.profit += r.profit; m.set(k, g);
            }
            return [...m.values()].sort((x, y) => y.sell - x.sell);
        };
        return { from, to, rows, group, enquiries, people, nameOf };
    }

    async reports(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const d = await this.reportData(req);
            const cost = seesCost(req);
            const money = (g: any) => ({ ...g, sell: toRupees(g.sell), ...(cost ? { profit: toRupees(g.profit) } : { profit: undefined }) });
            const month = d.from.slice(0, 7);
            const targets: any[] = await TravelTarget.findAll({ where: { agency_uuid: a.agencyUuid, month }, raw: true });
            const byAgent = d.group("agent");
            const dues: any[] = await BookingService.findAll({
                where: { agency_uuid: a.agencyUuid, supplier_id: { [Op.ne]: null } },
                include: [{ model: TravelSupplier, as: "supplier", attributes: ["name"], required: false }, { model: Booking, as: "booking", attributes: ["booking_no", "status"], required: false }],
            });
            const supplierDues = new Map<string, { name: string; due: number; overdue: number; services: number }>();
            for (const s of dues) {
                const x = s.toJSON() as any;
                if (x.booking?.status === "cancelled" && x.status !== "cancelled") continue;
                const due = supplierOwed(x);
                if (!due) continue;
                const k = x.supplier?.name || "Supplier";
                const g = supplierDues.get(k) || { name: k, due: 0, overdue: 0, services: 0 };
                g.due += due; g.services += 1; if (x.supplier_due_date && x.supplier_due_date < today()) g.overdue += due; supplierDues.set(k, g);
            }
            const converted = d.enquiries.filter((e: any) => e.status === "converted").length;
            // package-wise sales: bookings quoted from a fixed package
            const pkgBookings: any[] = await Booking.findAll({ where: { agency_uuid: a.agencyUuid, status: { [Op.ne]: "cancelled" }, package_id: { [Op.ne]: null }, createdAt: { [Op.between]: [new Date(`${d.from}T00:00:00+05:30`), new Date(`${d.to}T23:59:59+05:30`)] } }, attributes: ["package_id", "total_sell", "total_cost", "credited"], raw: true });
            const pkgs: any[] = await TourPackage.findAll({ where: { id: [...new Set(pkgBookings.map((b) => b.package_id))].concat([-1]) }, attributes: ["id", "title"], raw: true });
            const byPackage = pkgs.map((p) => { const rows = pkgBookings.filter((b) => b.package_id === p.id); return { name: p.title, bookings: rows.length, sell: toRupees(rows.reduce((s, r) => s + Number(r.total_sell), 0)), ...(cost ? { profit: toRupees(rows.reduce((s, r) => s + Number(r.total_sell) - Number(r.credited || 0) - Number(r.total_cost), 0)) } : {}) }; }).sort((x, y) => y.sell - x.sell);
            // payment links: links created on invoices and online payments received in the period
            const onlinePays: any[] = await ClientPayment.findAll({ where: { agency_uuid: a.agencyUuid, method: ["razorpay", "cashfree"], paid_at: { [Op.between]: [new Date(`${d.from}T00:00:00+05:30`), new Date(`${d.to}T23:59:59+05:30`)] } }, attributes: ["invoice_id", "amount", "method", "paid_at", "reference"], raw: true });
            const openLinks: any[] = await ClientInvoice.findAll({ where: { agency_uuid: a.agencyUuid, payment_link_url: { [Op.ne]: null }, status: { [Op.in]: ["unpaid", "partial"] } }, attributes: ["uuid", "number", "total", "amount_paid", "payment_link_url", "student_id"], raw: true });
            const linkClients: any[] = await User.findAll({ where: { id: openLinks.map((l) => l.student_id).concat([-1]) }, attributes: ["id", "username"], raw: true });
            const invNos: any[] = await ClientInvoice.findAll({ where: { id: onlinePays.map((p) => p.invoice_id).concat([-1]) }, attributes: ["id", "number"], raw: true });
            const paymentLinks = {
                paid_count: onlinePays.length, paid_total: toRupees(onlinePays.reduce((s, p) => s + Number(p.amount), 0)),
                by_gateway: ["razorpay", "cashfree"].map((g) => ({ gateway: g, count: onlinePays.filter((p) => p.method === g).length, total: toRupees(onlinePays.filter((p) => p.method === g).reduce((s, p) => s + Number(p.amount), 0)) })),
                paid: onlinePays.slice(0, 50).map((p) => ({ invoice: invNos.find((i) => i.id === p.invoice_id)?.number || "", amount: toRupees(p.amount), gateway: p.method, paid_at: p.paid_at, reference: p.reference })),
                open: openLinks.slice(0, 50).map((l) => ({ id: l.uuid, invoice: l.number, client: linkClients.find((c) => c.id === l.student_id)?.username || "", balance: toRupees(Number(l.total) - Number(l.amount_paid)), url: l.payment_link_url })),
            };
            return ok(res, "Travel reports", {
                from: d.from, to: d.to,
                totals: { bookings: d.rows.length, sell: toRupees(d.rows.reduce((s, r) => s + r.sell, 0)), ...(cost ? { profit: toRupees(d.rows.reduce((s, r) => s + r.profit, 0)) } : {}), enquiries: d.enquiries.length, conversion: d.enquiries.length ? Math.round(converted * 1000 / d.enquiries.length) / 10 : 0 },
                by_agent: byAgent.map((g) => ({ ...money(g), target: toRupees(targets.find((t) => t.agent_id === g.agent_id)?.amount || 0) })),
                targets: targets.map((t) => ({ agent_id: t.agent_id, agent: d.nameOf.get(t.agent_id) || "", amount: toRupees(t.amount), achieved: toRupees(byAgent.find((g) => g.agent_id === t.agent_id)?.sell || 0) })),
                by_destination: d.group("destination").map(money),
                by_source: d.group("source").map(money),
                by_month: d.group("month").sort((x, y) => x.name.localeCompare(y.name)).map(money),
                bookings: cost ? d.rows.map((r) => ({ ...r, sell: toRupees(r.sell), cost: toRupees(r.cost), tax: toRupees(r.tax), profit: toRupees(r.profit) })) : d.rows.map((r) => ({ booking_no: r.booking_no, created: r.created, client: r.client, title: r.title, destination: r.destination, agent: r.agent, sell: toRupees(r.sell) })),
                supplier_dues: cost ? [...supplierDues.values()].sort((x, y) => y.due - x.due).map((g) => ({ ...g, due: toRupees(g.due), overdue: toRupees(g.overdue) })) : [],
                team: d.people.map((p: any) => ({ id: p.id, name: p.username })),
                by_package: byPackage,
                payment_links: paymentLinks,
                month,
            });
        } catch (error) { return fail(res, error, "reports"); }
    }

    /** GET /travel/reports/export?type=sales|profit|supplier_dues|tcs&from&to - Excel file. */
    async exportReport(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const type = String(req.query.type || "sales");
            const cost = seesCost(req);
            if (["profit", "supplier_dues", "tcs"].includes(type) && !cost) return no(res, "Your role can not export money reports");
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet(type);
            const d = await this.reportData(req);
            if (type === "sales" || type === "profit") {
                ws.columns = [
                    { header: "Booking", key: "booking_no", width: 12 }, { header: "Booked on", key: "created", width: 12 }, { header: "Client", key: "client", width: 24 },
                    { header: "Trip", key: "title", width: 28 }, { header: "Destination", key: "destination", width: 18 }, { header: "Agent", key: "agent", width: 18 },
                    { header: "Source", key: "source", width: 12 }, { header: "Travel date", key: "start_date", width: 12 }, { header: "Selling (Rs)", key: "sell", width: 14 },
                    ...(type === "profit" ? [{ header: "Supplier cost (Rs)", key: "cost", width: 16 }, { header: "GST + TCS (Rs)", key: "tax", width: 14 }, { header: "Profit (Rs)", key: "profit", width: 14 }] : []),
                ];
                for (const r of d.rows) ws.addRow({ ...r, sell: toRupees(r.sell), cost: toRupees(r.cost), tax: toRupees(r.tax), profit: toRupees(r.profit) });
            } else if (type === "supplier_dues") {
                ws.columns = [{ header: "Supplier", key: "supplier", width: 24 }, { header: "Booking", key: "booking", width: 12 }, { header: "Service", key: "service", width: 32 }, { header: "Date", key: "date", width: 12 }, { header: "Cost (Rs)", key: "cost", width: 12 }, { header: "Paid (Rs)", key: "paid", width: 12 }, { header: "Due (Rs)", key: "due", width: 12 }, { header: "Pay by", key: "pay_by", width: 12 }];
                const rows = await BookingService.findAll({ where: { agency_uuid: a.agencyUuid, supplier_id: { [Op.ne]: null } }, include: [{ model: TravelSupplier, as: "supplier", attributes: ["name"], required: false }, { model: Booking, as: "booking", attributes: ["booking_no", "status"], required: false }], order: [["supplier_due_date", "ASC"]] });
                for (const s of rows) {
                    const x = s.toJSON() as any;
                    if (x.booking?.status === "cancelled" && x.status !== "cancelled") continue;
                    const due = supplierOwed(x);
                    if (due) ws.addRow({ supplier: x.supplier?.name, booking: x.booking?.booking_no, service: `${x.description}${x.status === "cancelled" ? " (cancellation charge)" : ""}`, date: x.service_date, cost: toRupees(x.status === "cancelled" ? x.cancel_charge : x.cost), paid: toRupees(Number(x.supplier_paid) - Number(x.supplier_refunded || 0)), due: toRupees(due), pay_by: x.supplier_due_date });
                }
            } else if (type === "tcs") {
                // TCS collected on overseas packages, by invoice date - for the CA's quarterly TCS return
                ws.columns = [{ header: "Invoice", key: "number", width: 14 }, { header: "Invoice date", key: "date", width: 12 }, { header: "Client", key: "client", width: 24 }, { header: "PAN", key: "pan", width: 12 }, { header: "Booking", key: "booking", width: 12 }, { header: "Amount received basis (Rs)", key: "total", width: 18 }, { header: "TCS %", key: "rate", width: 8 }, { header: "TCS (Rs)", key: "tcs", width: 12 }];
                const invs: any[] = await ClientInvoice.findAll({ where: { agency_uuid: a.agencyUuid, tcs_amount: { [Op.gt]: 0 }, issue_date: { [Op.between]: [d.from, d.to] } }, order: [["issue_date", "ASC"]], raw: true });
                for (const inv of invs) {
                    const [client, booking]: any[] = await Promise.all([User.findByPk(inv.student_id, { attributes: ["username"], raw: true }), inv.booking_id ? Booking.findByPk(inv.booking_id, { attributes: ["id", "booking_no"], raw: true }) : null]);
                    const lead: any = booking ? await BookingTraveller.findOne({ where: { booking_id: booking.id, is_lead: true }, attributes: ["pan_enc"], raw: true }) : null;
                    ws.addRow({ number: inv.number, date: inv.issue_date, client: client?.username, pan: decryptPii(lead?.pan_enc) || "", booking: booking?.booking_no, total: toRupees(Number(inv.total) - Number(inv.tcs_amount)), rate: Number(inv.tcs_percent), tcs: toRupees(inv.tcs_amount) });
                }
                audit(req, { entity: "settings", action: "pii_export", summary: `TCS report exported ${d.from} to ${d.to} (includes PAN)` });
            } else return no(res, "Unknown report");
            ws.getRow(1).font = { bold: true };
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="travel-${type}-${d.from}-to-${d.to}.xlsx"`);
            await wb.xlsx.write(res);
            return res.end();
        } catch (error) { return fail(res, error, "exportReport"); }
    }

    /** POST /travel/targets { month: YYYY-MM, targets: [{ agent_id, amount }] } (owner / managers) */
    async saveTargets(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!a.isManager) return no(res, "Only the owner or a manager can set targets");
            const month = /^\d{4}-\d{2}$/.test(String(req.body?.month || "")) ? String(req.body.month) : null;
            if (!month) return no(res, "Choose a month");
            const people: any[] = await Agent.findAll({ where: { [Op.or]: [{ uuid: a.agencyUuid, role: "agent" }, { parent_uuid: a.agencyUuid }] }, attributes: ["id"], raw: true });
            const ids = new Set(people.map((p) => p.id));
            for (const t of (Array.isArray(req.body?.targets) ? req.body.targets : []).slice(0, 200)) {
                const agentId = Number(t?.agent_id);
                if (!ids.has(agentId)) continue;
                const amount = Math.max(0, toPaise(t?.amount));
                const existing: any = await TravelTarget.findOne({ where: { agency_uuid: a.agencyUuid, agent_id: agentId, month } });
                if (existing) await existing.update({ amount }); else await TravelTarget.create({ agency_uuid: a.agencyUuid, agent_id: agentId, month, amount });
            }
            return ok(res, "Targets saved");
        } catch (error) { return fail(res, error, "saveTargets"); }
    }

    // ------------------------------------------------------------ DPDP: erase a client's personal data on request

    /** POST /travel/clients/:id/erase { confirm: "ERASE", reason } - owner only. Invoices stay (GST law); IDs, documents and contact details go. */
    async eraseClient(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!a.isOwner) return no(res, "Only the agency owner can erase a client's data");
            if (req.body?.confirm !== "ERASE") return no(res, "Type ERASE to confirm");
            const client: any = await User.findOne({ where: { id: Number(req.params.id), agency_uuid: a.agencyUuid } });
            if (!client) return no(res, "Client not found");
            const bookings: any[] = await Booking.findAll({ where: { agency_uuid: a.agencyUuid, user_id: client.dataValues.id }, attributes: ["id"], raw: true });
            const bookingIds = bookings.map((b) => b.id).concat([-1]);
            const docs: any[] = await BookingDocument.findAll({ where: { booking_id: bookingIds }, raw: true });
            for (const d of docs) await deleteFile("travel_docs", d.file_ref);
            await sequelize.transaction(async (t: any) => {
                await BookingDocument.destroy({ where: { booking_id: bookingIds }, force: true, transaction: t });
                await BookingTraveller.update({ passport_no_enc: null, passport_last4: null, passport_expiry: null, pan_enc: null, dob: null }, { where: { booking_id: bookingIds }, transaction: t });
                await ClientMember.destroy({ where: { agency_uuid: a.agencyUuid, user_id: client.dataValues.id }, force: true, transaction: t });
                await User.update({ email: null, travel_prefs: null, profile_image: null }, { where: { id: client.dataValues.id }, transaction: t });
            });
            audit(req, { entity: "traveller", entityId: client.dataValues.id, action: "erased", summary: `Personal data erased for client #${client.dataValues.id} on request${req.body?.reason ? ` (${String(req.body.reason).slice(0, 200)})` : ""}` });
            return ok(res, "Passports, PAN, documents and family details erased. Invoices are kept as GST law requires.");
        } catch (error) { return fail(res, error, "eraseClient"); }
    }
}

// ---------------------------------------------------------------- public trip kit page

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const fmt = (d?: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const LABEL: Record<string, string> = { flight: "Flight", hotel: "Hotel", transfer: "Transfer", activity: "Activity", visa: "Visa", insurance: "Insurance", forex: "Forex", other: "Service" };

const kitBooking = async (token: string) => {
    if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
    const b: any = await Booking.findOne({ where: { share_token: token, status: { [Op.ne]: "cancelled" } } });
    if (!b || !(await hasModule(b.dataValues.agency_uuid, "bookings"))) return null;
    return b;
};

const ICON: Record<string, string> = { hotel: "🏨", sightseeing: "📍", transfer: "🚐", meal: "🍽️", flight: "✈️", activity: "🎟️", note: "•", visa: "🛂", insurance: "🛡️", forex: "💱", other: "•" };
const inr = (paise: number) => `₹${(Math.round(Number(paise || 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const telHref = (p: string) => `tel:${String(p || "").replace(/[^\d+]/g, "")}`;
const waNumber = (p: string) => String(p || "").replace(/\D/g, "");
const dayDate = (start: string | null, i: number) => (start ? new Date(Date.parse(`${start}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10) : null);

/** Next amount the client has to pay: first instalment not yet covered, else the invoice balance. */
const nextDue = (inv: any) => {
    if (!inv) return null;
    const paid = Number(inv.amount_paid || 0), total = Number(inv.total || 0);
    if (paid >= total) return null;
    const inst = Array.isArray(inv.installments) ? inv.installments : [];
    let run = 0;
    for (const i of inst) {
        run += Number(i.amount || 0);
        if (run > paid) return { amount: Math.min(Number(i.amount || 0), run - paid), date: i.due_date || null, label: i.label || null };
    }
    return { amount: total - paid, date: inv.due_date || null, label: null };
};

/** GET /public/travel/kit/:token - the client's one link for the trip: plan, bookings, documents, payment and contacts (VC-02, VC-03). */
export const publicTripKit = async (req: Request, res: Response) => {
    try {
        const b = await kitBooking(String(req.params.token || ""));
        if (!b) return res.status(404).send("This link is not available. Please ask your travel consultant for a new one.");
        const x = b.toJSON();
        const [services, docs, itinerary, agency, pax, inv, ops, settings]: any[] = await Promise.all([
            BookingService.findAll({ where: { booking_id: x.id, status: { [Op.ne]: "cancelled" } }, include: [{ model: TravelSupplier, as: "supplier", attributes: ["name", "phone", "city", "type"], required: false }], order: [["service_date", "ASC"], ["id", "ASC"]] }),
            BookingDocument.findAll({ where: { booking_id: x.id, share_with_client: true }, order: [["kind", "ASC"], ["id", "ASC"]] }),
            x.itinerary_id ? Itinerary.findByPk(x.itinerary_id, { attributes: ["days", "inclusions", "exclusions", "cover_image", "share_token"] }) : null,
            Agent.findOne({ where: { uuid: x.agency_uuid, role: "agent" }, attributes: ["app_name", "username", "primary_color", "support_number", "support_email", "favicon_url", "billing_settings"], raw: true }),
            BookingTraveller.findAll({ where: { booking_id: x.id }, attributes: ["name", "pax_type", "is_lead"], order: [["is_lead", "DESC"], ["id", "ASC"]], raw: true }),
            x.invoice_id ? ClientInvoice.findByPk(x.invoice_id, { attributes: ["number", "total", "amount_paid", "installments", "due_date", "payment_link_url", "status"] }) : null,
            x.ops_owner_id ? Agent.findOne({ where: { id: x.ops_owner_id }, attributes: ["username", "country_code", "phone_number"], raw: true }) : null,
            travelSettingsFor(x.agency_uuid),
        ]);
        let billing: any = {}; try { billing = agency?.billing_settings ? JSON.parse(agency.billing_settings) : {}; } catch { billing = {}; }
        const color = /^#[0-9a-f]{3,8}$/i.test(agency?.primary_color || "") ? agency.primary_color : "#0f5bd8";
        const logo = agency?.favicon_url ? (String(agency.favicon_url).startsWith("http") ? agency.favicon_url : publicFileUrl("profiles", agency.favicon_url)) : null;
        const agencyName = agency?.app_name || agency?.username || "";
        const base = req.originalUrl.split("?")[0].replace(/\/$/, "");
        const t = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); // the client's day in India

        // trip status line
        let when = "";
        if (x.start_date && t < x.start_date) { const n = Math.round((Date.parse(x.start_date) - Date.parse(t)) / 864e5); when = n === 1 ? "Your trip starts tomorrow" : `Your trip starts in ${n} days`; }
        else if (x.start_date && (!x.end_date || t <= x.end_date)) { const n = Math.round((Date.parse(t) - Date.parse(x.start_date)) / 864e5) + 1; when = `Enjoy your trip! Today is day ${n}`; }
        else if (x.end_date && t > x.end_date) when = "Welcome back! We hope you had a wonderful trip";

        // payment
        const invj = inv ? inv.toJSON() : null;
        const due = nextDue(invj);
        const balance = invj ? Math.max(0, Number(invj.total) - Number(invj.amount_paid)) : 0;
        const payLink = invj && balance > 0 && /^https:\/\//.test(String(invj.payment_link_url || "")) ? invj.payment_link_url : null;
        const payment = invj ? `<section class="c" id="pay"><h2>Payment</h2>
<div class="row"><span>Trip total</span><b>${inr(invj.total)}</b></div><div class="row"><span>Paid</span><b>${inr(invj.amount_paid)}</b></div>
${balance > 0 ? `<div class="row big"><span>Balance</span><b>${inr(balance)}</b></div>${due ? `<p class="due${due.date && due.date < t ? " late" : ""}">Next payment ${inr(due.amount)}${due.label ? ` (${esc(due.label)})` : ""}${due.date ? ` ${due.date < t ? "was due" : "due by"} <b>${esc(fmt(due.date))}</b>` : ""}</p>` : ""}${payLink ? `<a class="btn" href="${esc(payLink)}" target="_blank" rel="noopener">Pay ${inr(due?.amount || balance)} now</a>` : ""}` : `<p class="paid">✓ Fully paid. Thank you!</p>`}
</section>` : "";

        // day plan with photos
        const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
        const dayHtml = days.map((d: any, i: number) => {
            const on = dayDate(x.start_date, i);
            const pics = (Array.isArray(d.images) && d.images.length ? d.images : d.image ? [d.image] : []).filter((u: any) => /^https?:\/\//.test(String(u))).slice(0, 3);
            const items = (d.items || []).map((it: any) => `<li><span class="ic">${ICON[it.type] || "•"}</span><span>${esc(it.text)}</span></li>`).join("");
            return `<article class="day${on === t ? " today" : ""}" id="d${i + 1}"><div class="dh"><span class="dn">Day ${i + 1}</span>${on ? `<span class="dd">${esc(fmt(on))}${on === t ? " · today" : ""}</span>` : ""}</div>
<h3>${esc(d.title)}${d.city ? ` <small>${esc(d.city)}</small>` : ""}</h3>
${pics.length ? `<div class="pics p${pics.length}">${pics.map((u: string) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}
${d.notes ? `<p>${esc(d.notes).replace(/\n/g, "<br>")}</p>` : ""}${items ? `<ul class="items">${items}</ul>` : ""}</article>`;
        }).join("");

        // bookings
        const svcHtml = services.map((s: any) => {
            const j = s.toJSON();
            const det = Object.entries(j.details || {}).filter(([k, v]) => v && !["qty", "nights"].includes(k)).map(([k, v]) => `${esc(k.replace(/_/g, " "))}: ${esc(v)}`).join(" · ");
            return `<div class="svc"><div class="si">${ICON[j.type] || "•"}</div><div class="sb"><div class="st"><b>${esc(LABEL[j.type] || j.type)}</b>${j.service_date ? `<span>${esc(fmt(j.service_date))}${j.end_date && j.end_date !== j.service_date ? ` – ${esc(fmt(j.end_date))}` : ""}</span>` : ""}</div>
<div>${esc(j.description)}</div>${det ? `<small>${det}</small>` : ""}
<div class="conf">${j.confirmation_no ? `Confirmation <b>${esc(j.confirmation_no)}</b>` : `<span class="m">${j.status === "confirmed" ? "Confirmed" : "Being confirmed"}</span>`}</div></div></div>`;
        }).join("");

        const docHtml = [
            services.some((s: any) => ["hotel", "transfer", "activity", "other"].includes(s.dataValues.type)) ? `<li><a href="${esc(`${base}/vouchers.pdf`)}">📄 All vouchers (PDF)</a></li>` : "",
            itinerary?.share_token ? `<li><a href="${esc(`${base.replace(/\/kit\/[^/]+$/, "")}/itinerary/${itinerary.share_token}/pdf`)}">🗺️ Full itinerary (PDF)</a></li>` : "",
            ...docs.map((d: any) => `<li><a href="${esc(`${base}/doc/${d.dataValues.uuid}`)}">📎 ${esc(d.dataValues.name)}</a> <small class="m">${esc(d.dataValues.kind)}</small></li>`),
        ].join("");

        // contacts
        const contact = (label: string, name: string, phone?: string | null, wa = false) => phone ? `<div class="ct"><div><b>${esc(label)}</b>${name ? `<br><span class="m">${esc(name)}</span>` : ""}</div><div class="cta"><a class="pill" href="${esc(telHref(phone))}">Call</a>${wa && waNumber(phone).length >= 10 ? `<a class="pill wa" href="https://wa.me/${waNumber(phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div></div>` : "";
        const opsPhone = ops?.phone_number ? `${ops.country_code || ""}${ops.phone_number}` : null;
        const supplierContacts = new Map<string, any>();
        for (const s of services) { const sp = s.dataValues.supplier; if (sp?.phone && !supplierContacts.has(sp.name)) supplierContacts.set(sp.name, sp); }
        const contacts = [
            ...(settings?.emergency_contacts || []).map((c: any) => contact(c.label, "", c.phone, true)),
            opsPhone ? contact("Your trip manager", ops.username || "", opsPhone, true) : "",
            agency?.support_number ? contact(agencyName || "Travel desk", agency?.support_email || "", agency.support_number, true) : "",
            ...[...supplierContacts.values()].map((sp: any) => contact(sp.name, [sp.city, LABEL[sp.type] || ""].filter(Boolean).join(" · "), sp.phone)),
        ].join("");

        const paxHtml = pax.length ? `<p class="pax">${pax.map((p: any) => `<span>${esc(p.name)}${p.pax_type !== "adult" ? ` <small>(${esc(p.pax_type)})</small>` : ""}</span>`).join("")}</p>` : "";
        const review = /^https:\/\//.test(String(billing.google_review_url || "")) && (!x.start_date || t >= x.start_date) ? `<section class="c center"><b>Loved your trip?</b><br><a href="${esc(billing.google_review_url)}" target="_blank" rel="noopener">Leave us a Google review${billing.google_rating ? ` (rated ${esc(billing.google_rating)}★)` : ""}</a></section>` : "";
        const support = waNumber(agency?.support_number || "");
        const cover = /^https?:\/\//.test(String(itinerary?.cover_image || "")) ? itinerary.cover_image : null;
        const nav = [dayHtml && `<a href="#plan">Plan</a>`, svcHtml && `<a href="#bookings">Bookings</a>`, docHtml && `<a href="#docs">Documents</a>`, payment && `<a href="#pay">Payment</a>`, contacts && `<a href="#help">Contacts</a>`].filter(Boolean).join("");
        const details = (title: string, body: any) => (body ? `<details><summary>${title}</summary><p>${esc(body).replace(/\n/g, "<br>")}</p></details>` : "");

        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="${esc(color)}"><title>${esc(x.title)} · ${esc(agencyName)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:#111827;background:#f3f5f9}
.w{max-width:760px;margin:0 auto;padding:0 12px 24px}
.hero{position:relative;color:#fff;background:${color};${cover ? `background-image:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.65)),url('${esc(cover)}');background-size:cover;background-position:center;` : ""}border-radius:0 0 20px 20px;padding:18px 16px 20px;margin:0 -12px}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;opacity:.95}.brand img{width:36px;height:36px;border-radius:9px;background:#fff;object-fit:contain}
h1{margin:${cover ? "70px" : "18px"} 0 4px;font-size:24px;line-height:1.2}.sub{opacity:.92;font-size:14px}.when{display:inline-block;margin-top:10px;background:rgba(255,255,255,.2);border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600}
.acts{display:flex;gap:8px;margin:12px 0 0;flex-wrap:wrap}.acts a{flex:1;min-width:120px;text-align:center;background:#fff;color:${color};border-radius:12px;padding:10px;font-weight:600;text-decoration:none;font-size:14px}
nav{position:sticky;top:0;z-index:5;background:#f3f5f9;display:flex;gap:6px;overflow-x:auto;padding:10px 0;margin-top:4px;scrollbar-width:none}nav::-webkit-scrollbar{display:none}nav a{white-space:nowrap;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:6px 14px;color:#374151;text-decoration:none;font-size:13px;font-weight:600}
.c{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin-top:12px;scroll-margin-top:60px}h2{font-size:17px;margin:0 0 10px}.center{text-align:center}
.pax{display:flex;flex-wrap:wrap;gap:6px;margin:0}.pax span{background:#f3f4f6;border-radius:999px;padding:3px 10px;font-size:13px}
.day{border-top:1px solid #f1f5f9;padding:14px 0}.day:first-of-type{border-top:0;padding-top:0}.day.today{background:#fffbeb;margin:0 -16px;padding:14px 16px;border-radius:12px}
.dh{display:flex;gap:8px;align-items:center;font-size:12px}.dn{background:${color};color:#fff;border-radius:6px;padding:2px 8px;font-weight:700}.dd{color:#6b7280}
h3{margin:6px 0;font-size:16px}h3 small{color:#6b7280;font-weight:500}
.pics{display:grid;gap:6px;margin:8px 0}.pics.p1{grid-template-columns:1fr}.pics.p2{grid-template-columns:1fr 1fr}.pics.p3{grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr}.pics.p3 a:first-child{grid-row:span 2}
.pics img{width:100%;height:100%;min-height:90px;max-height:220px;object-fit:cover;border-radius:10px;display:block}.pics.p1 img{max-height:260px}
.items{list-style:none;padding:0;margin:6px 0 0}.items li{display:flex;gap:8px;margin:5px 0}.ic{width:20px;flex:none;text-align:center}
.svc{display:flex;gap:10px;padding:10px 0;border-top:1px solid #f1f5f9}.svc:first-of-type{border-top:0}.si{font-size:20px;width:28px;flex:none;text-align:center}.sb{flex:1;min-width:0}.st{display:flex;justify-content:space-between;gap:8px;font-size:13px}.st span{color:#6b7280}.conf{margin-top:2px;font-size:13px}
small,.m{color:#6b7280}ul.docs{list-style:none;padding:0;margin:0}ul.docs li{padding:8px 0;border-top:1px solid #f1f5f9}ul.docs li:first-child{border-top:0}
a{color:${color};font-weight:600}
.row{display:flex;justify-content:space-between;padding:4px 0}.row.big{font-size:18px;border-top:1px dashed #e5e7eb;margin-top:4px;padding-top:8px}.due{background:#eff6ff;border-radius:10px;padding:8px 10px;margin:10px 0 0}.due.late{background:#fef2f2;color:#991b1b}.paid{color:#15803d;font-weight:600;margin:8px 0 0}
.btn{display:block;text-align:center;background:${color};color:#fff;border-radius:12px;padding:12px;margin-top:12px;text-decoration:none}
.ct{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f1f5f9}.ct>div:first-child{min-width:0;overflow-wrap:anywhere}.ct:first-of-type{border-top:0}.cta{display:flex;gap:6px;flex:none}.pill{border:1px solid #e5e7eb;border-radius:999px;padding:5px 12px;text-decoration:none;font-size:13px}.pill.wa{background:#16a34a;border-color:#16a34a;color:#fff}
details{border-top:1px solid #f1f5f9;padding:10px 0}details:first-of-type{border-top:0}summary{font-weight:600;cursor:pointer}
footer{color:#6b7280;font-size:13px;text-align:center;padding:20px 8px}
</style></head>
<body><div class="w"><header class="hero"><div class="brand">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<span>${esc(agencyName)}</span></div>
<h1>${esc(x.title)}</h1><div class="sub">${esc(x.booking_no)}${x.start_date ? ` · ${esc(fmt(x.start_date))}${x.end_date ? ` – ${esc(fmt(x.end_date))}` : ""}` : ""}${pax.length ? ` · ${pax.length} traveller${pax.length > 1 ? "s" : ""}` : ""}</div>
${when ? `<div class="when">${esc(when)}</div>` : ""}
<div class="acts">${support.length >= 10 ? `<a href="https://wa.me/${support}?text=${encodeURIComponent(`Hi, about my trip ${x.booking_no}`)}" target="_blank" rel="noopener">💬 WhatsApp us</a>` : ""}${agency?.support_number ? `<a href="${esc(telHref(agency.support_number))}">📞 Call</a>` : ""}${payLink ? `<a href="${esc(payLink)}" target="_blank" rel="noopener">💳 Pay now</a>` : ""}</div></header>
${nav ? `<nav>${nav}</nav>` : ""}
${paxHtml ? `<section class="c"><h2>Travellers</h2>${paxHtml}</section>` : ""}
${dayHtml ? `<section class="c" id="plan"><h2>Day by day</h2>${dayHtml}</section>` : ""}
${svcHtml ? `<section class="c" id="bookings"><h2>Your bookings</h2>${svcHtml}</section>` : ""}
${docHtml ? `<section class="c" id="docs"><h2>Tickets, vouchers and documents</h2><ul class="docs">${docHtml}</ul></section>` : ""}
${payment}
${contacts ? `<section class="c" id="help"><h2>Contacts and emergencies</h2>${contacts}</section>` : ""}
${itinerary?.inclusions || itinerary?.exclusions ? `<section class="c">${details("What's included", itinerary.inclusions)}${details("Not included", itinerary.exclusions)}</section>` : ""}
${review}
<footer>${esc(agencyName)}${agency?.support_email ? ` · ${esc(agency.support_email)}` : ""}<br>Keep this page handy during your trip. It always shows the latest details.</footer></div></body></html>`;
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src * data:; style-src 'unsafe-inline'");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(html);
    } catch (error) {
        console.error("publicTripKit", error);
        return res.status(500).send("Something went wrong");
    }
};

/** GET /public/travel/kit/:token/vouchers.pdf - every hotel, transfer and activity voucher for the trip. */
export const publicTripVouchers = async (req: Request, res: Response) => {
    try {
        const b = await kitBooking(String(req.params.token || ""));
        if (!b) return res.status(404).send("Not found");
        const [services, pax, client]: any[] = await Promise.all([
            BookingService.findAll({ where: { booking_id: b.dataValues.id, status: { [Op.ne]: "cancelled" }, type: ["hotel", "transfer", "activity", "other"] }, include: [{ model: TravelSupplier, as: "supplier", attributes: ["name", "phone", "city"], required: false }], order: [["service_date", "ASC"], ["id", "ASC"]] }),
            BookingTraveller.findAll({ where: { booking_id: b.dataValues.id }, attributes: ["name", "pax_type", "is_lead"], order: [["is_lead", "DESC"], ["id", "ASC"]], raw: true }),
            User.findByPk(b.dataValues.user_id, { attributes: ["username", "phone_number", "country_code"], raw: true }),
        ]);
        return vouchersPdf(res, await pdfBrand(b.dataValues.agency_uuid), b, services, pax, client);
    } catch (error) {
        console.error("publicTripVouchers", error);
        return res.status(500).send("Something went wrong");
    }
};

/** GET /public/travel/kit/:token/doc/:docId - redirect to a fresh short-lived link for a shared document. */
export const publicTripKitDoc = async (req: Request, res: Response) => {
    try {
        const b = await kitBooking(String(req.params.token || ""));
        if (!b) return res.status(404).send("Not found");
        const d: any = await BookingDocument.findOne({ where: { booking_id: b.dataValues.id, uuid: req.params.docId, share_with_client: true } });
        const url = d ? signedFileUrl("travel_docs", d.dataValues.file_ref) : null;
        if (!url) return res.status(404).send("Not found");
        return res.redirect(302, url);
    } catch {
        return res.status(500).send("Something went wrong");
    }
};

export default new TravelExtraController();
