import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, Button, Chip, Input, Pagination, Skeleton, Tab, Tabs, Textarea } from "@heroui/react";
import { ArrowLeft, MessagesSquare, RefreshCw, Search, Send, User } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import { timeAgo } from "@/modules/AgentAdmin/Crm/crmShared";
import EmptyState from "@/components/ui-kit/EmptyState";
import FirstTip from "@/components/help/FirstTip";

const clock = (v: string) => new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayLabel = (v: string) => {
    const d = new Date(v); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

const ChatListSkeleton = () => (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading chats">
        {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-3 border-b border-default-100">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                        <Skeleton className={`h-3.5 rounded-md ${i % 2 ? "w-28" : "w-36"}`} />
                        <Skeleton className="h-3 w-10 rounded-md ml-auto" />
                    </div>
                    <Skeleton className={`h-3 rounded-md ${i % 3 ? "w-4/5" : "w-3/5"}`} />
                </div>
            </div>
        ))}
    </div>
);

/** One student thread: portal messages with the assigned counsellor. */
const ChatThread = ({ studentId, onBack, onSent }: { studentId: string; onBack: () => void; onSent: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const apiGet = useRef(commonGetAPICalls);
    const apiPost = useRef(commonPostAPICall);
    apiGet.current = commonGetAPICalls;
    apiPost.current = commonPostAPICall;

    const [data, setData] = useState<any>(null);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const count = useRef(0);
    const onSentRef = useRef(onSent);
    onSentRef.current = onSent;

    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, []);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        const { success, data, message } = await apiGet.current(`/crm/portal_chats/${studentId}`);
        if (!success) {
            setError(message || "Could not load this chat");
            if (!opts?.silent) setLoading(false);
            return;
        }
        setError("");
        setData(data);
        setLoading(false);
        window.dispatchEvent(new Event("chats-changed"));
    }, [studentId]);

    // Reset only when switching students — never wipe the thread on poll/send refresh.
    useEffect(() => {
        setData(null); setText(""); setError(""); setLoading(true); count.current = 0;
        load();
        const t = setInterval(() => { if (!document.hidden) load({ silent: true }); }, 10000);
        return () => clearInterval(t);
    }, [load]);

    useEffect(() => {
        if (data && data.messages.length !== count.current) {
            count.current = data.messages.length;
            // Keep scroll inside the message pane — scrollIntoView was jumping the whole page.
            requestAnimationFrame(scrollToBottom);
        }
    }, [data, scrollToBottom]);

    const send = async (e?: FormEvent) => {
        e?.preventDefault();
        const message = text.trim();
        if (!message || sending) return;
        setSending(true);
        const { success, message: err } = await apiPost.current({ message }, `crm/portal_chats/${studentId}/send`, false);
        setSending(false);
        if (success) { setText(""); await load({ silent: true }); onSentRef.current(); }
        else setError(err || "Message failed to send");
    };

    if (loading && !data) {
        return (
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="flex items-center gap-2 border-b border-default-200 px-3 py-2.5">
                    <Button isIconOnly size="sm" variant="light" className="md:hidden" aria-label="Back to chats" onPress={onBack}><ArrowLeft size={18} /></Button>
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-36 rounded-md" />
                        <Skeleton className="h-3 w-48 rounded-md" />
                    </div>
                </div>
                <div className="flex-1 grid place-items-center bg-[#f4f6f9]">
                    <div className="text-sm text-default-500">Loading conversation…</div>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex-1 flex flex-col min-w-0 min-h-0 items-center justify-center gap-3 p-6 text-center">
                <MessagesSquare size={32} className="text-default-300" />
                <div className="text-sm text-default-600 max-w-xs">{error}</div>
                <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} onPress={() => load()}>Try again</Button>
                <Button size="sm" variant="light" className="md:hidden" startContent={<ArrowLeft size={14} />} onPress={onBack}>Back to chats</Button>
            </div>
        );
    }

    const { student, messages, assignee } = data;
    let lastDay = "";
    let lastDir = "";

    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex items-center gap-2 border-b border-default-200 px-3 py-2.5 bg-content1">
                <Button isIconOnly size="sm" variant="light" className="md:hidden" aria-label="Back to chats" onPress={onBack}><ArrowLeft size={18} /></Button>
                <Avatar size="sm" name={student.name || "?"} className="shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate leading-tight">{student.name || "Student"}</div>
                    <div className="text-xs text-default-500 truncate mt-0.5">
                        {[student.phone, assignee?.name ? `Counsellor: ${assignee.name}` : "No counsellor assigned"].filter(Boolean).join(" · ")}
                    </div>
                </div>
                <Button size="sm" variant="flat" startContent={<User size={14} />} onPress={() => navigate(`/leads/students`)}>Students</Button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col bg-[#f4f6f9]">
                {error && (
                    <div className="self-center mb-2 rounded-lg bg-danger-50 text-danger-700 text-xs px-3 py-1.5 flex items-center gap-2">
                        <span className="min-w-0">{error}</span>
                        <button type="button" className="underline shrink-0" onClick={() => { setError(""); load({ silent: true }); }}>Retry</button>
                    </div>
                )}
                {!messages.length && (
                    <div className="m-auto text-center px-6 py-8 max-w-sm">
                        <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-primary-50 text-primary grid place-items-center">
                            <MessagesSquare size={22} strokeWidth={1.8} />
                        </div>
                        <div className="font-medium text-sm text-default-700">Start the conversation</div>
                        <div className="text-xs text-default-500 mt-1 leading-relaxed">
                            Send a note — the student will see it in their portal. Only you and their assigned counsellor can read this thread.
                        </div>
                    </div>
                )}
                {messages.map((m: any, i: number) => {
                    const day = dayLabel(m.at);
                    const sep = day !== lastDay; lastDay = day;
                    const mine = m.direction === "out";
                    const prevSame = !sep && lastDir === m.direction;
                    lastDir = m.direction;
                    const next = messages[i + 1];
                    const nextSameDay = next && dayLabel(next.at) === day;
                    const nextSame = nextSameDay && next.direction === m.direction;
                    return (
                        <div key={m.id} className={`flex flex-col ${prevSame ? "mt-0.5" : "mt-2.5"}`}>
                            {sep && (
                                <div className="self-center text-[11px] font-medium text-default-500 bg-content1 border border-default-100 rounded-full px-2.5 py-0.5 my-2.5 shadow-sm">
                                    {day}
                                </div>
                            )}
                            <div
                                className={`max-w-[85%] sm:max-w-[72%] px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm ${
                                    mine
                                        ? `self-end bg-primary text-primary-foreground ${nextSame ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                                        : `self-start bg-content1 text-foreground border border-default-100 ${nextSame ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"}`
                                }`}
                            >
                                {m.text}
                                <div className={`mt-1 text-[10px] leading-none flex items-center gap-1 ${mine ? "text-primary-foreground/70 justify-end" : "text-default-400"}`}>
                                    {mine && m.by ? <span className="truncate max-w-[9rem]">{m.by}</span> : null}
                                    {mine && m.by ? <span>·</span> : null}
                                    <span>{clock(m.at)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <form className="border-t border-default-200 px-2.5 pt-2 pb-2 bg-content1 shrink-0" onSubmit={send}>
                <div className="flex items-end gap-2">
                    <Textarea
                        aria-label="Reply"
                        minRows={1}
                        maxRows={5}
                        placeholder="Message the student…"
                        value={text}
                        onValueChange={setText}
                        classNames={{
                            inputWrapper: "bg-default-50 border border-default-200 shadow-none data-[hover=true]:bg-default-100 group-data-[focus=true]:bg-content1",
                            input: "text-sm",
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !(e as any).isComposing && e.keyCode !== 229) {
                                e.preventDefault();
                                e.stopPropagation();
                                (e.currentTarget.closest("form") as HTMLFormElement | null)?.requestSubmit();
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        isIconOnly
                        color="primary"
                        aria-label="Send"
                        className="shrink-0 h-10 w-10"
                        isLoading={sending}
                        isDisabled={!text.trim() || sending}
                    >
                        <Send size={16} />
                    </Button>
                </div>
                <div className="h-5 flex items-center px-1 mt-1">
                    <span className="text-[11px] text-default-400">Enter to send · Shift+Enter for a new line</span>
                </div>
            </form>
        </div>
    );
};

/** Student ↔ assigned counsellor portal chat (WhatsApp / Instagram removed for now). */
const ChatInbox = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const apiGet = useRef(commonGetAPICalls);
    apiGet.current = commonGetAPICalls;
    const PAGE_SIZE = 25;
    const [params, setParams] = useSearchParams();
    const open = params.get("chat") || "";
    const page = Math.max(1, Number(params.get("page") || 1) || 1);
    const [list, setList] = useState<any[] | null>(null);
    const [unread, setUnread] = useState(0);
    const [filter, setFilter] = useState("all");
    const [q, setQ] = useState("");
    const [branch, setBranch] = useState("");
    const [listError, setListError] = useState("");
    const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });

    const setPage = useCallback((p: number) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (p <= 1) next.delete("page");
            else next.set("page", String(p));
            return next;
        }, { replace: true });
    }, [setParams]);

    const load = useCallback(async () => {
        const { success, data, message } = await apiGet.current(
            `/crm/portal_chats?filter=${filter}&q=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_SIZE}${branchQuery(branch).replace("?", "&")}`,
        );
        if (!success) {
            setListError(message || "Could not load chats");
            setList((prev) => prev ?? []);
            return;
        }
        setListError("");
        setList(data.conversations);
        setUnread(data.unread_chats);
        setPagination(data.pagination || { totalPages: 1, totalItems: data.conversations?.length || 0 });
    }, [filter, q, branch, page]);

    useEffect(() => {
        const t0 = setTimeout(load, q ? 300 : 0);
        const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
        return () => { clearTimeout(t0); clearInterval(t); };
    }, [load, q]);

    useEffect(() => {
        if (page !== 1) setPage(1);
        // reset to first page when filters change; page itself is intentionally omitted
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, q, branch]);

    const select = (id: string) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (id) next.set("chat", id);
            else next.delete("chat");
            return next;
        }, { replace: true });
        setList((l) => l?.map((c) => (String(c.student_id) === id || c.uuid === id ? { ...c, unread: 0 } : c)) || l);
    };

    const boxRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(560);
    useLayoutEffect(() => {
        const fit = () => {
            const el = boxRef.current; if (!el) return;
            const bottomNav = window.innerWidth < 768 ? 76 : 0;
            setHeight(Math.max(420, window.innerHeight - el.getBoundingClientRect().top - bottomNav - 12));
        };
        fit();
        window.addEventListener("resize", fit);
        return () => { window.removeEventListener("resize", fit); };
    }, [open]);

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-full">
            {!open && (
                <FirstTip id="chats-portal" title="Chat with your students">
                    Message students who have a visa case with you. They reply from the student portal — only you and their assigned counsellor see the thread.
                </FirstTip>
            )}
            <div ref={boxRef} style={{ height }} className="min-h-0 flex rounded-xl border border-default-200 bg-content1 overflow-hidden shadow-sm">
                <div className={`w-full md:w-[340px] md:border-r border-default-200 flex flex-col min-h-0 bg-content1 ${open ? "max-md:hidden" : ""}`}>
                    <div className="p-2.5 flex flex-col gap-2 border-b border-default-200">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="font-semibold flex items-center gap-1.5 text-[15px] shrink-0"><MessagesSquare size={18} className="text-primary" /> Chats</div>
                            {unread > 0 && <Chip size="sm" color="primary" variant="flat" className="shrink-0">{unread} unread</Chip>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <BranchPicker value={branch} onChange={setBranch} className="w-full" />
                            <Input
                                size="sm"
                                aria-label="Search chats"
                                placeholder="Search student name or phone"
                                startContent={<Search size={14} className="text-default-400" />}
                                value={q}
                                onValueChange={setQ}
                                isClearable
                                onClear={() => setQ("")}
                                classNames={{ inputWrapper: "bg-default-50 border border-default-200 shadow-none" }}
                            />
                        </div>
                        <Tabs
                            size="sm"
                            aria-label="Show"
                            selectedKey={filter}
                            onSelectionChange={(k) => { setList(null); setFilter(String(k)); setPage(1); }}
                            classNames={{ tabList: "bg-default-100/80 w-full", cursor: "bg-content1 shadow-sm", tab: "flex-1" }}
                        >
                            <Tab key="all" title="All" /><Tab key="unread" title="Unread" /><Tab key="mine" title="Mine" />
                        </Tabs>
                    </div>
                    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                        {list === null ? <ChatListSkeleton />
                            : listError && !list.length ? (
                                <div className="p-6 flex flex-col items-center gap-3 text-center">
                                    <div className="text-sm text-default-600">{listError}</div>
                                    <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} onPress={() => { setList(null); load(); }}>Try again</Button>
                                </div>
                            ) : !list.length ? (
                                <EmptyState
                                    compact
                                    icon={MessagesSquare}
                                    title={filter === "unread" ? "No unread chats" : filter === "mine" ? "No chats assigned to you" : "No student chats yet"}
                                    text={
                                        filter === "unread"
                                            ? "You’re all caught up — new student replies will show here."
                                            : filter === "mine"
                                                ? "When you’re the assigned counsellor, those threads appear under Mine."
                                                : "When a lead is converted to a visa case, you can chat with that student here."
                                    }
                                />
                            ) : (
                                <>
                                    {listError && (
                                        <div className="mx-2 mt-2 rounded-lg bg-warning-50 text-warning-800 text-xs px-2.5 py-1.5 flex items-center gap-2">
                                            <span className="min-w-0 flex-1">{listError}</span>
                                            <button type="button" className="underline shrink-0" onClick={() => load()}>Retry</button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                    {list.map((c) => {
                                        const id = String(c.student_id || c.uuid);
                                        const active = id === open;
                                        const hasUnread = c.unread > 0;
                                        const preview = c.last_message || "No messages yet";
                                        const emptyPreview = !c.last_at;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => select(id)}
                                                className={`w-full text-left flex items-start gap-2.5 px-3 py-3 border-b border-default-100 transition-colors relative ${
                                                    active
                                                        ? "bg-primary-50/80 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
                                                        : "hover:bg-default-50"
                                                }`}
                                            >
                                                <div className="relative shrink-0 mt-0.5">
                                                    <Avatar size="sm" name={c.name} className="h-10 w-10 text-sm" />
                                                    {hasUnread && (
                                                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-content1" aria-hidden />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className={`truncate text-sm leading-tight ${hasUnread ? "font-semibold text-foreground" : "font-medium text-default-800"}`}>
                                                            {c.name}
                                                        </span>
                                                        <span className={`ml-auto text-[11px] shrink-0 tabular-nums ${hasUnread ? "text-primary font-medium" : "text-default-400"}`}>
                                                            {c.last_at ? timeAgo(c.last_at) : ""}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`truncate text-xs leading-snug ${hasUnread ? "text-default-700" : "text-default-500"} ${emptyPreview ? "italic" : ""}`}>
                                                            {!emptyPreview && c.last_direction === "out" ? "You: " : ""}
                                                            {preview}
                                                        </span>
                                                        {hasUnread && (
                                                            <span className="ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
                                                                {c.unread > 99 ? "99+" : c.unread}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {c.phone && (
                                                        <div className="text-[11px] text-default-400 truncate mt-0.5">{c.phone}</div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    </div>
                                    {pagination.totalPages > 1 && (
                                        <div className="shrink-0 border-t border-default-200 p-2 flex justify-center bg-content1">
                                            <Pagination size="sm" total={pagination.totalPages} page={page} onChange={setPage} showControls />
                                        </div>
                                    )}
                                </>
                            )}
                    </div>
                </div>
                <div className={`flex-1 min-w-0 flex ${open ? "" : "max-md:hidden"}`}>
                    {open
                        ? <ChatThread key={open} studentId={open} onBack={() => select("")} onSent={load} />
                        : (
                            <div className="flex-1 grid place-items-center text-center p-8 bg-[#f4f6f9]">
                                <div className="max-w-xs">
                                    <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-content1 border border-default-200 text-primary grid place-items-center shadow-sm">
                                        <MessagesSquare size={28} strokeWidth={1.7} />
                                    </div>
                                    <div className="font-medium text-default-700">Select a conversation</div>
                                    <div className="text-sm text-default-500 mt-1 leading-relaxed">
                                        Pick a student on the left to read and reply. Unread threads stay highlighted until you open them.
                                    </div>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
};

export default ChatInbox;
