import { PageSkeleton } from "@/components/ui-kit/Skeletons";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Chip, Spinner } from "@heroui/react";
import { AlarmClock, CalendarClock, FileCheck2, FileText, IndianRupee, MessageCircle, Phone, Plane, RefreshCw, UserPlus, Users } from "lucide-react";
import SetupChecklist from "@/components/help/SetupChecklist";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import useModules from "@/hooks/useModules";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import { formatDateTime, sourceLabel, statusMeta, timeAgo } from "@/modules/AgentAdmin/Crm/crmShared";

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDay = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

const Count = ({ icon: Icon, label, value, tone, onPress }: any) => (
    <button type="button" onClick={onPress} className="rounded-xl border border-default-200 bg-content1 hover:bg-default-50 p-3 text-left flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${tone}`}><Icon size={18} /></div>
        <div className="min-w-0"><div className="text-xl font-semibold leading-tight">{value ?? "-"}</div><div className="text-xs text-default-500 truncate">{label}</div></div>
    </button>
);

const Section = ({ title, count, action, children, empty }: any) => (
    <Card shadow="sm">
        <CardHeader className="flex items-center gap-2 pb-1">
            <span className="font-semibold">{title}</span>
            {count ? <Chip size="sm" variant="flat">{count}</Chip> : null}
            {action && <div className="ml-auto">{action}</div>}
        </CardHeader>
        <CardBody className="pt-1 gap-1">
            {children && (Array.isArray(children) ? children.length : true) ? children : <div className="text-sm text-default-500 py-2">{empty}</div>}
        </CardBody>
    </Card>
);

/** A lead row with one-tap Call / WhatsApp. */
const LeadRow = ({ l, extra, onOpen }: { l: any; extra?: any; onOpen: () => void }) => {
    const navigate = useNavigate();
    const digits = String(l.phone_normalized || "").replace(/\D/g, "");
    return (
        <div className="flex items-center gap-2 rounded-lg hover:bg-default-50 px-1 py-1.5">
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
                <div className="text-sm font-medium truncate">{l.name || "Unnamed"} {l.overdue && <span className="text-danger text-xs font-normal">· overdue</span>}</div>
                <div className="text-xs text-default-500 truncate">{extra}</div>
            </button>
            {digits && <Button as="a" href={`tel:+${digits}`} isIconOnly size="sm" variant="flat" aria-label="Call" onPress={() => setTimeout(() => navigate(`/crm/leads/${l.uuid}?called=1`), 700)}><Phone size={14} /></Button>}
            {digits && <Button as="a" href={`https://wa.me/${digits}`} target="_blank" rel="noopener" isIconOnly size="sm" variant="flat" color="success" aria-label="WhatsApp"><MessageCircle size={14} /></Button>}
        </div>
    );
};

