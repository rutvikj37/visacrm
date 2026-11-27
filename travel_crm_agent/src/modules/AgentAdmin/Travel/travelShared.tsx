import { ReactNode } from "react";

/** Shared bits for the Travel CRM screens. Amounts come from the API in rupees. */

export const rupees = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const fmtDate = (v?: string | null) => {
    if (!v) return "-";
    const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtRange = (a?: string | null, b?: string | null) => (a ? `${fmtDate(a)}${b && b !== a ? ` → ${fmtDate(b)}` : ""}` : "Dates not set");

export const SERVICE_TYPES = [
    { key: "hotel", label: "Hotel" }, { key: "flight", label: "Flight" }, { key: "flight_extras", label: "Flight extras" }, { key: "train", label: "Train" },
    { key: "bus", label: "Bus" }, { key: "transfer", label: "Cab / transfer" }, { key: "land_package", label: "Land package" },
    { key: "activity", label: "Activity" }, { key: "admission", label: "Admission / entry" }, { key: "meal", label: "Meal" }, { key: "visa", label: "Visa" },
    { key: "insurance", label: "Insurance" }, { key: "forex", label: "Forex" }, { key: "other", label: "Other" },
];
/** Service types a supplier rate sheet can have (supplier_rates.service_type). */
export const RATE_TYPES = ["hotel", "transfer", "activity", "flight", "meal", "visa", "insurance", "other"];
export const serviceLabel = (k: string) => SERVICE_TYPES.find((s) => s.key === k)?.label || k;

export const DAY_ITEM_TYPES = [
    { key: "hotel", label: "Stay" }, { key: "sightseeing", label: "Sightseeing" }, { key: "transfer", label: "Transfer" },
    { key: "meal", label: "Meal" }, { key: "flight", label: "Flight" }, { key: "activity", label: "Activity" }, { key: "note", label: "Note" },
];

export const SUPPLIER_TYPES = [
    { key: "hotel", label: "Hotel" }, { key: "dmc", label: "DMC / ground handler" }, { key: "transport", label: "Transport / cab" },
    { key: "airline", label: "Airline / ticketing" }, { key: "activity", label: "Activity provider" }, { key: "other", label: "Other" },
];

export const LIBRARY_TYPES = [
    { key: "destination", label: "Destination" }, { key: "hotel", label: "Hotel" }, { key: "activity", label: "Sightseeing / activity" },
    { key: "transfer", label: "Transfer" }, { key: "meal", label: "Meal" }, { key: "note", label: "Text block" },
];

type ChipColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
export const QUOTE_STATUS: Record<string, { label: string; color: ChipColor }> = {
    draft: { label: "Draft", color: "default" }, sent: { label: "Sent", color: "primary" }, accepted: { label: "Booked", color: "success" },
    rejected: { label: "Lost", color: "danger" }, superseded: { label: "Old version", color: "default" },
};
export const BOOKING_STATUS: Record<string, { label: string; color: ChipColor }> = {
    confirmed: { label: "Confirmed", color: "primary" }, in_progress: { label: "Travelling", color: "warning" },
    completed: { label: "Completed", color: "success" }, cancelled: { label: "Cancelled", color: "default" },
};
export const SERVICE_STATUS: Record<string, { label: string; color: ChipColor }> = {
    requested: { label: "Requested", color: "warning" }, confirmed: { label: "Confirmed", color: "success" }, cancelled: { label: "Cancelled", color: "default" },
};
export const ITINERARY_STATUS: Record<string, { label: string; color: ChipColor }> = {
    draft: { label: "Draft", color: "default" }, sent: { label: "Shared", color: "primary" },
    accepted: { label: "Accepted", color: "success" }, changes_requested: { label: "Changes asked", color: "warning" },
};

/** wa.me link; phone may include + and spaces. No phone = WhatsApp lets the user pick a chat. */
export const waLink = (phone: string | null | undefined, text: string) => {
    const digits = String(phone || "").replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

export const Field = ({ label, className = "", children }: { label: ReactNode; className?: string; children: ReactNode }) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}><span className="text-xs font-medium text-default-600">{label}</span>{children}</div>
);

