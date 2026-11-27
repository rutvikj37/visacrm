import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Spinner } from "@heroui/react";
import { AlertTriangle, CalendarClock, MapPin, MessageCircle, Phone, Plane, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { fmtDate, rupees, serviceLabel } from "./travelShared";

/**
 * Live Trips: who is travelling today (day X of Y, what is booked for today, supplier contacts)
 * and who leaves in the next 30 days (what is still unconfirmed or unpaid). Data: GET /travel/live_trips.
 */
const LiveTrips = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [d, setD] = useState<any>(null);
    const [tab, setTab] = useState<"live" | "upcoming">("live");
    const [search, setSearch] = useState("");
    useEffect(() => { (async () => { const { success, data } = await commonGetAPICalls("/travel/live_trips"); if (success) { setD(data); if (!data.live.length && data.upcoming.length) setTab("upcoming"); } })(); }, []);
    const rows = useMemo(() => {
        const list: any[] = d?.[tab] || [];
        const s = search.trim().toLowerCase();
        return s ? list.filter((t) => [t.client, t.title, t.destination, t.booking_no, t.phone].some((v) => String(v || "").toLowerCase().includes(s))) : list;
    }, [d, tab, search]);
    if (!d) return <div className="py-16 grid place-items-center"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-5 p-1 sm:p-2 max-w-7xl w-full">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-0"><h1 className="text-2xl font-bold">Live Trips</h1><p className="text-sm text-default-500">{d.live.length} trip{d.live.length === 1 ? "" : "s"} on the road now · {d.upcoming.length} departing in the next 30 days</p></div>
                <Input aria-label="Search trips" size="sm" className="w-full sm:w-72" placeholder="Search traveller, place, booking" startContent={<Search size={15} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            </div>
            <div className="inline-flex rounded-xl bg-default-100 p-1 text-sm self-start">
                <button type="button" onClick={() => setTab("live")} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 ${tab === "live" ? "bg-content1 shadow-sm font-medium" : "text-default-600"}`}><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Live / Ongoing ({d.live.length})</button>
                <button type="button" onClick={() => setTab("upcoming")} className={`px-4 py-1.5 rounded-lg ${tab === "upcoming" ? "bg-content1 shadow-sm font-medium" : "text-default-600"}`}>Upcoming ({d.upcoming.length})</button>
            </div>

            {!rows.length ? (
                <div className="rounded-2xl border border-default-200/70 bg-content1 py-16 flex flex-col items-center text-center gap-2 text-default-400">
                    <Plane size={32} />
                    <div className="text-default-600 font-medium">{tab === "live" ? "No trips on the road right now" : "No departures in the next 30 days"}</div>
                    <div className="text-sm">{tab === "live" ? "Nobody is mid-trip today" : "Confirmed bookings show here before they leave"}</div>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {rows.map((t) => {
                        const progress = t.live ? Math.min(100, Math.round((t.day_no / Math.max(1, t.total_days)) * 100)) : 0;
                        const unpaid = t.invoice?.balance > 0;
                        return (
                            <article key={t.id} className="rounded-2xl border border-default-200/70 bg-content1 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
                                <button type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="text-left p-4 flex gap-3">
                                    <span className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 text-white font-bold text-sm ${t.live ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-[#F47D5B] to-[#D85333]"}`}>
                                        {t.live ? <span className="leading-tight text-center">D{t.day_no}<span className="block text-[9px] font-medium opacity-90">of {t.total_days}</span></span> : t.starts_in === 0 ? "Today" : <span className="leading-tight text-center">{t.starts_in}<span className="block text-[9px] font-medium opacity-90">days</span></span>}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold truncate">{t.client || "Traveller"}</div>
                                        <div className="text-xs text-default-500 truncate flex items-center gap-1"><MapPin size={12} />{t.destination || t.title}</div>
                                        <div className="text-[11px] text-default-400 mt-0.5">{t.booking_no} · {fmtDate(t.start_date)}{t.end_date ? ` – ${fmtDate(t.end_date)}` : ""}</div>
                                    </div>
                                </button>
                                {t.live && <div className="px-4 -mt-1 mb-3"><div className="h-1.5 rounded-full bg-default-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${progress}%` }} /></div></div>}
                                <div className="px-4 pb-3 flex-1 flex flex-col gap-2">
                                    {t.live && (
                                        <div>
                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-default-500 mb-1">Today</div>
                                            {t.today.length ? t.today.map((s: any, i: number) => (
                                                <div key={i} className="text-xs flex items-start gap-2 py-1">
                                                    <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${s.status === "confirmed" ? "bg-emerald-500" : "bg-warning"}`} />
                                                    <div className="min-w-0 flex-1"><span className="font-medium">{serviceLabel(s.type)}:</span> {s.description}{s.time ? ` · ${s.time}` : ""}
                                                        {s.supplier && <div className="text-default-400">{s.supplier}{s.supplier_phone ? ` · ${s.supplier_phone}` : ""}{s.confirmation_no ? ` · conf. ${s.confirmation_no}` : ""}</div>}</div>
                                                </div>
                                            )) : <div className="text-xs text-default-400">Nothing booked for today - free day</div>}
                                        </div>
                                    )}
                                    {!t.live && t.next.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-default-500 mb-1">First up</div>
                                            {t.next.map((s: any, i: number) => <div key={i} className="text-xs py-0.5 truncate"><CalendarClock size={11} className="inline mr-1 text-default-400" />{fmtDate(s.date)} · {serviceLabel(s.type)}: {s.description}</div>)}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                                        {t.pending_services > 0 && <span className="text-[11px] rounded-full bg-warning-50 text-warning-700 px-2 py-0.5 flex items-center gap-1"><AlertTriangle size={11} />{t.pending_services} of {t.services} not confirmed</span>}
                                        {!t.invoice && <span className="text-[11px] rounded-full bg-default-100 text-default-600 px-2 py-0.5">No invoice</span>}
                                        {unpaid && <span className="text-[11px] rounded-full bg-danger-50 text-danger px-2 py-0.5">{rupees(Math.round(t.invoice.balance))} unpaid</span>}
                                        {t.pending_services === 0 && t.invoice && !unpaid && <span className="text-[11px] rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">All set</span>}
                                    </div>
                                </div>
                                {t.phone && (
                                    <div className="border-t border-default-100 grid grid-cols-2 text-xs">
                                        <a href={`tel:+${t.phone}`} className="py-2.5 flex items-center justify-center gap-1.5 hover:bg-default-50"><Phone size={13} /> Call</a>
                                        <a href={`https://wa.me/${t.phone}`} target="_blank" rel="noopener" className="py-2.5 flex items-center justify-center gap-1.5 hover:bg-default-50 text-emerald-600 border-l border-default-100"><MessageCircle size={13} /> WhatsApp</a>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LiveTrips;
