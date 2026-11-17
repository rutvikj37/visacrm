import { Response } from "express";
import { Op, Sequelize } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, caseScope } from "../../helpers/access";
import { branchFilter } from "../../services/branches";
import AgencyLeads from "../../model/AgencyLeads";
import Agent from "../../model/Agent";
import User from "../../model/User";
import PortalChatMessage from "../../model/PortalChatMessage";
import { notifyLater } from "../../services/notifications";

const MAX_BODY = 4000;

const cleanBody = (raw: any) => String(raw || "").trim().slice(0, MAX_BODY);

/** Students in the agent's case scope (assigned counsellor / branch / owner). */
const scopedStudentIds = async (req: RequestWithUser): Promise<number[]> => {
    const where: any = { ...caseScope(req), ...branchFilter(req, "branch_id") };
    const rows: any[] = await AgencyLeads.findAll({
        where,
        attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("user_id")), "user_id"]],
        raw: true,
    });
    return rows.map((r) => Number(r.user_id)).filter(Boolean);
};

const assigneeForStudent = async (agencyUuid: string, studentId: number) => {
    const open: any = await AgencyLeads.findOne({
        where: {
            agent_uuid: agencyUuid,
            user_id: studentId,
            status: { [Op.in]: ["visa_progress", "application_progress", "assign_to_agent", "accepted"] },
            assign_id: { [Op.ne]: null },
        },
        order: [["updatedAt", "DESC"]],
        attributes: ["assign_id"],
    });
    if (open?.dataValues?.assign_id) {
        const a: any = await Agent.findByPk(open.dataValues.assign_id, { attributes: ["id", "username"] });
        if (a) return { id: a.dataValues.id, name: a.dataValues.username || "Counsellor" };
    }
    const anyCase: any = await AgencyLeads.findOne({
        where: { agent_uuid: agencyUuid, user_id: studentId, assign_id: { [Op.ne]: null } },
        order: [["updatedAt", "DESC"]],
        attributes: ["assign_id"],
    });
    if (anyCase?.dataValues?.assign_id) {
        const a: any = await Agent.findByPk(anyCase.dataValues.assign_id, { attributes: ["id", "username"] });
        if (a) return { id: a.dataValues.id, name: a.dataValues.username || "Counsellor" };
    }
    const owner: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["id", "username", "app_name"],
    });
    if (owner) return { id: owner.dataValues.id, name: owner.dataValues.username || owner.dataValues.app_name || "Agency" };
    return null;
};

const markRead = async (agencyUuid: string, studentId: number, reader: "student" | "agent") => {
    const other = reader === "student" ? "agent" : "student";
    await PortalChatMessage.update(
        { read_at: new Date() },
        {
            where: {
                agency_uuid: agencyUuid,
                student_id: studentId,
                sender_type: other,
                read_at: null,
            },
        },
    );
};

