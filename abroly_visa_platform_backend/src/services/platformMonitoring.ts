import { Op } from 'sequelize';
import sequelize from '../config/dbconfig';
import Agent from '../model/Agent';
import PlatformErrorLog from '../model/PlatformErrorLog';
import PlatformSchedulerHeartbeat from '../model/PlatformSchedulerHeartbeat';

export const MONITORING_REFRESH_SECONDS = 30;

/** Sent on every synthetic probe so error middleware can ignore probe traffic. */
export const PLATFORM_MONITOR_HEADER = 'X-Platform-Monitor';
export const PLATFORM_MONITOR_UA = 'VisaCRM-PlatformMonitor/1.0';

type ProbeStatus = 'healthy' | 'degraded' | 'down';

export type ProbeResult = {
    id: string;
    name: string;
    critical: boolean;
    status: ProbeStatus;
    latency_ms: number | null;
    detail: string | null;
    checked_at: string;
};

type ProbeHttpOpts = {
    method?: 'GET' | 'POST' | 'OPTIONS';
    body?: string | null;
    contentType?: string;
    expectOk: (status: number, body: string) => boolean;
};

const baseUrl = () => {
    const port = process.env.SERVER_PORT || '4001';
    return `http://127.0.0.1:${port}`;
};

const timed = async <T>(fn: () => Promise<T>): Promise<{ ok: true; value: T; ms: number } | { ok: false; error: string; ms: number }> => {
    const t0 = Date.now();
    try {
        const value = await fn();
        return { ok: true, value, ms: Date.now() - t0 };
    } catch (e: any) {
        return { ok: false, error: String(e?.message || e), ms: Date.now() - t0 };
    }
};

const probeHttp = async (
    id: string,
    name: string,
    critical: boolean,
    path: string,
    opts: ProbeHttpOpts,
): Promise<ProbeResult> => {
    const checked_at = new Date().toISOString();
    const method = opts.method || 'GET';
    const result = await timed(async () => {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            [PLATFORM_MONITOR_HEADER]: '1',
            'User-Agent': PLATFORM_MONITOR_UA,
        };
        if (opts.body != null) {
            headers['Content-Type'] = opts.contentType || 'application/json';
        }
        const res = await fetch(`${baseUrl()}${path}`, {
            method,
            headers,
            body: opts.body ?? undefined,
            signal: AbortSignal.timeout(8000),
        });
        const body = await res.text();
        return { status: res.status, body };
    });
    if (result.ok === false) {
        return { id, name, critical, status: 'down', latency_ms: result.ms, detail: result.error, checked_at };
    }
    const pass = opts.expectOk(result.value.status, result.value.body);
    const snippet = result.value.body.replace(/\s+/g, ' ').slice(0, 120);
    return {
        id,
        name,
        critical,
        status: pass ? 'healthy' : 'down',
        latency_ms: result.ms,
        detail: `HTTP ${result.value.status}${snippet ? `: ${snippet}` : ''}`,
        checked_at,
    };
};

const probeMysql = async (): Promise<ProbeResult> => {
    const checked_at = new Date().toISOString();
    const result = await timed(async () => {
        await sequelize.authenticate();
        await sequelize.query('SELECT 1 AS ok');
        return true;
    });
    if (result.ok === false) {
        return {
            id: 'mysql',
            name: 'MySQL (app database)',
            critical: true,
            status: 'down',
            latency_ms: result.ms,
            detail: result.error,
            checked_at,
        };
    }
    return {
        id: 'mysql',
        name: 'MySQL (app database)',
        critical: true,
        status: 'healthy',
        latency_ms: result.ms,
        detail: 'SELECT 1 ok',
        checked_at,
    };
};

/** Login routes are POST-only; OPTIONS must reach CORS (not 404) without touching auth/OTP. */
const loginOptionsHealthy = (status: number): boolean =>
    status === 204 || status === 200 || status === 405;

