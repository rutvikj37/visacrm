import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Chip, Spinner } from "@heroui/react";
import { AlertTriangle, CalendarClock, FileText, IndianRupee, MessageCircle, Plane, TrendingUp, Users, Wallet } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { LEAD_STATUSES } from "@/modules/AgentAdmin/Crm/crmShared";
import { fmtRange, rupees } from "./travelShared";

const short = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : rupees(Math.round(n)));
const dayLabel = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const daysAgo = (d?: string) => { if (!d) return ""; const n = Math.floor((Date.now() - new Date(d).getTime()) / 864e5); return n <= 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`; };
const daysTo = (d?: string) => { if (!d) return ""; const n = Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5); return n === 0 ? "today" : n === 1 ? "tomorrow" : n < 0 ? `${-n}d ago` : `in ${n} days`; };

const Kpi = ({ icon: Icon, label, value, hint, tone, onPress }: any) => (
    <button type="button" onClick={onPress} className="rounded-xl border border-default-200 bg-content1 hover:bg-default-50 p-3 text-left min-w-0">
        <div className="flex items-center gap-2 text-xs text-default-500"><Icon size={14} className="shrink-0" /><span className="truncate">{label}</span></div>
        <div className={`text-xl sm:text-2xl font-semibold mt-1 truncate ${tone || ""}`}>{value}</div>
        {hint && <div className="text-[11px] text-default-400 truncate">{hint}</div>}
    </button>
);

const Panel = ({ title, count, action, empty, children }: any) => (
    <Card shadow="sm">
        <CardHeader className="flex items-center gap-2 pb-1"><span className="font-semibold">{title}</span>{count ? <Chip size="sm" variant="flat">{count}</Chip> : null}{action && <div className="ml-auto">{action}</div>}</CardHeader>
        <CardBody className="pt-1 gap-1">{children && (Array.isArray(children) ? children.length : true) ? children : <div className="text-sm text-default-500 py-2">{empty}</div>}</CardBody>
    </Card>
);

const Bars = ({ rows, value, label, format }: { rows: any[]; value: (r: any) => number; label: (r: any) => string; format: (n: number) => string }) => {
    const max = Math.max(1, ...rows.map(value));
    return (
        <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[96px_1fr_auto] items-center gap-2 text-xs">
                    <span className="truncate text-default-600">{label(r)}</span>
                    <div className="h-2.5 rounded-full bg-default-100 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (value(r) / max) * 100)}%` }} /></div>
                    <span className="tabular-nums text-default-700 w-16 text-right">{format(value(r))}</span>
                </div>
            ))}
        </div>
    );
};

/**
 * Travel dashboard (RP-01): KPIs that matter to a travel agency and the lists to act on today.
 * `compact` (Today page) shows the KPIs and the action lists; the Travel desk also shows the trends.
 */