class PortalChatController {
    // GET /crm/portal_chats
    async agentList(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const filter = String(req.query.filter || "all"); // all | unread | mine
            const q = String(req.query.q || "").trim().toLowerCase();
            let studentIds = await scopedStudentIds(req);
            if (!studentIds.length) return returnHelper(res, 200, true, "Chats", { conversations: [], unread_chats: 0 });

            if (filter === "mine" && !a.isOwner) {
                const mine: any[] = await AgencyLeads.findAll({
                    where: { agent_uuid: a.agencyUuid, assign_id: a.userId, user_id: studentIds },
                    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("user_id")), "user_id"]],
                    raw: true,
                });
                studentIds = mine.map((r) => Number(r.user_id)).filter(Boolean);
            }

            const lastRows: any[] = await PortalChatMessage.findAll({
                attributes: ["student_id", [Sequelize.fn("MAX", Sequelize.col("id")), "last_id"]],
                where: { agency_uuid: a.agencyUuid, student_id: studentIds },
                group: ["student_id"],
                raw: true,
            });
            const lastIdByStudent = new Map(lastRows.map((r) => [Number(r.student_id), Number(r.last_id)]));

            const unreadRows: any[] = await PortalChatMessage.findAll({
                attributes: ["student_id", [Sequelize.fn("COUNT", Sequelize.col("id")), "n"]],
                where: {
                    agency_uuid: a.agencyUuid,
                    student_id: studentIds,
                    sender_type: "student",
                    read_at: null,
                },
                group: ["student_id"],
                raw: true,
            });
            const unreadByStudent = new Map(unreadRows.map((r) => [Number(r.student_id), Number(r.n)]));

            const students: any[] = await User.findAll({
                where: { id: studentIds, agency_uuid: a.agencyUuid },
                attributes: ["id", "uuid", "username", "phone_number", "country_code"],
            });

            const lastMsgs = lastIdByStudent.size
                ? await PortalChatMessage.findAll({ where: { id: [...lastIdByStudent.values()] } })
                : [];
            const lastById = new Map(lastMsgs.map((m: any) => [m.dataValues.id, m.dataValues]));

            let list = students.map((s: any) => {
                const d = s.dataValues;
                const lastId = lastIdByStudent.get(d.id);
                const last = lastId ? lastById.get(lastId) : null;
                const unread = unreadByStudent.get(d.id) || 0;
                return {
                    student_id: d.id,
                    uuid: String(d.id), // ChatInbox uses uuid as key; keep numeric string
                    name: d.username || "Student",
                    phone: d.phone_number ? `${d.country_code || ""} ${d.phone_number}`.trim() : null,
                    last_message: last?.body || "No messages yet — say hello",
                    last_direction: last ? (last.sender_type === "agent" ? "out" : "in") : null,
                    last_at: last?.createdAt || null,
                    unread,
                };
            });

            if (filter === "unread") list = list.filter((c) => c.unread > 0);
            if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q) || (c.last_message || "").toLowerCase().includes(q));

            list.sort((x, y) => {
                const tx = x.last_at ? new Date(x.last_at).getTime() : 0;
                const ty = y.last_at ? new Date(y.last_at).getTime() : 0;
                return ty - tx || x.name.localeCompare(y.name);
            });

            const unread_chats = list.filter((c) => c.unread > 0).length;
            const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25));
            const totalItems = list.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / limit));
            const safePage = Math.min(page, totalPages);
            const start = (safePage - 1) * limit;
            return returnHelper(res, 200, true, "Chats", {
                conversations: list.slice(start, start + limit),
                unread_chats,
                pagination: { currentPage: safePage, totalPages, totalItems, itemsPerPage: limit },
            });
        } catch (error: any) {
            console.error("portal chat list failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // GET /crm/portal_chats/unread
    async agentUnread(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const studentIds = await scopedStudentIds(req);
            if (!studentIds.length) return returnHelper(res, 200, true, "Unread", { unread_chats: 0 });
            const rows: any[] = await PortalChatMessage.findAll({
                attributes: ["student_id"],
                where: { agency_uuid: a.agencyUuid, student_id: studentIds, sender_type: "student", read_at: null },
                group: ["student_id"],
                raw: true,
            });
            return returnHelper(res, 200, true, "Unread", { unread_chats: rows.length });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // GET /crm/portal_chats/:studentId
    async agentThread(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const studentId = Number(req.params.studentId);
            if (!studentId) return returnHelper(res, 200, false, "Student not found");
            const allowed = await scopedStudentIds(req);
            if (!allowed.includes(studentId)) return returnHelper(res, 200, false, "Student not found");

            const student: any = await User.findOne({
                where: { id: studentId, agency_uuid: a.agencyUuid },
                attributes: ["id", "username", "phone_number", "country_code"],
            });
            if (!student) return returnHelper(res, 200, false, "Student not found");

            await markRead(a.agencyUuid, studentId, "agent");

            const rows: any[] = await PortalChatMessage.findAll({
                where: { agency_uuid: a.agencyUuid, student_id: studentId },
                order: [["id", "ASC"]],
                limit: 500,
            });

            const agentIds = [...new Set(rows.filter((r) => r.dataValues.sender_type === "agent").map((r) => r.dataValues.sender_id))];
            const agents = agentIds.length
                ? await Agent.findAll({ where: { id: agentIds }, attributes: ["id", "username"] })
                : [];
            const nameOf = new Map(agents.map((x: any) => [x.dataValues.id, x.dataValues.username || "Team"]));
            const assignee = await assigneeForStudent(a.agencyUuid, studentId);

            const messages = rows.map((r: any) => {
                const d = r.dataValues;
                const mine = d.sender_type === "agent";
                return {
                    id: d.id,
                    direction: mine ? "out" : "in",
                    text: d.body,
                    at: d.createdAt,
                    by: mine ? (nameOf.get(d.sender_id) || "Team") : null,
                };
            });

            return returnHelper(res, 200, true, "Thread", {
                student: {
                    id: student.dataValues.id,
                    name: student.dataValues.username || "Student",
                    phone: student.dataValues.phone_number
                        ? `${student.dataValues.country_code || ""} ${student.dataValues.phone_number}`.trim()
                        : null,
                },
                assignee,
                messages,
            });
        } catch (error: any) {
            console.error("portal chat thread failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // POST /crm/portal_chats/:studentId/send  { message }
    async agentSend(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            const studentId = Number(req.params.studentId);
            const body = cleanBody(req.body?.message);
            if (!studentId) return returnHelper(res, 200, false, "Student not found");
            if (!body) return returnHelper(res, 200, false, "Type a message");
            const allowed = await scopedStudentIds(req);
            if (!allowed.includes(studentId)) return returnHelper(res, 200, false, "Student not found");

            const row: any = await PortalChatMessage.create({
                agency_uuid: a.agencyUuid,
                student_id: studentId,
                sender_type: "agent",
                sender_id: a.userId,
                body,
            });

            return returnHelper(res, 200, true, "Sent", {
                id: row.dataValues.id,
                direction: "out",
                text: body,
                at: row.dataValues.createdAt,
            });
        } catch (error: any) {
            console.error("portal chat send failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // ---- student ----

    // GET /student/chat
    async studentThread(req: RequestWithUser, res: Response) {
        try {
            const u: any = req.user?.user || {};
            const studentId = Number(u.id);
            const agencyUuid = String(u.agency_uuid || "");
            if (!studentId || !agencyUuid) return returnHelper(res, 200, false, "Not linked to an agency");

            await markRead(agencyUuid, studentId, "student");
            const assignee = await assigneeForStudent(agencyUuid, studentId);

            const rows: any[] = await PortalChatMessage.findAll({
                where: { agency_uuid: agencyUuid, student_id: studentId },
                order: [["id", "ASC"]],
                limit: 500,
            });
            const agentIds = [...new Set(rows.filter((r) => r.dataValues.sender_type === "agent").map((r) => r.dataValues.sender_id))];
            const agents = agentIds.length
                ? await Agent.findAll({ where: { id: agentIds }, attributes: ["id", "username"] })
                : [];
            const nameOf = new Map(agents.map((x: any) => [x.dataValues.id, x.dataValues.username || "Counsellor"]));

            const messages = rows.map((r: any) => {
                const d = r.dataValues;
                const mine = d.sender_type === "student";
                return {
                    id: d.id,
                    direction: mine ? "out" : "in",
                    text: d.body,
                    at: d.createdAt,
                    by: mine ? null : (nameOf.get(d.sender_id) || assignee?.name || "Counsellor"),
                };
            });

            const unread = await PortalChatMessage.count({
                where: { agency_uuid: agencyUuid, student_id: studentId, sender_type: "agent", read_at: null },
            });

            return returnHelper(res, 200, true, "Chat", {
                assignee,
                messages,
                unread,
            });
        } catch (error: any) {
            console.error("student chat failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // POST /student/chat/send  { message }
    async studentSend(req: RequestWithUser, res: Response) {
        try {
            const u: any = req.user?.user || {};
            const studentId = Number(u.id);
            const agencyUuid = String(u.agency_uuid || "");
            const body = cleanBody(req.body?.message);
            if (!studentId || !agencyUuid) return returnHelper(res, 200, false, "Not linked to an agency");
            if (!body) return returnHelper(res, 200, false, "Type a message");

            const row: any = await PortalChatMessage.create({
                agency_uuid: agencyUuid,
                student_id: studentId,
                sender_type: "student",
                sender_id: studentId,
                body,
            });

            const assignee = await assigneeForStudent(agencyUuid, studentId);
            if (assignee?.id) {
                notifyLater({
                    agencyUuid,
                    recipientIds: [assignee.id],
                    type: "portal_chat",
                    title: `${u.username || "Student"} sent a message`,
                    body: body.slice(0, 120),
                    link: `/crm/chats?chat=${studentId}`,
                });
            }

            return returnHelper(res, 200, true, "Sent", {
                id: row.dataValues.id,
                direction: "out",
                text: body,
                at: row.dataValues.createdAt,
            });
        } catch (error: any) {
            console.error("student chat send failed", error);
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }

    // GET /student/chat/unread
    async studentUnread(req: RequestWithUser, res: Response) {
        try {
            const u: any = req.user?.user || {};
            const studentId = Number(u.id);
            const agencyUuid = String(u.agency_uuid || "");
            if (!studentId || !agencyUuid) return returnHelper(res, 200, true, "Unread", { unread: 0 });
            const unread = await PortalChatMessage.count({
                where: { agency_uuid: agencyUuid, student_id: studentId, sender_type: "agent", read_at: null },
            });
            return returnHelper(res, 200, true, "Unread", { unread });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message || "Failed");
        }
    }
}

export default new PortalChatController();
