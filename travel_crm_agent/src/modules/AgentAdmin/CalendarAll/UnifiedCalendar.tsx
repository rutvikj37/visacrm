import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import FormField from "@/modules/AgentAdmin/Crm/FormField";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button, Card, CardBody, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger,
    Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem,
    Spinner, Tab, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import { AlarmClock, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Copy, MessageCircle, Phone, Plus } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

const TYPES: Record<string, { label: string; short: string; dot: string; color: "warning" | "primary" | "secondary" | "success" | "danger" }> = {
    follow_up: { label: "Lead follow-up", short: "Follow-ups", dot: "bg-warning", color: "warning" },
    step_due: { label: "Case step due", short: "Steps", dot: "bg-primary", color: "primary" },
    event: { label: "Event", short: "Events", dot: "bg-secondary", color: "secondary" },
    fee_due: { label: "Fee due", short: "Fees", dot: "bg-danger", color: "danger" },
    task: { label: "Task", short: "Tasks", dot: "bg-success", color: "success" },
};
const TYPE_KEYS = Object.keys(TYPES);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => ymd(new Date());
const isOverdue = (e: any, today = todayKey()) => !e.done && e.type !== "event" && ymd(new Date(e.start)) < today;
const phoneDigits = (e: any) => String(e.phone_normalized || "").replace(/\D/g, "");
const leadUuid = (e: any) => e.lead_uuid || (String(e.id || "").startsWith("fu-") ? String(e.id).slice(3) : null);

type RowHandlers = {
    onOpen: (link: string) => void;
    onDone?: (e: any) => void;
    onSnooze?: (e: any, days: number) => void;
    busyId?: string | null;
};

const CallWhatsApp = ({ e }: { e: any }) => {
    const navigate = useNavigate();
    const digits = phoneDigits(e);
    const uuid = leadUuid(e);
    if (!digits || e.type !== "follow_up") return null;
    return (
        <span className="flex items-center gap-1 shrink-0" onClick={(ev) => ev.stopPropagation()}>
            <Button
                as="a"
                href={`tel:+${digits}`}
                isIconOnly
                size="sm"
                variant="flat"
                aria-label="Call"
                onPress={() => { if (uuid) setTimeout(() => navigate(`/crm/leads/${uuid}?called=1`), 700); }}
            >
                <Phone size={14} />
            </Button>
            <Button as="a" href={`https://wa.me/${digits}`} target="_blank" rel="noopener" isIconOnly size="sm" variant="flat" color="success" aria-label="WhatsApp">
                <MessageCircle size={14} />
            </Button>
        </span>
    );
};

const FollowUpActions = ({ e, onDone, onSnooze, busy }: { e: any; onDone?: (e: any) => void; onSnooze?: (e: any, days: number) => void; busy?: boolean }) => {
    if (e.type !== "follow_up" || e.done || !onDone || !onSnooze) return null;
    return (
        <span className="flex items-center gap-1 shrink-0" onClick={(ev) => ev.stopPropagation()}>
            <Button size="sm" variant="flat" color="success" isIconOnly aria-label="Mark done" isDisabled={busy} onPress={() => onDone(e)}>
                <CheckCircle2 size={14} />
            </Button>
            <Dropdown>
                <DropdownTrigger>
                    <Button size="sm" variant="flat" isIconOnly aria-label="Snooze" isDisabled={busy}>
                        <AlarmClock size={14} />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Snooze follow-up" onAction={(key) => onSnooze(e, Number(key))}>
                    <DropdownItem key="1">Tomorrow</DropdownItem>
                    <DropdownItem key="2">In 2 days</DropdownItem>
                    <DropdownItem key="7">In a week</DropdownItem>
                </DropdownMenu>
            </Dropdown>
        </span>
    );
};

const MetaLine = ({ e, when }: { e: any; when: string }) => (
    <span className="text-xs text-default-500">
        {TYPES[e.type]?.label}
        {" · "}
        {when}
        {e.assignee_name ? ` · ${e.assignee_name}` : ""}
        {e.note ? ` · ${e.note}` : ""}
    </span>
);

