import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Button, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, SelectSection, Spinner } from "@heroui/react";
import { CheckCircle2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import FormField from "./FormField";
import CountrySelectWithFlag from "./CountrySelectWithFlag";
import LeadDocChecklist from "./LeadDocChecklist";
import PortalInvitePanel from "./PortalInvitePanel";
import { summarizeDocChecklist, templateCountryMatches } from "./crmShared";

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    lead: any;
    /** Optional checklist summary from lead details API */
    docChecklist?: any;
    team?: any[];
    canAssign?: boolean;
    onConverted: () => void;
}

const VISA_TYPES = ["Student Visa", "Work Visa", "Tourist Visa", "PR / Immigration", "Business Visa", "Dependent Visa", "Other"];

const ConvertLeadModal = ({ isOpen, onOpenChange, lead, docChecklist, team = [], canAssign = false, onConverted }: Props) => {
    const navigate = useNavigate();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [templates, setTemplates] = useState<{ agency: any[]; library: any[] }>({ agency: [], library: [] });
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [country, setCountry] = useState("");
    const [intake, setIntake] = useState("");
    const [visaType, setVisaType] = useState("");
    const [course, setCourse] = useState("");
    const [university, setUniversity] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [checklist, setChecklist] = useState(() => summarizeDocChecklist(lead?.doc_checklist));
    const [checklistAck, setChecklistAck] = useState(false);

    useEffect(() => {
        if (!isOpen || !lead) return;
        setResult(null);
        setChecklistAck(false);
        setCountry(lead.interested_country || "");
        setIntake(lead.intake || "");
        setVisaType(lead.visa_type || "");
        setCourse(lead.interested_course || "");
        setUniversity("");
        setAssignedTo(lead.assigned_to ? String(lead.assigned_to) : "");
        setTemplateId("");
        setChecklist(docChecklist?.items ? docChecklist : summarizeDocChecklist(lead.doc_checklist));
        (async () => {
            setLoadingTemplates(true);
            const { success, data } = await commonGetAPICalls("/crm/visa_templates");
            if (success) setTemplates({ agency: data?.agency || [], library: data?.library || [] });
            setLoadingTemplates(false);
        })();
    }, [isOpen, lead?.uuid, docChecklist]);

    const suggestedTemplate = country && !templateId
        ? [...templates.agency, ...templates.library].find((t) => templateCountryMatches(t.country, country))
        : null;

    const missingDocs = !isOwner && !checklist.complete;

    const convert = async (ack = checklistAck) => {
        if (!country.trim()) {
            ErrorToast("Please select the visa country");
            return;
        }
        if (missingDocs && !ack) {
            ErrorToast("Tick the box to convert with missing documents, or complete the checklist on the lead first");
            return;
        }
        setSaving(true);
        const { success, data } = await commonPostAPICall({
            country: country.trim(),
            intake: intake.trim(),
            visa_type: visaType,
            course: course.trim(),
            university: university.trim(),
            template_id: templateId || null,
            assigned_to: canAssign && assignedTo ? Number(assignedTo) : undefined,
            checklist_ack: isOwner || missingDocs ? true : undefined,
        }, `crm/leads/${lead.uuid}/convert`, false);
        setSaving(false);
        if (!success) return;
        if (data?.needs_checklist_ack) {
            if (data.doc_checklist) setChecklist(data.doc_checklist);
            setChecklistAck(false);
            return;
        }
        if (data?.invite_email?.sent) SuccessToast("Visa case created — student login emailed");
        else if (data?.login_code) SuccessToast("Visa case created — share login code 111111 with the student");
        else if (data?.invite_email?.reason) SuccessToast(`Visa case created. Invite email: ${data.invite_email.reason}`);
        else SuccessToast("Lead converted to a visa case");
        setResult(data);
        onConverted();
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="outside" isDismissable={!saving}>
            <ModalContent>
                {(onClose) => result ? (
                    <>
                        <ModalHeader className="flex items-center gap-2 text-success"><CheckCircle2 size={22} /> Visa case created</ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-default-600">
                                {result.studentCreated ? "A student account was created" : "The existing student account was used"}
                                {result.stepCount ? ` and ${result.stepCount} steps with ${result.questionCount} items were added to the case.` : "."}
                                {result.invite_email?.sent
                                    ? " Student portal login (mobile + 6-digit code) was emailed automatically."
                                    : result.login_code
                                      ? " No email on file — the student uses the default login code below (they set a personal passcode on first login)."
                                      : " Invite the student to the portal so they can upload documents:"}
                            </p>
                            {result.invite_email?.sent && result.invite_email?.reason === undefined && (
                                <p className="text-sm text-success">Invite email sent{result.invite?.email ? ` to ${result.invite.email}` : ""}.</p>
                            )}
                            {!result.invite_email?.sent && result.invite_email?.reason && (
                                <p className="text-sm text-warning">{result.invite_email.reason}</p>
                            )}
                            <PortalInvitePanel invite={result.invite} leadUuid={lead?.uuid} />
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>Close</Button>
                            <Button color="primary" onPress={() => { onClose(); navigate(`/leads/progress/${result.caseId}`); }}>Open visa case</Button>
                        </ModalFooter>
                    </>
                ) : (
                    <>
                        <ModalHeader>Convert to visa case</ModalHeader>
                        <ModalBody className="gap-4">
                            <p className="text-sm text-default-500">
                                Creates the student, opens a visa case under <b>Visa Processing</b>, and applies the template you choose.
                            </p>

                            {!isOwner && (
                                <>
                                    <LeadDocChecklist value={checklist} readOnly compact />
                                    {missingDocs && (
                                        <Checkbox isSelected={checklistAck} onValueChange={setChecklistAck} size="sm" className="items-start">
                                            <span className="text-sm">
                                                I understand {checklist.missing.length} document{checklist.missing.length === 1 ? " is" : "s are"} still missing
                                                ({checklist.missing.map((m: any) => m.label).slice(0, 3).join(", ")}
                                                {checklist.missing.length > 3 ? "…" : ""}) and want to convert anyway.
                                            </span>
                                        </Checkbox>
                                    )}
                                </>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormField label="Visa country *">
                                    <CountrySelectWithFlag
                                        aria-label="Visa country"
                                        placeholder="Select visa country"
                                        value={country}
                                        onChange={setCountry}
                                    />
                                </FormField>
                                <FormField label="Visa type">
                                    <Select
                                        aria-label="Visa type"
                                        placeholder="Select visa type"
                                        selectedKeys={visaType ? [visaType] : []}
                                        onSelectionChange={(keys) => {
                                            const v = Array.from(keys)[0];
                                            setVisaType(v ? String(v) : "");
                                        }}
                                    >
                                        {(visaType && !VISA_TYPES.includes(visaType) ? [visaType, ...VISA_TYPES] : VISA_TYPES).map((v) => (
                                            <SelectItem key={v}>{v}</SelectItem>
                                        ))}
                                    </Select>
                                </FormField>
                                <FormField label="Intake">
                                    <Input aria-label="Intake" placeholder="e.g. Sep 2026" value={intake} onValueChange={setIntake} />
                                </FormField>
                                <FormField label="Course / program">
                                    <Input aria-label="Course" value={course} onValueChange={setCourse} />
                                </FormField>
                                <FormField label="University / college" className="sm:col-span-2">
                                    <Input aria-label="University" value={university} onValueChange={setUniversity} />
                                </FormField>
                                {canAssign && team.length > 0 && (
                                    <FormField label="Case handled by" className="sm:col-span-2">
                                        <Select
                                            aria-label="Case handled by"
                                            placeholder="Select team member"
                                            selectedKeys={assignedTo ? [assignedTo] : []}
                                            onSelectionChange={(keys) => {
                                                const v = Array.from(keys)[0];
                                                setAssignedTo(v ? String(v) : "");
                                            }}
                                        >
                                            {team.map((m: any) => (
                                                <SelectItem key={String(m.id)}>{m.username || `#${m.id}`}</SelectItem>
                                            ))}
                                        </Select>
                                    </FormField>
                                )}
                                <FormField label="Visa process template" className="sm:col-span-2">
                                    <p className="text-xs text-default-500 -mt-0.5 mb-1">
                                        {suggestedTemplate
                                            ? `Suggested for ${country}: ${suggestedTemplate.name} — pick it below if you want the full checklist on this case.`
                                            : "Optional. Leave empty and add steps later from the visa case page."}
                                    </p>
                                    {loadingTemplates ? <Spinner size="sm" /> : (
                                        <Select
                                            aria-label="Template"
                                            placeholder="No template (add steps later)"
                                            selectedKeys={templateId ? [templateId] : []}
                                            onSelectionChange={(keys) => {
                                                const v = Array.from(keys)[0];
                                                setTemplateId(v ? String(v) : "");
                                            }}
                                        >
                                            {[
                                                ...(templates.agency.length ? [
                                                    <SelectSection key="agency" title="My templates">
                                                        {templates.agency.map((t) => (
                                                            <SelectItem key={t.id} description={`${t.step_count} steps · ${t.question_count} items`}>{t.name}</SelectItem>
                                                        ))}
                                                    </SelectSection>,
                                                ] : []),
                                                ...(templates.library.length ? [
                                                    <SelectSection key="library" title="Built-in templates">
                                                        {templates.library.map((t) => (
                                                            <SelectItem key={t.id} description={`${t.step_count} steps · ${t.question_count} items`}>{t.name}</SelectItem>
                                                        ))}
                                                    </SelectSection>,
                                                ] : []),
                                            ]}
                                        </Select>
                                    )}
                                </FormField>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>Cancel</Button>
                            <Button
                                color="primary"
                                isLoading={saving}
                                isDisabled={missingDocs && !checklistAck}
                                onPress={() => convert(checklistAck)}
                            >
                                {missingDocs ? "Convert anyway" : "Convert"}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default ConvertLeadModal;
