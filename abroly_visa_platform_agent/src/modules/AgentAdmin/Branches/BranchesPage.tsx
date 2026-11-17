import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, Textarea, useDisclosure,
} from "@heroui/react";
import { BarChart3, Building2, Inbox, KanbanSquare, MapPin, Pencil, Plus, Receipt, Trash2, Users } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { refreshBranches } from "./branchShared";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";

const EMPTY = { id: null as number | null, name: "", city: "", routing_cities: "", address: "", phone: "", email: "", gstin: "", invoice_prefix: "" };

const Field = ({ label, hint, className = "", children }: any) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
        <span className="text-xs font-medium text-default-600">{label}</span>
        {children}
        {hint && <span className="text-xs text-default-400">{hint}</span>}
    </div>
);

const Stat = ({ icon: Icon, label, value, onPress }: any) => (
    <button type="button" onClick={onPress} className="flex items-center gap-2 rounded-lg bg-default-100 hover:bg-default-200 px-3 py-2 text-left">
        <Icon size={16} className="text-default-500 shrink-0" />
        <div><div className="text-base font-semibold leading-tight">{value}</div><div className="text-xs text-default-500">{label}</div></div>
    </button>
);

/** Owner: branch offices - details on their invoices, which cities they serve, and how much work each holds. */
const BranchesPage = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const [branches, setBranches] = useState<any[] | null>(null);
    const [form, setForm] = useState<any>(EMPTY);
    const [saving, setSaving] = useState(false);
    const modal = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/branches?stats=1");
        setBranches(success ? data?.branches || [] : []);
    }, []);
    useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

    if (!isOwner) return <div className="p-6">Only the agency owner can manage branches.</div>;
    if (!branches) return <div className="flex justify-center p-10"><Spinner /></div>;

    const open = (b?: any) => {
        setForm(b ? {
            id: b.id, name: b.name || "", city: b.city || "", routing_cities: (b.routing_cities || []).join(", "), address: b.address || "",
            phone: b.phone || "", email: b.email || "", gstin: b.gstin || "", invoice_prefix: b.invoice_prefix || "",
        } : EMPTY);
        modal.onOpen();
    };
    const save = async (close: () => void) => {
        setSaving(true);
        const { success } = await commonPostAPICall({ ...form, id: form.id || undefined }, "crm/branches", true);
        setSaving(false);
        if (success) { refreshBranches(); close(); load(); }
    };
    const remove = async (b: any) => {
        if (!window.confirm(`Remove "${b.name}"? Its team, leads and cases stay in the CRM without a branch. Invoices keep the branch they were billed from.`)) return;
        const { success } = await commonPostAPICall({}, `crm/branches/${b.id}/delete`, true);
        if (success) { refreshBranches(); load(); }
    };
    const set = (k: string) => (v: string) => setForm({ ...form, [k]: v });

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl min-w-0 w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2"><Building2 size={22} className="shrink-0" /> Branches</h1>
                    <p className="text-sm text-default-500">Each office gets its own leads, cases, team, invoices and reports.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button className="w-full sm:w-auto" variant="flat" startContent={<BarChart3 size={16} />} onPress={() => navigate("/reports?tab=branches")}>
                        <span className="sm:hidden">Compare</span>
                        <span className="hidden sm:inline">Compare branches</span>
                    </Button>
                    <Button className="w-full sm:w-auto" color="primary" startContent={<Plus size={16} />} onPress={() => open()}>Add branch</Button>
                </div>
            </div>

            <Card shadow="sm" className="bg-default-50">
                <CardBody className="text-sm text-default-600 gap-1">
                    <div className="font-medium text-default-800">How new leads find their branch</div>
                    <ol className="list-decimal pl-5 flex flex-col gap-0.5">
                        <li>The lead source belongs to a branch (set it in <button type="button" className="text-primary" onClick={() => navigate("/crm/sources")}>Lead Sources</button>).</li>
                        <li>Otherwise the lead's city matches a branch's city or one of its cities.</li>
                        <li>Otherwise it goes to the branch of the person it is assigned to.</li>
                    </ol>
                    <div>With auto-assign on, the lead then goes to the next counsellor of that branch. Team members are added to a branch in <button type="button" className="text-primary" onClick={() => navigate("/team/roles")}>Roles & branches</button>.</div>
                </CardBody>
            </Card>

            {!branches.length && (
                <Card shadow="sm"><CardBody className="items-center text-center py-10 gap-2">
                    <Building2 size={32} className="text-default-400" />
                    <div className="font-medium">No branches yet</div>
                    <div className="text-sm text-default-500">Add your offices to split leads, cases and reports by branch.</div>
                    <Button color="primary" className="mt-2" startContent={<Plus size={16} />} onPress={() => open()}>Add your first branch</Button>
                </CardBody></Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((b) => (
                    <Card key={b.id} shadow="sm">
                        <CardBody className="gap-3">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-lg truncate">{b.name}</div>
                                    <div className="text-sm text-default-500 flex items-center gap-1"><MapPin size={13} />{[b.city, ...(b.routing_cities || [])].filter(Boolean).join(", ") || "No city set"}</div>
                                </div>
                                <Button isIconOnly size="sm" variant="light" aria-label="Edit" onPress={() => open(b)}><Pencil size={15} /></Button>
                                <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Remove" onPress={() => remove(b)}><Trash2 size={15} /></Button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <Stat icon={Users} label="Team" value={b.team} onPress={() => navigate("/team/roles")} />
                                <Stat icon={Inbox} label="Open leads" value={b.open_leads} onPress={() => navigate(`/crm/leads?branch=${b.id}`)} />
                                <Stat icon={KanbanSquare} label="Open cases" value={b.open_cases} onPress={() => navigate(`/cases/board?branch=${b.id}`)} />
                                <Stat icon={Receipt} label="Fees" value="View" onPress={() => navigate(`/fees?branch=${b.id}`)} />
                            </div>
                            <div className="flex flex-wrap gap-1.5 text-xs">
                                {b.gstin ? <Chip size="sm" variant="flat">GSTIN {b.gstin}</Chip> : <Chip size="sm" variant="flat" color="default">Uses head-office GSTIN</Chip>}
                                {b.invoice_prefix ? <Chip size="sm" variant="flat">Invoices {b.invoice_prefix}-0001</Chip> : <Chip size="sm" variant="flat">Head-office invoice numbers</Chip>}
                                {b.sources > 0 && <Chip size="sm" variant="flat" color="primary">{b.sources} lead source(s)</Chip>}
                            </div>
                            {b.address && <div className="text-xs text-default-500 whitespace-pre-line">{b.address}</div>}
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{form.id ? `Edit ${form.name}` : "Add branch"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Branch name *"><Input aria-label="Branch name" placeholder="e.g. Surat office" value={form.name} onValueChange={set("name")} /></Field>
                                    <Field label="City"><Input aria-label="City" placeholder="e.g. Surat" value={form.city} onValueChange={set("city")} /></Field>
                                    <Field label="Also gets leads from these cities" hint="Comma separated, e.g. Navsari, Bharuch, Vapi" className="sm:col-span-2">
                                        <Input aria-label="Routing cities" value={form.routing_cities} onValueChange={set("routing_cities")} />
                                    </Field>
                                </div>
                                <div className="text-sm font-medium mt-2">On this branch's student invoices</div>
                                <div className="text-xs text-default-500 -mt-2">Leave empty to use the head-office details from Client fees → Billing settings.</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Address" className="sm:col-span-2"><Textarea aria-label="Address" minRows={2} value={form.address} onValueChange={set("address")} /></Field>
                                    <Field label="Phone"><Input aria-label="Phone" value={form.phone} {...phoneInputProps} onValueChange={(v) => set("phone")(toPhoneDigits(v))} /></Field>
                                    <Field label="Email"><Input aria-label="Email" value={form.email} onValueChange={set("email")} /></Field>
                                    <Field label="GSTIN" hint="Needed when the branch is registered in another state"><Input aria-label="GSTIN" value={form.gstin} onValueChange={(v) => set("gstin")(v.toUpperCase())} /></Field>
                                    <Field label="Invoice prefix" hint={form.invoice_prefix ? `Own number series: ${form.invoice_prefix.toUpperCase()}-0001` : "Empty = head-office numbers"}>
                                        <Input aria-label="Invoice prefix" maxLength={10} value={form.invoice_prefix} onValueChange={(v) => set("invoice_prefix")(v.toUpperCase())} />
                                    </Field>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => save(onClose)}>{form.id ? "Save" : "Add branch"}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default BranchesPage;
