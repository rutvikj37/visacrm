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
import useModules from "@/hooks/useModules";
import { getBusinessFocus } from "@/modules/AgentAdmin/Cases/caseShared";

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** lead to edit; empty = create a new lead */
    lead?: any;
    team?: any[];
    canAssign?: boolean;
    onSaved: (lead?: any) => void;
    /** new lead: start as a visa or travel enquiry (defaults from the agency's CRM type) */
    defaultLine?: "visa" | "travel";
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
    // travel enquiry (LD-01)
    business_line: "visa",
    destinations: "",
    travel_start: "",
    travel_end: "",
    travel_month: "",
    nights: "",
    adults: "2",
    children: "0",
    child_ages: "",
    infants: "0",
    budget: "",
    hotel_category: "",
    trip_type: "",
    departure_city: "",
};

const HOTEL_CATEGORIES = [{ key: "budget", label: "Budget" }, { key: "3_star", label: "3 star" }, { key: "4_star", label: "4 star" }, { key: "5_star", label: "5 star" }, { key: "luxury", label: "Luxury" }];
const TRIP_TYPES = ["family", "honeymoon", "group", "solo", "friends", "corporate", "pilgrimage", "adventure"];

const STUDY_VISA_TYPES = ["Student Visa", "Work Visa", "Tourist Visa", "Visitor Visa", "PR / Immigration", "Business Visa", "Dependent Visa", "Other"];
// tourist & business visa agencies (Branding > what does your agency mainly do): their visas first
const TRAVEL_VISA_TYPES = ["Tourist Visa", "Visitor Visa", "Business Visa", "Transit Visa", "Student Visa", "Work Visa", "PR / Immigration", "Dependent Visa", "Other"];

type DupState = {
    existing: any;
    match: string;
    merge_hint?: string;
} | null;

