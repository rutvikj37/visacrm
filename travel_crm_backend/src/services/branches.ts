import { QueryTypes } from "sequelize";
import sequelize from "../config/dbconfig";
import Agent from "../model/Agent";
import AgencyBranch from "../model/AgencyBranch";
import LeadIntegration from "../model/LeadIntegration";
import { RequestWithUser } from "../utils/types";
import { accessOf } from "../helpers/access";
import { filterAutoAssignTeam, readAutoAssignMemberIds } from "./autoAssignMembers";

/**
 * Multi-branch rules.
 *
 * Which branch gets a new lead (first match wins):
 *   1. the lead source is tied to a branch (a branch's own website form, WhatsApp number, Facebook Page ...)
 *   2. the lead's city matches a branch (its city or its "routing cities")
 *   3. the person it is assigned to belongs to a branch
 *   otherwise the lead has no branch (head office) until someone assigns or transfers it.
 *
 * Auto-assign rotates inside the lead's branch when that branch has counsellors, else across the agency.
 * Assigning work to someone of another branch moves it to that branch.
 */

const norm = (v: any) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const branchOfAgent = async (agentId?: number | null): Promise<number | null> => {
    if (!agentId) return null;
    const agent: any = await Agent.findByPk(agentId, { attributes: ["branch_id"] });
    return agent?.dataValues?.branch_id || null;
};

export const isAgencyBranch = async (agencyUuid: string, branchId: number) =>
    Boolean(branchId && (await AgencyBranch.findOne({ where: { id: branchId, agency_uuid: agencyUuid }, attributes: ["id"] })));

/** Branch for a new lead from its source and city (steps 1 and 2 above). */
export const resolveLeadBranch = async (agencyUuid: string, opts: { integrationId?: number | null; city?: string | null }): Promise<number | null> => {
    if (opts.integrationId) {
        const integration: any = await LeadIntegration.findByPk(opts.integrationId, { attributes: ["branch_id", "agency_uuid"] });
        const id = integration?.dataValues?.agency_uuid === agencyUuid ? integration.dataValues.branch_id : null;
        if (id && (await isAgencyBranch(agencyUuid, id))) return id;
    }
    const city = norm(opts.city);
    if (!city) return null;
    const branches: any[] = await AgencyBranch.findAll({ where: { agency_uuid: agencyUuid }, attributes: ["id", "city", "routing_cities"], order: [["id", "ASC"]] });
    for (const b of branches) {
        const cities = [b.dataValues.city, ...(Array.isArray(b.get("routing_cities")) ? b.get("routing_cities") : [])].map(norm).filter(Boolean);
        // "Surat" matches "surat", "Surat, Gujarat" and "Adajan Surat"
        if (cities.some((c) => city === c || ` ${city} `.includes(` ${c} `))) return b.dataValues.id;
    }
    return null;
};

/** Next counsellor / branch manager of a branch (round robin). Null when the branch has nobody to take leads. */
export const pickBranchAssignee = async (agencyUuid: string, branchId: number): Promise<number | null> => {
    const branch: any = await AgencyBranch.findOne({ where: { id: branchId, agency_uuid: agencyUuid }, attributes: ["id", "last_assigned_id"] });
    if (!branch) return null;
    const agency: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["crm_auto_assign_member_ids"],
    });
    const allEligible: any[] = await Agent.findAll({
        where: { parent_uuid: agencyUuid, status: "active", branch_id: branchId, team_role: ["counsellor", "branch_manager"] },
        attributes: ["id"], order: [["id", "ASC"]],
    });
    const team = filterAutoAssignTeam(allEligible, readAutoAssignMemberIds(agency?.dataValues?.crm_auto_assign_member_ids));
    if (!team.length) return null;
    const lastId = Number(branch.dataValues.last_assigned_id) || 0;
    const next = team.find((m) => m.dataValues.id > lastId) || team[0];
    await AgencyBranch.update({ last_assigned_id: next.dataValues.id }, { where: { id: branchId } });
    return next.dataValues.id;
};

/**
 * ?branch= filter for people who see the whole agency (owner, accounts, managers without a branch).
 * "none" = work that is in no branch. People limited to a branch are already scoped, so it is ignored for them.
 */
export const branchFilter = (req: RequestWithUser, column = "branch_id"): Record<string, any> => {
    const a = accessOf(req);
    const raw = String(req.query.branch || "").trim();
    if (!raw || !(a.isOwner || a.seesAll || a.teamRole === "accounts")) return {};
    if (raw === "none") return { [column]: null };
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? { [column]: id } : {};
};

/** Same filter as a raw id for hand-written SQL: undefined = no filter, null = "none", number = branch. */
export const branchFilterValue = (req: RequestWithUser): number | null | undefined => {
    const f = branchFilter(req);
    return "branch_id" in f ? f.branch_id : undefined;
};

/** Branch names by id for an agency (to label rows). */
export const branchNames = async (agencyUuid: string): Promise<Record<number, string>> => {
    const rows: any[] = await AgencyBranch.findAll({ where: { agency_uuid: agencyUuid }, attributes: ["id", "name"], raw: true });
    return Object.fromEntries(rows.map((r) => [r.id, r.name]));
};

/**
 * One-time fill for data created before branches carried work: a lead / case without a branch takes the
 * branch of the person handling it, an invoice takes its case's branch. Safe to run again.
 */
export const backfillBranches = async () => {
    const run = (sql: string) => sequelize.query(sql, { type: QueryTypes.UPDATE });
    await run(`UPDATE crm_leads l JOIN agent a ON a.id = l.assigned_to SET l.branch_id = a.branch_id
               WHERE l.branch_id IS NULL AND a.branch_id IS NOT NULL AND l.deletedAt IS NULL`);
    await run(`UPDATE agency_leads c JOIN agent a ON a.id = c.assign_id SET c.branch_id = a.branch_id
               WHERE c.branch_id IS NULL AND a.branch_id IS NOT NULL AND c.deletedAt IS NULL`);
    await run(`UPDATE client_invoices i JOIN agency_leads c ON c.id = i.case_id SET i.branch_id = c.branch_id
               WHERE i.branch_id IS NULL AND c.branch_id IS NOT NULL`);
};

