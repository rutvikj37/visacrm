import { QueryTypes } from "sequelize";
import sequelize from "../config/dbconfig";

/**
 * How much each agency uses the CRM, so the platform admin can spot agencies that may cancel.
 *
 *   last_active   - latest request by the owner or any team member (Agent.last_active_at)
 *   team actions  - notes, calls, status changes ... logged by people on leads (last 30 days)
 *   leads         - new leads in the last 30 days vs the 30 days before
 *   sources       - connected lead sources (website form, IndiaMART, Meta ...)
 *
 * Health score 0-100: activity recency 40, team actions 30, lead flow 20, connected source 10.
 *   >= 60 healthy, >= 30 at risk, below that inactive.
 */

const DAY = 24 * 60 * 60 * 1000;

export type Health = "healthy" | "at_risk" | "inactive";

const daysSince = (d: any) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null);

const scoreOf = (u: { daysIdle: number | null; actions30: number; leads30: number; sources: number }) => {
    const idle = u.daysIdle;
    const recency = idle === null ? 0 : idle <= 1 ? 40 : idle <= 3 ? 32 : idle <= 7 ? 24 : idle <= 14 ? 10 : 0;
    const actions = u.actions30 >= 50 ? 30 : u.actions30 >= 15 ? 20 : u.actions30 >= 1 ? 10 : 0;
    const leads = u.leads30 >= 20 ? 20 : u.leads30 >= 5 ? 14 : u.leads30 >= 1 ? 8 : 0;
    return recency + actions + leads + (u.sources > 0 ? 10 : 0);
};

const healthOf = (score: number): Health => (score >= 60 ? "healthy" : score >= 30 ? "at_risk" : "inactive");