const LeadFormModal = ({ isOpen, onOpenChange, lead, team = [], canAssign = false, onSaved, defaultLine }: Props) => {
    const travelFocus = getBusinessFocus() === "travel";
    const VISA_TYPES = travelFocus ? TRAVEL_VISA_TYPES : STUDY_VISA_TYPES;
    const navigate = useNavigate();
    const { crmType, has } = useModules();
    const travelOn = has("itinerary") || has("bookings");
    const visaOn = has("visa");
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
                business_line: lead.business_line || "visa",
                destinations: asArray(lead.destinations).join(", "),
                travel_start: lead.travel_start || "",
                travel_end: lead.travel_end || "",
                travel_month: lead.travel_month || "",
                nights: lead.nights != null ? String(lead.nights) : "",
                adults: lead.adults != null ? String(lead.adults) : "2",
                children: lead.children != null ? String(lead.children) : "0",
                child_ages: asArray(lead.child_ages).join(", "),
                infants: lead.infants != null ? String(lead.infants) : "0",
                // the lead record keeps the budget in paise
                budget: lead.budget != null ? String(Number(lead.budget) / 100) : "",
                hotel_category: lead.hotel_category || "",
                trip_type: lead.trip_type || "",
                departure_city: lead.departure_city || "",
            });
        } else {
            setForm({ ...emptyForm, business_line: defaultLine || (crmType === "travel" || (travelOn && !visaOn) ? "travel" : "visa") });
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
        if (form.business_line === "travel") {
            Object.assign(payload, {
                business_line: "travel",
                destinations: form.destinations.split(",").map((d) => d.trim()).filter(Boolean),
                travel_start: form.travel_start || null, travel_end: form.travel_end || null, travel_month: form.travel_month || null,
                nights: form.nights === "" ? null : Number(form.nights), adults: Number(form.adults) || 0, children: Number(form.children) || 0,
                child_ages: form.child_ages, infants: Number(form.infants) || 0, budget: form.budget === "" ? null : Number(form.budget),
                hotel_category: form.hotel_category || null, trip_type: form.trip_type || null, departure_city: form.departure_city,
            });
            // the travel form has no visa fields
            for (const k of ["interested_country", "interested_course", "visa_type", "intake"]) delete payload[k];
        } else if (isEdit && lead?.business_line === "travel") {
            payload.business_line = "visa";
        }
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
                                {travelOn && visaOn && (
                                    <div className="sm:col-span-2 flex gap-2">
                                        <Button size="sm" variant={form.business_line === "travel" ? "flat" : "solid"} color={form.business_line === "travel" ? "default" : "primary"} onPress={() => set("business_line")("visa")}>Visa enquiry</Button>
                                        <Button size="sm" variant={form.business_line === "travel" ? "solid" : "flat"} color={form.business_line === "travel" ? "primary" : "default"} onPress={() => set("business_line")("travel")}>Holiday / travel enquiry</Button>
                                    </div>
                                )}
                                <FormField label="Full name" className="sm:col-span-2"><Input aria-label="Full name" value={form.name} onValueChange={set("name")} /></FormField>
                                <div className="flex gap-2">
                                    <FormField label="Code" className="w-24 shrink-0"><Input aria-label="Code" value={form.country_code} onValueChange={set("country_code")} /></FormField>
                                    <FormField label="Phone / WhatsApp"><Input aria-label="Phone / WhatsApp" value={form.phone_number} {...phoneInputProps} onValueChange={(v) => set("phone_number")(toPhoneDigits(v))} /></FormField>
                                </div>
                                <FormField label="Email"><Input aria-label="Email" type="email" value={form.email} onValueChange={set("email")} /></FormField>
                                {form.business_line === "travel" ? (<>
                                    <FormField label="Destination(s)" className="sm:col-span-2"><Input aria-label="Destinations" placeholder="Dubai, Abu Dhabi" value={form.destinations} onValueChange={set("destinations")} /></FormField>
                                    <FormField label="Travel from"><Input aria-label="Travel from" type="date" value={form.travel_start} onValueChange={set("travel_start")} /></FormField>
                                    <FormField label="Travel to"><Input aria-label="Travel to" type="date" value={form.travel_end} onValueChange={set("travel_end")} /></FormField>
                                    <FormField label="Or month (dates not fixed)"><Input aria-label="Travel month" type="month" value={form.travel_month} onValueChange={set("travel_month")} /></FormField>
                                    <FormField label="Nights"><Input aria-label="Nights" type="number" min={0} value={form.nights} onValueChange={set("nights")} /></FormField>
                                    <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                                        <FormField label="Adults"><Input aria-label="Adults" type="number" min={0} value={form.adults} onValueChange={set("adults")} /></FormField>
                                        <FormField label="Children"><Input aria-label="Children" type="number" min={0} value={form.children} onValueChange={set("children")} /></FormField>
                                        <FormField label="Infants"><Input aria-label="Infants" type="number" min={0} value={form.infants} onValueChange={set("infants")} /></FormField>
                                    </div>
                                    {Number(form.children) > 0 && <FormField label="Children's ages"><Input aria-label="Children's ages" placeholder="6, 9" value={form.child_ages} onValueChange={set("child_ages")} /></FormField>}
                                    <FormField label="Budget ₹ (total)"><Input aria-label="Budget" type="number" min={0} value={form.budget} onValueChange={set("budget")} /></FormField>
                                    <FormField label="Hotel category"><Select aria-label="Hotel category" selectedKeys={form.hotel_category ? [form.hotel_category] : []} onChange={(e) => set("hotel_category")(e.target.value)}>
                                        {HOTEL_CATEGORIES.map((h) => <SelectItem key={h.key}>{h.label}</SelectItem>)}
                                    </Select></FormField>
                                    <FormField label="Trip type"><Select aria-label="Trip type" selectedKeys={form.trip_type ? [form.trip_type] : []} onChange={(e) => set("trip_type")(e.target.value)}>
                                        {TRIP_TYPES.map((t) => <SelectItem key={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                                    </Select></FormField>
                                    <FormField label="Departure city"><Input aria-label="Departure city" value={form.departure_city} onValueChange={set("departure_city")} /></FormField>
                                </>) : (<>
                                <FormField label="Interested country">
                                    <CountrySelectWithFlag
                                        aria-label="Interested country"
                                        placeholder="Select country"
                                        value={form.interested_country}
                                        onChange={set("interested_country")}
                                    />
                                </FormField>
                                {travelFocus
                                    ? <FormField label="Service"><Input aria-label="Service" placeholder="e.g. USA visitor visa, Dubai tour" value={form.interested_course} onValueChange={set("interested_course")} /></FormField>
                                    : <FormField label="Course / service"><Input aria-label="Course / service" placeholder="e.g. MBA" value={form.interested_course} onValueChange={set("interested_course")} /></FormField>}
                                <FormField label="Visa type"><Select
                                    aria-label="Visa type"
                                    selectedKeys={form.visa_type ? [form.visa_type] : []}
                                    onChange={(e) => set("visa_type")(e.target.value)}
                                >
                                    {(form.visa_type && !VISA_TYPES.includes(form.visa_type) ? [form.visa_type, ...VISA_TYPES] : VISA_TYPES).map((v) => (
                                        <SelectItem key={v}>{v}</SelectItem>
                                    ))}
                                </Select></FormField>
                                {travelFocus
                                    ? <FormField label="Travel month"><Input aria-label="Travel month" placeholder="e.g. Jan 2027" value={form.intake} onValueChange={set("intake")} /></FormField>
                                    : <FormField label="Intake"><Input aria-label="Intake" placeholder="e.g. Sep 2026" value={form.intake} onValueChange={set("intake")} /></FormField>}
                                </>)}
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
