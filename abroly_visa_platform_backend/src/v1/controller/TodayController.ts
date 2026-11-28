import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, caseScope, leadScope, taskScope } from "../../helpers/access";
import AgencyTask from "../../model/AgencyTask";
import UniversityApplication from "../../model/UniversityApplication";
import Commission from "../../model/Commission";
import CrmLead from "../../model/CrmLead";
import AgencyLeads from "../../model/AgencyLeads";
import Step from "../../model/Step";
import Question from "../../model/Question";
import User from "../../model/User";
import Agent from "../../model/Agent";
import { hideCommissionsOf } from "../../services/businessFocus";
import ClientInvoice from "../../model/ClientInvoice";
import { branchFilter } from "../../services/branches";
import { canManage, invoiceScope, presentInvoice } from "./FeesController";

/**
 * Today screen (home of the agency panel) and global search.
 * Everything is limited to what the person may see (helpers/access.ts) and, for the owner, ?branch=.
 */

const CLOSED = ["converted", "lost", "junk"];
const dayStart = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const phoneOf = (x: any) => (x?.phone_number ? `${x.country_code || ""} ${x.phone_number}`.trim() : null);

class TodayController {
    // GET /crm/today
    async today(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const leads = { ...leadScope(req), ...branchFilter(req) };
            const cases = { ...caseScope(req), ...branchFilter(req) };
            const open = { status: { [Op.notIn]: CLOSED } };
            const leadAttrs = ["uuid", "name", "phone_number", "country_code", "phone_normalized", "interested_country", "interested_course", "source", "status", "next_follow_up_at", "follow_up_note", "createdAt", "score"];

            const [dueToday, overdue, newLeads, newCount, unassignedCount, unassigned] = await Promise.all([
                CrmLead.findAll({ where: { ...leads, ...open, next_follow_up_at: { [Op.between]: [dayStart(), dayStart(1)] } }, attributes: leadAttrs, order: [["next_follow_up_at", "ASC"]], limit: 15 }),
                CrmLead.findAll({ where: { ...leads, ...open, next_follow_up_at: { [Op.lt]: dayStart() } }, attributes: leadAttrs, order: [["next_follow_up_at", "ASC"]], limit: 15 }),
                CrmLead.findAll({ where: { ...leads, status: "new", createdAt: { [Op.gte]: new Date(Date.now() - 48 * 3600000) } }, attributes: leadAttrs, order: [["createdAt", "DESC"]], limit: 10 }),
                CrmLead.count({ where: { ...leads, status: "new" } }),
                a.isManager ? CrmLead.count({ where: { ...leads, ...open, assigned_to: null } }) : Promise.resolve(0),
                a.isManager ? CrmLead.findAll({ where: { ...leads, ...open, assigned_to: null }, attributes: leadAttrs, order: [["createdAt", "DESC"]], limit: 5 }) : Promise.resolve([]),
            ]);
            const overdueCount = await CrmLead.count({ where: { ...leads, ...open, next_follow_up_at: { [Op.lt]: dayStart() } } });

            // visa case work: steps due today / overdue, documents waiting for review
            const caseRows: any[] = await AgencyLeads.findAll({ where: { ...cases, status: "visa_progress" }, attributes: ["id"], raw: true, limit: 3000 });
            const caseIds = caseRows.map((c) => c.id);
            const [steps, review] = caseIds.length ? await Promise.all([
                Step.findAll({
                    where: { lead_id: caseIds, step_status: 0, due_date: { [Op.lte]: ymd(dayStart()) } },
                    include: [{ model: AgencyLeads, as: "lead", attributes: ["id", "selected_country"], include: [{ model: User, as: "user_of", attributes: ["username"] }] }],
                    attributes: ["id", "lead_id", "step_title", "due_date"], order: [["due_date", "ASC"]], limit: 15,
                }),
                Question.findAll({
                    where: { status: "provided" },
                    include: [{ model: Step, as: "step", attributes: ["lead_id", "step_title"], where: { lead_id: caseIds }, required: true,
                        include: [{ model: AgencyLeads, as: "lead", attributes: ["id"], include: [{ model: User, as: "user_of", attributes: ["username"] }] }] }],
                    attributes: ["id", "question_text", "updatedAt"], order: [["updatedAt", "DESC"]], limit: 15,
                }),
            ]) : [[], []];

            // fees: owner and accounts (others see their cases' invoices only in Client fees)
            let fees: any[] = [];
            if (canManage(req)) {
                const soon = ymd(dayStart(2));
                const rows: any[] = await ClientInvoice.findAll({
                    where: { ...(await invoiceScope(req)), ...branchFilter(req), status: ["unpaid", "partial"] },
                    include: [{ model: User, as: "student", attributes: ["id", "username", "phone_number", "country_code", "email"] }],
                    limit: 500,
                });
                fees = rows.map(presentInvoice).filter((i: any) => i.next_due?.due_date && String(i.next_due.due_date) <= soon)
                    .sort((x: any, y: any) => String(x.next_due.due_date).localeCompare(String(y.next_due.due_date))).slice(0, 15);
            }

            const lead = (l: any) => { const x = l.toJSON(); return { ...x, phone: phoneOf(x) }; };
            const me: any = await Agent.findByPk(a.userId, { attributes: ["username"] });
            return returnHelper(res, 200, true, "Today", {
                name: me?.dataValues?.username || null,
                counts: {
                    follow_ups_today: dueToday.length, follow_ups_overdue: overdueCount, new_leads: newCount, unassigned: unassignedCount,
                    steps_due: steps.length, to_review: review.length, fees_due: fees.length,
                },
                follow_ups: [...overdue.map((l) => ({ ...lead(l), overdue: true })), ...dueToday.map(lead)],
                new_leads: newLeads.map(lead),
                unassigned: (unassigned as any[]).map(lead),
                steps: steps.map((s: any) => { const x = s.toJSON(); return { id: x.id, case_id: x.lead_id, title: x.step_title, due_date: x.due_date, student: x.lead?.user_of?.username || "Student", country: x.lead?.selected_country || null }; }),
                review: review.map((q: any) => { const x = q.toJSON(); return { id: x.id, case_id: x.step?.lead_id, text: x.question_text, step: x.step?.step_title, student: x.step?.lead?.user_of?.username || "Student", at: x.updatedAt }; }),
                fees: fees.map((i: any) => ({ id: i.id, number: i.number, student: i.student?.name, phone_digits: i.student?.phone_digits, amount: i.next_due.amount, due_date: i.next_due.due_date, overdue: i.overdue, label: i.next_due.label })),
                can_manage: a.isManager,
                can_bill: canManage(req),
            });
        } catch (error) {
            console.error("today failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/search?q=  - leads, students (visa cases) and invoices
    async search(req: RequestWithUser, res: Response) {
        try {
            const q = String(req.query.q || "").trim().slice(0, 80);
            if (q.length < 2) return returnHelper(res, 200, true, "Search", { results: [] });
            const like = `%${q}%`;
            const digits = q.replace(/\D/g, "");
            const leadOr: any[] = [{ name: { [Op.like]: like } }, { email: { [Op.like]: like } }, { interested_country: { [Op.like]: like } }];
            if (digits.length >= 4) leadOr.push({ phone_normalized: { [Op.like]: `%${digits}%` } });
            const userOr: any[] = [{ username: { [Op.like]: like } }, { email: { [Op.like]: like } }];
            if (digits.length >= 4) userOr.push({ phone_number: { [Op.like]: `%${digits}%` } });

            // "#48" or "case 48" → that case number
            const caseNo = q.match(/^(?:#|case\s*#?)\s*(\d{1,9})$/i)?.[1];
            const a = accessOf(req);
            const seesMoney = a.isOwner || a.teamRole === "accounts" || a.teamRole === "branch_manager";
            const ag: any = await Agent.findOne({ where: { uuid: a.agencyUuid, role: "agent" }, attributes: ["ui_prefs"], raw: true });
            const hideCommissions = hideCommissionsOf(ag?.ui_prefs);
            const caseIdsSeen = async () => (await AgencyLeads.findAll({ where: caseScope(req), attributes: ["id"], raw: true }) as any[]).map((r) => r.id);

            const [leads, cases, invoices, byNumber, tasks, uniApps, commissions]: any[] = await Promise.all([
                CrmLead.findAll({ where: { ...leadScope(req), [Op.or]: leadOr }, attributes: ["uuid", "name", "phone_number", "country_code", "status", "interested_country"], order: [["last_activity_at", "DESC"]], limit: 6 }),
                AgencyLeads.findAll({
                    where: { ...caseScope(req), status: ["visa_progress", "visa_completed", "visa_rejected", "withdrawn"] },
                    include: [{ model: User, as: "user_of", attributes: ["username", "phone_number", "country_code"], where: { [Op.or]: userOr }, required: true }],
                    attributes: ["id", "status", "selected_country", "university"], order: [["updatedAt", "DESC"]], limit: 6,
                }),
                canManage(req) ? ClientInvoice.findAll({
                    where: { ...(await invoiceScope(req)), [Op.or]: [{ number: { [Op.like]: like } }, { title: { [Op.like]: like } }, { "$student.username$": { [Op.like]: like } }] },
                    include: [{ model: User, as: "student", attributes: ["username"], required: false }],
                    attributes: ["uuid", "number", "title", "status", "total"], order: [["createdAt", "DESC"]], limit: 5,
                }) : Promise.resolve([]),
                caseNo ? AgencyLeads.findAll({
                    where: { ...caseScope(req), id: Number(caseNo) },
                    include: [{ model: User, as: "user_of", attributes: ["username"], required: false }],
                    attributes: ["id", "status", "selected_country", "university"], limit: 1,
                }) : Promise.resolve([]),
                AgencyTask.findAll({ where: { ...taskScope(req), title: { [Op.like]: like } }, attributes: ["id", "title", "status", "due_at"], order: [["updatedAt", "DESC"]], limit: 5 }),
                (async () => {
                    const where: any = { agency_uuid: a.agencyUuid, [Op.or]: [{ university: { [Op.like]: like } }, { application_ref: { [Op.like]: like } }, { course: { [Op.like]: like } }] };
                    const rows: any[] = await UniversityApplication.findAll({ where, attributes: ["id", "case_id", "student_id", "university", "course", "status", "application_ref"], order: [["updatedAt", "DESC"]], limit: 20 });
                    if (!rows.length) return [];
                    const allowed = new Set(await caseIdsSeen());
                    const visible = rows.filter((r) => allowed.has(r.dataValues.case_id)).slice(0, 5);
                    const students: any[] = visible.length ? await User.findAll({ where: { id: visible.map((r) => r.dataValues.student_id) }, attributes: ["id", "username"], raw: true }) : [];
                    return visible.map((r) => ({ ...r.dataValues, student: students.find((u) => u.id === r.dataValues.student_id)?.username }));
                })(),
                seesMoney && !hideCommissions ? (async () => {
                    const where: any = { agency_uuid: a.agencyUuid, [Op.or]: [{ partner: { [Op.like]: like } }, { invoice_ref: { [Op.like]: like } }] };
                    if (!(a.isOwner || a.teamRole === "accounts" || a.seesAll)) { const ids = await caseIdsSeen(); where.case_id = ids.length ? ids : [-1]; }
                    return Commission.findAll({ where, attributes: ["id", "case_id", "partner", "status", "currency", "amount_expected", "invoice_ref"], order: [["updatedAt", "DESC"]], limit: 4, raw: true });
                })() : Promise.resolve([]),
            ]);
            const CASE_STATUS: Record<string, string> = { visa_progress: "In progress", visa_completed: "Approved", visa_rejected: "Rejected", withdrawn: "Withdrawn" };
            const UNI: Record<string, string> = { shortlisted: "Shortlisted", applied: "Applied", offer: "Offer", conditional: "Conditional offer", unconditional: "Unconditional offer", cas: "CAS / I-20", deposit_paid: "Deposit paid", rejected: "Rejected", withdrawn: "Withdrawn" };
            const TASK: Record<string, string> = { todo: "Pending", in_progress: "In progress", ready_for_review: "Ready", done: "Completed" };
            const results = [
                ...byNumber.map((c: any) => { const x = c.toJSON(); return { type: "case", title: `Case #${x.id} · ${x.user_of?.username || "Student"}`, subtitle: [x.selected_country, x.university, CASE_STATUS[x.status]].filter(Boolean).join(" · "), link: `/leads/progress/${x.id}` }; }),
                ...leads.map((l: any) => ({ type: "lead", title: l.dataValues.name || "Unnamed lead", subtitle: [phoneOf(l.dataValues), l.dataValues.interested_country, l.dataValues.status].filter(Boolean).join(" · "), link: `/crm/leads/${l.dataValues.uuid}` })),
                ...cases.map((c: any) => { const x = c.toJSON(); return { type: "case", title: x.user_of?.username || "Student", subtitle: [x.selected_country, x.university, CASE_STATUS[x.status]].filter(Boolean).join(" · "), link: `/leads/progress/${x.id}` }; }),
                ...invoices.map((i: any) => { const x = i.toJSON(); return { type: "invoice", title: `${x.number} · ${x.student?.username || ""}`.trim(), subtitle: [x.title, `Rs ${(Number(x.total) / 100).toLocaleString("en-IN")}`, x.status].filter(Boolean).join(" · "), link: `/fees/${x.uuid}` }; }),
                ...uniApps.map((u: any) => ({ type: "university", title: `${u.university}${u.student ? ` · ${u.student}` : ""}`, subtitle: [u.course, UNI[u.status], u.application_ref && `Ref ${u.application_ref}`].filter(Boolean).join(" · "), link: `/leads/progress/${u.case_id}` })),
                ...tasks.map((t: any) => ({ type: "task", title: t.dataValues.title, subtitle: [TASK[t.dataValues.status], t.dataValues.due_at && `Due ${new Date(t.dataValues.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`].filter(Boolean).join(" · "), link: `/crm/tasks?task=${t.dataValues.id}` })),
                ...commissions.map((c: any) => ({ type: "commission", title: `Commission · ${c.partner}`, subtitle: [`${c.currency} ${(Number(c.amount_expected) / 100).toLocaleString("en-IN")}`, c.status, c.invoice_ref].filter(Boolean).join(" · "), link: c.case_id ? `/leads/progress/${c.case_id}` : "/commissions" })),
            ];
            return returnHelper(res, 200, true, "Search", { results });
        } catch (error) {
            console.error("search failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new TodayController();
