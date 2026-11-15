import { ReactNode, useCallback, useMemo, useState } from "react";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Selection } from "@nextui-org/react";
import { MoreVertical, X } from "lucide-react";

/** Shared pieces for admin list pages: row "..." menu, bulk-action bar, cross-page selection and CSV export. */

export type RowAction = {
    key: string;
    label: string;
    icon?: ReactNode;
    danger?: boolean;
    hidden?: boolean;
    onPress: () => void;
};

/** "..." button with a menu of actions for one row. */
export const RowActions = ({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) => {
    const shown = actions.filter((a) => !a.hidden);
    if (!shown.length) return null;
    return (
        <Dropdown placement="bottom-end">
            <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light" aria-label={label}><MoreVertical size={16} /></Button>
            </DropdownTrigger>
            <DropdownMenu aria-label={label} onAction={(key) => shown.find((a) => a.key === key)?.onPress()}>
                {shown.map((a) => (
                    <DropdownItem key={a.key} startContent={a.icon} color={a.danger ? "danger" : "default"} className={a.danger ? "text-danger" : ""}>
                        {a.label}
                    </DropdownItem>
                ))}
            </DropdownMenu>
        </Dropdown>
    );
};

/** Bar shown while rows are selected: count, extra info, bulk actions and "clear". Sticks to the bottom on phones. */
export const BulkBar = ({ count, onClear, children, extra }: { count: number; onClear: () => void; children: ReactNode; extra?: ReactNode }) => {
    if (!count) return null;
    return (
        <div className="sticky bottom-2 z-20 md:static">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 dark:bg-primary-50/20 px-3 py-2 shadow-sm">
                <span className="text-sm font-semibold">{count} selected</span>
                {extra}
                <div className="flex flex-wrap gap-1.5 md:ml-auto">{children}</div>
                <Button size="sm" variant="light" isIconOnly aria-label="Clear selection" onPress={onClear}><X size={16} /></Button>
            </div>
        </div>
    );
};

/**
 * Selection that survives paging and filtering: keeps the selected rows themselves (by id),
 * and converts to/from the Table's selectedKeys for the rows on screen.
 */
export const useCrossPageSelection = <T,>(rows: T[], getId: (row: T) => string) => {
    const [selected, setSelected] = useState<Map<string, T>>(new Map());
    const selectedKeys = useMemo(() => new Set(rows.map(getId).filter((id) => selected.has(id))), [rows, selected]);

    const onSelectionChange = useCallback((keys: Selection) => {
        setSelected((prev) => {
            const next = new Map(prev);
            for (const row of rows) {
                const id = getId(row);
                if (keys === "all" || keys.has(id)) next.set(id, row); else next.delete(id);
            }
            return next;
        });
    }, [rows]);

    const toggle = useCallback((row: T) => {
        setSelected((prev) => {
            const next = new Map(prev);
            const id = getId(row);
            if (next.has(id)) next.delete(id); else next.set(id, row);
            return next;
        });
    }, []);

    const addAll = useCallback((more: T[]) => {
        setSelected((prev) => {
            const next = new Map(prev);
            for (const row of more) next.set(getId(row), row);
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Map()), []);
    return { selected, selectedRows: [...selected.values()], ids: [...selected.keys()], selectedKeys, onSelectionChange, toggle, addAll, clear };
};

export type CsvColumn<T> = { label: string; value: (row: T) => unknown };

/** Download rows as a CSV file (opens in Excel / Google Sheets). */
export const downloadCsv = <T,>(filename: string, columns: CsvColumn<T>[], rows: T[]) => {
    const cell = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        // quote when needed; prefix formula-looking values so spreadsheets don't execute them
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Fetch every page of a paginated admin list (100 per page, capped) - used for "export all" and "select all matching". */
export const fetchAllPages = async <T,>(
    get: (url: string) => Promise<{ success: boolean; data: any }>,
    baseUrl: string,
    pick: (data: any) => T[],
    maxPages = 50,
): Promise<T[]> => {
    const out: T[] = [];
    const join = baseUrl.includes("?") ? "&" : "?";
    for (let page = 1; page <= maxPages; page++) {
        const { success, data } = await get(`${baseUrl}${join}page=${page}&limit=100`);
        if (!success) break;
        out.push(...pick(data));
        if (page >= (data?.pagination?.totalPages || 0)) break;
    }
    return out;
};

export const today = () => new Date().toISOString().slice(0, 10);
