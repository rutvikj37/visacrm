export const CASE_STAGES = [
    { key: "documents", label: "Documents" },
    { key: "application", label: "Application" },
    { key: "offer", label: "Offer" },
    { key: "funds", label: "Fees & funds" },
    { key: "visa_filed", label: "Visa filed" },
    { key: "biometrics", label: "Biometrics" },
    { key: "decision", label: "Decision" },
];

export const OUTCOMES = [
    { key: "approved", label: "Approved", color: "success" as const },
    { key: "rejected", label: "Rejected", color: "danger" as const },
    { key: "withdrawn", label: "Withdrawn", color: "default" as const },
];

export const stageLabel = (key?: string | null) => CASE_STAGES.find((s) => s.key === key)?.label || key || "-";

export const fmtShortDate = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const isOverdue = (v?: string | null) => Boolean(v) && String(v).slice(0, 10) < new Date().toISOString().slice(0, 10);
