import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, CardFooter, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Select, SelectItem, Spinner, Textarea, useDisclosure,
} from "@heroui/react";
import { ArrowDown, ArrowUp, Copy, Eye, FileText, ListChecks, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import CommonConfirmation from "@/components/CommonConfirmation";
import { ErrorToast } from "@/utils/Toaster";
import FormField from "./FormField";

type Question = { text: string; type: "text_input" | "file_selector" };
type Step = { title: string; description?: string; due_in_days?: number | string | null; questions: Question[] };
type Draft = { id?: string; name: string; country: string; visa_type: string; description: string; steps: Step[] };

const emptyDraft = (): Draft => ({
    name: "",
    country: "",
    visa_type: "",
    description: "",
    steps: [{ title: "Basic documents", description: "", questions: [{ text: "Passport - first and last page", type: "file_selector" }] }],
});

const QUESTION_TYPES = [
    { key: "file_selector", label: "Student uploads a file" },
    { key: "text_input", label: "Student types an answer" },
];

const TemplateCard = ({ t, children }: { t: any; children: React.ReactNode }) => (
    <Card shadow="sm" className="h-full">
        <CardBody className="gap-2">
            <div className="font-medium">{t.name}</div>
            <div className="flex flex-wrap gap-1">
                {t.country && <Chip size="sm" variant="flat">{t.country}</Chip>}
                {t.visa_type && <Chip size="sm" variant="flat">{t.visa_type}</Chip>}
            </div>
            {t.description && <p className="text-xs text-default-500 line-clamp-2">{t.description}</p>}
            <div className="text-xs text-default-500 flex items-center gap-1"><ListChecks size={14} /> {t.step_count} steps · {t.question_count} items</div>
        </CardBody>
        <CardFooter className="flex flex-wrap gap-2 pt-0">{children}</CardFooter>
    </Card>
);

const VisaTemplates = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const [data, setData] = useState<{ agency: any[]; library: any[] }>({ agency: [], library: [] });
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Draft>(emptyDraft());
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [toDelete, setToDelete] = useState<any>(null);
    const editor = useDisclosure();
    const previewModal = useDisclosure();
    const deleteConfirm = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/visa_templates");
        if (success) setData({ agency: data?.agency || [], library: data?.library || [] });
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const openNew = () => { setDraft(emptyDraft()); editor.onOpen(); };
    const openEdit = (t: any) => {
        setDraft({
            id: t.id, name: t.name || "", country: t.country || "", visa_type: t.visa_type || "", description: t.description || "",
            steps: JSON.parse(JSON.stringify(t.steps || [])),
        });
        editor.onOpen();
    };
    const copyTemplate = async (id: string) => {
        const { success, data: created } = await commonPostAPICall({ copy_from: id }, "crm/visa_templates", true);
        if (success) {
            await load();
            openEdit(created);
        }
    };

    // --- draft editing helpers ---
    const setStep = (i: number, patch: Partial<Step>) =>
        setDraft((d) => ({ ...d, steps: d.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
    const moveStep = (i: number, dir: -1 | 1) =>
        setDraft((d) => {
            const steps = [...d.steps];
            const j = i + dir;
            if (j < 0 || j >= steps.length) return d;
            [steps[i], steps[j]] = [steps[j], steps[i]];
            return { ...d, steps };
        });
    const removeStep = (i: number) => setDraft((d) => ({ ...d, steps: d.steps.filter((_, idx) => idx !== i) }));
    const addStep = () => setDraft((d) => ({ ...d, steps: [...d.steps, { title: "", description: "", questions: [{ text: "", type: "file_selector" }] }] }));
    const setQuestion = (si: number, qi: number, patch: Partial<Question>) =>
        setStep(si, { questions: draft.steps[si].questions.map((q, idx) => (idx === qi ? { ...q, ...patch } : q)) });
    const addQuestion = (si: number) => setStep(si, { questions: [...draft.steps[si].questions, { text: "", type: "file_selector" }] });
    const removeQuestion = (si: number, qi: number) => setStep(si, { questions: draft.steps[si].questions.filter((_, idx) => idx !== qi) });

    const save = async (close: () => void) => {
        if (!draft.name.trim()) return ErrorToast("Please give the template a name");
        if (!draft.steps.length) return ErrorToast("Add at least one step");
        const emptyStep = draft.steps.findIndex((s) => !s.title.trim());
        if (emptyStep >= 0) return ErrorToast(`Step ${emptyStep + 1} needs a title`);
        setSaving(true);
        const body = {
            name: draft.name, country: draft.country, visa_type: draft.visa_type, description: draft.description,
            steps: draft.steps.map((s) => ({ ...s, due_in_days: s.due_in_days === "" || s.due_in_days === undefined ? null : s.due_in_days, questions: s.questions.filter((q) => q.text.trim()) })),
        };
        const { success } = draft.id
            ? await commonPostAPICall(body, `crm/visa_templates/${draft.id}/update`, true)
            : await commonPostAPICall(body, "crm/visa_templates", true);
        setSaving(false);
        if (success) { close(); load(); }
    };

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-5 p-1 sm:p-2 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2"><ListChecks size={24} /> Visa templates</h1>
                    <p className="text-sm text-default-500">Reusable step-by-step checklists. When you convert a lead, the template becomes the student's visa process.</p>
                </div>
                {isOwner && <Button color="primary" startContent={<Plus size={16} />} onPress={openNew}>New template</Button>}
            </div>

            <section className="flex flex-col gap-3">
                <h2 className="font-semibold">My templates</h2>
                {data.agency.length === 0 ? (
                    <p className="text-sm text-default-500">No templates yet. Start from a built-in one below and adjust it to your process.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {data.agency.map((t) => (
                            <TemplateCard key={t.id} t={t}>
                                {isOwner ? (
                                    <>
                                        <Button size="sm" variant="flat" startContent={<Pencil size={14} />} onPress={() => openEdit(t)}>Edit</Button>
                                        <Button size="sm" variant="flat" startContent={<Copy size={14} />} onPress={() => copyTemplate(t.id)}>Duplicate</Button>
                                        <Button size="sm" variant="flat" color="danger" isIconOnly aria-label="Delete" onPress={() => { setToDelete(t); deleteConfirm.onOpen(); }}><Trash2 size={14} /></Button>
                                    </>
                                ) : (
                                    <Button size="sm" variant="flat" startContent={<Eye size={14} />} onPress={() => { setPreview(t); previewModal.onOpen(); }}>View</Button>
                                )}
                            </TemplateCard>
                        ))}
                    </div>
                )}
            </section>

            {data.library.length > 0 && (
            <section className="flex flex-col gap-3">
                <h2 className="font-semibold">Built-in templates</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {data.library.map((t) => (
                        <TemplateCard key={t.id} t={t}>
                            <Button size="sm" variant="flat" startContent={<Eye size={14} />} onPress={() => { setPreview(t); previewModal.onOpen(); }}>View</Button>
                            {isOwner && <Button size="sm" variant="flat" color="primary" startContent={<Copy size={14} />} onPress={() => copyTemplate(t.id)}>Copy & edit</Button>}
                        </TemplateCard>
                    ))}
                </div>
            </section>
            )}

            {/* preview */}
            <Modal isOpen={previewModal.isOpen} onOpenChange={previewModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {() => preview && (
                        <>
                            <ModalHeader>{preview.name}</ModalHeader>
                            <ModalBody className="pb-6">
                                <ol className="flex flex-col gap-3">
                                    {preview.steps.map((s: Step, i: number) => (
                                        <li key={i} className="rounded-xl border border-default-200 p-3">
                                            <div className="font-medium">{i + 1}. {s.title}{s.due_in_days !== null && s.due_in_days !== undefined && <span className="text-xs text-default-500 font-normal"> · due day {s.due_in_days}</span>}</div>
                                            {s.description && <div className="text-xs text-default-500">{s.description}</div>}
                                            <ul className="mt-2 space-y-1">
                                                {s.questions.map((q, qi) => (
                                                    <li key={qi} className="text-sm flex items-center gap-2">
                                                        {q.type === "file_selector" ? <Upload size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}{q.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ol>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* editor */}
            <Modal isOpen={editor.isOpen} onOpenChange={editor.onOpenChange} size="4xl" scrollBehavior="inside" isDismissable={false}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{draft.id ? "Edit template" : "New template"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <FormField label="Template name *" className="sm:col-span-3"><Input aria-label="Template name" value={draft.name} onValueChange={(v) => setDraft({ ...draft, name: v })} /></FormField>
                                    <FormField label="Country"><Input aria-label="Country" placeholder="e.g. Canada" value={draft.country} onValueChange={(v) => setDraft({ ...draft, country: v })} /></FormField>
                                    <FormField label="Visa type"><Input aria-label="Visa type" placeholder="e.g. Student Visa" value={draft.visa_type} onValueChange={(v) => setDraft({ ...draft, visa_type: v })} /></FormField>
                                    <FormField label="Short description"><Input aria-label="Description" value={draft.description} onValueChange={(v) => setDraft({ ...draft, description: v })} /></FormField>
                                </div>

                                <div className="flex flex-col gap-3 mt-2">
                                    {draft.steps.map((step, si) => (
                                        <Card key={si} shadow="none" className="border border-default-200">
                                            <CardBody className="gap-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="mt-2 text-sm font-semibold w-6 shrink-0">{si + 1}.</span>
                                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <Input aria-label="Step title" placeholder="Step title, e.g. Offer letter" value={step.title} onValueChange={(v) => setStep(si, { title: v })} />
                                                        <Input aria-label="Step description" placeholder="Note for the student (optional)" value={step.description || ""} onValueChange={(v) => setStep(si, { description: v })} />
                                                        <Input aria-label="Due after days" type="number" min={0} placeholder="Due after (days from start) - optional" value={step.due_in_days === null || step.due_in_days === undefined ? "" : String(step.due_in_days)} onValueChange={(v) => setStep(si, { due_in_days: v === "" ? null : v })} className="sm:col-span-2" />
                                                    </div>
                                                    <div className="flex shrink-0">
                                                        <Button isIconOnly size="sm" variant="light" aria-label="Move up" isDisabled={si === 0} onPress={() => moveStep(si, -1)}><ArrowUp size={16} /></Button>
                                                        <Button isIconOnly size="sm" variant="light" aria-label="Move down" isDisabled={si === draft.steps.length - 1} onPress={() => moveStep(si, 1)}><ArrowDown size={16} /></Button>
                                                        <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Remove step" onPress={() => removeStep(si)}><Trash2 size={16} /></Button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:pl-8">
                                                    {step.questions.map((q, qi) => (
                                                        <div key={qi} className="flex flex-col sm:flex-row gap-2">
                                                            <Input size="sm" aria-label="Item" placeholder="e.g. Bank statement - last 6 months" value={q.text} onValueChange={(v) => setQuestion(si, qi, { text: v })} />
                                                            <div className="flex gap-2">
                                                                <Select size="sm" aria-label="Type" className="sm:w-56" selectedKeys={[q.type]} onChange={(e) => e.target.value && setQuestion(si, qi, { type: e.target.value as Question["type"] })}>
                                                                    {QUESTION_TYPES.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}
                                                                </Select>
                                                                <Button isIconOnly size="sm" variant="light" aria-label="Remove item" onPress={() => removeQuestion(si, qi)}><X size={16} /></Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <Button size="sm" variant="light" className="self-start" startContent={<Plus size={14} />} onPress={() => addQuestion(si)}>Add item</Button>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                    <Button variant="flat" startContent={<Plus size={16} />} onPress={addStep} className="self-start">Add step</Button>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => save(onClose)}>Save template</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <CommonConfirmation
                isOpen={deleteConfirm.isOpen}
                onOpenChange={deleteConfirm.onOpenChange}
                title={`Delete "${toDelete?.name}"? Cases already created from it are not changed.`}
                nagativeTitle="Cancel"
                positiveTitle="Delete"
                handleSubmit={async () => {
                    deleteConfirm.onClose();
                    if (toDelete) {
                        const { success } = await commonPostAPICall({}, `crm/visa_templates/${toDelete.id}/delete`, true);
                        if (success) load();
                    }
                    setToDelete(null);
                }}
            />
        </div>
    );
};

export default VisaTemplates;
