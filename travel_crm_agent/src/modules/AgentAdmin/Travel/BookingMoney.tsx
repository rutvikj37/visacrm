import { useEffect, useState } from "react";
import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { Ban } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { Field, fmtDate, rupees, serviceLabel } from "./travelShared";

const Line = ({ label, value, strong, tone, hint }: { label: string; value: number; strong?: boolean; tone?: "success" | "danger" | "warning"; hint?: string }) => (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "border-t border-default-200 mt-1 pt-2 font-semibold" : ""}`}>
        <span className="text-default-600 text-sm">{label}{hint && <span className="block text-[11px] text-default-400 font-normal">{hint}</span>}</span>
        <span className={`tabular-nums ${tone === "success" ? "text-success-600" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-600" : ""}`}>{value < 0 ? `−${rupees(-value)}` : rupees(value)}</span>
    </div>
);

/** Real profit and cash on one booking: selling value after credit notes, supplier cost after cancellations, money in and out. */
export const BookingMoneyCard = ({ bookingId, rev }: { bookingId: string; rev: number }) => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [m, setM] = useState<any>(null);
    useEffect(() => { (async () => { const { success, data } = await commonGetAPICalls(`/travel/bookings/${bookingId}/finance`); if (success) setM(data); })(); }, [bookingId, rev]);
    if (!m || m.real_profit === undefined) return null; // roles that may not see cost get nothing here
    return (
        <Card shadow="sm"><CardBody className="gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">Trip money</div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${m.real_profit >= 0 ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger"}`}>{m.real_profit >= 0 ? "Profit" : "Loss"} {rupees(Math.abs(m.real_profit))} · {m.margin_pct}%</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                <div>
                    <div className="text-xs uppercase tracking-wide text-default-400 mb-1">Profit</div>
                    <Line label="Selling price" value={m.sell} hint="Before GST and TCS" />
                    {m.credited > 0 && <Line label="Less credit notes" value={-m.credited} tone="warning" />}
                    <Line label="Supplier cost" value={-m.supplier_cost} />
                    {m.cancel_charges > 0 && <Line label="Cancellation charges" value={-m.cancel_charges} tone="warning" hint="What suppliers keep on cancelled services" />}
                    <Line label="Real profit" value={m.real_profit} strong tone={m.real_profit >= 0 ? "success" : "danger"} />
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-default-400 mb-1">Client</div>
                    {m.has_invoice ? <>
                        <Line label="Invoice total" value={m.invoiced} />
                        <Line label="Received" value={m.received} tone="success" hint={m.refunded > 0 ? `After ${rupees(m.refunded)} refunded` : undefined} />
                        {m.client_balance > 0 && <Line label="Still to collect" value={m.client_balance} tone="warning" />}
                        {m.client_refund_due > 0 && <Line label="Refund to pay the client" value={m.client_refund_due} tone="danger" />}
                    </> : <p className="text-sm text-default-500">No invoice yet.</p>}
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-default-400 mb-1">Suppliers</div>
                    <Line label="Paid so far" value={m.supplier_paid} hint="Less refunds received" />
                    <Line label="Still to pay" value={m.supplier_owed} tone={m.supplier_owed > 0 ? "warning" : undefined} />
                    {m.supplier_refund_due > 0 && <Line label="Refund due from suppliers" value={m.supplier_refund_due} tone="success" />}
                    <Line label="Cash in hand on this trip" value={m.cash_position} strong tone={m.cash_position >= 0 ? undefined : "danger"} hint="Received from the client less paid to suppliers" />
                </div>
            </div>
        </CardBody></Card>
    );
};

