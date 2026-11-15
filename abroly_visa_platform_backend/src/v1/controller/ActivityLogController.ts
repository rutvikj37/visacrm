import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf } from "../../helpers/access";
import ActivityLog from "../../model/ActivityLog";
import ClientInvoice from "../../model/ClientInvoice";
import { branchFilter } from "../../services/branches";

const present = (r: any) => {
    const d = r.dataValues || r;
    return { id: d.id, entity: d.entity, entity_id: d.entity_id, action: d.action, summary: d.summary, actor_type: d.actor_type, actor_name: d.actor_name, at: d.createdAt, meta: r.get ? r.get("meta") : d.meta };
};

/** History of one visa case: its own changes plus its invoices and payments. Access is checked by the caller. */
export const caseHistory = async (agencyUuid: string, caseId: number) => {
    const invoices: any[] = await ClientInvoice.findAll({ where: { agency_uuid: agencyUuid, case_id: caseId }, attributes: ["id"], paranoid: false, raw: true });
    const rows = await ActivityLog.findAll({
        where: {
            agency_uuid: agencyUuid,
            [Op.or]: [{ entity: "case", entity_id: caseId }, ...(invoices.length ? [{ entity: "invoice", entity_id: invoices.map((i) => i.id) }] : [])],
        },
        order: [["id", "DESC"]], limit: 200,
    });
    return rows.map(present);
};

export const invoiceHistory = async (agencyUuid: string, invoiceId: number) =>
    (await ActivityLog.findAll({ where: { agency_uuid: agencyUuid, entity: "invoice", entity_id: invoiceId }, order: [["id", "DESC"]], limit: 100 })).map(present);

class ActivityLogController {
    // GET /crm/activity_log?entity=&actor=&q=&from=&to=&page=&branch=  - owner (all) and branch managers (their branch / people)
    async list(req: RequestWithUser, res: Response) {
        try {
            const a = accessOf(req);
            if (!a.isManager) return returnHelper(res, 200, false, "Only the owner or a branch manager can see the activity log");
            const where: any = { agency_uuid: a.agencyUuid, ...branchFilter(req) };
            if (!a.isOwner && !a.seesAll) where[Op.and] = [{ [Op.or]: [{ branch_id: a.branchId }, { actor_id: { [Op.in]: a.memberIds }, actor_type: "staff" }] }];
            const entity = String(req.query.entity || "");
            if (["case", "invoice", "lead", "team", "settings"].includes(entity)) where.entity = entity;
            if (req.query.actor) where.actor_id = Number(req.query.actor) || 0;
            const q = String(req.query.q || "").trim().slice(0, 80);
            if (q) where.summary = { [Op.like]: `%${q.replace(/[\\%_]/g, "\\$&")}%` };
            const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || "")) ? new Date(`${req.query.from}T00:00:00`) : null;
            const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || "")) ? new Date(`${req.query.to}T23:59:59`) : null;
            if (from || to) where.createdAt = { ...(from && { [Op.gte]: from }), ...(to && { [Op.lte]: to }) };
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = 50;
            const { rows, count } = await ActivityLog.findAndCountAll({ where, order: [["id", "DESC"]], limit, offset: (page - 1) * limit });
            const people = await ActivityLog.findAll({
                where: { agency_uuid: a.agencyUuid, actor_type: "staff" }, attributes: ["actor_id", "actor_name"], group: ["actor_id", "actor_name"], raw: true,
            });
            return returnHelper(res, 200, true, "Activity log", { entries: rows.map(present), total: count, page, pages: Math.ceil(count / limit), people });
        } catch (error) {
            console.error("activity log failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new ActivityLogController();
