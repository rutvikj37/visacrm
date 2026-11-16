/**
 * The agency panel is served under /agency/ on each agency's own address
 * (e.g. https://rutvik.techxsolutions.io/agency/), next to the student portal at "/".
 * Vite's `base` sets BASE_URL to "/agency/".
 */

/** "/agency" (no trailing slash): React Router basename */
export const APP_BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** In-app path for window.open / location changes: appPath("/crm/leads") -> "/agency/crm/leads" */
export const appPath = (p = "/") => `${APP_BASE}${p.startsWith("/") ? p : `/${p}`}`;

/** File from public/: publicAsset("logo.png") -> "/agency/logo.png" */
export const publicAsset = (file: string) => `${import.meta.env.BASE_URL}${file.replace(/^\/+/, "")}`;
