import { useCallback, useEffect, useRef, useState } from "react";
import {
    Button, Card, CardBody, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Select, SelectItem, Spinner, Textarea, Tooltip, useDisclosure,
} from "@heroui/react";
import { FileText, GraduationCap, MoreVertical, Paperclip, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { fmtShortDate } from "./caseShared";

export const UNI_STATUSES = [
    { key: "shortlisted", label: "Shortlisted", color: "default" },
    { key: "applied", label: "Applied", color: "primary" },
    { key: "offer", label: "Offer received", color: "secondary" },
    { key: "conditional", label: "Conditional offer", color: "warning" },
    { key: "unconditional", label: "Unconditional offer", color: "success" },
    { key: "cas", label: "CAS / I-20 / CoE", color: "success" },
    { key: "deposit_paid", label: "Deposit paid", color: "success" },
    { key: "rejected", label: "Rejected", color: "danger" },
    { key: "withdrawn", label: "Withdrawn", color: "default" },
] as const;
export const uniStatus = (key?: string) => UNI_STATUSES.find((s) => s.key === key) || UNI_STATUSES[0];
export const CURRENCIES = ["GBP", "USD", "CAD", "AUD", "EUR", "NZD", "INR"];

const money = (amount?: number | null, currency?: string | null) => {
    if (amount === null || amount === undefined) return "";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(amount); }
    catch { return `${currency || ""} ${amount}`.trim(); }
};

const EMPTY = { university: "", course: "", campus: "", intake: "", application_ref: "", status: "shortlisted", applied_on: "", offer_on: "", currency: "", tuition_fee: "", deposit_amount: "", deposit_paid_on: "", notes: "" };

const Field = ({ label, children }: any) => (
    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-default-600">{label}</span>{children}</div>
);

