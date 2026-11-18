import { Op } from 'sequelize';
import sequelize from '../config/dbconfig';
import Agent from '../model/Agent';
import PlatformErrorLog from '../model/PlatformErrorLog';
import PlatformSchedulerHeartbeat from '../model/PlatformSchedulerHeartbeat';

export const MONITORING_REFRESH_SECONDS = 30;

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

const probeHttp = async (id: string, name: string, critical: boolean, path: string, expectOk: (status: number, body: string) => boolean): Promise<ProbeResult> => {
    const checked_at = new Date().toISOString();
    const result = await timed(async () => {
        const res = await fetch(`${baseUrl()}${path}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
        });
        const body = await res.text();
        return { status: res.status, body };
    });
    if (result.ok === false) {
        return { id, name, critical, status: 'down', latency_ms: result.ms, detail: result.error, checked_at };
    }
    const pass = expectOk(result.value.status, result.value.body);
    return {
        id,
        name,
        critical,
        status: pass ? 'healthy' : 'down',
        latency_ms: result.ms,
        detail: pass ? `HTTP ${result.value.status}` : `HTTP ${result.value.status}: ${result.value.body.slice(0, 120)}`,
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

/** Application route / dependency probes only (no host/CPU/RAM/disk/PM2). */
export const runProbes = async (): Promise<ProbeResult[]> => {
    const [mysql, health, plans, agentLogin, studentLogin] = await Promise.all([
        probeMysql(),
        probeHttp('process_health', 'API process (/health)', true, '/health', (s, b) => s === 200 && /Good/i.test(b)),
        probeHttp('public_plans', 'Public SaaS plans', true, '/api/v1/public/saas/plans', (s) => s === 200),
        // Login endpoints are POST-only; GET should reach the route layer (not 502/timeout). 404/405/401 still = app up.
        probeHttp('agent_login_surface', 'Agency login surface', true, '/api/v1/agent/login_with_number', (s) => s !== 502 && s < 500),
        probeHttp('student_login_surface', 'Student login surface', true, '/api/v1/user/student/login_with_number', (s) => s !== 502 && s < 500),
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

const countErrorsSince = async (since: Date, extra: any = {}) =>
    PlatformErrorLog.count({ where: { occurred_at: { [Op.gte]: since }, ...extra } });

export const buildMonitoringPayload = async () => {
    const now = Date.now();
    const probes = await runProbes();
    const scheduler = await listSchedulerHeartbeats();

    const m15 = new Date(now - 15 * 60 * 1000);
    const h1 = new Date(now - 60 * 60 * 1000);
    const d1 = new Date(now - 24 * 60 * 60 * 1000);

    const [
        errors_15m,
        errors_1h,
        errors_24h,
        critical_15m,
        agency_15m,
        student_15m,
        recent,
    ] = await Promise.all([
        countErrorsSince(m15),
        countErrorsSince(h1),
        countErrorsSince(d1),
        countErrorsSince(m15, { severity: 'critical' }),
        countErrorsSince(m15, { source: 'agency' }),
        countErrorsSince(m15, { source: 'student' }),
        PlatformErrorLog.findAll({
            order: [['occurred_at', 'DESC']],
            limit: 50,
        }),
    ]);

    const agencyUuids = [...new Set(recent.map((r: any) => r.dataValues.agency_uuid).filter(Boolean))];
    const agencies: any[] = agencyUuids.length
        ? await Agent.findAll({
            where: { uuid: agencyUuids, role: 'agent' },
            attributes: ['uuid', 'app_name', 'username', 'sudomain'],
        })
        : [];
    const agencyName = new Map(agencies.map((a) => [a.dataValues.uuid, a.dataValues.app_name || a.dataValues.username || a.dataValues.sudomain]));

    const recent_errors = recent.map((r: any) => {
        const d = r.dataValues;
        return {
            id: d.id,
            occurred_at: d.occurred_at,
            severity: d.severity,
            source: d.source,
            agency_uuid: d.agency_uuid,
            agency_name: d.agency_uuid ? agencyName.get(d.agency_uuid) || null : null,
            actor_id: d.actor_id,
            actor_role: d.actor_role,
            method: d.method,
            path: d.path,
            status_code: d.status_code,
            message: d.message,
            count: d.count,
        };
    });

    const overall_status = overallStatus(probes, Number(critical_15m) || 0);

    return {
        overall_status,
        generated_at: new Date().toISOString(),
        refresh_hint_seconds: MONITORING_REFRESH_SECONDS,
        probes,
        scheduler,
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
