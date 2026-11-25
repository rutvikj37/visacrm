import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, CardFooter, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Select, SelectItem, Spinner, Tab, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import { ArrowDown, ArrowUp, Copy, Eye, Link2, ListChecks, Mail, MessageCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import CommonConfirmation from "@/components/CommonConfirmation";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import FormField from "./FormField";

type FieldType =
    | "short_text" | "long_text" | "email" | "phone" | "number" | "date"
    | "single_choice" | "multi_choice" | "yes_no" | "file";

type Field = { id: string; label: string; type: FieldType; required?: boolean; options?: string[]; help?: string };
type Draft = {
    id?: string; name: string; description: string; fields: Field[];
    settings: { thank_you_message: string; allow_multiple: boolean; collect_contact: boolean };
    status?: string; public_url?: string | null; share_token?: string | null;
};

const FIELD_TYPES: { key: FieldType; label: string }[] = [
    { key: "short_text", label: "Short text" },
    { key: "long_text", label: "Long text" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "number", label: "Number" },
    { key: "date", label: "Date" },
    { key: "single_choice", label: "Single choice" },
    { key: "multi_choice", label: "Multiple choice" },
    { key: "yes_no", label: "Yes / No" },
    { key: "file", label: "File upload" },
];

const needsOptions = (t: FieldType) => t === "single_choice" || t === "multi_choice";
const newId = () => Math.random().toString(36).slice(2, 10);

const emptyDraft = (): Draft => ({
    name: "",
    description: "",
    fields: [{ id: newId(), label: "Full name", type: "short_text", required: true }],
    settings: { thank_you_message: "Thank you — we have received your response.", allow_multiple: true, collect_contact: true },
});

const FormCard = ({ f, children }: { f: any; children: React.ReactNode }) => (
    <Card shadow="sm" className="h-full">
        <CardBody className="gap-2">
            <div className="font-medium">{f.name}</div>
            <div className="flex flex-wrap gap-1">
                <Chip size="sm" variant="flat" color={f.status === "published" ? "success" : "default"}>{f.status}</Chip>
                <Chip size="sm" variant="flat">{f.field_count} fields</Chip>
                {typeof f.submission_count === "number" && <Chip size="sm" variant="flat">{f.submission_count} responses</Chip>}
            </div>
            {f.description && <p className="text-xs text-default-500 line-clamp-2">{f.description}</p>}
        </CardBody>
        <CardFooter className="flex flex-wrap gap-2 pt-0">{children}</CardFooter>
    </Card>
);

const ClientForms = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Draft>(emptyDraft());
    const [saving, setSaving] = useState(false);
    const [share, setShare] = useState<any>(null);
    const [responses, setResponses] = useState<{ form: any; submissions: any[] } | null>(null);
    const [activeSub, setActiveSub] = useState<any>(null);
    const [toArchive, setToArchive] = useState<any>(null);
    const editor = useDisclosure();
    const shareModal = useDisclosure();
    const responsesModal = useDisclosure();
    const archiveConfirm = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/forms");
        if (success) setForms(data?.forms || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const openNew = () => { setDraft(emptyDraft()); editor.onOpen(); };
    const openEdit = (f: any) => {
        setDraft({
            id: f.id,
            name: f.name || "",
            description: f.description || "",
            fields: JSON.parse(JSON.stringify(f.fields || [])),
            settings: {
                thank_you_message: f.settings?.thank_you_message || "",
                allow_multiple: f.settings?.allow_multiple !== false,
                collect_contact: f.settings?.collect_contact !== false,
            },
            status: f.status,
            public_url: f.public_url,
            share_token: f.share_token,
        });
        editor.onOpen();
    };

    const setField = (i: number, patch: Partial<Field>) =>
        setDraft((d) => ({ ...d, fields: d.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) }));
    const moveField = (i: number, dir: -1 | 1) =>
        setDraft((d) => {
            const fields = [...d.fields];
            const j = i + dir;
            if (j < 0 || j >= fields.length) return d;
            [fields[i], fields[j]] = [fields[j], fields[i]];
            return { ...d, fields };
        });
    const removeField = (i: number) => setDraft((d) => ({ ...d, fields: d.fields.filter((_, idx) => idx !== i) }));
    const addField = () => setDraft((d) => ({
        ...d,
        fields: [...d.fields, { id: newId(), label: "", type: "short_text", required: false }],
    }));

    const save = async (close: () => void, andPublish = false) => {
        if (!draft.name.trim()) return ErrorToast("Please give the form a name");
        if (!draft.fields.length) return ErrorToast("Add at least one field");
        if (draft.fields.some((f) => !f.label.trim())) return ErrorToast("Every field needs a label");
        setSaving(true);
        const body = {
            name: draft.name,
            description: draft.description,
            fields: draft.fields.map((f) => ({
                ...f,
                label: f.label.trim(),
                options: needsOptions(f.type) ? (f.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
            })),
            settings: draft.settings,
        };
        const { success, data } = draft.id
            ? await commonPostAPICall(body, `crm/forms/${draft.id}/update`, true)
            : await commonPostAPICall(body, "crm/forms", true);
        if (!success) { setSaving(false); return; }
        let id = draft.id || data?.id;
        if (andPublish && id) {
            const pub = await commonPostAPICall({}, `crm/forms/${id}/publish`, true);
            setSaving(false);
            if (pub.success) {
                close();
                await load();
                setShare(pub.data?.share || null);
                shareModal.onOpen();
            }
            return;
        }
        setSaving(false);
        if (success) { close(); load(); }
    };

    const openShare = async (f: any) => {
        if (f.status !== "published") {
            const { success, data } = await commonPostAPICall({}, `crm/forms/${f.id}/publish`, true);
            if (!success) return;
            await load();
            setShare(data?.share || null);
            shareModal.onOpen();
            return;
        }
        const { success, data } = await commonGetAPICalls(`/crm/forms/${f.id}/share`);
        if (success) { setShare(data); shareModal.onOpen(); }
    };

    const openResponses = async (f: any) => {
        const { success, data } = await commonGetAPICalls(`/crm/forms/${f.id}/submissions`);
        if (!success) return;
        setResponses({ form: data?.form, submissions: data?.submissions || [] });
        setActiveSub(null);
        responsesModal.onOpen();
    };

    const openSubmission = async (formId: string, subId: string) => {
        const { success, data } = await commonGetAPICalls(`/crm/forms/${formId}/submissions/${subId}`);
        if (success) setActiveSub(data?.submission);
    };

    const createLead = async () => {
        if (!responses?.form?.id || !activeSub?.id) return;
        const { success, data } = await commonPostAPICall({}, `crm/forms/${responses.form.id}/submissions/${activeSub.id}/create_lead`, true);
        if (success) {
            setActiveSub((s: any) => ({ ...s, lead: data?.lead || s.lead, lead_id: true }));
            openResponses({ id: responses.form.id });
        }
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            SuccessToast("Copied");
        } catch {
            ErrorToast("Could not copy");
        }
    };

    const duplicate = async (id: string) => {
        const { success, data } = await commonPostAPICall({}, `crm/forms/${id}/duplicate`, true);
        if (success) { await load(); openEdit(data); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-5 p-1 sm:p-2 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2"><ListChecks size={24} /> Client forms</h1>
                    <p className="text-sm text-default-500">Build a form, send a link, and collect responses — for new clients or portal students.</p>
                </div>
                {isOwner && <Button color="primary" startContent={<Plus size={16} />} onPress={openNew}>New form</Button>}
            </div>

            {forms.length === 0 ? (
                <p className="text-sm text-default-500">No forms yet. Create one and publish a share link for clients to fill.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {forms.map((f) => (
                        <FormCard key={f.id} f={f}>
                            {isOwner && <Button size="sm" variant="flat" startContent={<Pencil size={14} />} onPress={() => openEdit(f)}>Edit</Button>}
                            <Button size="sm" variant="flat" startContent={<Link2 size={14} />} onPress={() => openShare(f)}>
                                {f.status === "published" ? "Share" : "Publish"}
                            </Button>
                            <Button size="sm" variant="flat" startContent={<Eye size={14} />} onPress={() => openResponses(f)}>Responses</Button>
                            {isOwner && (
                                <>
                                    <Button size="sm" variant="flat" startContent={<Copy size={14} />} onPress={() => duplicate(f.id)}>Duplicate</Button>
                                    <Button size="sm" variant="flat" color="danger" isIconOnly aria-label="Archive" onPress={() => { setToArchive(f); archiveConfirm.onOpen(); }}><Trash2 size={14} /></Button>
                                </>
                            )}
                        </FormCard>
                    ))}
                </div>
            )}

            {/* editor */}
            <Modal isOpen={editor.isOpen} onOpenChange={editor.onOpenChange} size="4xl" scrollBehavior="inside" isDismissable={false}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{draft.id ? "Edit form" : "New form"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 gap-3">
                                    <FormField label="Form name *"><Input aria-label="Form name" value={draft.name} onValueChange={(v) => setDraft({ ...draft, name: v })} /></FormField>
                                    <FormField label="Description">
                                        <Textarea aria-label="Description" minRows={2} value={draft.description} onValueChange={(v) => setDraft({ ...draft, description: v })} />
                                    </FormField>
                                    <FormField label="Thank-you message">
                                        <Input aria-label="Thank you" value={draft.settings.thank_you_message} onValueChange={(v) => setDraft({ ...draft, settings: { ...draft.settings, thank_you_message: v } })} />
                                    </FormField>
                                    <Checkbox isSelected={draft.settings.collect_contact} onValueChange={(v) => setDraft({ ...draft, settings: { ...draft.settings, collect_contact: v } })}>
                                        Collect contact details when possible
                                    </Checkbox>
                                </div>

                                <div className="flex flex-col gap-3 mt-3">
                                    <div className="font-medium text-sm">Fields</div>
                                    {draft.fields.map((field, i) => (
                                        <Card key={field.id} shadow="none" className="border border-default-200">
                                            <CardBody className="gap-2">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Input size="sm" aria-label="Field label" placeholder="Question / label" value={field.label} onValueChange={(v) => setField(i, { label: v })} className="flex-1" />
                                                    <Select size="sm" aria-label="Type" className="sm:w-48" selectedKeys={[field.type]} onChange={(e) => {
                                                        const type = e.target.value as FieldType;
                                                        if (!type) return;
                                                        setField(i, { type, options: needsOptions(type) ? (field.options?.length ? field.options : ["Option 1", "Option 2"]) : undefined });
                                                    }}>
                                                        {FIELD_TYPES.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}
                                                    </Select>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Checkbox size="sm" isSelected={!!field.required} onValueChange={(v) => setField(i, { required: v })}>Required</Checkbox>
                                                        <Button isIconOnly size="sm" variant="light" aria-label="Move up" isDisabled={i === 0} onPress={() => moveField(i, -1)}><ArrowUp size={16} /></Button>
                                                        <Button isIconOnly size="sm" variant="light" aria-label="Move down" isDisabled={i === draft.fields.length - 1} onPress={() => moveField(i, 1)}><ArrowDown size={16} /></Button>
                                                        <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Remove" onPress={() => removeField(i)}><X size={16} /></Button>
                                                    </div>
                                                </div>
                                                {needsOptions(field.type) && (
                                                    <Textarea
                                                        size="sm"
                                                        aria-label="Options"
                                                        placeholder="One option per line"
                                                        minRows={2}
                                                        value={(field.options || []).join("\n")}
                                                        onValueChange={(v) => setField(i, { options: v.split("\n") })}
                                                    />
                                                )}
                                                <Input size="sm" aria-label="Help" placeholder="Help text (optional)" value={field.help || ""} onValueChange={(v) => setField(i, { help: v })} />
                                            </CardBody>
                                        </Card>
                                    ))}
                                    <Button variant="flat" startContent={<Plus size={16} />} onPress={addField} className="self-start">Add field</Button>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button variant="flat" isLoading={saving} onPress={() => save(onClose, false)}>Save draft</Button>
                                {isOwner && <Button color="primary" isLoading={saving} onPress={() => save(onClose, true)}>Save & publish</Button>}
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* share */}
            <Modal isOpen={shareModal.isOpen} onOpenChange={shareModal.onOpenChange} size="lg">
                <ModalContent>
                    {() => share && (
                        <>
                            <ModalHeader>Share form</ModalHeader>
                            <ModalBody className="gap-3 pb-6">
                                {share.form_url ? (
                                    <div className="rounded-xl bg-default-100 p-3 text-sm break-all">{share.form_url}</div>
                                ) : (
                                    <div className="text-xs text-warning-600">Student portal address is not set, so there is no public link yet. Ask the platform admin to set your domain.</div>
                                )}
                                <div className="rounded-xl bg-default-100 p-3 text-sm whitespace-pre-wrap break-words">{share.message}</div>
                                <div className="flex flex-wrap gap-2">
                                    {share.form_url && <Button variant="flat" startContent={<Copy size={16} />} onPress={() => copy(share.form_url)}>Copy link</Button>}
                                    <Button variant="flat" startContent={<Copy size={16} />} onPress={() => copy(share.message)}>Copy message</Button>
                                    {share.whatsapp_url && (
                                        <Button as="a" href={share.whatsapp_url} target="_blank" rel="noreferrer" color="success" variant="flat" startContent={<MessageCircle size={16} />}>WhatsApp</Button>
                                    )}
                                    {share.email_url && (
                                        <Button as="a" href={share.email_url} variant="flat" startContent={<Mail size={16} />}>Email</Button>
                                    )}
                                </div>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* responses */}
            <Modal isOpen={responsesModal.isOpen} onOpenChange={responsesModal.onOpenChange} size="4xl" scrollBehavior="inside">
                <ModalContent>
                    {() => responses && (
                        <>
                            <ModalHeader>Responses — {responses.form?.name}</ModalHeader>
                            <ModalBody className="pb-6">
                                <Tabs
                                    selectedKey={activeSub ? "detail" : "list"}
                                    onSelectionChange={(k) => { if (k === "list") setActiveSub(null); }}
                                >
                                    <Tab key="list" title={`${responses.submissions.length} responses`}>
                                        {responses.submissions.length === 0 ? (
                                            <p className="text-sm text-default-500 py-4">No responses yet.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2 py-2">
                                                {responses.submissions.map((s) => (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        className="text-left rounded-xl border border-default-200 p-3 hover:bg-default-50"
                                                        onClick={() => openSubmission(responses.form.id, s.id)}
                                                    >
                                                        <div className="font-medium text-sm">{s.contact_name || s.contact_email || s.contact_phone || "Anonymous"}</div>
                                                        <div className="text-xs text-default-500 flex flex-wrap gap-2 mt-1">
                                                            <span>{new Date(s.createdAt).toLocaleString()}</span>
                                                            <Chip size="sm" variant="flat">{s.source}</Chip>
                                                            {s.lead_id && <Chip size="sm" color="success" variant="flat">Linked lead</Chip>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </Tab>
                                    <Tab key="detail" title="Details" isDisabled={!activeSub}>
                                        {activeSub && (
                                            <div className="flex flex-col gap-3 py-2">
                                                <div className="text-sm">
                                                    <div><b>Name:</b> {activeSub.contact_name || "—"}</div>
                                                    <div><b>Email:</b> {activeSub.contact_email || "—"}</div>
                                                    <div><b>Phone:</b> {activeSub.contact_phone || "—"}</div>
                                                    <div><b>Source:</b> {activeSub.source}</div>
                                                    {activeSub.lead && <div><b>Lead:</b> {activeSub.lead.name} ({activeSub.lead.status})</div>}
                                                </div>
                                                {!activeSub.lead && (activeSub.contact_email || activeSub.contact_phone) && (
                                                    <Button size="sm" color="primary" className="self-start" onPress={createLead}>Create / link lead</Button>
                                                )}
                                                <div className="border-t border-default-200 pt-3 flex flex-col gap-3">
                                                    {(responses.form?.fields || []).map((f: Field) => {
                                                        const v = activeSub.answers?.[f.id];
                                                        if (v == null || v === "") return null;
                                                        return (
                                                            <div key={f.id}>
                                                                <div className="text-xs text-default-500">{f.label}</div>
                                                                {typeof v === "object" && v.url ? (
                                                                    <a className="text-sm text-primary underline" href={v.url} target="_blank" rel="noreferrer">{v.name || "Download file"}</a>
                                                                ) : (
                                                                    <div className="text-sm whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : String(v)}</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <Button size="sm" variant="light" className="self-start" onPress={() => setActiveSub(null)}>Back to list</Button>
                                            </div>
                                        )}
                                    </Tab>
                                </Tabs>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <CommonConfirmation
                isOpen={archiveConfirm.isOpen}
                onOpenChange={archiveConfirm.onOpenChange}
                title={`Archive "${toArchive?.name}"? Existing responses are kept.`}
                nagativeTitle="Cancel"
                positiveTitle="Archive"
                handleSubmit={async () => {
                    archiveConfirm.onClose();
                    if (toArchive) {
                        const { success } = await commonPostAPICall({}, `crm/forms/${toArchive.id}/archive`, true);
                        if (success) load();
                    }
                    setToArchive(null);
                }}
            />
        </div>
    );
};

export default ClientForms;
