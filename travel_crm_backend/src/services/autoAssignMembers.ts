/**
 * Agency-owner allowlist for who receives auto-assigned leads.
 * Stored on the agency Agent row as JSON text (`crm_auto_assign_member_ids`).
 * null / [] = every active counsellor and branch manager (legacy behaviour).
 */

/** Parse the owner's allowlist. null = no restriction. */
export const readAutoAssignMemberIds = (raw: any): number[] | null => {
    if (raw === null || raw === undefined || raw === "") return null;
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return null;
        const ids = parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
        return ids.length ? ids : null;
    } catch {
        return null;
    }
};

/** Keep only allowlisted members when the owner picked a subset; empty/null allowlist = unchanged. */
export const filterAutoAssignTeam = <T extends { dataValues?: { id?: number }; id?: number }>(
    team: T[],
    allowIds: number[] | null,
): T[] => {
    if (!allowIds || !allowIds.length) return team;
    const allowed = new Set(allowIds);
    return team.filter((member) => {
        const id = Number(member?.dataValues?.id ?? member?.id);
        return allowed.has(id);
    });
};
