import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, Spinner, Textarea } from "@nextui-org/react";
import { MessagesSquare, Send } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const clock = (v: string) => new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayLabel = (v: string) => {
    const d = new Date(v); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
    const listRef = useRef<HTMLDivElement>(null);
    const count = useRef(0);

    const scrollToBottom = useCallback(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, []);

    const load = useCallback(async () => {
        const { success, data, message } = await apiGet.current("/student/chat");
        if (!success) {
            setError(message || "Could not load chat");
            setData((prev: any) => prev || { messages: [], assignee: null });
            return;
        }
        setError("");
        setData(data);
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
        return () => clearInterval(t);
    }, [load]);

    useEffect(() => {
        if (data && (data.messages?.length || 0) !== count.current) {
            count.current = data.messages?.length || 0;
            // Keep scroll inside the message pane — scrollIntoView was jumping the whole page.
            requestAnimationFrame(scrollToBottom);
        }
    }, [data, scrollToBottom]);

    const send = async (e?: FormEvent) => {
        e?.preventDefault();
        const message = text.trim();
        if (!message || sending) return;
        setSending(true);
        const { success } = await apiPost.current({ message }, "student/chat/send", false);
        setSending(false);
        if (success) { setText(""); await load(); }
    };

    if (!data) {
        return (
            <div className="flex justify-center py-20">
                <Spinner label="Loading chat…" />
            </div>
        );
    }

    const messages = data.messages || [];
    const assignee = data.assignee;
    let lastDay = "";

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-3xl mx-auto w-full">
            <div>
                <h1 className="text-xl font-semibold flex items-center gap-2"><MessagesSquare size={22} /> Chat with counsellor</h1>
                <p className="text-sm text-default-500">
                    {assignee?.name ? `Messaging ${assignee.name}` : "Your agency team will reply here"}
                </p>
            </div>

            {error && <div className="rounded-lg bg-warning-50 text-warning-800 text-sm px-3 py-2">{error}</div>}

            <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden flex flex-col" style={{ height: "min(70vh, 640px)" }}>
                <div className="flex items-center gap-2 border-b border-default-100 px-3 py-2">
                    <Avatar size="sm" name={assignee?.name || "Agency"} />
                    <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{assignee?.name || "Agency counsellor"}</div>
                        <div className="text-[11px] text-default-500">In-app chat · replies appear here</div>
                    </div>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 bg-default-50">
                    {!messages.length && (
                        <div className="m-auto text-center text-sm text-default-500 px-4">
                            Say hello — your counsellor will see your message in their Chats.
                        </div>
                    )}
                    {messages.map((m: any) => {
                        const day = dayLabel(m.at);
                        const sep = day !== lastDay; lastDay = day;
                        const mine = m.direction === "out";
                        return (
                            <div key={m.id} className="flex flex-col">
                                {sep && <div className="self-center text-[11px] text-default-500 bg-content1 rounded-full px-2.5 py-0.5 my-2 shadow-sm">{day}</div>}
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${mine ? "self-end bg-primary text-primary-foreground rounded-br-md" : "self-start bg-content1 rounded-bl-md"}`}>
                                    {m.text}
                                    <div className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/75 text-right" : "text-default-400"}`}>
                                        {!mine && m.by ? `${m.by} · ` : ""}{clock(m.at)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <form
                    className="border-t border-default-100 p-2 flex items-end gap-2 bg-content1"
                    onSubmit={send}
                >
                    <Textarea
                        aria-label="Message"
                        minRows={1}
                        maxRows={4}
                        placeholder="Type a message…"
                        value={text}
                        onValueChange={setText}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !(e as any).isComposing && e.keyCode !== 229) {
                                e.preventDefault();
                                e.stopPropagation();
                                (e.currentTarget.closest("form") as HTMLFormElement | null)?.requestSubmit();
                            }
                        }}
                    />
                    <Button type="submit" isIconOnly color="primary" aria-label="Send" isLoading={sending} isDisabled={!text.trim()}>
                        <Send size={16} />
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default StudentChat;
