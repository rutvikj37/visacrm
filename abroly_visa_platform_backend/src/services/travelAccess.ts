import { NextFunction, Response } from "express";
import Agent from "../model/Agent";
import { accessOf } from "../helpers/access";
import { RequestWithUser } from "../utils/types";
import { modulesFor } from "./modules";

/**
 * Agency travel settings and the role permission matrix (BRD section 4 "Permission rules").
 * Stored in agent.ui_prefs.travel of the agency owner:
 *   { lead_stages: { [status]: { label, hidden } }, destination_rules: [{ match, agent_id }],
 *     discount_approval_pct, permissions: { [role]: { [module]: { view, create, edit, delete, export }, see_cost } } }
 * Defaults below reproduce how the CRM behaved before the matrix, so nothing changes until the owner edits it.
 */

export const PERM_MODULES = ["itinerary", "bookings", "suppliers", "reports"] as const;
export type PermModule = typeof PERM_MODULES[number];
export const PERM_ACTIONS = ["view", "create", "edit", "delete", "export"] as const;
export type PermAction = typeof PERM_ACTIONS[number];
export const PERM_ROLES = ["branch_manager", "counsellor", "operations", "accounts", "documents"] as const;
type RolePerms = { [m in PermModule]: { [a in PermAction]: boolean } } & { see_cost: boolean };

const row = (v: string) => ({ view: v.includes("v"), create: v.includes("c"), edit: v.includes("e"), delete: v.includes("d"), export: v.includes("x") });
export const DEFAULT_PERMISSIONS: Record<string, RolePerms> = {
    branch_manager: { itinerary: row("vcedx"), bookings: row("vcedx"), suppliers: row("vcedx"), reports: row("vx"), see_cost: true },
    counsellor: { itinerary: row("vce"), bookings: row("v"), suppliers: row("v"), reports: row(""), see_cost: false },
    operations: { itinerary: row("v"), bookings: row("vce"), suppliers: row("vce"), reports: row(""), see_cost: false },
    accounts: { itinerary: row("v"), bookings: row("ve"), suppliers: row("ve"), reports: row("vx"), see_cost: true },
    documents: { itinerary: row("v"), bookings: row("v"), suppliers: row(""), reports: row(""), see_cost: false },
};

export const LEAD_STAGE_KEYS = ["new", "contacted", "follow_up", "interested", "counselling", "converted", "lost", "junk"];
/** Travel agencies get the BRD stage names by default: New, Contacted, Quoted, Negotiation, Confirmed, Lost. */
const TRAVEL_STAGE_LABELS: Record<string, string> = { interested: "Quoted", counselling: "Negotiation", converted: "Confirmed" };

const readPrefs = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(String(raw)) || {}; } catch { return {}; }
};

const clean = (raw: any) => {
    const t = raw && typeof raw === "object" ? raw : {};
    const stages: Record<string, { label: string; hidden: boolean }> = {};
    for (const k of LEAD_STAGE_KEYS) {
        const s = t.lead_stages?.[k];
        if (!s) continue;
        const label = String(s.label || "").trim().slice(0, 30);
        // converted / new can be renamed but never hidden - the flows depend on them
        stages[k] = { label, hidden: Boolean(s.hidden) && !["new", "converted"].includes(k) };
    }
    const rules = (Array.isArray(t.destination_rules) ? t.destination_rules : []).slice(0, 50)
        .map((r: any) => ({ match: String(r?.match || "").trim().toLowerCase().slice(0, 60), agent_id: Number(r?.agent_id) || null }))
        .filter((r: any) => r.match && r.agent_id);
    const pct = Number(t.discount_approval_pct);
    const permissions: Record<string, RolePerms> = {};
    for (const role of PERM_ROLES) {
        const base = DEFAULT_PERMISSIONS[role];
        const given = t.permissions?.[role] || {};
        const out: any = { see_cost: given.see_cost === undefined ? base.see_cost : Boolean(given.see_cost) };
        for (const m of PERM_MODULES) {
            out[m] = {};
            for (const a of PERM_ACTIONS) out[m][a] = given[m]?.[a] === undefined ? base[m][a] : Boolean(given[m][a]);
            // can not do anything in a module without seeing it
            if (!out[m].view) for (const a of PERM_ACTIONS) out[m][a] = false;
        }
        permissions[role] = out;
    }
    return { lead_stages: stages, destination_rules: rules, discount_approval_pct: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 10, permissions };
};
export type TravelSettings = ReturnType<typeof clean>;

const cache = new Map<string, { at: number; value: TravelSettings }>();

