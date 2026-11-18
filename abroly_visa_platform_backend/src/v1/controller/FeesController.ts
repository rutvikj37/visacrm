import { publicFileUrl } from "../../helpers/storage";
import AgencyBranch from "../../model/AgencyBranch";
import { invoiceHistory } from "./ActivityLogController";
import { audit } from "../../services/audit";
import { branchFilter, isAgencyBranch } from "../../services/branches";
import axios from "axios";
import { Response } from "express";
import { Op, fn, col } from "sequelize";
import sequelize from "../../config/dbconfig";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Agent from "../../model/Agent";
import User from "../../model/User";
import AgencyLeads from "../../model/AgencyLeads";
import ClientInvoice from "../../model/ClientInvoice";
import ClientPayment from "../../model/ClientPayment";
import { decryptJson, encryptJson, maskSecret } from "../../helpers/crypto";
import { accessOf, caseScope } from "../../helpers/access";
import { notifyLater, agencyOwnerId } from "../../services/notifications";

/**
 * Client fees: invoices to students, instalments, payments / receipts, dues, Razorpay payment links
 * (on the agency's own Razorpay account).
 *
 * Owner and Accounts manage everything. Other team members can see invoices of cases they can see.
 * Amounts travel as rupees in the API and are stored in paise.
 */

const METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "razorpay", "other"];
export const toPaise = (v: any) => Math.round(Number(v || 0) * 100);
export const toRupees = (v: any) => Number(v || 0) / 100;
const today = () => new Date().toISOString().slice(0, 10);

export const canManage = (req: RequestWithUser) => {
    const a = accessOf(req);
    return a.isOwner || a.teamRole === "accounts";
};

export const readBilling = (raw: any) => {
    let b: any = {};
    try { b = raw ? JSON.parse(raw) : {}; } catch { b = {}; }
    return {
        legal_name: b.legal_name || "", gstin: b.gstin || "", address: b.address || "", invoice_prefix: b.invoice_prefix || "INV",
        default_gst_percent: Number(b.default_gst_percent) || 0, upi_id: b.upi_id || "", bank_details: b.bank_details || "", terms: b.terms || "",
    };
};

export const presentInvoice = (inv: any) => {
    const x = inv.toJSON ? inv.toJSON() : inv;
    const total = Number(x.total), paid = Number(x.amount_paid);
    const installments = (Array.isArray(x.installments) ? x.installments : []).map((i: any) => ({ label: i.label, amount: toRupees(i.amount), due_date: i.due_date }));
    // which instalment is next: walk through them with the money already paid
    let remaining = paid;
    let nextDue: any = null;
    for (const i of Array.isArray(x.installments) ? x.installments : []) {
        if (remaining >= Number(i.amount)) { remaining -= Number(i.amount); continue; }
        nextDue = { label: i.label, amount: toRupees(Number(i.amount) - remaining), due_date: i.due_date };
        break;
    }
    const dueDate = nextDue?.due_date || x.due_date || null;
    const balance = Math.max(0, total - paid);
    return {
        id: x.uuid, number: x.number, title: x.title, status: x.status,
        items: (Array.isArray(x.items) ? x.items : []).map((i: any) => ({ description: i.description, amount: toRupees(i.amount) })),
        subtotal: toRupees(x.subtotal), gst_percent: Number(x.gst_percent), gst_amount: toRupees(x.gst_amount),
        total: toRupees(total), amount_paid: toRupees(paid), balance: toRupees(balance),
        issue_date: x.issue_date, due_date: x.due_date, next_due: balance > 0 ? (nextDue || (x.due_date ? { label: "Balance", amount: toRupees(balance), due_date: x.due_date } : null)) : null,
        overdue: balance > 0 && x.status !== "cancelled" && Boolean(dueDate) && String(dueDate) < today(),
        installments, notes: x.notes, case_id: x.case_id, branch_id: x.branch_id || null,
        payment_link_url: x.payment_link_url,
        student: x.student ? { id: x.student.id, name: x.student.username, phone: `${x.student.country_code || ""} ${x.student.phone_number || ""}`.trim(), phone_digits: `${String(x.student.country_code || "").replace(/\D/g, "")}${x.student.phone_number || ""}`, email: x.student.email } : undefined,
        payments: x.payments ? x.payments.map((p: any) => ({ id: p.uuid, receipt_number: p.receipt_number, amount: toRupees(p.amount), method: p.method, reference: p.reference, note: p.note, paid_at: p.paid_at })) : undefined,
        createdAt: x.createdAt,
    };
};

