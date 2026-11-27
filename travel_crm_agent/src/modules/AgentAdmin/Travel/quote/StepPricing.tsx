import { useState } from "react";
import { Input } from "@heroui/react";
import { Eye, EyeOff, Receipt, TrendingUp } from "lucide-react";
import { Field, rupees } from "../travelShared";
import { Panel, ServiceIcon, SumRow, useQuote } from "./QuoteContext";
import { describe, lineCost, lineMarkup, serviceDef, totals } from "./quoteKit";

const r = (n: number) => rupees(Math.round(n * 100) / 100);

/** Step 3: the customer invoice and the agent's margin side by side, discount and validity. */
const StepPricing = () => {
    const { q, set, t, lines, options, oi, setOi, canEdit, seesCost } = useQuote();
    const [view, setView] = useState<"customer" | "agent">("customer");
    const margin = q.billing_mode === "margin";
    const half = t.gst / 2;
    const pax = Math.max(1, (q.adults || 0) + (q.children || 0));

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-4">
                <Panel title="Pricing summary" sub={margin ? "Pure agent - GST on your margin" : "Principal - GST on the full package"}
                    right={seesCost ? (
                        <div className="inline-flex rounded-xl bg-default-100 p-1 text-sm">
                            <button type="button" onClick={() => setView("customer")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${view === "customer" ? "bg-content1 shadow-sm font-medium" : "text-default-600"}`}><Eye size={14} /> Customer</button>
                            <button type="button" onClick={() => setView("agent")} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${view === "agent" ? "bg-content1 shadow-sm font-medium" : "text-default-600"}`}><EyeOff size={14} /> Agent</button>
                        </div>
                    ) : undefined}>
                    {view === "customer" || !seesCost ? (
                        <div className="rounded-xl border border-default-200 overflow-hidden">
                            <div className="flex items-center gap-2 bg-default-50 dark:bg-default-100/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-default-600"><Receipt size={14} /> Customer invoice</div>
                            <div className="px-4 py-3">
                                {margin ? <>
                                    <SumRow k="Cost of travel" v={r(t.cost_of_travel)} />
                                    <SumRow k="Processing charge (excl. GST)" v={r(t.processing)} />
                                </> : <>
                                    {t.discount > 0 && <SumRow k="Discount" v={`− ${r(t.discount)}`} />}
                                    <SumRow k="Package price (excl. GST)" v={r(t.sell)} />
                                </>}
                                <SumRow k={`GST @ ${Number(q.gst_percent)}%${margin ? " (on processing)" : ""}`} v={r(t.gst)} />
                                {/* in-state split; the place of supply is chosen on the invoice */}
                                <SumRow indent muted k={`CGST @ ${Number(q.gst_percent) / 2}%`} v={r(half)} /><SumRow indent muted k={`SGST @ ${Number(q.gst_percent) / 2}%`} v={r(half)} />
                                <SumRow k="Invoice value" v={r(t.sell + t.gst)} />
                                {t.tcs > 0 && <SumRow k={`TCS @ ${Number(q.tcs_percent)}% (overseas)`} v={r(t.tcs)} />}
                                <SumRow strong k="Total payable" v={r(t.total)} />
                                <SumRow muted k={`Per person (${pax})`} v={r(t.per_person)} />
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-success-200 overflow-hidden">
                            <div className="flex items-center gap-2 bg-success-50 dark:bg-success/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-success-700"><TrendingUp size={14} /> Your margin (only you see this)</div>
                            <div className="px-4 py-3">
                                <SumRow k="Actual cost" v={r(t.cost)} />
                                <SumRow k="Hidden markup" v={r(t.hidden)} />
                                <SumRow k={margin ? "Processing charge" : "Visible margin"} v={r(t.processing)} />
                                {t.discount > 0 && <SumRow k="Discount given" v={`− ${r(t.discount)}`} />}
                                <SumRow k="GST you collect" v={r(t.gst)} muted />
                                <SumRow strong k={`Total profit (${t.margin_pct.toFixed(1)}%)`} v={r(t.profit)} tone={t.profit >= 0 ? "success" : "danger"} />
                            </div>
                        </div>
                    )}
                </Panel>

                <Panel title="Services in this quote" sub={`${lines.length} service${lines.length === 1 ? "" : "s"}`}>
                    <div className="divide-y divide-default-100">
                        {lines.map((l, i) => (
                            <div key={i} className="flex items-center gap-3 py-2.5">
                                <ServiceIcon type={l.service_type} size={13} />
                                <div className="min-w-0 flex-1"><div className="text-sm truncate">{l.details?.wording || describe(l) || serviceDef(l.service_type).label}</div><div className="text-[11px] text-default-500">{serviceDef(l.service_type).label}{l.vendor ? ` · ${l.vendor}` : ""}</div></div>
                                {seesCost && <div className="text-right text-xs"><div className="font-medium text-sm">{r(lineCost(l) + lineMarkup(l))}</div><div className="text-default-500">cost {r(lineCost(l))}</div></div>}
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>

            <div className="flex flex-col gap-4">
                <Panel title="Adjust">
                    <div className="flex flex-col gap-3">
                        <Field label="Discount ₹"><Input aria-label="Discount" type="number" min={0} isDisabled={!canEdit} startContent={<span className="text-default-400 text-sm">₹</span>} value={String(q.discount || "")} onValueChange={(v) => set({ discount: Math.max(0, Number(v) || 0) })} /></Field>
                        <Field label="Quote valid until"><Input aria-label="Valid until" type="date" isDisabled={!canEdit} value={q.valid_until || ""} onValueChange={(v) => set({ valid_until: v })} /></Field>
                        <p className="text-xs text-default-500">GST type, rate and TCS are set on the Services step under Cost & margin.</p>
                    </div>
                </Panel>
                {options.length > 1 && (
                    <Panel title="Options" sub="The highlighted one is recommended on the PDF and used for booking">
                        <div className="flex flex-col gap-2">
                            {options.map((o, i) => {
                                const ot = seesCost ? totals(o.lines, q) : q.options?.[i]?.totals || {};
                                return (
                                    <button key={i} type="button" onClick={() => setOi(i)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left ${i === oi ? "border-primary bg-primary-50 dark:bg-primary/10" : "border-default-200"}`}>
                                        <span className="text-sm font-medium">{o.name}</span>
                                        <span className="text-right"><span className="block font-semibold text-sm">{r(ot.total || 0)}</span>{seesCost && <span className="block text-[11px] text-success-600">profit {r(ot.profit || 0)}</span>}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Panel>
                )}
            </div>
        </div>
    );
};

export default StepPricing;
