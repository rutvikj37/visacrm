import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, CardFooter, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem,
    Spinner, Switch, Textarea, useDisclosure,
} from "@heroui/react";
import { Mail, MessageCircle, Pencil, Plus, Send, Trash2, Zap } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { LEAD_SOURCES, LEAD_STATUSES } from "../Crm/crmShared";

const TRIGGERS: Record<string, { label: string; help: string }> = {
    manual: { label: "Only when I send it", help: "Use it for broadcasts." },
    lead_created: { label: "When a new lead arrives", help: "A welcome message, sent right away." },
    lead_converted: { label: "When a lead becomes a visa case", help: "Tell the student their process has started." },
    documents_pending: { label: "While documents are pending", help: "Reminder every 3 days until the student has sent everything." },
    fee_due: { label: "When a fee is due", help: "Reminder 2 days before the due date and every 3 days while overdue." },
    // Travel CRM
    quote_sent: { label: "Travel: when a quote is sent", help: "Used by “Send on WhatsApp” on a quote. Variables: name, trip, total, link." },
    itinerary_shared: { label: "Travel: when an itinerary is shared", help: "Used by “Send on WhatsApp” on an itinerary. Variables: name, trip, link." },
    booking_confirmed: { label: "Travel: when a booking is confirmed", help: "Sent automatically when a quote is booked. Variables: name, trip, booking_no, start_date, total." },
    trip_kit: { label: "Travel: trip kit", help: "Used by “Send trip kit”. Variables: name, trip, booking_no, start_date, link." },
    trip_tomorrow: { label: "Travel: the day before the trip", help: "Sent automatically the day before departure. Variables: name, trip, booking_no, start_date." },
    welcome_back: { label: "Travel: welcome back", help: "Sent automatically the day after the trip ends. Variables: name, trip." },
};
const SAMPLES: Record<string, string> = {
    lead_created: "Hi {{name}}, thank you for contacting {{agency}}! Our counsellor will call you shortly about your {{country}} plans.",
    lead_converted: "Hi {{name}}, welcome to {{agency}}! Your {{country}} visa process has started. Track it and upload documents here: {{portal_link}}",
    documents_pending: "Hi {{name}}, we are still waiting for {{pending_count}} item(s) for your {{country}} visa. Please upload them here: {{portal_link}}",
    fee_due: "Hi {{name}}, a payment of {{amount}} is due on {{due_date}}. You can pay here: {{portal_link}}",
    manual: "Hi {{name}}, ",
    quote_sent: "Hi {{name}}, here is your quote for {{trip}}: {{total}}. Full plan: {{link}}",
    itinerary_shared: "Hi {{name}}, here is your trip plan for {{trip}}: {{link}}",
    booking_confirmed: "Hi {{name}}, your trip {{trip}} is confirmed (booking {{booking_no}}), starting {{start_date}}. We will share your vouchers soon.",
    trip_kit: "Hi {{name}}, your tickets, vouchers and day plan for {{trip}} are here: {{link}}",
    trip_tomorrow: "Hi {{name}}, your trip {{trip}} starts tomorrow! Have a wonderful time. Call us any time if you need help.",
    welcome_back: "Welcome back, {{name}}! We hope you loved {{trip}}. We would be grateful for a quick review.",
};
const emptyDraft = () => ({ id: "", name: "", channel: "whatsapp", trigger: "lead_created", subject: "", body: SAMPLES.lead_created, wa_template_name: "", wa_language: "en", wa_variables: [] as string[], is_active: true });
const Field = ({ label, hint, className = "", children }: any) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}><span className="text-xs font-medium text-default-600">{label}</span>{children}{hint && <span className="text-xs text-default-400">{hint}</span>}</div>
);

