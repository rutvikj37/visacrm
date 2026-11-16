import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, Button, Chip, Input, Spinner, Tab, Tabs, Textarea } from "@heroui/react";
import { ArrowLeft, MessagesSquare, Search, Send, User } from "lucide-react";
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

/** One student thread: portal messages with the assigned counsellor. */
const ChatThread = ({ studentId, onBack, onSent }: { studentId: string; onBack: () => void; onSent: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const count = useRef(0);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/portal_chats/${studentId}`);
        if (!success) return;
        setData(data);
        window.dispatchEvent(new Event("chats-changed"));
    }, [studentId]);

    useEffect(() => {
        setData(null); setText(""); count.current = 0;
        load();
        const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
        return () => clearInterval(t);
    }, [load]);

    useEffect(() => {
        if (data && data.messages.length !== count.current) {
            count.current = data.messages.length;
            endRef.current?.scrollIntoView({ block: "end" });
        }
    }, [data]);

    if (!data) return <div className="flex-1 grid place-items-center"><Spinner /></div>;
    const { student, messages, assignee } = data;

    const send = async () => {
        const message = text.trim();
        if (!message) return;
        setSending(true);
        const { success } = await commonPostAPICall({ message }, `crm/portal_chats/${studentId}/send`, false);
        setSending(false);
        if (success) { setText(""); await load(); onSent(); }
    };

    let lastDay = "";
    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex items-center gap-2 border-b border-default-100 px-3 py-2">
                <Button isIconOnly size="sm" variant="light" className="md:hidden" aria-label="Back to chats" onPress={onBack}><ArrowLeft size={18} /></Button>
                <Avatar size="sm" name={student.name || "?"} className="shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{student.name || "Student"}</div>
                    <div className="text-xs text-default-500 truncate">
                        {[student.phone, assignee?.name ? `Counsellor: ${assignee.name}` : "No counsellor assigned"].filter(Boolean).join(" · ")}
                    </div>
                </div>
                <Button size="sm" variant="flat" startContent={<User size={14} />} onPress={() => navigate(`/leads/students`)}>Students</Button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 bg-default-50">
                {!messages.length && (
                    <div className="m-auto text-center text-sm text-default-500 px-6">
                        No messages yet. Send a note — the student will see it in their portal.
                    </div>
                )}
                {messages.map((m: any) => {
                    const day = dayLabel(m.at);
                    const sep = day !== lastDay; lastDay = day;
                    const mine = m.direction === "out";
                    return (
                        <div key={m.id} className="flex flex-col">
                            {sep && <div className="self-center text-[11px] text-default-500 bg-content1 rounded-full px-2.5 py-0.5 my-2 shadow-sm">{day}</div>}
                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${mine ? "self-end bg-primary text-primary-foreground rounded-br-md" : "self-start bg-content1 rounded-bl-md"}`}>
                                {m.text}
                                <div className={`mt-0.5 text-[10px] flex items-center gap-1 ${mine ? "text-primary-foreground/75 justify-end" : "text-default-400"}`}>
                                    {mine && m.by ? `${m.by} · ` : ""}{clock(m.at)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <div className="border-t border-default-100 p-2 flex flex-col gap-2 bg-content1">
                <div className="flex items-end gap-2">
                    <Textarea
                        aria-label="Reply"
                        minRows={1}
                        maxRows={5}
                        placeholder="Message the student…"
                        value={text}
                        onValueChange={setText}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    />
                    <Button isIconOnly color="primary" aria-label="Send" isLoading={sending} isDisabled={!text.trim()} onPress={send}><Send size={16} /></Button>
                </div>
                <div className="text-[11px] text-default-400 px-1">Enter to send · Shift+Enter for a new line</div>
            </div>
        </div>
    );
};

