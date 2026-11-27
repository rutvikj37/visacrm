import { saveFile, agencyOwner } from "../../helpers/storage";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, caseScope } from "../../helpers/access";
import { signedFileUrl } from "../../helpers/privateFiles";
import Agent from "../../model/Agent";
import User from "../../model/User";
import AgencyLeads from "../../model/AgencyLeads";
import ClientInvoice from "../../model/ClientInvoice";
import AgencyService from "../../model/AgencyService";
import ServiceOrder, { SERVICE_ORDER_STATUSES } from "../../model/ServiceOrder";
import ServiceOrderUpdate from "../../model/ServiceOrderUpdate";
import { audit } from "../../services/audit";
import { agencyOwnerId, notifyLater } from "../../services/notifications";
import { agencyBrand, sendMail } from "../../services/mailer";
import { studentPortalUrl } from "../../services/leadConversion";

/**
 * Service orders: after a student buys a service, the agency works on it and delivers files
 * (e.g. the SOP as a PDF); the student downloads them, can send files / messages, approve or ask for changes.
 */

const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", delivered: "Delivered", changes_requested: "Changes requested", completed: "Completed" };
const OPEN = ["new", "in_progress", "changes_requested"];

// ---------------------------------------------------------------- uploads (private storage)
const ALLOWED = /\.(pdf|docx?|xlsx?|pptx?|txt|rtf|odt|jpe?g|png|webp|zip)$/i;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => (ALLOWED.test(file.originalname) ? cb(null, true) : cb(new Error("Allowed files: PDF, Word, Excel, PowerPoint, text, images or ZIP"))),
}).array("files", 5);

/** Multer with friendly errors (too big / wrong type) as a normal API message. */
export const orderUpload = (req: Request, res: Response, next: NextFunction) =>
    upload(req, res, (err: any) => {
        if (!err) return next();
        const msg = err.code === "LIMIT_FILE_SIZE" ? "Each file can be up to 15 MB" : err.code === "LIMIT_FILE_COUNT" ? "Up to 5 files at a time" : err.message || "Upload failed";
        return returnHelper(res, 200, false, msg);
    });

/** Saves order files in the agency's folder; returns what to keep on the update row. */
const saveFiles = (agencyUuid: string, files: Express.Multer.File[] | undefined) =>
    Promise.all((files || []).map(async (f) => {
        const original = path.basename(f.originalname).replace(/[^\w.\- ()]+/g, "_").slice(-120) || "file";
        const ext = path.extname(original).toLowerCase();
        const name = await saveFile({ owner: agencyOwner(agencyUuid), folder: "service_files", name: `${crypto.randomUUID()}${ext}`, body: f.buffer, contentType: f.mimetype });
        return { name, original, size: f.size, mime: f.mimetype };
    }));

const presentFiles = (files: any) => (Array.isArray(files) ? files : []).map((f: any) => ({ name: f.original, size: f.size, mime: f.mime, url: signedFileUrl("service_files", f.name) }));

const presentUpdate = (u: any) => {
    const d = u.dataValues || u;
    return { id: d.id, kind: d.kind, author_type: d.author_type, author_name: d.author_name, message: d.message, internal: Boolean(d.internal), files: presentFiles(u.get ? u.get("files") : d.files), at: d.createdAt };
};

/** Purchases made before orders existed get their order now (one per paid service invoice). */
export const ensureOrders = async (where: Record<string, any>) => {
    const invoices: any[] = await ClientInvoice.findAll({ where: { ...where, service_id: { [Op.ne]: null }, status: { [Op.in]: ["paid", "partial"] } }, attributes: ["id", "agency_uuid", "service_id", "student_id", "case_id", "branch_id", "title", "createdAt"], raw: true });
    if (!invoices.length) return;
    const have = new Set((await ServiceOrder.findAll({ where: { invoice_id: invoices.map((i) => i.id) }, attributes: ["invoice_id"], raw: true }) as any[]).map((o) => o.invoice_id));
    for (const i of invoices.filter((x) => !have.has(x.id))) {
        await createOrderForInvoice(i).catch(() => null);
    }
};

