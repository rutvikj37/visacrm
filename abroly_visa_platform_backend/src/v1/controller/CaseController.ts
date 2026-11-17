import AgencyBranch from "../../model/AgencyBranch";
import { caseHistory } from "./ActivityLogController";
import { audit } from "../../services/audit";
import { branchFilter, branchOfAgent, isAgencyBranch } from "../../services/branches";
import { Response } from "express";
import { Op, fn, col } from "sequelize";
import sequelize from "../../config/dbconfig";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import AgencyLeads from "../../model/AgencyLeads";
import CrmLead, { CRM_LEAD_SOURCES } from "../../model/CrmLead";
import RaisedApplications from "../../model/RaisedApplications";
import Step from "../../model/Step";
import Question from "../../model/Question";
import User from "../../model/User";
import Agent from "../../model/Agent";
import { isAgencyMember } from "../../services/leadIngestion";
import { resolveTemplate } from "./VisaTemplateController";
import { notifyLater } from "../../services/notifications";
import { accessOf, canAssignTo, caseScope } from "../../helpers/access";

/**
 * Visa cases (AgencyLeads): board by stage, outcome, assignment, step due dates, extra applications.
 * Owners see all cases; team members only cases assigned to them (same rule as the case lists).
 */

export const CASE_STAGES = ["documents", "application", "offer", "funds", "visa_filed", "biometrics", "decision"] as const;
const STAGE_NAMES: Record<string, string> = { documents: "Documents", application: "Application", offer: "Offer", funds: "Fees & funds", visa_filed: "Visa filed", biometrics: "Biometrics", decision: "Decision" };
const OUTCOMES: Record<string, string> = { approved: "visa_completed", rejected: "visa_rejected", withdrawn: "withdrawn", reopen: "visa_progress" };
const DONE_STATUSES = ["visa_completed", "visa_rejected", "withdrawn", "withdrawn_by_student"];

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, agencyId: Number(user.agent_id), userId: Number(user.id), isOwner: user.role === "agent" };
};

const scope = (req: RequestWithUser) => caseScope(req);

const findCase = (req: RequestWithUser, id: any) => AgencyLeads.findOne({ where: { ...scope(req), id: Number(id) || 0 } });

const parseJson = (v: any) => {
    if (!v) return null;
    if (typeof v === "object") return v;
    try { return JSON.parse(v); } catch { return null; }
};

const today = () => new Date().toISOString().slice(0, 10);

