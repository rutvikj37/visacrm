import { BranchMoveSelect } from "@/modules/AgentAdmin/Branches/branchShared";
import CaseHistoryButton from "@/modules/AgentAdmin/Activity/CaseHistoryButton";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, SelectSection, useDisclosure,
} from "@heroui/react";
import { CalendarClock, CheckCircle2, IndianRupee, KanbanSquare, Plus, RotateCcw, XCircle, Ban } from "lucide-react";
import InvoiceFormModal from "@/modules/AgentAdmin/Fees/InvoiceFormModal";
import CountrySelectWithFlag from "@/modules/AgentAdmin/Crm/CountrySelectWithFlag";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { CASE_STAGES, fmtShortDate, isOverdue, stageLabel } from "./caseShared";

const Field = ({ label, children }: any) => (
    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-default-600">{label}</span>{children}</div>
);

/** Case header for the visa progress page: who, where in the journey, assignment, outcomes. */
const CaseToolbar = ({ caseId, reloadKey }: { caseId: string | number; reloadKey?: number }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const isManager = isOwner || teamRole === "branch_manager";
    const [info, setInfo] = useState<any>(null);
    const [team, setTeam] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const addModal = useDisclosure();
    const invoiceModal = useDisclosure();
    const canBill = isOwner || teamRole === "accounts";
    const [templates, setTemplates] = useState<{ agency: any[]; library: any[] }>({ agency: [], library: [] });
    const [form, setForm] = useState({ country: "", university: "", course: "", intake: "", template_id: "" });

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/cases/${caseId}`);
        if (success) setInfo(data);
    }, [caseId]);
    useEffect(() => { load(); }, [load, reloadKey]);
    useEffect(() => {
        if (!isManager) return;
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/team");
            if (success) setTeam(data || []);
        })();
    }, [isManager]);

    if (!info) return null;

    const post = async (url: string, body: object, toast = true) => {
        setBusy(true);
        const { success } = await commonPostAPICall(body, url, toast);
        setBusy(false);
        if (success) load();
        return success;
    };

    const openAdd = async () => {
        setForm({ country: "", university: "", course: info.course || "", intake: info.intake || "", template_id: "" });
        const { success, data } = await commonGetAPICalls("/crm/visa_templates");
        if (success) setTemplates({ agency: data?.agency || [], library: data?.library || [] });
        addModal.onOpen();
    };
    const createApplication = async (close: () => void) => {
        if (!form.country.trim()) return ErrorToast("Please select the country");
        setBusy(true);
        const { success, data } = await commonPostAPICall({ ...form, template_id: form.template_id || null }, `crm/cases/${caseId}/add_application`, true);
        setBusy(false);
        if (success) {
            close();
            navigate(`/leads/progress/${data.id}`);
        }
    };

    const decided = info.status !== "visa_progress";
    const result = info.status === "visa_completed" ? { label: "Visa approved", color: "success" as const }
        : info.status === "visa_rejected" ? { label: "Visa rejected", color: "danger" as const }
            : decided ? { label: "Withdrawn", color: "default" as const } : null;
    const at = Math.max(0, CASE_STAGES.findIndex((x) => x.key === (info.stage || "documents")));

    return (
        <Card shadow="sm">
            <CardBody className="gap-4">
                {/* 1. Identity */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold text-foreground">{info.student?.username || "Student"}</h1>
                            {result && <Chip size="sm" variant="flat" color={result.color}>{result.label}</Chip>}
                        </div>
                        <p className="text-sm text-default-500 mt-0.5">
                            {[info.country, info.university, info.course, info.intake].filter(Boolean).join(" · ") || "No application details yet"}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <CaseHistoryButton caseId={caseId} />
                        <Button size="sm" variant="light" startContent={<KanbanSquare size={14} />} onPress={() => navigate("/cases/board")}>
                            Case board
                        </Button>
                    </div>
                </div>

                {/* 2. Journey — pick a stage (chips on mobile, rail on desktop) */}
                <div>
                    <p className="text-xs font-medium text-default-600 mb-2">Case stage</p>
                    {/* Mobile: wrap chips — no forced horizontal scroll */}
                    <div className="flex flex-wrap gap-1.5 sm:hidden">
                        {CASE_STAGES.map((st, i) => {
                            const done = info.status === "visa_completed" || i < at;
                            const current = !decided && i === at;
                            return (
                                <button
                                    key={st.key}
                                    type="button"
                                    disabled={decided || busy || current}
                                    onClick={() => window.confirm(`Move this case to "${st.label}"?`) && post(`crm/cases/${caseId}/stage`, { stage: st.key })}
                                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                                        current
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : done
                                                ? "border-primary/40 bg-primary-50 text-primary"
                                                : "border-default-200 text-default-500"
                                    }`}
                                >
                                    {st.label}
                                </button>
                            );
                        })}
                    </div>
                    {/* Desktop: stage rail */}
                    <div className="hidden sm:flex items-start w-full">
                        {CASE_STAGES.map((st, i) => {
                            const done = info.status === "visa_completed" || i < at;
                            const current = !decided && i === at;
                            return (
                                <div key={st.key} className="flex items-start flex-1 last:flex-none min-w-0">
                                    <button type="button" disabled={decided || busy || current}
                                        onClick={() => window.confirm(`Move this case to "${st.label}"?`) && post(`crm/cases/${caseId}/stage`, { stage: st.key })}
                                        className="flex flex-col items-center gap-1 group w-full max-w-[4.5rem] shrink-0" title={decided ? st.label : `Move to ${st.label}`}>
                                        <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold border-2 transition ${done ? "bg-primary border-primary text-primary-foreground" : current ? "border-primary text-primary bg-primary-50" : "border-default-300 text-default-400 group-hover:border-primary/60"}`}>
                                            {done ? <CheckCircle2 size={14} /> : i + 1}
                                        </span>
                                        <span className={`text-[11px] text-center leading-tight ${current ? "text-primary font-semibold" : done ? "text-default-700" : "text-default-400"}`}>{st.label}</span>
                                    </button>
                                    {i < CASE_STAGES.length - 1 && <span className={`h-0.5 flex-1 mt-3.5 min-w-[8px] ${i < at || info.status === "visa_completed" ? "bg-primary" : "bg-default-200"}`} />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Assignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Handled by">
                        {isManager ? (
                            <Select aria-label="Handled by" size="sm" isDisabled={busy} selectedKeys={[info.assignee ? String(info.assignee.id) : "none"]}
                                onChange={(e) => e.target.value && post(`crm/cases/${caseId}/assign`, { agent_id: e.target.value === "none" ? null : Number(e.target.value) })}>
                                {[<SelectItem key="none">Unassigned</SelectItem>, ...team.map((m) => <SelectItem key={String(m.id)}>{m.username}</SelectItem>)]}
                            </Select>
                        ) : <span className="text-sm py-1.5">{info.assignee?.name || "Unassigned"}</span>}
                    </Field>
                    <BranchMoveSelect label="Branch" value={info.branch?.id} isDisabled={busy} onMove={(branchId) => post(`crm/cases/${caseId}/branch`, { branch_id: branchId })} />
                </div>

                {/* 4. Outcomes & billing */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-default-100">
                    {decided ? (
                        <Button size="sm" variant="flat" startContent={<RotateCcw size={14} />} isLoading={busy} onPress={() => post(`crm/cases/${caseId}/outcome`, { outcome: "reopen" })}>Reopen case</Button>
                    ) : (
                        <>
                            <Button size="sm" color="success" variant="flat" startContent={<CheckCircle2 size={14} />} isDisabled={busy}
                                onPress={() => post(`crm/cases/${caseId}/outcome`, { outcome: "approved" })}>Visa approved</Button>
                            <Button size="sm" color="danger" variant="flat" startContent={<XCircle size={14} />} isDisabled={busy}
                                onPress={() => { const note = window.prompt("Reason for rejection (optional)") ?? undefined; if (note !== undefined) post(`crm/cases/${caseId}/outcome`, { outcome: "rejected", note }); }}>Rejected</Button>
                            <Button size="sm" variant="flat" startContent={<Ban size={14} />} isDisabled={busy}
                                onPress={() => window.confirm("Mark this case as withdrawn?") && post(`crm/cases/${caseId}/outcome`, { outcome: "withdrawn" })}>Withdrawn</Button>
                        </>
                    )}
                    <span className="hidden sm:inline w-px self-stretch bg-default-200 mx-1" aria-hidden />
                    <Button size="sm" color="primary" variant="flat" startContent={<Plus size={14} />} onPress={openAdd}>Another application</Button>
                    {canBill && <Button size="sm" variant="flat" startContent={<IndianRupee size={14} />} onPress={invoiceModal.onOpen}>New invoice</Button>}
                    <Button size="sm" variant="light" onPress={() => navigate(`/fees?case=${caseId}`)}>Fees</Button>
                </div>

                {info.other_applications?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-default-500">Other applications:</span>
                        {info.other_applications.map((a: any) => (
                            <Chip key={a.id} size="sm" variant="flat" className="cursor-pointer" onClick={() => navigate(`/leads/progress/${a.id}`)}>
                                {[a.country, a.university].filter(Boolean).join(" · ") || `Case #${a.id}`} - {a.status === "visa_progress" ? stageLabel(a.stage || "documents") : a.status === "visa_completed" ? "Approved" : a.status === "visa_rejected" ? "Rejected" : "Closed"}
                            </Chip>
                        ))}
                    </div>
                )}
            </CardBody>

            <InvoiceFormModal isOpen={invoiceModal.isOpen} onOpenChange={invoiceModal.onOpenChange} caseId={caseId} studentName={info.student?.username} onCreated={(invId) => navigate(`/fees/${invId}`)} />
            <Modal isOpen={addModal.isOpen} onOpenChange={addModal.onOpenChange} size="lg" scrollBehavior="outside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Another application for {info.student?.username || "this student"}</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">Opens a separate case (another country or university) for the same student, with its own steps.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Country *">
                                        <CountrySelectWithFlag
                                            aria-label="Country"
                                            placeholder="Select country"
                                            value={form.country}
                                            onChange={(v) => setForm({ ...form, country: v })}
                                        />
                                    </Field>
                                    <Field label="University / college"><Input aria-label="University" value={form.university} onValueChange={(v) => setForm({ ...form, university: v })} /></Field>
                                    <Field label="Course"><Input aria-label="Course" value={form.course} onValueChange={(v) => setForm({ ...form, course: v })} /></Field>
                                    <Field label="Intake"><Input aria-label="Intake" placeholder="e.g. Sep 2027" value={form.intake} onValueChange={(v) => setForm({ ...form, intake: v })} /></Field>
                                    <div className="sm:col-span-2">
                                        <Field label="Visa process template">
                                            <Select aria-label="Template" placeholder="No template (add steps later)" selectedKeys={form.template_id ? [form.template_id] : []} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                                                {[
                                                    ...(templates.agency.length ? [<SelectSection key="a" title="My templates">{templates.agency.map((t) => <SelectItem key={t.id}>{t.name}</SelectItem>)}</SelectSection>] : []),
                                                    <SelectSection key="l" title="Built-in templates">{templates.library.map((t) => <SelectItem key={t.id}>{t.name}</SelectItem>)}</SelectSection>,
                                                ]}
                                            </Select>
                                        </Field>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} onPress={() => createApplication(onClose)}>Create application</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </Card>
    );
};

