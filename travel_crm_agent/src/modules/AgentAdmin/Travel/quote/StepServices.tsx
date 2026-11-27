import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem, Button, Input, Select, SelectItem, Switch } from "@heroui/react";
import { Check, ChevronDown, ChevronUp, Copy, Info, Plus, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { Field, rupees } from "../travelShared";
import { Choice, Panel, ServiceIcon, SumRow, useQuote } from "./QuoteContext";
import { Line, QUOTE_SERVICES, blankLine, describe, lineCost, lineHidden, lineMarkup, nightsBetween, serviceDef } from "./quoteKit";

const SUB = [
    { n: 1, title: "Add services", sub: "What's included" },
    { n: 2, title: "Service details", sub: "Route, dates, hotel" },
    { n: 3, title: "Cost & margin", sub: "Cost, margin, GST" },
];

/** Step 2: pick services, fill their details, then cost, margin and GST. */
const StepServices = () => {
    const { q, lines, options, oi, setOi, setOptions, canEdit, seesCost } = useQuote();
    const [sub, setSub] = useState(lines.length ? (lines.some((l) => Number(l.unit_cost) > 0) ? 3 : 2) : 1);

    return (
        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
            <aside className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
                {SUB.map((s) => {
                    const on = s.n === sub, done = s.n < sub;
                    return (
                        <button key={s.n} type="button" onClick={() => setSub(s.n)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left min-w-[170px] lg:min-w-0 border ${on ? "border-primary bg-primary-50 dark:bg-primary/10" : "border-transparent hover:bg-default-100"}`}>
                            <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold shrink-0 ${on || done ? "bg-primary text-primary-foreground" : "bg-default-100 text-default-500"}`}>{done ? <Check size={14} /> : s.n}</span>
                            <span className="min-w-0"><span className={`block text-sm font-medium ${on ? "text-primary" : ""}`}>{s.title}</span><span className="block text-[11px] text-default-500 truncate">{s.sub}</span></span>
                        </button>
                    );
                })}
                {lines.length > 0 && (
                    <div className="hidden lg:block mt-2 rounded-xl border border-default-200 p-3">
                        <div className="text-[10px] font-semibold tracking-wide text-default-500 uppercase mb-2">In this quote</div>
                        <div className="flex flex-col gap-1.5">
                            {lines.map((l, i) => <div key={i} className="flex items-center gap-2 text-xs"><ServiceIcon type={l.service_type} size={11} /><span className="truncate">{describe(l) || serviceDef(l.service_type).label}</span></div>)}
                        </div>
                    </div>
                )}
            </aside>

            <div className="flex flex-col gap-4 min-w-0">
                {/* options: Standard / Deluxe / Luxury */}
                <div className="flex flex-wrap items-center gap-2">
                    {options.map((o, i) => (
                        <button key={i} type="button" onClick={() => setOi(i)} className={`px-3 py-1.5 rounded-full text-sm border ${i === oi ? "bg-primary text-primary-foreground border-primary" : "border-default-200 hover:border-default-400"}`}>{o.name}</button>
                    ))}
                    {canEdit && options.length < 3 && <Button size="sm" variant="light" startContent={<Copy size={13} />} onPress={() => { setOptions((os) => [...os, { name: ["Standard", "Deluxe", "Luxury"][os.length] || `Option ${os.length + 1}`, lines: (os[oi]?.lines || []).map((l) => ({ ...l, details: { ...l.details } })) }]); setOi(options.length); }}>Add another option</Button>}
                    {canEdit && options.length > 1 && (
                        <>
                            <Input aria-label="Option name" size="sm" className="w-36 ml-auto" value={options[oi]?.name || ""} onValueChange={(v) => setOptions((os) => os.map((o, i) => (i === oi ? { ...o, name: v } : o)))} />
                            <Button size="sm" variant="light" color="danger" onPress={() => { setOptions((os) => os.filter((_, i) => i !== oi)); setOi(0); }}>Remove</Button>
                        </>
                    )}
                </div>

                {sub === 1 && <AddServices onDone={() => setSub(2)} />}
                {sub === 2 && <ServiceDetails onDone={() => setSub(3)} />}
                {sub === 3 && (seesCost ? <CostStep /> : <Panel title="Cost & margin"><p className="text-sm text-default-500">Costs are hidden for your role.</p></Panel>)}
                {q.is_international === false && lines.length >= 2 && <p className="text-xs text-default-500 flex items-center gap-1.5"><Info size={13} /> Two or more services make this a tour package for GST.</p>}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------- 1. add services

const AddServices = ({ onDone }: { onDone: () => void }) => {
    const { lines, setLines, canEdit } = useQuote();
    const count = (k: string) => lines.filter((l) => l.service_type === k).length;
    return (
        <Panel title="What's included in this quote?" sub="Tap every service the traveller is paying for. Tap again to add another of the same.">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {QUOTE_SERVICES.map((s) => {
                    const n = count(s.key);
                    return (
                        <button key={s.key} type="button" disabled={!canEdit} onClick={() => setLines((ls) => [...ls, blankLine(s.key)])}
                            className={`relative flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${n ? "border-primary bg-primary-50/60 dark:bg-primary/10" : "border-default-200 hover:border-default-400"}`}>
                            <ServiceIcon type={s.key} size={15} />
                            <span className="text-sm font-medium">{s.label}</span>
                            {n > 0 && <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">{n}</span>}
                        </button>
                    );
                })}
            </div>
            {lines.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {lines.map((l, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-default-200 pl-1 pr-2 py-1 text-xs">
                            <ServiceIcon type={l.service_type} size={10} />{serviceDef(l.service_type).label}
                            {canEdit && <button type="button" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-default-400 hover:text-danger"><Trash2 size={12} /></button>}
                        </span>
                    ))}
                </div>
            )}
            <div className="mt-4 flex justify-end"><Button color="primary" variant="flat" isDisabled={!lines.length} onPress={onDone}>Continue to details</Button></div>
        </Panel>
    );
};

// ---------------------------------------------------------------- 2. details

const ServiceDetails = ({ onDone }: { onDone: () => void }) => {
    const { q, lines, setLines, canEdit } = useQuote();
    const [open, setOpen] = useState<number | null>(0);
    const setDetail = (i: number, key: string, value: string) => setLines((ls) => {
        const l = { ...ls[i], details: { ...ls[i].details, [key]: value } };
        // hotel: nights and rooms follow the dates and room count
        if (l.service_type === "hotel" && (key === "check_in" || key === "check_out")) l.nights = nightsBetween(l.details.check_in, l.details.check_out);
        if (l.service_type === "hotel" && key === "rooms") l.qty = Math.max(1, Number(value) || 1);
        ls[i] = l;
        return ls;
    });
    if (!lines.length) return <Panel title="Service details"><p className="text-sm text-default-500">Add a service first.</p></Panel>;
    const trip = q.trip || {};
    return (
        <div className="flex flex-col gap-3">
            {lines.map((l, i) => {
                const def = serviceDef(l.service_type);
                const missing = def.fields.filter((f) => f.required && !l.details?.[f.key]).length;
                const isOpen = open === i;
                return (
                    <section key={i} className={`rounded-2xl border bg-content1 shadow-sm ${isOpen ? "border-primary/50" : "border-default-200"}`}>
                        <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="w-full flex items-center gap-3 p-3 sm:p-4 text-left">
                            <ServiceIcon type={l.service_type} />
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-default-500">{def.label} {lines.filter((x) => x.service_type === l.service_type).length > 1 ? lines.slice(0, i + 1).filter((x) => x.service_type === l.service_type).length : ""}</div>
                                <div className="text-sm font-medium truncate">{describe(l) || "Add details"}</div>
                            </div>
                            {missing > 0 ? <span className="text-[11px] text-warning-600 bg-warning-50 rounded-full px-2 py-0.5">{missing} to fill</span> : <Check size={16} className="text-success" />}
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isOpen && (
                            <div className="px-3 sm:px-4 pb-4 border-t border-default-100 pt-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {def.fields.map((f) => (
                                        <Field key={f.key} label={<>{f.label}{f.required && <span className="text-danger"> *</span>}</>} className={f.wide ? "col-span-2" : ""}>
                                            {f.type === "select" ? (
                                                <Select aria-label={f.label} size="sm" isDisabled={!canEdit} selectedKeys={l.details?.[f.key] ? [l.details[f.key]] : []} onChange={(e) => setDetail(i, f.key, e.target.value)}>
                                                    {(f.options || []).map((o) => <SelectItem key={o}>{o}</SelectItem>)}
                                                </Select>
                                            ) : (
                                                <Input aria-label={f.label} size="sm" isDisabled={!canEdit} type={f.type || "text"} placeholder={f.placeholder}
                                                    min={f.type === "date" ? trip.start_date || undefined : undefined}
                                                    value={l.details?.[f.key] || (f.type === "date" && !l.details?.[f.key] ? "" : "")}
                                                    onValueChange={(v) => setDetail(i, f.key, v)} />
                                            )}
                                        </Field>
                                    ))}
                                    <Field label="Customer wording (optional)" className="col-span-2 md:col-span-4">
                                        <Input aria-label="Customer wording" size="sm" isDisabled={!canEdit} placeholder={describe(l) || "How this line reads on the quote"} value={l.details?.wording || ""} onValueChange={(v) => setDetail(i, "wording", v)} />
                                    </Field>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {canEdit && <Button size="sm" variant="flat" startContent={<Plus size={13} />} onPress={() => { setLines((ls) => { ls.splice(i + 1, 0, blankLine(l.service_type)); return ls; }); setOpen(i + 1); }}>Add another {def.label.toLowerCase()}</Button>}
                                    {canEdit && <Button size="sm" variant="light" color="danger" startContent={<Trash2 size={13} />} onPress={() => { setLines((ls) => ls.filter((_, j) => j !== i)); setOpen(null); }}>Remove</Button>}
                                    {/* quick fill from trip dates */}
                                    {canEdit && trip.start_date && def.fields.some((f) => f.type === "date") && (
                                        <Button size="sm" variant="light" onPress={() => {
                                            const map: Record<string, string> = { check_in: trip.start_date, check_out: trip.end_date, travel_date: trip.start_date, date: trip.start_date, start_date: trip.start_date, end_date: trip.end_date };
                                            def.fields.filter((f) => f.type === "date" && map[f.key] && !l.details?.[f.key]).forEach((f) => setDetail(i, f.key, map[f.key]));
                                        }}>Use trip dates</Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                );
            })}
            <div className="flex justify-end"><Button color="primary" variant="flat" onPress={onDone}>Continue to cost</Button></div>
        </div>
    );
};

// ---------------------------------------------------------------- 3. cost, margin, GST

const CostStep = () => {
    const { q, set, lines, setLines, t, canEdit } = useQuote();
    const { commonGetAPICalls } = useApiCallUtils();
    const [rates, setRates] = useState<any[]>([]);
    const searchRates = async (text: string) => {
        const date = q.trip?.start_date ? `&date=${q.trip.start_date}` : "";
        const { success, data } = await commonGetAPICalls(`/travel/suppliers/rates?search=${encodeURIComponent(text)}${date}`);
        if (success) setRates(data || []);
    };
    useEffect(() => { searchRates(""); }, []);

    const combined = q.cost_mode === "combined";
    const rate = Number(q.gst_percent) || 0;
    const setBilling = (mode: string) => set({ billing_mode: mode, gst_percent: mode === "margin" ? q.tax_defaults?.gst_margin_percent ?? 18 : q.tax_defaults?.gst_full_value_percent ?? 5 });
    const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => { ls[i] = { ...ls[i], ...patch }; return ls; });
    const switchMode = (mode: string) => {
        if (mode === "combined" && lines.length) {
            // roll every cost into the first service
            const cost = lines.reduce((a, l) => a + lineCost(l), 0), markup = lines.reduce((a, l) => a + lineMarkup(l), 0), hidden = lines.reduce((a, l) => a + lineHidden(l), 0);
            setLines((ls) => ls.map((l, i) => ({ ...l, qty: i === 0 ? 1 : l.qty, nights: i === 0 ? 0 : l.nights, unit_cost: i === 0 ? cost : 0, markup_type: "flat", markup_value: i === 0 ? markup : 0, hidden_markup: i === 0 ? hidden : 0, details: { ...l.details, cost_basis: "total" } })));
        }
        set({ cost_mode: mode });
    };
    const fee = t.processing + t.hidden;
    const example = q.billing_mode === "margin" ? fee : t.sell;

    return (
        <div className="flex flex-col gap-4">
            <Panel title="1 · How do you want to enter the cost?">
                <Choice disabled={!canEdit} value={combined ? "combined" : "per_service"} onChange={switchMode}
                    items={[{ key: "per_service", title: "Per service", text: "A separate cost for each service (flight its own, hotel its own)." }, { key: "combined", title: "Combined", text: "One cost for the whole quote - every service rolled into one number." }]} />
            </Panel>

            <Panel title="2 · How should GST work for this quote?">
                <div className="flex flex-col gap-4">
                    <Field label="Your price is">
                        <Choice disabled={!canEdit} value={q.gst_inclusive ? "inclusive" : "exclusive"} onChange={(v) => set({ gst_inclusive: v === "inclusive" })}
                            items={[
                                { key: "exclusive", title: "Exclusive", text: example > 0 ? `${rupees(Math.round(example))} → ${rupees(Math.round(example * (1 + rate / 100)))} (GST added at ${rate}%)` : "GST is added on top of your price." },
                                { key: "inclusive", title: "Inclusive", text: example > 0 ? `${rupees(Math.round(example))} stays the same (${rupees(Math.round(example * rate / (100 + rate)))} of it is GST)` : "GST is already inside your price." },
                            ]} />
                    </Field>
                    <Field label="GST model">
                        <Choice disabled={!canEdit} value={q.billing_mode === "margin" ? "margin" : "full_value"} onChange={setBilling}
                            items={[
                                { key: "margin", title: "Pure agent", text: "GST only on your fee (margin). Usually 18%." },
                                { key: "full_value", title: "Principal / tour operator", text: "GST on the full amount (cost + fee). Usually 5%." },
                            ]} />
                    </Field>
                    <div className="flex flex-wrap items-end gap-3">
                        <Field label="GST rate">
                            <div className="flex gap-1.5">
                                {[5, 12, 18].map((r) => <button key={r} type="button" disabled={!canEdit} onClick={() => set({ gst_percent: r })} className={`h-9 px-3 rounded-lg border text-sm font-medium ${rate === r ? "border-primary bg-primary text-primary-foreground" : "border-default-200"}`}>{r}%</button>)}
                                <Input aria-label="Custom GST" size="sm" className="w-24" type="number" isDisabled={!canEdit} endContent={<span className="text-xs text-default-400">%</span>} value={String(q.gst_percent ?? "")} onValueChange={(v) => set({ gst_percent: v })} />
                            </div>
                        </Field>
                        {q.is_international && (
                            <Field label="TCS on overseas package">
                                <div className="flex items-center gap-2 h-9">
                                    <Switch size="sm" isDisabled={!canEdit} isSelected={Number(q.tcs_percent) > 0} onValueChange={(v) => set({ tcs_percent: v ? q.tax_defaults?.tcs_overseas_percent || 2 : 0 })} />
                                    <Input aria-label="TCS %" size="sm" className="w-20" type="number" isDisabled={!canEdit || !(Number(q.tcs_percent) > 0)} endContent={<span className="text-xs text-default-400">%</span>} value={String(q.tcs_percent ?? 0)} onValueChange={(v) => set({ tcs_percent: v })} />
                                </div>
                            </Field>
                        )}
                    </div>
                </div>
            </Panel>

            <Panel title="3 · Enter the cost" sub={combined ? "One figure for everything in this quote" : "Cost from your supplier, then your margin"}>
                <div className="flex flex-col gap-3">
                    {(combined ? lines.slice(0, 1) : lines).map((l, i) => (
                        <CostCard key={i} l={l} index={i} combined={combined} rates={rates} onSearch={searchRates} onChange={(p) => setLine(i, p)} />
                    ))}
                    {!lines.length && <p className="text-sm text-default-500">Add a service first.</p>}
                </div>
                {t.cost > 0 && (
                    <div className="mt-4 rounded-xl bg-default-50 dark:bg-default-100/40 p-3 text-sm">
                        Cost of travel {rupees(Math.round(t.cost_of_travel))} + {q.billing_mode === "margin" ? "processing" : "margin"} {rupees(Math.round(t.processing))}{t.discount > 0 ? ` − discount ${rupees(t.discount)}` : ""} + GST {rupees(Math.round(t.gst))}{t.tcs > 0 ? ` + TCS ${rupees(Math.round(t.tcs))}` : ""} = <b>Customer pays {rupees(Math.round(t.total))}</b>
                        <span className="text-success-600 font-medium ml-2">· profit {rupees(Math.round(t.profit))} ({t.margin_pct.toFixed(1)}%)</span>
                    </div>
                )}
            </Panel>
        </div>
    );
};

const CostCard = ({ l, index, combined, rates, onSearch, onChange }: { l: Line; index: number; combined: boolean; rates: any[]; onSearch: (s: string) => void; onChange: (p: Partial<Line>) => void }) => {
    const { q, lines, canEdit } = useQuote();
    const def = serviceDef(l.service_type);
    const basis = l.details?.cost_basis === "unit" && def.perUnit && !combined ? "unit" : "total";
    const cost = lineCost(l), markup = lineMarkup(l), hidden = lineHidden(l);
    const pct = cost > 0 ? (markup / cost) * 100 : 0;
    const rate = Number(q.gst_percent) || 0;
    const feeTaxable = q.billing_mode === "margin" ? Math.max(0, markup - hidden) : cost + markup;
    const gst = q.gst_inclusive ? feeTaxable * rate / (100 + rate) : feeTaxable * rate / 100;
    const pays = q.gst_inclusive ? cost + markup : cost + markup + gst;
    const setBasis = (b: string) => onChange(b === "total" ? { qty: 1, nights: 0, unit_cost: cost, details: { ...l.details, cost_basis: "total" } } : { details: { ...l.details, cost_basis: "unit" } });
    const unitsLabel = def.perUnit;
    return (
        <div className="rounded-xl border border-default-200 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-3">
                <ServiceIcon type={combined ? "check" : l.service_type} size={14} />
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{combined ? `All services (${lines.length})` : describe(l) || def.label}</div>
                    {!combined && <div className="text-[11px] text-default-500">{def.label}</div>}
                </div>
                {unitsLabel && !combined && (
                    <div className="inline-flex rounded-lg bg-default-100 p-0.5 text-xs">
                        <button type="button" disabled={!canEdit} onClick={() => setBasis("total")} className={`px-2 py-1 rounded-md ${basis === "total" ? "bg-content1 shadow-sm font-medium" : ""}`}>One total</button>
                        <button type="button" disabled={!canEdit} onClick={() => setBasis("unit")} className={`px-2 py-1 rounded-md ${basis === "unit" ? "bg-content1 shadow-sm font-medium" : ""}`}>Per {unitsLabel.qty.toLowerCase().replace(/s$/, "")}{unitsLabel.nights ? ` / ${unitsLabel.nights.toLowerCase().replace(/s$/, "")}` : ""}</button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <Field label={basis === "unit" ? "Unit cost ₹" : "Cost ₹"}>
                    <Input aria-label="Cost" size="sm" type="number" min={0} isDisabled={!canEdit} startContent={<span className="text-default-400 text-sm">₹</span>} value={String(l.unit_cost || "")} onValueChange={(v) => onChange({ unit_cost: Math.max(0, Number(v) || 0) })} />
                </Field>
                {basis === "unit" && unitsLabel && <>
                    <Field label={unitsLabel.qty}><Input aria-label={unitsLabel.qty} size="sm" type="number" min={1} isDisabled={!canEdit} value={String(l.qty)} onValueChange={(v) => onChange({ qty: Math.max(1, Number(v) || 1) })} /></Field>
                    {unitsLabel.nights && <Field label={unitsLabel.nights}><Input aria-label={unitsLabel.nights} size="sm" type="number" min={0} isDisabled={!canEdit} value={String(l.nights)} onValueChange={(v) => onChange({ nights: Math.max(0, Number(v) || 0) })} /></Field>}
                </>}
                <Field label="Margin ₹">
                    <Input aria-label="Margin" size="sm" type="number" min={0} isDisabled={!canEdit} startContent={<span className="text-default-400 text-sm">₹</span>} value={String(Math.round(markup * 100) / 100 || "")} onValueChange={(v) => onChange({ markup_type: "flat", markup_value: Math.max(0, Number(v) || 0) })} />
                </Field>
                <Field label="or margin %">
                    <Input aria-label="Margin percent" size="sm" type="number" min={0} isDisabled={!canEdit || cost <= 0} endContent={<span className="text-default-400 text-sm">%</span>} value={cost > 0 ? String(Math.round(pct * 100) / 100) : ""} onValueChange={(v) => onChange({ markup_type: "percent", markup_value: Math.max(0, Number(v) || 0) })} />
                </Field>
                <Field label={<span title="Part of your margin shown to the customer inside the cost of travel, not as a service charge">Of which hidden ₹</span>}>
                    <Input aria-label="Hidden markup" size="sm" type="number" min={0} isDisabled={!canEdit || markup <= 0} startContent={<span className="text-default-400 text-sm">₹</span>} value={String(l.hidden_markup || "")} onValueChange={(v) => onChange({ hidden_markup: Math.min(markup, Math.max(0, Number(v) || 0)) })} />
                </Field>
                <Field label="Customer pays ₹" className="col-span-2 md:col-span-1">
                    <Input aria-label="Customer pays" size="sm" type="number" min={0} isDisabled={!canEdit || cost <= 0} startContent={<span className="text-default-400 text-sm">₹</span>}
                        value={String(Math.round(pays * 100) / 100 || "")}
                        onValueChange={(v) => {
                            // work the margin back from what the customer should pay
                            const p = Math.max(0, Number(v) || 0);
                            let m: number;
                            if (q.gst_inclusive) m = p - cost;
                            else if (q.billing_mode === "margin") m = (p - cost + hidden * rate / 100) / (1 + rate / 100);
                            else m = p / (1 + rate / 100) - cost;
                            onChange({ markup_type: "flat", markup_value: Math.max(0, Math.round(m * 100) / 100) });
                        }} />
                </Field>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-default-600">
                <SumRow k={q.billing_mode === "margin" ? "Processing charge" : "Selling price"} v={rupees(Math.round((q.billing_mode === "margin" ? markup - hidden : cost + markup) * 100) / 100)} />
                <SumRow k={`GST ${rate}%${q.gst_inclusive ? " (inside)" : ""}`} v={rupees(Math.round(gst * 100) / 100)} />
                <Field label="Vendor" className="mt-2">
                    <Input aria-label="Vendor" size="sm" isDisabled={!canEdit} placeholder="Supplier name (for your records)" value={l.vendor || ""} onValueChange={(v) => onChange({ vendor: v })} />
                </Field>
                <Field label="Or pick a saved supplier rate" className="mt-2">
                    <Autocomplete aria-label="Supplier rate" size="sm" isDisabled={!canEdit} items={rates} placeholder="Search your rate sheets" onInputChange={onSearch}
                        onSelectionChange={(key) => {
                            const r = rates.find((x) => x.id === key);
                            if (r) onChange({ unit_cost: r.cost, supplier_id: r.supplier_id, rate_id: r.db_id, vendor: r.supplier_name || l.vendor, ...(r.pax_type === "per_unit" || combined ? { qty: 1, nights: 0, details: { ...l.details, cost_basis: "total" } } : { details: { ...l.details, cost_basis: "unit" } }) });
                        }}>
                        {(r: any) => <AutocompleteItem key={r.id} textValue={r.service}>{`${r.service}${r.room_type ? ` · ${r.room_type}` : ""} · ${r.supplier_name || ""} · ${rupees(r.cost)} ${String(r.pax_type || "").replace("per_", "per ")}`}</AutocompleteItem>}
                    </Autocomplete>
                </Field>
            </div>
        </div>
    );
};

export default StepServices;
