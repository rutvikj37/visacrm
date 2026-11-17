import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, caseScope, leadScope } from "../../helpers/access";
import AgencyLeads from "../../model/AgencyLeads";
import CrmLead from "../../model/CrmLead";
import CrmLeadActivity from "../../model/CrmLeadActivity";
import ActivityLog from "../../model/ActivityLog";
import Step from "../../model/Step";
import Question from "../../model/Question";
import ClientInvoice from "../../model/ClientInvoice";
import ClientPayment from "../../model/ClientPayment";
import PortalChatMessage from "../../model/PortalChatMessage";
import UniversityApplication from "../../model/UniversityApplication";
import User from "../../model/User";
import Agent from "../../model/Agent";

/**
 * One timeline per student: lead activity before conversion, case history (stages, results, universities,
 * commissions), documents and answers, invoices and payments, and portal chat - newest first.
 * Only cases / leads the viewer may see are included; money only for owner, Accounts and branch managers.
 */

type Kind = "lead" | "case" | "document" | "payment" | "chat";
type Item = { at: Date | string; kind: Kind; title: string; detail?: string | null; who?: string | null; case_id?: number | null; link?: string | null };

const LEAD_ACTIVITY: Record<string, string> = {
    created: "Lead created", note: "Note", call: "Call", email: "Email", whatsapp: "WhatsApp", status_change: "Lead status changed",
    assignment: "Lead assigned", follow_up: "Follow-up set", follow_up_done: "Follow-up done", re_enquiry: "Enquired again", updated: "Lead updated",
    converted: "Converted to visa case", instagram: "Instagram", portal: "Student portal",
};
const QUESTION_STATUS: Record<string, string> = { provided: "Student answered", completed: "Accepted", rejected: "Sent back to the student" };
const rupees = (paise: any) => `Rs ${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
const clip = (v: any, n = 220) => { const t = String(v || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

class StudentTimelineController {
    // GET /crm/students/:id/timeline?kind=lead|case|document|payment|chat
    async timeline(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const studentId = Number(req.params.id) || 0;
            const student: any = await User.findOne({ where: { id: studentId }, attributes: ["id", "username", "email", "phone_number", "country_code", "createdAt"] });
            if (!student) return returnHelper(res, 200, false, "Student not found");

            const [cases, leads]: any[] = await Promise.all([
                AgencyLeads.findAll({ where: { ...caseScope(req), user_id: studentId }, attributes: ["id", "status", "case_stage", "selected_country", "university", "createdAt"], order: [["createdAt", "ASC"]] }),
                CrmLead.findAll({ where: { ...leadScope(req), converted_student_id: studentId }, attributes: ["id", "uuid", "name", "source", "createdAt"] }),
            ]);
            if (!cases.length && !leads.length) return returnHelper(res, 200, false, "Student not found");
            const caseIds: number[] = cases.map((c: any) => c.dataValues.id);
            const leadIds: number[] = leads.map((l: any) => l.dataValues.id);
            const seesMoney = a.isOwner || a.teamRole === "accounts" || a.teamRole === "branch_manager";
            const caseLabel = (id: number) => {
                const c = cases.find((x: any) => x.dataValues.id === id)?.dataValues;
                return c ? [c.selected_country, c.university].filter(Boolean).join(" · ") || `Case #${id}` : `Case #${id}`;
            };

            const invoices: any[] = seesMoney ? await ClientInvoice.findAll({
                where: { agency_uuid: a.agencyUuid, student_id: studentId, [Op.or]: [{ case_id: caseIds.length ? caseIds : [-1] }, { case_id: null }] },
                attributes: ["id", "uuid", "number", "title", "total", "status", "case_id", "createdAt"],
            }) : [];
            const invoiceIds = invoices.map((i) => i.dataValues.id);

            const [leadActs, logs, questions, payments, chats]: any[] = await Promise.all([
                leadIds.length ? CrmLeadActivity.findAll({ where: { lead_id: leadIds }, order: [["createdAt", "DESC"]], limit: 300 }) : [],
                ActivityLog.findAll({
                    where: {
                        agency_uuid: a.agencyUuid,
                        [Op.or]: [
                            { entity: "case", entity_id: caseIds.length ? caseIds : [-1] },
                            ...(invoiceIds.length ? [{ entity: "invoice", entity_id: invoiceIds }] : []),
                        ],
                        // money lines stay with people who may see money
                        ...(!seesMoney && { action: { [Op.notLike]: "commission%" } }),
                    },
                    order: [["createdAt", "DESC"]], limit: 400,
                }),
                caseIds.length ? Question.findAll({
                    where: { status: ["provided", "completed", "rejected"] },
                    include: [{ model: Step, as: "step", attributes: ["lead_id", "step_title"], where: { lead_id: caseIds }, required: true }],
                    attributes: ["id", "question_text", "question_type", "status", "reason", "updatedAt"],
                    order: [["updatedAt", "DESC"]], limit: 200,
                }).catch(() => []) : [],
                invoiceIds.length ? ClientPayment.findAll({ where: { invoice_id: invoiceIds }, attributes: ["id", "invoice_id", "receipt_number", "amount", "method", "paid_at"], order: [["paid_at", "DESC"]] }) : [],
                PortalChatMessage.findAll({ where: { agency_uuid: a.agencyUuid, student_id: studentId }, attributes: ["id", "sender_type", "sender_id", "body", "createdAt"], order: [["createdAt", "DESC"]], limit: 100 }),
            ]);

            const staffIds = [...new Set([
                ...leadActs.map((x: any) => x.dataValues.created_by),
                ...chats.filter((m: any) => m.dataValues.sender_type === "agent").map((m: any) => m.dataValues.sender_id),
            ].filter(Boolean))];
            const staff: any[] = staffIds.length ? await Agent.findAll({ where: { id: staffIds }, attributes: ["id", "username"], raw: true }) : [];
            const staffName = (id: any) => staff.find((s) => s.id === id)?.username || null;
            const studentName = student.dataValues.username || "Student";

            const items: Item[] = [];
            for (const l of leads) {
                const leadLink = `/crm/leads/${l.dataValues.uuid}`;
                for (const x of leadActs.filter((y: any) => y.dataValues.lead_id === l.dataValues.id)) {
                    const d = x.dataValues;
                    items.push({ at: d.createdAt, kind: "lead", title: LEAD_ACTIVITY[d.type] || "Lead activity", detail: clip(d.message), who: d.created_by ? staffName(d.created_by) : null, link: leadLink });
                }
                if (!leadActs.some((y: any) => y.dataValues.lead_id === l.dataValues.id && y.dataValues.type === "created")) {
                    items.push({ at: l.dataValues.createdAt, kind: "lead", title: "Lead created", detail: l.dataValues.source ? `Source: ${l.dataValues.source}` : null, link: leadLink });
                }
            }
            for (const c of cases) {
                items.push({ at: c.dataValues.createdAt, kind: "case", title: "Visa case opened", detail: caseLabel(c.dataValues.id), case_id: c.dataValues.id, link: `/leads/progress/${c.dataValues.id}` });
            }
            for (const g of logs) {
                const d = g.dataValues;
                const isInvoice = d.entity === "invoice";
                const inv = isInvoice ? invoices.find((i) => i.dataValues.id === d.entity_id) : null;
                items.push({
                    at: d.createdAt, kind: isInvoice || String(d.action).startsWith("commission") ? "payment" : "case",
                    title: clip(d.summary, 160), who: d.actor_name,
                    detail: isInvoice ? `Invoice ${inv?.dataValues.number || ""}`.trim() : caseLabel(d.entity_id),
                    case_id: isInvoice ? inv?.dataValues.case_id || null : d.entity_id,
                    link: isInvoice ? (inv ? `/fees/${inv.dataValues.uuid}` : null) : `/leads/progress/${d.entity_id}`,
                });
            }
            for (const q of questions) {
                const d = q.toJSON();
                items.push({
                    at: d.updatedAt, kind: "document",
                    title: `${QUESTION_STATUS[d.status] || "Updated"}: ${clip(d.question_text, 90)}`,
                    detail: [d.step?.step_title, d.status === "rejected" && d.reason ? `Reason: ${clip(d.reason, 120)}` : null].filter(Boolean).join(" · "),
                    who: d.status === "provided" ? studentName : null, case_id: d.step?.lead_id, link: d.step?.lead_id ? `/leads/progress/${d.step.lead_id}` : null,
                });
            }
            for (const i of invoices) {
                const d = i.dataValues;
                items.push({ at: d.createdAt, kind: "payment", title: `Invoice ${d.number} raised`, detail: [d.title, rupees(d.total), d.status].filter(Boolean).join(" · "), case_id: d.case_id, link: `/fees/${d.uuid}` });
            }
            for (const p of payments) {
                const d = p.dataValues;
                const inv = invoices.find((i) => i.dataValues.id === d.invoice_id);
                items.push({ at: d.paid_at, kind: "payment", title: `Payment received ${rupees(d.amount)}`, detail: [`Receipt ${d.receipt_number}`, String(d.method).replace(/_/g, " "), inv && `Invoice ${inv.dataValues.number}`].filter(Boolean).join(" · "), case_id: inv?.dataValues.case_id || null, link: inv ? `/fees/${inv.dataValues.uuid}` : null });
            }
            for (const m of chats) {
                const d = m.dataValues;
                items.push({ at: d.createdAt, kind: "chat", title: d.sender_type === "student" ? `${studentName} wrote` : `${staffName(d.sender_id) || "Team"} replied`, detail: clip(d.body, 200), link: `/crm/chats?chat=${studentId}` });
            }

            const kind = String(req.query.kind || "");
            const all = items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
            const counts = all.reduce((acc: Record<string, number>, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {});
            const unis: any[] = caseIds.length ? await UniversityApplication.findAll({ where: { case_id: caseIds }, attributes: ["id", "university", "status", "is_final", "case_id"], raw: true }) : [];
            return returnHelper(res, 200, true, "Timeline", {
                student: { id: student.dataValues.id, name: studentName, email: student.dataValues.email, phone: `${student.dataValues.country_code || ""} ${student.dataValues.phone_number || ""}`.trim() },
                cases: cases.map((c: any) => ({ id: c.dataValues.id, status: c.dataValues.status, stage: c.dataValues.case_stage, label: caseLabel(c.dataValues.id) })),
                universities: unis,
                lead: leads[0] ? { uuid: leads[0].dataValues.uuid } : null,
                counts,
                items: (kind ? all.filter((i) => i.kind === kind) : all).slice(0, 400),
            });
        } catch (error) {
            console.error("student timeline failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new StudentTimelineController();