/** Home of the agency panel: what needs doing today, for the person looking at it. */
const TodayPage = () => {
    const navigate = useNavigate();
    const { has: hasModule } = useModules();
    const visaOn = hasModule("visa");
    const [travel, setTravel] = useState<any>(null);
    const { commonGetAPICalls } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [branch, setBranch] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const { success, data } = await commonGetAPICalls(`/crm/today?${branchQuery(branch).slice(1)}`);
        if (success) setData(data);
        // travel agencies: departures and open quotes (dashboard widgets follow the CRM type, SA-03)
        if (hasModule("itinerary") || hasModule("bookings")) {
            const t = await commonGetAPICalls("/travel/summary");
            if (t.success) setTravel(t.data);
        }
        setLoading(false);
    }, [branch]);
    useEffect(() => { load(); }, [load]);

    // First load only — keep previous content while refreshing / switching branch
    if (!data) return <PageSkeleton />;
    const c = data.counts;
    const first = String(data.name || "").split(" ")[0];
    const allClear = !c.follow_ups_today && !c.follow_ups_overdue && !c.steps_due && !c.to_review && !c.fees_due && !c.unassigned;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{greeting()}{first ? `, ${first}` : ""}</h1>
                    <p className="text-sm text-default-500">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · {allClear ? "Nothing urgent — a good day to call new leads." : "Here is what needs you today."}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                    <BranchPicker value={branch} onChange={setBranch} className="flex-1 sm:flex-none" />
                    <Button isIconOnly variant="flat" aria-label="Refresh" isLoading={loading} onPress={load}><RefreshCw size={16} /></Button>
                </div>
            </div>

            <SetupChecklist onChanged={load} />

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                <Count icon={AlarmClock} label="Overdue follow-ups" value={c.follow_ups_overdue} tone="bg-danger-50 text-danger" onPress={() => navigate("/crm/leads?follow_up=overdue")} />
                <Count icon={CalendarClock} label="Follow-ups today" value={c.follow_ups_today} tone="bg-warning-50 text-warning-600" onPress={() => navigate("/crm/leads?follow_up=today")} />
                <Count icon={UserPlus} label="New leads" value={c.new_leads} tone="bg-primary-50 text-primary" onPress={() => navigate("/crm/leads?status=new")} />
                {data.can_manage && <Count icon={Users} label="Not assigned" value={c.unassigned} tone="bg-default-100 text-default-600" onPress={() => navigate("/crm/leads?assigned_to=unassigned")} />}
                {visaOn && <Count icon={FileCheck2} label="Case steps due / to review" value={`${c.steps_due} / ${c.to_review}`} tone="bg-secondary-50 text-secondary" onPress={() => navigate("/cases/board")} />}
                {travel && <Count icon={Plane} label="Departures (30 days)" value={travel.upcoming?.length || 0} tone="bg-primary-50 text-primary" onPress={() => navigate("/travel/bookings")} />}
                {travel && <Count icon={FileText} label="Open quotes" value={travel.open_quotes} tone="bg-secondary-50 text-secondary" onPress={() => navigate("/travel/quotes")} />}
                {data.can_bill && <Count icon={IndianRupee} label="Fees due (2 days)" value={c.fees_due} tone="bg-success-50 text-success-600" onPress={() => navigate("/fees?status=due")} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Follow-ups" count={data.follow_ups.length} empty="No follow-ups due - you are all caught up."
                    action={<Button size="sm" variant="light" onPress={() => navigate("/crm/calendar")}>Calendar</Button>}>
                    {data.follow_ups.map((l: any) => (
                        <LeadRow key={l.uuid} l={l} onOpen={() => navigate(`/crm/leads/${l.uuid}`)}
                            extra={[formatDateTime(l.next_follow_up_at), l.follow_up_note].filter(Boolean).join(" · ")} />
                    ))}
                </Section>

                <Section title="New leads (last 2 days)" count={data.new_leads.length} empty="No new leads in the last 2 days."
                    action={<Button size="sm" variant="light" onPress={() => navigate("/crm/leads?status=new")}>All new</Button>}>
                    {data.new_leads.map((l: any) => (
                        <LeadRow key={l.uuid} l={l} onOpen={() => navigate(`/crm/leads/${l.uuid}`)}
                            extra={[sourceLabel(l.source), l.interested_country, timeAgo(l.createdAt)].filter(Boolean).join(" · ")} />
                    ))}
                </Section>

                {travel && (
                    <Section title="Upcoming departures" count={travel.upcoming?.length || 0} empty="No trips start in the next 30 days."
                        action={<Button size="sm" variant="light" onPress={() => navigate("/travel/bookings?view=calendar")}>Calendar</Button>}>
                        {(travel.upcoming || []).map((b: any) => (
                            <button key={b.id} type="button" onClick={() => navigate(`/travel/bookings/${b.id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                                <div className="text-sm font-medium truncate">{b.title} - {b.client?.name}</div>
                                <div className="text-xs text-default-500">{b.booking_no} · starts {fmtDay(b.start_date)}</div>
                            </button>
                        ))}
                    </Section>
                )}

                {visaOn && <Section title="Visa case steps due" count={data.steps.length} empty="No case steps due today.">
                    {data.steps.map((s: any) => (
                        <button key={s.id} type="button" onClick={() => navigate(`/leads/progress/${s.case_id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                            <div className="text-sm font-medium truncate">{s.title} - {s.student}</div>
                            <div className={`text-xs ${String(s.due_date) < new Date().toISOString().slice(0, 10) ? "text-danger" : "text-default-500"}`}>Due {fmtDay(s.due_date)}{s.country ? ` · ${s.country}` : ""}</div>
                        </button>
                    ))}
                </Section>}

                {visaOn && <Section title="Documents to review" count={data.review.length} empty="Nothing waiting for review.">
                    {data.review.map((q: any) => (
                        <button key={q.id} type="button" onClick={() => navigate(`/leads/progress/${q.case_id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5">
                            <div className="text-sm font-medium truncate">{q.text}</div>
                            <div className="text-xs text-default-500 truncate">{q.student} · {q.step} · {timeAgo(q.at)}</div>
                        </button>
                    ))}
                </Section>}

                {data.can_bill && (
                    <Section title="Fees due" count={data.fees.length} empty="No payments due in the next 2 days."
                        action={<Button size="sm" variant="light" onPress={() => navigate("/fees")}>Client fees</Button>}>
                        {data.fees.map((f: any) => (
                            <div key={f.id} className="flex items-center gap-2 rounded-lg hover:bg-default-50 px-1 py-1.5">
                                <button type="button" onClick={() => navigate(`/fees/${f.id}`)} className="min-w-0 flex-1 text-left">
                                    <div className="text-sm font-medium truncate">{f.student} · {rupees(f.amount)}</div>
                                    <div className={`text-xs ${f.overdue ? "text-danger" : "text-default-500"}`}>{f.overdue ? "Overdue since" : "Due"} {fmtDay(f.due_date)} · {f.number}</div>
                                </button>
                                {f.phone_digits && (
                                    <Button as="a" target="_blank" rel="noopener" size="sm" variant="flat" color="success" startContent={<MessageCircle size={14} />}
                                        href={`https://wa.me/${f.phone_digits}?text=${encodeURIComponent(`Hi ${String(f.student || "").split(" ")[0]}, a friendly reminder: ${rupees(f.amount)} is due ${f.overdue ? "since" : "on"} ${fmtDay(f.due_date)} (invoice ${f.number}).`)}`}>
                                        Remind
                                    </Button>
                                )}
                            </div>
                        ))}
                    </Section>
                )}

                {data.can_manage && data.unassigned.length > 0 && (
                    <Section title="Leads nobody is handling" count={c.unassigned}
                        action={<Button size="sm" variant="light" onPress={() => navigate("/crm/leads?assigned_to=unassigned")}>Assign</Button>}>
                        {data.unassigned.map((l: any) => (
                            <LeadRow key={l.uuid} l={l} onOpen={() => navigate(`/crm/leads/${l.uuid}`)} extra={[statusMeta(l.status).label, sourceLabel(l.source), timeAgo(l.createdAt)].join(" · ")} />
                        ))}
                    </Section>
                )}
            </div>
        </div>
    );
};

export default TodayPage;
