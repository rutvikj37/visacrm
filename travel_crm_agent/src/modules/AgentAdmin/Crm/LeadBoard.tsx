import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { CalendarClock, User } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { LEAD_STATUSES, followUpState, formatDateTime, formatPhone, sourceLabel, temperatureMeta } from "./crmShared";

/** Travel leads: destination and trip value instead of country / course. */
const travelLine = (lead: any) => {
    if (lead.business_line !== "travel") return null;
    let dest: any = lead.destinations;
    if (typeof dest === "string") { try { dest = JSON.parse(dest); } catch { dest = [dest]; } }
    const parts = [Array.isArray(dest) ? dest.join(", ") : "", lead.trip_value != null ? `₹${Number(lead.trip_value).toLocaleString("en-IN")}` : ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
};

const BOARD_STATUSES = LEAD_STATUSES.filter((s) => !["converted", "junk"].includes(s.key));

/** Lead pipeline as columns. Drag a card to change its status (Lost asks for a reason). */
const LeadBoard = ({ query, refreshKey, onChanged }: { query: string; refreshKey: number; onChanged: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dragUuid, setDragUuid] = useState<string | null>(null);
    const [overCol, setOverCol] = useState<string | null>(null);

    const load = useCallback(async () => {
        const q = new URLSearchParams(query);
        q.delete("page");
        q.delete("status");
        q.set("limit", "300");
        q.set("board", "1");
        q.set("sort", "score");
        const { success, data } = await commonGetAPICalls(`/crm/leads?${q.toString()}`);
        if (success) setLeads(data?.leads || []);
        setLoading(false);
    }, [query]);
    useEffect(() => { load(); }, [load, refreshKey]);

    const drop = async (status: string) => {
        const lead = leads.find((l) => l.uuid === dragUuid);
        setDragUuid(null);
        setOverCol(null);
        if (!lead || lead.status === status) return;
        const body: any = { status };
        if (status === "lost") {
            const reason = window.prompt("Why was this lead lost?");
            if (!reason || !reason.trim()) return;
            body.lost_reason = reason.trim();
        }
        setLeads((list) => list.map((l) => (l.uuid === lead.uuid ? { ...l, status } : l)));
        const { success } = await commonPostAPICall(body, `crm/leads/${lead.uuid}/status`, true);
        if (!success) load(); else onChanged();
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
            {BOARD_STATUSES.map((col) => {
                const items = leads.filter((l) => l.status === col.key);
                return (
                    <div
                        key={col.key}
                        onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                        onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                        onDrop={(e) => { e.preventDefault(); drop(col.key); }}
                        className={`snap-start shrink-0 w-[260px] rounded-xl p-2 flex flex-col gap-2 transition-colors ${overCol === col.key ? "bg-primary-50 ring-2 ring-primary" : "bg-default-100/70"}`}
                    >
                        <div className="flex items-center justify-between px-1 py-1">
                            <Chip size="sm" variant="flat" color={col.color}>{col.label}</Chip>
                            <span className="text-xs text-default-500">{items.length}</span>
                        </div>
                        {items.length === 0 && <div className="text-xs text-default-400 px-1 py-4 text-center">No leads</div>}
                        {items.map((lead) => {
                            const temp = temperatureMeta(lead.score);
                            const fu = followUpState(lead.next_follow_up_at);
                            return (
                                <Card
                                    key={lead.uuid}
                                    shadow="sm"
                                    isPressable
                                    onPress={() => navigate(`/crm/leads/${lead.uuid}`)}
                                    draggable
                                    onDragStart={(e: any) => { setDragUuid(lead.uuid); e.dataTransfer?.setData("text/plain", lead.uuid); }}
                                    onDragEnd={() => { setDragUuid(null); setOverCol(null); }}
                                    className={`w-full ${dragUuid === lead.uuid ? "opacity-50" : ""}`}
                                >
                                    <CardBody className="p-3 gap-1.5">
                                        <div className="flex items-start gap-2">
                                            <span className="font-medium text-sm flex-1 min-w-0 truncate">{lead.name || "Unnamed"}</span>
                                            <Chip size="sm" variant="flat" color={temp.color}>{temp.label}</Chip>
                                        </div>
                                        <div className="text-xs text-default-500 truncate">{formatPhone(lead) || lead.email}</div>
                                        {travelLine(lead) ? <div className="text-xs truncate font-medium text-foreground">✈ {travelLine(lead)}</div> : (lead.interested_country || lead.interested_course) && (
                                            <div className="text-xs truncate">{[lead.interested_country, lead.interested_course].filter(Boolean).join(" · ")}</div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-default-500">
                                            <Chip size="sm" variant="flat">{sourceLabel(lead.source)}</Chip>
                                            <span className="flex items-center gap-1"><User size={11} />{lead.assignee?.username || "Unassigned"}</span>
                                        </div>
                                        {lead.next_follow_up_at && (
                                            <div className={`text-[11px] flex items-center gap-1 ${fu === "overdue" ? "text-danger font-medium" : fu === "today" ? "text-warning-600 font-medium" : "text-default-500"}`}>
                                                <CalendarClock size={11} />{formatDateTime(lead.next_follow_up_at)}
                                            </div>
                                        )}
                                    </CardBody>
                                </Card>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

export default LeadBoard;