export const Tile = ({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "danger" | "success" }) => (
    <div className="rounded-xl border border-default-200 bg-content1 p-3 sm:p-4 min-w-0">
        <div className="text-[11px] sm:text-xs text-default-500 truncate">{label}</div>
        <div className={`text-lg sm:text-2xl font-semibold mt-0.5 truncate ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`}>{value}</div>
        {hint && <div className="text-[11px] text-default-400 truncate">{hint}</div>}
    </div>
);

export const PageHead = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{title}</h1>
            {sub && <p className="text-sm text-default-500">{sub}</p>}
        </div>
        {actions && <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">{actions}</div>}
    </div>
);

/** API base for public share links (same host as the API). */
export const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Hotel / transfer / activity vouchers for a booking (VC-01), printed from the browser (save as PDF). */
export const printVouchers = (b: any, onlyServiceId?: string) => {
    const services = (b.services || []).filter((s: any) => s.status !== "cancelled" && ["hotel", "transfer", "activity", "other"].includes(s.type) && (!onlyServiceId || s.id === onlyServiceId));
    const color = /^#[0-9a-f]{3,8}$/i.test(b.agency?.color || "") ? b.agency.color : "#0f5bd8";
    const pax = (b.travellers || []).map((t: any) => `${esc(t.name)}${t.pax_type !== "adult" ? ` (${t.pax_type})` : ""}`).join(", ");
    const pages = services.map((s: any) => `
        <section class="v">
            <div class="top"><div><div class="ag">${esc(b.agency?.name || "")}</div><div class="muted">${esc([b.agency?.phone, b.agency?.email].filter(Boolean).join(" · "))}</div></div>
            <div class="right"><div class="kind">${esc(serviceLabel(s.type))} voucher</div><div class="muted">${esc(b.booking_no)}</div></div></div>
            <table>
                <tr><th>Service</th><td>${esc(s.description)}</td></tr>
                <tr><th>Supplier</th><td>${esc(s.supplier_name || "-")}${s.supplier_contact?.phone ? ` · ${esc(s.supplier_contact.phone)}` : ""}</td></tr>
                <tr><th>Confirmation no.</th><td><b>${esc(s.confirmation_no || "Pending")}</b></td></tr>
                <tr><th>Date</th><td>${esc(fmtRange(s.service_date, s.end_date))}</td></tr>
                ${Object.entries(s.details || {}).filter(([k, v]) => v && !["qty", "nights"].includes(k)).map(([k, v]) => `<tr><th>${esc(k.replace(/_/g, " "))}</th><td>${esc(v)}</td></tr>`).join("")}
                <tr><th>Guests</th><td>${pax || esc(b.client?.name || "")}</td></tr>
                <tr><th>Lead guest phone</th><td>${esc(b.client?.phone || "")}</td></tr>
            </table>
            <p class="muted">Please show this voucher at check-in / pick-up. For help call ${esc(b.agency?.phone || "your travel consultant")}.</p>
        </section>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vouchers ${esc(b.booking_no)}</title><style>
        body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:0;padding:24px}
        .v{border:1px solid #ddd;border-radius:12px;padding:20px;margin:0 auto 24px;max-width:720px;break-inside:avoid;page-break-after:always}
        .top{display:flex;justify-content:space-between;border-bottom:3px solid ${color};padding-bottom:12px;margin-bottom:12px}
        .ag{font-weight:700;font-size:18px}.kind{font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em}.right{text-align:right}
        table{width:100%;border-collapse:collapse}th{text-align:left;width:34%;color:#555;font-weight:500;text-transform:capitalize}th,td{padding:7px 4px;border-bottom:1px solid #eee;vertical-align:top}
        .muted{color:#666;font-size:12px}@media print{body{padding:0}.v{border:0}}
    </style></head><body>${pages || "<p>No hotel, transfer or activity services on this booking yet.</p>"}<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
};
