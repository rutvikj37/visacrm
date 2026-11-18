import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import PlatformErrorLog from '../model/PlatformErrorLog';

const CRITICAL_PATH_RE = /\/(crm|student|agent|user\/student|public\/(leads|meta|razorpay|saas)|saas_admin)\b/i;

const sourceFromPath = (path: string): 'agency' | 'student' | 'public' | 'admin' | 'system' => {
    if (/\/saas_admin\b/i.test(path)) return 'admin';
    if (/\/(crm|agent)\b/i.test(path)) return 'agency';
    if (/\/(student|user\/student)\b/i.test(path)) return 'student';
    if (/\/public\b/i.test(path)) return 'public';
    return 'system';
};

const severityFor = (status: number, path: string): 'critical' | 'error' | 'warning' => {
    if (status >= 500) return CRITICAL_PATH_RE.test(path) ? 'critical' : 'error';
    if (status === 403 || status === 404) return CRITICAL_PATH_RE.test(path) ? 'warning' : 'warning';
    return 'error';
};

const shouldCapture = (status: number, path: string): boolean => {
    if (!path || path === '/health') return false;
    if (status >= 500) return true;
    // Skip routine auth / subscription noise
    if (status === 401 || status === 402) return false;
    if ((status === 403 || status === 404) && CRITICAL_PATH_RE.test(path)) return true;
    return false;
};

const truncate = (s: any, n: number) => {
    const t = String(s || '').trim();
    return t.length > n ? t.slice(0, n) : t || null;
};

const actorFromReq = (req: any) => {
    const u = req?.user || {};
    return {
        agency_uuid: u.agent_uuid || u.agency_uuid || null,
        actor_id: typeof u.id === 'number' ? u.id : null,
        actor_role: u.role || u.user_type || null,
    };
};

export const isPlatformMonitorRequest = (req: Request | any): boolean => {
    if (!req?.headers) return false;
    const header = req.headers['x-platform-monitor'];
    if (header === '1' || header === 'true') return true;
    const ua = String(req.headers['user-agent'] || '');
    if (/VisaCRM-PlatformMonitor/i.test(ua)) return true;
    return false;
};

/** Persist one ops-interesting API failure (fire-and-forget). */
export const recordPlatformError = async (opts: {
    req?: any;
    status_code: number;
    message?: string | null;
    stack?: string | null;
    path?: string;
    method?: string;
    source?: 'agency' | 'student' | 'public' | 'admin' | 'system';
}) => {
    try {
        if (opts.req && isPlatformMonitorRequest(opts.req)) return;
        const path = opts.path || opts.req?.originalUrl?.split('?')[0] || opts.req?.path || '/unknown';
        const status = opts.status_code;
        if (!shouldCapture(status, path)) return;

        const method = (opts.method || opts.req?.method || 'GET').toUpperCase();
        const message = truncate(opts.message || `HTTP ${status}`, 1000);
        const source = opts.source || sourceFromPath(path);
        const severity = severityFor(status, path);
        const actor = actorFromReq(opts.req);
        const since = new Date(Date.now() - 60_000);

        const existing: any = await PlatformErrorLog.findOne({
            where: {
                path,
                status_code: status,
                message,
                occurred_at: { [Op.gte]: since },
            },
            order: [['occurred_at', 'DESC']],
        });
        if (existing) {
            await existing.update({
                count: Number(existing.dataValues.count || 1) + 1,
                occurred_at: new Date(),
                agency_uuid: actor.agency_uuid || existing.dataValues.agency_uuid,
                actor_id: actor.actor_id ?? existing.dataValues.actor_id,
                actor_role: actor.actor_role || existing.dataValues.actor_role,
            });
            return;
        }

        await PlatformErrorLog.create({
            occurred_at: new Date(),
            severity,
            source,
            agency_uuid: actor.agency_uuid,
            actor_id: actor.actor_id,
            actor_role: actor.actor_role,
            method,
            path,
            status_code: status,
            message,
            stack: truncate(opts.stack, 4000),
            count: 1,
        });
    } catch (e) {
        console.error('platform error capture failed', e);
    }
};

/** After each response, capture 5xx and interesting 4xx on critical paths. */
export const platformErrorCaptureMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on('finish', () => {
        // Avoid logging our own monitoring reads / synthetic probes as errors
        if (req.path?.includes('/saas_admin/monitoring')) return;
        if (isPlatformMonitorRequest(req)) return;
        void recordPlatformError({
            req,
            status_code: res.statusCode,
            message: `HTTP ${res.statusCode} (${Date.now() - started}ms)`,
            path: (req.originalUrl || req.url || '').split('?')[0],
            method: req.method,
        });
    });
    next();
};

/** Use from the Express global error handler. */
export const captureUnhandledError = (err: any, req: Request, statusCode = 500) => {
    if (isPlatformMonitorRequest(req)) return;
    void recordPlatformError({
        req,
        status_code: statusCode,
        message: err?.message || 'Internal Server Error',
        stack: err?.stack,
        path: (req.originalUrl || req.url || '').split('?')[0],
        method: req.method,
    });
};
