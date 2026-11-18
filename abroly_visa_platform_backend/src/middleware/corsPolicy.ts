import { Request } from "express";
import { CorsOptions } from "cors";
import { Op } from "sequelize";
import Agent from "../model/Agent";

/**
 * Which websites may call the API from a browser.
 *
 *  - our domains and their subdomains (panels, agency subdomains)
 *  - agencies' own custom domains (Agent.domain, cached for 5 minutes)
 *  - localhost in development
 *  - /api/v1/public/* is open to every site: agencies embed lead forms on their own websites
 * Requests without an Origin header (server-to-server, webhooks, mobile apps, curl) are not
 * affected by CORS at all. Logins are still required as before: this only stops other
 * websites from using a visitor's browser to call the API.
 */
const OWN_DOMAINS = ["techxsolutions.io", "techxuniverse.com", "visacrm.in"];
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"];
const OPEN_PATH = /^\/api\/v1\/public\//;
const CACHE_MS = 5 * 60 * 1000;

let customDomains = new Set<string>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

const cleanHost = (v: unknown) => String(v || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^www\./, "");

const refreshDomains = () => {
    if (loading) return loading;
    loading = (async () => {
        try {
            const rows: any[] = await Agent.findAll({ where: { role: "agent", domain: { [Op.ne]: null } }, attributes: ["domain"], raw: true });
            customDomains = new Set(rows.map((r) => cleanHost(r.domain)).filter(Boolean));
            loadedAt = Date.now();
        } catch (e: any) {
            console.error("CORS: could not load agency domains", e?.message);
        } finally {
            loading = null;
        }
    })();
    return loading;
};

const isOwnHost = (host: string) => OWN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));

export const isAllowedOrigin = async (origin: string) => {
    if (DEV_ORIGINS.includes(origin)) return true;
    let host = "";
    try {
        const u = new URL(origin);
        if (u.protocol !== "https:" && u.protocol !== "http:") return false;
        host = u.hostname.toLowerCase();
    } catch {
        return false;
    }
    if (isOwnHost(host)) return true;
    if (Date.now() - loadedAt > CACHE_MS) await refreshDomains();
    const bare = host.replace(/^www\./, "");
    return customDomains.has(bare) || [...customDomains].some((d) => bare.endsWith(`.${d}`));
};

const BASE: CorsOptions = {
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin",
        "X-HTTP-Method-Override", "X-Forwarded-For", "X-Forwarded-Proto", "X-Forwarded-Host", "X-Agency-UUID",
    ],
};

/** Per-request CORS options (pass to cors()). */
export const corsOptionsDelegate = (req: Request, callback: (err: Error | null, options?: CorsOptions) => void) => {
    const origin = req.header("Origin");
    if (!origin) return callback(null, { ...BASE, origin: false });
    if (OPEN_PATH.test(req.path || req.originalUrl || "")) return callback(null, { ...BASE, credentials: false, origin: true });
    isAllowedOrigin(origin)
        .then((ok) => {
            if (!ok) console.log("CORS blocked for origin:", origin);
            callback(null, { ...BASE, origin: ok });
        })
        .catch(() => callback(null, { ...BASE, origin: false }));
};