const TravelDashboard = ({ compact = false }: { compact?: boolean }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [d, setD] = useState<any>(null);
    useEffect(() => { (async () => { const { success, data } = await commonGetAPICalls("/travel/dashboard"); if (success) setD(data); })(); }, []);
    if (!d) return <div className="py-10 grid place-items-center"><Spinner /></div>;
    const k = d.kpis;
    const funnel = (d.funnel || []).map((f: any) => ({ ...f, label: LEAD_STATUSES.find((s) => s.key === f.key)?.label || f.key }));

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <Kpi icon={Users} label="Travel enquiries this month" value={k.enquiries_month} hint={`${k.open_enquiries} open · ${k.conversion_rate}% converted`} onPress={() => navigate("/crm/leads")} />
                <Kpi icon={TrendingUp} label="Sales this month" value={short(k.sales_month)} hint={`${k.bookings_month} booking${k.bookings_month === 1 ? "" : "s"}${k.profit_month !== undefined ? ` · profit ${short(k.profit_month)} (${k.margin_pct}%)` : ""}`} onPress={() => navigate("/travel/reports")} />
                <Kpi icon={IndianRupee} label="To collect from clients" value={short(k.to_collect)} hint={k.overdue_collect ? `${short(k.overdue_collect)} overdue` : "Nothing overdue"} tone={k.overdue_collect ? "text-danger" : ""} onPress={() => navigate("/fees?status=due")} />
                <Kpi icon={FileText} label="Open quotes" value={short(k.pipeline_value)} hint={`${k.open_quotes} quote${k.open_quotes === 1 ? "" : "s"} waiting · ${d.quotes_to_chase.length} to chase`} onPress={() => navigate("/travel/quotes?status=sent")} />
                <Kpi icon={Plane} label="Departures" value={`${k.departures_7} / ${k.departures_30}`} hint="Next 7 / 30 days" onPress={() => navigate("/travel/bookings?view=calendar")} />
                <Kpi icon={CalendarClock} label="Travelling now" value={k.travelling_now} hint="Clients on a trip today" onPress={() => navigate("/travel/bookings")} />
                <Kpi icon={AlertTriangle} label="Trips not ready" value={d.trips_attention.length} hint="Leaving within 14 days" tone={d.trips_attention.length ? "text-warning-600" : ""} onPress={() => navigate("/travel/bookings")} />
                {d.sees_cost ? <Kpi icon={Wallet} label="Supplier payments due" value={d.supplier_due.length} hint={d.supplier_due.some((s: any) => s.overdue) ? "Some overdue" : "Next 7 days"} tone={d.supplier_due.some((s: any) => s.overdue) ? "text-danger" : ""} onPress={() => navigate("/travel/finance")} />
                    : <Kpi icon={Wallet} label="Client payments due" value={d.payments_due.length} hint="Next 7 days" onPress={() => navigate("/fees?status=due")} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Panel title="Trips leaving soon that are not ready" count={d.trips_attention.length} empty="Every trip in the next 14 days is confirmed, documented and paid.">
                    {d.trips_attention.map((t: any) => (
                        <button key={t.id} type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                            <div className="text-sm font-medium truncate">{t.title} · {t.client}</div>
                            <div className="text-xs"><span className="text-default-500">{t.booking_no} · leaves {daysTo(t.start_date)} · </span><span className="text-warning-600">{t.issues.join(", ")}</span></div>
                        </button>
                    ))}
                </Panel>
                <Panel title="Quotes to follow up" count={d.quotes_to_chase.length} empty="No sent quotes waiting more than 2 days." action={<Button size="sm" variant="light" onPress={() => navigate("/travel/quotes?status=sent")}>All sent</Button>}>
                    {d.quotes_to_chase.map((q: any) => (
                        <div key={q.id} className="flex items-center gap-2 rounded-lg hover:bg-default-50 px-1 py-1.5">
                            <button type="button" onClick={() => navigate(`/travel/quotes/${q.id}`)} className="min-w-0 flex-1 text-left">
                                <div className="text-sm font-medium truncate">{q.lead?.name || q.title} · {rupees(q.total)}</div>
                                <div className="text-xs text-default-500 truncate">{q.number} v{q.version} · sent {daysAgo(q.sent_at)}</div>
                            </button>
                            {q.lead?.phone && <Button as="a" href={`https://wa.me/${q.lead.phone}?text=${encodeURIComponent(`Hi ${String(q.lead.name || "").split(" ")[0]}, did you get a chance to look at the ${q.title} quote? Happy to change anything or hold the price for you.`)}`} target="_blank" rel="noopener" isIconOnly size="sm" variant="flat" color="success" aria-label="WhatsApp"><MessageCircle size={14} /></Button>}
                        </div>
                    ))}
                </Panel>
                <Panel title="Client payments due (7 days)" count={d.payments_due.length} empty="No client payments due this week.">
                    {d.payments_due.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg hover:bg-default-50 px-1 py-1.5">
                            <button type="button" onClick={() => navigate(`/fees/${p.id}`)} className="min-w-0 flex-1 text-left">
                                <div className="text-sm font-medium truncate">{p.client} · {rupees(p.amount)}</div>
                                <div className={`text-xs ${p.overdue ? "text-danger" : "text-default-500"}`}>{p.number} · {p.overdue ? "overdue" : `due ${daysTo(p.due_date)}`}</div>
                            </button>
                            {p.phone && <Button as="a" href={`https://wa.me/${p.phone}?text=${encodeURIComponent(`Hi ${String(p.client || "").split(" ")[0]}, a reminder: ${rupees(p.amount)} is due ${p.overdue ? "now" : `on ${dayLabel(p.due_date)}`} for invoice ${p.number}.${p.link ? ` Pay online: ${p.link}` : ""}`)}`} target="_blank" rel="noopener" isIconOnly size="sm" variant="flat" color="success" aria-label="Remind"><MessageCircle size={14} /></Button>}
                        </div>
                    ))}
                </Panel>
                {d.sees_cost ? (
                    <Panel title="Supplier payments due (7 days)" count={d.supplier_due.length} empty="No supplier payments due this week.">
                        {d.supplier_due.map((s: any, i: number) => (
                            <button key={i} type="button" onClick={() => navigate(`/travel/bookings/${s.booking_id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                                <div className="text-sm font-medium truncate">{s.supplier} · {rupees(s.due)}</div>
                                <div className={`text-xs ${s.overdue ? "text-danger" : "text-default-500"}`}>{s.booking_no} · {s.service} · {s.overdue ? "overdue" : `pay ${daysTo(s.due_date)}`}</div>
                            </button>
                        ))}
                    </Panel>
                ) : (
                    <Panel title="Departures (30 days)" count={d.departures.length} empty="No trips start in the next 30 days.">
                        {d.departures.map((t: any) => (
                            <button key={t.id} type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                                <div className="text-sm font-medium truncate">{t.title} · {t.client}</div>
                                <div className="text-xs text-default-500">{t.booking_no} · {fmtRange(t.start_date, t.end_date)}</div>
                            </button>
                        ))}
                    </Panel>
                )}
                {d.travelling_now.length > 0 && (
                    <Panel title="Travelling now" count={d.travelling_now.length}>
                        {d.travelling_now.map((t: any) => (
                            <div key={t.id} className="flex items-center gap-2 rounded-lg hover:bg-default-50 px-1 py-1.5">
                                <button type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="min-w-0 flex-1 text-left">
                                    <div className="text-sm font-medium truncate">{t.client} · {t.destination || t.title}</div>
                                    <div className="text-xs text-default-500">back {daysTo(t.end_date)}</div>
                                </button>
                                {t.phone && <Button as="a" href={`https://wa.me/${t.phone}?text=${encodeURIComponent(`Hi ${String(t.client || "").split(" ")[0]}, hope the trip is going well! Let us know if you need anything.`)}`} target="_blank" rel="noopener" isIconOnly size="sm" variant="flat" color="success" aria-label="WhatsApp"><MessageCircle size={14} /></Button>}
                            </div>
                        ))}
                    </Panel>
                )}
                {d.sees_cost && d.departures.length > 0 && (
                    <Panel title="Departures (30 days)" count={d.departures.length} action={<Button size="sm" variant="light" onPress={() => navigate("/travel/bookings?view=calendar")}>Calendar</Button>}>
                        {d.departures.map((t: any) => (
                            <button key={t.id} type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                                <div className="text-sm font-medium truncate">{t.title} · {t.client}</div>
                                <div className="text-xs text-default-500">{t.booking_no} · {fmtRange(t.start_date, t.end_date)}</div>
                            </button>
                        ))}
                    </Panel>
                )}
            </div>

            {!compact && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Panel title="Enquiry funnel (this month)">
                        <Bars rows={funnel} value={(r) => r.count} label={(r) => r.label} format={(n) => String(n)} />
                    </Panel>
                    <Panel title={d.sees_cost ? "Sales and profit by month" : "Sales by month"}>
                        <Bars rows={d.months} value={(r) => r.sales} label={(r) => new Date(`${r.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" })} format={short} />
                        {d.sees_cost && <div className="text-xs text-default-500 mt-1">Profit: {d.months.map((m: any) => short(m.profit || 0)).join(" · ")}</div>}
                    </Panel>
                    <Panel title="Top destinations (90 days)" empty="No bookings in the last 90 days.">
                        {d.top_destinations.length ? <Bars rows={d.top_destinations} value={(r) => r.bookings} label={(r) => r.name} format={(n) => `${n} booked`} /> : null}
                    </Panel>
                </div>
            )}
        </div>
    );
};

export default TravelDashboard;