/** Invoices a non-manager may see: those of cases in their scope. */
export const invoiceScope = async (req: RequestWithUser) => {
    const a = accessOf(req);
    if (canManage(req) || a.seesAll) return { agency_uuid: a.agencyUuid };
    const cases: any[] = await AgencyLeads.findAll({ where: caseScope(req), attributes: ["id"], raw: true });
    return { agency_uuid: a.agencyUuid, case_id: { [Op.in]: cases.map((c) => c.id).concat([-1]) } };
};

const readItems = (raw: any) => {
    if (!Array.isArray(raw) || !raw.length) throw new Error("Add at least one fee line");
    if (raw.length > 30) throw new Error("An invoice can have up to 30 lines");
    return raw.map((i: any, n: number) => {
        const description = String(i?.description || "").trim().slice(0, 255);
        const amount = toPaise(i?.amount);
        if (!description) throw new Error(`Line ${n + 1} needs a description`);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Line ${n + 1} needs an amount`);
        return { description, amount };
    });
};

const readInstallments = (raw: any, total: number) => {
    if (!Array.isArray(raw) || !raw.length) return null;
    if (raw.length > 24) throw new Error("Up to 24 instalments");
    const list = raw.map((i: any, n: number) => {
        const amount = toPaise(i?.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Instalment ${n + 1} needs an amount`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(i?.due_date || ""))) throw new Error(`Instalment ${n + 1} needs a due date`);
        return { label: String(i?.label || `Instalment ${n + 1}`).trim().slice(0, 60), amount, due_date: String(i.due_date) };
    });
    const sum = list.reduce((a, i) => a + i.amount, 0);
    if (sum !== total) throw new Error(`Instalments add up to Rs ${toRupees(sum)} but the invoice total is Rs ${toRupees(total)}`);
    return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
};

/** Each prefix has its own number series, so a branch with its own prefix counts from 0001. */
export const nextNumber = async (agencyUuid: string, prefix: string, t: any) => {
    const count = await ClientInvoice.count({ where: { agency_uuid: agencyUuid, number: { [Op.like]: `${prefix}-%` } }, paranoid: false, transaction: t });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

export const recordPayment = async (invoice: any, amount: number, method: string, opts: { reference?: string | null; note?: string | null; paidAt?: Date; userId?: number | null }) => {
    return sequelize.transaction(async (t: any) => {
        const fresh: any = await ClientInvoice.findByPk(invoice.dataValues.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (fresh.dataValues.status === "cancelled") throw new Error("This invoice is cancelled");
        const balance = Number(fresh.dataValues.total) - Number(fresh.dataValues.amount_paid);
        if (amount > balance) throw new Error(`Only Rs ${toRupees(balance)} is due on this invoice`);
        const n = await ClientPayment.count({ where: { agency_uuid: fresh.dataValues.agency_uuid }, paranoid: false, transaction: t });
        const payment = await ClientPayment.create({
            agency_uuid: fresh.dataValues.agency_uuid, invoice_id: fresh.dataValues.id, receipt_number: `RCPT-${String(n + 1).padStart(4, "0")}`,
            amount, method, reference: opts.reference || null, note: opts.note || null, paid_at: opts.paidAt || new Date(), received_by: opts.userId || null,
        }, { transaction: t });
        const paid = Number(fresh.dataValues.amount_paid) + amount;
        await ClientInvoice.update(
            { amount_paid: paid, status: paid >= Number(fresh.dataValues.total) ? "paid" : "partial" },
            { where: { id: fresh.dataValues.id }, transaction: t },
        );
        audit(null, {
            agencyUuid: fresh.dataValues.agency_uuid, entity: "invoice", entityId: fresh.dataValues.id, branchId: fresh.dataValues.branch_id, action: "payment",
            summary: `Payment Rs ${toRupees(amount)} (${method}) on ${fresh.dataValues.number}${paid >= Number(fresh.dataValues.total) ? " - fully paid" : ""}`,
            meta: { case_id: fresh.dataValues.case_id, receipt: (payment as any).dataValues.receipt_number },
            actor: opts.userId ? { type: "staff", id: opts.userId } : { type: "system", name: "Online payment" },
        });
        return payment;
    });
};

export const razorpayAuth = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["billing_credentials"] });
    const c = decryptJson<{ key_id: string; key_secret: string }>(agency?.dataValues?.billing_credentials);
    return c?.key_id && c?.key_secret ? { username: c.key_id, password: c.key_secret } : null;
};
export const RZP = () => (process.env.RAZORPAY_API_BASE || "https://api.razorpay.com").replace(/\/+$/, "");

