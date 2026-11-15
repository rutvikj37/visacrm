import { useCallback, useEffect, useState } from "react";
import HistoryList from "@/modules/AgentAdmin/Activity/HistoryList";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, useDisclosure } from "@heroui/react";
import { ArrowLeft, Ban, Copy, Link2, MessageCircle, Printer, RefreshCw, Wallet } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { Field, METHODS, STATUS, fmtDate, methodLabel, rupees } from "./feesShared";

/** One invoice: printable bill, payments / receipts, payment link and WhatsApp share. */
const InvoiceDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const payModal = useDisclosure();
    const [pay, setPay] = useState({ amount: "", method: "upi", reference: "", paid_at: new Date().toISOString().slice(0, 10), note: "" });

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/fees/invoices/${id}`);
        if (success) setData(data);
        setLoading(false);
    }, [id]);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (!data) return <div className="p-6">Invoice not found. <Button size="sm" onPress={() => navigate("/fees")}>Back</Button></div>;
    const { invoice: inv, agency, can_manage: canManage } = data;
    const open = inv.status !== "paid" && inv.status !== "cancelled";

    const post = async (key: string, url: string, body: object = {}) => {
        setBusy(key);
        const result = await commonPostAPICall(body, url, true);
        setBusy(null);
        if (result.success) load();
        return result;
    };
    const copy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); SuccessToast("Copied"); } catch { ErrorToast("Could not copy"); }
    };
    const shareText =
        `Hi ${String(inv.student?.name || "").split(" ")[0]}, your invoice ${inv.number} from ${agency.name} is ${rupees(inv.total)}.` +
        (inv.balance > 0 ? ` Balance due: ${rupees(inv.balance)}${inv.next_due?.due_date ? ` (next: ${rupees(inv.next_due.amount)} by ${fmtDate(inv.next_due.due_date)})` : ""}.` : " It is fully paid - thank you!") +
        (inv.balance > 0 && inv.payment_link_url ? ` Pay online: ${inv.payment_link_url}` : inv.balance > 0 && agency.upi_id ? ` UPI: ${agency.upi_id}` : "");
    const waUrl = inv.student?.phone_digits ? `https://wa.me/${inv.student.phone_digits}?text=${encodeURIComponent(shareText)}` : null;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
            <style>{`@media print { body * { visibility: hidden; } #invoice-print, #invoice-print * { visibility: visible; } #invoice-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; } }`}</style>
            <div className="flex flex-wrap items-center gap-2">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate("/fees")}><ArrowLeft size={20} /></Button>
                <h1 className="text-xl font-semibold">{inv.number}</h1>
                <Chip size="sm" variant="flat" color={inv.overdue ? "danger" : STATUS[inv.status]?.color}>{inv.overdue ? "Overdue" : STATUS[inv.status]?.label}</Chip>
                <div className="flex flex-wrap gap-2 ml-auto">
                    <Button size="sm" variant="flat" startContent={<Printer size={14} />} onPress={() => window.print()}>Print / PDF</Button>
                    {waUrl && <Button as="a" href={waUrl} target="_blank" rel="noreferrer" size="sm" color="success" variant="flat" startContent={<MessageCircle size={14} />}>Send on WhatsApp</Button>}
                    {canManage && open && <Button size="sm" color="primary" startContent={<Wallet size={14} />} onPress={() => { setPay({ ...pay, amount: String(inv.next_due?.amount || inv.balance) }); payModal.onOpen(); }}>Record payment</Button>}
                </div>
            </div>

            {canManage && open && (
                <Card shadow="sm">
                    <CardBody className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Link2 size={18} className="shrink-0" />
                        {inv.payment_link_url ? (
                            <>
                                <Input size="sm" readOnly aria-label="Payment link" value={inv.payment_link_url} classNames={{ input: "text-xs" }} />
                                <Button size="sm" isIconOnly variant="flat" aria-label="Copy link" onPress={() => copy(inv.payment_link_url)}><Copy size={14} /></Button>
                                <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} isLoading={busy === "check"} onPress={() => post("check", `crm/fees/invoices/${id}/check_link`)}>Check payment</Button>
                            </>
                        ) : (
                            <>
                                <span className="text-sm flex-1">{data.razorpay_ready ? "Create an online payment link for the amount due now." : "Add your Razorpay keys in Client fees → Billing settings to create online payment links."}</span>
                                {data.razorpay_ready && <Button size="sm" variant="flat" color="primary" isLoading={busy === "link"} onPress={() => post("link", `crm/fees/invoices/${id}/payment_link`, { amount: inv.next_due?.amount || inv.balance })}>Create link for {rupees(inv.next_due?.amount || inv.balance)}</Button>}
                            </>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* printable invoice */}
            <Card shadow="sm" id="invoice-print" className="bg-white text-black">
                <CardBody className="p-6 sm:p-8 gap-6">
                    <div className="flex flex-wrap justify-between gap-4">
                        <div className="flex items-start gap-3">
                            {agency.logo_url && <img src={agency.logo_url} alt="" className="h-12 w-12 object-contain" />}
                            <div>
                                <div className="text-lg font-bold">{agency.name}</div>
                                {agency.branch_name && <div className="text-xs font-medium text-gray-700">{agency.branch_name}</div>}
                                {agency.address && <div className="text-xs text-gray-600 whitespace-pre-line max-w-xs">{agency.address}</div>}
                                {agency.gstin && <div className="text-xs text-gray-600">GSTIN: {agency.gstin}</div>}
                                <div className="text-xs text-gray-600">{[agency.phone, agency.email].filter(Boolean).join(" · ")}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold">{Number(inv.gst_percent) > 0 ? "TAX INVOICE" : "INVOICE"}</div>
                            <div className="text-sm">{inv.number}</div>
                            <div className="text-xs text-gray-600">Date: {fmtDate(inv.issue_date)}</div>
                            {inv.due_date && <div className="text-xs text-gray-600">Due: {fmtDate(inv.due_date)}</div>}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">Billed to</div>
                        <div className="font-medium">{inv.student?.name}</div>
                        <div className="text-xs text-gray-600">{[inv.student?.phone, inv.student?.email].filter(Boolean).join(" · ")}</div>
                        {inv.title && <div className="text-sm mt-1">{inv.title}</div>}
                    </div>
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-300 text-left text-xs text-gray-500"><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
                        <tbody>
                            {inv.items.map((it: any, i: number) => <tr key={i} className="border-b border-gray-100"><td className="py-2">{it.description}</td><td className="py-2 text-right">{rupees(it.amount)}</td></tr>)}
                        </tbody>
                        <tfoot>
                            <tr><td className="pt-3 text-right text-gray-600">Subtotal</td><td className="pt-3 text-right">{rupees(inv.subtotal)}</td></tr>
                            {Number(inv.gst_percent) > 0 && <tr><td className="text-right text-gray-600">GST {Number(inv.gst_percent)}%</td><td className="text-right">{rupees(inv.gst_amount)}</td></tr>}
                            <tr className="font-bold"><td className="pt-1 text-right">Total</td><td className="pt-1 text-right">{rupees(inv.total)}</td></tr>
                            <tr><td className="text-right text-gray-600">Paid</td><td className="text-right">{rupees(inv.amount_paid)}</td></tr>
                            <tr className="font-bold"><td className="text-right">Balance due</td><td className="text-right">{rupees(inv.balance)}</td></tr>
                        </tfoot>
                    </table>
                    {inv.installments.length > 0 && (
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Payment schedule</div>
                            {inv.installments.map((it: any, i: number) => <div key={i} className="flex justify-between text-sm border-b border-gray-100 py-1"><span>{it.label} · due {fmtDate(it.due_date)}</span><span>{rupees(it.amount)}</span></div>)}
                        </div>
                    )}
                    {(agency.upi_id || agency.bank_details) && inv.balance > 0 && (
                        <div className="text-xs text-gray-700">
                            <div className="text-gray-500 mb-1">How to pay</div>
                            {agency.upi_id && <div>UPI: {agency.upi_id}</div>}
                            {agency.bank_details && <div className="whitespace-pre-line">{agency.bank_details}</div>}
                        </div>
                    )}
                    {(inv.notes || agency.terms) && <div className="text-xs text-gray-600 whitespace-pre-line">{[inv.notes, agency.terms].filter(Boolean).join("\n\n")}</div>}
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardHeader className="font-semibold">Payments & receipts</CardHeader>
                <CardBody className="pt-0">
                    {inv.payments.length === 0 && <p className="text-sm text-default-500">No payments recorded yet.</p>}
                    {inv.payments.map((p: any) => (
                        <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 border-t border-default-100 first:border-0 text-sm">
                            <span className="font-medium w-24">{p.receipt_number}</span>
                            <span>{fmtDate(p.paid_at)}</span>
                            <span className="font-medium">{rupees(p.amount)}</span>
                            <span className="text-default-500">{methodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ""}</span>
                            {p.note && <span className="text-default-500">{p.note}</span>}
                        </div>
                    ))}
                    {canManage && inv.status === "unpaid" && (
                        <Button size="sm" variant="light" color="danger" className="mt-3 self-start" startContent={<Ban size={14} />} isLoading={busy === "cancel"}
                            onPress={() => window.confirm("Cancel this invoice?") && post("cancel", `crm/fees/invoices/${id}/cancel`)}>Cancel invoice</Button>
                    )}
                </CardBody>
            </Card>

            {data.history?.length > 0 && (
                <Card shadow="sm">
                    <CardHeader className="font-semibold">History</CardHeader>
                    <CardBody className="pt-0"><HistoryList entries={data.history} /></CardBody>
                </Card>
            )}

            <Modal isOpen={payModal.isOpen} onOpenChange={payModal.onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Record payment</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">Balance due: {rupees(inv.balance)}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Amount received (₹)"><Input aria-label="Amount" type="number" min={0} value={pay.amount} onValueChange={(v) => setPay({ ...pay, amount: v })} /></Field>
                                    <Field label="Date"><Input aria-label="Date" type="date" value={pay.paid_at} onValueChange={(v) => setPay({ ...pay, paid_at: v })} /></Field>
                                    <Field label="Paid by">
                                        <Select aria-label="Method" selectedKeys={[pay.method]} onChange={(e) => e.target.value && setPay({ ...pay, method: e.target.value })}>
                                            {METHODS.map((m) => <SelectItem key={m.key}>{m.label}</SelectItem>)}
                                        </Select>
                                    </Field>
                                    <Field label="Reference (UTR / cheque no.)"><Input aria-label="Reference" value={pay.reference} onValueChange={(v) => setPay({ ...pay, reference: v })} /></Field>
                                    <Field label="Note" className="col-span-2"><Input aria-label="Note" value={pay.note} onValueChange={(v) => setPay({ ...pay, note: v })} /></Field>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy === "pay"} onPress={async () => {
                                    if (!(Number(pay.amount) > 0)) return ErrorToast("Enter the amount received");
                                    const r = await post("pay", `crm/fees/invoices/${id}/payments`, { ...pay, amount: Number(pay.amount) });
                                    if (r.success) onClose();
                                }}>Save payment</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default InvoiceDetails;