/** Student ↔ assigned counsellor portal chat (WhatsApp / Instagram removed for now). */
const ChatInbox = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [params, setParams] = useSearchParams();
    const open = params.get("chat") || "";
    const [list, setList] = useState<any[] | null>(null);
    const [unread, setUnread] = useState(0);
    const [filter, setFilter] = useState("all");
    const [q, setQ] = useState("");
    const [branch, setBranch] = useState("");

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/portal_chats?filter=${filter}&q=${encodeURIComponent(q)}${branchQuery(branch).replace("?", "&")}`);
        if (success) { setList(data.conversations); setUnread(data.unread_chats); }
    }, [filter, q, branch]);

    useEffect(() => {
        const t0 = setTimeout(load, q ? 300 : 0);
        const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
        return () => { clearTimeout(t0); clearInterval(t); };
    }, [load]);

    const select = (id: string) => {
        setParams(id ? { chat: id } : {}, { replace: false });
        setList((l) => l?.map((c) => (String(c.student_id) === id || c.uuid === id ? { ...c, unread: 0 } : c)) || l);
    };

    const boxRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(560);
    useLayoutEffect(() => {
        const fit = () => {
            const el = boxRef.current; if (!el) return;
            const bottomNav = window.innerWidth < 768 ? 76 : 0;
            setHeight(Math.max(420, window.innerHeight - el.getBoundingClientRect().top - window.scrollY - bottomNav - 12));
        };
        fit();
        const ro = new ResizeObserver(fit); ro.observe(document.body);
        window.addEventListener("resize", fit);
        return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
    }, [open]);

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-full">
            {!open && (
                <FirstTip id="chats-portal" title="Chat with your students">
                    Message students who have a visa case with you. They reply from the student portal — only you and their assigned counsellor see the thread.
                </FirstTip>
            )}
            <div ref={boxRef} style={{ height }} className="min-h-0 flex rounded-xl border border-default-200 bg-content1 overflow-hidden">
                <div className={`w-full md:w-[340px] md:border-r border-default-100 flex flex-col min-h-0 ${open ? "max-md:hidden" : ""}`}>
                    <div className="p-2 flex flex-col gap-2 border-b border-default-100">
                        <div className="flex items-center gap-2">
                            <div className="font-semibold flex items-center gap-1.5"><MessagesSquare size={18} /> Chats</div>
                            {unread > 0 && <Chip size="sm" color="primary" variant="flat">{unread} unread</Chip>}
                            <div className="ml-auto"><BranchPicker value={branch} onChange={setBranch} /></div>
                        </div>
                        <Input size="sm" aria-label="Search chats" placeholder="Search student name or phone" startContent={<Search size={14} />} value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
                        <Tabs size="sm" aria-label="Show" selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))}>
                            <Tab key="all" title="All" /><Tab key="unread" title="Unread" /><Tab key="mine" title="Mine" />
                        </Tabs>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {!list ? <div className="p-6 flex justify-center"><Spinner /></div>
                            : !list.length ? (
                                <EmptyState
                                    icon={MessagesSquare}
                                    title={filter === "unread" ? "No unread chats" : "No student chats yet"}
                                    text={filter === "unread" ? "You have answered everyone." : "When a lead is converted to a visa case, you can chat with that student here."}
                                />
                            ) : list.map((c) => {
                                const id = String(c.student_id || c.uuid);
                                return (
                                    <button key={id} type="button" onClick={() => select(id)}
                                        className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 border-b border-default-100 hover:bg-default-50 ${id === open ? "bg-primary-50" : ""}`}>
                                        <Avatar size="sm" name={c.name} className="shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`truncate text-sm ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                                                <span className={`ml-auto text-[11px] shrink-0 ${c.unread ? "text-primary font-medium" : "text-default-400"}`}>{c.last_at ? timeAgo(c.last_at) : ""}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`truncate text-xs ${c.unread ? "text-default-800" : "text-default-500"}`}>{c.last_direction === "out" ? "You: " : ""}{c.last_message}</span>
                                                {c.unread > 0 && <span className="ml-auto shrink-0 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[11px] font-semibold grid place-items-center">{c.unread}</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </div>
                <div className={`flex-1 min-w-0 flex ${open ? "" : "max-md:hidden"}`}>
                    {open
                        ? <ChatThread key={open} studentId={open} onBack={() => select("")} onSent={load} />
                        : <div className="flex-1 grid place-items-center text-center p-6 text-default-500 text-sm"><div><MessagesSquare size={36} className="mx-auto mb-2 text-default-300" />Pick a student on the left to chat.</div></div>}
                </div>
            </div>
        </div>
    );
};

export default ChatInbox;
