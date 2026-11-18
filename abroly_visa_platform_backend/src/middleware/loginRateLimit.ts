import { NextFunction, Request, Response } from "express";

/**
 * Slows down guessing of login codes / passcodes / OTPs.
 *
 * Two buckets per request:
 *   - per phone number : 8 tries per 15 minutes (stops guessing one account's passcode)
 *   - per IP address   : 40 tries per 15 minutes (stops one machine trying many accounts)
 * Over the limit the API answers 429 with a "try again in N minutes" message.
 *
 * Counters live in memory in each server worker (no Redis needed). With several workers
 * the real limit is a few times higher, which still turns a 10,000-guess attack into days.
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_PHONE = 8;
const PER_IP = 40;

const hits = new Map<string, { count: number; resetAt: number }>();

// forget finished windows so the map does not grow forever
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}, 60 * 1000).unref();

const bump = (key: string, limit: number) => {
    const now = Date.now();
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { blocked: false, retryMs: 0 };
    }
    cur.count += 1;
    return { blocked: cur.count > limit, retryMs: cur.resetAt - now };
};

/** nginx sets X-Real-IP to the connecting address (clients can fake X-Forwarded-For, not this). */
export const clientIp = (req: Request) => {
    const real = req.headers["x-real-ip"];
    const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
    return String((Array.isArray(real) ? real[0] : real) || xff[xff.length - 1] || req.socket.remoteAddress || "unknown");
};

const phoneOf = (req: Request) =>
    String(req.body?.phone_number ?? req.body?.phone ?? "").replace(/\D/g, "").slice(-10);

/** `scope` keeps agency / student / admin counters apart (same number can be both). */
export const loginRateLimit = (scope: string) => (req: Request, res: Response, next: NextFunction) => {
    const ip = bump(`${scope}:ip:${clientIp(req)}`, PER_IP);
    const phone = phoneOf(req);
    const byPhone = phone ? bump(`${scope}:phone:${phone}`, PER_PHONE) : { blocked: false, retryMs: 0 };
    if (ip.blocked || byPhone.blocked) {
        const minutes = Math.max(1, Math.ceil(Math.max(ip.retryMs, byPhone.retryMs) / 60000));
        res.setHeader("Retry-After", String(minutes * 60));
        return res.status(429).json({ success: false, message: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` });
    }
    return next();
};
