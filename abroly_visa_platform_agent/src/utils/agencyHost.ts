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
    // local dev: VITE_DEV_AGENCY_HOST=rutvik.techxsolutions.io previews the panel as that agency's address
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_AGENCY_HOST) return String(import.meta.env.VITE_DEV_AGENCY_HOST).toLowerCase();
    let h = window.location.hostname.toLowerCase();
    if (!h.includes(".") || /^[\d.]+$/.test(h) || h.endsWith(".localhost") || h === PLATFORM_DOMAIN) return null;
    if (h.startsWith("crm.") && h.slice(4) !== PLATFORM_DOMAIN) h = h.slice(4); // old crm.<agency> links
    const [first, ...rest] = h.split(".");
    if (rest.join(".") === PLATFORM_DOMAIN && PLATFORM_HOSTS.includes(first)) return null;
    return h;
};

export type AgencyBrand = {
    name: string; logo: string | null; color: string | null;
    phone?: string | null; email?: string | null; address?: string | null;
    website?: string | null; tagline?: string | null; focus?: "study" | "travel" | "both";
};

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
                const phone = d.support_number || d.phone_number;
                setBrand({
                    name: d.app_name || d.username || "Agency", logo: logo || null, color: d.primary_color || null,
                    phone: phone ? `${String(phone).startsWith("+") ? "" : `${d.country_code || "+91"} `}${phone}` : null,
                    email: d.support_email || null, address: d.agency_address || null,
                    website: d.og_url || null, tagline: d.meta_description || null,
                    focus: ["study", "travel", "both"].includes(d.business_focus) ? d.business_focus : "study",
                });
                if (d.primary_color) applyBrand(d.primary_color, d.primary_foreground_color);
                if (d.app_name) document.title = `${d.app_name} - Agency panel`;
            })
            .catch(() => { /* fall back to the platform look */ });
    }, [host]);
    return { host, brand };
};
