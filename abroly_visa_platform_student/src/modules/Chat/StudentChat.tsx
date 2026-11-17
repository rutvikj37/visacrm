import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, Button, Spinner, Textarea } from "@nextui-org/react";
import { MessagesSquare, RefreshCw, Send } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const clock = (v: string) => new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayLabel = (v: string) => {
    const d = new Date(v); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

/** Student portal chat with their assigned agency counsellor. */
const StudentChat = () => {
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
    const boxRef = useRef<HTMLDivElement>(null);
    const count = useRef(0);
    const [height, setHeight] = useState(520);

    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, []);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        const { success, data, message } = await apiGet.current("/student/chat");
        if (!success) {
            setError(message || "Could not load chat");
            setData((prev: any) => prev || { messages: [], assignee: null });
            setLoading(false);
            return;
        }
        setError("");
        setData(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(() => { if (!document.hidden) load({ silent: true }); }, 10000);
        return () => clearInterval(t);
    }, [load]);

    useEffect(() => {
        if (data && (data.messages?.length || 0) !== count.current) {
            count.current = data.messages?.length || 0;
            // Keep scroll inside the message pane — scrollIntoView was jumping the whole page.
            requestAnimationFrame(scrollToBottom);
        }
    }, [data, scrollToBottom]);

    useLayoutEffect(() => {
        const fit = () => {
            const el = boxRef.current; if (!el) return;
            const bottomPad = window.innerWidth < 768 ? 72 : 16;
            setHeight(Math.max(380, Math.min(720, window.innerHeight - el.getBoundingClientRect().top - bottomPad)));
        };
        fit();
        window.addEventListener("resize", fit);
        return () => { window.removeEventListener("resize", fit); };
    }, [loading, data]);

    const send = async (e?: FormEvent) => {
        e?.preventDefault();
        const message = text.trim();
        if (!message || sending) return;
        setSending(true);
        const { success, message: err } = await apiPost.current({ message }, "student/chat/send", false);
        setSending(false);
        if (success) { setText(""); setError(""); await load({ silent: true }); }
        else setError(err || "Message failed to send");
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-3xl mx-auto w-full">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2"><MessagesSquare size={22} className="text-primary" /> Chat with counsellor</h1>
                    <p className="text-sm text-default-500">Loading your conversation…</p>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center py-24 shadow-sm">
                    <Spinner label="Loading chat…" />
                </div>
            </div>
        );
    }

    const messages = data?.messages || [];
    const assignee = data?.assignee;
    let lastDay = "";
    let lastDir = "";

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-3xl mx-auto w-full">
            <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                    <MessagesSquare size={22} className="text-primary" /> Chat with counsellor
                </h1>
                <p className="text-sm text-default-500">
                    {assignee?.name ? `Messaging ${assignee.name}` : "Your agency team will reply here"}
                </p>
            </div>

            <div
                ref={boxRef}
                style={{ height }}
                className="rounded-xl border border-default-200 bg-content1 overflow-hidden flex flex-col shadow-sm min-h-0"
            >
                <div className="flex items-center gap-2.5 border-b border-default-200 px-3 py-2.5 bg-content1 shrink-0">
                    <Avatar size="sm" name={assignee?.name || "Agency"} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate leading-tight">{assignee?.name || "Agency counsellor"}</div>
                        <div className="text-[11px] text-default-500 mt-0.5">In-app chat · replies appear here</div>
                    </div>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col bg-[#f4f6f9] min-h-0">
                    {error && messages.length > 0 && (
                        <div className="self-center mb-2 rounded-lg bg-warning-50 text-warning-800 text-xs px-3 py-1.5 flex items-center gap-2 max-w-full">
                            <span className="min-w-0">{error}</span>
                            <button
                                type="button"
                                className="underline shrink-0 inline-flex items-center gap-1"
                                onClick={() => { setError(""); load({ silent: true }); }}
                            >
                                <RefreshCw size={11} /> Retry
                            </button>
                        </div>
                    )}

                    {!messages.length && !error && (
                        <div className="m-auto text-center px-5 py-8 max-w-sm">
                            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-primary-50 text-primary grid place-items-center">
                                <MessagesSquare size={22} strokeWidth={1.8} />
                            </div>
                            <div className="font-medium text-sm text-default-700">Say hello</div>
                            <div className="text-xs text-default-500 mt-1 leading-relaxed">
                                Your counsellor will see your message in their Chats. Ask about documents, appointments, or next steps.
                            </div>
                        </div>
                    )}

                    {!messages.length && error && (
                        <div className="m-auto text-center px-5 py-8 max-w-sm flex flex-col items-center gap-3">
                            <MessagesSquare size={28} className="text-default-300" />
                            <div className="text-sm text-default-600">{error}</div>
                            <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} onPress={() => load()}>
                                Try again
                            </Button>
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
                                    className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm ${
                                        mine
                                            ? `self-end bg-primary text-primary-foreground ${nextSame ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                                            : `self-start bg-content1 text-foreground border border-default-100 ${nextSame ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"}`
                                    }`}
                                >
                                    {m.text}
                                    <div className={`mt-1 text-[10px] leading-none flex items-center gap-1 ${mine ? "text-primary-foreground/70 justify-end" : "text-default-400"}`}>
                                        {!mine && m.by ? <span className="truncate max-w-[9rem]">{m.by}</span> : null}
                                        {!mine && m.by ? <span>·</span> : null}
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
                            aria-label="Message"
                            minRows={1}
                            maxRows={4}
                            placeholder="Type a message…"
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
        </div>
    );
};

export default StudentChat;
