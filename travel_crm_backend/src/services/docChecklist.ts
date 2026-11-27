/**
 * Pre-convert document checklist for CRM leads.
 * Practical defaults for study-abroad agencies; agencies can override labels via settings later.
 * Stored on the lead as doc_checklist: string[] of completed item keys.
 */

export interface DocChecklistItem {
    key: string;
    label: string;
}

export const DEFAULT_DOC_CHECKLIST: DocChecklistItem[] = [
    { key: "passport", label: "Passport (first & last page)" },
    { key: "photo", label: "Passport-size photo" },
    { key: "academic_10_12", label: "10th / 12th marksheets" },
    { key: "graduation", label: "Graduation docs (if any)" },
    { key: "english_test", label: "English test score (IELTS / PTE / etc.)" },
    { key: "resume", label: "Resume / CV" },
    { key: "sop", label: "SOP draft (if needed)" },
];

export const normalizeDocChecklist = (value: any): string[] => {
    if (!Array.isArray(value)) return [];
    const allowed = new Set(DEFAULT_DOC_CHECKLIST.map((i) => i.key));
    return [...new Set(value.map((v) => String(v).trim()).filter((k) => allowed.has(k)))];
};

export const checklistSummary = (doneKeys: any) => {
    const done = new Set(normalizeDocChecklist(doneKeys));
    const items = DEFAULT_DOC_CHECKLIST.map((i) => ({ ...i, done: done.has(i.key) }));
    const missing = items.filter((i) => !i.done);
    return {
        items,
        done_count: items.length - missing.length,
        total: items.length,
        missing: missing.map((i) => ({ key: i.key, label: i.label })),
        complete: missing.length === 0,
    };
};