/** Called when a services-store payment is verified. */
export const createOrderForInvoice = async (inv: any) => {
    const x = inv.dataValues || inv;
    const existing: any = await ServiceOrder.findOne({ where: { invoice_id: x.id } });
    if (existing) return existing;
    const c: any = x.case_id ? await AgencyLeads.findByPk(x.case_id, { attributes: ["assign_id"] }) : null;
    const order: any = await ServiceOrder.create({
        agency_uuid: x.agency_uuid, invoice_id: x.id, service_id: x.service_id, student_id: x.student_id, case_id: x.case_id || null,
        branch_id: x.branch_id || null, title: x.title || "Service", status: "new", assigned_to: c?.dataValues?.assign_id || null, last_update_at: new Date(),
    });
    await ServiceOrderUpdate.create({ order_id: order.dataValues.id, agency_uuid: x.agency_uuid, kind: "status", author_type: "system", author_name: "System", message: "Order placed and paid" });
    return order;
};

// ---------------------------------------------------------------- access
/** Orders a staff member may see: owner / accounts / managers per branch; others their own or their cases'. */
const staffOrderWhere = async (req: RequestWithUser) => {
    const a = accessOf(req);
    if (a.isOwner || a.teamRole === "accounts" || a.seesAll) return { agency_uuid: a.agencyUuid };
    const cases: any[] = await AgencyLeads.findAll({ where: caseScope(req), attributes: ["id"], raw: true });
    const caseIds = cases.map((c) => c.id).concat([-1]);
    if (a.teamRole === "branch_manager") return { agency_uuid: a.agencyUuid, [Op.or]: [{ branch_id: a.branchId }, { assigned_to: { [Op.in]: a.memberIds } }, { case_id: caseIds }] };
    return { agency_uuid: a.agencyUuid, [Op.or]: [{ assigned_to: a.userId }, { case_id: caseIds }] };
};

const studentName = async (id: number) => ((await User.findByPk(id, { attributes: ["username"], raw: true })) as any)?.username || "Student";
const staffName = async (id: number | null) => (id ? ((await Agent.findByPk(id, { attributes: ["username"], raw: true })) as any)?.username || "Team member" : null);

/** Tell the student by email (branded) when there is something new for them. */
const emailStudent = async (order: any, subject: string, text: string) => {
    const o = order.dataValues || order;
    const s: any = await User.findByPk(o.student_id, { attributes: ["email", "username"], raw: true });
    if (!s?.email) return;
    const { base } = await studentPortalUrl(o.agency_uuid);
    sendMail(s.email, subject, `Hi ${String(s.username || "").split(" ")[0] || "there"},\n\n${text}`, base ? { label: "Open in the portal", url: `${base}/services/orders/${o.uuid}` } : null, await agencyBrand(o.agency_uuid)).catch(() => null);
};

class ServiceOrderController {
    // ---------------------------------------------------------------- agency panel

