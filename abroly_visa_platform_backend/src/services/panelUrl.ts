import Agent from "../model/Agent";

/**
 * Each agency's own panel address.
 *
 *   student portal: <agency>.techxsolutions.io (or the agency's own domain)
 *   agency panel:   crm.<that address>          e.g. crm.rutvik.techxsolutions.io
 *
 * Agencies without a portal address use the shared panel (AGENCY_PANEL_URL, e.g. https://crm.techxsolutions.io).
 * deploy/auto-certs.sh gets the certificate for crm.<address> and serves the panel there.
 */

const sharedPanel = () => (process.env.AGENCY_PANEL_URL || "").replace(/\/+$/, "");

/** "rutvik.techxsolutions.io" for an agency row with sudomain/domain, or null */
export const portalHostOf = (a: { sudomain?: string | null; domain?: string | null } | null | undefined) =>
    a?.domain ? `${a.sudomain ? `${a.sudomain}.` : ""}${a.domain}`.toLowerCase() : null;

/** "https://crm.rutvik.techxsolutions.io" for that agency, else the shared panel. Local dev always uses the shared one. */
export const panelBaseOf = (a: { sudomain?: string | null; domain?: string | null } | null | undefined) => {
    const host = portalHostOf(a);
    if (!host || process.env.ISLOCAL === "yes") return sharedPanel();
    return `https://crm.${host}`;
};

const cache = new Map<string, { base: string; at: number }>();
/** Panel base URL for an agency (by its uuid), cached for 5 minutes. */
export const agencyPanelBase = async (agencyUuid?: string | null) => {
    if (!agencyUuid) return sharedPanel();
    const hit = cache.get(agencyUuid);
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.base;
    const a: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["sudomain", "domain"], raw: true }).catch(() => null);
    const base = panelBaseOf(a);
    cache.set(agencyUuid, { base, at: Date.now() });
    return base;
};

/** Full link into an agency's panel, e.g. agencyPanelLink(uuid, "/crm/leads/abc"), or null when no panel URL is configured. */
export const agencyPanelLink = async (agencyUuid: string | null | undefined, path: string) => {
    const base = await agencyPanelBase(agencyUuid);
    return base ? `${base}${path}` : null;
};

/**
 * The agency that owns a portal address ("rutvik.techxsolutions.io" or a custom domain), for checking
 * that someone logging in at crm.<address> belongs to that agency. null = not an agency address.
 */
export const agencyByPortalHost = async (host?: string | null) => {
    const h = String(host || "").trim().toLowerCase().replace(/^crm\./, "").replace(/:\d+$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return null;
    const parts = h.split(".");
    const candidates: { sudomain: string | null; domain: string }[] = [{ sudomain: null, domain: h }];
    if (parts.length >= 3) candidates.push({ sudomain: parts[0], domain: parts.slice(1).join(".") });
    for (const c of candidates) {
        const a: any = await Agent.findOne({
            where: { role: "agent", domain: c.domain, ...(c.sudomain ? { sudomain: c.sudomain } : {}) },
            attributes: ["id", "uuid", "app_name", "username", "sudomain", "domain"],
            raw: true,
        });
        if (a && (c.sudomain ? true : !a.sudomain)) return a;
    }
    return null;
};
