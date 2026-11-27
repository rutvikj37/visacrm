import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Spinner, Textarea } from "@heroui/react";
import { CalendarRange, ExternalLink, FileText, Map, Save, SkipForward, Wand2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { fmtDate } from "../travelShared";
import { MultiImageUpload } from "../travelActions";
import { Panel, useQuote } from "./QuoteContext";
import { nightsBetween } from "./quoteKit";

const ITEM_LABEL: Record<string, string> = { hotel: "Stay", sightseeing: "Sightseeing", transfer: "Transfer", meal: "Meal", flight: "Flight", activity: "Activity", note: "Note" };

/** Step 4: day-wise plan built from the quote's dates and services, or skip for a quote only. */
const StepItinerary = () => {
    const { q, set, canEdit, save, go } = useQuote();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const itId = q.itinerary?.id || null;
    const [it, setIt] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = async (id: string) => {
        setLoading(true);
        const { success, data } = await commonGetAPICalls(`/travel/itineraries/${id}`);
        setLoading(false);
        if (success) { setIt(data); setDirty(false); }
    };
    useEffect(() => { if (itId) load(itId); }, [itId]);

    const build = async () => {
        setBusy(true);
        if (!(await save())) { setBusy(false); return; }
        const { success, data } = await commonPostAPICall({}, `travel/quotes/${q.id}/itinerary`);
        setBusy(false);
        if (success && data?.id) { set({ itinerary: { id: data.id }, kind: "quote_itinerary" }); SuccessToast(data.created ? "Day-wise plan ready - edit any day below" : "Itinerary linked"); }
    };
    const setDay = (i: number, patch: any) => { setIt((x: any) => ({ ...x, days: x.days.map((d: any, j: number) => (j === i ? { ...d, ...patch } : d)) })); setDirty(true); };
    const saveDays = async () => {
        setBusy(true);
        const { success } = await commonPostAPICall({ title: it.title, days: it.days }, `travel/itineraries/${it.id}/update`);
        setBusy(false);
        if (success) { setDirty(false); SuccessToast("Day plan saved"); }
    };

    const trip = q.trip || {};
    const nights = nightsBetween(trip.start_date, trip.end_date);

    if (!itId) {
        return (
            <Panel title="Customer itinerary" sub="Turn this quote into a day-by-day plan the customer sees on the PDF and web link">
                <div className="grid sm:grid-cols-2 gap-3">
                    <button type="button" disabled={!canEdit || busy} onClick={build} className="text-left rounded-2xl border-2 border-primary/40 hover:border-primary bg-primary-50/50 dark:bg-primary/10 p-5 disabled:opacity-60">
                        <Wand2 className="text-primary mb-3" size={22} />
                        <div className="font-semibold">Build day-wise itinerary</div>
                        <p className="text-sm text-default-500 mt-1">{trip.start_date ? `${nights + 1} day${nights ? "s" : ""} from ${fmtDate(trip.start_date)}. Hotels, flights, cabs and activities land on their dates.` : "Add travel dates on the Trip step first."}</p>
                        {busy && <Spinner size="sm" className="mt-3" />}
                    </button>
                    <button type="button" onClick={() => go(5)} className="text-left rounded-2xl border border-default-200 hover:border-default-400 p-5">
                        <SkipForward className="text-default-500 mb-3" size={22} />
                        <div className="font-semibold">Quote only - skip</div>
                        <p className="text-sm text-default-500 mt-1">Send pricing without a day plan. You can build the itinerary any time later.</p>
                    </button>
                </div>
            </Panel>
        );
    }
    if (loading || !it) return <div className="py-16 grid place-items-center"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-4">
            <Panel title="Review the customer itinerary" sub="Edit day titles, the plan and photos. Quote totals stay the same."
                right={<div className="flex gap-2">
                    <Button size="sm" variant="flat" startContent={<ExternalLink size={14} />} onPress={async () => { if (dirty) await saveDays(); navigate(`/travel/itineraries/${it.id}`); }}>Full editor</Button>
                    {canEdit && <Button size="sm" color="primary" startContent={<Save size={14} />} isDisabled={!dirty} isLoading={busy} onPress={saveDays}>{dirty ? "Save days" : "Saved"}</Button>}
                </div>}>
                <div className="grid sm:grid-cols-4 gap-2 mb-4">
                    <Fact icon={<CalendarRange size={14} />} k="Trip dates" v={trip.start_date ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date || trip.start_date)}` : "-"} />
                    <Fact icon={<Map size={14} />} k="Days" v={`${it.days?.length || 0} days`} />
                    <Fact icon={<FileText size={14} />} k="Customer" v={q.lead?.name || "-"} />
                    <Fact icon={<Map size={14} />} k="Destination" v={it.destination || trip.place || "-"} />
                </div>
                <Input aria-label="Itinerary title" label="Itinerary title" labelPlacement="outside" placeholder="Main heading on the PDF and web link" isDisabled={!canEdit} value={it.title || ""} onValueChange={(v) => { setIt((x: any) => ({ ...x, title: v })); setDirty(true); }} />
            </Panel>

            <ol className="flex flex-col gap-3">
                {(it.days || []).map((d: any, i: number) => {
                    const dayDate = trip.start_date ? new Date(Date.parse(`${trip.start_date}T00:00:00`) + i * 864e5) : null;
                    return (
                        <li key={i} className="rounded-2xl border border-default-200 bg-content1 shadow-sm overflow-hidden">
                            <div className="flex">
                                <div className="w-20 sm:w-24 shrink-0 bg-primary text-primary-foreground flex flex-col items-center justify-center py-3">
                                    <span className="text-[10px] uppercase tracking-widest opacity-80">Day</span>
                                    <span className="text-2xl font-bold leading-none">{i + 1}</span>
                                    {dayDate && <span className="text-[11px] mt-1 opacity-90">{dayDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>}
                                </div>
                                <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col gap-2">
                                    <Input aria-label="Day title" size="sm" variant="underlined" classNames={{ input: "font-semibold text-base" }} isDisabled={!canEdit} value={d.title || ""} onValueChange={(v) => setDay(i, { title: v })} />
                                    {d.items?.length > 0 && (
                                        <ul className="flex flex-wrap gap-1.5">
                                            {d.items.map((itm: any, k: number) => <li key={k} className="text-xs rounded-full bg-default-100 px-2.5 py-1"><span className="font-semibold text-default-600">{ITEM_LABEL[itm.type] || "Note"}:</span> {itm.text}</li>)}
                                        </ul>
                                    )}
                                    <Textarea aria-label="Day plan" minRows={2} size="sm" isDisabled={!canEdit} placeholder="What happens today - sightseeing, free time, tips for the traveller" value={d.notes || ""} onValueChange={(v) => setDay(i, { notes: v })} />
                                    <MultiImageUpload compact={false} max={8} label="Day photos" value={d.images || (d.image ? [d.image] : [])} onChange={(urls) => setDay(i, { images: urls, image: urls[0] || null })} />
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

const Fact = ({ icon, k, v }: { icon: any; k: string; v: string }) => (
    <div className="rounded-xl bg-default-50 dark:bg-default-100/40 px-3 py-2">
        <div className="text-[11px] text-default-500 flex items-center gap-1">{icon}{k}</div>
        <div className="text-sm font-medium truncate">{v}</div>
    </div>
);

export default StepItinerary;
