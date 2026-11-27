import { useEffect, useState } from "react";
import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { BookmarkPlus, Lock, Plus, Trash2, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { Field, fmtDate, rupees } from "../travelShared";
import { Panel, useQuote } from "./QuoteContext";

type Lib = { inclusions: string[]; exclusions: string[]; terms: string[] };
const STARTER: Lib = {
    inclusions: ["Accommodation on twin sharing basis", "Daily breakfast at the hotel", "All transfers and sightseeing by private vehicle", "Driver allowance, tolls, parking and fuel", "All applicable hotel taxes"],
    exclusions: ["Airfare / train fare unless mentioned", "Lunch and dinner unless mentioned", "Entry tickets, activities and camera fees", "Personal expenses like laundry, tips and phone calls", "Anything not mentioned under inclusions"],
    terms: ["Rates are subject to availability at the time of booking.", "Hotel check-in is 2 PM and check-out is 12 noon.", "Cancellation charges apply as per the hotel and supplier policy.", "Prices may change if travel dates or the number of travellers change.", "A valid photo ID is required for every traveller."],
};
const lines = (text?: string) => String(text || "").split(/\n+/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
const PRESETS = [
    { label: "100% on booking", terms: [{ label: "Full payment", percent: 100, due: "booking" }] },
    { label: "50% now · 50% before travel", terms: [{ label: "Advance", percent: 50, due: "booking" }, { label: "Balance", percent: 50, due: "before_travel", days: 15 }] },
    { label: "30% now · 70% before travel", terms: [{ label: "Advance", percent: 30, due: "booking" }, { label: "Balance", percent: 70, due: "before_travel", days: 21 }] },
];

/** Step 5: inclusions, exclusions, payment terms, terms & conditions and notes. */
const StepTerms = () => {
    const { q, set, t, lines: services, canEdit } = useQuote();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [lib, setLib] = useState<Lib>({ inclusions: [], exclusions: [], terms: [] });
    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/travel/settings");
            if (success) setLib({ inclusions: data?.quote_library?.inclusions || [], exclusions: data?.quote_library?.exclusions || [], terms: data?.quote_library?.terms || [] });
        })();
    }, []);

    const saveToLib = async (key: keyof Lib) => {
        const next = { ...lib, [key]: [...new Set([...lib[key], ...lines(q[key])])] };
        const { success } = await commonPostAPICall({ quote_library: next }, "travel/settings");
        if (success) { setLib(next); SuccessToast("Saved to your list - pick them on any quote"); }
    };

    const terms: any[] = q.payment_terms || [];
    const sum = terms.reduce((a, p) => a + (Number(p.percent) || 0), 0);
    const setTerms = (next: any[]) => set({ payment_terms: next });
    const amountOf = (p: any) => Math.round(t.total * (Number(p.percent) || 0) / 100);
    const dueText = (p: any) => {
        if (p.due === "before_travel") {
            const d = q.trip?.start_date ? new Date(Date.parse(`${q.trip.start_date}T00:00:00`) - (Number(p.days) || 0) * 864e5).toISOString().slice(0, 10) : null;
            return `${p.days || 0} days before travel${d ? ` (${fmtDate(d)})` : ""}`;
        }
        return p.due === "date" ? (p.date ? fmtDate(p.date) : "pick a date") : "on booking";
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Mini k="Customer" v={q.lead?.name || "-"} />
                <Mini k="Destination" v={`${q.trip?.place || q.trip?.state || q.trip?.country || "-"} (${q.trip?.destination_type === "international" ? "International" : "Domestic"})`} />
                <Mini k="Services" v={`${services.length} selected`} />
                <Mini k="Total payable" v={rupees(Math.round(t.total))} strong />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <BulletPanel title="Inclusions" sub="What the price covers (customer sees this)" field="inclusions" lib={lib.inclusions.length ? lib.inclusions : STARTER.inclusions} onSaveLib={() => saveToLib("inclusions")} />
                <BulletPanel title="Exclusions" sub="What the price does not cover" field="exclusions" lib={lib.exclusions.length ? lib.exclusions : STARTER.exclusions} onSaveLib={() => saveToLib("exclusions")} />
            </div>

            <Panel title="Payment terms" sub={terms.length ? `Adds up to ${sum}%${Math.abs(sum - 100) > 0.01 ? " - must be 100%" : ""}` : "Not set - by default the customer pays in full on booking"}>
                <div className="flex flex-wrap gap-2 mb-3">
                    {PRESETS.map((p) => <Button key={p.label} size="sm" variant="flat" isDisabled={!canEdit} onPress={() => setTerms(p.terms)}>{p.label}</Button>)}
                </div>
                <div className="flex flex-col gap-2">
                    {terms.map((p, i) => (
                        <div key={i} className="grid grid-cols-2 sm:grid-cols-[1.2fr_90px_1.2fr_1fr_auto] gap-2 items-end rounded-xl border border-default-200 p-2.5">
                            <Field label="Label"><Input aria-label="Label" size="sm" isDisabled={!canEdit} value={p.label || ""} onValueChange={(v) => setTerms(terms.map((x, j) => (j === i ? { ...x, label: v } : x)))} /></Field>
                            <Field label="%"><Input aria-label="Percent" size="sm" type="number" min={0} max={100} isDisabled={!canEdit} value={String(p.percent ?? "")} onValueChange={(v) => setTerms(terms.map((x, j) => (j === i ? { ...x, percent: Number(v) || 0 } : x)))} /></Field>
                            <Field label="When">
                                <div className="flex gap-1.5">
                                    <Select aria-label="When" size="sm" isDisabled={!canEdit} selectedKeys={[p.due || "booking"]} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, due: e.target.value || "booking" } : x)))}>
                                        <SelectItem key="booking">On booking</SelectItem><SelectItem key="before_travel">Days before travel</SelectItem><SelectItem key="date">On a date</SelectItem>
                                    </Select>
                                    {p.due === "before_travel" && <Input aria-label="Days" size="sm" className="w-20 shrink-0" type="number" min={0} isDisabled={!canEdit} value={String(p.days ?? "")} onValueChange={(v) => setTerms(terms.map((x, j) => (j === i ? { ...x, days: Number(v) || 0 } : x)))} />}
                                    {p.due === "date" && <Input aria-label="Date" size="sm" className="w-36 shrink-0" type="date" isDisabled={!canEdit} value={p.date || ""} onValueChange={(v) => setTerms(terms.map((x, j) => (j === i ? { ...x, date: v } : x)))} />}
                                </div>
                            </Field>
                            <div className="text-sm pb-2"><div className="font-semibold">{rupees(amountOf(p))}</div><div className="text-[11px] text-default-500">{dueText(p)}</div></div>
                            {canEdit && <Button isIconOnly size="sm" variant="light" aria-label="Remove" onPress={() => setTerms(terms.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>}
                        </div>
                    ))}
                    {canEdit && <Button size="sm" variant="light" className="self-start" startContent={<Plus size={14} />} onPress={() => setTerms([...terms, { label: terms.length ? "Balance" : "Advance", percent: Math.max(0, 100 - sum), due: terms.length ? "before_travel" : "booking", days: 15 }])}>Add instalment</Button>}
                </div>
            </Panel>

            <TermsPanel lib={lib.terms.length ? lib.terms : STARTER.terms} onSaveLib={() => saveToLib("terms")} />

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Notes for the customer" sub="Printed on the quote">
                    <Textarea aria-label="Notes" minRows={3} isDisabled={!canEdit} value={q.notes || ""} onValueChange={(v) => set({ notes: v })} />
                </Panel>
                <Panel title={<span className="flex items-center gap-1.5"><Lock size={14} /> Internal notes</span>} sub="Only your team sees these">
                    <Textarea aria-label="Internal notes" minRows={3} isDisabled={!canEdit} value={q.internal_notes || ""} onValueChange={(v) => set({ internal_notes: v })} />
                </Panel>
            </div>
        </div>
    );
};

