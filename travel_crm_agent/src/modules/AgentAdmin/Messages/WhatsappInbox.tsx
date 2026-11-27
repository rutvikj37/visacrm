import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Spinner, Tab, Tabs, Textarea } from "@heroui/react";
import { ArrowLeft, ExternalLink, MessageCircle, Search, Send, Settings } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";

const time = (d?: string) => {
    if (!d) return "";
    const t = new Date(d);
    return t.toDateString() === new Date().toDateString() ? t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : t.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * Shared team inbox for WhatsApp (and Instagram) messages on the agency's own numbers (WA-02).
 * Everyone sees the chats of leads they can see; replies go out from the agency number.
 * Free text works within 24 hours of the client's last message; after that use an approved template.
 */
const WhatsappInbox = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [filter, setFilter] = useState("all");
    const [q, setQ] = useState("");
    const [list, setList] = useState<any[] | null>(null);
    const [numbers, setNumbers] = useState<any[]>([]);
    const [thread, setThread] = useState<any>(null);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const active = params.get("chat");
    const bottom = useRef<HTMLDivElement>(null);

    const loadList = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/conversations?channel=all&filter=${filter}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`);
        setList(success ? data.conversations : []);
    }, [filter, q]);
    useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); }, [loadList]);
    useEffect(() => { (async () => { const { success, data } = await commonGetAPICalls("/travel/whatsapp/numbers"); if (success) setNumbers(data || []); })(); }, []);

    const loadThread = useCallback(async () => {
        if (!active) { setThread(null); return; }
        const { success, data } = await commonGetAPICalls(`/crm/conversations/${active}`);
        if (success) { setThread(data); setTimeout(() => bottom.current?.scrollIntoView({ block: "end" }), 50); }
    }, [active]);
    useEffect(() => { loadThread(); }, [loadThread]);
    // new messages arrive through the webhook; refresh while a chat is open
    useEffect(() => { if (!active) return; const t = setInterval(() => { loadThread(); loadList(); }, 20000); return () => clearInterval(t); }, [active, loadThread, loadList]);

    const send = async () => {
        if (!text.trim() || !thread) return;
        const channel = thread.channels?.whatsapp?.possible ? "whatsapp" : "instagram";
        setSending(true);
        const { success } = await commonPostAPICall({ message: text.trim() }, `crm/leads/${active}/${channel}`);
        setSending(false);
        if (success) { setText(""); loadThread(); loadList(); }
    };

    const wa = thread?.channels?.whatsapp;
    const digits = String(thread?.lead?.phone_normalized || "").replace(/\D/g, "");

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-6xl">
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl font-semibold">WhatsApp inbox</h1>
                    <p className="text-sm text-default-500">{numbers.filter((n) => n.status === "active").length ? `Messages to ${numbers.filter((n) => n.status === "active").map((n) => n.name).join(", ")}` : "Connect your WhatsApp Business number in Lead sources to receive and reply here."}</p>
                </div>
                <Button size="sm" variant="flat" startContent={<Settings size={14} />} onPress={() => navigate("/crm/messages")}>Templates</Button>
                <Button size="sm" variant="flat" onPress={() => navigate("/crm/sources")}>Numbers</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 min-h-[60vh]">
                <Card shadow="sm" className={active ? "max-md:hidden" : ""}><CardBody className="gap-2 p-2">
                    <Tabs size="sm" selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))} aria-label="Filter"><Tab key="all" title="All" /><Tab key="unread" title="Unread" /><Tab key="mine" title="Mine" /></Tabs>
                    <Input aria-label="Search" size="sm" placeholder="Name, phone or message" startContent={<Search size={14} />} value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
                    {list === null ? <Spinner className="my-6" /> : !list.length ? <EmptyState compact icon={MessageCircle} title="No chats" text="WhatsApp messages from clients appear here." /> : (
                        <div className="flex flex-col overflow-y-auto max-h-[65vh]">
                            {list.map((c) => (
                                <button key={c.uuid} type="button" onClick={() => setParams({ chat: c.uuid })} className={`text-left px-2 py-2 rounded-lg ${active === c.uuid ? "bg-primary-50" : "hover:bg-default-50"}`}>
                                    <div className="flex items-center gap-2"><span className="font-medium text-sm truncate flex-1">{c.name}</span><span className="text-[11px] text-default-400">{time(c.last_at)}</span></div>
                                    <div className="flex items-center gap-2"><span className="text-xs text-default-500 truncate flex-1">{c.last_direction === "out" ? "You: " : ""}{c.last_message}</span>{c.unread > 0 && <Chip size="sm" color="success" className="h-5 min-w-5">{c.unread}</Chip>}</div>
                                    <div className="text-[11px] text-default-400 truncate">{c.assigned_name || "Unassigned"}{c.channel === "instagram" ? " · Instagram" : ""}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </CardBody></Card>
                <Card shadow="sm" className={!active ? "max-md:hidden" : ""}><CardBody className="p-0 flex flex-col">
                    {!thread ? <div className="flex-1 grid place-items-center text-sm text-default-500 p-6">Choose a chat</div> : (<>
                        <div className="flex items-center gap-2 p-3 border-b border-default-100">
                            <Button isIconOnly size="sm" variant="light" className="md:hidden" aria-label="Back" onPress={() => setParams({})}><ArrowLeft size={16} /></Button>
                            <div className="min-w-0 flex-1"><div className="font-semibold truncate">{thread.lead.name || "Unnamed"}</div><div className="text-xs text-default-500">{thread.lead.phone_normalized ? `+${thread.lead.phone_normalized}` : ""}{thread.lead.assigned_name ? ` · ${thread.lead.assigned_name}` : ""}</div></div>
                            <Button size="sm" variant="flat" startContent={<ExternalLink size={14} />} onPress={() => navigate(`/crm/leads/${thread.lead.uuid}`)}>Lead</Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 max-h-[55vh] bg-default-50">
                            {thread.messages.map((m: any) => (
                                <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.direction === "out" ? "self-end bg-success-100" : "self-start bg-content1 border border-default-200"}`}>
                                    {m.text}
                                    <div className="text-[10px] text-default-500 mt-1 text-right">{m.by ? `${m.by} · ` : ""}{time(m.at)}</div>
                                </div>
                            ))}
                            <div ref={bottom} />
                        </div>
                        <div className="p-3 border-t border-default-100 flex flex-col gap-2">
                            {wa && !wa.window_open && wa.possible && (
                                <div className="text-xs rounded-lg bg-warning-50 border border-warning-200 p-2">
                                    More than 24 hours since their last message: WhatsApp only delivers approved templates now. Use a template from a quote or booking, or <a className="underline" href={`https://wa.me/${digits}`} target="_blank" rel="noopener">open WhatsApp</a>.
                                </div>
                            )}
                            <div className="flex gap-2 items-end">
                                <Textarea aria-label="Reply" minRows={1} maxRows={5} placeholder="Type a reply" value={text} onValueChange={setText} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                                <Button color="success" isIconOnly aria-label="Send" isLoading={sending} isDisabled={!text.trim() || (wa?.possible && !wa?.window_open)} onPress={send}><Send size={16} /></Button>
                            </div>
                        </div>
                    </>)}
                </CardBody></Card>
            </div>
        </div>
    );
};

export default WhatsappInbox;
