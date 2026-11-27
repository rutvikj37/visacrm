import { Avatar } from "@heroui/react";
import { Bot, GraduationCap } from "lucide-react";

export type HistoryEntry = { id: number; entity: string; entity_id?: number | null; action: string; summary: string; actor_type: string; actor_name?: string | null; at: string };

const when = (v: string) => {
    const d = new Date(v);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

const Who = ({ e }: { e: HistoryEntry }) => {
    if (e.actor_type === "system") return <div className="h-7 w-7 rounded-full bg-default-100 text-default-500 grid place-items-center shrink-0"><Bot size={14} /></div>;
    if (e.actor_type === "student") return <div className="h-7 w-7 rounded-full bg-secondary-50 text-secondary grid place-items-center shrink-0"><GraduationCap size={14} /></div>;
    return <Avatar size="sm" name={e.actor_name || "?"} className="h-7 w-7 text-[11px] shrink-0" />;
};

/** Timeline of "who did what, when". */
const HistoryList = ({ entries, empty = "Nothing recorded yet.", extra }: { entries: HistoryEntry[]; empty?: string; extra?: (e: HistoryEntry) => any }) => {
    if (!entries.length) return <div className="text-sm text-default-500 py-3">{empty}</div>;
    return (
        <ol className="relative flex flex-col">
            {entries.map((e, i) => (
                <li key={e.id} className="flex gap-3 pb-3 relative">
                    {i < entries.length - 1 && <span className="absolute left-3.5 top-8 bottom-0 w-px bg-default-200" aria-hidden />}
                    <Who e={e} />
                    <div className="min-w-0 flex-1 text-sm">
                        <div className="text-default-800 break-words">{e.summary}</div>
                        <div className="text-xs text-default-500">{e.actor_name || "System"}{e.actor_type === "student" ? " (student)" : ""} · {when(e.at)}{extra ? extra(e) : null}</div>
                    </div>
                </li>
            ))}
        </ol>
    );
};

export default HistoryList;
