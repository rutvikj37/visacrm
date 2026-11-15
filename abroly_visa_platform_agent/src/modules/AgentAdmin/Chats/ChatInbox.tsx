import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, Button, Chip, Input, Spinner, Tab, Tabs, Textarea, Tooltip } from "@heroui/react";
import { ArrowLeft, Clock, ExternalLink, Instagram, MessageCircle, MessagesSquare, Phone, Search, Send } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import { statusMeta, timeAgo } from "@/modules/AgentAdmin/Crm/crmShared";
import EmptyState from "@/components/ui-kit/EmptyState";
import FirstTip from "@/components/help/FirstTip";

const ChannelIcon = ({ channel, size = 14 }: { channel: string; size?: number }) =>
    channel === "instagram" ? <Instagram size={size} className="text-pink-500 shrink-0" /> : <MessageCircle size={size} className="text-success shrink-0" />;

const clock = (v: string) => new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayLabel = (v: string) => {
    const d = new Date(v); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};
const hoursLeft = (v?: string | null) => (v ? Math.max(0, Math.round((new Date(v).getTime() - Date.now()) / 3600000)) : 0);

/** One chat: messages, and a reply box that knows WhatsApp / Instagram's 24-hour rule. */
const ChatThread = ({ uuid, onBack, onSent }: { uuid: string; onBack: () => void; onSent: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [text, setText] = useState("");
    const [channel, setChannel] = useState<"whatsapp" | "instagram">("whatsapp");
    const [sending, setSending] = useState(false);
    const [replies, setReplies] = useState<any[]>([]);
    const endRef = useRef<HTMLDivElement>(null);
    const count = useRef(0);

    const load = useCallback(async (first = false) => {
        const { success, data } = await commonGetAPICalls(`/crm/conversations/${uuid}`);
        if (!success) return;
        setData(data);
        if (first) {
            const last = data.messages[data.messages.length - 1];
            const ch = data.channels;
            setChannel(last?.channel === "instagram" && ch.instagram.possible ? "instagram" : ch.whatsapp.possible ? "whatsapp" : "instagram");
            window.dispatchEvent(new Event("chats-changed"));
        }
    }, [uuid]);

    useEffect(() => {
        setData(null); setText(""); count.current = 0;
        load(true);
        const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
        return () => clearInterval(t);
    }, [load]);
    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/messages/templates");
            if (success) setReplies((data?.templates || []).filter((t: any) => t.trigger === "manual" && t.body));
        })();
    }, []);
    useEffect(() => {
        if (data && data.messages.length !== count.current) {
            count.current = data.messages.length;
            endRef.current?.scrollIntoView({ block: "end" });
        }
    }, [data]);

    if (!data) return <div className="flex-1 grid place-items-center"><Spinner /></div>;
    const { lead, messages, channels } = data;
    const ch = channels[channel];
    const canSend = ch.connected && ch.possible && ch.window_open;
    const digits = String(lead.phone_normalized || "").replace(/\D/g, "");
    const reason = !ch.possible
        ? channel === "instagram" ? "This person did not message you on Instagram." : "This lead has no phone number."
        : !ch.connected
            ? `Connect your ${channel === "instagram" ? "Instagram account" : "WhatsApp Business number"} in Lead sources to reply from here.`
            : !ch.window_open && !ch.window_ends_at
                ? channel === "whatsapp"
                    ? "They have not messaged you on WhatsApp yet. WhatsApp lets businesses start a chat only with an approved template - call them, or message from your phone."
                    : "They have not messaged you on Instagram yet."
            : !ch.window_open
                ? channel === "whatsapp"
                    ? "More than 24 hours since their last message - WhatsApp only allows replies inside that window. Call them, or message from your phone."
                    : "More than 24 hours since their last message - reply from the Instagram app."
                : "";

    const fill = (t: any) => {
        const first = String(lead.name || "").trim().split(" ")[0] || "there";
        setText(String(t.body).replace(/\{\{\s*name\s*\}\}/gi, first).replace(/\{\{\s*country\s*\}\}/gi, lead.country || "").replace(/\{\{[^}]+\}\}/g, "").trim());
    };
    const send = async () => {
        const message = text.trim();
        if (!message || !canSend) return;
        setSending(true);
        const { success } = await commonPostAPICall({ message }, `crm/leads/${uuid}/${channel}`, true);
        setSending(false);
        if (success) { setText(""); await load(); onSent(); }
    };

    let lastDay = "";
    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex items-center gap-2 border-b border-default-100 px-3 py-2">
                <Button isIconOnly size="sm" variant="light" className="md:hidden" aria-label="Back to chats" onPress={onBack}><ArrowLeft size={18} /></Button>
                <Avatar size="sm" name={lead.name || "?"} className="shrink-0" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/crm/leads/${uuid}`)}>
                    <div className="font-semibold truncate">{lead.name || "Unnamed"}</div>
                    <div className="text-xs text-default-500 truncate">{[statusMeta(lead.status).label, lead.country, lead.assigned_name ? `with ${lead.assigned_name}` : "not assigned"].filter(Boolean).join(" · ")}</div>
                </button>
                {digits && <Button as="a" href={`tel:+${digits}`} isIconOnly size="sm" variant="flat" aria-label="Call"><Phone size={15} /></Button>}
                <Tooltip content="Open lead"><Button isIconOnly size="sm" variant="flat" aria-label="Open lead" onPress={() => navigate(`/crm/leads/${uuid}`)}><ExternalLink size={15} /></Button></Tooltip>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 bg-default-50">
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
                                    <ChannelIcon channel={m.channel} size={10} />{mine && m.by ? `${m.by} · ` : ""}{clock(m.at)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <div className="border-t border-default-100 p-2 flex flex-col gap-2 bg-content1">
                {(channels.whatsapp.possible && channels.instagram.possible) && (
                    <Tabs size="sm" aria-label="Reply on" selectedKey={channel} onSelectionChange={(k) => setChannel(k as any)}>
                        <Tab key="whatsapp" title={<span className="flex items-center gap-1"><MessageCircle size={13} />WhatsApp</span>} />
                        <Tab key="instagram" title={<span className="flex items-center gap-1"><Instagram size={13} />Instagram</span>} />
                    </Tabs>
                )}
                {reason ? (
                    <div className="flex items-start gap-2 rounded-lg bg-warning-50 text-warning-800 text-xs px-3 py-2">
                        <Clock size={14} className="shrink-0 mt-0.5" /><span className="flex-1">{reason}</span>
                        {channel === "whatsapp" && ch.possible && digits && <a className="font-medium underline shrink-0" href={`https://wa.me/${digits}`} target="_blank" rel="noopener">Open WhatsApp</a>}
                        {!ch.connected && ch.possible && <button type="button" className="font-medium underline shrink-0" onClick={() => navigate("/crm/sources")}>Lead sources</button>}
                    </div>
                ) : (
                    <>
                        {replies.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                                {replies.map((t) => <Chip key={t.id} size="sm" variant="flat" className="cursor-pointer shrink-0" onClick={() => fill(t)}>{t.name}</Chip>)}
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <Textarea aria-label="Reply" minRows={1} maxRows={5} placeholder={`Reply on ${channel === "instagram" ? "Instagram" : "WhatsApp"}...`} value={text} onValueChange={setText}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                            <Button isIconOnly color="primary" aria-label="Send" isLoading={sending} isDisabled={!text.trim()} onPress={send}><Send size={16} /></Button>
                        </div>
                        <div className="text-[11px] text-default-400 px-1">Enter to send · Shift+Enter for a new line · {hoursLeft(ch.window_ends_at)}h left to reply</div>
                    </>
                )}
            </div>
        </div>
    );
};

