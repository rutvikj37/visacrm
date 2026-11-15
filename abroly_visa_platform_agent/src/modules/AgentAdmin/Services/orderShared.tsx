export const ORDER_STATUS: Record<string, { label: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "danger" }> = {
    new: { label: "New", color: "primary" },
    in_progress: { label: "In progress", color: "secondary" },
    delivered: { label: "Delivered", color: "success" },
    changes_requested: { label: "Changes requested", color: "warning" },
    completed: { label: "Completed", color: "default" },
};
export const ORDER_STEPS = ["new", "in_progress", "delivered", "completed"];
export const fileSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const fmtWhen = (v: string) => new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
