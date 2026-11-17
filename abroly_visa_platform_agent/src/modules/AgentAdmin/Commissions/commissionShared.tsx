import { useEffect, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Select, SelectItem, Textarea } from "@heroui/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { CURRENCIES } from "@/modules/AgentAdmin/Cases/UniversityApplications";

export const COMMISSION_STATUSES = [
    { key: "expected", label: "Expected", color: "default" as const },
    { key: "invoiced", label: "Invoiced", color: "primary" as const },
    { key: "received", label: "Received", color: "success" as const },
    { key: "cancelled", label: "Cancelled", color: "default" as const },
];
export const commissionStatus = (k?: string) => COMMISSION_STATUSES.find((s) => s.key === k) || COMMISSION_STATUSES[0];

export const money = (amount?: number | null, currency?: string | null) => {
    if (amount === null || amount === undefined) return "-";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currency || ""} ${amount}`.trim(); }
};

export const fmtDate = (v?: string | null) => {
    if (!v) return "-";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const Field = ({ label, children }: any) => (
    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-default-600">{label}</span>{children}</div>
);

const EMPTY = { partner: "", basis: "percent", percent: "", tuition_fee: "", currency: "GBP", amount_expected: "", due_on: "", invoice_ref: "", invoiced_on: "", amount_received: "", received_on: "", notes: "" };

/**
 * Add or edit a commission. For a new one pass caseId (+ the university application to prefill partner, currency, tuition).
 */
export const CommissionFormModal = ({ isOpen, onOpenChange, caseId, app, commission, onSaved }: {
    isOpen: boolean; onOpenChange: (open: boolean) => void; caseId?: string | number; app?: any; commission?: any; onSaved?: () => void;
}) => {
    const { commonPostAPICall } = useApiCallUtils();
    const [form, setForm] = useState<any>(EMPTY);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (commission) {
            setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(commission).map(([k, v]) => [k, v === null || v === undefined ? "" : v])) });
        } else {
            setForm({ ...EMPTY, partner: app?.university || "", currency: app?.currency || "GBP", tuition_fee: app?.tuition_fee ?? "" });
        }
    }, [isOpen, commission?.id, app?.id]);

    const set = (k: string) => (v: any) => setForm((f: any) => ({ ...f, [k]: v }));
    const computed = form.basis === "percent" && form.percent !== "" && form.tuition_fee !== "" ? Math.round(Number(form.tuition_fee) * Number(form.percent)) / 100 : null;

    const save = async (close: () => void) => {
        if (!String(form.partner).trim()) return ErrorToast("Please enter who pays the commission");
        if (!computed && !(Number(form.amount_expected) > 0)) return ErrorToast("Please enter the amount, or a % and the tuition fee");
        const body: any = { ...form };
        for (const k of ["percent", "tuition_fee", "amount_expected", "amount_received"]) if (body[k] === "") body[k] = null;
        if (form.basis === "percent" && computed !== null) body.amount_expected = null; // the server works it out from % and fee
        delete body.student; delete body.university;
        setBusy(true);
        const { success } = commission
            ? await commonPostAPICall(body, `crm/commissions/${commission.id}`, true)
            : await commonPostAPICall({ ...body, case_id: caseId, university_app_id: app?.id || null }, "crm/commissions", true);
        setBusy(false);
        if (success) { close(); onSaved?.(); }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="outside">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>{commission ? "Edit commission" : `Add commission${app?.university ? ` - ${app.university}` : ""}`}</ModalHeader>
                        <ModalBody>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2"><Field label="Paid by (university or partner) *"><Input aria-label="Partner" value={form.partner} onValueChange={set("partner")} /></Field></div>
                                <div className="sm:col-span-2">
                                    <RadioGroup orientation="horizontal" size="sm" label="Commission is" value={form.basis} onValueChange={set("basis")}>
                                        <Radio value="percent">% of tuition fee</Radio>
                                        <Radio value="fixed">A fixed amount</Radio>
                                    </RadioGroup>
                                </div>
                                <Field label="Currency">
                                    <Select aria-label="Currency" selectedKeys={[form.currency || "GBP"]} onChange={(e) => e.target.value && set("currency")(e.target.value)}>
                                        {CURRENCIES.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                                    </Select>
                                </Field>
                                {form.basis === "percent" ? (
                                    <>
                                        <Field label="Commission %"><Input aria-label="Percent" type="number" min={0} max={100} endContent="%" value={String(form.percent)} onValueChange={set("percent")} /></Field>
                                        <Field label="First-year tuition fee"><Input aria-label="Tuition fee" type="number" min={0} value={String(form.tuition_fee)} onValueChange={set("tuition_fee")} /></Field>
                                        <Field label="Commission amount">
                                            <Input aria-label="Amount" isReadOnly placeholder="Worked out from % and fee"
                                                description={computed !== null ? `${form.percent}% of ${money(Number(form.tuition_fee), form.currency)}` : undefined}
                                                value={computed !== null ? money(computed, form.currency) : ""} />
                                        </Field>
                                    </>
                                ) : (
                                    <Field label="Commission amount *"><Input aria-label="Amount" type="number" min={0} value={String(form.amount_expected)} onValueChange={set("amount_expected")} /></Field>
                                )}
                                <Field label="Expected by"><Input aria-label="Expected by" type="date" value={form.due_on} onValueChange={set("due_on")} /></Field>
                                {commission && (
                                    <>
                                        <Field label="Our invoice number"><Input aria-label="Invoice number" value={form.invoice_ref} onValueChange={set("invoice_ref")} /></Field>
                                        <Field label="Invoiced on"><Input aria-label="Invoiced on" type="date" value={form.invoiced_on} onValueChange={set("invoiced_on")} /></Field>
                                        <Field label="Amount received"><Input aria-label="Amount received" type="number" min={0} value={String(form.amount_received)} onValueChange={set("amount_received")} /></Field>
                                        <Field label="Received on"><Input aria-label="Received on" type="date" value={form.received_on} onValueChange={set("received_on")} /></Field>
                                    </>
                                )}
                                <div className="sm:col-span-2"><Field label="Notes"><Textarea aria-label="Notes" minRows={2} value={form.notes} onValueChange={set("notes")} /></Field></div>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>Cancel</Button>
                            <Button color="primary" isLoading={busy} onPress={() => save(onClose)}>{commission ? "Save" : "Add commission"}</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};