/** Agenda: overdue / today / tomorrow / next 7 days / later. */
const Agenda = ({ events, loading, onOpen, onDone, onSnooze, busyId }: { events: any[]; loading: boolean } & RowHandlers) => {
    const today = todayKey();
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
        if (k < today) { if (!e.done && e.type !== "event") groups[0].items.push(e); }
        else if (k === today) groups[1].items.push(e);
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
                    {g.items.map((e) => {
                        const overdue = g.key === "overdue" || isOverdue(e, today);
                        const when = g.key === "today" || g.key === "tomorrow"
                            ? (e.all_day ? "All day" : new Date(e.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }))
                            : new Date(e.start).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                        return (
                            <div
                                key={e.id}
                                className={`rounded-xl border bg-content1 p-3 flex gap-3 items-start ${overdue ? "border-danger-200 bg-danger-50/40" : "border-default-200"}`}
                            >
                                <button type="button" onClick={() => onOpen(e.link)} className="min-w-0 flex-1 text-left flex gap-3 hover:opacity-90">
                                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${TYPES[e.type]?.dot}`} />
                                    <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                                        <span className={`text-sm font-medium break-words ${e.done ? "line-through text-default-400" : ""} ${overdue ? "text-danger" : ""}`}>{e.title}</span>
                                        <MetaLine e={e} when={when} />
                                    </span>
                                </button>
                                <CallWhatsApp e={e} />
                                <FollowUpActions e={e} onDone={onDone} onSnooze={onSnooze} busy={busyId === e.id} />
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

const DayRow = ({ e, onOpen, onDone, onSnooze, busyId }: { e: any } & RowHandlers) => {
    const overdue = isOverdue(e);
    return (
        <div className={`rounded-xl border p-3 flex flex-col gap-2 ${overdue ? "border-danger-200 bg-danger-50/40" : "border-default-100"}`}>
            <button type="button" onClick={() => onOpen(e.link)} className="text-left flex flex-col gap-1 hover:opacity-90">
                <span className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" color={TYPES[e.type]?.color}>{TYPES[e.type]?.label}</Chip>
                    {overdue && <Chip size="sm" variant="flat" color="danger">Overdue</Chip>}
                    <span className="text-xs text-default-500 ml-auto">
                        {e.all_day ? "All day" : new Date(e.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </span>
                <span className={`text-sm font-medium break-words ${e.done ? "line-through text-default-400" : ""}`}>{e.title}</span>
                {(e.note || e.assignee_name) && (
                    <span className="text-xs text-default-500 break-words">
                        {[e.assignee_name, e.note].filter(Boolean).join(" · ")}
                    </span>
                )}
            </button>
            <div className="flex items-center gap-1 justify-end">
                <CallWhatsApp e={e} />
                <FollowUpActions e={e} onDone={onDone} onSnooze={onSnooze} busy={busyId === e.id} />
            </div>
        </div>
    );
};

/** Unified calendar: follow-ups, case due dates, fees, tasks and events. */
const UnifiedCalendar = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [selected, setSelected] = useState(ymd(new Date()));
    const [events, setEvents] = useState<any[]>([]);
    const [feedUrl, setFeedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [canFilterAssignee, setCanFilterAssignee] = useState(false);
    const [viewScope, setViewScope] = useState<"team" | "mine">("team");
    const [typeFilter, setTypeFilter] = useState<string[]>([]);
    const feedModal = useDisclosure();
    const createModal = useDisclosure();
    const [mode, setMode] = useState<"agenda" | "month">(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "month"));
    const [branch, setBranch] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newDate, setNewDate] = useState(ymd(new Date()));
    const [newTime, setNewTime] = useState("");
    const [newType, setNewType] = useState("event");
    const [savingEvent, setSavingEvent] = useState(false);

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
        const mine = viewScope === "mine" ? "&mine=1" : "";
        const { success, data } = await commonGetAPICalls(`/crm/calendar?from=${range.from}&to=${range.to}${branchQuery(branch)}${mine}`);
        if (success) {
            setEvents(data?.events || []);
            setFeedUrl(data?.feed_url || null);
            setCanFilterAssignee(Boolean(data?.can_filter_assignee));
        }
        setLoading(false);
    }, [days, branch, mode, viewScope]);
    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        if (!typeFilter.length) return events;
        const set = new Set(typeFilter);
        return events.filter((e) => set.has(e.type));
    }, [events, typeFilter]);

    const byDay = useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const e of visible) {
            const key = ymd(new Date(e.start));
            (map[key] = map[key] || []).push(e);
        }
        return map;
    }, [visible]);

    const today = todayKey();
    const dayEvents = byDay[selected] || [];
    const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
    const copy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); SuccessToast("Copied"); } catch { ErrorToast("Could not copy - select and copy it manually"); }
    };

    const toggleType = (key: string) => {
        setTypeFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const markDone = async (e: any) => {
        const uuid = leadUuid(e);
        if (!uuid) return;
        setBusyId(e.id);
        const { success } = await commonPostAPICall({ done: true }, `crm/leads/${uuid}/follow_up`, true);
        setBusyId(null);
        if (success) setEvents((prev) => prev.filter((x) => x.id !== e.id));
    };

    const snooze = async (e: any, daysAhead: number) => {
        const uuid = leadUuid(e);
        if (!uuid) return;
        const when = new Date();
        when.setDate(when.getDate() + daysAhead);
        when.setHours(11, 0, 0, 0);
        setBusyId(e.id);
        const { success } = await commonPostAPICall({ date: when.toISOString(), note: e.note || undefined }, `crm/leads/${uuid}/follow_up`, true);
        setBusyId(null);
        if (success) load();
    };

    const openCreate = (date?: string) => {
        setNewDate(date || selected || today);
        setNewTime("");
        setNewDesc("");
        setNewType("event");
        createModal.onOpen();
    };

    const createEvent = async () => {
        if (!newDesc.trim()) { ErrorToast("Please add a short description"); return; }
        setSavingEvent(true);
        const { success } = await commonPostAPICall({
            description: newDesc.trim(),
            date: dateToIsoNoon(newDate),
            time: newTime || undefined,
            event_type: newType,
        }, "crm/calendar/events", true);
        setSavingEvent(false);
        if (success) {
            createModal.onClose();
            load();
        }
    };

    const handlers: RowHandlers = { onOpen: (link) => navigate(link), onDone: markDone, onSnooze: snooze, busyId };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
                        <CalendarDays size={22} className="text-default-500" /> Calendar
                    </h1>
                    <p className="text-sm text-default-500">Follow-ups, steps, fees, tasks and events</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <BranchPicker value={branch} onChange={setBranch} />
                    <Button size="sm" color="primary" variant="flat" startContent={<Plus size={16} />} onPress={() => openCreate()}>
                        Add event
                    </Button>
                    <Button size="sm" variant="flat" startContent={<CalendarPlus size={16} />} onPress={feedModal.onOpen}>
                        Google Calendar
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Tabs size="sm" selectedKey={mode} onSelectionChange={(k) => setMode(k as any)} aria-label="Calendar view">
                    <Tab key="agenda" title="Agenda" />
                    <Tab key="month" title="Month" />
                </Tabs>
                {canFilterAssignee && (
                    <Tabs size="sm" selectedKey={viewScope} onSelectionChange={(k) => setViewScope(k as "team" | "mine")} aria-label="Assignee scope">
                        <Tab key="team" title="Team" />
                        <Tab key="mine" title="My day" />
                    </Tabs>
                )}
                {loading && events.length > 0 ? <Spinner size="sm" /> : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
                {TYPE_KEYS.map((key) => {
                    const t = TYPES[key];
                    const active = !typeFilter.length || typeFilter.includes(key);
                    const count = events.filter((e) => e.type === key).length;
                    if (!count && typeFilter.length && !typeFilter.includes(key)) {
                        // still show chip so user can turn it back on
                    }
                    return (
                        <Chip
                            key={key}
                            size="sm"
                            variant={active && typeFilter.length ? "solid" : "flat"}
                            color={active && typeFilter.length ? t.color : "default"}
                            className={`cursor-pointer ${!active ? "opacity-45" : ""}`}
                            onClick={() => toggleType(key)}
                            startContent={<span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
                        >
                            {t.short}{count ? ` · ${count}` : ""}
                        </Chip>
                    );
                })}
                {typeFilter.length > 0 && (
                    <Button size="sm" variant="light" onPress={() => setTypeFilter([])}>Clear</Button>
                )}
            </div>

            {mode === "agenda" ? (
                <Agenda events={visible} loading={loading} {...handlers} />
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
                                            {t.short}
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
                                            const hasOverdue = list.some((e) => isOverdue(e, today));
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setSelected(key)}
                                                    className={`min-h-[64px] sm:min-h-[84px] rounded-lg p-1.5 text-left border transition-colors ${
                                                        selected === key
                                                            ? "border-primary bg-primary-50"
                                                            : hasOverdue
                                                                ? "border-danger-200 bg-danger-50/50 hover:bg-danger-50"
                                                                : "border-default-100 hover:bg-default-100"
                                                    } ${inMonth ? "" : "opacity-40"}`}
                                                >
                                                    <span className={`text-xs inline-flex items-center justify-center h-6 w-6 rounded-full ${key === today ? "bg-primary text-white font-semibold" : hasOverdue ? "text-danger font-semibold" : ""}`}>
                                                        {d.getDate()}
                                                    </span>
                                                    <span className="hidden sm:flex flex-col gap-0.5 mt-1">
                                                        {list.slice(0, 2).map((e) => (
                                                            <span key={e.id} className={`flex items-center gap-1 text-[11px] truncate ${isOverdue(e, today) ? "text-danger font-medium" : ""}`}>
                                                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TYPES[e.type]?.dot}`} />
                                                                <span className="truncate">{e.title}</span>
                                                            </span>
                                                        ))}
                                                        {list.length > 2 && <span className="text-[11px] text-default-500">+{list.length - 2} more</span>}
                                                    </span>
                                                    {list.length > 0 && (
                                                        <span className="flex sm:hidden gap-0.5 mt-1 flex-wrap">
                                                            {list.slice(0, 4).map((e) => (
                                                                <span
                                                                    key={e.id}
                                                                    className={`h-1.5 w-1.5 rounded-full ${isOverdue(e, today) ? "bg-danger ring-1 ring-danger-300" : TYPES[e.type]?.dot}`}
                                                                />
                                                            ))}
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
                            <div className="flex items-center gap-2">
                                <div className="font-semibold text-sm sm:text-base min-w-0 flex-1">
                                    {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                                </div>
                                <Button size="sm" variant="flat" isIconOnly aria-label="Add event on this day" onPress={() => openCreate(selected)}>
                                    <Plus size={14} />
                                </Button>
                            </div>
                            {dayEvents.length === 0 && <p className="text-sm text-default-500">Nothing planned for this day.</p>}
                            {dayEvents.map((e) => <DayRow key={e.id} e={e} {...handlers} />)}
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
                                            <li>Follow-ups, fees, tasks and due dates refresh automatically (Google may take a few hours).</li>
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

            <Modal isOpen={createModal.isOpen} onOpenChange={createModal.onOpenChange} size="md">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Add event</ModalHeader>
                            <ModalBody className="gap-3">
                                <FormField label="Description">
                                    <Textarea
                                        aria-label="Description"
                                        labelPlacement="outside"
                                        placeholder="What is this for?"
                                        value={newDesc}
                                        onValueChange={setNewDesc}
                                        minRows={2}
                                    />
                                </FormField>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Date">
                                        <Input type="date" aria-label="Date" labelPlacement="outside" value={newDate} onValueChange={setNewDate} />
                                    </FormField>
                                    <FormField label="Time (optional)">
                                        <Input type="time" aria-label="Time" labelPlacement="outside" value={newTime} onValueChange={setNewTime} />
                                    </FormField>
                                </div>
                                <FormField label="Type">
                                    <Select
                                        aria-label="Type"
                                        labelPlacement="outside"
                                        selectedKeys={[newType]}
                                        onSelectionChange={(keys) => {
                                            const v = Array.from(keys)[0];
                                            if (v) setNewType(String(v));
                                        }}
                                    >
                                        <SelectItem key="event">Event</SelectItem>
                                        <SelectItem key="reminder">Reminder</SelectItem>
                                        <SelectItem key="followup">Follow-up</SelectItem>
                                        <SelectItem key="task">Task</SelectItem>
                                    </Select>
                                </FormField>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={savingEvent} onPress={createEvent}>Save</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

const dateToIsoNoon = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00`);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export default UnifiedCalendar;
