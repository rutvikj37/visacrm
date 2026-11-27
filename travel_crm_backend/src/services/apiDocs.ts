/**
 * API reference generated from the live Express routes (no hand-written annotations to keep in sync).
 * Walks the v1 router, recovers each mounted prefix, and reports method, path, path params and
 * which login the route needs (from the auth middleware in front of it).
 * Served as OpenAPI 3 JSON to platform admins only: GET /api/v1/saas_admin/api_docs
 */

type Endpoint = { method: string; path: string; auth: string; tag: string; params: string[]; upload: boolean };

// middleware name -> who may call the route
const AUTH: Record<string, string> = {
    validateAdmin: "admin",
    validateAdminOrManager: "admin",
    validateAgent: "agency",
    validateUser: "student",
    validateGeneral: "student",
    localOnly: "local-dev-only",
};

/** "/^\/crm\/?(?=\/|$)/i" -> "/crm" (how Express 4 stores a router's mount path). */
const mountPath = (layer: any) => {
    if (layer.path) return layer.path;
    const src: string = layer.regexp?.source || "";
    if (src === "^\\/?(?=\\/|$)" || src === "^\\/?$") return "";
    return src
        .replace(/^\^/, "")
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
        .replace(/\(\?=\\\/\|\$\)$/, "")
        .replace(/\\\//g, "/")
        .replace(/\$$/, "");
};

const walk = (stack: any[], prefix: string, out: Endpoint[]) => {
    for (const layer of stack || []) {
        if (layer.route) {
            const paths: string[] = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            const names: string[] = (layer.route.stack || []).map((s: any) => s.name || s.handle?.name || "");
            const auth = names.map((n) => AUTH[n]).find(Boolean) || "public";
            const upload = names.some((n) => n === "multerMiddleware" || /upload/i.test(n));
            for (const p of paths) {
                const full = `${prefix}${p}`.replace(/\/+/g, "/");
                const methods = Object.keys(layer.route.methods || {}).filter((m) => m !== "_all");
                for (const m of methods) {
                    out.push({
                        method: m.toUpperCase(),
                        path: full,
                        auth,
                        tag: full.split("/").filter(Boolean)[2] || "root",
                        params: [...full.matchAll(/:(\w+)/g)].map((x) => x[1]),
                        upload,
                    });
                }
            }
        } else if (layer.name === "router" && layer.handle?.stack) {
            walk(layer.handle.stack, `${prefix}${mountPath(layer)}`, out);
        }
    }
};

export const listEndpoints = (router: any, base = "/api/v1") => {
    const out: Endpoint[] = [];
    walk(router.stack, base, out);
    const seen = new Set<string>();
    return out
        .filter((e) => (seen.has(`${e.method} ${e.path}`) ? false : (seen.add(`${e.method} ${e.path}`), true)))
        .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
};

export const buildOpenApi = (router: any) => {
    const endpoints = listEndpoints(router);
    const server = (process.env.PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
    const paths: Record<string, any> = {};
    for (const e of endpoints) {
        const oaPath = e.path.replace(/:(\w+)/g, "{$1}");
        paths[oaPath] = paths[oaPath] || {};
        paths[oaPath][e.method.toLowerCase()] = {
            tags: [e.tag],
            summary: `${e.method} ${e.path}`,
            "x-auth": e.auth,
            ...(e.auth !== "public" && e.auth !== "local-dev-only" && { security: [{ bearer: [] }] }),
            parameters: e.params.map((name) => ({ name, in: "path", required: true, schema: { type: "string" } })),
            ...(["POST", "PUT", "PATCH"].includes(e.method) && {
                requestBody: { content: { [e.upload ? "multipart/form-data" : "application/json"]: { schema: { type: "object" } } } },
            }),
            responses: { 200: { description: '{ success, message, data } - check "success", errors also use HTTP 200' } },
        };
    }
    return {
        openapi: "3.0.3",
        info: {
            title: "TechX CRM API",
            version: new Date().toISOString().slice(0, 10),
            description: "Generated from the running server's routes. Logins: agency / student / admin JWT as `Authorization: Bearer <token>`. Student portal calls also send `x-agency-uuid`.",
        },
        ...(server && { servers: [{ url: server }] }),
        components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
        paths,
        "x-endpoints": endpoints,
    };
};
