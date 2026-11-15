import { ReactNode } from "react";

export const FormField = ({ label, className = "", children }: { label: ReactNode; className?: string; children: ReactNode }) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
        <span className="text-xs font-medium text-default-600">{label}</span>
        {children}
    </div>
);

export const STATUS_META: Record<string, { label: string; color: "success" | "warning" | "danger" | "default" | "primary" }> = {
    trial: { label: "Free trial", color: "primary" },
    active: { label: "Active", color: "success" },
    expired: { label: "Expired", color: "danger" },
    suspended: { label: "Suspended", color: "default" },
};

export const KIND_LABEL: Record<string, string> = { trial: "Free trial", paid: "Paid", complimentary: "Complimentary" };

export const METHOD_LABEL: Record<string, string> = {
    razorpay: "Razorpay", upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", other: "Other",
};

export const rupees = (n?: number | null) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const fmtDate = (v?: string | Date | null) => {
    if (!v) return "-";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
