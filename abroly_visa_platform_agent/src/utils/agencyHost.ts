import { useEffect, useState } from "react";
import axios from "axios";
import { applyBrand } from "@/lib/theme";

/**
 * Each agency's panel lives on the agency's own address, next to its student portal:
 *   https://rutvik.techxsolutions.io/agency/   (or https://<their own domain>/agency/)
 * The platform's own hosts (crm/admin/api/student/www.techxsolutions.io) and local dev are not agency addresses.
 */
const PLATFORM_DOMAIN = String(import.meta.env.VITE_PLATFORM_DOMAIN || "techxsolutions.io").toLowerCase();
const PLATFORM_HOSTS = ["crm", "admin", "api", "student", "www"];

/** "rutvik.techxsolutions.io" when the panel is opened on that agency's address, else null */
export const getAgencyHost = (): string | null => {
    let h = window.location.hostname.toLowerCase();
    if (!h.includes(".") || /^[\d.]+$/.test(h) || h.endsWith(".localhost") || h === PLATFORM_DOMAIN) return null;
    if (h.startsWith("crm.") && h.slice(4) !== PLATFORM_DOMAIN) h = h.slice(4); // old crm.<agency> links
    const [first, ...rest] = h.split(".");
    if (rest.join(".") === PLATFORM_DOMAIN && PLATFORM_HOSTS.includes(first)) return null;
    return h;
};

export type AgencyBrand = { name: string; logo: string | null; color: string | null };

/** The agency of this panel address (name, logo, colour) for the login page; null on the shared panel. */
export const useAgencyBrand = () => {
    const host = getAgencyHost();
    const [brand, setBrand] = useState<AgencyBrand | null>(null);
    useEffect(() => {
        if (!host) return;
        const parts = host.split(".");
        const params = parts.length >= 3 ? { sudomain: parts[0], domain: parts.slice(1).join(".") } : { domain: host };
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/v1/agent/get_agency`, { params })
            .then(({ data }) => {
                const d = data?.data;
                if (!data?.success || !d) return;
                const logo = d.favicon_url_full || d.faviconUrlFull || (/^https?:\/\//.test(String(d.favicon_url || "")) ? d.favicon_url : null);
                setBrand({ name: d.app_name || d.username || "Agency", logo: logo || null, color: d.primary_color || null });
                if (d.primary_color) applyBrand(d.primary_color, d.primary_foreground_color);
                if (d.app_name) document.title = `${d.app_name} - Agency panel`;
            })
            .catch(() => { /* fall back to the platform look */ });
    }, [host]);
    return { host, brand };
};