/** Cancel one service: what the supplier keeps, and optionally a credit for the client. */
export const CancelServiceModal = ({ service, booking, isOpen, onOpenChange, onDone }: { service: any; booking: any; isOpen: boolean; onOpenChange: () => void; onDone: () => void }) => {
    const { commonPostAPICall } = useApiCallUtils();
    const [f, setF] = useState({ charge: "", credit: "", reason: "" });
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!isOpen || !service) return;
        // suggest crediting the service's selling price incl. GST (the agent can lower it to keep a fee)
        const gst = booking.billing_mode === "margin" ? 0 : Number(booking.gst_percent || 0);
        setF({ charge: "0", credit: service.sell ? String(Math.round(service.sell * (1 + gst / 100))) : "", reason: `${service.description} cancelled` });
    }, [isOpen, service?.id]);
    if (!service) return null;
    const paid = Number(service.supplier_paid || 0);
    const charge = Number(f.charge || 0);
    const back = Math.max(0, paid - charge), owe = Math.max(0, charge - paid);
    const canMoney = booking.can_money;
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
            <ModalContent>{(close) => (<>
                <ModalHeader className="flex-col items-start">Cancel service<span className="text-sm font-normal text-default-500">{serviceLabel(service.type)} · {service.description}</span></ModalHeader>
                <ModalBody className="gap-3">
                    {booking.sees_cost && <>
                        <Field label={`Supplier's cancellation charge ₹ (cost ${rupees(service.cost)}, paid ${rupees(paid)})`}><Input aria-label="Cancellation charge" type="number" min={0} value={f.charge} onValueChange={(v) => setF((x) => ({ ...x, charge: v }))} /></Field>
                        <div className="text-xs rounded-lg bg-default-100 p-2">{back > 0 ? <>The supplier owes you <b>{rupees(back)}</b> back. Record it when it arrives.</> : owe > 0 ? <>You still pay the supplier <b>{rupees(owe)}</b>.</> : "Nothing more to pay or get back from the supplier."}</div>
                    </>}
                    {canMoney && <Field label={booking.invoice ? "Credit to the client, incl. GST ₹ (issues a credit note)" : "Take off the client's price ₹ (not invoiced yet)"}><Input aria-label="Client credit" type="number" min={0} value={f.credit} onValueChange={(v) => setF((x) => ({ ...x, credit: v }))} description="Leave 0 if the client pays for it anyway." /></Field>}
                    <Field label="Reason"><Textarea aria-label="Reason" minRows={2} value={f.reason} onValueChange={(v) => setF((x) => ({ ...x, reason: v }))} /></Field>
                </ModalBody>
                <ModalFooter><Button variant="light" onPress={close}>Keep service</Button><Button color="danger" isLoading={busy} onPress={async () => {
                    setBusy(true);
                    const { success } = await commonPostAPICall({ supplier_charge: Number(f.charge || 0), client_credit: canMoney ? Number(f.credit || 0) : 0, reason: f.reason }, `travel/bookings/services/${service.id}/cancel`, true);
                    setBusy(false);
                    if (success) { close(); onDone(); }
                }}>Cancel service</Button></ModalFooter>
            </>)}</ModalContent>
        </Modal>
    );
};