/** Due date for one step (shown above the step's documents). */
export const StepDueDate = ({ step }: { step: any }) => {
    const { commonPostAPICall } = useApiCallUtils();
    const queryClient = useQueryClient();
    const [value, setValue] = useState(step?.due_date ? String(step.due_date).slice(0, 10) : "");
    useEffect(() => { setValue(step?.due_date ? String(step.due_date).slice(0, 10) : ""); }, [step?.id, step?.due_date]);
    if (!step?.id) return null;
    const save = async (v: string) => {
        setValue(v);
        const { success } = await commonPostAPICall({ due_date: v || null }, `crm/cases/steps/${step.id}/due`, true);
        if (success) queryClient.invalidateQueries({ queryKey: ["steps"] });
    };
    const overdue = isOverdue(step.due_date) && Number(step.step_status) !== 1;
    return (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${overdue ? "bg-danger-50 text-danger-700" : "bg-default-100"}`}>
            <CalendarClock size={16} />
            <span>{overdue ? `Overdue since ${fmtShortDate(step.due_date)}` : step.due_date ? `Due ${fmtShortDate(step.due_date)}` : "No due date"}</span>
            <Input aria-label="Step due date" type="date" size="sm" className="w-44 ml-auto" value={value} onValueChange={save} />
            {value && <Button size="sm" variant="light" onPress={() => save("")}>Clear</Button>}
        </div>
    );
};

export default CaseToolbar;