export const travelSettingsFor = async (agencyUuid: string): Promise<TravelSettings> => {
    const hit = cache.get(agencyUuid);
    if (hit && Date.now() - hit.at < 60_000) return hit.value;
    const ag: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["ui_prefs"], raw: true });
    const value = clean(readPrefs(ag?.ui_prefs).travel);
    cache.set(agencyUuid, { at: Date.now(), value });
    return value;
};

export const saveTravelSettings = async (agencyUuid: string, patch: any) => {
    const ag: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "ui_prefs"] });
    const prefs = readPrefs(ag?.dataValues?.ui_prefs);
    const current = clean(prefs.travel);
    const next = clean({ ...current, ...patch });
    prefs.travel = next;
    await Agent.update({ ui_prefs: JSON.stringify(prefs) }, { where: { id: ag.dataValues.id } });
    cache.delete(agencyUuid);
    return next;
};

/** Stage names the panels show: agency edits, else travel defaults for travel agencies. */
export const leadStagesFor = async (agencyUuid: string) => {
    const [settings, mods] = await Promise.all([travelSettingsFor(agencyUuid), modulesFor(agencyUuid)]);
    return LEAD_STAGE_KEYS.map((key) => {
        const s = settings.lead_stages[key];
        const fallback = mods.crmType === "travel" ? TRAVEL_STAGE_LABELS[key] : undefined;
        return { key, label: s?.label || fallback || null, hidden: Boolean(s?.hidden) };
    });
};

/** Team member a new lead goes to by destination ("dubai" → Priya), or null. */
export const destinationAssignee = async (agencyUuid: string, destinations: any) => {
    const list = (Array.isArray(destinations) ? destinations : []).map((d: any) => String(d).toLowerCase());
    if (!list.length) return null;
    const { destination_rules } = await travelSettingsFor(agencyUuid);
    const rule = destination_rules.find((r) => list.some((d) => d.includes(r.match)));
    return rule?.agent_id || null;
};

// ---------------------------------------------------------------- permission checks

export const permsOf = async (req: RequestWithUser): Promise<RolePerms | "owner"> => {
    const a = accessOf(req);
    if (a.isOwner) return "owner";
    const settings = await travelSettingsFor(a.agencyUuid);
    return settings.permissions[a.teamRole] || DEFAULT_PERMISSIONS.counsellor;
};

export const can = async (req: RequestWithUser, module: PermModule, action: PermAction) => {
    const p = await permsOf(req);
    return p === "owner" || Boolean(p[module]?.[action]);
};

/** Which module and action a /travel request needs. */
export const travelPermFor = (method: string, path: string): { module: PermModule; action: PermAction } | null => {
    const p = path.split("?")[0].replace(/^\/api\/v1\/travel/, "");
    let module: PermModule | null = null;
    if (/^\/(library|itineraries|quotes|packages|pipeline|media)(\/|$)/.test(p)) module = "itinerary";
    else if (/^\/(bookings|clients|credit_notes)(\/|$)/.test(p)) module = "bookings";
    else if (/^\/suppliers(\/|$)/.test(p)) module = "suppliers";
    else if (/^\/(reports|targets)(\/|$)/.test(p)) module = "reports";
    if (!module) return null;
    let action: PermAction = "view";
    if (/\/export(\/|$)/.test(p) || /\/(pdf|vouchers\.pdf)$/.test(p)) action = /\/export/.test(p) ? "export" : "view";
    else if (method === "GET") action = /\/reveal$/.test(p) ? "edit" : "view";
    else if (/\/delete$/.test(p)) action = "delete";
    else if (/^\/settings$/.test(p)) return null;
    else if (/^\/whatsapp\//.test(p)) return null;
    else if (/^\/(library|itineraries|quotes|packages|suppliers|targets|media)$/.test(p) || /\/(services|travellers|rates|documents|members)$/.test(p)) action = "create";
    else action = "edit";
    return { module, action };
};

const ACTION_WORDS: Record<PermAction, string> = { view: "see", create: "add", edit: "change", delete: "delete", export: "export" };

/** Express guard for travel routes (after validateAgent). Also notes whether this person may see cost. */
export const travelGuard = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
        const p = await permsOf(req);
        (req as any).travelSeesCost = p === "owner" ? true : p.see_cost;
        const need = travelPermFor(req.method, req.originalUrl || "");
        if (!need || p === "owner" || p[need.module]?.[need.action]) return next();
        return res.status(403).json({ success: false, code: "NO_PERMISSION", message: `Your role can not ${ACTION_WORDS[need.action]} ${need.module === "itinerary" ? "itineraries and quotes" : need.module}. Ask your agency owner.` });
    } catch {
        return next();
    }
};
