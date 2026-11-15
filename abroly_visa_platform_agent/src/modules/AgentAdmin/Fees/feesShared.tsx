import { ReactNode } from "react";

export const rupees = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const fmtDate = (v?: string | null) => {
    if (!v) return "-";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
export const STATUS: Record<string, { label: string; color: "warning" | "primary" | "success" | "default" }> = {
    unpaid: { label: "Unpaid", color: "warning" },
    partial: { label: "Part paid", color: "primary" },
    paid: { label: "Paid", color: "success" },
    cancelled: { label: "Cancelled", color: "default" },
};
export const METHODS = [
    { key: "upi", label: "UPI" }, { key: "cash", label: "Cash" }, { key: "bank_transfer", label: "Bank transfer" },
    { key: "card", label: "Card" }, { key: "cheque", label: "Cheque" }, { key: "razorpay", label: "Razorpay" }, { key: "other", label: "Other" },
];
export const methodLabel = (k: string) => METHODS.find((m) => m.key === k)?.label || k;

export const Field = ({ label, className = "", children }: { label: ReactNode; className?: string; children: ReactNode }) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}><span className="text-xs font-medium text-default-600">{label}</span>{children}</div>
);
