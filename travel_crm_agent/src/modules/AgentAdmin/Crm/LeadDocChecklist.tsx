import { Checkbox } from "@heroui/react";
import { FileCheck2 } from "lucide-react";
import { DOC_CHECKLIST_ITEMS, summarizeDocChecklist } from "./crmShared";

interface Props {
    /** Completed item keys, or a summary object from the API */
    value?: string[] | { items?: { key: string; label: string; done: boolean }[]; done_count?: number; total?: number; complete?: boolean };
    onChange?: (doneKeys: string[]) => void;
    /** When true, checkboxes are read-only (e.g. convert modal preview) */
    readOnly?: boolean;
    compact?: boolean;
    className?: string;
}

const LeadDocChecklist = ({ value, onChange, readOnly = false, compact = false, className = "" }: Props) => {
    const summary = Array.isArray(value) || value == null
        ? summarizeDocChecklist(value)
        : {
            items: value.items?.length
                ? value.items
                : DOC_CHECKLIST_ITEMS.map((i) => ({ ...i, done: false })),
            done_count: value.done_count ?? 0,
            total: value.total ?? DOC_CHECKLIST_ITEMS.length,
            complete: value.complete ?? false,
            missing: (value.items || []).filter((i) => !i.done).map((i) => ({ key: i.key, label: i.label })),
        };

    const toggle = (key: string, checked: boolean) => {
        if (readOnly || !onChange) return;
        const current = summary.items.filter((i) => i.done).map((i) => i.key);
        const next = checked ? [...new Set([...current, key])] : current.filter((k) => k !== key);
        onChange(next);
    };

    return (
        <div className={`rounded-xl border border-default-200 p-3 ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                <FileCheck2 size={16} className="text-default-500 shrink-0" />
                <div className="text-sm font-medium flex-1">Documents before convert</div>
                <span className={`text-xs ${summary.complete ? "text-success" : "text-default-500"}`}>
                    {summary.done_count}/{summary.total}
                </span>
            </div>
            {!compact && (
                <p className="text-xs text-default-500 mb-2">
                    Tick what you already have. Missing items show a warning when you convert — you can still continue after confirming.
                </p>
            )}
            <ul className="space-y-1.5">
                {summary.items.map((item) => (
                    <li key={item.key}>
                        <Checkbox
                            size="sm"
                            isSelected={item.done}
                            isReadOnly={readOnly}
                            onValueChange={(v) => toggle(item.key, v)}
                        >
                            <span className={`text-sm ${item.done ? "text-default-700" : "text-default-600"}`}>{item.label}</span>
                        </Checkbox>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default LeadDocChecklist;
