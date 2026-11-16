import { Op } from "sequelize";
import { RequestWithUser } from "../utils/types";

/**
 * Who can see what inside an agency.
 *
 *   owner            - everything
 *   branch_manager   - leads and cases of their branch and of its people (whole agency if no branch is set); can assign
 *   counsellor       - leads and cases assigned to them
 *   documents        - visa cases of their branch (all cases if no branch); leads assigned to them
 *   accounts         - can view all leads and cases, can not change them
 *
 * team_role / branch / visible member ids are attached to the request by authMiddleware.
 */
export const TEAM_ROLES = ["counsellor", "branch_manager", "accounts", "documents"] as const;
export type TeamRole = typeof TEAM_ROLES[number];

export const TEAM_ROLE_LABELS: Record<string, string> = {
    counsellor: "Counsellor",
    branch_manager: "Branch manager",
    accounts: "Accounts",
    documents: "Document executive",
};

export const accessOf = (req: RequestWithUser) => {
    const u: any = req.user?.user || {};
    const isOwner = u.role === "agent";
    const teamRole: TeamRole = isOwner ? "branch_manager" : (TEAM_ROLES as readonly string[]).includes(u.team_role) ? u.team_role : "counsellor";
    const userId = Number(u.id);
    const memberIds: number[] = Array.isArray(u.visible_member_ids) && u.visible_member_ids.length ? u.visible_member_ids : [userId];
    return {
        agencyUuid: u.agent_uuid as string,
        agencyId: Number(u.agent_id),
        userId,
        isOwner,
        teamRole,
        branchId: u.branch_id ? Number(u.branch_id) : null,
        memberIds,
        seesAll: isOwner || Boolean(u.sees_all),
        /** may assign / bulk-edit leads and cases */
        isManager: isOwner || u.team_role === "branch_manager",
    };
};

/** Where-clause for CRM leads (crm_leads). */
export const leadScope = (req: RequestWithUser): Record<string, any> => {
    const a = accessOf(req);
    if (a.isOwner || a.teamRole === "accounts") return { agency_uuid: a.agencyUuid };
    if (a.teamRole === "branch_manager") {
        if (a.seesAll) return { agency_uuid: a.agencyUuid };
        // their branch's leads (also unassigned ones) and anything handled by their people
        // Op.and so that callers adding their own Op.or (search) do not overwrite it
        return { agency_uuid: a.agencyUuid, [Op.and]: [{ [Op.or]: [{ branch_id: a.branchId }, { assigned_to: { [Op.in]: a.memberIds } }] }] };
    }
    return { agency_uuid: a.agencyUuid, assigned_to: a.userId };
};

/** Where-clause for visa cases (agency_leads). */
export const caseScope = (req: RequestWithUser): Record<string, any> => {
    const a = accessOf(req);
    if (a.isOwner || a.teamRole === "accounts") return { agent_uuid: a.agencyUuid };
    if (a.teamRole === "branch_manager" || a.teamRole === "documents") {
        if (a.seesAll) return { agent_uuid: a.agencyUuid };
        return { agent_uuid: a.agencyUuid, [Op.and]: [{ [Op.or]: [{ branch_id: a.branchId }, { assign_id: { [Op.in]: a.memberIds } }] }] };
    }
    return { agent_uuid: a.agencyUuid, assign_id: a.userId };
};

/** A manager may only hand work to people they can see. */
export const canAssignTo = (req: RequestWithUser, agentId: number) => {
    const a = accessOf(req);
    return a.isOwner || (a.isManager && (a.seesAll || a.memberIds.includes(agentId)));
};

/**
 * Where-clause for agency tasks.
 * Owners/accounts: all agency tasks.
 * Branch managers: tasks assigned to / created by their people (or all if seesAll).
 * Others: tasks assigned to them or created by them.
 */
export const taskScope = (req: RequestWithUser): Record<string, any> => {
    const a = accessOf(req);
    if (a.isOwner || a.teamRole === "accounts") return { agency_uuid: a.agencyUuid };
    if (a.teamRole === "branch_manager") {
        if (a.seesAll) return { agency_uuid: a.agencyUuid };
        return {
            agency_uuid: a.agencyUuid,
            [Op.and]: [{
                [Op.or]: [
                    { assignee_id: { [Op.in]: a.memberIds } },
                    { created_by: { [Op.in]: a.memberIds } },
                ],
            }],
        };
    }
    return {
        agency_uuid: a.agencyUuid,
        [Op.and]: [{
            [Op.or]: [
                { assignee_id: a.userId },
                { created_by: a.userId },
            ],
        }],
    };
};
