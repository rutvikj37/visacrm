import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Tab, Tabs } from "@heroui/react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Luggage, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { BOOKING_STATUS, PageHead, fmtRange, rupees } from "./travelShared";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Bookings list and the operations calendar of past, ongoing and upcoming trips (BK-04). */
const Bookings = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls } = useApiCallUtils();
    const view = params.get("view") === "calendar" ? "calendar" : "list";
    const when = params.get("when") || "upcoming";
    const [search, setSearch] = useState("");
    const [rows, setRows] = useState<any[] | null>(null);
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

    const setParam = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };

    const load = useCallback(async () => {
        const q = new URLSearchParams();
        if (view === "calendar") {
            q.set("from", iso(month));
            q.set("to", iso(new Date(month.getFullYear(), month.getMonth() + 1, 0)));
        } else {
            if (when === "cancelled") q.set("status", "cancelled"); else if (when !== "all") q.set("when", when);
            if (search.trim()) q.set("search", search.trim());
        }
        const { success, data } = await commonGetAPICalls(`/travel/bookings?${q.toString()}`);
        setRows(success ? data : []);
    }, [view, when, search, month]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    // month grid: Monday first
    const cells = useMemo(() => {
        const first = new Date(month);
        const offset = (first.getDay() + 6) % 7;
        const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        return Array.from({ length: Math.ceil((offset + daysIn) / 7) * 7 }, (_, i) => {
            const day = i - offset + 1;
            return day >= 1 && day <= daysIn ? iso(new Date(month.getFullYear(), month.getMonth(), day)) : null;
        });
    }, [month]);
    const onDay = (d: string) => (rows || []).filter((b) => b.status !== "cancelled" && b.start_date && b.start_date <= d && (b.end_date || b.start_date) >= d);
    const today = iso(new Date());

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Bookings" sub="Confirmed trips, their services, travellers and payments"
                actions={<div className="flex gap-1">
                    <Button size="sm" variant={view === "list" ? "solid" : "flat"} color={view === "list" ? "primary" : "default"} startContent={<List size={14} />} onPress={() => setParam("view", "")}>List</Button>
                    <Button size="sm" variant={view === "calendar" ? "solid" : "flat"} color={view === "calendar" ? "primary" : "default"} startContent={<CalendarDays size={14} />} onPress={() => setParam("view", "calendar")}>Calendar</Button>
                </div>} />

            {view === "list" ? (<>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Tabs selectedKey={when} onSelectionChange={(k) => setParam("when", String(k) === "upcoming" ? "" : String(k))} variant="underlined" aria-label="When">
                        <Tab key="upcoming" title="Upcoming" /><Tab key="past" title="Past" /><Tab key="all" title="All" /><Tab key="cancelled" title="Cancelled" />
                    </Tabs>
                    <Input aria-label="Search" className="sm:max-w-xs sm:ml-auto" placeholder="Booking no., trip or destination" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
                </div>
                {rows === null ? <CardListSkeleton /> : !rows.length ? (
                    <EmptyState icon={Luggage} title="No bookings here" text="When a client accepts a quote, choose “Client accepted - book it” and the booking appears here." />
                ) : (
                    <div className="flex flex-col gap-2">
                        {rows.map((b) => (
                            <Card key={b.id} isPressable shadow="sm" onPress={() => navigate(`/travel/bookings/${b.id}`)}>
                                <CardBody className="flex-row items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold truncate">{b.title}</div>
                                        <div className="text-xs text-default-500 truncate">{b.booking_no} · {b.client?.name} · {fmtRange(b.start_date, b.end_date)}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-semibold">{rupees(b.client_total)}</div>
                                        <Chip size="sm" variant="flat" color={BOOKING_STATUS[b.status]?.color}>{BOOKING_STATUS[b.status]?.label}</Chip>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}
            </>) : (
                <Card shadow="sm"><CardBody className="gap-3">
                    <div className="flex items-center gap-2">
                        <Button isIconOnly size="sm" variant="flat" aria-label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></Button>
                        <div className="font-semibold flex-1 text-center">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                        <Button isIconOnly size="sm" variant="flat" aria-label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[11px] text-default-500 text-center">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((d, i) => (
                            <div key={i} className={`min-h-[84px] rounded-lg border p-1 ${d ? "border-default-200" : "border-transparent"} ${d === today ? "bg-primary-50" : ""}`}>
                                {d && <>
                                    <div className="text-[11px] text-default-500">{Number(d.slice(8))}</div>
                                    <div className="flex flex-col gap-0.5">
                                        {onDay(d).slice(0, 3).map((b) => (
                                            <button key={b.id} type="button" onClick={() => navigate(`/travel/bookings/${b.id}`)} title={`${b.booking_no} ${b.title}`}
                                                className={`text-[10px] sm:text-[11px] truncate text-left rounded px-1 ${b.start_date === d ? "bg-primary text-primary-foreground" : "bg-primary-100 text-primary-700"}`}>
                                                {b.start_date === d ? "✈ " : ""}{b.client?.name || b.title}
                                            </button>
                                        ))}
                                        {onDay(d).length > 3 && <span className="text-[10px] text-default-500">+{onDay(d).length - 3} more</span>}
                                    </div>
                                </>}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-default-500">Dark = departure day. Light = travelling.</p>
                </CardBody></Card>
            )}
        </div>
    );
};

export default Bookings;
