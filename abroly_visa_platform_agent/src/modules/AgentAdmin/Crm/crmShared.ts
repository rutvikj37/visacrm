// Shared constants and helpers for the Lead CRM screens

export type LeadStatus =
    | "new" | "contacted" | "follow_up" | "interested" | "counselling" | "converted" | "lost" | "junk";

export type LeadSource =
    | "manual" | "website" | "portal" | "csv" | "indiamart" | "facebook" | "whatsapp" | "google" | "other"
    | "instagram" | "justdial" | "sulekha";

export const LEAD_STATUSES: { key: LeadStatus; label: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "danger" }[] = [
    { key: "new", label: "New", color: "primary" },
    { key: "contacted", label: "Contacted", color: "secondary" },
    { key: "follow_up", label: "Follow-up", color: "warning" },
    { key: "interested", label: "Interested", color: "secondary" },
    { key: "counselling", label: "Counselling", color: "primary" },
    { key: "converted", label: "Converted", color: "success" },
    { key: "lost", label: "Lost", color: "danger" },
    { key: "junk", label: "Junk", color: "default" },
];

/** Statuses a person can pick by hand ("converted" comes from the convert flow). */
export const SELECTABLE_STATUSES = LEAD_STATUSES.filter((s) => s.key !== "converted");

export const LEAD_SOURCES: { key: LeadSource; label: string }[] = [
    { key: "manual", label: "Manual" },
    { key: "website", label: "Website" },
    { key: "portal", label: "Student portal" },
    { key: "csv", label: "CSV / Excel" },
    { key: "indiamart", label: "IndiaMART" },
    { key: "facebook", label: "Facebook" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "instagram", label: "Instagram" },
    { key: "google", label: "Google Ads" },
    { key: "justdial", label: "Justdial" },
    { key: "sulekha", label: "Sulekha" },
    { key: "other", label: "Other" },
];

export const statusMeta = (status?: string) =>
    LEAD_STATUSES.find((s) => s.key === status) || { key: status as LeadStatus, label: status || "-", color: "default" as const };

export const sourceLabel = (source?: string) => LEAD_SOURCES.find((s) => s.key === source)?.label || source || "-";

export const ACTIVITY_LABELS: Record<string, string> = {
    created: "Lead created",
    note: "Note",
    call: "Call",
    email: "Email",
    whatsapp: "WhatsApp",
    status_change: "Status",
    assignment: "Assignment",
    follow_up: "Follow-up scheduled",
    follow_up_done: "Follow-up done",
    re_enquiry: "Enquired again",
    updated: "Details updated",
    converted: "Converted",
    instagram: "Instagram",
    portal: "Student portal",
};

/** Human label for a timeline row (portal events use meta.kind). */
export const activityLabel = (a: { type?: string; meta?: any }) => {
    const meta = a?.meta && typeof a.meta === "object" ? a.meta : null;
    const kind = meta?.kind;
    if (kind === "portal_invite") return "Portal invite emailed";
    if (kind === "portal_login") return "Student logged in";
    if (kind === "portal_doc_upload") return "Document uploaded";
    return ACTIVITY_LABELS[a?.type || ""] || a?.type || "Activity";
};

/** JSON columns can arrive as a string (MariaDB) or an array (MySQL). */
export const asArray = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

export const asObject = (value: any): Record<string, any> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
};

export const formatPhone = (lead: any) =>
    lead?.phone_number ? `${lead.country_code || ""} ${lead.phone_number}`.trim() : "";

export const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const timeAgo = (value?: string | null) => {
    if (!value) return "";
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDateTime(value);
};

export const followUpState = (value?: string | null): "overdue" | "today" | "upcoming" | null => {
    if (!value) return null;
    const date = new Date(value);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    if (date < start) return "overdue";
    if (date <= end) return "today";
    return "upcoming";
};

/** Value for <input type="datetime-local"> in the browser's time zone. */
export const toLocalInputValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const whatsappLink = (lead: any) => {
    const digits = (lead?.phone_normalized || "").replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
};

/** Lead score to hot / warm / cold. */
export const temperatureMeta = (score?: number | null): { key: string; label: string; color: "danger" | "warning" | "default" } => {
    const n = Number(score) || 0;
    if (n >= 70) return { key: "hot", label: "Hot", color: "danger" };
    if (n >= 40) return { key: "warm", label: "Warm", color: "warning" };
    return { key: "cold", label: "Cold", color: "default" };
};

/** Pre-convert document checklist (mirrors backend services/docChecklist.ts). */
export const DOC_CHECKLIST_ITEMS: { key: string; label: string }[] = [
    { key: "passport", label: "Passport (first & last page)" },
    { key: "photo", label: "Passport-size photo" },
    { key: "academic_10_12", label: "10th / 12th marksheets" },
    { key: "graduation", label: "Graduation docs (if any)" },
    { key: "english_test", label: "English test score (IELTS / PTE / etc.)" },
    { key: "resume", label: "Resume / CV" },
    { key: "sop", label: "SOP draft (if needed)" },
];

export const summarizeDocChecklist = (doneKeys?: any) => {
    const done = new Set(asArray(doneKeys));
    const items = DOC_CHECKLIST_ITEMS.map((i) => ({ ...i, done: done.has(i.key) }));
    const missing = items.filter((i) => !i.done);
    return {
        items,
        done_count: items.length - missing.length,
        total: items.length,
        missing: missing.map((i) => ({ key: i.key, label: i.label })),
        complete: missing.length === 0,
    };
};
