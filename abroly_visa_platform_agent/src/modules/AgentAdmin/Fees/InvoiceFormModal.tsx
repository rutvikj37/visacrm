import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Switch, Textarea } from "@heroui/react";
import { Plus, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { Field, rupees } from "./feesShared";

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** bill a known case (from the case page); otherwise a student is searched */
    caseId?: number | string | null;
    studentName?: string;
    onCreated: (id: string) => void;
}

const InvoiceFormModal = ({ isOpen, onOpenChange, caseId, studentName, onCreated }: Props) => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [search, setSearch] = useState("");
    const [students, setStudents] = useState<any[]>([]);
    const [student, setStudent] = useState<any>(null);
    const [selectedCase, setSelectedCase] = useState("");
    const [title, setTitle] = useState("");
    const [items, setItems] = useState([{ description: "Service fee", amount: "" }]);
    const [gst, setGst] = useState("0");
    const [dueDate, setDueDate] = useState("");
    const [split, setSplit] = useState(false);
    const [installments, setInstallments] = useState([{ label: "Advance", amount: "", due_date: "" }, { label: "Balance", amount: "", due_date: "" }]);
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setStudent(null); setSearch(""); setSelectedCase(""); setTitle(""); setItems([{ description: "Service fee", amount: "" }]);
        setDueDate(""); setSplit(false); setNotes("");
        setInstallments([{ label: "Advance", amount: "", due_date: "" }, { label: "Balance", amount: "", due_date: "" }]);
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/fees/settings");
            if (success) setGst(String(data?.default_gst_percent || 0));
        })();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || caseId || student) return;
        const t = setTimeout(async () => {
            const { success, data } = await commonGetAPICalls(`/crm/fees/students?search=${encodeURIComponent(search.trim())}`);
            if (success) setStudents(data || []);
        }, 300);
        return () => clearTimeout(t);
    }, [search, isOpen, caseId, student]);

    const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items]);
    const gstAmount = Math.round(subtotal * (Number(gst) || 0)) / 100;
    const total = subtotal + gstAmount;
    const splitSum = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const submit = async (close: () => void) => {
        if (!caseId && !student) return ErrorToast("Please choose a student");
        if (!items.some((i) => i.description.trim() && Number(i.amount) > 0)) return ErrorToast("Add at least one fee line with an amount");
        if (split && Math.abs(splitSum - total) > 0.001) return ErrorToast(`Instalments add up to ${rupees(splitSum)} but the total is ${rupees(total)}`);
        setSaving(true);
        const { success, data } = await commonPostAPICall({
            case_id: caseId || selectedCase || undefined,
            student_id: student?.id,
            title,
            items: items.filter((i) => i.description.trim() && Number(i.amount) > 0).map((i) => ({ description: i.description, amount: Number(i.amount) })),
            gst_percent: Number(gst) || 0,
            due_date: split ? undefined : dueDate || undefined,
            installments: split ? installments.map((i) => ({ ...i, amount: Number(i.amount) })) : undefined,
            notes,
        }, "crm/fees/invoices", true);
        setSaving(false);
        if (success) { close(); onCreated(data.id); }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>New invoice{studentName ? ` for ${studentName}` : ""}</ModalHeader>
                        <ModalBody>
                            {!caseId && (
                                student ? (
                                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-default-100 px-3 py-2">
                                        <span className="font-medium">{student.name}</span><span className="text-sm text-default-500">{student.phone}</span>
                                        {student.cases.length > 0 && (
                                            <Select aria-label="Case" size="sm" className="max-w-[240px] ml-auto" placeholder="Link to a case (optional)" selectedKeys={selectedCase ? [selectedCase] : []} onChange={(e) => setSelectedCase(e.target.value)}>
                                                {student.cases.map((c: any) => <SelectItem key={String(c.id)}>{c.label}</SelectItem>)}
                                            </Select>
                                        )}
                                        <Button size="sm" variant="light" onPress={() => { setStudent(null); setSelectedCase(""); }}>Change</Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Input aria-label="Search student" placeholder="Search student by name or phone" value={search} onValueChange={setSearch} />
                                        <div className="max-h-40 overflow-y-auto rounded-xl border border-default-200 divide-y divide-default-100">
                                            {students.length === 0 && <div className="p-3 text-sm text-default-500">No students found. Students are created when you convert a lead.</div>}
                                            {students.map((s) => (
                                                <button key={s.id} type="button" className="w-full text-left px-3 py-2 hover:bg-default-100 text-sm" onClick={() => setStudent(s)}>
                                                    <span className="font-medium">{s.name}</span> <span className="text-default-500">{s.phone}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                            <Field label="Invoice title"><Input aria-label="Title" placeholder="e.g. Canada study visa - service fee" value={title} onValueChange={setTitle} /></Field>

                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-medium text-default-600">Fee lines</span>
                                {items.map((it, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input aria-label="Description" size="sm" placeholder="Description" value={it.description} onValueChange={(v) => setItems(items.map((x, n) => (n === i ? { ...x, description: v } : x)))} />
                                        <Input aria-label="Amount" size="sm" type="number" min={0} placeholder="Amount ₹" className="w-36 shrink-0" value={it.amount} onValueChange={(v) => setItems(items.map((x, n) => (n === i ? { ...x, amount: v } : x)))} />
                                        <Button isIconOnly size="sm" variant="light" aria-label="Remove line" isDisabled={items.length === 1} onPress={() => setItems(items.filter((_, n) => n !== i))}><X size={16} /></Button>
                                    </div>
                                ))}
                                <Button size="sm" variant="light" className="self-start" startContent={<Plus size={14} />} onPress={() => setItems([...items, { description: "", amount: "" }])}>Add line</Button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                                <Field label="GST %"><Input aria-label="GST percent" size="sm" type="number" min={0} max={28} value={gst} onValueChange={setGst} /></Field>
                                <div className="text-sm"><div className="text-xs text-default-500">Subtotal</div>{rupees(subtotal)}</div>
                                <div className="text-sm"><div className="text-xs text-default-500">GST</div>{rupees(gstAmount)}</div>
                                <div className="text-lg font-semibold"><div className="text-xs text-default-500 font-normal">Total</div>{rupees(total)}</div>
                            </div>

                            <Switch size="sm" isSelected={split} onValueChange={setSplit}>Pay in instalments</Switch>
                            {split ? (
                                <div className="flex flex-col gap-2">
                                    {installments.map((it, i) => (
                                        <div key={i} className="grid grid-cols-[1fr_110px_150px_auto] gap-2">
                                            <Input aria-label="Instalment name" size="sm" value={it.label} onValueChange={(v) => setInstallments(installments.map((x, n) => (n === i ? { ...x, label: v } : x)))} />
                                            <Input aria-label="Instalment amount" size="sm" type="number" min={0} placeholder="₹" value={it.amount} onValueChange={(v) => setInstallments(installments.map((x, n) => (n === i ? { ...x, amount: v } : x)))} />
                                            <Input aria-label="Instalment due date" size="sm" type="date" value={it.due_date} onValueChange={(v) => setInstallments(installments.map((x, n) => (n === i ? { ...x, due_date: v } : x)))} />
                                            <Button isIconOnly size="sm" variant="light" aria-label="Remove instalment" isDisabled={installments.length <= 2} onPress={() => setInstallments(installments.filter((_, n) => n !== i))}><X size={16} /></Button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-3">
                                        <Button size="sm" variant="light" startContent={<Plus size={14} />} onPress={() => setInstallments([...installments, { label: `Instalment ${installments.length + 1}`, amount: "", due_date: "" }])}>Add instalment</Button>
                                        <span className={`text-xs ${Math.abs(splitSum - total) > 0.001 ? "text-danger" : "text-success"}`}>{rupees(splitSum)} of {rupees(total)}</span>
                                    </div>
                                </div>
                            ) : (
                                <Field label="Due date" className="max-w-[200px]"><Input aria-label="Due date" size="sm" type="date" value={dueDate} onValueChange={setDueDate} /></Field>
                            )}
                            <Field label="Note on the invoice (optional)"><Textarea aria-label="Notes" minRows={1} value={notes} onValueChange={setNotes} /></Field>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>Cancel</Button>
                            <Button color="primary" isLoading={saving} onPress={() => submit(onClose)}>Create invoice</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default InvoiceFormModal;
