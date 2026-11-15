import { Response } from "express";
import { audit } from "../../services/audit";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Agent from "../../model/Agent";
import AgencyBranch from "../../model/AgencyBranch";
import { TEAM_ROLES, TEAM_ROLE_LABELS } from "../../helpers/access";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/dbconfig";
import LeadIntegration from "../../model/LeadIntegration";
import { isAgencyBranch } from "../../services/branches";

const BRANCH_FIELDS = ["id", "name", "city", "address", "phone", "email", "gstin", "invoice_prefix", "routing_cities"];

/** Branches and team roles (agency owner). */
const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, isOwner: user.role === "agent" };
};

class TeamController {
    // GET /crm/branches
    async branches(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        const rows: any[] = await AgencyBranch.findAll({ where: { agency_uuid: agencyUuid }, attributes: BRANCH_FIELDS, order: [["name", "ASC"]] });
        let branches: any[] = rows.map((r) => ({ ...r.toJSON(), routing_cities: Array.isArray(r.get("routing_cities")) ? r.get("routing_cities") : [] }));
        // ?stats=1 (owner): how much each branch holds, for the Branches page
        if (isOwner && req.query.stats === "1" && branches.length) {
            const q = (sql: string) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: { a: agencyUuid } }) as Promise<any[]>;
            const [team, leads, cases, sources] = await Promise.all([
                q("SELECT branch_id, COUNT(*) n FROM agent WHERE parent_uuid = :a AND branch_id IS NOT NULL AND deletedAt IS NULL GROUP BY branch_id"),
                q("SELECT branch_id, COUNT(*) n FROM crm_leads WHERE agency_uuid = :a AND branch_id IS NOT NULL AND deletedAt IS NULL AND status NOT IN ('converted','lost','junk') GROUP BY branch_id"),
                q("SELECT branch_id, COUNT(*) n FROM agency_leads WHERE agent_uuid = :a AND branch_id IS NOT NULL AND deletedAt IS NULL AND status = 'visa_progress' GROUP BY branch_id"),
                q("SELECT branch_id, COUNT(*) n FROM lead_integrations WHERE agency_uuid = :a AND branch_id IS NOT NULL AND deletedAt IS NULL GROUP BY branch_id"),
            ]);
            const n = (rows2: any[], id: number) => Number(rows2.find((r) => Number(r.branch_id) === id)?.n || 0);
            branches = branches.map((b) => ({ ...b, team: n(team, b.id), open_leads: n(leads, b.id), open_cases: n(cases, b.id), sources: n(sources, b.id) }));
        }
        return returnHelper(res, 200, true, "Branches", { branches, roles: TEAM_ROLES.map((key) => ({ key, label: TEAM_ROLE_LABELS[key] })) });
    }

    // GET /crm/team/members - everyone in the team with role and branch (owner)
    async members(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage the team");
        const rows = await Agent.findAll({
            where: { parent_uuid: agencyUuid },
            attributes: ["uuid", "username", "email", "phone_number", "designation", "team_role", "branch_id", "status"],
            order: [["username", "ASC"]],
        });
        return returnHelper(res, 200, true, "Team", rows);
    }

    // POST /crm/branches { id?, name, city? }  - create or rename
    async saveBranch(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage branches");
            const name = String(req.body?.name || "").trim().slice(0, 100);
            if (!name) return returnHelper(res, 200, false, "Please enter the branch name");
            const b = req.body || {};
            const text = (v: any, max: number) => (v ? String(v).trim().slice(0, max) || null : null);
            const city = text(b.city, 100);
            const gstin = String(b.gstin || "").trim().toUpperCase();
            if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) return returnHelper(res, 200, false, "GSTIN should be 15 characters, e.g. 24ABCDE1234F1Z5");
            const prefix = String(b.invoice_prefix || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10);
            const cities = (Array.isArray(b.routing_cities) ? b.routing_cities : String(b.routing_cities || "").split(","))
                .map((c: any) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50);
            // only fields that were sent are changed, so the quick "rename" form keeps the other details
            const details: Record<string, any> = { name, ...(b.city !== undefined && { city }) };
            if (b.address !== undefined) details.address = text(b.address, 1000);
            if (b.phone !== undefined) details.phone = text(b.phone, 50);
            if (b.email !== undefined) details.email = text(b.email, 255);
            if (b.gstin !== undefined) details.gstin = gstin || null;
            if (b.invoice_prefix !== undefined) details.invoice_prefix = prefix || null;
            if (b.routing_cities !== undefined) details.routing_cities = cities;
            if (prefix) {
                const clash: any = await AgencyBranch.findOne({ where: { agency_uuid: agencyUuid, invoice_prefix: prefix }, attributes: ["id"] });
                if (clash && clash.dataValues.id !== Number(b.id || 0)) return returnHelper(res, 200, false, "Another branch already uses this invoice prefix");
            }
            if (req.body?.id) {
                const [n] = await AgencyBranch.update(details, { where: { id: Number(req.body.id), agency_uuid: agencyUuid } });
                if (!n) return returnHelper(res, 200, false, "Branch not found");
                return returnHelper(res, 200, true, "Branch saved");
            }
            const count = await AgencyBranch.count({ where: { agency_uuid: agencyUuid } });
            if (count >= 50) return returnHelper(res, 200, false, "You can have up to 50 branches");
            const row = await AgencyBranch.create({ agency_uuid: agencyUuid, ...details });
            return returnHelper(res, 200, true, "Branch added", row);
        } catch (error) {
            console.error("save branch failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/branches/:id/delete
    async deleteBranch(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage branches");
            const branch: any = await AgencyBranch.findOne({ where: { id: Number(req.params.id) || 0, agency_uuid: agencyUuid } });
            if (!branch) return returnHelper(res, 200, false, "Branch not found");
            // its people, leads, cases and sources go back to "no branch"; invoices keep the branch they were billed from
            const id = branch.dataValues.id;
            await Agent.update({ branch_id: null }, { where: { parent_uuid: agencyUuid, branch_id: id } });
            await LeadIntegration.update({ branch_id: null }, { where: { agency_uuid: agencyUuid, branch_id: id } });
            await sequelize.query("UPDATE crm_leads SET branch_id = NULL WHERE agency_uuid = :a AND branch_id = :id", { replacements: { a: agencyUuid, id } });
            await sequelize.query("UPDATE agency_leads SET branch_id = NULL WHERE agent_uuid = :a AND branch_id = :id", { replacements: { a: agencyUuid, id } });
            await AgencyBranch.destroy({ where: { id } });
            return returnHelper(res, 200, true, "Branch removed. Its team, leads and cases are now without a branch.");
        } catch (error) {
            console.error("delete branch failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/team/:uuid/role { team_role, branch_id }
    async setRole(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can change roles");
            const member: any = await Agent.findOne({ where: { uuid: req.params.uuid, parent_uuid: agencyUuid }, attributes: ["id"] });
            if (!member) return returnHelper(res, 200, false, "Team member not found");
            const updates: Record<string, any> = {};
            if (req.body?.team_role !== undefined) {
                if (!(TEAM_ROLES as readonly string[]).includes(req.body.team_role)) return returnHelper(res, 200, false, "Invalid role");
                updates.team_role = req.body.team_role;
            }
            if (req.body?.branch_id !== undefined) {
                const branchId = req.body.branch_id ? Number(req.body.branch_id) : null;
                if (branchId && !(await AgencyBranch.findOne({ where: { id: branchId, agency_uuid: agencyUuid }, attributes: ["id"] }))) {
                    return returnHelper(res, 200, false, "Branch not found");
                }
                updates.branch_id = branchId;
            }
            if (!Object.keys(updates).length) return returnHelper(res, 200, false, "Nothing to change");
            await Agent.update(updates, { where: { id: member.dataValues.id } });
            const who: any = await Agent.findOne({ where: { id: member.dataValues.id }, attributes: ["username"], raw: true });
            const branchName: any = updates.branch_id ? await AgencyBranch.findByPk(updates.branch_id, { attributes: ["name"], raw: true }) : null;
            audit(req, { entity: "team", entityId: member.dataValues.id, action: "role", summary: `${who?.username || "Team member"}: ${[updates.team_role && `role ${String(updates.team_role).replace("_", " ")}`, updates.branch_id !== undefined && `branch ${branchName?.name || "none"}`].filter(Boolean).join(", ")}` });
            return returnHelper(res, 200, true, "Team member updated");
        } catch (error) {
            console.error("set role failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/integrations/:uuid/branch { branch_id | null }  - leads from this source go to this branch
    async setSourceBranch(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage lead sources");
            const branchId = req.body?.branch_id ? Number(req.body.branch_id) : null;
            if (branchId && !(await isAgencyBranch(agencyUuid, branchId))) return returnHelper(res, 200, false, "Branch not found");
            const [n] = await LeadIntegration.update({ branch_id: branchId }, { where: { uuid: req.params.uuid, agency_uuid: agencyUuid } });
            if (!n) return returnHelper(res, 200, false, "Lead source not found");
            return returnHelper(res, 200, true, branchId ? "New leads from this source will go to that branch" : "This source is no longer tied to a branch");
        } catch (error) {
            console.error("set source branch failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new TeamController();
