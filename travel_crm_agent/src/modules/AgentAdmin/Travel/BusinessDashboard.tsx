import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Select, SelectItem, Spinner } from "@heroui/react";
import {
    ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, Briefcase, CalendarCheck, CalendarDays, CircleDollarSign, Clock, FileText, IndianRupee,
    Plane, Plus, Receipt, Repeat, Store, TrendingUp, UserPlus, Wallet,
} from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { fmtDate, rupees } from "./travelShared";

/**
 * Travel dashboard: period KPIs, revenue / profit and bookings charts, recent activity, all-time summary,
 * payment follow-ups, lead follow-ups, live and upcoming trips, quick actions and conversion rates.
 * Data: GET /travel/overview?days=7|30|90|365.
 */

const RANGES = [{ key: "7", label: "Last 7 days" }, { key: "30", label: "Last 30 days" }, { key: "90", label: "Last 90 days" }, { key: "365", label: "Last 12 months" }];
const money = (n: number) => rupees(Math.round(n || 0));
const short = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(1)}k` : `₹${Math.round(n)}`);
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const ago = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`; };

const STAT_TONES: Record<string, { card: string; icon: string }> = {
    blue: { card: "from-blue-50 to-white dark:from-blue-500/10 dark:to-transparent", icon: "bg-gradient-to-br from-blue-400 to-blue-600" },
    green: { card: "from-emerald-50 to-white dark:from-emerald-500/10 dark:to-transparent", icon: "bg-gradient-to-br from-emerald-400 to-emerald-600" },
    amber: { card: "from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent", icon: "bg-gradient-to-br from-amber-400 to-orange-500" },
    violet: { card: "from-violet-50 to-white dark:from-violet-500/10 dark:to-transparent", icon: "bg-gradient-to-br from-violet-400 to-violet-600" },
};

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <section className={`rounded-2xl border border-default-200/70 bg-content1 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>
);
const Head = ({ icon, title, sub, right }: { icon?: ReactNode; title: string; sub?: string; right?: ReactNode }) => (
    <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        {icon && <span className="h-9 w-9 rounded-xl grid place-items-center text-white bg-gradient-to-br from-[#F47D5B] to-[#D85333] shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1"><h2 className="m-0 text-base leading-tight font-semibold text-foreground">{title}</h2>{sub && <p className="m-0 mt-0.5 text-xs leading-snug text-default-500">{sub}</p>}</div>
        {right}
    </div>
);
const Empty = ({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) => (
    <div className="py-8 flex flex-col items-center text-center text-default-400 gap-1.5 px-4">{icon}<div className="text-sm text-default-500">{title}</div>{text && <div className="text-xs">{text}</div>}</div>
);
const Segmented = ({ value, onChange, items }: { value: string; onChange: (k: string) => void; items: { key: string; label: string }[] }) => (
    <div className="inline-flex rounded-xl bg-default-100 p-1 text-xs">
        {items.map((i) => <button key={i.key} type="button" onClick={() => onChange(i.key)} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${value === i.key ? "bg-content1 shadow-sm font-medium text-foreground" : "text-default-600"}`}>{i.label}</button>)}
    </div>
);
const ViewAll = ({ onPress }: { onPress: () => void }) => <button type="button" onClick={onPress} className="text-xs font-medium text-[#D85333] hover:underline flex items-center gap-1 whitespace-nowrap">View all <ArrowRight size={12} /></button>;

const Stat = ({ label, value, compact, change, icon, tone, onPress }: { label: string; value: string; compact?: string; change?: number | null; icon: ReactNode; tone: string; onPress?: () => void }) => (
    <button type="button" onClick={onPress} className={`text-left rounded-2xl border border-default-200/70 bg-gradient-to-br ${STAT_TONES[tone].card} p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md transition-shadow min-w-0`}>
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
                <div className="text-xs text-default-500 truncate">{label}</div>
                <div className="text-xl sm:text-2xl font-bold mt-1 tabular-nums truncate">{compact ? <><span className="sm:hidden">{compact}</span><span className="hidden sm:inline">{value}</span></> : value}</div>
            </div>
            <span className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center text-white shadow-sm shrink-0 ${STAT_TONES[tone].icon}`}>{icon}</span>
        </div>
        {change !== undefined && change !== null && (
            <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${change >= 0 ? "text-emerald-600" : "text-danger"}`}>
                {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change).toFixed(1)}% <span className="text-default-400 font-normal hidden sm:inline">vs previous</span>
            </div>
        )}
    </button>
);