    // GET /crm/service_orders?status=open|delivered|completed|all&mine=1&page=
    async list(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            await ensureOrders({ agency_uuid: a.agencyUuid });
            const where: any = await staffOrderWhere(req);
            const status = String(req.query.status || "open");
            if (status === "open") where.status = OPEN;
            else if ((SERVICE_ORDER_STATUSES as readonly string[]).includes(status)) where.status = status;
            if (req.query.mine) where.assigned_to = a.userId;
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = 25;
            const { rows, count } = await ServiceOrder.findAndCountAll({ where, order: [["last_update_at", "DESC"], ["id", "DESC"]], limit, offset: (page - 1) * limit });
            const studentIds = [...new Set(rows.map((r: any) => r.dataValues.student_id))];
            const staffIds = [...new Set(rows.map((r: any) => r.dataValues.assigned_to).filter(Boolean))];
            const invoiceIds = rows.map((r: any) => r.dataValues.invoice_id);
            const [students, staff, invoices]: any[] = await Promise.all([
                User.findAll({ where: { id: studentIds }, attributes: ["id", "username", "country_code", "phone_number"], raw: true }),
                Agent.findAll({ where: { id: staffIds }, attributes: ["id", "username"], raw: true }),
                ClientInvoice.findAll({ where: { id: invoiceIds }, attributes: ["id", "uuid", "number", "total"], raw: true }),
            ]);
            const st = new Map(students.map((s: any) => [s.id, s])), sf = new Map(staff.map((s: any) => [s.id, s.username])), inv = new Map(invoices.map((i: any) => [i.id, i]));
            const counts: any[] = await ServiceOrder.findAll({ where: await staffOrderWhere(req), attributes: ["status", [ServiceOrder.sequelize!.fn("COUNT", ServiceOrder.sequelize!.col("id")), "n"]], group: ["status"], raw: true });
            const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
            return returnHelper(res, 200, true, "Orders", {
                orders: rows.map((r: any) => {
                    const d = r.dataValues; const s: any = st.get(d.student_id); const i: any = inv.get(d.invoice_id);
                    return {
                        id: d.uuid, title: d.title, status: d.status, status_label: STATUS_LABEL[d.status], due_date: d.due_date,
                        overdue: Boolean(d.due_date && OPEN.includes(d.status) && String(d.due_date) < new Date().toISOString().slice(0, 10)),
                        assigned_name: sf.get(d.assigned_to) || null, at: d.createdAt, last_update_at: d.last_update_at,
                        student: s ? { name: s.username, phone: `${s.country_code || ""} ${s.phone_number || ""}`.trim() } : null,
                        invoice: i ? { id: i.uuid, number: i.number, total: Number(i.total) / 100 } : null,
                    };
                }),
                total: count, pages: Math.ceil(count / limit), page,
                counts: { open: OPEN.reduce((n, k) => n + (byStatus[k] || 0), 0), delivered: byStatus.delivered || 0, completed: byStatus.completed || 0, changes_requested: byStatus.changes_requested || 0 },
            });
        } catch (error) {
            console.error("service orders failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/service_orders/:uuid
    async details(req: RequestWithUser, res: Response) {
        try {
            const order: any = await ServiceOrder.findOne({ where: { ...(await staffOrderWhere(req)), uuid: req.params.uuid } });
            if (!order) return returnHelper(res, 200, false, "Order not found");
            const d = order.dataValues;
            const [updates, student, invoice, service]: any[] = await Promise.all([
                ServiceOrderUpdate.findAll({ where: { order_id: d.id }, order: [["id", "ASC"]] }),
                User.findByPk(d.student_id, { attributes: ["id", "username", "email", "country_code", "phone_number"], raw: true }),
                ClientInvoice.findByPk(d.invoice_id, { attributes: ["uuid", "number", "total", "amount_paid", "status"], raw: true }),
                AgencyService.findByPk(d.service_id, { attributes: ["description", "delivery"], paranoid: false, raw: true }),
            ]);
            const team: any[] = await Agent.findAll({ where: { [Op.or]: [{ uuid: accessOf(req).agencyUuid, role: "agent" }, { parent_uuid: accessOf(req).agencyUuid, status: "active" }] }, attributes: ["id", "username"], raw: true });
            return returnHelper(res, 200, true, "Order", {
                order: {
                    id: d.uuid, title: d.title, status: d.status, status_label: STATUS_LABEL[d.status], due_date: d.due_date, assigned_to: d.assigned_to,
                    case_id: d.case_id, at: d.createdAt, delivered_at: d.delivered_at, completed_at: d.completed_at,
                    service: service ? { description: service.description, delivery: service.delivery } : null,
                },
                student: student ? { name: student.username, email: student.email, phone: `${student.country_code || ""} ${student.phone_number || ""}`.trim(), phone_digits: `${String(student.country_code || "").replace(/\D/g, "")}${student.phone_number || ""}` } : null,
                invoice: invoice ? { id: invoice.uuid, number: invoice.number, total: Number(invoice.total) / 100, paid: Number(invoice.amount_paid) / 100, status: invoice.status } : null,
                updates: updates.map(presentUpdate),
                team: team.map((t) => ({ id: t.id, name: t.username })),
            });
        } catch (error) {
            console.error("service order details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/service_orders/:uuid/update  (multipart: message?, files[]?, action = message | deliver | start | complete, internal?)
    async staffUpdate(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const order: any = await ServiceOrder.findOne({ where: { ...(await staffOrderWhere(req)), uuid: req.params.uuid } });
            if (!order) return returnHelper(res, 200, false, "Order not found");
            const d = order.dataValues;
            const action = String(req.body?.action || "message");
            const message = String(req.body?.message || "").trim().slice(0, 5000);
            const internal = String(req.body?.internal) === "true" && action === "message";
            const files = req.files as Express.Multer.File[] | undefined;
            if (action === "deliver" && !files?.length && !message) return returnHelper(res, 200, false, "Attach the finished file(s) or write a message to deliver");
            if (action === "message" && !files?.length && !message) return returnHelper(res, 200, false, "Write a message or attach a file");
            if (action === "complete" && d.status === "completed") return returnHelper(res, 200, false, "The order is already completed");
            const saved = await saveFiles(d.agency_uuid, files);
            const me = await staffName(a.userId);
            const next = action === "deliver" ? "delivered" : action === "start" ? "in_progress" : action === "complete" ? "completed" : d.status === "new" && !internal ? "in_progress" : d.status;
            if (message || saved.length) {
                await ServiceOrderUpdate.create({ order_id: d.id, agency_uuid: d.agency_uuid, kind: action === "deliver" ? "delivery" : "message", author_type: "staff", author_id: a.userId, author_name: me, message: message || null, files: saved.length ? saved : null, internal });
            }
            if (next !== d.status) {
                await ServiceOrderUpdate.create({ order_id: d.id, agency_uuid: d.agency_uuid, kind: "status", author_type: "staff", author_id: a.userId, author_name: me, message: `Status: ${STATUS_LABEL[next]}` });
            }
            await ServiceOrder.update({
                status: next, last_update_at: new Date(),
                ...(next === "delivered" && { delivered_at: new Date() }), ...(next === "completed" && { completed_at: new Date() }),
                ...(!d.assigned_to && { assigned_to: a.userId }),
            }, { where: { id: d.id } });
            if (action === "deliver") {
                audit(req, { entity: "invoice", entityId: d.invoice_id, branchId: d.branch_id, action: "service_delivered", summary: `Delivered "${d.title}"${saved.length ? ` (${saved.length} file${saved.length > 1 ? "s" : ""})` : ""}`, meta: { case_id: d.case_id } });
                emailStudent(order, `Your ${d.title} is ready`, `${me || "Your counsellor"} has delivered your ${d.title}.${saved.length ? ` ${saved.length} file${saved.length > 1 ? "s are" : " is"} ready to download.` : ""}${message ? `\n\n"${message.slice(0, 500)}"` : ""}`);
            } else if (!internal && (message || saved.length)) {
                emailStudent(order, `New message about your ${d.title}`, `${me || "Your counsellor"} wrote:\n\n"${(message || "Sent you a file").slice(0, 500)}"`);
            }
            const labels: Record<string, string> = { deliver: "Delivered - the student can download it now", start: "Marked in progress", complete: "Order completed", message: internal ? "Internal note added" : "Message sent to the student" };
            return returnHelper(res, 200, true, labels[action] || "Saved");
        } catch (error) {
            console.error("service order update failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/service_orders/:uuid/assign { agent_id?, due_date? }
    async assign(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const order: any = await ServiceOrder.findOne({ where: { ...(await staffOrderWhere(req)), uuid: req.params.uuid } });
            if (!order) return returnHelper(res, 200, false, "Order not found");
            const changes: any = {};
            if (req.body?.agent_id !== undefined) {
                const id = req.body.agent_id ? Number(req.body.agent_id) : null;
                if (id) {
                    const ok = await Agent.findOne({ where: { id, [Op.or]: [{ uuid: a.agencyUuid }, { parent_uuid: a.agencyUuid }] }, attributes: ["id"] });
                    if (!ok) return returnHelper(res, 200, false, "Team member not found");
                }
                changes.assigned_to = id;
            }
            if (req.body?.due_date !== undefined) {
                const due = req.body.due_date ? String(req.body.due_date) : null;
                if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return returnHelper(res, 200, false, "Please pick a valid date");
                changes.due_date = due;
            }
            if (!Object.keys(changes).length) return returnHelper(res, 200, false, "Nothing to change");
            await ServiceOrder.update({ ...changes, last_update_at: new Date() }, { where: { id: order.dataValues.id } });
            if (changes.assigned_to && changes.assigned_to !== a.userId) {
                notifyLater({ agencyUuid: a.agencyUuid, recipientIds: [changes.assigned_to], type: "case_assigned", title: `Service order for you: ${order.dataValues.title}`, link: `/services/orders/${order.dataValues.uuid}`, email: true });
            }
            return returnHelper(res, 200, true, changes.assigned_to !== undefined ? "Order assigned" : "Due date saved");
        } catch (error) {
            console.error("service order assign failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // ---------------------------------------------------------------- student portal

    // GET /student/service_orders
    async studentList(req: RequestWithUser, res: Response) {
        try {
            await ensureOrders({ student_id: req.id });
            const rows: any[] = await ServiceOrder.findAll({ where: { student_id: req.id }, order: [["id", "DESC"]] });
            const files: any[] = rows.length ? await ServiceOrderUpdate.findAll({ where: { order_id: rows.map((r) => r.dataValues.id), kind: "delivery", internal: false }, attributes: ["order_id", "files"] }) : [];
            const fileCount = new Map<number, number>();
            for (const f of files) fileCount.set(f.dataValues.order_id, (fileCount.get(f.dataValues.order_id) || 0) + (f.get("files")?.length || 0));
            return returnHelper(res, 200, true, "Orders", {
                orders: rows.map((r) => ({ id: r.dataValues.uuid, title: r.dataValues.title, status: r.dataValues.status, at: r.dataValues.createdAt, delivered_files: fileCount.get(r.dataValues.id) || 0 })),
            });
        } catch (error) {
            console.error("student service orders failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /student/service_orders/:uuid
    async studentDetails(req: RequestWithUser, res: Response) {
        try {
            const order: any = await ServiceOrder.findOne({ where: { student_id: req.id, uuid: req.params.uuid } });
            if (!order) return returnHelper(res, 200, false, "Order not found");
            const d = order.dataValues;
            const [updates, invoice, service]: any[] = await Promise.all([
                ServiceOrderUpdate.findAll({ where: { order_id: d.id, internal: false }, order: [["id", "ASC"]] }),
                ClientInvoice.findByPk(d.invoice_id, { attributes: ["number", "total"], raw: true }),
                AgencyService.findByPk(d.service_id, { attributes: ["description", "delivery"], paranoid: false, raw: true }),
            ]);
            // newest delivery first, files in the order they were uploaded
            const deliveries = updates.filter((u: any) => u.dataValues.kind === "delivery").reverse().flatMap((u: any) => presentFiles(u.get("files")).map((f: any) => ({ ...f, at: u.dataValues.createdAt })));
            return returnHelper(res, 200, true, "Order", {
                order: { id: d.uuid, title: d.title, status: d.status, due_date: d.due_date, at: d.createdAt, delivered_at: d.delivered_at, service: service || null, invoice_number: invoice?.number, total: invoice ? Number(invoice.total) / 100 : null, handled_by: await staffName(d.assigned_to) },
                deliveries,
                updates: updates.map(presentUpdate),
            });
        } catch (error) {
            console.error("student service order failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /student/service_orders/:uuid/reply  (multipart: message?, files[]?, action = message | approve | changes)
    async studentReply(req: RequestWithUser, res: Response) {
        try {
            const order: any = await ServiceOrder.findOne({ where: { student_id: req.id, uuid: req.params.uuid } });
            if (!order) return returnHelper(res, 200, false, "Order not found");
            const d = order.dataValues;
            const action = String(req.body?.action || "message");
            const message = String(req.body?.message || "").trim().slice(0, 5000);
            const files = req.files as Express.Multer.File[] | undefined;
            if (action === "changes" && !message) return returnHelper(res, 200, false, "Please write what should be changed");
            if (action === "message" && !message && !files?.length) return returnHelper(res, 200, false, "Write a message or attach a file");
            if ((action === "approve" || action === "changes") && d.status !== "delivered") return returnHelper(res, 200, false, "You can do this once the work is delivered");
            const saved = await saveFiles(d.agency_uuid, files);
            const name = await studentName(d.student_id);
            if (message || saved.length) {
                await ServiceOrderUpdate.create({ order_id: d.id, agency_uuid: d.agency_uuid, kind: "message", author_type: "student", author_id: d.student_id, author_name: name, message: message || null, files: saved.length ? saved : null });
            }
            const next = action === "approve" ? "completed" : action === "changes" ? "changes_requested" : d.status;
            if (next !== d.status) {
                await ServiceOrderUpdate.create({ order_id: d.id, agency_uuid: d.agency_uuid, kind: "status", author_type: "student", author_id: d.student_id, author_name: name, message: action === "approve" ? "Approved the delivery" : "Asked for changes" });
            }
            await ServiceOrder.update({ status: next, last_update_at: new Date(), ...(next === "completed" && { completed_at: new Date() }) }, { where: { id: d.id } });
            const recipients = [d.assigned_to || (await agencyOwnerId(d.agency_uuid))].filter(Boolean) as number[];
            const title = action === "approve" ? `${name} approved ${d.title}` : action === "changes" ? `${name} asked for changes: ${d.title}` : `${name} wrote about ${d.title}`;
            notifyLater({ agencyUuid: d.agency_uuid, recipientIds: recipients, type: "document_uploaded", title, body: message ? message.slice(0, 300) : saved.length ? `${saved.length} file(s) attached` : null, link: `/services/orders/${d.uuid}`, email: action !== "message" });
            if (action !== "message") audit(null, { agencyUuid: d.agency_uuid, entity: "invoice", entityId: d.invoice_id, branchId: d.branch_id, action: action === "approve" ? "service_approved" : "service_changes", summary: title, meta: { case_id: d.case_id }, actor: { type: "student", id: d.student_id, name } });
            const labels: Record<string, string> = { approve: "Thank you! The order is complete.", changes: "Sent - your counsellor will update it.", message: "Sent" };
            return returnHelper(res, 200, true, labels[action] || "Sent");
        } catch (error) {
            console.error("student service reply failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new ServiceOrderController();
