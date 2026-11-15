import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Textarea } from "@heroui/react";
import { BadgePercent, CreditCard, Receipt, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const Field = ({ label, className = "", children }: any) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}><span className="text-xs font-medium text-default-600">{label}</span>{children}</div>
);

/**
 * Before paying: price, coupon and GST. onPay(coupon) starts the payment (Razorpay, or straight
 * activation when a coupon makes it free).
 */
export const CheckoutModal = ({ plan, billing, isOpen, onClose, onPay, paying }: {
    plan: any; billing: "monthly" | "yearly"; isOpen: boolean; onClose: () => void; onPay: (coupon: string | null, total: number) => void; paying: boolean;
}) => {
    const { commonPostAPICall } = useApiCallUtils();
    const [quote, setQuote] = useState<any>(null);
    const [code, setCode] = useState("");
    const [applied, setApplied] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const fetchQuote = async (coupon: string | null) => {
        setBusy(true);
        const { success, data, message } = await commonPostAPICall({ plan_id: plan.id, billing, coupon }, "crm/subscription/quote");
        setBusy(false);
        if (success) { setQuote(data); setApplied(coupon); setError(""); }
        else if (coupon) setError(message || "This coupon can not be used");
        return success;
    };
    useEffect(() => {
        if (!isOpen || !plan) return;
        setQuote(null); setCode(""); setApplied(null); setError("");
        fetchQuote(null);
    }, [isOpen, plan?.id, billing]);

    return (
        <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="md">
            <ModalContent>
                <ModalHeader>{plan?.name} plan · {billing === "yearly" ? "1 year" : "1 month"}</ModalHeader>
                <ModalBody>
                    {!quote ? <div className="flex justify-center py-6"><Spinner /></div> : (
                        <div className="flex flex-col gap-4">
                            {applied ? (
                                <div className="flex items-center gap-2 rounded-lg bg-success-50 text-success-700 px-3 py-2 text-sm">
                                    <BadgePercent size={16} /><span><b>{quote.coupon?.code}</b> applied - {quote.coupon?.label}</span>
                                    <Button isIconOnly size="sm" variant="light" className="ml-auto" aria-label="Remove coupon" onPress={() => fetchQuote(null)}><X size={14} /></Button>
                                </div>
                            ) : (
                                <div className="flex gap-2 items-start">
                                    <Input aria-label="Coupon code" size="sm" placeholder="Coupon code" value={code} onValueChange={(v) => { setCode(v.toUpperCase()); setError(""); }}
                                        isInvalid={Boolean(error)} errorMessage={error} onKeyDown={(e) => e.key === "Enter" && code.trim() && fetchQuote(code.trim())} />
                                    <Button size="sm" variant="flat" isLoading={busy} isDisabled={!code.trim()} onPress={() => fetchQuote(code.trim())}>Apply</Button>
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5 text-sm">
                                <div className="flex justify-between"><span>Plan price</span><span>{money(quote.price)}</span></div>
                                {quote.discount > 0 && <div className="flex justify-between text-success-700"><span>Discount</span><span>-{money(quote.discount)}</span></div>}
                                {quote.gst_added > 0 && <div className="flex justify-between"><span>GST {quote.gst_percent}%</span><span>{money(quote.gst_added)}</span></div>}
                                <div className="flex justify-between font-semibold text-base border-t border-default-200 pt-2 mt-1"><span>Total</span><span>{money(quote.total)}</span></div>
                                {quote.prices_include_gst && quote.gst_percent > 0 && <div className="text-xs text-default-500 text-right">Includes GST {quote.gst_percent}%</div>}
                            </div>
                            <p className="text-xs text-default-500">You get a GST invoice after paying. Add your GSTIN under Billing details to claim input tax credit.</p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>Cancel</Button>
                    <Button color="primary" startContent={<CreditCard size={16} />} isDisabled={!quote || busy} isLoading={paying} onPress={() => onPay(applied, quote.total)}>
                        {quote && quote.total <= 0 ? "Activate plan" : `Pay ${quote ? money(quote.total) : ""}`}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

/** Owner: name, GSTIN and address printed on subscription invoices. */
export const BillingDetailsCard = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [form, setForm] = useState<any>(null);
    const [states, setStates] = useState<Record<string, string>>({});
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/subscription/billing");
            if (success) { const { states: s, ...rest } = data; setStates(s || {}); setForm(rest); }
        })();
    }, []);
    if (!form) return null;
    const set = (k: string) => (v: string) => setForm({ ...form, [k]: v });
    const gstinState = /^[0-9]{2}/.test(form.gstin || "") ? String(form.gstin).slice(0, 2) : "";
    const save = async () => {
        setSaving(true);
        const { success, data } = await commonPostAPICall({ legal_name: form.legal_name, gstin: form.gstin, address: form.address, state_code: form.state_code }, "crm/subscription/billing", true);
        setSaving(false);
        if (success) { setForm({ ...form, ...data }); setOpen(false); }
    };

    return (
        <Card shadow="sm">
            <CardHeader className="flex items-center gap-2">
                <Receipt size={16} /><span className="font-semibold">Billing details</span>
                {!open && <Button size="sm" variant="light" className="ml-auto" onPress={() => setOpen(true)}>Edit</Button>}
            </CardHeader>
            <CardBody className="pt-0">
                {!open ? (
                    <div className="text-sm flex flex-col gap-0.5">
                        <span className="font-medium">{form.legal_name || "-"}</span>
                        <span className="text-default-600">GSTIN: {form.gstin || "Not added"}{states[form.state_code] ? ` · ${states[form.state_code]}` : ""}</span>
                        {form.address && <span className="text-default-500 whitespace-pre-line">{form.address}</span>}
                        <span className="text-xs text-default-400 mt-1">Shown on your subscription invoices. Also used on the invoices you send to students.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Legal / business name"><Input aria-label="Legal name" value={form.legal_name} onValueChange={set("legal_name")} /></Field>
                        <Field label="GSTIN (optional)"><Input aria-label="GSTIN" placeholder="24ABCDE1234F1Z5" value={form.gstin} onValueChange={(v) => set("gstin")(v.toUpperCase())} /></Field>
                        <Field label="State">
                            <Select aria-label="State" isDisabled={Boolean(gstinState)} selectedKeys={gstinState || form.state_code ? [gstinState || form.state_code] : []} onChange={(e) => set("state_code")(e.target.value)}>
                                {Object.entries(states).map(([c, n]) => <SelectItem key={c}>{n}</SelectItem>)}
                            </Select>
                        </Field>
                        <Field label="Address" className="sm:col-span-2"><Textarea aria-label="Address" minRows={2} value={form.address} onValueChange={set("address")} /></Field>
                        <div className="sm:col-span-2 flex justify-end gap-2">
                            <Button variant="light" onPress={() => setOpen(false)}>Cancel</Button>
                            <Button color="primary" isLoading={saving} onPress={save}>Save</Button>
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};
