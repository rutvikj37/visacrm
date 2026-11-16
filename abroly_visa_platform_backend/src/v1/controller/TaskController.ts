import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, canAssignTo, taskScope } from "../../helpers/access";
import AgencyTask from "../../model/AgencyTask";
import Agent from "../../model/Agent";
import CrmLead from "../../model/CrmLead";
import AgencyLeads from "../../model/AgencyLeads";
import { notifyLater } from "../../services/notifications";

const STATUSES = ["todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "normal", "high"] as const;
const RELATED = ["none", "lead", "case"] as const;

const canSetAssignee = (req: RequestWithUser, agentId: number) => {
    const a = accessOf(req);
    if (agentId === a.userId) return true;
    return canAssignTo(req, agentId);
};

const canEditTask = (req: RequestWithUser, task: any) => {
    const a = accessOf(req);
    if (a.isOwner || a.isManager) return true;
    return Number(task.created_by) === a.userId || Number(task.assignee_id) === a.userId;
};

const canDeleteTask = (req: RequestWithUser, task: any) => {
    const a = accessOf(req);
    if (a.isOwner || a.isManager) return true;
    return Number(task.created_by) === a.userId;
};

const serialize = (row: any, names: Map<number, string>) => {
    const d = row.toJSON ? row.toJSON() : row.dataValues || row;
    const due = d.due_at ? new Date(d.due_at) : null;
    const overdue = !!due && d.status !== "done" && due.getTime() < Date.now();
    let related_link: string | null = null;
    if (d.related_type === "lead" && d.related_id) related_link = `/crm/leads/${d.related_id}`;
    if (d.related_type === "case" && d.related_id) related_link = `/leads/progress/${d.related_id}`;
    return {
        id: d.id,
        title: d.title,
        description: d.description || "",
        status: d.status,
        priority: d.priority,
        due_at: d.due_at,
        overdue,
        assignee_id: d.assignee_id,
        assignee_name: names.get(Number(d.assignee_id)) || "Team member",
        created_by: d.created_by,
        created_by_name: names.get(Number(d.created_by)) || "Someone",
        related_type: d.related_type || "none",
        related_id: d.related_id || null,
        related_link,
        related_label: d.related_label || null,
        completed_at: d.completed_at,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
};

const loadNames = async (ids: number[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map<number, string>();
    const rows: any[] = await Agent.findAll({ where: { id: unique }, attributes: ["id", "username"] });
    return new Map(rows.map((r) => [r.dataValues.id, r.dataValues.username || "Team member"]));
};

const resolveRelatedLabel = async (agencyUuid: string, type: string, id: string | null) => {
    if (!id || type === "none") return null;
    if (type === "lead") {
        const lead: any = await CrmLead.findOne({
            where: { agency_uuid: agencyUuid, uuid: id },
            attributes: ["name", "phone"],
        });
        if (!lead) return null;
        return lead.dataValues.name || lead.dataValues.phone || "Lead";
    }
    if (type === "case") {
        const c: any = await AgencyLeads.findOne({
            where: { agent_uuid: agencyUuid, id: Number(id) },
            attributes: ["id", "country", "preferred_course"],
        });
        if (!c) return null;
        const d = c.dataValues;
        return [d.country, d.preferred_course].filter(Boolean).join(" · ") || `Case #${d.id}`;
    }
    return null;
};

const parseRelated = (body: any) => {
    let related_type = String(body.related_type || "none");
    if (!(RELATED as readonly string[]).includes(related_type)) related_type = "none";
    let related_id = related_type === "none" ? null : String(body.related_id || "").trim() || null;
    if (related_type !== "none" && !related_id) {
        related_type = "none";
        related_id = null;
    }
    return { related_type, related_id };
};

class TaskController {
    // GET /crm/tasks?view=all|mine|assigned_by_me&status=open|done|overdue|todo|in_progress|done&q=&branch=
    async list(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const view = String(req.query.view || "all");
            const statusFilter = String(req.query.status || "open");
            const q = String(req.query.q || "").trim().toLowerCase();

            const where: any = { ...taskScope(req) };

            if (view === "mine") where.assignee_id = a.userId;
            if (view === "assigned_by_me") where.created_by = a.userId;

            // Optional branch: filter by assignee's branch
            const branchId = req.query.branch ? Number(req.query.branch) : 0;
            if (branchId) {
                const inBranch: any[] = await Agent.findAll({
                    where: {
                        [Op.or]: [{ uuid: a.agencyUuid }, { parent_uuid: a.agencyUuid }],
                        branch_id: branchId,
                    },
                    attributes: ["id"],
                    raw: true,
                });
                const ids = inBranch.map((r) => Number(r.id)).filter(Boolean);
                const branchAssignees = { [Op.in]: ids.length ? ids : [0] };
                if (where.assignee_id != null && typeof where.assignee_id === "number") {
                    // mine + branch: keep only if assignee is in branch
                    if (!ids.includes(where.assignee_id)) where.assignee_id = -1;
                } else {
                    where.assignee_id = branchAssignees;
                }
            }

            const now = new Date();
            if (statusFilter === "open") where.status = { [Op.in]: ["todo", "in_progress"] };
            else if (statusFilter === "done") where.status = "done";
            else if (statusFilter === "overdue") {
                where.status = { [Op.ne]: "done" };
                where.due_at = { [Op.lt]: now };
            } else if ((STATUSES as readonly string[]).includes(statusFilter)) {
                where.status = statusFilter;
            }

            if (q) {
                where[Op.and] = [
                    ...(where[Op.and] ? (Array.isArray(where[Op.and]) ? where[Op.and] : [where[Op.and]]) : []),
                    { title: { [Op.like]: `%${q}%` } },
                ];
            }

            const rows: any[] = await AgencyTask.findAll({
                where,
                order: [
                    ["status", "ASC"],
                    ["due_at", "ASC"],
                    ["id", "DESC"],
                ],
                limit: 300,
            });

            const names = await loadNames(rows.flatMap((r) => [r.dataValues.assignee_id, r.dataValues.created_by]));
            const tasks = [];
            for (const r of rows) {
                const item = serialize(r, names);
                item.related_label = await resolveRelatedLabel(a.agencyUuid, item.related_type, item.related_id);
                tasks.push(item);
            }

            const columns = {
                todo: tasks.filter((t) => t.status === "todo"),
                in_progress: tasks.filter((t) => t.status === "in_progress"),
                done: tasks.filter((t) => t.status === "done"),
            };

            const open = tasks.filter((t) => t.status !== "done").length;
            const overdue = tasks.filter((t) => t.overdue).length;

            return returnHelper(res, 200, true, "Tasks", { tasks, columns, counts: { open, overdue, total: tasks.length } });
        } catch (error: any) {
            console.error("tasks list failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // GET /crm/tasks/counts
    async counts(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const where: any = { ...taskScope(req), assignee_id: a.userId, status: { [Op.ne]: "done" } };
            const open = await AgencyTask.count({ where });
            const overdue = await AgencyTask.count({
                where: { ...where, due_at: { [Op.lt]: new Date() } },
            });
            return returnHelper(res, 200, true, "Counts", { open, overdue });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // GET /crm/tasks/:id
    async details(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const id = Number(req.params.id);
            const row: any = await AgencyTask.findOne({ where: { id, ...taskScope(req) } });
            if (!row) return returnHelper(res, 200, false, "Task not found");
            const names = await loadNames([row.dataValues.assignee_id, row.dataValues.created_by]);
            const task = serialize(row, names);
            task.related_label = await resolveRelatedLabel(a.agencyUuid, task.related_type, task.related_id);
            return returnHelper(res, 200, true, "Task", { task });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // POST /crm/tasks
    async create(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const title = String(req.body.title || "").trim().slice(0, 255);
            if (!title) return returnHelper(res, 200, false, "Title is required");

            const assignee_id = Number(req.body.assignee_id || a.userId);
            if (!assignee_id || !canSetAssignee(req, assignee_id)) {
                return returnHelper(res, 200, false, "You cannot assign to that person");
            }

            let status = String(req.body.status || "todo");
            if (!(STATUSES as readonly string[]).includes(status)) status = "todo";
            let priority = String(req.body.priority || "normal");
            if (!(PRIORITIES as readonly string[]).includes(priority)) priority = "normal";

            const { related_type, related_id } = parseRelated(req.body);
            if (related_type === "lead" && related_id) {
                const ok = await CrmLead.findOne({ where: { agency_uuid: a.agencyUuid, uuid: related_id }, attributes: ["id"] });
                if (!ok) return returnHelper(res, 200, false, "Linked lead not found");
            }
            if (related_type === "case" && related_id) {
                const ok = await AgencyLeads.findOne({ where: { agent_uuid: a.agencyUuid, id: Number(related_id) }, attributes: ["id"] });
                if (!ok) return returnHelper(res, 200, false, "Linked case not found");
            }

            const due_at = req.body.due_at ? new Date(req.body.due_at) : null;
            const row: any = await AgencyTask.create({
                agency_uuid: a.agencyUuid,
                created_by: a.userId,
                assignee_id,
                title,
                description: String(req.body.description || "").trim().slice(0, 5000) || null,
                status,
                priority,
                due_at: due_at && !Number.isNaN(due_at.getTime()) ? due_at : null,
                related_type,
                related_id,
                completed_at: status === "done" ? new Date() : null,
            });

            if (assignee_id !== a.userId) {
                notifyLater({
                    agencyUuid: a.agencyUuid,
                    recipientIds: [assignee_id],
                    type: "task_assigned",
                    title: "New task assigned to you",
                    body: title,
                    link: `/crm/tasks?task=${row.dataValues.id}`,
                    skipUserId: a.userId,
                    email: true,
                });
            }

            const names = await loadNames([assignee_id, a.userId]);
            const task = serialize(row, names);
            task.related_label = await resolveRelatedLabel(a.agencyUuid, related_type, related_id);
            return returnHelper(res, 200, true, "Task created", { task });
        } catch (error: any) {
            console.error("task create failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // POST /crm/tasks/:id/update
    async update(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const id = Number(req.params.id);
            const row: any = await AgencyTask.findOne({ where: { id, ...taskScope(req) } });
            if (!row) return returnHelper(res, 200, false, "Task not found");
            if (!canEditTask(req, row.dataValues)) return returnHelper(res, 200, false, "You cannot edit this task");

            const patch: any = {};
            if (req.body.title !== undefined) {
                const title = String(req.body.title || "").trim().slice(0, 255);
                if (!title) return returnHelper(res, 200, false, "Title is required");
                patch.title = title;
            }
            if (req.body.description !== undefined) {
                patch.description = String(req.body.description || "").trim().slice(0, 5000) || null;
            }
            if (req.body.priority !== undefined) {
                const priority = String(req.body.priority);
                if ((PRIORITIES as readonly string[]).includes(priority)) patch.priority = priority;
            }
            if (req.body.due_at !== undefined) {
                if (!req.body.due_at) patch.due_at = null;
                else {
                    const d = new Date(req.body.due_at);
                    patch.due_at = Number.isNaN(d.getTime()) ? null : d;
                }
            }
            if (req.body.related_type !== undefined || req.body.related_id !== undefined) {
                const { related_type, related_id } = parseRelated({
                    related_type: req.body.related_type ?? row.dataValues.related_type,
                    related_id: req.body.related_id ?? row.dataValues.related_id,
                });
                if (related_type === "lead" && related_id) {
                    const ok = await CrmLead.findOne({ where: { agency_uuid: a.agencyUuid, uuid: related_id }, attributes: ["id"] });
                    if (!ok) return returnHelper(res, 200, false, "Linked lead not found");
                }
                if (related_type === "case" && related_id) {
                    const ok = await AgencyLeads.findOne({ where: { agent_uuid: a.agencyUuid, id: Number(related_id) }, attributes: ["id"] });
                    if (!ok) return returnHelper(res, 200, false, "Linked case not found");
                }
                patch.related_type = related_type;
                patch.related_id = related_id;
            }

            let reassigned = false;
            if (req.body.assignee_id !== undefined) {
                const assignee_id = Number(req.body.assignee_id);
                if (!assignee_id || !canSetAssignee(req, assignee_id)) {
                    return returnHelper(res, 200, false, "You cannot assign to that person");
                }
                if (assignee_id !== Number(row.dataValues.assignee_id)) {
                    patch.assignee_id = assignee_id;
                    reassigned = true;
                }
            }

            await row.update(patch);

            if (reassigned && patch.assignee_id !== a.userId) {
                notifyLater({
                    agencyUuid: a.agencyUuid,
                    recipientIds: [patch.assignee_id],
                    type: "task_assigned",
                    title: "Task assigned to you",
                    body: row.dataValues.title,
                    link: `/crm/tasks?task=${row.dataValues.id}`,
                    skipUserId: a.userId,
                    email: true,
                });
            }

            const names = await loadNames([row.dataValues.assignee_id, row.dataValues.created_by]);
            const task = serialize(row, names);
            task.related_label = await resolveRelatedLabel(a.agencyUuid, task.related_type, task.related_id);
            return returnHelper(res, 200, true, "Task updated", { task });
        } catch (error: any) {
            console.error("task update failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // POST /crm/tasks/:id/status  { status }
    async setStatus(req: RequestWithUser, res: Response) {
        try {
            const id = Number(req.params.id);
            const status = String(req.body.status || "");
            if (!(STATUSES as readonly string[]).includes(status)) {
                return returnHelper(res, 200, false, "Invalid status");
            }
            const row: any = await AgencyTask.findOne({ where: { id, ...taskScope(req) } });
            if (!row) return returnHelper(res, 200, false, "Task not found");
            if (!canEditTask(req, row.dataValues)) return returnHelper(res, 200, false, "You cannot update this task");

            await row.update({
                status,
                completed_at: status === "done" ? (row.dataValues.completed_at || new Date()) : null,
            });

            const names = await loadNames([row.dataValues.assignee_id, row.dataValues.created_by]);
            return returnHelper(res, 200, true, "Status updated", { task: serialize(row, names) });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // POST /crm/tasks/:id/delete
    async remove(req: RequestWithUser, res: Response) {
        try {
            const id = Number(req.params.id);
            const row: any = await AgencyTask.findOne({ where: { id, ...taskScope(req) } });
            if (!row) return returnHelper(res, 200, false, "Task not found");
            if (!canDeleteTask(req, row.dataValues)) return returnHelper(res, 200, false, "You cannot delete this task");
            await row.destroy();
            return returnHelper(res, 200, true, "Task deleted");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }
}

export default new TaskController();
