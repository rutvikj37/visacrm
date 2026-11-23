import { useNavigate } from "react-router-dom";
import { Button, Checkbox, Chip, Spinner } from "@heroui/react";
import { CalendarClock, MessageCircle, Phone } from "lucide-react";
import { followUpState, formatDateTime, formatPhone, sourceLabel, statusMeta, temperatureMeta, timeAgo, whatsappLink } from "./crmShared";

/** Travel leads: destination and trip value instead of country / course. */
const travelLine = (lead: any) => {
    if (lead.business_line !== "travel") return null;
    let dest: any = lead.destinations;
    if (typeof dest === "string") { try { dest = JSON.parse(dest); } catch { dest = [dest]; } }
    const parts = [Array.isArray(dest) ? dest.join(", ") : "", lead.trip_value != null ? `₹${Number(lead.trip_value).toLocaleString("en-IN")}` : ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
};

/**
 * Lead Inbox on phones: one card per lead with the actions a counsellor needs on the go
 * (call, WhatsApp, open). Tick boxes feed the same bulk actions as the table.
 */
const LeadCards = ({ leads, loading, selectable, selected, onToggle, branchLabel }: {
    leads: any[]; loading: boolean; selectable: boolean; selected: Set<string>; onToggle: (uuid: string) => void; branchLabel: (id?: number | null) => string | null;
}) => {
    const navigate = useNavigate();
    if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
    if (!leads.length) return <div className="text-center text-sm text-default-500 py-10 px-4">No leads here yet. Add one, import a file, or connect a lead source.</div>;
    return (
        <div className="flex flex-col gap-2">
            {leads.map((lead) => {
                const meta = statusMeta(lead.status);
                const temp = temperatureMeta(lead.score);
                const fu = followUpState(lead.next_follow_up_at);
                const wa = whatsappLink(lead);
                const tel = lead.phone_normalized ? `tel:+${String(lead.phone_normalized).replace(/\D/g, "")}` : null;
                const canSelect = selectable && lead.status !== "converted";
                return (
                    <div key={lead.uuid} className={`rounded-xl border bg-content1 p-3 flex flex-col gap-2 ${selected.has(lead.uuid) ? "border-primary bg-primary-50" : "border-default-200"}`}>
                        <div className="flex items-start gap-2">
                            {canSelect && <Checkbox aria-label="Select lead" size="sm" className="mt-0.5" isSelected={selected.has(lead.uuid)} onValueChange={() => onToggle(lead.uuid)} />}
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/crm/leads/${lead.uuid}`)}>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-semibold truncate">{lead.name || "Unnamed"}</span>
                                    {temp.key !== "cold" && <Chip size="sm" variant="flat" color={temp.color}>{temp.label}</Chip>}
                                    {lead.enquiry_count > 1 && <Chip size="sm" variant="flat" color="warning">x{lead.enquiry_count}</Chip>}
                                </div>
                                <div className="text-xs text-default-500 truncate">{formatPhone(lead) || lead.email || "No phone"}</div>
                            </button>
                            <Chip size="sm" color={meta.color} variant="flat" className="shrink-0">{meta.label}</Chip>
                        </div>
                        <button type="button" className="text-left text-xs text-default-600 flex flex-wrap gap-x-3 gap-y-0.5" onClick={() => navigate(`/crm/leads/${lead.uuid}`)}>
                            {travelLine(lead) ? <span className="font-medium text-foreground">✈ {travelLine(lead)}</span> : (lead.interested_country || lead.interested_course) && <span>{[lead.interested_country, lead.interested_course].filter(Boolean).join(" · ")}</span>}
                            <span>{sourceLabel(lead.source)}</span>
                            <span>{lead.assignee?.username || "Unassigned"}{branchLabel(lead.branch_id) ? ` · ${branchLabel(lead.branch_id)}` : ""}</span>
                            <span className="text-default-400">{timeAgo(lead.last_activity_at || lead.createdAt)}</span>
                        </button>
                        {lead.next_follow_up_at && (
                            <div className={`text-xs flex items-center gap-1 ${fu === "overdue" ? "text-danger font-medium" : fu === "today" ? "text-warning-600 font-medium" : "text-default-600"}`}>
                                <CalendarClock size={13} />{fu === "overdue" ? "Overdue: " : "Follow-up: "}{formatDateTime(lead.next_follow_up_at)}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button as="a" href={tel || undefined} isDisabled={!tel} size="sm" variant="flat" className="flex-1" startContent={<Phone size={14} />}
                                onPress={() => setTimeout(() => navigate(`/crm/leads/${lead.uuid}?called=1`), 700)}>Call</Button>
                            <Button as="a" href={wa || undefined} target="_blank" rel="noopener" isDisabled={!wa} size="sm" variant="flat" color="success" className="flex-1" startContent={<MessageCircle size={14} />}>WhatsApp</Button>
                            <Button size="sm" variant="light" className="flex-1" onPress={() => navigate(`/crm/leads/${lead.uuid}`)}>Open</Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default LeadCards;