/** Line chart (SVG) for one or two series. */
const LineChart = ({ rows, keys }: { rows: any[]; keys: { key: string; color: string; label: string }[] }) => {
    const W = 640, H = 220, P = { l: 44, r: 12, t: 12, b: 26 };
    const max = Math.max(1, ...rows.flatMap((r) => keys.map((k) => Number(r[k.key]) || 0)));
    const nice = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 10 : max / Math.pow(10, Math.floor(Math.log10(max))) > 2 ? 5 : 2);
    const top = Math.ceil(max / nice) * nice || 1;
    const x = (i: number) => P.l + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * (W - P.l - P.r));
    const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
    const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Chart">
            {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="stroke-default-200" strokeDasharray="3 4" /><text x={P.l - 6} y={y(t) + 3} textAnchor="end" className="fill-default-400 text-[10px]">{short(t).replace("₹", "")}</text></g>)}
            {rows.map((r, i) => (i % labelEvery === 0 || i === rows.length - 1) && <text key={r.date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-default-400 text-[10px]">{shortDate(r.date)}</text>)}
            {keys.map((k) => {
                const pts = rows.map((r, i) => `${x(i)},${y(Number(r[k.key]) || 0)}`).join(" ");
                return (
                    <g key={k.key}>
                        <polygon points={`${x(0)},${y(0)} ${pts} ${x(rows.length - 1)},${y(0)}`} fill={k.color} opacity={0.08} />
                        <polyline points={pts} fill="none" stroke={k.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                    </g>
                );
            })}
        </svg>
    );
};

/** Bar chart (SVG) for bookings per day. */
const BarChart = ({ rows }: { rows: any[] }) => {
    const W = 640, H = 200, P = { l: 30, r: 8, t: 10, b: 26 };
    const max = Math.max(4, ...rows.map((r) => r.bookings));
    const bw = (W - P.l - P.r) / Math.max(1, rows.length);
    const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
    const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Bookings chart">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t * max)} y2={y(t * max)} className="stroke-default-200" strokeDasharray="3 4" /><text x={P.l - 6} y={y(t * max) + 3} textAnchor="end" className="fill-default-400 text-[10px]">{Math.round(t * max)}</text></g>)}
            {rows.map((r, i) => (
                <g key={r.date}>
                    {r.bookings > 0 && <rect x={P.l + i * bw + bw * 0.18} y={y(r.bookings)} width={bw * 0.64} height={y(0) - y(r.bookings)} rx={Math.min(4, bw * 0.3)} fill="url(#mtBar)"><title>{`${shortDate(r.date)}: ${r.bookings}`}</title></rect>}
                    {(i % labelEvery === 0) && <text x={P.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-default-400 text-[10px]">{shortDate(r.date)}</text>}
                </g>
            ))}
            <defs><linearGradient id="mtBar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F47D5B" /><stop offset="1" stopColor="#D85333" /></linearGradient></defs>
        </svg>
    );
};

const BusinessDashboard = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [days, setDays] = useState("30");
    const [d, setD] = useState<any>(null);
    const [payTab, setPayTab] = useState("overdue");
    const [tripTab, setTripTab] = useState("live");
    useEffect(() => { (async () => { const { success, data } = await commonGetAPICalls(`/travel/overview?days=${days}`); if (success) setD(data); })(); }, [days]);
    const empty = useMemo(() => d && !d.all_time?.quotes && !d.kpis?.bookings && !d.all_time?.revenue, [d]);
    if (!d) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const k = d.kpis, pf = d.payment_followups, lf = d.lead_followups;
    const payItems: any[] = pf[payTab] || [];
    const leadItems = [...lf.missed, ...lf.today];
    const tripItems: any[] = d.trips[tripTab] || [];
    const rangeLabel = RANGES.find((r) => r.key === days)?.label.toLowerCase();

    return (
        <div className="flex flex-col gap-5 p-1 sm:p-2 max-w-7xl w-full">
            {/* header */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 basis-full sm:basis-auto sm:flex-1"><h1 className="m-0 text-2xl font-bold text-foreground">Dashboard</h1><p className="text-sm text-default-500">Welcome back! Here's your business overview.</p></div>
                <Select aria-label="Period" size="sm" className="flex-1 sm:flex-none sm:w-44" startContent={<CalendarDays size={14} />} selectedKeys={[days]} onChange={(e) => e.target.value && setDays(e.target.value)}>
                    {RANGES.map((r) => <SelectItem key={r.key}>{r.label}</SelectItem>)}
                </Select>
                <Button color="primary" startContent={<Plus size={16} />} onPress={() => navigate("/travel/quotes?new=1")}>New Quote</Button>
            </div>

            {empty && (
                <div className="rounded-2xl border border-[#F47D5B]/30 bg-gradient-to-r from-orange-50 to-white dark:from-orange-500/10 dark:to-transparent p-5 flex flex-wrap items-center gap-4">
                    <span className="h-11 w-11 rounded-xl grid place-items-center text-white bg-gradient-to-br from-[#F47D5B] to-[#D85333]"><FileText size={20} /></span>
                    <div className="flex-1 min-w-[220px]"><div className="font-semibold">Create your first customer quote</div><div className="text-sm text-default-500">Add a customer, build the quote and itinerary, then share the PDF.</div></div>
                    <Button color="primary" onPress={() => navigate("/travel/quotes?new=1")}>Create first quote</Button>
                </div>
            )}

            {/* stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Stat label={`Bookings (${days === "365" ? "12m" : `${days}d`})`} value={String(k.bookings)} change={k.bookings_change} icon={<CalendarCheck size={18} />} tone="blue" onPress={() => navigate("/travel/bookings")} />
                <Stat label={`Revenue (${days === "365" ? "12m" : `${days}d`})`} value={money(k.revenue)} compact={short(k.revenue)} change={k.revenue_change} icon={<TrendingUp size={18} />} tone="green" onPress={() => navigate("/travel/reports")} />
                <Stat label="Customer o/s" value={money(k.customer_outstanding)} compact={short(k.customer_outstanding)} icon={<Wallet size={18} />} tone="amber" onPress={() => setPayTab("overdue")} />
                {d.sees_cost ? <Stat label="Vendor dues" value={money(k.vendor_dues)} compact={short(k.vendor_dues)} icon={<Store size={18} />} tone="violet" onPress={() => navigate("/travel/finance")} />
                    : <Stat label="Quote conversion" value={`${d.all_time.quote_conversion}%`} icon={<Repeat size={18} />} tone="violet" onPress={() => navigate("/travel/quotes")} />}
            </div>

            {/* revenue + recent */}
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <Card>
                    <Head title="Revenue overview" sub={`Performance over ${rangeLabel}`} right={<div className="flex gap-3 text-xs text-default-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F47D5B]" />Revenue</span>{d.sees_cost && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Profit</span>}</div>} />
                    <div className="px-3 pb-3"><LineChart rows={d.series} keys={[{ key: "revenue", color: "#F47D5B", label: "Revenue" }, ...(d.sees_cost ? [{ key: "profit", color: "#10B981", label: "Profit" }] : [])]} /></div>
                </Card>
                <Card>
                    <Head title="Recent activity" sub="Latest quotes and bookings" />
                    <div className="px-3 pb-3">
                        {d.recent.length ? d.recent.map((r: any) => (
                            <button key={`${r.kind}${r.id}`} type="button" onClick={() => navigate(r.kind === "quote" ? `/travel/quotes/${r.id}` : `/travel/bookings/${r.id}`)} className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-default-50 text-left">
                                <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${r.kind === "quote" ? "bg-orange-100 text-[#D85333] dark:bg-orange-500/15" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15"}`}>{r.kind === "quote" ? <FileText size={15} /> : <Briefcase size={15} />}</span>
                                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{r.who || r.title}</div><div className="text-[11px] text-default-500 truncate">{r.number} · {r.kind === "quote" ? `Quote ${r.status}` : "Booked"} · {ago(r.at)}</div></div>
                                <span className="text-sm font-semibold tabular-nums">{short(r.amount)}</span>
                            </button>
                        )) : <Empty icon={<FileText size={28} />} title="No recent activity" text="Create your first quote to get started" />}
                    </div>
                </Card>
            </div>

            {/* bookings + financial summary */}
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <Card>
                    <Head title="Bookings" sub={`Booking volume over ${rangeLabel}`} />
                    <div className="px-3 pb-3"><BarChart rows={d.series} /></div>
                </Card>
                <Card>
                    <Head title="Financial summary" sub="All-time business overview" />
                    <div className="px-5 pb-5 flex flex-col gap-4">
                        <SumRow icon={<IndianRupee size={16} />} tone="from-emerald-400 to-emerald-600" k="Total revenue" v={money(d.all_time.revenue)} />
                        {d.sees_cost && <SumRow icon={<TrendingUp size={16} />} tone="from-blue-400 to-blue-600" k="Total profit" v={money(d.all_time.profit)} />}
                        <SumRow icon={<Clock size={16} />} tone="from-amber-400 to-orange-500" k="Pending payments" v={money(d.all_time.pending_payments)} />
                        <SumRow icon={<Repeat size={16} />} tone="from-violet-400 to-violet-600" k="Quote conversion" v={`${d.all_time.quote_conversion}%`} sub={`${d.all_time.quotes_booked} of ${d.all_time.quotes} quotes`} />
                    </div>
                </Card>
            </div>

            {/* follow-ups */}
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <Head icon={<Receipt size={16} />} title="Payment follow-ups" sub="Who to follow up · oldest due first" right={<ViewAll onPress={() => navigate("/fees")} />} />
                    <div className="px-5"><Segmented value={payTab} onChange={setPayTab} items={[{ key: "overdue", label: `Overdue (${pf.overdue.length})` }, { key: "due_now", label: `Due now (${pf.due_now.length})` }, { key: "this_week", label: `This week (${pf.this_week.length})` }, { key: "this_month", label: `This month (${pf.this_month.length})` }]} /></div>
                    <div className="px-3 py-3">
                        {payItems.length ? payItems.slice(0, 6).map((p, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-default-50">
                                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => p.booking_id && navigate(`/travel/bookings/${p.booking_id}`)}>
                                    <div className="text-sm font-medium truncate">{p.client || "Customer"} <span className="text-default-400 font-normal">· {p.booking_no || p.invoice_no}</span></div>
                                    <div className={`text-[11px] truncate ${payTab === "overdue" ? "text-danger" : "text-default-500"}`}>{p.label} · {p.due_date ? `due ${fmtDate(p.due_date)}` : "no due date"}</div>
                                </button>
                                <span className="text-sm font-semibold tabular-nums">{money(p.amount)}</span>
                                {p.phone && <a className="text-xs text-emerald-600 hover:underline" target="_blank" rel="noopener" href={`https://wa.me/${p.phone}?text=${encodeURIComponent(`Hi ${String(p.client || "").split(" ")[0]}, a gentle reminder: ${money(p.amount)} for ${p.trip || "your trip"} is ${payTab === "overdue" ? "overdue" : "due"}${p.due_date ? ` (${fmtDate(p.due_date)})` : ""}.${p.link ? ` Pay here: ${p.link}` : ""}`)}`}>Remind</a>}
                            </div>
                        )) : <Empty icon={<Wallet size={26} />} title={payTab === "overdue" ? "Nothing overdue" : "Nothing due"} text="Payments appear here from the payment schedule on each booking's invoice" />}
                    </div>
                </Card>
                <Card>
                    <Head icon={<BellRing size={16} />} title="Lead follow-ups" sub="Missed and due today · whole team" right={<ViewAll onPress={() => navigate("/crm/leads?follow_up=today")} />} />
                    <div className="px-3 pb-3">
                        {leadItems.length ? leadItems.slice(0, 7).map((l: any) => (
                            <button key={l.id} type="button" onClick={() => navigate(`/crm/leads/${l.id}`)} className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-default-50 text-left">
                                <span className="h-8 w-8 rounded-full bg-default-100 grid place-items-center text-xs font-semibold shrink-0">{String(l.name || "?").slice(0, 1).toUpperCase()}</span>
                                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{l.name || "Lead"}{l.destinations?.length ? <span className="text-default-400 font-normal"> · {l.destinations.join(", ")}</span> : null}</div><div className="text-[11px] text-default-500 truncate">{l.note || "Follow up"}</div></div>
                                <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${l.missed ? "bg-danger-50 text-danger" : "bg-orange-50 text-[#D85333] dark:bg-orange-500/10"}`}>{l.missed ? "Missed" : new Date(l.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                            </button>
                        )) : <Empty icon={<CalendarCheck size={26} />} title="All caught up - nothing missed or due today" text="Follow-ups scheduled on a lead appear here on the day they are due" />}
                    </div>
                </Card>
            </div>

            {/* trips */}
            <Card>
                <Head icon={<Plane size={16} />} title="Trips" sub="Travelling now and departing this week" right={<div className="flex items-center gap-3"><Segmented value={tripTab} onChange={setTripTab} items={[{ key: "live", label: `Live (${d.trips.live.length})` }, { key: "upcoming", label: `Upcoming (${d.trips.upcoming.length})` }]} /><ViewAll onPress={() => navigate("/travel/live-trips")} /></div>} />
                <div className="px-3 pb-3 grid sm:grid-cols-2 gap-1">
                    {tripItems.length ? tripItems.map((t) => (
                        <button key={t.id} type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-default-50 text-left">
                            <span className={`h-10 w-10 rounded-xl grid place-items-center text-xs font-bold shrink-0 ${t.live ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15" : "bg-blue-100 text-blue-700 dark:bg-blue-500/15"}`}>{t.live ? `D${t.day_no}` : t.starts_in === 0 ? "Today" : `${t.starts_in}d`}</span>
                            <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{t.client || t.title}</div><div className="text-[11px] text-default-500 truncate">{t.destination || t.title} · {fmtDate(t.start_date)}{t.end_date ? ` – ${fmtDate(t.end_date)}` : ""}</div></div>
                            {t.pending_services > 0 && <span className="text-[11px] text-warning-600 bg-warning-50 rounded-full px-2 py-0.5">{t.pending_services} pending</span>}
                        </button>
                    )) : <div className="sm:col-span-2"><Empty icon={<Plane size={26} />} title={tripTab === "live" ? "No trips in progress today" : "No departures this week"} text="Confirmed bookings appear here the day their travel starts" /></div>}
                </div>
            </Card>

            {/* quick actions */}
            <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
                <Quick icon={<FileText size={18} />} tone="from-[#F47D5B] to-[#D85333]" title="Create quote" text="Start a new travel quotation" onPress={() => navigate("/travel/quotes?new=1")} />
                <Quick icon={<UserPlus size={18} />} tone="from-blue-400 to-blue-600" title="Add customer" text="Register a new enquiry" onPress={() => navigate("/crm/leads?new=travel")} />
                <Quick icon={<CalendarCheck size={18} />} tone="from-emerald-400 to-emerald-600" title="View bookings" text="Track active bookings" onPress={() => navigate("/travel/bookings")} />
            </div>

            {/* conversion */}
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                <Card className="p-5">
                    <div className="flex items-start justify-between"><div className="text-xs text-default-500">Lead → Won conversion</div><span className="h-8 w-8 rounded-lg grid place-items-center bg-orange-50 text-[#D85333] dark:bg-orange-500/10"><TrendingUp size={15} /></span></div>
                    <div className="text-3xl font-bold mt-1">{d.conversion.lead_rate.toFixed(1)}%</div>
                    <div className="text-xs text-default-500">{d.conversion.leads_won} of {d.conversion.leads} leads won · {rangeLabel}</div>
                    <button type="button" onClick={() => navigate("/travel/reports")} className="mt-3 text-xs font-medium text-[#D85333] hover:underline flex items-center gap-1">View reports <ArrowRight size={12} /></button>
                </Card>
                <Card className="p-5">
                    <div className="flex items-start justify-between"><div className="text-xs text-default-500">Quote → Booking conversion</div><span className="h-8 w-8 rounded-lg grid place-items-center bg-blue-50 text-blue-600 dark:bg-blue-500/10"><CircleDollarSign size={15} /></span></div>
                    <div className="text-3xl font-bold mt-1">{d.conversion.quote_rate === null ? "—" : `${d.conversion.quote_rate.toFixed(1)}%`}</div>
                    <div className="text-xs text-default-500">{d.conversion.quotes_booked} of {d.conversion.quotes} quotes booked · {rangeLabel}</div>
                    <button type="button" onClick={() => navigate("/travel/quotes")} className="mt-3 text-xs font-medium text-[#D85333] hover:underline flex items-center gap-1">View quotes <ArrowRight size={12} /></button>
                </Card>
            </div>
        </div>
    );
};

const SumRow = ({ icon, tone, k, v, sub }: { icon: ReactNode; tone: string; k: string; v: string; sub?: string }) => (
    <div className="flex items-center gap-3">
        <span className={`h-10 w-10 rounded-xl grid place-items-center text-white bg-gradient-to-br ${tone} shrink-0`}>{icon}</span>
        <div className="min-w-0"><div className="text-xs text-default-500">{k}</div><div className="font-bold tabular-nums">{v}</div>{sub && <div className="text-[11px] text-default-400">{sub}</div>}</div>
    </div>
);
const Quick = ({ icon, tone, title, text, onPress }: { icon: ReactNode; tone: string; title: string; text: string; onPress: () => void }) => (
    <button type="button" onClick={onPress} className="group flex items-center gap-3 rounded-2xl border border-default-200/70 bg-content1 p-4 text-left hover:shadow-md transition-shadow">
        <span className={`h-11 w-11 rounded-xl grid place-items-center text-white bg-gradient-to-br ${tone} shrink-0`}>{icon}</span>
        <div className="min-w-0 flex-1"><div className="font-semibold text-sm">{title}</div><div className="text-xs text-default-500">{text}</div></div>
        <ArrowRight size={16} className="text-default-300 group-hover:text-default-500" />
    </button>
);

export default BusinessDashboard;