/** Shared WhatsApp + Instagram inbox: every chat with a lead in one place, newest first. */
const ChatInbox = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [params, setParams] = useSearchParams();
    const open = params.get("chat") || "";
    const [list, setList] = useState<any[] | null>(null);
    const [unread, setUnread] = useState(0);
    const [channel, setChannel] = useState("all");
    const [filter, setFilter] = useState("all");
    const [q, setQ] = useState("");
    const [branch, setBranch] = useState("");

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/conversations?channel=${channel}&filter=${filter}&q=${encodeURIComponent(q)}${branchQuery(branch).replace("?", "&")}`);
        if (success) { setList(data.conversations); setUnread(data.unread_chats); }
    }, [channel, filter, q, branch]);
    useEffect(() => {
        const t0 = setTimeout(load, q ? 300 : 0);
        const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
        return () => { clearTimeout(t0); clearInterval(t); };
    }, [load]);

    const select = (uuid: string) => {
        setParams(uuid ? { chat: uuid } : {}, { replace: false });
        setList((l) => l?.map((c) => (c.uuid === uuid ? { ...c, unread: 0 } : c)) || l);
    };
    // fill the screen below whatever sits above (banners, tips) so the reply box is always visible
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
            {!open && <FirstTip id="chats" title="All your chats in one place">WhatsApp and Instagram messages from every lead arrive here. Open a chat to reply - your team sees who answered. Replies are possible within 24 hours of the person's last message.</FirstTip>}
            <div ref={boxRef} style={{ height }} className="min-h-0 flex rounded-xl border border-default-200 bg-content1 overflow-hidden">
                <div className={`w-full md:w-[340px] md:border-r border-default-100 flex flex-col min-h-0 ${open ? "max-md:hidden" : ""}`}>
                    <div className="p-2 flex flex-col gap-2 border-b border-default-100">
                        <div className="flex items-center gap-2">
                            <div className="font-semibold flex items-center gap-1.5"><MessagesSquare size={18} /> Chats</div>
                            {unread > 0 && <Chip size="sm" color="success" variant="flat">{unread} unread</Chip>}
                            <div className="ml-auto"><BranchPicker value={branch} onChange={setBranch} /></div>
                        </div>
                        <Input size="sm" aria-label="Search chats" placeholder="Search name, phone or message" startContent={<Search size={14} />} value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <Tabs size="sm" aria-label="Show" selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))}>
                                <Tab key="all" title="All" /><Tab key="unread" title="Unread" /><Tab key="mine" title="Mine" />
                            </Tabs>
                            <Tabs size="sm" variant="light" aria-label="Channel" selectedKey={channel} onSelectionChange={(k) => setChannel(String(k))}>
                                <Tab key="all" title="Both" />
                                <Tab key="whatsapp" title={<MessageCircle size={14} aria-label="WhatsApp" />} />
                                <Tab key="instagram" title={<Instagram size={14} aria-label="Instagram" />} />
                            </Tabs>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {!list ? <div className="p-6 flex justify-center"><Spinner /></div>
                            : !list.length ? (
                                <EmptyState icon={MessagesSquare} title={filter === "unread" ? "No unread chats" : "No chats yet"}
                                    text={filter === "unread" ? "You have answered everyone." : "Connect WhatsApp or Instagram in Lead sources. Messages from leads appear here."} />
                            ) : list.map((c) => (
                                <button key={c.uuid} type="button" onClick={() => select(c.uuid)}
                                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 border-b border-default-100 hover:bg-default-50 ${c.uuid === open ? "bg-primary-50" : ""}`}>
                                    <Avatar size="sm" name={c.name} className="shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`truncate text-sm ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                                            <span className={`ml-auto text-[11px] shrink-0 ${c.unread ? "text-success-600 font-medium" : "text-default-400"}`}>{timeAgo(c.last_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <ChannelIcon channel={c.channel} size={12} />
                                            <span className={`truncate text-xs ${c.unread ? "text-default-800" : "text-default-500"}`}>{c.last_direction === "out" ? "You: " : ""}{c.last_message}</span>
                                            {c.unread > 0 && <span className="ml-auto shrink-0 min-w-5 h-5 px-1 rounded-full bg-success text-white text-[11px] font-semibold grid place-items-center">{c.unread}</span>}
                                        </div>
                                        <div className="text-[11px] text-default-400 truncate">{c.assigned_name || "Not assigned"}{c.window_open ? "" : " · reply window closed"}</div>
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
                <div className={`flex-1 min-w-0 flex ${open ? "" : "max-md:hidden"}`}>
                    {open
                        ? <ChatThread key={open} uuid={open} onBack={() => select("")} onSent={load} />
                        : <div className="flex-1 grid place-items-center text-center p-6 text-default-500 text-sm"><div><MessagesSquare size={36} className="mx-auto mb-2 text-default-300" />Pick a chat on the left to read and reply.</div></div>}
                </div>
            </div>
        </div>
    );
};

export default ChatInbox;
