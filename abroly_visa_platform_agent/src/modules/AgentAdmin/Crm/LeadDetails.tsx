import { undoToast } from "@/components/ui-kit/undoToast";
import { LineSkeleton, ListSkeleton } from "@/components/ui-kit/Skeletons";
import { BranchMoveSelect } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter,
    ModalHeader, Select, SelectItem, Tab, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import { ArrowLeft, ArrowRightCircle, BadgeCheck, CalendarClock, Check, CheckCircle2, Circle, ClipboardList, Mail, MessageCircle, Pencil, Phone, Send, StickyNote, Trash2, User, Instagram, X, ChevronUp, ChevronDown } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import CommonConfirmation from "@/components/CommonConfirmation";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import LeadFormModal from "./LeadFormModal";
import ConvertLeadModal from "./ConvertLeadModal";
import useModules from "@/hooks/useModules";
import PortalInvitePanel from "./PortalInvitePanel";
import SendFormModal from "./SendFormModal";
import FormField from "./FormField";
import MentionComposer, { MentionText } from "./MentionComposer";
import {
    activityLabel, STATUS_MENU_STATUSES, asArray, asObject, buildFollowUpSteps, followUpState, formatDateTime, formatPhone,
    sourceLabel, statusMeta, timeAgo, toLocalInputValue, whatsappLink,
} from "./crmShared";

const Field = ({ label, value }: { label: string; value?: any }) => (
    <div className="min-w-0">
        <div className="text-xs text-default-500">{label}</div>
        <div className="text-sm break-words">{value || <span className="text-default-400">-</span>}</div>
    </div>
);

const ACTIVITY_TYPES = [
    { key: "note", label: "Note", icon: StickyNote },
    { key: "call", label: "Call", icon: Phone },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { key: "email", label: "Email", icon: Mail },
];

interface LeadDetailsProps {
    /** open this lead instead of the one in the URL (side panel) */
    leadUuid?: string;
    /** shown inside the Lead Inbox side panel: one column, close / previous / next instead of Back */
    embedded?: boolean;
    onClose?: () => void;
    onChanged?: () => void;
    onPrev?: (() => void) | null;
    onNext?: (() => void) | null;
}

const CALL_OUTCOMES = [
    { key: "interested", label: "Interested", color: "success" as const },
    { key: "callback", label: "Call back later", color: "primary" as const },
    { key: "no_answer", label: "No answer", color: "default" as const },
    { key: "not_interested", label: "Not interested", color: "danger" as const },
];