class FeesController {
    // GET /crm/fees/settings
    async getSettings(req: RequestWithUser, res: Response) {
        const agency: any = await Agent.findOne({ where: { uuid: accessOf(req).agencyUuid, role: "agent" }, attributes: ["billing_settings", "billing_credentials", "app_name", "username", "agency_address"] });
        const billing = readBilling(agency?.dataValues?.billing_settings);
        const cred = decryptJson<any>(agency?.dataValues?.billing_credentials);
        return returnHelper(res, 200, true, "Settings", {
            ...billing,
            legal_name: billing.legal_name || agency?.dataValues?.app_name || agency?.dataValues?.username || "",
            address: billing.address || agency?.dataValues?.agency_address || "",
            razorpay_key_id: cred?.key_id || "", razorpay_secret_masked: cred?.key_secret ? maskSecret(cred.key_secret) : null,
            can_manage: canManage(req),
        });
    }

    // POST /crm/fees/settings (owner)
    async saveSettings(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!a.isOwner) return returnHelper(res, 200, false, "Only the agency owner can change billing settings");
            const b = req.body || {};
            const gstin = String(b.gstin || "").trim().toUpperCase();
            if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) return returnHelper(res, 200, false, "GSTIN should be 15 characters, e.g. 24ABCDE1234F1Z5");
            const gst = Number(b.default_gst_percent || 0);
            if (!Number.isFinite(gst) || gst < 0 || gst > 28) return returnHelper(res, 200, false, "GST % must be between 0 and 28");
            const prefix = String(b.invoice_prefix || "INV").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10) || "INV";
            const settings = {
                legal_name: String(b.legal_name || "").trim().slice(0, 255), gstin, address: String(b.address || "").trim().slice(0, 1000), invoice_prefix: prefix,
                default_gst_percent: gst, upi_id: String(b.upi_id || "").trim().slice(0, 100), bank_details: String(b.bank_details || "").trim().slice(0, 1000), terms: String(b.terms || "").trim().slice(0, 2000),
            };
            // keep other keys (e.g. state_code used on subscription invoices)
            const prev: any = await Agent.findOne({ where: { uuid: a.agencyUuid, role: "agent" }, attributes: ["billing_settings"] });
            let previousSettings: any = {};
            try { previousSettings = prev?.dataValues?.billing_settings ? JSON.parse(prev.dataValues.billing_settings) : {}; } catch { previousSettings = {}; }
            if (settings.gstin && settings.gstin.slice(0, 2) !== previousSettings.state_code) previousSettings.state_code = settings.gstin.slice(0, 2);
            const updates: Record<string, any> = { billing_settings: JSON.stringify({ ...previousSettings, ...settings }) };
            if (b.razorpay_key_id !== undefined || b.razorpay_key_secret) {
                const keyId = String(b.razorpay_key_id || "").trim();
                const secret = String(b.razorpay_key_secret || "").trim();
                if (!keyId) updates.billing_credentials = null;
                else {
                    const agency: any = await Agent.findOne({ where: { uuid: a.agencyUuid, role: "agent" }, attributes: ["billing_credentials"] });
                    const previous = decryptJson<any>(agency?.dataValues?.billing_credentials) || {};
                    const keySecret = secret || (previous.key_id === keyId ? previous.key_secret : "");
                    if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) || !keySecret) return returnHelper(res, 200, false, "Please enter both the Razorpay Key ID and Key Secret");
                    updates.billing_credentials = encryptJson({ key_id: keyId, key_secret: keySecret });
                }
            }
            await Agent.update(updates, { where: { uuid: a.agencyUuid, role: "agent" } });
            return returnHelper(res, 200, true, "Billing settings saved");
        } catch (error) {
            console.error("save billing settings failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/fees/invoices?status=unpaid|partial|paid|cancelled|due|overdue&search=&case_id=&page=
    async list(req: RequestWithUser, res: Response) {
        try {
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const limit = 25;
            const scope = await invoiceScope(req);
            const byBranch = branchFilter(req);
            const where: any = { ...scope, ...byBranch };
            const { status, search, case_id } = req.query as Record<string, string>;
            if (["unpaid", "partial", "paid", "cancelled"].includes(status)) where.status = status;
            if (status === "due" || status === "overdue") where.status = ["unpaid", "partial"];
            if (case_id) where.case_id = Number(case_id);
            const term = String(search || "").trim().slice(0, 100);
            const include: any[] = [{
                model: User, as: "student", attributes: ["id", "username", "phone_number", "country_code", "email"], required: true,
                ...(term && { where: { [Op.or]: [{ username: { [Op.like]: `%${term}%` } }, { phone_number: { [Op.like]: `%${term}%` } }] } }),
            }];
            const { count, rows } = await ClientInvoice.findAndCountAll({ where, include, order: [["createdAt", "DESC"]], limit: status === "overdue" ? 500 : limit, offset: status === "overdue" ? 0 : (page - 1) * limit });
            let invoices = rows.map(presentInvoice);
            if (status === "overdue") invoices = invoices.filter((i) => i.overdue);

            const open: any[] = await ClientInvoice.findAll({ where: { ...scope, ...byBranch, status: ["unpaid", "partial"] }, attributes: ["total", "amount_paid", "due_date", "installments", "status", "items", "subtotal", "gst_percent", "gst_amount", "uuid", "number", "issue_date"] });
            const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
            const received = await ClientPayment.sum("amount", {
                where: { agency_uuid: accessOf(req).agencyUuid, paid_at: { [Op.gte]: month } },
                ...("branch_id" in byBranch && { include: [{ model: ClientInvoice, as: "invoice", attributes: [], required: true, where: byBranch }] }),
            } as any);
            const openPresented = open.map(presentInvoice);
            return returnHelper(res, 200, true, "Invoices", {
                invoices,
                pagination: { currentPage: page, totalPages: status === "overdue" ? 1 : Math.ceil(count / limit), totalItems: status === "overdue" ? invoices.length : count },
                summary: canManage(req) ? {
                    outstanding: openPresented.reduce((a, i) => a + i.balance, 0),
                    overdue_amount: openPresented.filter((i) => i.overdue).reduce((a, i) => a + i.balance, 0),
                    overdue_count: openPresented.filter((i) => i.overdue).length,
                    received_this_month: toRupees(received || 0),
                } : null,
                can_manage: canManage(req),
            });
        } catch (error) {
            console.error("list invoices failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/fees/students?search=  - students of this agency (with their latest case) to bill
    async students(req: RequestWithUser, res: Response) {
        const a = accessOf(req);
        const term = String(req.query.search || "").trim().slice(0, 100);
        const rows: any[] = await User.findAll({
            where: { agency_uuid: a.agencyUuid, ...(term && { [Op.or]: [{ username: { [Op.like]: `%${term}%` } }, { phone_number: { [Op.like]: `%${term}%` } }] }) },
            attributes: ["id", "username", "phone_number", "country_code"],
            order: [["createdAt", "DESC"]],
            limit: 20,
        });
        const ids = rows.map((r) => r.dataValues.id);
        const cases: any[] = ids.length ? await AgencyLeads.findAll({ where: { agent_uuid: a.agencyUuid, user_id: ids }, attributes: ["id", "user_id", "selected_country", "university"], order: [["createdAt", "DESC"]], raw: true }) : [];
        return returnHelper(res, 200, true, "Students", rows.map((r) => ({
            id: r.dataValues.id, name: r.dataValues.username, phone: `${r.dataValues.country_code || ""} ${r.dataValues.phone_number || ""}`.trim(),
            cases: cases.filter((c) => c.user_id === r.dataValues.id).map((c) => ({ id: c.id, label: [c.selected_country, c.university].filter(Boolean).join(" · ") || `Case #${c.id}` })),
        })));
    }

    // POST /crm/fees/invoices { student_id? | case_id?, title, items, gst_percent, due_date, installments, notes }
    async create(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can create invoices");
            const b = req.body || {};
            let studentId = b.student_id ? Number(b.student_id) : null;
            let caseId: number | null = b.case_id ? Number(b.case_id) : null;
            let branchId: number | null = null;
            if (caseId) {
                const c: any = await AgencyLeads.findOne({ where: { id: caseId, agent_uuid: a.agencyUuid }, attributes: ["id", "user_id", "branch_id"] });
                if (!c) return returnHelper(res, 200, false, "Case not found");
                studentId = c.dataValues.user_id;
                branchId = c.dataValues.branch_id || null;
            } else if (b.branch_id && (await isAgencyBranch(a.agencyUuid, Number(b.branch_id)))) {
                branchId = Number(b.branch_id);
            } else if (studentId) {
                // no case chosen: bill from the branch of the student's latest case
                const latest: any = await AgencyLeads.findOne({ where: { user_id: studentId, agent_uuid: a.agencyUuid }, attributes: ["branch_id"], order: [["id", "DESC"]] });
                branchId = latest?.dataValues?.branch_id || null;
            }
            const student: any = studentId ? await User.findOne({ where: { id: studentId, agency_uuid: a.agencyUuid }, attributes: ["id"] }) : null;
            if (!student) return returnHelper(res, 200, false, "Please choose a student");

            let items, installments;
            const gst = Number(b.gst_percent || 0);
            if (!Number.isFinite(gst) || gst < 0 || gst > 28) return returnHelper(res, 200, false, "GST % must be between 0 and 28");
            if (b.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.due_date))) return returnHelper(res, 200, false, "Please pick a valid due date");
            let subtotal = 0, gstAmount = 0, total = 0;
            try {
                items = readItems(b.items);
                subtotal = items.reduce((s: number, i: any) => s + i.amount, 0);
                gstAmount = Math.round((subtotal * gst) / 100);
                total = subtotal + gstAmount;
                installments = readInstallments(b.installments, total);
            } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }
            const agency: any = await Agent.findOne({ where: { uuid: a.agencyUuid, role: "agent" }, attributes: ["billing_settings"] });
            // a branch with its own prefix has its own invoice series
            const branch: any = branchId ? await AgencyBranch.findByPk(branchId, { attributes: ["invoice_prefix"] }) : null;
            const prefix = branch?.dataValues?.invoice_prefix || readBilling(agency?.dataValues?.billing_settings).invoice_prefix;

            let invoice: any = null;
            for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
                try {
                    invoice = await sequelize.transaction(async (t: any) => ClientInvoice.create({
                        agency_uuid: a.agencyUuid, number: await nextNumber(a.agencyUuid, prefix, t), student_id: student.dataValues.id, case_id: caseId, branch_id: branchId,
                        title: b.title ? String(b.title).trim().slice(0, 255) : null, items, subtotal, gst_percent: gst, gst_amount: gstAmount, total,
                        issue_date: today(), due_date: installments ? installments[installments.length - 1].due_date : (b.due_date || null), installments,
                        notes: b.notes ? String(b.notes).trim().slice(0, 2000) : null, created_by: a.userId,
                    }, { transaction: t }));
                } catch (error: any) {
                    if (error?.name !== "SequelizeUniqueConstraintError" || attempt === 2) throw error;
                }
            }
            audit(req, { entity: "invoice", entityId: invoice.dataValues.id, branchId, action: "created", summary: `Invoice ${invoice.dataValues.number} created - Rs ${toRupees(total)}`, meta: { case_id: caseId } });
            return returnHelper(res, 200, true, `Invoice ${invoice.dataValues.number} created`, { id: invoice.dataValues.uuid });
        } catch (error) {
            console.error("create invoice failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/fees/invoices/:uuid  - with payments and the agency's billing details (for printing)
    async details(req: RequestWithUser, res: Response) {
        try {
            const invoice: any = await ClientInvoice.findOne({
                where: { ...(await invoiceScope(req)), uuid: req.params.uuid },
                include: [
                    { model: User, as: "student", attributes: ["id", "username", "phone_number", "country_code", "email"] },
                    { model: ClientPayment, as: "payments", required: false },
                ],
                order: [[{ model: ClientPayment, as: "payments" }, "paid_at", "ASC"]],
            });
            if (!invoice) return returnHelper(res, 200, false, "Invoice not found");
            const agency: any = await Agent.findOne({ where: { uuid: accessOf(req).agencyUuid, role: "agent" }, attributes: ["billing_settings", "billing_credentials", "app_name", "username", "agency_address", "support_number", "support_email", "favicon_url"] });
            const billing = readBilling(agency?.dataValues?.billing_settings);
            const logo = agency?.dataValues?.favicon_url ? (String(agency.dataValues.favicon_url).startsWith("http") ? agency.dataValues.favicon_url : publicFileUrl("profiles", agency.dataValues.favicon_url)) : null;
            // the branch that billed it prints its own address / GSTIN / contact where it has them
            const br: any = invoice.dataValues.branch_id ? await AgencyBranch.findByPk(invoice.dataValues.branch_id, { paranoid: false }) : null;
            const bd = br?.dataValues || {};
            return returnHelper(res, 200, true, "Invoice", {
                invoice: presentInvoice(invoice),
                branch: br ? { id: bd.id, name: bd.name } : null,
                agency: {
                    name: billing.legal_name || agency?.dataValues?.app_name || agency?.dataValues?.username, gstin: bd.gstin || billing.gstin,
                    branch_name: bd.name || null,
                    address: bd.address || billing.address || agency?.dataValues?.agency_address, phone: bd.phone || agency?.dataValues?.support_number, email: bd.email || agency?.dataValues?.support_email,
                    upi_id: billing.upi_id, bank_details: billing.bank_details, terms: billing.terms, logo_url: logo,
                },
                razorpay_ready: Boolean(decryptJson<any>(agency?.dataValues?.billing_credentials)?.key_id),
                can_manage: canManage(req),
                history: await invoiceHistory(accessOf(req).agencyUuid, invoice.dataValues.id),
            });
        } catch (error) {
            console.error("invoice details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/fees/invoices/:uuid/payments { amount, method, reference?, paid_at?, note? }
    async addPayment(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can record payments");
            const invoice: any = await ClientInvoice.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
            if (!invoice) return returnHelper(res, 200, false, "Invoice not found");
            const amount = toPaise(req.body?.amount);
            if (!Number.isFinite(amount) || amount <= 0) return returnHelper(res, 200, false, "Please enter the amount received");
            const method = METHODS.includes(req.body?.method) ? req.body.method : "other";
            const paidAt = req.body?.paid_at ? new Date(req.body.paid_at) : new Date();
            if (isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86400000) return returnHelper(res, 200, false, "Please pick a valid payment date");
            let payment: any;
            try {
                payment = await recordPayment(invoice, amount, method, { reference: req.body?.reference ? String(req.body.reference).slice(0, 255) : null, note: req.body?.note ? String(req.body.note).slice(0, 1000) : null, paidAt, userId: a.userId });
            } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }
            return returnHelper(res, 200, true, `Payment recorded - receipt ${payment.dataValues.receipt_number}`, { receipt_number: payment.dataValues.receipt_number });
        } catch (error) {
            console.error("add payment failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/fees/invoices/:uuid/cancel
    async cancel(req: RequestWithUser, res: Response) {
        const a = accessOf(req);
        if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can cancel invoices");
        const invoice: any = await ClientInvoice.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
        if (!invoice) return returnHelper(res, 200, false, "Invoice not found");
        if (Number(invoice.dataValues.amount_paid) > 0) return returnHelper(res, 200, false, "This invoice has payments, so it can not be cancelled");
        await ClientInvoice.update({ status: "cancelled", payment_link_url: null }, { where: { id: invoice.dataValues.id } });
        audit(req, { entity: "invoice", entityId: invoice.dataValues.id, branchId: invoice.dataValues.branch_id, action: "cancelled", summary: `Invoice ${invoice.dataValues.number} cancelled`, meta: { case_id: invoice.dataValues.case_id } });
        return returnHelper(res, 200, true, "Invoice cancelled");
    }

    // POST /crm/fees/invoices/:uuid/payment_link { amount? }  - Razorpay payment link for the balance (or part of it)
    async createLink(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can create payment links");
            const invoice: any = await ClientInvoice.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid }, include: [{ model: User, as: "student", attributes: ["username", "phone_number", "country_code", "email"] }] });
            if (!invoice) return returnHelper(res, 200, false, "Invoice not found");
            const balance = Number(invoice.dataValues.total) - Number(invoice.dataValues.amount_paid);
            if (invoice.dataValues.status === "cancelled" || balance <= 0) return returnHelper(res, 200, false, "Nothing is due on this invoice");
            const amount = req.body?.amount ? toPaise(req.body.amount) : balance;
            if (!Number.isFinite(amount) || amount < 100 || amount > balance) return returnHelper(res, 200, false, `Enter an amount up to Rs ${toRupees(balance)}`);
            const auth = await razorpayAuth(a.agencyUuid);
            if (!auth) return returnHelper(res, 200, false, "Add your Razorpay keys in Fees > Settings to create payment links");
            const student = invoice.toJSON().student || {};
            try {
                const { data } = await axios.post(`${RZP()}/v1/payment_links`, {
                    amount, currency: "INR", accept_partial: false,
                    description: `${invoice.dataValues.number}${invoice.dataValues.title ? ` - ${invoice.dataValues.title}` : ""}`.slice(0, 200),
                    reference_id: `${invoice.dataValues.number}-${Date.now().toString(36)}`.slice(0, 40),
                    customer: { name: student.username || undefined, contact: student.phone_number ? `${student.country_code || "+91"}${student.phone_number}` : undefined, email: student.email || undefined },
                    notify: { sms: false, email: false }, reminder_enable: true,
                    notes: { invoice_uuid: invoice.dataValues.uuid },
                }, { auth, timeout: 20000 });
                await ClientInvoice.update({ payment_link_id: data.id, payment_link_url: data.short_url }, { where: { id: invoice.dataValues.id } });
                return returnHelper(res, 200, true, "Payment link created", { url: data.short_url });
            } catch (error: any) {
                return returnHelper(res, 200, false, `Razorpay said: ${error?.response?.data?.error?.description || error?.message || "request failed"}`);
            }
        } catch (error) {
            console.error("create payment link failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/fees/invoices/:uuid/check_link  - ask Razorpay whether the link was paid, and record it
    async checkLink(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can check payments");
            const invoice: any = await ClientInvoice.findOne({ where: { agency_uuid: a.agencyUuid, uuid: req.params.uuid } });
            if (!invoice?.dataValues?.payment_link_id) return returnHelper(res, 200, false, "This invoice has no payment link");
            const auth = await razorpayAuth(a.agencyUuid);
            if (!auth) return returnHelper(res, 200, false, "Razorpay keys are missing");
            let link: any;
            try {
                link = (await axios.get(`${RZP()}/v1/payment_links/${invoice.dataValues.payment_link_id}`, { auth, timeout: 20000 })).data;
            } catch (error: any) {
                return returnHelper(res, 200, false, `Razorpay said: ${error?.response?.data?.error?.description || error?.message}`);
            }
            if (link.status !== "paid") return returnHelper(res, 200, true, "Not paid yet", { paid: false, status: link.status });
            const reference = link.payments?.[0]?.payment_id || link.id;
            const already = await ClientPayment.findOne({ where: { invoice_id: invoice.dataValues.id, reference }, attributes: ["id"] });
            if (!already) {
                try {
                    await recordPayment(invoice, Number(link.amount_paid || link.amount), "razorpay", { reference, note: "Paid with payment link", userId: null });
                } catch (e: any) {
                    return returnHelper(res, 200, false, e.message);
                }
                notifyLater({ agencyUuid: a.agencyUuid, recipientIds: [await agencyOwnerId(a.agencyUuid)], type: "payment_received", title: `Fee received: ${invoice.dataValues.number}`, body: `Rs ${toRupees(link.amount_paid || link.amount).toLocaleString("en-IN")} paid online`, link: `/fees/${invoice.dataValues.uuid}`, skipUserId: a.userId });
            }
            await ClientInvoice.update({ payment_link_id: null, payment_link_url: null }, { where: { id: invoice.dataValues.id } });
            return returnHelper(res, 200, true, "Payment received and recorded", { paid: true });
        } catch (error) {
            console.error("check payment link failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /student/fees  (student portal) - my invoices with what is due and a pay link
    async studentInvoices(req: RequestWithUser, res: Response) {
        try {
            const rows = await ClientInvoice.findAll({ where: { student_id: req.id, status: { [Op.ne]: "cancelled" } }, order: [["createdAt", "DESC"]] });
            const invoices = rows.map(presentInvoice);
            const agencyUuid = (rows[0] as any)?.dataValues?.agency_uuid;
            const agency: any = agencyUuid ? await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["billing_settings"] }) : null;
            const billing = readBilling(agency?.dataValues?.billing_settings);
            return returnHelper(res, 200, true, "Fees", { invoices, upi_id: billing.upi_id, bank_details: billing.bank_details, total_due: invoices.reduce((s, i) => s + i.balance, 0) });
        } catch (error) {
            console.error("student invoices failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new FeesController();