/** Usage of every agency (or one). Few aggregate queries, fine for thousands of agencies. */
export const agencyUsage = async (agencyUuid?: string) => {
    const one = agencyUuid ? "AND a.uuid = :agency" : "";
    const repl = { agency: agencyUuid || null };
    const q = (sql: string) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: repl }) as Promise<any[]>;

    const [agencies, team, leads, actions, cases, sources] = await Promise.all([
        q(`SELECT a.id, a.uuid, COALESCE(NULLIF(a.app_name, ''), a.username) AS name, a.username AS owner_name, a.phone_number, a.country_code,
                  a.status, a.expires_at, a.saas_kind, a.last_active_at, a.createdAt, p.name AS plan_name
           FROM agent a LEFT JOIN saas_plans p ON p.id = a.saas_plan_id
           WHERE a.role = 'agent' AND a.deletedAt IS NULL ${one}`),
        q(`SELECT a.uuid AS agency_uuid, COUNT(t.id) AS total,
                  SUM(t.last_active_at >= NOW() - INTERVAL 7 DAY) AS active7, MAX(t.last_active_at) AS last_active
           FROM agent a JOIN agent t ON t.parent_id = a.id AND t.deletedAt IS NULL
           WHERE a.role = 'agent' ${one} GROUP BY a.uuid`),
        q(`SELECT l.agency_uuid,
                  SUM(l.createdAt >= NOW() - INTERVAL 30 DAY) AS leads30,
                  SUM(l.createdAt < NOW() - INTERVAL 30 DAY AND l.createdAt >= NOW() - INTERVAL 60 DAY) AS leads_prev30,
                  SUM(l.converted_at >= NOW() - INTERVAL 30 DAY) AS converted30,
                  COUNT(*) AS leads_total, MAX(l.createdAt) AS last_lead_at
           FROM crm_leads l JOIN agent a ON a.uuid = l.agency_uuid AND a.role = 'agent'
           WHERE l.deletedAt IS NULL ${one} GROUP BY l.agency_uuid`),
        q(`SELECT x.agency_uuid,
                  SUM(x.createdAt >= NOW() - INTERVAL 30 DAY) AS actions30,
                  SUM(x.createdAt < NOW() - INTERVAL 30 DAY AND x.createdAt >= NOW() - INTERVAL 60 DAY) AS actions_prev30,
                  MAX(x.createdAt) AS last_action_at
           FROM crm_lead_activities x JOIN agent a ON a.uuid = x.agency_uuid AND a.role = 'agent'
           WHERE x.deletedAt IS NULL AND x.created_by IS NOT NULL AND x.createdAt >= NOW() - INTERVAL 60 DAY ${one}
           GROUP BY x.agency_uuid`),
        q(`SELECT c.agent_uuid AS agency_uuid, SUM(c.createdAt >= NOW() - INTERVAL 30 DAY) AS cases30,
                  SUM(c.status = 'visa_progress') AS open_cases
           FROM agency_leads c JOIN agent a ON a.uuid = c.agent_uuid AND a.role = 'agent'
           WHERE c.deletedAt IS NULL AND c.status IN ('visa_progress', 'visa_completed', 'visa_rejected') ${one}
           GROUP BY c.agent_uuid`),
        q(`SELECT i.agency_uuid, COUNT(*) AS sources, GROUP_CONCAT(DISTINCT i.type) AS types
           FROM lead_integrations i JOIN agent a ON a.uuid = i.agency_uuid AND a.role = 'agent'
           WHERE i.deletedAt IS NULL AND i.status = 'active' ${one} GROUP BY i.agency_uuid`),
    ]);

    const by = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.agency_uuid, r]));
    const T = by(team), L = by(leads), A = by(actions), C = by(cases), S = by(sources);
    const n = (v: any) => Number(v || 0);

    return agencies.map((a) => {
        const t = T[a.uuid] || {}, l = L[a.uuid] || {}, x = A[a.uuid] || {}, c = C[a.uuid] || {}, s = S[a.uuid] || {};
        const times = [a.last_active_at, t.last_active].filter(Boolean).map((v: any) => new Date(v).getTime());
        const lastActive = times.length ? new Date(Math.max(...times)) : null;
        const daysIdle = daysSince(lastActive);
        const leads30 = n(l.leads30), leadsPrev = n(l.leads_prev30), actions30 = n(x.actions30), sourcesCount = n(s.sources);
        const score = scoreOf({ daysIdle, actions30, leads30, sources: sourcesCount });
        const endsIn = a.expires_at ? Math.ceil((new Date(a.expires_at).getTime() - Date.now()) / DAY) : null;
        const leadTrend = leadsPrev > 0 ? Math.round(((leads30 - leadsPrev) / leadsPrev) * 100) : null;

        const reasons: string[] = [];
        if (daysIdle === null) reasons.push("Nobody has logged in yet");
        else if (daysIdle >= 7) reasons.push(`No one has used the CRM for ${daysIdle} days`);
        if (actions30 === 0) reasons.push("No follow-up work on leads in 30 days");
        if (leadsPrev >= 5 && leadTrend !== null && leadTrend <= -50) reasons.push(`Leads down ${Math.abs(leadTrend)}% vs the previous 30 days`);
        if (sourcesCount === 0) reasons.push("No lead source connected");
        if (n(t.total) > 0 && n(t.active7) === 0) reasons.push("No team member active this week");
        if (endsIn !== null && endsIn >= 0 && endsIn <= 7) reasons.push(`Access ends in ${endsIn} day(s)`);

        return {
            id: a.uuid,
            name: a.name,
            owner_name: a.owner_name,
            phone: a.phone_number ? `${a.country_code || "+91"} ${a.phone_number}` : null,
            plan: a.plan_name || null,
            kind: a.saas_kind,
            status: a.status,
            expires_at: a.expires_at,
            ends_in_days: endsIn,
            joined_at: a.createdAt,
            last_active_at: lastActive,
            days_idle: daysIdle,
            team_total: n(t.total),
            team_active_7d: n(t.active7),
            leads_30d: leads30,
            leads_prev_30d: leadsPrev,
            lead_trend_pct: leadTrend,
            leads_total: n(l.leads_total),
            converted_30d: n(l.converted30),
            last_lead_at: l.last_lead_at || null,
            actions_30d: actions30,
            actions_prev_30d: n(x.actions_prev30),
            cases_30d: n(c.cases30),
            open_cases: n(c.open_cases),
            sources: sourcesCount,
            source_types: s.types ? String(s.types).split(",") : [],
            score,
            health: healthOf(score),
            reasons,
        };
    });
};
