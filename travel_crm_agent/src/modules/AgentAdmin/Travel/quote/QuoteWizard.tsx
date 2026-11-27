import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Chip, Spinner } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Cloud, Loader2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { QUOTE_STATUS, rupees } from "../travelShared";
import { QuoteProvider } from "./QuoteContext";
import { Line, Option, blankLine, describe, totals } from "./quoteKit";
import StepTrip from "./StepTrip";
import StepServices from "./StepServices";
import StepPricing from "./StepPricing";
import StepItinerary from "./StepItinerary";
import StepTerms from "./StepTerms";
import StepDesign from "./StepDesign";
import StepShare from "./StepShare";

export const STEPS = [
    { key: "trip", title: "Trip", sub: "Where, when, who" },
    { key: "services", title: "Services", sub: "What's included" },
    { key: "pricing", title: "Pricing", sub: "Totals & GST" },
    { key: "itinerary", title: "Itinerary", sub: "Day-wise plan" },
    { key: "terms", title: "Terms", sub: "Inclusions & payment" },
    { key: "design", title: "Design", sub: "Look of the PDF" },
    { key: "share", title: "Share", sub: "Send & book" },
];

const fromApi = (l: any): Line => ({ ...blankLine(l.service_type), ...l, details: l.details && typeof l.details === "object" ? l.details : {} });

/**
 * Quote builder: seven steps, saved on every step change.
 * Trip → Services (pick, details, cost) → Pricing → Itinerary → Terms → Design → Share.
 */