class CaseController {
    // GET /crm/cases?search=&assigned_to=&country=&converted=1&from=&to=&source=
    // converted=1 → only cases linked from CRM leads converted in Reports (leads created in from..to)
    async board(req: RequestWithUser, res: Response) {
        try {
            const { isOwner, userId, agencyUuid } = ctx(req);
            const q = req.query as Record<string, string>;
            const convertedOnly = q.converted === "1" || q.converted === "true";
            const where: any = {
                ...scope(req),
                ...branchFilter(req),
            };
            if (!convertedOnly) {
                where[Op.or] = [
                    { status: "visa_progress" },
                    // decided in the last 60 days, so the board shows recent results
                    { status: DONE_STATUSES, updatedAt: { [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
                ];
            }
            const { assigned_to, country } = q;
            if (accessOf(req).isManager && assigned_to) where.assign_id = assigned_to === "unassigned" ? null : assigned_to === "me" ? userId : Number(assigned_to);
            if (country) where.selected_country = country;

            if (convertedOnly) {
                const leadWhere: any = {
                    agency_uuid: agencyUuid,
                    status: "converted",
                    converted_case_id: { [Op.ne]: null },
                };
                const from = q.from ? new Date(String(q.from)) : null;
                const to = q.to ? new Date(String(q.to)) : null;
                if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
                    from.setHours(0, 0, 0, 0);
                    to.setHours(23, 59, 59, 999);
                    // match Reports Overview: leads created in the period that are now converted
                    leadWhere.createdAt = { [Op.between]: [from, to] };
                }
                const source = String(q.source || "").trim();
                if (source && (CRM_LEAD_SOURCES as readonly string[]).includes(source)) leadWhere.source = source;
                const branchRaw = String(q.branch || "").trim();
                if (branchRaw === "none") leadWhere.branch_id = null;
                else if (branchRaw) {
                    const bid = Number(branchRaw);
                    if (Number.isInteger(bid) && bid > 0) leadWhere.branch_id = bid;
                }
                const leads: any[] = await CrmLead.findAll({ where: leadWhere, attributes: ["converted_case_id"], raw: true });
                const ids = [...new Set(leads.map((l) => Number(l.converted_case_id)).filter((id) => id > 0))];
                where.id = ids.length ? ids : [-1];
            }

            const search = String(req.query.search || "").trim().slice(0, 100);
            const cases: any[] = await AgencyLeads.findAll({
                where,
                include: [{
                    model: User, as: "user_of", attributes: ["id", "username", "phone_number", "country_code", "email"], required: true,
                    ...(search && { where: { [Op.or]: [{ username: { [Op.like]: `%${search}%` } }, { phone_number: { [Op.like]: `%${search}%` } }] } }),
                }],
                attributes: ["id", "status", "case_stage", "stage_updated_at", "selected_country", "selected_intake_year", "selected_suggestion", "university", "assign_id", "branch_id", "createdAt", "updatedAt"],
                order: [["updatedAt", "DESC"]],
                limit: 500,
            });
            const ids = cases.map((c) => c.dataValues.id);

            const [stepRows, dueRows, reviewRows, people]: any[] = await Promise.all([
                ids.length ? Step.findAll({ where: { lead_id: ids }, attributes: ["lead_id", "step_status", [fn("COUNT", col("id")), "n"]], group: ["lead_id", "step_status"], raw: true }) : [],
                ids.length ? Step.findAll({ where: { lead_id: ids, step_status: 0, due_date: { [Op.ne]: null } }, attributes: ["lead_id", [fn("MIN", col("due_date")), "next_due"], [fn("SUM", sequelize.literal(`CASE WHEN due_date < '${today()}' THEN 1 ELSE 0 END`)), "overdue"]], group: ["lead_id"], raw: true }) : [],
                ids.length ? Question.findAll({
                    where: { status: "provided" },
                    include: [{ model: Step, as: "step", attributes: [], where: { lead_id: ids }, required: true }],
                    attributes: [[col("step.lead_id"), "lead_id"], [fn("COUNT", col("Question.id")), "n"]],
                    group: [col("step.lead_id") as any],
                    raw: true,
                }).catch(() => []) : [],
                Agent.findAll({ where: { [Op.or]: [{ uuid: ctx(req).agencyUuid }, { parent_uuid: ctx(req).agencyUuid }] }, attributes: ["id", "username"], raw: true }),
            ]);
            const nameOf = Object.fromEntries(people.map((p: any) => [p.id, p.username]));

            const result = cases.map((c) => {
                const x = c.toJSON();
                const steps = stepRows.filter((r: any) => r.lead_id === x.id);
                const total = steps.reduce((a: number, r: any) => a + Number(r.n), 0);
                const done = steps.filter((r: any) => Number(r.step_status) === 1).reduce((a: number, r: any) => a + Number(r.n), 0);
                const due = dueRows.find((r: any) => r.lead_id === x.id);
                const sel = parseJson(x.selected_suggestion) || {};
                return {
                    id: x.id,
                    status: x.status,
                    stage: x.status === "visa_progress" ? (x.case_stage || "documents") : null,
                    outcome: x.status === "visa_completed" ? "approved" : x.status === "visa_rejected" ? "rejected" : DONE_STATUSES.includes(x.status) ? "withdrawn" : null,
                    student: { id: x.user_of?.id, name: x.user_of?.username, phone: `${x.user_of?.country_code || ""} ${x.user_of?.phone_number || ""}`.trim() },
                    country: x.selected_country || sel.country || null,
                    university: x.university || sel.university || null,
                    course: sel.fieldOfStudy || null,
                    intake: [sel.intakeMonth, sel.intakeYear || x.selected_intake_year].filter(Boolean).join(" ") || null,
                    assignee: x.assign_id ? { id: x.assign_id, name: nameOf[x.assign_id] || "Team member" } : null,
                    branch_id: x.branch_id || null,
                    steps_total: total,
                    steps_done: done,
                    next_due: due?.next_due || null,
                    overdue_steps: Number(due?.overdue || 0),
                    to_review: Number(reviewRows.find((r: any) => Number(r.lead_id) === x.id)?.n || 0),
                    stage_since: x.stage_updated_at || x.createdAt,
                    updatedAt: x.updatedAt,
                };
            });
            return returnHelper(res, 200, true, "Cases", { cases: result, stages: CASE_STAGES });
        } catch (error) {
            console.error("case board failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/cases/:id  - header info for the case page (+ the student's other applications)
    async details(req: RequestWithUser, res: Response) {
        try {
            const c: any = await AgencyLeads.findOne({
                where: { ...scope(req), id: Number(req.params.id) || 0 },
                include: [{ model: User, as: "user_of", attributes: ["id", "username", "phone_number", "country_code", "email"] }],
            });
            if (!c) return returnHelper(res, 200, false, "Case not found");
            const x = c.toJSON();
            const sel = parseJson(x.selected_suggestion) || {};
            const siblings: any[] = await AgencyLeads.findAll({
                where: { agent_uuid: ctx(req).agencyUuid, user_id: x.user_id, id: { [Op.ne]: x.id } },
                attributes: ["id", "status", "selected_country", "university", "case_stage"],
                order: [["createdAt", "ASC"]],
            });
            const assignee: any = x.assign_id ? await Agent.findByPk(x.assign_id, { attributes: ["id", "username"] }) : null;
            const branch: any = x.branch_id ? await AgencyBranch.findByPk(x.branch_id, { attributes: ["id", "name"] }) : null;
            return returnHelper(res, 200, true, "Case", {
                branch: branch ? { id: branch.dataValues.id, name: branch.dataValues.name } : null,
                id: x.id,
                status: x.status,
                stage: x.status === "visa_progress" ? (x.case_stage || "documents") : null,
                student: x.user_of,
                country: x.selected_country || sel.country || null,
                university: x.university || sel.university || null,
                course: sel.fieldOfStudy || null,
                intake: [sel.intakeMonth, sel.intakeYear || x.selected_intake_year].filter(Boolean).join(" ") || null,
                assignee: assignee ? { id: assignee.dataValues.id, name: assignee.dataValues.username } : null,
                other_applications: siblings.map((s) => ({ id: s.dataValues.id, status: s.dataValues.status, country: s.dataValues.selected_country, university: s.dataValues.university, stage: s.dataValues.case_stage })),
                stages: CASE_STAGES,
            });
        } catch (error) {
            console.error("case details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/cases/:id/history  - who changed what on this case (and its invoices)
    async history(req: RequestWithUser, res: Response) {
        try {
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            return returnHelper(res, 200, true, "History", { entries: await caseHistory(ctx(req).agencyUuid, c.dataValues.id) });
        } catch (error) {
            console.error("case history failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/:id/stage { stage }
    async setStage(req: RequestWithUser, res: Response) {
        try {
            const stage = String(req.body?.stage || "");
            if (!(CASE_STAGES as readonly string[]).includes(stage)) return returnHelper(res, 200, false, "Invalid stage");
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            if (c.dataValues.status !== "visa_progress") return returnHelper(res, 200, false, "Reopen the case first");
            await AgencyLeads.update({ case_stage: stage, stage_updated_at: new Date() }, { where: { id: c.dataValues.id } });
            if (c.dataValues.case_stage !== stage) {
                audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "stage", summary: `Stage: ${STAGE_NAMES[c.dataValues.case_stage] || "-"} → ${STAGE_NAMES[stage]}`, meta: { from: c.dataValues.case_stage, to: stage } });
            }
            return returnHelper(res, 200, true, "Stage updated");
        } catch (error) {
            console.error("set stage failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/:id/outcome { outcome: approved | rejected | withdrawn | reopen, note? }
    async setOutcome(req: RequestWithUser, res: Response) {
        try {
            const outcome = String(req.body?.outcome || "");
            const status = OUTCOMES[outcome];
            if (!status) return returnHelper(res, 200, false, "Invalid outcome");
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            if (c.dataValues.status === status) return returnHelper(res, 200, false, "The case already has this result");
            const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;
            await AgencyLeads.update(
                { status, ...(note && { reason: note }), ...(outcome === "reopen" && { stage_updated_at: new Date() }) },
                { where: { id: c.dataValues.id } },
            );
            const labels: Record<string, string> = { approved: "Visa approved", rejected: "Visa rejected", withdrawn: "Case withdrawn", reopen: "Case reopened" };
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "outcome", summary: `${labels[outcome]}${note ? ` - ${note.slice(0, 200)}` : ""}`, meta: { from: c.dataValues.status, to: status } });
            return returnHelper(res, 200, true, labels[outcome]);
        } catch (error) {
            console.error("set outcome failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/:id/assign { agent_id } (owner)
    async assign(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            if (!isOwner && !accessOf(req).isManager) return returnHelper(res, 200, false, "Only the owner or a branch manager can reassign cases");
            const agentId = req.body?.agent_id ? Number(req.body.agent_id) : null;
            if (agentId && (!(await isAgencyMember(agencyUuid, agentId)) || !canAssignTo(req, agentId))) return returnHelper(res, 200, false, "Team member not found");
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            // work follows the person: a case given to someone of another branch moves there (invoices already raised stay with the branch that billed them)
            const newBranch = await branchOfAgent(agentId);
            const moves = Boolean(newBranch && newBranch !== c.dataValues.branch_id);
            await AgencyLeads.update({ assign_id: agentId, ...(moves && { branch_id: newBranch }) }, { where: { id: c.dataValues.id } });
            const assignee: any = agentId ? await Agent.findOne({ where: { id: agentId }, attributes: ["username"], raw: true }) : null;
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: moves ? newBranch : c.dataValues.branch_id, action: "assign", summary: agentId ? `Assigned to ${assignee?.username || "a team member"}${moves ? " (moved to their branch)" : ""}` : "Unassigned", meta: { from: c.dataValues.assign_id, to: agentId } });
            if (agentId && agentId !== userId) {
                notifyLater({ agencyUuid, recipientIds: [agentId], type: "case_assigned", title: "A visa case was assigned to you", link: `/leads/progress/${c.dataValues.id}`, email: true });
            }
            return returnHelper(res, 200, true, agentId ? "Case assigned" : "Case unassigned");
        } catch (error) {
            console.error("assign case failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/:id/branch { branch_id | null }  - move a case to another branch
    async transfer(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            if (!accessOf(req).isManager) return returnHelper(res, 200, false, "Only the owner or a branch manager can move cases");
            const branchId = req.body?.branch_id ? Number(req.body.branch_id) : null;
            if (branchId && !(await isAgencyBranch(agencyUuid, branchId))) return returnHelper(res, 200, false, "Branch not found");
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            if ((c.dataValues.branch_id || null) === branchId) return returnHelper(res, 200, false, "The case is already in this branch");
            // the person handling it stays only if they belong to the new branch; otherwise its manager assigns it
            const keep = branchId ? (await branchOfAgent(c.dataValues.assign_id)) === branchId : true;
            await AgencyLeads.update({ branch_id: branchId, ...(!keep && { assign_id: null }) }, { where: { id: c.dataValues.id } });
            const branch: any = branchId ? await AgencyBranch.findByPk(branchId, { attributes: ["name"] }) : null;
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId, action: "branch", summary: `Moved to ${branch?.dataValues?.name || "no branch"}${keep ? "" : " (unassigned)"}`, meta: { from: c.dataValues.branch_id, to: branchId } });
            if (branchId) {
                const managers: any[] = await Agent.findAll({ where: { parent_uuid: agencyUuid, branch_id: branchId, team_role: "branch_manager", status: "active" }, attributes: ["id"], raw: true });
                notifyLater({ agencyUuid, recipientIds: managers.map((m) => m.id), type: "case_assigned", title: "A visa case was moved to your branch", link: `/leads/progress/${c.dataValues.id}`, skipUserId: ctx(req).userId });
            }
            return returnHelper(res, 200, true, `Case moved to ${branch?.dataValues?.name || "no branch"}${keep ? "" : " - please assign it to someone there"}`);
        } catch (error) {
            console.error("transfer case failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/steps/:stepId/due { due_date: "YYYY-MM-DD" | null }
    async setStepDue(req: RequestWithUser, res: Response) {
        try {
            const { agencyId } = ctx(req);
            const step: any = await Step.findOne({ where: { id: Number(req.params.stepId) || 0, agent_id: agencyId } });
            if (!step) return returnHelper(res, 200, false, "Step not found");
            const c: any = await findCase(req, step.dataValues.lead_id);
            if (!c) return returnHelper(res, 200, false, "Step not found");
            const raw = req.body?.due_date;
            if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return returnHelper(res, 200, false, "Please pick a valid date");
            await Step.update({ due_date: raw || null, due_notified_at: null }, { where: { id: step.dataValues.id } });
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "step_due", summary: `"${step.dataValues.step_title}" due ${raw || "date removed"}` });
            return returnHelper(res, 200, true, raw ? "Due date set" : "Due date removed");
        } catch (error) {
            console.error("set step due failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/cases/:id/add_application { country, university?, course?, intake?, template_id?, assigned_to? }
    async addApplication(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, agencyId, userId, isOwner } = ctx(req);
            const c: any = await findCase(req, req.params.id);
            if (!c) return returnHelper(res, 200, false, "Case not found");
            const b = req.body || {};
            const country = String(b.country || "").trim().slice(0, 255);
            if (!country) return returnHelper(res, 200, false, "Please enter the country");
            const template = b.template_id ? await resolveTemplate(agencyUuid, String(b.template_id)) : null;
            if (b.template_id && !template) return returnHelper(res, 200, false, "Template not found");
            let assignTo: number | null = isOwner ? c.dataValues.assign_id : userId;
            if (isOwner && b.assigned_to && (await isAgencyMember(agencyUuid, Number(b.assigned_to)))) assignTo = Number(b.assigned_to);

            const intake = b.intake ? String(b.intake).trim().slice(0, 50) : "";
            const year = intake.match(/(20\d{2})/)?.[1] || "";
            const month = intake.replace(year, "").trim();
            const course = b.course ? String(b.course).trim().slice(0, 255) : null;
            const university = b.university ? String(b.university).trim().slice(0, 255) : null;
            const studentId = c.dataValues.user_id;

            const newId = await sequelize.transaction(async (t: any) => {
                const application: any = await RaisedApplications.create({ country, fieldOfStudy: course, intake: intake || null, university, student_id: studentId, status: "accepted" }, { transaction: t });
                const selection = { country, fieldOfStudy: course, intakeMonth: month, intakeYear: year, university };
                const created: any = await AgencyLeads.create({
                    agent_uuid: agencyUuid, raised_aplication_id: application.dataValues.id, user_id: studentId, status: "visa_progress", lead_type: "offline",
                    suggestions: JSON.stringify([selection]), selected_suggestion: JSON.stringify(selection), selected_country: country, selected_intake_year: year || null,
                    assign_id: assignTo, branch_id: c.dataValues.branch_id || null, case_stage: "documents", stage_updated_at: new Date(), university,
                    last_follow_up_remark: `Additional application (from case #${c.dataValues.id})`,
                }, { transaction: t });
                for (const [index, step] of (template?.steps || []).entries()) {
                    const s: any = await Step.create({
                        agent_id: agencyId, student_id: studentId, lead_id: created.dataValues.id, created_by_id: userId,
                        step_title: step.title, step_description: step.description || null, step_order: index + 1,
                        due_date: step.due_in_days !== null && step.due_in_days !== undefined ? new Date(Date.now() + Number(step.due_in_days) * 86400000).toISOString().slice(0, 10) : null,
                    }, { transaction: t });
                    if (step.questions?.length) {
                        await Question.bulkCreate(step.questions.map((q) => ({
                            step_id: s.dataValues.id, student_id: String(studentId), agent_id: String(agencyId), created_by_agent_id: String(userId),
                            question_text: q.text, question_type: q.type === "file_selector" ? "file_selector" : "text_input", status: "pending",
                        })), { transaction: t });
                    }
                }
                return created.dataValues.id;
            });
            return returnHelper(res, 200, true, "New application created", { id: newId });
        } catch (error) {
            console.error("add application failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new CaseController();
