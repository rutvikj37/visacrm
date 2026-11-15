import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalHeader, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

const TYPES: Record<string, { label: string; dot: string; color: "warning" | "primary" | "secondary" }> = {
    follow_up: { label: "Lead follow-up", dot: "bg-warning", color: "warning" },
    step_due: { label: "Case step due", dot: "bg-primary", color: "primary" },
    event: { label: "Event / task", dot: "bg-secondary", color: "secondary" },
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Agenda: overdue / today / tomorrow / next 7 days / later. */
const Agenda = ({ events, loading, onOpen }: { events: any[]; loading: boolean; onOpen: (link: string) => void }) => {
    const todayKey = ymd(new Date());
    const tomorrowKey = ymd(new Date(Date.now() + 86400000));
    const weekKey = ymd(new Date(Date.now() + 7 * 86400000));
    const groups: { key: string; label: string; tone?: string; items: any[] }[] = [
        { key: "overdue", label: "Overdue", tone: "text-danger", items: [] },
        { key: "today", label: "Today", tone: "text-primary", items: [] },
        { key: "tomorrow", label: "Tomorrow", items: [] },
        { key: "week", label: "Next 7 days", items: [] },
        { key: "later", label: "Later", items: [] },
    ];
    for (const e of events) {
        const k = ymd(new Date(e.start));
        if (k < todayKey) { if (!e.done && e.type !== "event") groups[0].items.push(e); }
        else if (k === todayKey) groups[1].items.push(e);
        else if (k === tomorrowKey) groups[2].items.push(e);
        else if (k <= weekKey) groups[3].items.push(e);
        else groups[4].items.push(e);
    }
    if (loading && !events.length) return <div className="max-w-3xl"><CardListSkeleton cards={3} /></div>;
    const shown = groups.filter((g) => g.items.length || g.key === "today");
    return (
        <div className="flex flex-col gap-4 max-w-3xl">
            {shown.map((g) => (
                <div key={g.key} className="flex flex-col gap-2">
                    <div className={`text-sm font-semibold ${g.tone || ""}`}>
                        {g.label}{" "}
                        <span className="text-default-400 font-normal">{g.items.length || ""}</span>
                    </div>
                    {!g.items.length && (
                        <div className="text-sm text-default-500 rounded-xl border border-dashed border-default-200 p-3">
                            Nothing planned for today.
                        </div>
                    )}
                    {g.items.map((e) => (
                        <button
                            key={e.id}
                            type="button"
                            onClick={() => onOpen(e.link)}
                            className="text-left rounded-xl border border-default-200 bg-content1 hover:bg-default-100 p-3 flex gap-3"
                        >
                            <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${TYPES[e.type]?.dot}`} />
                            <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                                <span className={`text-sm font-medium break-words ${e.done ? "line-through text-default-400" : ""}`}>{e.title}</span>
                                <span className="text-xs text-default-500">
                                    {TYPES[e.type]?.label}
                                    {" · "}
                                    {g.key === "today" || g.key === "tomorrow"
                                        ? (e.all_day ? "All day" : new Date(e.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }))
                                        : new Date(e.start).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                                    {e.note ? ` · ${e.note}` : ""}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
};

/** Unified calendar: follow-ups, case due dates, and events. */
const UnifiedCalendar = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [selected, setSelected] = useState(ymd(new Date()));
    const [events, setEvents] = useState<any[]>([]);
    const [feedUrl, setFeedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const feedModal = useDisclosure();
    const [mode, setMode] = useState<"agenda" | "month">(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "month"));
    const [branch, setBranch] = useState("");

    const gridStart = useMemo(() => {
        const d = new Date(month);
        const offset = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - offset);
        return d;
    }, [month]);
    const days = useMemo(() => Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; }), [gridStart]);

    const load = useCallback(async () => {
        setLoading(true);
        const range = mode === "agenda"
            ? { from: ymd(new Date(Date.now() - 30 * 86400000)), to: ymd(new Date(Date.now() + 45 * 86400000)) }
            : { from: ymd(days[0]), to: ymd(days[41]) };
        const { success, data } = await commonGetAPICalls(`/crm/calendar?from=${range.from}&to=${range.to}${branchQuery(branch)}`);
        if (success) {
            setEvents(data?.events || []);
            setFeedUrl(data?.feed_url || null);
        }
        setLoading(false);
    }, [days, branch, mode]);
    useEffect(() => { load(); }, [load]);

    const byDay = useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const e of events) {
            const key = ymd(new Date(e.start));
            (map[key] = map[key] || []).push(e);
        }
        return map;
    }, [events]);

    const today = ymd(new Date());
    const dayEvents = byDay[selected] || [];
    const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
    const copy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); SuccessToast("Copied"); } catch { ErrorToast("Could not copy - select and copy it manually"); }
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            {/* Title + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
                        <CalendarDays size={22} className="text-default-500" /> Calendar
                    </h1>
                    <p className="text-sm text-default-500">Follow-ups, case due dates and events</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <BranchPicker value={branch} onChange={setBranch} />
                    <Button size="sm" variant="flat" startContent={<CalendarPlus size={16} />} onPress={feedModal.onOpen}>
                        Google Calendar
                    </Button>
                </div>
            </div>

            {/* View + soft refetch indicator */}
            <div className="flex flex-wrap items-center gap-2">
                <Tabs size="sm" selectedKey={mode} onSelectionChange={(k) => setMode(k as any)} aria-label="Calendar view">
                    <Tab key="agenda" title="Agenda" />
                    <Tab key="month" title="Month" />
                </Tabs>
                {loading && events.length > 0 ? <Spinner size="sm" /> : null}
            </div>

            {mode === "agenda" ? (
                <Agenda events={events} loading={loading} onOpen={(link) => navigate(link)} />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <Card shadow="sm" className="xl:col-span-2 border border-default-200">
                        <CardBody className="gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button isIconOnly size="sm" variant="flat" aria-label="Previous month" onPress={() => shift(-1)}><ChevronLeft size={16} /></Button>
                                <span className="font-semibold min-w-[140px] text-center text-sm sm:text-base">
                                    {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                                </span>
                                <Button isIconOnly size="sm" variant="flat" aria-label="Next month" onPress={() => shift(1)}><ChevronRight size={16} /></Button>
                                <Button
                                    size="sm"
                                    variant="light"
                                    onPress={() => {
                                        const d = new Date();
                                        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                        setSelected(ymd(d));
                                    }}
                                >
                                    Today
                                </Button>
                                <div className="hidden md:flex gap-3 ml-auto text-xs text-default-500">
                                    {Object.values(TYPES).map((t) => (
                                        <span key={t.label} className="flex items-center gap-1">
                                            <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                                            {t.label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {loading && !events.length ? (
                                <div className="flex justify-center py-16"><Spinner size="sm" label="Loading month…" /></div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-7 text-center text-xs text-default-500">
                                        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {days.map((d) => {
                                            const key = ymd(d);
                                            const list = byDay[key] || [];
                                            const inMonth = d.getMonth() === month.getMonth();
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setSelected(key)}
                                                    className={`min-h-[64px] sm:min-h-[84px] rounded-lg p-1.5 text-left border transition-colors ${selected === key ? "border-primary bg-primary-50" : "border-default-100 hover:bg-default-100"} ${inMonth ? "" : "opacity-40"}`}
                                                >
                                                    <span className={`text-xs inline-flex items-center justify-center h-6 w-6 rounded-full ${key === today ? "bg-primary text-white font-semibold" : ""}`}>
                                                        {d.getDate()}
                                                    </span>
                                                    <span className="hidden sm:flex flex-col gap-0.5 mt-1">
                                                        {list.slice(0, 2).map((e) => (
                                                            <span key={e.id} className="flex items-center gap-1 text-[11px] truncate">
                                                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TYPES[e.type]?.dot}`} />
                                                                <span className="truncate">{e.title}</span>
                                                            </span>
                                                        ))}
                                                        {list.length > 2 && <span className="text-[11px] text-default-500">+{list.length - 2} more</span>}
                                                    </span>
                                                    {list.length > 0 && (
                                                        <span className="flex sm:hidden gap-0.5 mt-1 flex-wrap">
                                                            {list.slice(0, 4).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${TYPES[e.type]?.dot}`} />)}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </CardBody>
                    </Card>

                    <Card shadow="sm" className="border border-default-200">
                        <CardBody className="gap-2">
                            <div className="font-semibold text-sm sm:text-base">
                                {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                            </div>
                            {dayEvents.length === 0 && <p className="text-sm text-default-500">Nothing planned for this day.</p>}
                            {dayEvents.map((e) => (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => navigate(e.link)}
                                    className="text-left rounded-xl border border-default-100 hover:bg-default-100 p-3 flex flex-col gap-1"
                                >
                                    <span className="flex items-center gap-2">
                                        <Chip size="sm" variant="flat" color={TYPES[e.type]?.color}>{TYPES[e.type]?.label}</Chip>
                                        <span className="text-xs text-default-500 ml-auto">
                                            {e.all_day ? "All day" : new Date(e.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </span>
                                    <span className={`text-sm font-medium break-words ${e.done ? "line-through text-default-400" : ""}`}>{e.title}</span>
                                    {e.note && <span className="text-xs text-default-500 break-words">{e.note}</span>}
                                </button>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            )}

            <Modal isOpen={feedModal.isOpen} onOpenChange={feedModal.onOpenChange} size="lg">
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader>Add to Google Calendar</ModalHeader>
                            <ModalBody className="pb-6 gap-3">
                                {feedUrl ? (
                                    <>
                                        <ol className="text-sm text-default-600 list-decimal ml-5 space-y-1">
                                            <li>Copy your private calendar link below.</li>
                                            <li>In Google Calendar open <b>Other calendars → + → From URL</b> and paste it.</li>
                                            <li>Follow-ups and due dates refresh automatically (Google may take a few hours).</li>
                                        </ol>
                                        <div className="flex gap-2 items-center">
                                            <Input size="sm" readOnly value={feedUrl} aria-label="Calendar link" classNames={{ input: "text-xs" }} />
                                            <Button size="sm" isIconOnly variant="flat" aria-label="Copy link" onPress={() => copy(feedUrl)}><Copy size={14} /></Button>
                                        </div>
                                        <p className="text-xs text-default-500">Also works with Apple Calendar and Outlook. Keep this link private.</p>
                                    </>
                                ) : (
                                    <p className="text-sm text-default-500">The calendar link is not available yet. Please contact support.</p>
                                )}
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default UnifiedCalendar;