/** Application route / dependency probes only (no host/CPU/RAM/disk/PM2). */
export const runProbes = async (): Promise<ProbeResult[]> => {
    const [mysql, health, plans, agentLogin, studentLogin] = await Promise.all([
        probeMysql(),
        probeHttp('process_health', 'API process (/health)', true, '/health', {
            expectOk: (s, b) => s === 200 && /Good/i.test(b),
        }),
        probeHttp('public_plans', 'Public SaaS plans', true, '/api/v1/public/saas/plans', {
            expectOk: (s) => s === 200,
        }),
        // OPTIONS only — never POST into login (avoids validation noise / lock interaction)
        probeHttp('agent_login_surface', 'Agency login surface', true, '/api/v1/agent/login_with_number', {
            method: 'OPTIONS',
            expectOk: (s) => loginOptionsHealthy(s),
        }),
        probeHttp('student_login_surface', 'Student login surface', true, '/api/v1/user/student/login_with_number', {
            method: 'OPTIONS',
            expectOk: (s) => loginOptionsHealthy(s),
        }),
    ]);

    // CRM is authenticated — surface as traffic-based status from recent errors, not a synthetic JWT probe
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const crmErrors = await PlatformErrorLog.count({
        where: {
            source: 'agency',
            severity: { [Op.in]: ['critical', 'error'] },
            occurred_at: { [Op.gte]: since },
            path: { [Op.like]: '%/crm/%' },
        },
    }).catch(() => 0);

    const crm: ProbeResult = {
        id: 'crm_live_traffic',
        name: 'CRM APIs (live traffic)',
        critical: true,
        status: crmErrors > 10 ? 'down' : crmErrors > 0 ? 'degraded' : 'healthy',
        latency_ms: null,
        detail: crmErrors > 0
            ? `${crmErrors} agency CRM error(s) in last 15 min`
            : 'No CRM 5xx/error events in last 15 min',
        checked_at: new Date().toISOString(),
    };

    return [health, mysql, plans, agentLogin, studentLogin, crm];
};

export const overallStatus = (probes: ProbeResult[], criticalErrors15m: number): 'healthy' | 'degraded' | 'down' => {
    if (probes.some((p) => p.critical && p.status === 'down')) return 'down';
    if (criticalErrors15m > 0) return 'degraded';
    if (probes.some((p) => p.status !== 'healthy')) return 'degraded';
    return 'healthy';
};

export const recordSchedulerHeartbeat = async (
    jobName: string,
    outcome: { ok: boolean; durationMs: number; error?: string | null },
) => {
    try {
        const now = new Date();
        const existing: any = await PlatformSchedulerHeartbeat.findOne({ where: { job_name: jobName } });
        const payload: any = {
            job_name: jobName,
            last_started_at: now,
            last_duration_ms: outcome.durationMs,
            last_error: outcome.ok ? null : truncateMsg(outcome.error || 'failed', 1000),
            last_ok_at: outcome.ok ? now : existing?.dataValues?.last_ok_at || null,
        };
        if (existing) await existing.update(payload);
        else await PlatformSchedulerHeartbeat.create(payload);
    } catch (e) {
        console.error('scheduler heartbeat write failed', e);
    }
};

const truncateMsg = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export const listSchedulerHeartbeats = async () => {
    const rows: any[] = await PlatformSchedulerHeartbeat.findAll({ order: [['job_name', 'ASC']] });
    return rows.map((r) => {
        const d = r.dataValues;
        return {
            job_name: d.job_name,
            last_ok_at: d.last_ok_at,
            last_error: d.last_error,
            last_duration_ms: d.last_duration_ms,
            last_started_at: d.last_started_at,
            status: d.last_error ? 'error' : d.last_ok_at ? 'ok' : 'unknown',
        };
    });
};

/** Exclude historical GET 404s from login surface probes (POST-only routes). */
const excludeProbeNoise = () => ({
    [Op.not]: {
        [Op.and]: [
            { method: 'GET' },
            { status_code: 404 },
            {
                path: {
                    [Op.or]: [
                        { [Op.like]: '%/agent/login_with_number%' },
                        { [Op.like]: '%/user/student/login_with_number%' },
                    ],
                },
            },
        ],
    },
});

const countErrorsSince = async (since: Date, extra: any = {}) =>
    PlatformErrorLog.count({
        where: {
            occurred_at: { [Op.gte]: since },
            ...excludeProbeNoise(),
            ...extra,
        },
    });

export type MonitoringErrorFilters = {
    agency_uuid?: string | null;
    source?: string | null;
    severity?: string | null;
};

const sourceLabel = (source: string | null | undefined): string => {
    switch (source) {
        case 'agency': return 'Agency';
        case 'student': return 'Student';
        case 'public': return 'Public';
        case 'admin': return 'Platform admin';
        case 'system': return 'System';
        default: return source || 'Unknown';
    }
};

