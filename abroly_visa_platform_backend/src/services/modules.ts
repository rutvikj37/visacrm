import { NextFunction, Response } from "express";
import Agent from "../model/Agent";
import AgencyModule from "../model/AgencyModule";
import SaasPlan from "../model/SaasPlan";
import { RequestWithUser } from "../utils/types";

/**
 * Which modules an agency can use. This is the Visa CRM: every agency is a visa agency
 * (the Travel CRM is a separate product with its own backend and database: github.com/rutvikj37/travelcrm).
 *
 *   final list = defaults for the agency's crm_type
 *              ∩ what its plan includes (no plan = everything)
 *              ± Super Admin overrides (agency_modules rows)
 *
 * The API (validateAgent → MODULE_PATHS), the sidebar, the dashboard and the wording all read this one list.
 * Switching a module off only blocks access; no data is deleted.
 */

export type CrmType = "visa" | "travel" | "both";
export const CRM_TYPES: CrmType[] = ["visa"];
export type ModuleGroup = "common" | "visa";
type Default = "on" | "addon" | "off";

export interface ModuleDef {
    key: string;
    label: string;
    group: ModuleGroup;
    defaults: Record<CrmType, Default>;
    /** old plan add-on key, so plans made before modules existed keep working */
    legacyAddon?: boolean;
}

const all = (d: Default): Record<CrmType, Default> => ({ visa: d, travel: d, both: d });

export const MODULES: ModuleDef[] = [
    { key: "leads", label: "Leads, follow-ups, tasks, calendar", group: "common", defaults: all("on") },
    { key: "messaging", label: "Chat, WhatsApp, email", group: "common", defaults: all("on") },
    { key: "billing", label: "Invoices, payments, ledger", group: "common", defaults: all("on") },
    { key: "reports", label: "Reports, dashboard, team, settings", group: "common", defaults: all("on") },
    { key: "customer_portal", label: "Client portal", group: "common", defaults: all("on") },
    { key: "service_requests", label: "Insurance, eSIM, forex requests", group: "common", defaults: all("on"), legacyAddon: true },
    { key: "side_banner", label: "Portal achievement banners", group: "common", defaults: all("on"), legacyAddon: true },
    { key: "event_banners", label: "Event banners", group: "common", defaults: all("on"), legacyAddon: true },
    { key: "visa", label: "Visa cases, applications, templates", group: "visa", defaults: { visa: "on", travel: "addon", both: "on" } },
    { key: "jobs", label: "Job portal", group: "visa", defaults: { visa: "on", travel: "addon", both: "on" }, legacyAddon: true },
    { key: "language_prep", label: "Language preparation", group: "visa", defaults: { visa: "on", travel: "off", both: "on" }, legacyAddon: true },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
const byKey = new Map(MODULES.map((m) => [m.key, m]));

/** API paths that need a module. Checked in validateAgent for every agency request. */
export const MODULE_PATHS: [RegExp, string][] = [
    [/^\/api\/v1\/crm\/(cases|universities|visa_templates|commissions)(\/|$)/, "visa"],
    [/^\/api\/v1\/job_post(\/|$)/, "jobs"],
];

export const moduleForPath = (url: string): string | null => {
    const path = (url || "").split("?")[0];
    for (const [re, key] of MODULE_PATHS) if (re.test(path)) return key;
    return null;
};

export const normalizeCrmType = (_v?: any): CrmType => "visa";

const planAllows = (plan: any, key: string) => {
    if (!plan) return true;
    const f = plan.features || {};
    if (Array.isArray(f.modules)) return f.modules.includes(key);
    if (byKey.get(key)?.legacyAddon) return Array.isArray(f.addons) && f.addons.includes(key);
    return true;
};

export interface ModuleState {
    key: string;
    label: string;
    group: ModuleGroup;
    default: Default;
    in_plan: boolean;
    override: boolean | null;
    enabled: boolean;
}

/** Work out every module for one agency (not cached - use modulesFor for the cached list). */
export const resolveModules = (crmType: CrmType, plan: any, overrides: Record<string, boolean>): ModuleState[] =>
    MODULES.map((m) => {
        const def = m.defaults[crmType];
        const inPlan = planAllows(plan, m.key);
        const override = Object.prototype.hasOwnProperty.call(overrides, m.key) ? overrides[m.key] : null;
        const enabled = override !== null ? override : def === "on" && inPlan;
        return { key: m.key, label: m.label, group: m.group, default: def, in_plan: inPlan, override, enabled };
    });

const loadState = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "crm_type", "saas_plan_id"], raw: true });
    if (!agency) return null;
    const plan: any = agency.saas_plan_id ? await SaasPlan.findByPk(agency.saas_plan_id) : null;
    const rows: any[] = await AgencyModule.findAll({ where: { agency_uuid: agencyUuid }, raw: true });
    const overrides: Record<string, boolean> = {};
    for (const r of rows) if (byKey.has(r.module_key)) overrides[r.module_key] = Boolean(r.is_enabled);
    const crmType = normalizeCrmType(agency.crm_type);
    return { crmType, plan: plan ? plan.toJSON() : null, overrides, modules: resolveModules(crmType, plan ? plan.toJSON() : null, overrides) };
};

const cache = new Map<string, { at: number; crmType: CrmType; enabled: string[] }>();
const TTL = 60 * 1000;

export const clearModuleCache = (agencyUuid?: string) => (agencyUuid ? cache.delete(agencyUuid) : cache.clear());

/** The agency's CRM type and enabled module keys, cached for 60 seconds. */
export const modulesFor = async (agencyUuid: string): Promise<{ crmType: CrmType; enabled: string[] }> => {
    const hit = cache.get(agencyUuid);
    if (hit && Date.now() - hit.at < TTL) return hit;
    const state = await loadState(agencyUuid);
    const value = state
        ? { at: Date.now(), crmType: state.crmType, enabled: state.modules.filter((m) => m.enabled).map((m) => m.key) }
        : { at: Date.now(), crmType: "visa" as CrmType, enabled: MODULE_KEYS };
    cache.set(agencyUuid, value);
    return value;
};

export const moduleDetails = loadState;

export const hasModule = async (agencyUuid: string, key: string) => (await modulesFor(agencyUuid)).enabled.includes(key);

export const MODULE_DISABLED = { success: false, code: "MODULE_DISABLED", message: "Module not enabled" };

/** Route guard for use after validateAgent. */
export const requireModule = (key: string) => async (req: RequestWithUser, res: Response, next: NextFunction) => {
    const agencyUuid = (req.user?.user as any)?.agent_uuid;
    if (!agencyUuid) return next();
    if (await hasModule(agencyUuid, key)) return next();
    return res.status(403).json({ ...MODULE_DISABLED, message: `${byKey.get(key)?.label || key}: module not enabled for your agency` });
};

/** Words that change with the CRM type. "both" uses neutral words; records carry their own business_line. */
export const labelsFor = (crmType: CrmType) => {
    if (crmType === "travel") return { client: "Traveller", clients: "Travellers", case: "Booking", cases: "Bookings", agent: "Travel consultant" };
    if (crmType === "both") return { client: "Client", clients: "Clients", case: "Case", cases: "Cases", agent: "Consultant" };
    return { client: "Applicant", clients: "Applicants", case: "Application", cases: "Applications", agent: "Counsellor" };
};
