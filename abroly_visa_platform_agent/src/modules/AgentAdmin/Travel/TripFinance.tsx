import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { Phone, Undo2, Wallet } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SupplierRefundModal } from "./BookingMoney";
import { Field, PageHead, Tile, fmtDate, rupees, serviceLabel } from "./travelShared";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const STATUS_COLOR: Record<string, "primary" | "warning" | "success" | "danger"> = { confirmed: "primary", in_progress: "warning", completed: "success", cancelled: "danger" };
const STATUS_LABEL: Record<string, string> = { confirmed: "Confirmed", in_progress: "Travelling", completed: "Completed", cancelled: "Cancelled" };

/** Money after the sale: what we owe suppliers and when, real profit per trip, and refunds both ways. */
const TripFinance = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [tab, setTab] = useState<string>(() => { try { return localStorage.getItem("trip-finance-tab") || "payables"; } catch { return "payables"; } });
    const [p, setP] = useState<any>(null);
    const [err, setErr] = useState("");
    const now = new Date();
    const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
    const [to, setTo] = useState(iso(new Date(now.getTime() + 90 * 864e5)));
    const [pr, setPr] = useState<any>(null);
    const payModal = useDisclosure();
    const refundModal = useDisclosure();
    const clientModal = useDisclosure();
    const [pick, setPick] = useState<any>(null);
    const [form, setForm] = useState<any>({ amount: "", reference: "", paid_at: "" });
    const [busy, setBusy] = useState(false);

    const loadP = useCallback(async () => {
        const r = await commonGetAPICalls("/travel/finance/payables");
        if (r.success) setP(r.data); else setErr(r.message || "Could not load");
    }, []);
    const loadPr = useCallback(async () => {
        setPr(null);
        const r = await commonGetAPICalls(`/travel/finance/profit?from=${from}&to=${to}`);
        if (r.success) setPr(r.data);
    }, [from, to]);
    useEffect(() => { loadP(); }, [loadP]);
    useEffect(() => { if (tab === "profit") loadPr(); }, [tab, loadPr]);
    const changeTab = (k: string) => { setTab(k); try { localStorage.setItem("trip-finance-tab", k); } catch { /* private mode */ } };
    const refresh = () => { loadP(); if (tab === "profit") loadPr(); };

    if (err) return <div className="p-6 text-default-500">{err}</div>;
    if (!p) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const k = p.kpis;
    const refundsCount = p.supplier_refunds.length + p.client_refunds.length;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <PageHead title="Trip finance" sub="What you owe suppliers, real profit on each trip, and refunds still to settle." />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
                <Tile label="Owed to suppliers" value={rupees(k.owed)} hint={k.no_due_date ? `${k.no_due_date} without a pay-by date` : undefined} />
                <Tile label="Overdue" value={rupees(k.overdue)} tone={k.overdue > 0 ? "danger" : undefined} />
                <Tile label="Due in 7 days" value={rupees(k.due_7)} />
                <Tile label="Paid this month" value={rupees(k.paid_this_month)} />
                <Tile label="Refunds open" value={refundsCount} hint={`${rupees(k.client_refunds_due)} to clients · ${rupees(k.supplier_refunds_due)} from suppliers`} tone={refundsCount ? "danger" : undefined} />
            </div>

            <Tabs aria-label="Trip finance" selectedKey={tab} onSelectionChange={(x) => changeTab(String(x))} variant="underlined" classNames={{ tabList: "overflow-x-auto" }}>
                <Tab key="payables" title={`Supplier payments${p.suppliers.length ? ` (${p.suppliers.length})` : ""}`}>
                    {!p.suppliers.length ? <Card shadow="sm"><CardBody className="text-default-500 text-sm">Nothing owed to suppliers. 🎉</CardBody></Card> : (
                        <div className="flex flex-col gap-3">
                            {p.suppliers.map((g: any) => (
                                <Card key={g.id || g.name} shadow="sm"><CardBody className="gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" className="font-semibold text-left hover:underline" onClick={() => g.id && navigate(`/travel/suppliers/${g.id}`)}>{g.name}</button>
                                        {g.phone && <a href={`tel:${String(g.phone).replace(/[^\d+]/g, "")}`} className="text-xs text-default-500 flex items-center gap-1"><Phone size={12} />{g.phone}</a>}
                                        <span className="ml-auto text-sm">Owed <b>{rupees(g.owed)}</b>{g.overdue > 0 && <span className="text-danger"> · {rupees(g.overdue)} overdue</span>}</span>
                                    </div>
                                    <div className="flex flex-col divide-y divide-default-100">
                                        {g.services.map((s: any) => (
                                            <div key={s.id} className="py-2 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 text-sm">
                                                <div className="flex-1 min-w-[200px]">
                                                    <div className="font-medium">{s.description}{s.status === "cancelled" && <span className="text-warning-600 font-normal"> · cancellation charge</span>}</div>
                                                    <button type="button" className="text-xs text-default-500 hover:underline text-left" onClick={() => s.booking && navigate(`/travel/bookings/${s.booking.id}`)}>{s.booking?.booking_no} · {s.booking?.title} · {serviceLabel(s.type)} {fmtDate(s.service_date)}</button>
                                                </div>
                                                <div className={`text-xs sm:w-28 ${s.overdue ? "text-danger font-medium" : "text-default-500"}`}>{s.due_date ? `${s.overdue ? "Was due" : "Pay by"} ${fmtDate(s.due_date)}` : "No pay-by date"}</div>
                                                <div className="sm:w-32 sm:text-right"><b>{rupees(s.owed)}</b>{s.paid > 0 && <div className="text-[11px] text-default-500">of {rupees(s.cost)}</div>}</div>
                                                {p.can_pay && <Button size="sm" variant="flat" color="primary" startContent={<Wallet size={14} />} onPress={() => { setPick(s); setForm({ amount: String(s.owed), reference: "", paid_at: iso(new Date()) }); payModal.onOpen(); }}>Pay</Button>}
                                            </div>
                                        ))}
                                    </div>
                                </CardBody></Card>
                            ))}
                        </div>
                    )}
                </Tab>

                <Tab key="profit" title="Profit by trip">
                    <div className="flex flex-wrap items-end gap-2 mb-3">
                        <Input type="date" size="sm" label="Trips starting from" className="w-44" value={from} onValueChange={setFrom} />
                        <Input type="date" size="sm" label="to" className="w-44" value={to} onValueChange={setTo} />
                    </div>
                    {!pr ? <div className="py-10 grid place-items-center"><Spinner /></div> : (<>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
                            <Tile label="Net sales" value={rupees(pr.totals.net_sell || 0)} hint={pr.totals.credited ? `after ${rupees(pr.totals.credited)} credit notes` : `${pr.trips.length} trips`} />
                            <Tile label="Real profit" value={rupees(pr.totals.real_profit || 0)} hint={`${pr.totals.margin_pct || 0}% margin`} tone={(pr.totals.real_profit || 0) >= 0 ? "success" : "danger"} />
                            <Tile label="Cancellation charges" value={rupees(pr.totals.cancel_charges || 0)} hint="Kept by suppliers" />
                            <Tile label="Loss-making trips" value={pr.loss_making} tone={pr.loss_making ? "danger" : undefined} />
                        </div>
                        {!pr.trips.length ? <Card shadow="sm"><CardBody className="text-sm text-default-500">No trips start in these dates.</CardBody></Card> : (
                            <Card shadow="sm"><CardBody className="p-0 overflow-x-auto">
                                <table className="w-full text-sm min-w-[860px]">
                                    <thead className="text-xs text-default-500 text-left bg-default-50"><tr>
                                        <th className="p-2">Trip</th><th className="p-2">Starts</th><th className="p-2 text-right">Net sell</th><th className="p-2 text-right">Supplier cost</th>
                                        <th className="p-2 text-right">Profit</th><th className="p-2 text-right">Margin</th><th className="p-2 text-right">Client balance</th><th className="p-2 text-right">Owed to suppliers</th><th className="p-2 text-right">Cash in hand</th>
                                    </tr></thead>
                                    <tbody>
                                        {pr.trips.map((t: any) => (
                                            <tr key={t.id} className="border-t border-default-100 hover:bg-default-50 cursor-pointer" onClick={() => navigate(`/travel/bookings/${t.id}`)}>
                                                <td className="p-2"><div className="font-medium">{t.title}</div><div className="text-xs text-default-500 flex items-center gap-1">{t.booking_no} · {t.client}<Chip size="sm" variant="flat" color={STATUS_COLOR[t.status]} className="h-4 text-[10px]">{STATUS_LABEL[t.status] || t.status}</Chip></div></td>
                                                <td className="p-2 whitespace-nowrap">{fmtDate(t.start_date)}</td>
                                                <td className="p-2 text-right">{rupees(t.net_sell)}{t.credited > 0 && <div className="text-[11px] text-warning-600">−{rupees(t.credited)} credited</div>}</td>
                                                <td className="p-2 text-right">{rupees(t.net_cost)}{t.cancel_charges > 0 && <div className="text-[11px] text-warning-600">{rupees(t.cancel_charges)} charges</div>}</td>
                                                <td className={`p-2 text-right font-semibold ${t.real_profit >= 0 ? "text-success-600" : "text-danger"}`}>{rupees(t.real_profit)}</td>
                                                <td className="p-2 text-right">{t.margin_pct}%</td>
                                                <td className="p-2 text-right">{t.client_balance > 0 ? rupees(t.client_balance) : <span className="text-default-400">-</span>}</td>
                                                <td className="p-2 text-right">{t.supplier_owed > 0 ? rupees(t.supplier_owed) : <span className="text-default-400">-</span>}</td>
                                                <td className={`p-2 text-right ${t.cash_position < 0 ? "text-danger" : ""}`}>{rupees(t.cash_position)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardBody></Card>
                        )}
                        <p className="text-xs text-default-500 mt-2">Real profit = selling price less credit notes, less what suppliers keep (full cost, or only the cancellation charge on cancelled services). Cash in hand = received from the client less paid to suppliers.</p>
                    </>)}
                </Tab>

                <Tab key="refunds" title={`Refunds${refundsCount ? ` (${refundsCount})` : ""}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <Card shadow="sm"><CardBody className="gap-2">
                            <div className="font-semibold">To pay clients</div>
                            {!p.client_refunds.length ? <p className="text-sm text-default-500">No client refunds pending.</p> : p.client_refunds.map((r: any) => (
                                <div key={r.id} className="flex flex-wrap items-center gap-2 border-t border-default-100 pt-2 text-sm">
                                    <div className="flex-1 min-w-[180px]"><div className="font-medium">{r.client} · {rupees(r.due)}</div>
                                        <button type="button" className="text-xs text-default-500 hover:underline text-left" onClick={() => r.booking && navigate(`/travel/bookings/${r.booking.id}`)}>{r.number} · {r.booking?.booking_no} · {r.reason}</button></div>
                                    {p.can_pay && <Button size="sm" variant="flat" onPress={() => { setPick(r); setForm({ amount: String(r.due), reference: "" }); clientModal.onOpen(); }}>Record refund</Button>}
                                </div>
                            ))}
                        </CardBody></Card>
                        <Card shadow="sm"><CardBody className="gap-2">
                            <div className="font-semibold">Due back from suppliers</div>
                            {!p.supplier_refunds.length ? <p className="text-sm text-default-500">No supplier refunds pending.</p> : p.supplier_refunds.map((s: any) => (
                                <div key={s.id} className="flex flex-wrap items-center gap-2 border-t border-default-100 pt-2 text-sm">
                                    <div className="flex-1 min-w-[180px]"><div className="font-medium">{s.supplier?.name || "Supplier"} · {rupees(s.refund_due)}</div>
                                        <button type="button" className="text-xs text-default-500 hover:underline text-left" onClick={() => s.booking && navigate(`/travel/bookings/${s.booking.id}`)}>{s.booking?.booking_no} · {s.description}</button></div>
                                    {p.can_pay && <Button size="sm" variant="flat" color="success" startContent={<Undo2 size={14} />} onPress={() => { setPick(s); refundModal.onOpen(); }}>Received</Button>}
                                </div>
                            ))}
                        </CardBody></Card>
                    </div>
                </Tab>
            </Tabs>

            <Modal isOpen={payModal.isOpen} onOpenChange={payModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader className="flex-col items-start">Pay supplier<span className="text-sm font-normal text-default-500">{pick?.supplier?.name} · {pick?.description}</span></ModalHeader>
                    <ModalBody className="gap-3">
                        <Field label="Amount ₹"><Input aria-label="Amount" type="number" value={form.amount} onValueChange={(v) => setForm((f: any) => ({ ...f, amount: v }))} /></Field>
                        <Field label="Paid on"><Input aria-label="Paid on" type="date" value={form.paid_at} onValueChange={(v) => setForm((f: any) => ({ ...f, paid_at: v }))} /></Field>
                        <Field label="Reference (UTR / cheque no.)"><Input aria-label="Reference" value={form.reference} onValueChange={(v) => setForm((f: any) => ({ ...f, reference: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => {
                        setBusy(true); const { success } = await commonPostAPICall({ amount: Number(form.amount), paid_at: form.paid_at, reference: form.reference }, `travel/bookings/services/${pick.id}/supplier_payment`, true); setBusy(false);
                        if (success) { close(); refresh(); }
                    }}>Record payment</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
            <Modal isOpen={clientModal.isOpen} onOpenChange={clientModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader className="flex-col items-start">Refund to {pick?.client}<span className="text-sm font-normal text-default-500">{pick?.number}</span></ModalHeader>
                    <ModalBody className="gap-3">
                        <Field label="Amount refunded ₹"><Input aria-label="Amount" type="number" value={form.amount} onValueChange={(v) => setForm((f: any) => ({ ...f, amount: v }))} /></Field>
                        <Field label="Reference (UTR / cheque no.)"><Input aria-label="Reference" value={form.reference} onValueChange={(v) => setForm((f: any) => ({ ...f, reference: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => {
                        setBusy(true); const { success } = await commonPostAPICall({ amount: Number(form.amount), reference: form.reference }, `travel/credit_notes/${pick.id}/refund`, true); setBusy(false);
                        if (success) { close(); refresh(); }
                    }}>Record refund</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
            <SupplierRefundModal service={pick} isOpen={refundModal.isOpen} onOpenChange={refundModal.onOpenChange} onDone={refresh} />
        </div>
    );
};

export default TripFinance;