/** Messages to leads and students: automatic messages and broadcasts over WhatsApp and email. */
const MessagesPage = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const [data, setData] = useState<any>(null);
    const [draft, setDraft] = useState<any>(emptyDraft());
    const [saving, setSaving] = useState(false);
    const editor = useDisclosure();
    const broadcastModal = useDisclosure();
    const [target, setTarget] = useState<any>(null);
    const [filters, setFilters] = useState({ status: "open", source: "", temperature: "", country: "", tag: "" });
    const [audience, setAudience] = useState<any>(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/messages/templates");
        if (success) setData(data);
    }, []);
    useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

    useEffect(() => {
        if (!broadcastModal.isOpen) return;
        const t = setTimeout(async () => {
            const { success, data } = await commonPostAPICall({ filters }, "crm/messages/audience");
            if (success) setAudience(data);
        }, 300);
        return () => clearTimeout(t);
    }, [filters, broadcastModal.isOpen]);

    if (!isOwner) {
        return (
            <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Messages</h1>
                    <p className="text-sm text-default-500">Only the agency owner can manage automatic messages and broadcasts.</p>
                </div>
            </div>
        );
    }

    const openNew = () => { setDraft(emptyDraft()); editor.onOpen(); };
    const openEdit = (t: any) => { setDraft({ ...t, subject: t.subject || "", wa_template_name: t.wa_template_name || "", wa_language: t.wa_language || "en", wa_variables: t.wa_variables || [] }); editor.onOpen(); };
    const save = async (close: () => void) => {
        if (!draft.name.trim() || !draft.body.trim()) return ErrorToast("Please enter a name and the message");
        setSaving(true);
        const { success } = await commonPostAPICall({ ...draft, id: draft.id || undefined }, "crm/messages/templates", true);
        setSaving(false);
        if (success) { close(); load(); }
    };
    const remove = async (t: any) => {
        if (!window.confirm(`Delete "${t.name}"?`)) return;
        const { success } = await commonPostAPICall({}, `crm/messages/templates/${t.id}/delete`, true);
        if (success) load();
    };
    const toggle = async (t: any) => {
        const { success } = await commonPostAPICall({ ...t, is_active: !t.is_active }, "crm/messages/templates");
        if (success) load();
    };
    const send = async (close: () => void) => {
        setSending(true);
        const { success } = await commonPostAPICall({ template_id: target.id, filters }, "crm/messages/broadcast", true);
        setSending(false);
        if (success) { close(); setTimeout(load, 4000); }
    };
    const reach = audience ? Math.min(target?.channel === "email" ? audience.with_email : audience.with_phone, audience.max) : null;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Messages</h1>
                    <p className="text-sm text-default-500">Automatic WhatsApp and email to leads and students, plus broadcasts</p>
                </div>
                <Button color="primary" className="w-full sm:w-auto" startContent={<Plus size={16} />} onPress={openNew} isDisabled={!data}>New message</Button>
            </div>

            {!data ? (
                <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center gap-2 py-14">
                    <Spinner size="sm" />
                    <span className="text-sm text-default-500">Loading messages…</span>
                </div>
            ) : (
            <>
            {(!data.whatsapp_connected || !data.email_available) && (
                <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 space-y-1">
                    {!data.whatsapp_connected && <div>WhatsApp is not connected yet — connect your number in Lead sources to send WhatsApp messages.</div>}
                    {!data.email_available && <div>Email sending is not switched on for this platform yet, so email messages will not go out.</div>}
                </div>
            )}

            {data.templates.length === 0 && <p className="text-sm text-default-500">No messages yet. Start with a welcome message for new leads.</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.templates.map((t: any) => (
                    <Card key={t.id} shadow="sm" className={t.is_active ? "" : "opacity-60"}>
                        <CardBody className="gap-2">
                            <div className="flex items-start gap-2">
                                {t.channel === "email" ? <Mail size={18} className="mt-0.5 shrink-0" /> : <MessageCircle size={18} className="mt-0.5 shrink-0" />}
                                <div className="flex-1 min-w-0"><div className="font-medium truncate">{t.name}</div></div>
                                <Switch size="sm" isSelected={t.is_active} onValueChange={() => toggle(t)} aria-label="Active" />
                            </div>
                            <Chip size="sm" variant="flat" color={t.trigger === "manual" ? "default" : "primary"} startContent={t.trigger === "manual" ? undefined : <Zap size={12} />}>{TRIGGERS[t.trigger]?.label}</Chip>
                            <p className="text-sm text-default-600 line-clamp-3 whitespace-pre-line break-words">{t.body}</p>
                            {t.channel === "whatsapp" && <div className="text-xs text-default-500">{t.wa_template_name ? `Approved template: ${t.wa_template_name}` : "Free text (only within 24 hours of the person's message)"}</div>}
                            <div className="text-xs text-default-500">Sent {t.sent_count}{t.failed_count ? ` · failed ${t.failed_count}` : ""}</div>
                            {t.last_error && t.failed_count > 0 && <div className="text-xs text-danger break-words">Last problem: {t.last_error}</div>}
                        </CardBody>
                        <CardFooter className="gap-2 pt-0">
                            <Button size="sm" variant="flat" startContent={<Pencil size={14} />} onPress={() => openEdit(t)}>Edit</Button>
                            <Button size="sm" variant="flat" color="primary" startContent={<Send size={14} />} onPress={() => { setTarget(t); setAudience(null); broadcastModal.onOpen(); }}>Broadcast</Button>
                            <Button size="sm" variant="flat" color="danger" isIconOnly aria-label="Delete" onPress={() => remove(t)}><Trash2 size={14} /></Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            </>
            )}

            {/* editor */}
            <Modal isOpen={editor.isOpen} onOpenChange={editor.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{draft.id ? "Edit message" : "New message"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Name (only you see it)"><Input aria-label="Name" value={draft.name} onValueChange={(v) => setDraft({ ...draft, name: v })} /></Field>
                                    <Field label="Send by">
                                        <Select aria-label="Channel" selectedKeys={[draft.channel]} onChange={(e) => e.target.value && setDraft({ ...draft, channel: e.target.value })}>
                                            <SelectItem key="whatsapp">WhatsApp</SelectItem>
                                            <SelectItem key="email">Email</SelectItem>
                                        </Select>
                                    </Field>
                                    <Field label="When to send" hint={TRIGGERS[draft.trigger]?.help} className="sm:col-span-2">
                                        <Select aria-label="Trigger" selectedKeys={[draft.trigger]} onChange={(e) => e.target.value && setDraft({ ...draft, trigger: e.target.value, body: draft.id || draft.body !== SAMPLES[draft.trigger] ? draft.body : SAMPLES[e.target.value] })}>
                                            {Object.entries(TRIGGERS).map(([k, v]) => <SelectItem key={k}>{v.label}</SelectItem>)}
                                        </Select>
                                    </Field>
                                    {draft.channel === "email" && <Field label="Email subject" className="sm:col-span-2"><Input aria-label="Subject" value={draft.subject} onValueChange={(v) => setDraft({ ...draft, subject: v })} /></Field>}
                                    <Field label="Message" className="sm:col-span-2" hint={`You can use: ${data.variables.map((v: string) => `{{${v}}}`).join("  ")}`}>
                                        <Textarea aria-label="Message" minRows={4} value={draft.body} onValueChange={(v) => setDraft({ ...draft, body: v })} />
                                    </Field>
                                </div>
                                {draft.channel === "whatsapp" && (
                                    <div className="rounded-xl border border-default-200 p-3 flex flex-col gap-3">
                                        <div className="text-sm">
                                            <b>Approved WhatsApp template</b>
                                            <div className="text-xs text-default-500">WhatsApp only delivers automatic messages and broadcasts that use a template approved in WhatsApp Manager. Create the template there with the same text, then enter its name here.</div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                                            <Field label="Template name"><Input aria-label="Template name" placeholder="e.g. welcome_lead" value={draft.wa_template_name} onValueChange={(v) => setDraft({ ...draft, wa_template_name: v })} /></Field>
                                            <Field label="Language"><Input aria-label="Language" placeholder="en" value={draft.wa_language} onValueChange={(v) => setDraft({ ...draft, wa_language: v })} /></Field>
                                        </div>
                                        <Field label="Values for {{1}}, {{2}}, ... in the approved template (in order)">
                                            <div className="flex flex-wrap gap-2">
                                                {draft.wa_variables.map((v: string, i: number) => (
                                                    <Chip key={`${v}-${i}`} variant="flat" onClose={() => setDraft({ ...draft, wa_variables: draft.wa_variables.filter((_: string, n: number) => n !== i) })}>{`{{${i + 1}}} = ${v}`}</Chip>
                                                ))}
                                                <Select aria-label="Add value" size="sm" className="w-44" placeholder="Add value" selectedKeys={[]} onChange={(e) => e.target.value && setDraft({ ...draft, wa_variables: [...draft.wa_variables, e.target.value] })}>
                                                    {data.variables.map((v: string) => <SelectItem key={v}>{v}</SelectItem>)}
                                                </Select>
                                            </div>
                                        </Field>
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => save(onClose)}>Save</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* broadcast */}
            <Modal isOpen={broadcastModal.isOpen} onOpenChange={broadcastModal.onOpenChange} size="lg">
                <ModalContent>
                    {(onClose) => target && (
                        <>
                            <ModalHeader>Broadcast "{target.name}"</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">Choose which leads get this {target.channel === "email" ? "email" : "WhatsApp message"}.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Status">
                                        <Select aria-label="Status" selectedKeys={[filters.status]} onChange={(e) => e.target.value && setFilters({ ...filters, status: e.target.value })}>
                                            {[<SelectItem key="open">All open leads</SelectItem>, <SelectItem key="any">Everyone (except junk)</SelectItem>, ...LEAD_STATUSES.filter((s) => s.key !== "junk").map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)]}
                                        </Select>
                                    </Field>
                                    <Field label="Source">
                                        <Select aria-label="Source" placeholder="Any" selectedKeys={filters.source ? [filters.source] : []} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
                                            {LEAD_SOURCES.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                                        </Select>
                                    </Field>
                                    <Field label="Score">
                                        <Select aria-label="Score" placeholder="Any" selectedKeys={filters.temperature ? [filters.temperature] : []} onChange={(e) => setFilters({ ...filters, temperature: e.target.value })}>
                                            <SelectItem key="hot">Hot</SelectItem><SelectItem key="warm">Warm</SelectItem><SelectItem key="cold">Cold</SelectItem>
                                        </Select>
                                    </Field>
                                    <Field label="Interested country"><Input aria-label="Country" placeholder="Any" value={filters.country} onValueChange={(v) => setFilters({ ...filters, country: v })} /></Field>
                                    <Field label="Tag" className="sm:col-span-2"><Input aria-label="Tag" placeholder="Any" value={filters.tag} onValueChange={(v) => setFilters({ ...filters, tag: v })} /></Field>
                                </div>
                                <div className="rounded-xl bg-default-100 p-3 text-sm">
                                    {reach === null ? "Counting..." : <>This will be sent to <b>{reach}</b> lead(s){audience.total > reach ? ` (of ${audience.total} matching; the rest have no ${target.channel === "email" ? "email" : "phone"} or are over the ${audience.max} limit)` : ""}.</>}
                                </div>
                                {target.channel === "whatsapp" && !target.wa_template_name && <div className="text-sm text-danger">Add an approved WhatsApp template name to this message before broadcasting.</div>}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={sending} isDisabled={!reach || (target.channel === "whatsapp" && !target.wa_template_name)} onPress={() => window.confirm(`Send to ${reach} lead(s) now?`) && send(onClose)}>Send now</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default MessagesPage;
