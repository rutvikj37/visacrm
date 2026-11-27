import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Chip } from "@heroui/react";
import { FileText, Map, Plane } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import useModules from "@/hooks/useModules";
import { ITINERARY_STATUS, QUOTE_STATUS, fmtDate, rupees } from "./travelShared";

const asArray = (v: any) => (Array.isArray(v) ? v : typeof v === "string" && v.startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);

/** Trip details of a travel lead, with its itineraries and quotes and the next step (lead → itinerary → quote → booking). */
const TravelLeadPanel = ({ lead }: { lead: any }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const { has } = useModules();
    const [its, setIts] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [busy, setBusy] = useState("");
    const [packages, setPackages] = useState<any[]>([]);
    const quoteFromPackage = async (pkgId: string) => {
        if (!pkgId) return;
        setBusy("pkg");
        const { success, data } = await commonPostAPICall({ lead_id: lead.uuid, package_id: pkgId }, "travel/quotes");
        setBusy("");
        if (success && data?.id) navigate(`/travel/quotes/${data.id}`);
    };

    useEffect(() => {
        if (!lead?.uuid || !has("itinerary")) return;
        (async () => {
            const [a, b] = await Promise.all([commonGetAPICalls(`/travel/itineraries?lead=${lead.uuid}`), commonGetAPICalls(`/travel/quotes?lead=${lead.uuid}`)]);
            if (a.success) setIts(a.data);
            if (b.success) setQuotes(b.data);
            const p = await commonGetAPICalls("/travel/packages?status=active");
            if (p.success) setPackages(p.data || []);
        })();
    }, [lead?.uuid]);

    const createItinerary = async () => {
        setBusy("it");
        const { success, data } = await commonPostAPICall({ lead_id: lead.uuid }, "travel/itineraries");
        setBusy("");
        if (success && data?.id) navigate(`/travel/itineraries/${data.id}`);
    };
    const createQuote = async () => {
        setBusy("q");
        const { success, data } = await commonPostAPICall({ lead_id: lead.uuid, itinerary_id: its[0]?.id }, "travel/quotes");
        setBusy("");
        if (success && data?.id) navigate(`/travel/quotes/${data.id}`);
    };

    const dest = asArray(lead.destinations).join(", ");
    const when = lead.travel_start ? `${fmtDate(lead.travel_start)}${lead.travel_end ? ` → ${fmtDate(lead.travel_end)}` : ""}` : lead.travel_month ? new Date(`${lead.travel_month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "";
    const pax = [lead.adults ? `${lead.adults} adult${lead.adults > 1 ? "s" : ""}` : "", lead.children ? `${lead.children} child${lead.children > 1 ? "ren" : ""}${asArray(lead.child_ages).length ? ` (${asArray(lead.child_ages).join(", ")} yrs)` : ""}` : "", lead.infants ? `${lead.infants} infant${lead.infants > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");

    return (
        <section className="rounded-xl border border-primary-100 bg-primary-50/40 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-2"><Plane size={16} className="text-primary" /><h2 className="text-sm font-semibold text-default-700">Trip</h2></div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <Item k="Destination" v={dest} /><Item k="When" v={when} />
                <Item k="Nights" v={lead.nights != null ? String(lead.nights) : ""} /><Item k="Travellers" v={pax} />
                <Item k="Budget" v={lead.budget != null ? rupees(Number(lead.budget) / 100) : ""} /><Item k="Hotel" v={(lead.hotel_category || "").replace("_", " ")} />
                <Item k="Trip type" v={lead.trip_type} /><Item k="From" v={lead.departure_city} />
            </div>
            {lead.converted_booking_id ? null : has("itinerary") && (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" color="primary" variant={its.length ? "flat" : "solid"} isLoading={busy === "it"} startContent={<Map size={14} />} onPress={createItinerary}>Create itinerary</Button>
                    <Button size="sm" color="primary" variant={its.length ? "solid" : "flat"} isLoading={busy === "q"} startContent={<FileText size={14} />} onPress={createQuote}>New quote</Button>
                    {packages.length > 0 && (
                        <select aria-label="Quote from a package" className="h-8 rounded-medium bg-default-100 px-2 text-sm max-w-[220px]" value="" disabled={busy === "pkg"} onChange={(e) => quoteFromPackage(e.target.value)}>
                            <option value="">Quote from a package…</option>
                            {packages.map((p) => <option key={p.id} value={p.id}>{p.title} · ₹{Number(p.price_pp).toLocaleString("en-IN")}/pp</option>)}
                        </select>
                    )}
                </div>
            )}
            {(its.length > 0 || quotes.length > 0) && (
                <div className="flex flex-col gap-1.5 text-sm">
                    {its.map((i) => (
                        <button key={i.id} type="button" className="flex items-center gap-2 text-left hover:underline" onClick={() => navigate(`/travel/itineraries/${i.id}`)}>
                            <Map size={14} className="text-default-400 shrink-0" /><span className="truncate flex-1">{i.title}</span>
                            <Chip size="sm" variant="flat" color={ITINERARY_STATUS[i.status]?.color}>{ITINERARY_STATUS[i.status]?.label}</Chip>
                        </button>
                    ))}
                    {quotes.map((q) => (
                        <button key={q.id} type="button" className="flex items-center gap-2 text-left hover:underline" onClick={() => navigate(`/travel/quotes/${q.id}`)}>
                            <FileText size={14} className="text-default-400 shrink-0" /><span className="truncate flex-1">{q.number} v{q.version} · {rupees(q.sell_total)}</span>
                            <Chip size="sm" variant="flat" color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

const Item = ({ k, v }: { k: string; v?: string | null }) => (
    <div className="min-w-0"><div className="text-[11px] text-default-500">{k}</div><div className="truncate capitalize-first">{v || <span className="text-default-400">-</span>}</div></div>
);

export default TravelLeadPanel;