const Mini = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className="rounded-xl border border-default-200 bg-content1 px-3 py-2.5 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-default-500">{k}</div>
        <div className={`truncate ${strong ? "text-lg font-semibold text-primary" : "text-sm font-medium"}`}>{v}</div>
    </div>
);

/** A bullet list typed one point per line, with the saved list as tap-to-add chips. */
const BulletPanel = ({ title, sub, field, lib, onSaveLib }: { title: string; sub: string; field: "inclusions" | "exclusions"; lib: string[]; onSaveLib: () => void }) => {
    const { q, set, canEdit } = useQuote();
    const items = lines(q[field]);
    const [draft, setDraft] = useState("");
    const setItems = (next: string[]) => set({ [field]: next.join("\n") });
    const add = (text: string) => { const v = text.trim(); if (v && !items.includes(v)) setItems([...items, v]); };
    const unused = lib.filter((x) => !items.includes(x));
    return (
        <Panel title={title} sub={sub} right={canEdit && items.length > 0 ? <Button size="sm" variant="light" startContent={<BookmarkPlus size={14} />} onPress={onSaveLib}>Save to my list</Button> : undefined}>
            <ul className="flex flex-col gap-1.5 mb-3">
                {items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm group">
                        <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${field === "inclusions" ? "bg-success" : "bg-danger"}`} />
                        <span className="flex-1">{it}</span>
                        {canEdit && <button type="button" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-default-300 hover:text-danger"><X size={14} /></button>}
                    </li>
                ))}
                {!items.length && <li className="text-sm text-default-400">Nothing yet - type a point or tap a suggestion.</li>}
            </ul>
            {canEdit && <Input aria-label={`Add ${title}`} size="sm" placeholder="Type a point and press Enter" value={draft} onValueChange={setDraft} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); setDraft(""); } }} />}
            {canEdit && unused.length > 0 && (
                <div className="mt-3">
                    <div className="text-[11px] text-default-500 mb-1.5">Quick add</div>
                    <div className="flex flex-wrap gap-1.5">
                        {unused.slice(0, 12).map((x) => <button key={x} type="button" onClick={() => add(x)} className="text-xs rounded-full border border-dashed border-default-300 px-2.5 py-1 hover:border-primary hover:text-primary text-left">+ {x}</button>)}
                    </div>
                </div>
            )}
        </Panel>
    );
};

/** Terms & conditions: tick the saved ones that should print, add your own. */
const TermsPanel = ({ lib, onSaveLib }: { lib: string[]; onSaveLib: () => void }) => {
    const { q, set, canEdit } = useQuote();
    const items = lines(q.terms);
    const [draft, setDraft] = useState("");
    const setItems = (next: string[]) => set({ terms: next.join("\n") });
    const all = [...new Set([...lib, ...items])];
    return (
        <Panel title="Terms & conditions" sub={`${items.length} of ${all.length} terms will print on the quote`} right={canEdit && items.length > 0 ? <Button size="sm" variant="light" startContent={<BookmarkPlus size={14} />} onPress={onSaveLib}>Save to my list</Button> : undefined}>
            <div className="flex flex-col gap-1">
                {all.map((x) => {
                    const on = items.includes(x);
                    return (
                        <label key={x} className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm ${canEdit ? "cursor-pointer hover:bg-default-50" : ""}`}>
                            <input type="checkbox" className="mt-0.5 accent-[hsl(var(--heroui-primary))]" disabled={!canEdit} checked={on} onChange={() => setItems(on ? items.filter((i) => i !== x) : [...items, x])} />
                            <span className={on ? "" : "text-default-500"}>{x}</span>
                        </label>
                    );
                })}
            </div>
            {canEdit && <Input aria-label="Add a term" size="sm" className="mt-2" placeholder="Add your own term and press Enter" value={draft} onValueChange={setDraft} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = draft.trim(); if (v && !items.includes(v)) setItems([...items, v]); setDraft(""); } }} />}
        </Panel>
    );
};

export default StepTerms;