const QuoteWizard = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [q, setQ] = useState<any>(null);
    const [options, setOptionsState] = useState<Option[]>([]);
    const [oi, setOi] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const step = Math.min(7, Math.max(1, Number(params.get("step")) || 0)) || 0;

    const load = async () => {
        const { success, data } = await commonGetAPICalls(`/travel/quotes/${id}`);
        if (!success) return;
        setQ(data);
        const opts = (data.options || []).map((o: any) => ({ name: o.name, lines: (o.lines || []).map(fromApi) }));
        setOptionsState(opts.length ? opts : [{ name: "Standard", lines: [] }]);
        setOi(Math.min(Number(data.chosen_option ?? 0), Math.max(0, opts.length - 1)));
        setDirty(false);
        // open where the user left off (a booked quote opens on Share)
        if (!params.get("step")) setParams({ step: String(data.status === "accepted" ? 7 : Math.min(7, data.step || 1)) }, { replace: true });
    };
    useEffect(() => { load(); }, [id]);

    const closed = q && ["accepted", "superseded"].includes(q.status);
    const seesCost = Boolean(q?.sees_cost);
    const canEdit = seesCost && !closed;
    const lines = options[oi]?.lines || [];
    const t = useMemo(() => (q ? (seesCost ? totals(lines, q) : { ...totals([], q), ...(q.options?.[oi]?.totals || {}) }) : totals([], { billing_mode: "full_value", gst_percent: 0, tcs_percent: 0, is_international: false, discount: 0, gst_inclusive: false, adults: 1, children: 0 })), [lines, q, oi, seesCost]);

    const set = (patch: Record<string, any>) => { setQ((x: any) => ({ ...x, ...patch })); setDirty(true); };
    const setOptions = (fn: (os: Option[]) => Option[]) => { setOptionsState((p) => fn(p)); setDirty(true); };
    const setLines = (fn: (ls: Line[]) => Line[]) => setOptions((os) => os.map((o, i) => (i === oi ? { ...o, lines: fn([...o.lines]) } : o)));

    const save = async (extra: Record<string, any> = {}) => {
        if (!canEdit) return true;
        setSaving(true);
        const { success } = await commonPostAPICall({
            title: q.title, adults: q.adults, children: q.children, infants: q.infants, billing_mode: q.billing_mode,
            gst_percent: q.gst_percent, tcs_percent: q.tcs_percent, discount: q.discount, valid_until: q.valid_until, notes: q.notes,
            chosen_option: oi, trip: q.trip, travellers: q.travellers, cost_mode: q.cost_mode, gst_inclusive: q.gst_inclusive,
            inclusions: q.inclusions, exclusions: q.exclusions, terms: q.terms, payment_terms: q.payment_terms, internal_notes: q.internal_notes,
            design: q.design,
            options: options.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l, description: (l.details?.wording || describe(l) || "Service").slice(0, 300) })) })),
            ...extra,
        }, `travel/quotes/${id}/update`);
        setSaving(false);
        if (success) setDirty(false);
        return success;
    };

    /** Rules before leaving a step forwards (MoonTrip-style: no pricing without a priced service). */
    const blocker = (from: number, to: number) => {
        if (to <= from || !canEdit) return null;
        if (from <= 1) {
            if (!q.trip?.place && !q.trip?.state && !q.trip?.country) return "Enter where the trip is going";
            if (!q.trip?.start_date) return "Pick the travel dates";
            if (!q.lead) return "Choose or add the customer";
        }
        if (from <= 2 && to >= 3 && !lines.some((l) => Number(l.unit_cost) > 0)) return "Add at least one service with a cost above ₹0";
        return null;
    };

    const go = async (to: number) => {
        const target = Math.min(7, Math.max(1, to));
        for (let s = step; s < target; s++) { const msg = blocker(s, s + 1); if (msg) { ErrorToast(msg); return; } }
        if (canEdit && (dirty || target > (q.step || 1))) {
            const ok = await save({ step: Math.max(target, q.step || 1) });
            if (!ok) return;
            setQ((x: any) => ({ ...x, step: Math.max(target, x.step || 1) }));
        }
        setParams({ step: String(target) }, { replace: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!q || !step) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const reached = Math.max(q.step || 1, step);

    const ctx = { q, set, options, oi, setOi: (i: number) => { setOi(i); setDirty(true); }, lines, setLines, setOptions, t, canEdit, seesCost, reload: load, save, go };

    return (
        <QuoteProvider value={ctx}>
            <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl mx-auto w-full">
                {/* header */}
                <div className="flex items-center gap-2">
                    <Button isIconOnly variant="light" aria-label="Back" onPress={async () => { if (dirty) await save(); navigate("/travel/quotes"); }}><ArrowLeft size={18} /></Button>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs text-default-500 truncate">{q.number}{q.version > 1 ? ` · v${q.version}` : ""}{q.lead ? ` · ${q.lead.name}` : ""}</div>
                        <input aria-label="Quote title" disabled={!canEdit} value={q.title || ""} onChange={(e) => set({ title: e.target.value })}
                            className="w-full bg-transparent text-lg sm:text-xl font-semibold truncate outline-none focus:ring-2 focus:ring-primary/30 rounded-md px-1 -mx-1 disabled:opacity-100" />
                    </div>
                    <span className="hidden sm:flex items-center gap-1 text-xs text-default-500">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving</> : dirty ? <><Cloud size={13} /> Unsaved</> : <><CheckCircle2 size={13} className="text-success" /> Saved</>}
                    </span>
                    <Chip size="sm" variant="flat" color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip>
                </div>
                {!seesCost && <div className="rounded-xl border border-default-200 bg-default-50 p-3 text-sm">Costs and margins are hidden for your role. You can view and send this quote; a manager sets the prices.</div>}
                {q.status === "superseded" && <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm">This is an old version. Open the latest version to make changes.</div>}

                {/* stepper */}
                <nav aria-label="Quote steps" className="rounded-2xl border border-default-200 bg-content1 px-2 py-3 sm:px-4 shadow-sm overflow-x-auto">
                    <ol className="flex items-start min-w-[640px]">
                        {STEPS.map((s, i) => {
                            const n = i + 1, done = n < step || (n <= reached && n !== step && n < reached), now = n === step, open = n <= reached || !canEdit;
                            return (
                                <li key={s.key} className="flex-1 flex flex-col items-center relative">
                                    {i > 0 && <span className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${n <= reached ? "bg-primary" : "bg-default-200"}`} />}
                                    <button type="button" disabled={!open} onClick={() => go(n)} className="relative z-10 flex flex-col items-center gap-1 group disabled:cursor-not-allowed">
                                        <span className={`h-8 w-8 rounded-full grid place-items-center text-sm font-semibold transition-all ${now ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : done ? "bg-primary text-primary-foreground" : open ? "bg-content1 border-2 border-primary text-primary" : "bg-default-100 text-default-400"}`}>
                                            {done && !now ? <Check size={15} /> : n}
                                        </span>
                                        <span className={`text-xs font-medium ${now ? "text-primary" : open ? "text-foreground" : "text-default-400"}`}>{s.title}</span>
                                        <span className="text-[10px] text-default-400 hidden md:block">{s.sub}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                {step === 1 && <StepTrip />}
                {step === 2 && <StepServices />}
                {step === 3 && <StepPricing />}
                {step === 4 && <StepItinerary />}
                {step === 5 && <StepTerms />}
                {step === 6 && <StepDesign />}
                {step === 7 && <StepShare />}

                {/* bottom bar */}
                <div className="sticky bottom-0 z-30 -mx-1 sm:-mx-2 mt-2 rounded-t-2xl border border-b-0 border-default-200 bg-content1/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
                    <Button variant="bordered" startContent={<ArrowLeft size={16} />} isDisabled={step === 1} onPress={() => go(step - 1)}>Previous</Button>
                    <div className="flex-1 min-w-0 text-center">
                        <div className="text-[11px] text-default-500 truncate">{options.length > 1 ? `${options[oi]?.name} · ` : ""}Customer pays</div>
                        <div className="font-semibold tabular-nums">{rupees(Math.round(t.total))}{seesCost && t.cost > 0 && <span className="ml-2 text-xs font-medium text-success-600">profit {rupees(Math.round(t.profit))}</span>}</div>
                    </div>
                    {step < 7
                        ? <Button color="primary" endContent={<ArrowRight size={16} />} isLoading={saving} onPress={() => go(step + 1)}>Next</Button>
                        : <Button color="primary" variant="flat" isLoading={saving} isDisabled={!dirty || !canEdit} onPress={() => save()}>{dirty ? "Save" : "Saved"}</Button>}
                </div>
                </div>
            </div>
        </QuoteProvider>
    );
};

export default QuoteWizard;