/** Cancel the whole trip: each supplier's charge, what the client still pays, and the refund that follows. */
export const CancelBookingModal = ({ booking, isOpen, onOpenChange, onDone }: { booking: any; isOpen: boolean; onOpenChange: () => void; onDone: () => void }) => {
    const { commonPostAPICall } = useApiCallUtils();
    const live = (booking.services || []).filter((s: any) => s.status !== "cancelled");
    const [charges, setCharges] = useState<Record<string, string>>({});
    const [clientCharge, setClientCharge] = useState("0");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (isOpen) { setCharges(Object.fromEntries(live.map((s: any) => [s.id, "0"]))); setClientCharge("0"); setReason(""); } }, [isOpen]);
    const supplierKeeps = live.reduce((a: number, s: any) => a + Number(charges[s.id] || 0), 0);
    const supplierPaid = live.reduce((a: number, s: any) => a + Number(s.supplier_paid || 0), 0);
    const paid = Number(booking.invoice?.paid || 0);
    const cc = Number(clientCharge || 0);
    const clientRefund = Math.max(0, paid - cc);
    const gst = booking.billing_mode === "margin" ? 0 : Number(booking.gst_percent || 0);
    const outcome = cc / (1 + gst / 100) - supplierKeeps;
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
            <ModalContent>{(close) => (<>
                <ModalHeader className="flex-col items-start">Cancel booking {booking.booking_no}<span className="text-sm font-normal text-default-500">{booking.title} · {fmtDate(booking.start_date)}</span></ModalHeader>
                <ModalBody className="gap-4">
                    <Field label="Why is the trip cancelled?"><Textarea aria-label="Reason" minRows={2} placeholder="e.g. Client's medical emergency" value={reason} onValueChange={setReason} /></Field>
                    {booking.sees_cost && live.length > 0 && (
                        <div>
                            <div className="text-sm font-medium mb-1">What each supplier keeps</div>
                            <div className="flex flex-col divide-y divide-default-100 rounded-lg border border-default-200">
                                {live.map((s: any) => (
                                    <div key={s.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2">
                                        <div className="flex-1 min-w-[180px] text-sm"><div className="font-medium truncate">{s.description}</div><div className="text-xs text-default-500">{s.supplier_name || "No supplier"} · cost {rupees(s.cost)} · paid {rupees(s.supplier_paid)}</div></div>
                                        <Input aria-label={`Charge for ${s.description}`} size="sm" type="number" min={0} className="w-full sm:w-32" startContent={<span className="text-xs text-default-400">₹</span>} value={charges[s.id] ?? "0"} onValueChange={(v) => setCharges((c) => ({ ...c, [s.id]: v }))} />
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="light" className="min-w-0 px-2" onPress={() => setCharges((c) => ({ ...c, [s.id]: "0" }))}>None</Button>
                                            <Button size="sm" variant="light" className="min-w-0 px-2" onPress={() => setCharges((c) => ({ ...c, [s.id]: String(s.cost) }))}>Full</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <Field label={`What the client still pays, incl. GST ₹${booking.invoice ? ` (invoice ${rupees(booking.invoice.total)}, paid ${rupees(paid)})` : ""}`}>
                        <Input aria-label="Client charge" type="number" min={0} value={clientCharge} onValueChange={setClientCharge} description="Your cancellation fee to the client. The rest of the invoice is credited." />
                    </Field>
                    <div className="rounded-lg bg-default-100 p-3 text-sm grid grid-cols-2 gap-y-1">
                        {booking.invoice && <><span>Refund to the client</span><span className="text-right font-medium">{rupees(clientRefund)}</span></>}
                        {booking.invoice && cc > paid && <><span>Client still owes</span><span className="text-right font-medium">{rupees(cc - paid)}</span></>}
                        {booking.sees_cost && <><span>Suppliers keep</span><span className="text-right">{rupees(supplierKeeps)}</span>
                            <span>Refund due from suppliers</span><span className="text-right">{rupees(Math.max(0, supplierPaid - supplierKeeps))}</span>
                            <span className="font-medium">Result of this cancellation</span><span className={`text-right font-semibold ${outcome >= 0 ? "text-success-600" : "text-danger"}`}>{outcome >= 0 ? "" : "−"}{rupees(Math.abs(Math.round(outcome)))}</span></>}
                    </div>
                    <p className="text-xs text-default-500">This cannot be undone. The trip page link stops working, a GST credit note is issued for the credited part, and refunds show under Trip finance until you record them.</p>
                </ModalBody>
                <ModalFooter><Button variant="light" onPress={close}>Keep booking</Button><Button color="danger" startContent={<Ban size={14} />} isLoading={busy} isDisabled={!reason.trim()} onPress={async () => {
                    setBusy(true);
                    const { success } = await commonPostAPICall({ reason, client_charge: cc, services: live.map((s: any) => ({ id: s.id, supplier_charge: Number(charges[s.id] || 0) })) }, `travel/bookings/${booking.id}/cancel`, true);
                    setBusy(false);
                    if (success) { close(); onDone(); }
                }}>Cancel booking</Button></ModalFooter>
            </>)}</ModalContent>
        </Modal>
    );
};

/** Money a supplier pays back after a cancellation. */
export const SupplierRefundModal = ({ service, isOpen, onOpenChange, onDone }: { service: any; isOpen: boolean; onOpenChange: () => void; onDone: () => void }) => {
    const { commonPostAPICall } = useApiCallUtils();
    const [f, setF] = useState({ amount: "", reference: "", received_at: "" });
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (isOpen && service) setF({ amount: String(service.supplier_refund_due ?? service.refund_due ?? ""), reference: "", received_at: new Date().toISOString().slice(0, 10) }); }, [isOpen, service?.id]);
    if (!service) return null;
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>{(close) => (<>
                <ModalHeader className="flex-col items-start">Refund from supplier<span className="text-sm font-normal text-default-500">{service.description} · {service.supplier_name || service.supplier?.name || ""}</span></ModalHeader>
                <ModalBody className="gap-3">
                    <Field label="Amount received ₹"><Input aria-label="Amount" type="number" value={f.amount} onValueChange={(v) => setF((x) => ({ ...x, amount: v }))} /></Field>
                    <Field label="Received on"><Input aria-label="Received on" type="date" value={f.received_at} onValueChange={(v) => setF((x) => ({ ...x, received_at: v }))} /></Field>
                    <Field label="Reference (UTR / credit note no.)"><Input aria-label="Reference" value={f.reference} onValueChange={(v) => setF((x) => ({ ...x, reference: v }))} /></Field>
                </ModalBody>
                <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => {
                    setBusy(true);
                    const { success } = await commonPostAPICall({ amount: Number(f.amount), reference: f.reference, received_at: f.received_at }, `travel/bookings/services/${service.id}/supplier_refund`, true);
                    setBusy(false);
                    if (success) { close(); onDone(); }
                }}>Record refund</Button></ModalFooter>
            </>)}</ModalContent>
        </Modal>
    );
};