/** University applications of one visa case: each with its own status, offer letters and the final choice. */
const UniversityApplications = ({ caseId, defaultIntake, defaultCourse, onChanged, onAddCommission }: {
    caseId: string | number; defaultIntake?: string | null; defaultCourse?: string | null;
    onChanged?: () => void; onAddCommission?: (app: any) => void;
}) => {
    const { commonGetAPICalls, commonPostAPICall, commonPostAPICallWithFile } = useApiCallUtils();
    const [apps, setApps] = useState<any[] | null>(null);
    const [form, setForm] = useState<any>(EMPTY);
    const [editId, setEditId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [uploadFor, setUploadFor] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const modal = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/cases/${caseId}/universities`);
        setApps(success ? data?.applications || [] : []);
    }, [caseId]);
    useEffect(() => { load(); }, [load]);

    const refresh = () => { load(); onChanged?.(); };

    const openAdd = () => {
        setEditId(null);
        setForm({ ...EMPTY, intake: defaultIntake || "", course: defaultCourse || "" });
        modal.onOpen();
    };
    const openEdit = (a: any) => {
        setEditId(a.id);
        setForm({
            ...EMPTY, ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === null || v === undefined ? "" : v])),
            tuition_fee: a.tuition_fee ?? "", deposit_amount: a.deposit_amount ?? "",
        });
        modal.onOpen();
    };

    const save = async (close: () => void) => {
        if (!form.university.trim()) return ErrorToast("Please enter the university name");
        setBusy(true);
        const body = { ...form, tuition_fee: form.tuition_fee === "" ? null : form.tuition_fee, deposit_amount: form.deposit_amount === "" ? null : form.deposit_amount };
        const { success } = editId
            ? await commonPostAPICall(body, `crm/universities/${editId}`, true)
            : await commonPostAPICall(body, `crm/cases/${caseId}/universities`, true);
        setBusy(false);
        if (success) { close(); refresh(); }
    };

    const setStatus = async (a: any, status: string) => {
        if (status === a.status) return;
        const { success } = await commonPostAPICall({ status }, `crm/universities/${a.id}`, true);
        if (success) refresh();
    };
    const markFinal = async (a: any) => {
        const { success } = await commonPostAPICall({}, `crm/universities/${a.id}/final`, true);
        if (success) refresh();
    };
    const remove = async (a: any) => {
        if (!window.confirm(`Remove ${a.university} from this case?`)) return;
        const { success } = await commonPostAPICall({}, `crm/universities/${a.id}/delete`, true);
        if (success) refresh();
    };
    const removeFile = async (a: any, index: number, name: string) => {
        if (!window.confirm(`Remove "${name}"?`)) return;
        const { success } = await commonPostAPICall({ index }, `crm/universities/${a.id}/files/remove`, true);
        if (success) load();
    };
    const pickFile = (a: any) => { setUploadFor(a.id); fileRef.current?.click(); };
    const onFiles = async (files: FileList | null) => {
        if (!files?.length || !uploadFor) return;
        const fd = new FormData();
        Array.from(files).slice(0, 3).forEach((f) => fd.append("files", f));
        setBusy(true);
        const { success } = await commonPostAPICallWithFile(fd, `crm/universities/${uploadFor}/files`, true);
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
        setUploadFor(null);
        if (success) load();
    };

    const active = (apps || []).filter((a) => !["rejected", "withdrawn"].includes(a.status)).length;
    const offers = (apps || []).filter((a) => ["offer", "conditional", "unconditional", "cas", "deposit_paid"].includes(a.status)).length;

    return (
        <Card shadow="sm">
            <CardBody className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><GraduationCap size={16} /> Universities</h2>
                        <p className="text-xs text-default-500">
                            {apps?.length ? `${apps.length} application${apps.length > 1 ? "s" : ""} · ${active} active · ${offers} with an offer` : "Track every university this student applies to"}
                        </p>
                    </div>
                    <Button size="sm" color="primary" variant="flat" startContent={<Plus size={14} />} onPress={openAdd}>Add university</Button>
                </div>

                <input ref={fileRef} type="file" multiple hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => onFiles(e.target.files)} />

                {apps === null ? (
                    <div className="py-6 grid place-items-center"><Spinner size="sm" /></div>
                ) : !apps.length ? (
                    <div className="rounded-lg border border-dashed border-default-300 px-4 py-6 text-center text-sm text-default-500">
                        No universities yet. Add the ones the student is applying to, then update each one as offers come in.
                    </div>
                ) : (
                    <ul className="flex flex-col divide-y divide-default-100">
                        {apps.map((a) => {
                            const st = uniStatus(a.status);
                            return (
                                <li key={a.id} className="py-3 flex flex-col gap-2">
                                    <div className="flex flex-wrap items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">{a.university}</span>
                                                {a.is_final && <Chip size="sm" color="warning" variant="flat" startContent={<Star size={12} className="ml-1" />}>Final choice</Chip>}
                                            </div>
                                            <p className="text-xs text-default-500">
                                                {[a.course, a.campus, a.intake, a.application_ref && `Ref ${a.application_ref}`].filter(Boolean).join(" · ") || "No course details"}
                                            </p>
                                            <p className="text-xs text-default-400 mt-0.5">
                                                {[
                                                    a.applied_on && `Applied ${fmtShortDate(a.applied_on)}`,
                                                    a.offer_on && `Offer ${fmtShortDate(a.offer_on)}`,
                                                    a.tuition_fee !== null && `Tuition ${money(a.tuition_fee, a.currency)}`,
                                                    a.deposit_amount !== null && `Deposit ${money(a.deposit_amount, a.currency)}${a.deposit_paid_on ? ` paid ${fmtShortDate(a.deposit_paid_on)}` : ""}`,
                                                ].filter(Boolean).join(" · ")}
                                            </p>
                                        </div>
                                        <Select aria-label="Application status" size="sm" className="w-48" selectedKeys={[a.status]}
                                            color={st.color as any} variant="flat"
                                            onChange={(e) => e.target.value && setStatus(a, e.target.value)}>
                                            {UNI_STATUSES.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                                        </Select>
                                        <Dropdown>
                                            <DropdownTrigger><Button isIconOnly size="sm" variant="light" aria-label="More"><MoreVertical size={16} /></Button></DropdownTrigger>
                                            <DropdownMenu aria-label="University actions" onAction={(k) => {
                                                if (k === "edit") openEdit(a);
                                                if (k === "file") pickFile(a);
                                                if (k === "final") markFinal(a);
                                                if (k === "commission") onAddCommission?.(a);
                                                if (k === "delete") remove(a);
                                            }}>
                                                <DropdownItem key="edit" startContent={<Pencil size={14} />}>Edit details</DropdownItem>
                                                <DropdownItem key="file" startContent={<Paperclip size={14} />}>Upload offer letter</DropdownItem>
                                                {!a.is_final ? <DropdownItem key="final" startContent={<Star size={14} />}>Mark as final choice</DropdownItem> : null as any}
                                                {onAddCommission ? <DropdownItem key="commission" startContent={<Plus size={14} />}>Add commission</DropdownItem> : null as any}
                                                <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 size={14} />}>Remove</DropdownItem>
                                            </DropdownMenu>
                                        </Dropdown>
                                    </div>
                                    {(a.offer_files?.length > 0 || a.commissions?.length > 0) && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {a.offer_files.map((f: any) => (
                                                <Chip key={f.index} size="sm" variant="bordered" startContent={<FileText size={12} className="ml-1" />}
                                                    endContent={<button type="button" aria-label={`Remove ${f.name}`} className="px-1" onClick={() => removeFile(a, f.index, f.name)}><X size={12} /></button>}>
                                                    <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline">{f.name}</a>
                                                </Chip>
                                            ))}
                                            {a.commissions?.map((c: any) => (
                                                <Tooltip key={c.id} content={`Commission ${c.status}`}>
                                                    <Chip size="sm" variant="flat" color={c.status === "received" ? "success" : c.status === "cancelled" ? "default" : "primary"}>
                                                        Commission {money(c.amount_expected, c.currency)} · {c.status}
                                                    </Chip>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    )}
                                    {a.notes && <p className="text-xs text-default-600 whitespace-pre-line">{a.notes}</p>}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {busy && uploadFor && <p className="text-xs text-default-500">Uploading…</p>}
            </CardBody>

            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="outside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{editId ? "Edit university application" : "Add university"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="University / college *"><Input aria-label="University" autoFocus value={form.university} onValueChange={(v) => setForm({ ...form, university: v })} /></Field>
                                    <Field label="Course"><Input aria-label="Course" value={form.course} onValueChange={(v) => setForm({ ...form, course: v })} /></Field>
                                    <Field label="Campus"><Input aria-label="Campus" value={form.campus} onValueChange={(v) => setForm({ ...form, campus: v })} /></Field>
                                    <Field label="Intake"><Input aria-label="Intake" placeholder="e.g. Sep 2027" value={form.intake} onValueChange={(v) => setForm({ ...form, intake: v })} /></Field>
                                    <Field label="Status">
                                        <Select aria-label="Status" selectedKeys={[form.status]} onChange={(e) => e.target.value && setForm({ ...form, status: e.target.value })}>
                                            {UNI_STATUSES.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                                        </Select>
                                    </Field>
                                    <Field label="Application / student ID"><Input aria-label="Application reference" value={form.application_ref} onValueChange={(v) => setForm({ ...form, application_ref: v })} /></Field>
                                    <Field label="Applied on"><Input aria-label="Applied on" type="date" value={form.applied_on} onValueChange={(v) => setForm({ ...form, applied_on: v })} /></Field>
                                    <Field label="Offer received on"><Input aria-label="Offer on" type="date" value={form.offer_on} onValueChange={(v) => setForm({ ...form, offer_on: v })} /></Field>
                                    <Field label="Currency">
                                        <Select aria-label="Currency" placeholder="Pick currency" selectedKeys={form.currency ? [form.currency] : []} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                                            {CURRENCIES.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                                        </Select>
                                    </Field>
                                    <Field label="Yearly tuition fee"><Input aria-label="Tuition fee" type="number" min={0} value={String(form.tuition_fee)} onValueChange={(v) => setForm({ ...form, tuition_fee: v })} /></Field>
                                    <Field label="Deposit amount"><Input aria-label="Deposit" type="number" min={0} value={String(form.deposit_amount)} onValueChange={(v) => setForm({ ...form, deposit_amount: v })} /></Field>
                                    <Field label="Deposit paid on"><Input aria-label="Deposit paid on" type="date" value={form.deposit_paid_on} onValueChange={(v) => setForm({ ...form, deposit_paid_on: v })} /></Field>
                                    <div className="sm:col-span-2">
                                        <Field label="Notes"><Textarea aria-label="Notes" minRows={2} value={form.notes} onValueChange={(v) => setForm({ ...form, notes: v })} /></Field>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} onPress={() => save(onClose)}>{editId ? "Save" : "Add university"}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </Card>
    );
};

export default UniversityApplications;