const LeadDetails = ({ leadUuid, embedded = false, onClose, onChanged, onPrev, onNext }: LeadDetailsProps = {}) => {
    const params = useParams();
    const uuid = leadUuid || params.uuid;
    const navigate = useNavigate();
    const { has: hasModule, travel: travelOn } = useModules();
    const [searchParams, setSearchParams] = useSearchParams();
    const [callPrompt, setCallPrompt] = useState(false);
    const [quickReplies, setQuickReplies] = useState<any[]>([]);
    const agencyName = useSelector((state: any) => state.login.agency?.name);
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const isManager = isOwner || teamRole === "branch_manager";

    const [lead, setLead] = useState<any>(null);
    const [travelInfo, setTravelInfo] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [whatsappEnabled, setWhatsappEnabled] = useState(false);
    const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [activityType, setActivityType] = useState("note");
    const [activityText, setActivityText] = useState("");
    const [mentionIds, setMentionIds] = useState<number[]>([]);
    const [savingActivity, setSavingActivity] = useState(false);

    const [followUpAt, setFollowUpAt] = useState("");
    const [followUpNote, setFollowUpNote] = useState("");
    const [savingFollowUp, setSavingFollowUp] = useState(false);

    const [lostReason, setLostReason] = useState("");
    const editModal = useDisclosure();
    const lostModal = useDisclosure();
    const deleteConfirm = useDisclosure();
    const convertModal = useDisclosure();
    const inviteModal = useDisclosure();
    const sendFormModal = useDisclosure();
    const [invite, setInvite] = useState<any>(null);

    const openInvite = async () => {
        const { success, data } = await commonGetAPICalls(`/crm/leads/${uuid}/invite`);
        if (success) {
            setInvite(data);
            inviteModal.onOpen();
        }
    };

    const load = useCallback(async (changed = false) => {
        const { success, data } = await commonGetAPICalls(`/crm/leads/${uuid}`);
        if (changed) onChanged?.();
        if (success) {
            setLead(data.lead);
            setTravelInfo(data.travel || null);
            setActivities(data.activities || []);
            setFiles(data.files || []);
            setWhatsappEnabled(Boolean(data.whatsapp_enabled));
            setNotFound(false);
        } else {
            setNotFound(true);
        }
        setLoading(false);
    }, [uuid]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load]);
    useEffect(() => {
        (async () => {
            const [teamRes, tplRes] = await Promise.all([commonGetAPICalls("/crm/team"), commonGetAPICalls("/crm/messages/templates")]);
            if (teamRes.success) setTeam(teamRes.data || []);
            if (tplRes.success) setQuickReplies((tplRes.data?.templates || []).filter((t: any) => t.trigger === "manual" && t.body));
        })();
    }, []);
    useEffect(() => {
        if (searchParams.get("called") === "1") {
            setCallPrompt(true);
            const next = new URLSearchParams(searchParams); next.delete("called"); setSearchParams(next, { replace: true });
        } else setCallPrompt(false);
    }, [uuid]);

    useEffect(() => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        tomorrow.setHours(11, 0, 0, 0);
        setFollowUpAt(toLocalInputValue(tomorrow));
    }, [uuid]);

    const changeStatus = async (status: string, extra: Record<string, any> = {}) => {
        if (!status || status === lead?.status) return;
        if (status === "converted") {
            convertModal.onOpen();
            return;
        }
        if (status === "lost" && !extra.lost_reason) {
            setLostReason("");
            lostModal.onOpen();
            return;
        }
        const { success } = await commonPostAPICall({ status, ...extra }, `crm/leads/${uuid}/status`, true);
        if (success) load(true);
    };

    const assign = async (agentId: string) => {
        const value = agentId === "none" ? null : Number(agentId);
        if ((lead?.assigned_to || null) === value) return;
        const { success } = await commonPostAPICall({ agent_id: value }, `crm/leads/${uuid}/assign`, true);
        if (success) load(true);
    };

    const moveBranch = async (branchId: number | null) => {
        const { success } = await commonPostAPICall({ branch_id: branchId }, `crm/leads/${uuid}/branch`, true);
        if (success) load(true);
    };

    const logCall = async (outcome: string) => {
        setCallPrompt(false);
        if (outcome === "not_interested") {
            await commonPostAPICall({ type: "call", message: "Call: not interested" }, `crm/leads/${uuid}/activity`);
            setLostReason("Not interested");
            lostModal.onOpen();
            return;
        }
        const text: Record<string, string> = { interested: "Call: interested", callback: "Call: asked to call back", no_answer: "Call: no answer" };
        await commonPostAPICall({ type: "call", message: text[outcome] }, `crm/leads/${uuid}/activity`);
        if (outcome === "interested" && ["new", "contacted", "follow_up"].includes(lead?.status)) {
            await commonPostAPICall({ status: "interested" }, `crm/leads/${uuid}/status`);
        }
        if (outcome === "callback" || outcome === "no_answer") {
            const when = new Date();
            if (outcome === "no_answer" && when.getHours() < 18) when.setHours(when.getHours() + 3, 0, 0, 0);
            else { when.setDate(when.getDate() + 1); when.setHours(11, 0, 0, 0); }
            await commonPostAPICall({ date: when.toISOString(), note: outcome === "callback" ? "Call back" : "Try calling again" }, `crm/leads/${uuid}/follow_up`);
        }
        SuccessToast(outcome === "interested" ? "Marked interested" : outcome === "callback" ? "Follow-up set for tomorrow 11:00" : "Call logged - reminder set to try again");
        load(true);
    };

    const fillQuickReply = (t: any) => {
        const first = String(lead?.name || "").trim().split(" ")[0] || "there";
        const agency = agencyName || "";
        const text = String(t.body).replace(/\{\{\s*name\s*\}\}/gi, first).replace(/\{\{\s*country\s*\}\}/gi, lead?.interested_country || "").replace(/\{\{\s*agency\s*\}\}/gi, agency).replace(/\{\{[^}]+\}\}/g, "").trim();
        setActivityType("whatsapp");
        setActivityText(text);
    };

    const addActivity = async () => {
        if (!activityText.trim()) {
            ErrorToast("Please write something first");
            return;
        }
        setSavingActivity(true);
        const body: Record<string, any> = { type: activityType, message: activityText.trim() };
        if (activityType === "note" && mentionIds.length) body.mention_ids = mentionIds;
        const { success } = await commonPostAPICall(body, `crm/leads/${uuid}/activity`);
        setSavingActivity(false);
        if (success) {
            setActivityText("");
            setMentionIds([]);
            load(true);
        }
    };

    const [sendingInstagram, setSendingInstagram] = useState(false);
    const sendInstagram = async () => {
        if (!activityText.trim()) {
            ErrorToast("Please write a message first");
            return;
        }
        setSendingInstagram(true);
        const { success } = await commonPostAPICall({ message: activityText.trim() }, `crm/leads/${uuid}/instagram`, true);
        setSendingInstagram(false);
        if (success) {
            setActivityText("");
            load(true);
        }
    };

    const sendWhatsapp = async () => {
        if (!activityText.trim()) {
            ErrorToast("Please write a message first");
            return;
        }
        setSendingWhatsapp(true);
        const { success } = await commonPostAPICall({ message: activityText.trim() }, `crm/leads/${uuid}/whatsapp`, true);
        setSendingWhatsapp(false);
        if (success) {
            setActivityText("");
            load(true);
        }
    };

    const scheduleFollowUp = async () => {
        const when = new Date(followUpAt);
        if (!followUpAt || isNaN(when.getTime())) {
            ErrorToast("Please pick a date and time");
            return;
        }
        setSavingFollowUp(true);
        const { success } = await commonPostAPICall({ date: when.toISOString(), note: followUpNote }, `crm/leads/${uuid}/follow_up`, true);
        setSavingFollowUp(false);
        if (success) {
            setFollowUpNote("");
            load(true);
        }
    };

    const followUpDone = async () => {
        const { success } = await commonPostAPICall({ done: true }, `crm/leads/${uuid}/follow_up`, true);
        if (success) load(true);
    };

    const deleteLead = async () => {
        deleteConfirm.onClose();
        const deleted = uuid;
        const { success } = await commonPostAPICall({}, `crm/leads/${uuid}/delete`);
        if (success) {
            onChanged?.();
            if (embedded) onClose?.(); else navigate("/crm/leads");
            undoToast("Lead deleted", async () => {
                const r = await commonPostAPICall({ uuids: [deleted] }, "crm/leads/restore", true);
                if (r.success) { onChanged?.(); if (!embedded) navigate(`/crm/leads/${deleted}`); }
            });
        }
    };

    if (loading) return (
        <div className="flex flex-col gap-4 p-2" aria-busy="true">
            <div className="flex flex-col gap-2"><LineSkeleton w="w-56" h="h-7" /><LineSkeleton w="w-40" /></div>
            <div className="rounded-xl border border-default-200 p-4"><ListSkeleton rows={4} /></div>
        </div>
    );
    if (notFound || !lead) {
        return (
            <div className="p-6 text-center flex flex-col items-center gap-3">
                <p>This lead was not found, or it is not assigned to you.</p>
                <Button onPress={() => navigate("/crm/leads")}>Back to Lead Inbox</Button>
            </div>
        );
    }

    const meta = statusMeta(lead.status);
    const phone = formatPhone(lead);
    const wa = whatsappLink(lead);
    const tags = asArray(lead.tags);
    const extra = asObject(lead.extra);
    const fu = followUpState(lead.next_follow_up_at);
    const closed = ["converted", "lost", "junk"].includes(lead.status);
    const followUpSteps = buildFollowUpSteps(activities, lead);
    const activeFollowUp = followUpSteps.find((s) => s.status === "active");
    const nextFollowUpN = activeFollowUp ? activeFollowUp.n : followUpSteps.length + 1;
    const scheduleLabel = lead.next_follow_up_at
        ? `Reschedule Follow-up ${activeFollowUp?.n || nextFollowUpN}`
        : followUpSteps.length > 0
            ? `Schedule Follow-up ${nextFollowUpN}`
            : "Follow up on";
    const scheduleBtn = lead.next_follow_up_at ? "Reschedule" : followUpSteps.length > 0 ? "Schedule next" : "Schedule";

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            {/* sticky identity + actions */}
            <div className="sticky top-0 z-10 -mx-1 sm:-mx-2 px-1 sm:px-2 py-2 bg-content1/95 backdrop-blur-sm border-b border-default-100">
                <div className="flex flex-wrap items-start gap-3">
                    {embedded ? (
                        <div className="flex items-center gap-1">
                            <Button isIconOnly size="sm" variant="light" onPress={onClose} aria-label="Close"><X size={18} /></Button>
                            <Button isIconOnly size="sm" variant="flat" isDisabled={!onPrev} onPress={() => onPrev?.()} aria-label="Previous lead"><ChevronUp size={16} /></Button>
                            <Button isIconOnly size="sm" variant="flat" isDisabled={!onNext} onPress={() => onNext?.()} aria-label="Next lead"><ChevronDown size={16} /></Button>
                        </div>
                    ) : (
                        <Button isIconOnly variant="light" onPress={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></Button>
                    )}
                    <div className="flex-1 min-w-0">
                        <h1 className={`${embedded ? "text-xl" : "text-2xl"} font-semibold break-words`}>{lead.name || "Unnamed lead"}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Chip color={meta.color} variant="flat" size="sm">{meta.label}</Chip>
                            <Chip variant="flat" size="sm">via {sourceLabel(lead.source)}</Chip>
                            {lead.enquiry_count > 1 && <Chip variant="flat" color="warning" size="sm">Enquired {lead.enquiry_count} times</Chip>}
                            <span className="text-xs text-default-500">Added {formatDateTime(lead.createdAt)}</span>
                        </div>
                    </div>
                    <div className={`flex flex-wrap gap-2 ${embedded ? "w-full sm:w-auto" : ""}`}>
                        {phone && <Button size="sm" as="a" href={`tel:${phone.replace(/\s/g, "")}`} onPress={() => setTimeout(() => setCallPrompt(true), 600)} variant="flat" startContent={<Phone size={16} />}>Call</Button>}
                        {wa && <Button size="sm" as="a" href={wa} target="_blank" rel="noreferrer" variant="flat" color="success" startContent={<MessageCircle size={16} />}>WhatsApp</Button>}
                        {lead.email && <Button size="sm" as="a" href={`mailto:${lead.email}`} variant="flat" startContent={<Mail size={16} />}>Email</Button>}
                        <Button size="sm" variant="flat" startContent={<Pencil size={16} />} onPress={editModal.onOpen}>Edit</Button>
                        <Button size="sm" variant="flat" startContent={<ClipboardList size={16} />} onPress={sendFormModal.onOpen}>Send form</Button>
                        {lead.status !== "converted" && hasModule("visa") && lead.business_line !== "travel" && (
                            <Button size="sm" color="primary" startContent={<ArrowRightCircle size={16} />} onPress={convertModal.onOpen}>Convert</Button>
                        )}
                        {isOwner && lead.status !== "converted" && (
                            <Button size="sm" isIconOnly variant="flat" color="danger" onPress={deleteLead} aria-label="Delete lead"><Trash2 size={16} /></Button>
                        )}
                    </div>
                </div>
            </div>

            {callPrompt && (
                <div className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="font-medium text-sm flex items-center gap-2"><Phone size={16} />How did the call go?</span>
                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                        {CALL_OUTCOMES.map((o) => <Button key={o.key} size="sm" variant="flat" color={o.color} onPress={() => logCall(o.key)}>{o.label}</Button>)}
                        <Button size="sm" variant="light" onPress={() => setCallPrompt(false)}>Skip</Button>
                    </div>
                </div>
            )}

            {lead.status === "converted" && lead.converted_booking_id && (
                <div className="rounded-xl border border-success-200 bg-success-50 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <BadgeCheck className="text-success shrink-0" size={24} />
                    <div className="flex-1 min-w-0">
                        <div className="font-medium">Booked</div>
                        <div className="text-sm text-default-600">on {formatDateTime(lead.converted_at)} — continue under Travel → Bookings.</div>
                    </div>
                    <Button size="sm" color="success" onPress={() => navigate(travelInfo?.booking_id ? `/travel/bookings/${travelInfo.booking_id}` : "/travel/bookings")}>Open booking</Button>
                </div>
            )}

            {lead.status === "converted" && !lead.converted_booking_id && (
                <div className="rounded-xl border border-success-200 bg-success-50 px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <BadgeCheck className="text-success shrink-0" size={24} />
                    <div className="flex-1 min-w-0">
                        <div className="font-medium">Converted to a visa case</div>
                        <div className="text-sm text-default-600">on {formatDateTime(lead.converted_at)} — continue under Visa Processing.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="flat" startContent={<Send size={16} />} onPress={openInvite}>Portal invite</Button>
                        {lead.converted_case_id && (
                            <Button size="sm" color="success" onPress={() => navigate(`/leads/progress/${lead.converted_case_id}`)}>Open visa case</Button>
                        )}
                    </div>
                </div>
            )}

            <div className={`grid grid-cols-1 ${embedded ? "" : "lg:grid-cols-5"} gap-4`}>
                {/* details — flat sections, no nested cards */}
                <div className={`flex flex-col gap-4 ${embedded ? "order-2" : "lg:col-span-2"}`}>
                    <section className="rounded-xl border border-default-200 px-4 py-3 flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-default-700">Pipeline</h2>
                        <FormField label="Status"><Select
                            aria-label="Status"
                            selectedKeys={[lead.status]}
                            isDisabled={lead.status === "converted"}
                            onChange={(e) => changeStatus(e.target.value)}
                        >
                            {(lead.status === "converted" ? [statusMeta("converted")] : STATUS_MENU_STATUSES).map((s: any) => (
                                <SelectItem key={s.key}>{s.label}</SelectItem>
                            ))}
                        </Select></FormField>
                        {lead.status === "lost" && lead.lost_reason && (
                            <div className="text-sm bg-danger-50 text-danger rounded-lg p-2">Lost: {lead.lost_reason}</div>
                        )}
                        {isManager ? (
                            <FormField label="Assigned to"><Select
                                aria-label="Assigned to"
                                selectedKeys={[lead.assigned_to ? String(lead.assigned_to) : "none"]}
                                onChange={(e) => e.target.value && assign(e.target.value)}
                            >
                                {[<SelectItem key="none">Unassigned</SelectItem>, ...team.map((m) => <SelectItem key={String(m.id)}>{m.username || `#${m.id}`}</SelectItem>)]}
                            </Select></FormField>
                        ) : (
                            <Field label="Assigned to" value={lead.assignee?.username} />
                        )}
                        <BranchMoveSelect label="Branch" value={lead.branch_id} onMove={moveBranch} />
                    </section>

                    <section className="rounded-xl border border-default-200 px-4 py-3">
                        <h2 className="text-sm font-semibold text-default-700 mb-3">Contact & interest</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Phone" value={phone} />
                            <Field label="Email" value={lead.email} />
                            <Field label="Country" value={lead.interested_country} />
                            <Field label="Course / service" value={lead.interested_course} />
                            <Field label="Visa type" value={lead.visa_type} />
                            <Field label="Intake" value={lead.intake} />
                            <Field label="City" value={lead.city} />
                            <Field label="Campaign" value={lead.campaign} />
                            {tags.length > 0 && (
                                <div className="col-span-2 flex flex-wrap gap-1">
                                    {tags.map((t) => <Chip key={t} size="sm" variant="flat">{t}</Chip>)}
                                </div>
                            )}
                            {lead.message && (
                                <div className="col-span-2">
                                    <div className="text-xs text-default-500">Message</div>
                                    <div className="text-sm whitespace-pre-wrap break-words">{lead.message}</div>
                                </div>
                            )}
                            {extra && Object.keys(extra).length > 0 && (
                                <div className="col-span-2">
                                    <Divider className="my-1" />
                                    <div className="text-xs text-default-500 mb-1">More info from the source</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(extra).filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
                                            <Field key={k} label={k.replace(/_/g, " ")} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {files.length > 0 && (
                        <section className="rounded-xl border border-default-200 px-4 py-3">
                            <h2 className="text-sm font-semibold text-default-700 mb-3">Files</h2>
                            <ul className="flex flex-col gap-2">
                                {files.map((f) => (
                                    <li key={f.uuid}>
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                                            {f.original_name || "File"}
                                            {f.source === "whatsapp" ? " · WhatsApp" : ""}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* one timeline: follow-up + composer + feed */}
                <div className={`flex flex-col gap-3 ${embedded ? "order-1" : "lg:col-span-3"}`}>
                    {(!closed || lead.next_follow_up_at || followUpSteps.length > 0) && (
                        <section className="rounded-xl border border-default-200 px-4 py-3 flex flex-col gap-3">
                            <h2 className="text-sm font-semibold text-default-700 flex items-center gap-2"><CalendarClock size={16} /> Follow-up</h2>

                            {followUpSteps.length > 0 ? (
                                <ol className="flex flex-col gap-0">
                                    {followUpSteps.map((step, i) => {
                                        const isActive = step.status === "active";
                                        const isLast = i === followUpSteps.length - 1;
                                        const stepFu = isActive ? fu : null;
                                        return (
                                            <li key={step.n} className="flex gap-3">
                                                <div className="flex flex-col items-center w-7 shrink-0">
                                                    <span
                                                        className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${
                                                            step.status === "done"
                                                                ? "bg-success text-success-foreground"
                                                                : stepFu === "overdue"
                                                                    ? "bg-danger text-danger-foreground"
                                                                    : stepFu === "today"
                                                                        ? "bg-warning text-warning-foreground"
                                                                        : "border-2 border-primary text-primary bg-content1"
                                                        }`}
                                                        aria-hidden
                                                    >
                                                        {step.status === "done" ? <Check size={14} strokeWidth={3} /> : step.n}
                                                    </span>
                                                    {!isLast && <span className={`w-px flex-1 min-h-4 ${step.status === "done" ? "bg-success" : "bg-default-200"}`} />}
                                                </div>
                                                <div className={`flex-1 min-w-0 pb-3 ${isLast ? "pb-0" : ""}`}>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-default-600"}`}>
                                                            Follow-up {step.n}
                                                        </span>
                                                        {step.status === "done" && (
                                                            <Chip size="sm" color="success" variant="flat">Done</Chip>
                                                        )}
                                                        {isActive && stepFu === "overdue" && <Chip size="sm" color="danger" variant="flat">Overdue</Chip>}
                                                        {isActive && stepFu === "today" && <Chip size="sm" color="warning" variant="flat">Today</Chip>}
                                                        {isActive && stepFu === "upcoming" && <Chip size="sm" color="primary" variant="flat">Scheduled</Chip>}
                                                    </div>
                                                    <div className="text-xs text-default-500 mt-0.5">
                                                        {step.status === "done"
                                                            ? (step.doneAt ? `Completed ${formatDateTime(step.doneAt)}` : "Completed")
                                                                + (step.at ? ` · was ${formatDateTime(step.at)}` : "")
                                                            : step.at
                                                                ? formatDateTime(step.at)
                                                                : "No date set"}
                                                    </div>
                                                    {step.note && <div className="text-xs text-default-600 break-words mt-0.5">{step.note}</div>}
                                                    {isActive && !closed && (
                                                        <Button size="sm" color="success" variant="flat" className="mt-2" startContent={<CheckCircle2 size={16} />} onPress={followUpDone}>
                                                            Mark done
                                                        </Button>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                    {!closed && !lead.next_follow_up_at && (
                                        <li className="flex gap-3">
                                            <div className="flex flex-col items-center w-7 shrink-0">
                                                <span className="h-7 w-7 rounded-full grid place-items-center text-xs font-semibold border border-dashed border-default-300 text-default-400" aria-hidden>
                                                    {nextFollowUpN}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-default-400">Follow-up {nextFollowUpN}</div>
                                                <div className="text-xs text-default-400">Schedule the next follow-up below</div>
                                            </div>
                                        </li>
                                    )}
                                </ol>
                            ) : (
                                <p className="text-sm text-default-500 flex items-center gap-2">
                                    <Circle size={14} className="text-default-300" /> No follow-ups yet — schedule the first one below.
                                </p>
                            )}

                            {!closed && (
                                <div className="flex flex-col gap-3 pt-1 border-t border-default-100">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <FormField label={scheduleLabel}>
                                            <Input
                                                type="datetime-local"
                                                aria-label={scheduleLabel}
                                                value={followUpAt}
                                                onValueChange={setFollowUpAt}
                                            />
                                        </FormField>
                                        <FormField label="What to do">
                                            <Input
                                                aria-label="What to do"
                                                placeholder="e.g. Send document checklist"
                                                value={followUpNote}
                                                onValueChange={setFollowUpNote}
                                            />
                                        </FormField>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button color="primary" variant="flat" isLoading={savingFollowUp} onPress={scheduleFollowUp}>{scheduleBtn}</Button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    <section className="rounded-xl border border-default-200 px-4 py-3 flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-default-700">Timeline</h2>
                        <Tabs size="sm" selectedKey={activityType} onSelectionChange={(k) => setActivityType(String(k))} aria-label="Activity type">
                            {(lead.source === "instagram" ? [...ACTIVITY_TYPES, { key: "instagram", label: "Instagram", icon: Instagram }] : ACTIVITY_TYPES).map((t) => (
                                <Tab key={t.key} title={<span className="flex items-center gap-1"><t.icon size={14} />{t.label}</span>} />
                            ))}
                        </Tabs>
                        {quickReplies.length > 0 && (activityType === "whatsapp" || activityType === "email" || activityType === "instagram") && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1 -mt-1">
                                <span className="text-xs text-default-500 self-center shrink-0">Quick replies:</span>
                                {quickReplies.map((t) => <Chip key={t.id} size="sm" variant="flat" className="cursor-pointer shrink-0" onClick={() => fillQuickReply(t)}>{t.name}</Chip>)}
                            </div>
                        )}
                        {activityType === "note" ? (
                            <MentionComposer
                                value={activityText}
                                onChange={setActivityText}
                                onMentionsChange={setMentionIds}
                                team={team}
                                placeholder="Write a note — type @ to mention a teammate"
                                minRows={2}
                            />
                        ) : (
                            <Textarea
                                placeholder={activityType === "call" ? "What did you talk about?" : activityType === "whatsapp" && whatsappEnabled ? "Type a WhatsApp message to send" : activityType === "instagram" ? "Reply to their Instagram message (within 24 hours of their last message)" : "What did you send / receive?"}
                                value={activityText}
                                onValueChange={setActivityText}
                                minRows={2}
                            />
                        )}
                        <div className="flex flex-wrap gap-2 justify-end">
                            {activityType === "instagram" ? (
                                <Button color="secondary" startContent={<Instagram size={16} />} isLoading={sendingInstagram} onPress={sendInstagram}>Send on Instagram</Button>
                            ) : activityType === "whatsapp" && whatsappEnabled && lead.phone_number ? (
                                <>
                                    <Button variant="flat" isLoading={savingActivity} onPress={addActivity}>Only log it</Button>
                                    <Button color="success" startContent={<MessageCircle size={16} />} isLoading={sendingWhatsapp} onPress={sendWhatsapp}>Send on WhatsApp</Button>
                                </>
                            ) : (
                                <Button color="primary" isLoading={savingActivity} onPress={addActivity}>Save</Button>
                            )}
                        </div>

                        <Divider />

                        {activities.length === 0 && <p className="text-sm text-default-500">No activity yet.</p>}
                        <ol className="relative border-s border-default-200 ms-2">
                            {activities.map((a) => (
                                <li key={a.id} className="mb-4 ms-4">
                                    <span className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium">{activityLabel(a)}</span>
                                        <span className="text-xs text-default-500 flex items-center gap-1">
                                            <User size={12} />{a.author?.username || (asObject(a.meta)?.direction === "in" ? lead.name || "Student" : asObject(a.meta)?.kind?.startsWith("portal") ? "Student portal" : "System")} · {timeAgo(a.createdAt)}
                                        </span>
                                    </div>
                                    {a.type === "follow_up" && asObject(a.meta)?.at && (
                                        <p className="text-sm text-default-700">For {formatDateTime(asObject(a.meta)?.at)}</p>
                                    )}
                                    {a.message && (a.type === "note" ? <MentionText text={a.message} /> : <p className="text-sm text-default-700 whitespace-pre-wrap break-words">{a.message}</p>)}
                                    {asObject(a.meta)?.file_url && (
                                        <a href={asObject(a.meta)?.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all mt-1 inline-block">
                                            Open {asObject(a.meta)?.file_name || "attachment"}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>
            </div>

            <LeadFormModal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} lead={lead} onSaved={load} />
            <ConvertLeadModal isOpen={convertModal.isOpen} onOpenChange={convertModal.onOpenChange} lead={lead} team={team} canAssign={isManager} onConverted={load} />
            <SendFormModal isOpen={sendFormModal.isOpen} onOpenChange={sendFormModal.onOpenChange} leadUuid={uuid} onSent={() => load(true)} />
            <Modal isOpen={inviteModal.isOpen} onOpenChange={inviteModal.onOpenChange} size="lg">
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader>Invite student to the portal</ModalHeader>
                            <ModalBody className="pb-6"><PortalInvitePanel invite={invite} leadUuid={uuid} /></ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={lostModal.isOpen} onOpenChange={lostModal.onOpenChange}>
                <ModalContent>
                    {(onCloseLost) => (
                        <>
                            <ModalHeader>Why was this lead lost?</ModalHeader>
                            <ModalBody>
                                <Textarea autoFocus placeholder="e.g. Chose another agency, budget too low, not reachable..." value={lostReason} onValueChange={setLostReason} />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onCloseLost}>Cancel</Button>
                                <Button color="danger" isDisabled={!lostReason.trim()} onPress={() => { onCloseLost(); changeStatus("lost", { lost_reason: lostReason.trim() }); }}>
                                    Mark as lost
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <CommonConfirmation
                isOpen={deleteConfirm.isOpen}
                onOpenChange={deleteConfirm.onOpenChange}
                title="Delete this lead?"
                nagativeTitle="Cancel"
                positiveTitle="Delete"
                handleSubmit={deleteLead}
            />
        </div>
    );
};

export default LeadDetails;
