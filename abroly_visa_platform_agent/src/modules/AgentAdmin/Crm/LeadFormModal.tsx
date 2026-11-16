import { useBranchAccess, useBranches } from "@/modules/AgentAdmin/Branches/branchShared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from "@heroui/react";
import FormField from "./FormField";
import CountrySelectWithFlag from "./CountrySelectWithFlag";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { asArray, formatPhone, statusMeta } from "./crmShared";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** lead to edit; empty = create a new lead */
    lead?: any;
    team?: any[];
    canAssign?: boolean;
    onSaved: (lead?: any) => void;
}

const emptyForm = {
    name: "",
    country_code: "+91",
    phone_number: "",
    email: "",
    city: "",
    interested_country: "",
    interested_course: "",
    visa_type: "",
    intake: "",
    campaign: "",
    message: "",
    tags: "",
    assigned_to: "",
    branch_id: "",
};

const VISA_TYPES = ["Student Visa", "Work Visa", "Tourist Visa", "PR / Immigration", "Business Visa", "Dependent Visa", "Other"];

type DupState = {
    existing: any;
    match: string;
    merge_hint?: string;
} | null;

const LeadFormModal = ({ isOpen, onOpenChange, lead, team = [], canAssign = false, onSaved }: Props) => {
    const navigate = useNavigate();
    const { commonPostAPICall } = useApiCallUtils();
    const [form, setForm] = useState({ ...emptyForm });
    const branchList = useBranches();
    const ownerBranches = useBranchAccess();
    const [saving, setSaving] = useState(false);
    const [dup, setDup] = useState<DupState>(null);
    const isEdit = Boolean(lead?.uuid);

    useEffect(() => {
        if (!isOpen) return;
        setDup(null);
        if (lead) {
            setForm({
                name: lead.name || "",
                country_code: lead.country_code || "+91",
                phone_number: lead.phone_number || "",
                email: lead.email || "",
                city: lead.city || "",
                interested_country: lead.interested_country || "",
                interested_course: lead.interested_course || "",
                visa_type: lead.visa_type || "",
                intake: lead.intake || "",
                campaign: lead.campaign || "",
                message: lead.message || "",
                tags: asArray(lead.tags).join(", "),
                assigned_to: lead.assigned_to ? String(lead.assigned_to) : "",
                branch_id: "",
            });
        } else {
            setForm({ ...emptyForm });
        }
    }, [isOpen, lead]);

    const set = (key: keyof typeof emptyForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

    const buildPayload = () => {
        const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
        const payload: any = {
            name: form.name,
            email: form.email,
            city: form.city,
            interested_country: form.interested_country,
            interested_course: form.interested_course,
            visa_type: form.visa_type,
            intake: form.intake,
            campaign: form.campaign,
            message: form.message,
            tags,
        };
        if (form.phone_number.trim()) {
            payload.phone_number = form.phone_number;
            payload.country_code = form.country_code;
        }
        return payload;
    };

    const submit = async (close: () => void, opts?: { merge?: boolean; confirm?: boolean }) => {
        if (!form.phone_number.trim() && !form.email.trim()) {
            ErrorToast("Please enter a phone number or email");
            return;
        }
        setSaving(true);
        const payload: any = buildPayload();
        if (opts?.merge) payload.merge = true;
        if (opts?.confirm) payload.confirm_duplicate = true;

        let result;
        if (isEdit) {
            result = await commonPostAPICall(payload, `crm/leads/${lead.uuid}/update`, false);
        } else {
            if (canAssign && form.assigned_to) payload.assigned_to = Number(form.assigned_to);
            if (form.branch_id) payload.branch_id = Number(form.branch_id);
            result = await commonPostAPICall(payload, "crm/leads", false);
        }
        setSaving(false);

        if (!result.success) {
            ErrorToast(result.message || "Could not save");
            return;
        }
        if (result.data?.needs_confirm && result.data?.existing) {
            setDup({
                existing: result.data.existing,
                match: result.data.match || "contact",
                merge_hint: result.data.merge_hint,
            });
            return;
        }
        setDup(null);
        if (result.message) SuccessToast(result.message);
        close();
        onSaved(result.data?.lead);
    };

    const openExisting = (close: () => void) => {
        const uuid = dup?.existing?.uuid;
        close();
        if (uuid) navigate(`/crm/leads/${uuid}`);
    };

    const matchLabel = dup?.match === "both" ? "phone and email" : dup?.match || "contact details";

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="outside">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>{isEdit ? "Edit lead" : "Add lead"}</ModalHeader>
                        <ModalBody>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormField label="Full name" className="sm:col-span-2"><Input aria-label="Full name" value={form.name} onValueChange={set("name")} /></FormField>
                                <div className="flex gap-2">
                                    <FormField label="Code" className="w-24 shrink-0"><Input aria-label="Code" value={form.country_code} onValueChange={set("country_code")} /></FormField>
                                    <FormField label="Phone / WhatsApp"><Input aria-label="Phone / WhatsApp" value={form.phone_number} {...phoneInputProps} onValueChange={(v) => set("phone_number")(toPhoneDigits(v))} /></FormField>
                                </div>
                                <FormField label="Email"><Input aria-label="Email" type="email" value={form.email} onValueChange={set("email")} /></FormField>
                                <FormField label="Interested country">
                                    <CountrySelectWithFlag
                                        aria-label="Interested country"
                                        placeholder="Select country"
                                        value={form.interested_country}
                                        onChange={set("interested_country")}
                                    />
                                </FormField>
                                <FormField label="Course / service"><Input aria-label="Course / service" placeholder="e.g. MBA" value={form.interested_course} onValueChange={set("interested_course")} /></FormField>
                                <FormField label="Visa type"><Select
                                    aria-label="Visa type"
                                    selectedKeys={form.visa_type ? [form.visa_type] : []}
                                    onChange={(e) => set("visa_type")(e.target.value)}
                                >
                                    {(form.visa_type && !VISA_TYPES.includes(form.visa_type) ? [form.visa_type, ...VISA_TYPES] : VISA_TYPES).map((v) => (
                                        <SelectItem key={v}>{v}</SelectItem>
                                    ))}
                                </Select></FormField>
                                <FormField label="Intake"><Input aria-label="Intake" placeholder="e.g. Sep 2026" value={form.intake} onValueChange={set("intake")} /></FormField>
                                <FormField label="City"><Input aria-label="City" value={form.city} onValueChange={set("city")} /></FormField>
                                <FormField label="Campaign"><Input aria-label="Campaign" value={form.campaign} onValueChange={set("campaign")} /></FormField>
                                <FormField label="Tags"><Input aria-label="Tags" placeholder="hot, ielts (comma separated)" value={form.tags} onValueChange={set("tags")} /></FormField>
                                {!isEdit && ownerBranches.isOwner && branchList.length > 0 && (
                                    <FormField label="Branch"><Select
                                        aria-label="Branch"
                                        placeholder="Decide automatically (city / assignee)"
                                        selectedKeys={form.branch_id ? [form.branch_id] : []}
                                        onChange={(e) => set("branch_id")(e.target.value)}
                                    >
                                        {branchList.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>)}
                                    </Select></FormField>
                                )}
                                {!isEdit && canAssign && team.length > 0 && (
                                    <FormField label="Assign to"><Select
                                        aria-label="Assign to"
                                        selectedKeys={form.assigned_to ? [form.assigned_to] : []}
                                        onChange={(e) => set("assigned_to")(e.target.value)}
                                    >
                                        {team.map((m: any) => (
                                            <SelectItem key={String(m.id)}>{m.username || `#${m.id}`}</SelectItem>
                                        ))}
                                    </Select></FormField>
                                )}
                                <FormField label="Message / requirement" className="sm:col-span-2"><Textarea aria-label="Message / requirement" value={form.message} onValueChange={set("message")} minRows={2} /></FormField>
                            </div>

                            {dup && (
                                <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 mt-1">
                                    <div className="text-sm font-medium text-warning-800">
                                        Possible duplicate ({matchLabel})
                                    </div>
                                    <p className="text-sm text-default-700 mt-1">
                                        <b>{dup.existing.name || "Unnamed"}</b>
                                        {" · "}
                                        {formatPhone(dup.existing) || dup.existing.email || "no contact"}
                                        {dup.existing.status && (
                                            <> · {statusMeta(dup.existing.status).label}</>
                                        )}
                                    </p>
                                    {dup.merge_hint && <p className="text-xs text-default-500 mt-1">{dup.merge_hint}</p>}
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <Button size="sm" color="primary" variant="flat" onPress={() => openExisting(onClose)}>Open existing</Button>
                                        {!isEdit && (
                                            <Button size="sm" color="warning" variant="flat" isLoading={saving} onPress={() => submit(onClose, { merge: true })}>
                                                Merge into existing
                                            </Button>
                                        )}
                                        <Button size="sm" variant="flat" isLoading={saving} onPress={() => submit(onClose, { confirm: true })}>
                                            {isEdit ? "Save anyway" : "Create anyway"}
                                        </Button>
                                        <Button size="sm" variant="light" onPress={() => setDup(null)}>Back to edit</Button>
                                    </div>
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>Cancel</Button>
                            {!dup && (
                                <Button color="primary" isLoading={saving} onPress={() => submit(onClose)}>
                                    {isEdit ? "Save changes" : "Add lead"}
                                </Button>
                            )}
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default LeadFormModal;
