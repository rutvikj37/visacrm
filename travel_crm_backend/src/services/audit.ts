import ActivityLog from "../model/ActivityLog";
import Agent from "../model/Agent";
import { RequestWithUser } from "../utils/types";

/**
 * Record who changed what. Never throws and never slows the request down: failures are only logged.
 *   audit(req, { entity: "case", entityId: 12, action: "stage", summary: "Stage: Documents → Application" })
 */
export type AuditEntry = {
    entity: "case" | "invoice" | "lead" | "team" | "settings" | "booking" | "quote" | "traveller";
    entityId?: number | null;
    action: string;
    summary: string;
    meta?: Record<string, any> | null;
    branchId?: number | null;
    agencyUuid?: string; // when it can not be read from the request (students, webhooks)
    actor?: { type: "staff" | "student" | "system"; id?: number | null; name?: string | null };
};

const names = new Map<number, { name: string; at: number }>();
const staffName = async (id: number) => {
    const hit = names.get(id);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.name;
    const a: any = await Agent.findOne({ where: { id }, attributes: ["username"], raw: true });
    const name = a?.username || "Team member";
    names.set(id, { name, at: Date.now() });
    return name;
};

export const audit = (req: RequestWithUser | null, e: AuditEntry) => {
    (async () => {
        const u: any = req?.user?.user || {};
        const agencyUuid = e.agencyUuid || u.agent_uuid;
        if (!agencyUuid) return;
        let actor = e.actor;
        if (!actor) actor = u.id && u.agent_uuid ? { type: "staff", id: Number(u.id) } : { type: "system", id: null };
        const actorName = actor.name || (actor.type === "staff" && actor.id ? await staffName(actor.id) : actor.type === "student" ? "Student" : "System");
        await ActivityLog.create({
            agency_uuid: agencyUuid, entity: e.entity, entity_id: e.entityId ?? null, action: e.action,
            summary: String(e.summary).slice(0, 500), meta: e.meta || null, branch_id: e.branchId ?? null,
            actor_type: actor.type, actor_id: actor.id ?? null, actor_name: actorName,
        });
    })().catch((error) => console.error("audit failed", e.action, error?.message));
};