export const buildMonitoringPayload = async (filters: MonitoringErrorFilters = {}) => {
    const now = Date.now();
    const probes = await runProbes();
    const scheduler = await listSchedulerHeartbeats();

    const m15 = new Date(now - 15 * 60 * 1000);
    const h1 = new Date(now - 60 * 60 * 1000);
    const d1 = new Date(now - 24 * 60 * 60 * 1000);

    const agencyFilter = filters.agency_uuid?.trim() || null;
    const sourceFilter = filters.source?.trim() || null;
    const severityFilter = filters.severity?.trim() || null;

    const recentWhere: any = {
        ...excludeProbeNoise(),
    };
    if (agencyFilter) recentWhere.agency_uuid = agencyFilter;
    if (sourceFilter && sourceFilter !== 'all') recentWhere.source = sourceFilter;
    if (severityFilter && severityFilter !== 'all' && severityFilter !== 'critical') {
        recentWhere.severity = severityFilter;
    } else if (severityFilter === 'critical') {
        recentWhere.severity = 'critical';
    }

    const [
        errors_15m,
        errors_1h,
        errors_24h,
        critical_15m,
        agency_15m,
        student_15m,
        recent_raw,
        agencyUuidRows,
    ] = await Promise.all([
        countErrorsSince(m15),
        countErrorsSince(h1),
        countErrorsSince(d1),
        countErrorsSince(m15, { severity: 'critical' }),
        countErrorsSince(m15, { source: 'agency' }),
        countErrorsSince(m15, { source: 'student' }),
        PlatformErrorLog.findAll({
            where: recentWhere,
            order: [['occurred_at', 'DESC']],
            limit: 50,
        }),
        // Agencies that appear in recent errors — for the UI dropdown (distinct in JS; avoid GROUP BY)
        PlatformErrorLog.findAll({
            where: {
                ...excludeProbeNoise(),
                agency_uuid: { [Op.ne]: null },
                occurred_at: { [Op.gte]: d1 },
            },
            attributes: ['agency_uuid'],
            order: [['occurred_at', 'DESC']],
            limit: 300,
        }),
    ]);

    const filterAgencyUuids = agencyFilter ? [agencyFilter] : [];
    const recentAgencyUuids = recent_raw.map((r: any) => r.dataValues.agency_uuid).filter(Boolean);
    const dropdownUuids = [
        ...new Set([
            ...agencyUuidRows.map((r: any) => r.dataValues.agency_uuid).filter(Boolean),
            ...recentAgencyUuids,
            ...filterAgencyUuids,
        ]),
    ];

    const agencies: any[] = dropdownUuids.length
        ? await Agent.findAll({
            where: { uuid: dropdownUuids, role: 'agent' },
            attributes: ['uuid', 'app_name', 'username', 'sudomain'],
        })
        : [];

    type AgencyInfo = { uuid: string; name: string; subdomain: string | null; username: string | null };
    const agencyMap = new Map<string, AgencyInfo>();
    for (const a of agencies) {
        const d = a.dataValues;
        const name = d.app_name || d.username || d.sudomain || 'Unnamed agency';
        agencyMap.set(d.uuid, {
            uuid: d.uuid,
            name,
            subdomain: d.sudomain || null,
            username: d.username || null,
        });
    }

    const recent_errors = recent_raw.map((r: any) => {
        const d = r.dataValues;
        const info = d.agency_uuid ? agencyMap.get(d.agency_uuid) : null;
        const who_label = info
            ? `${info.name}${info.subdomain ? ` (${info.subdomain})` : ''}`
            : d.agency_uuid
                ? `Unknown agency (${String(d.agency_uuid).slice(0, 8)}…)`
                : sourceLabel(d.source);

        return {
            id: d.id,
            occurred_at: d.occurred_at,
            severity: d.severity,
            source: d.source,
            source_label: sourceLabel(d.source),
            agency_uuid: d.agency_uuid,
            agency_name: info?.name || null,
            agency_subdomain: info?.subdomain || null,
            agency_username: info?.username || null,
            who_label,
            actor_id: d.actor_id,
            actor_role: d.actor_role,
            method: d.method,
            path: d.path,
            status_code: d.status_code,
            message: d.message,
            count: d.count,
        };
    });

    const agencies_in_errors = [...agencyMap.values()].sort((a, b) => a.name.localeCompare(b.name));

    const overall_status = overallStatus(probes, Number(critical_15m) || 0);

    return {
        overall_status,
        generated_at: new Date().toISOString(),
        refresh_hint_seconds: MONITORING_REFRESH_SECONDS,
        probes,
        scheduler,
        filters: {
            agency_uuid: agencyFilter,
            source: sourceFilter || 'all',
            severity: severityFilter || 'all',
        },
        agencies_in_errors,
        error_summary: {
            last_15m: Number(errors_15m) || 0,
            last_1h: Number(errors_1h) || 0,
            last_24h: Number(errors_24h) || 0,
            critical_15m: Number(critical_15m) || 0,
            agency_15m: Number(agency_15m) || 0,
            student_15m: Number(student_15m) || 0,
        },
        recent_errors,
    };
};

/** One-shot cleanup of probe GET 404 noise already written to the log table. */
export const purgeProbeNoiseLogs = async () => {
    return PlatformErrorLog.destroy({
        where: {
            method: 'GET',
            status_code: 404,
            path: {
                [Op.or]: [
                    { [Op.like]: '%/agent/login_with_number%' },
                    { [Op.like]: '%/user/student/login_with_number%' },
                ],
            },
        },
    });
};
