import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Textarea, useDisclosure,
} from "@heroui/react";
import { ArrowLeft, Ban, ExternalLink, Eye, FileText, MessageCircle, Pencil, Plus, Printer, Receipt, Trash2, Undo2, UserPlus, Wallet, XCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { BookingCreditNotes, BookingDocuments, ClientProfileCard } from "./BookingExtras";
import { BookingMoneyCard, CancelBookingModal, CancelServiceModal, SupplierRefundModal } from "./BookingMoney";
import { useOpenPdf, useSendWhatsapp } from "./travelActions";
import { SuccessToast } from "@/utils/Toaster";
import {
    BOOKING_STATUS, Field, SERVICE_STATUS, SERVICE_TYPES, Tile, apiBase, fmtDate, fmtRange, printVouchers, rupees, serviceLabel, waLink,
} from "./travelShared";

const emptyService = { id: "", type: "hotel", description: "", supplier_id: "", confirmation_no: "", status: "requested", service_date: "", end_date: "", cost: "", sell: "", supplier_due_date: "", details: { room_type: "", meal_plan: "", pickup_time: "", pnr: "" } as any };
const emptyTraveller = { id: "", name: "", pax_type: "adult", dob: "", gender: "", nationality: "Indian", passport_no: "", passport_expiry: "", pan: "", meal_pref: "", seat_pref: "" };

/** One booking: services with suppliers and confirmations, travellers, invoice, vouchers, trip kit (BK-01..BK-03, VC-01, VC-02, PY-05). */
const BookingDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const teamRole = useSelector((s: any) => s.login.team_role);
    const canMoney = teamRole === "owner" || teamRole === "accounts";
    const [b, setB] = useState<any>(null);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const svcModal = useDisclosure();
    const [svc, setSvc] = useState<any>(emptyService);
    const paxModal = useDisclosure();
    const [pax, setPax] = useState<any>(emptyTraveller);
    const payModal = useDisclosure();
    const [pay, setPay] = useState<any>({ service: null, amount: "", reference: "", paid_at: "" });
    const invModal = useDisclosure();
    const [inv, setInv] = useState<any>({ plan: "full", place_of_supply: "", due_date: "", rows: [] });
    const [busy, setBusy] = useState(false);
    const [revealed, setRevealed] = useState<Record<string, any>>({});
    const [rev, setRev] = useState(0); // bumps after money changes so the money and credit note cards reload
    const cancelModal = useDisclosure();
    const cancelSvcModal = useDisclosure();
    const refundModal = useDisclosure();
    const [money, setMoney] = useState<any>(null); // service picked for cancel / supplier refund

    const load = async () => {
        const { success, data } = await commonGetAPICalls(`/travel/bookings/${id}`);
        if (success) { setB(data); setRev((r) => r + 1); }
    };
    useEffect(() => { load(); }, [id]);
    const loadSuppliers = async () => {
        if (suppliers.length) return;
        const { success, data } = await commonGetAPICalls("/travel/suppliers");
        if (success) setSuppliers(data);
    };

    const post = async (body: any, url: string, toast = true) => {
        setBusy(true);
        const r = await commonPostAPICall(body, url, toast);
        setBusy(false);
        if (r.success) load();
        return r.success;
    };

    const openService = async (s?: any) => {
        await loadSuppliers();
        setSvc(s ? {
            ...emptyService, ...s, supplier_id: s.supplier_id ? (suppliers.find((x) => x.db_id === s.supplier_id)?.id || "") : "",
            cost: s.cost ?? "", sell: s.sell ?? "", service_date: s.service_date || "", end_date: s.end_date || "", supplier_due_date: s.supplier_due_date || "",
            details: { ...emptyService.details, ...(s.details || {}) },
        } : { ...emptyService, service_date: b?.start_date || "" });
        svcModal.onOpen();
    };
    // supplier list may arrive after the modal opened; map the db id once it does
    useEffect(() => {
        if (svc.id && !svc.supplier_id && suppliers.length) {
            const s = b?.services?.find((x: any) => x.id === svc.id);
            const match = suppliers.find((x) => x.db_id === s?.supplier_id);
            if (match) setSvc((v: any) => ({ ...v, supplier_id: match.id }));
        }
    }, [suppliers]);

    const saveService = async (close: () => void) => {
        const body: any = { ...svc, supplier_id: svc.supplier_id || null };
        delete body.id;
        if (!b.sees_cost) { delete body.cost; delete body.sell; delete body.supplier_due_date; }
        const ok = await post(body, svc.id ? `travel/bookings/services/${svc.id}/update` : `travel/bookings/${id}/services`);
        if (ok) close();
    };

    const saveTraveller = async (close: () => void) => {
        const body: any = { ...pax };
        delete body.id;
        if (!body.passport_no) delete body.passport_no;
        if (!body.pan) delete body.pan;
        const ok = await post(body, pax.id ? `travel/bookings/travellers/${pax.id}/update` : `travel/bookings/${id}/travellers`);
        if (ok) close();
    };

    const reveal = async (tid: string) => {
        const { success, data } = await commonGetAPICalls(`/travel/bookings/travellers/${tid}/reveal`);
        if (success) setRevealed((r) => ({ ...r, [tid]: data }));
    };

    const openInvoice = () => {
        const total = Number(b.client_total) || 0;
        const advance = Math.round(total * 0.3);
        const second = Math.round(total * 0.4);
        const start = b.start_date ? new Date(`${b.start_date}T00:00:00`) : new Date(Date.now() + 30 * 864e5);
        const d = (daysBefore: number) => { const x = new Date(start.getTime() - daysBefore * 864e5); return x.toISOString().slice(0, 10); };
        const today = new Date().toISOString().slice(0, 10);
        setInv({
            plan: "instalments", place_of_supply: "", due_date: d(15),
            rows: [
                { label: "Advance", amount: String(advance), due_date: today },
                { label: "Second payment", amount: String(second), due_date: d(30) < today ? today : d(30) },
                { label: "Final payment", amount: String(Math.round((total - advance - second) * 100) / 100), due_date: d(15) < today ? today : d(15) },
            ],
        });
        invModal.onOpen();
    };
    const createInvoice = async (close: () => void) => {
        const body: any = { place_of_supply: inv.place_of_supply || undefined };
        if (inv.plan === "instalments") body.installments = inv.rows.map((r: any) => ({ ...r, amount: Number(r.amount) }));
        else body.due_date = inv.due_date;
        const ok = await post(body, `travel/bookings/${id}/invoice`);
        if (ok) close();
    };

    // trip kit: one public page with confirmations, day plan and shared documents (VC-02)
    const openPdf = useOpenPdf();
    const sendWa = useSendWhatsapp();
    const tripKit = async (email = false) => {
        const { success, data } = await commonPostAPICall({ email }, `travel/bookings/${id}/kit`, email);
        if (!success || email) return;
        const confirmed = (b.services || []).filter((s: any) => s.status === "confirmed").map((s: any) => `• ${serviceLabel(s.type)}: ${s.description}${s.confirmation_no ? ` (Conf. ${s.confirmation_no})` : ""}`).join("\n");
        const text = `Hi ${String(b.client?.name || "").split(" ")[0]}, your trip ${b.title} (${b.booking_no}) is confirmed for ${fmtRange(b.start_date, b.end_date)}.\n${confirmed}\nTickets, vouchers and your day plan: ${data.url}\nHave a great trip!${b.agency?.phone ? `\nHelp: ${b.agency.phone}` : ""}`;
        await sendWa({ to: b.client?.phone, lead_id: b.lead_id, trigger: "trip_kit", vars: { name: String(b.client?.name || "").split(" ")[0], trip: b.title, booking_no: b.booking_no, start_date: b.start_date, link: data.url }, text });
    };

    if (!b) return <div className="py-16 grid place-items-center"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <div className="flex flex-wrap items-center gap-2">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate("/travel/bookings")}><ArrowLeft size={18} /></Button>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-default-500">{b.booking_no} · {b.client?.name} · {b.client?.phone}</div>
                    <h1 className="text-xl font-semibold truncate">{b.title}</h1>
                </div>
                {b.status === "cancelled" ? <Chip color="danger" variant="flat">Cancelled</Chip> : (
                    <Select aria-label="Status" size="sm" className="w-40" selectedKeys={[b.status]} onChange={(e) => e.target.value && post({ status: e.target.value }, `travel/bookings/${id}/update`)}>
                        {Object.entries(BOOKING_STATUS).filter(([k]) => k !== "cancelled").map(([k, v]) => <SelectItem key={k}>{v.label}</SelectItem>)}
                    </Select>
                )}
            </div>
            {b.status === "cancelled" && (
                <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm">
                    <b>Cancelled{b.cancelled_at ? ` on ${fmtDate(b.cancelled_at)}` : ""}.</b> {b.cancel_reason}
                    {b.cancel_charge !== null && b.cancel_charge !== undefined && <span className="text-default-600"> · Client cancellation charge {rupees(b.cancel_charge)}</span>}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {b.status !== "cancelled" && <>
                    <Button size="sm" variant="flat" color="success" startContent={<MessageCircle size={14} />} onPress={() => tripKit(false)}>Send trip page on WhatsApp</Button>
                    {b.client?.email && <Button size="sm" variant="flat" onPress={() => tripKit(true)}>Email trip page</Button>}
                    <Button size="sm" variant="flat" startContent={<ExternalLink size={14} />} onPress={async () => { const w = window.open("", "_blank"); const { success, data } = await commonPostAPICall({}, `travel/bookings/${id}/kit`, false); if (success && w) w.location.href = data.url; else w?.close(); }}>Open trip page</Button>
                </>}
                <Button size="sm" variant="flat" startContent={<Printer size={14} />} onPress={() => openPdf(`travel/bookings/${id}/vouchers.pdf`)}>Vouchers PDF</Button>
                {b.invoice ? <Button size="sm" variant="flat" startContent={<Receipt size={14} />} onPress={() => navigate(`/fees/${b.invoice.id}`)}>Invoice {b.invoice.number}</Button>
                    : (canMoney || teamRole === "branch_manager") && <Button size="sm" variant="flat" color="primary" startContent={<Receipt size={14} />} onPress={openInvoice}>Create GST invoice</Button>}
                {b.itinerary && <Button size="sm" variant="light" startContent={<FileText size={14} />} onPress={() => navigate(`/travel/itineraries/${b.itinerary.id}`)}>Itinerary</Button>}
                {b.lead_id && <Button size="sm" variant="light" onPress={() => navigate(`/crm/leads/${b.lead_id}`)}>Lead</Button>}
                {b.status !== "cancelled" && (canMoney || teamRole === "branch_manager") && <Button size="sm" variant="light" color="danger" className="sm:ml-auto" startContent={<Ban size={14} />} onPress={cancelModal.onOpen}>Cancel booking</Button>}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <Tile label="Dates" value={<span className="text-base">{fmtRange(b.start_date, b.end_date)}</span>} hint={b.destination || undefined} />
                <Tile label="Client pays" value={rupees(b.client_total)} hint={`GST ${rupees(b.gst)}${b.tcs ? ` · TCS ${rupees(b.tcs)}` : ""}`} />
                {b.invoice ? <Tile label="Received" value={rupees(b.invoice.paid)} hint={`of ${rupees(b.invoice.total)}`} tone={b.invoice.paid >= b.invoice.total ? "success" : undefined} />
                    : <Tile label="Invoice" value={<span className="text-base">Not raised</span>} />}
                {b.sees_cost ? <Tile label="Real profit" value={rupees(b.profit)} hint={`Cost ${rupees(b.total_cost)} · Sell ${rupees(b.total_sell - (b.credited || 0))}`} tone={b.profit >= 0 ? "success" : "danger"} />
                    : <Tile label="Services" value={(b.services || []).length} />}
            </div>

            <Card shadow="sm"><CardBody className="gap-2">
                <div className="flex items-center justify-between"><div className="font-semibold">Services</div><Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => openService()}>Add service</Button></div>
                {!(b.services || []).length ? <p className="text-sm text-default-500">No services yet.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[820px]">
                            <thead className="text-xs text-default-500 text-left"><tr>
                                <th className="p-2">Service</th><th className="p-2">Supplier</th><th className="p-2">Date</th><th className="p-2">Confirmation</th><th className="p-2">Status</th>
                                {b.sees_cost && <><th className="p-2 text-right">Cost</th><th className="p-2 text-right">Supplier due</th></>}<th className="p-2" />
                            </tr></thead>
                            <tbody>
                                {b.services.map((s: any) => (
                                    <tr key={s.id} className="border-t border-default-100 align-top">
                                        <td className="p-2"><div className="font-medium">{s.description}</div><div className="text-xs text-default-500">{serviceLabel(s.type)}</div></td>
                                        <td className="p-2">{s.supplier_name || <span className="text-default-400">-</span>}</td>
                                        <td className="p-2 whitespace-nowrap">{fmtDate(s.service_date)}</td>
                                        <td className="p-2">{s.confirmation_no || <span className="text-default-400">Pending</span>}</td>
                                        <td className="p-2"><Chip size="sm" variant="flat" color={SERVICE_STATUS[s.status]?.color}>{SERVICE_STATUS[s.status]?.label}</Chip>{s.status === "cancelled" && s.cancelled_at && <div className="text-[11px] text-default-400 mt-0.5">{fmtDate(s.cancelled_at)}</div>}</td>
                                        {b.sees_cost && <>
                                            <td className="p-2 text-right">{s.status === "cancelled" ? <><span className="line-through text-default-400">{rupees(s.cost)}</span><div className="text-[11px] text-warning-600">keeps {rupees(s.supplier_cancel_charge || 0)}</div></> : rupees(s.cost)}</td>
                                            <td className={`p-2 text-right ${s.supplier_due > 0 && s.supplier_due_date && s.supplier_due_date < new Date().toISOString().slice(0, 10) ? "text-danger font-medium" : ""}`}>
                                                {s.supplier_refund_due > 0 ? <span className="text-success-600">{rupees(s.supplier_refund_due)} back</span> : s.supplier_id ? rupees(s.supplier_due) : "-"}
                                                {s.supplier_due > 0 && s.supplier_due_date ? <div className="text-[11px] text-default-500">by {fmtDate(s.supplier_due_date)}</div> : null}
                                                {s.supplier_refunded > 0 && <div className="text-[11px] text-default-500">{rupees(s.supplier_refunded)} refunded</div>}
                                            </td>
                                        </>}
                                        <td className="p-2 whitespace-nowrap text-right">
                                            {s.status !== "cancelled" && ["hotel", "transfer", "activity", "other"].includes(s.type) && <Button isIconOnly size="sm" variant="light" aria-label="Voucher" onPress={() => openPdf(`travel/bookings/${id}/vouchers.pdf?service=${s.id}`)}><Printer size={14} /></Button>}
                                            {canMoney && s.supplier_id && s.supplier_due > 0 && <Button isIconOnly size="sm" variant="light" aria-label="Pay supplier" title="Pay supplier" onPress={() => { setPay({ service: s, amount: String(s.supplier_due), reference: "", paid_at: new Date().toISOString().slice(0, 10) }); payModal.onOpen(); }}><Wallet size={14} /></Button>}
                                            {canMoney && s.supplier_refund_due > 0 && <Button isIconOnly size="sm" variant="light" color="success" aria-label="Refund received" title="Supplier refund received" onPress={() => { setMoney(s); refundModal.onOpen(); }}><Undo2 size={14} /></Button>}
                                            {s.status !== "cancelled" && b.status !== "cancelled" && <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Cancel service" title="Cancel service" onPress={() => { setMoney(s); cancelSvcModal.onOpen(); }}><XCircle size={14} /></Button>}
                                            {s.status !== "cancelled" && <Button isIconOnly size="sm" variant="light" aria-label="Edit" onPress={() => openService(s)}><Pencil size={14} /></Button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardBody></Card>

            <Card shadow="sm"><CardBody className="gap-2">
                <div className="flex items-center justify-between"><div className="font-semibold">Travellers</div><Button size="sm" variant="flat" startContent={<UserPlus size={14} />} onPress={() => { setPax(emptyTraveller); paxModal.onOpen(); }}>Add traveller</Button></div>
                {b.is_international && Number(b.tcs_percent) > 0 && !(b.travellers || []).some((t: any) => t.is_lead && t.has_pan) && (
                    <div className="text-xs rounded-lg bg-warning-50 border border-warning-200 p-2">Add the lead traveller's PAN. It is needed for TCS on overseas packages before you raise the invoice.</div>
                )}
                <div className="flex flex-col divide-y divide-default-100">
                    {(b.travellers || []).map((t: any) => (
                        <div key={t.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <div className="font-medium min-w-[160px]">{t.name}{t.is_lead && <Chip size="sm" variant="flat" className="ml-2">Lead</Chip>}</div>
                            <div className="text-default-500 capitalize">{t.pax_type}{t.dob ? ` · DOB ${fmtDate(t.dob)}` : ""}</div>
                            <div className="text-default-500">Passport {revealed[t.id]?.passport_no || t.passport_masked || "not added"}{t.passport_expiry ? ` · expires ${fmtDate(t.passport_expiry)}` : ""}</div>
                            <div className="text-default-500">PAN {revealed[t.id] ? (revealed[t.id].pan || "-") : t.has_pan ? "added" : "not added"}</div>
                            <div className="ml-auto flex gap-1">
                                <Button size="sm" variant="light" onPress={() => post({}, `travel/bookings/travellers/${t.id}/save_to_profile`)}>Save to profile</Button>
                                {(t.passport_masked || t.has_pan) && !revealed[t.id] && <Button isIconOnly size="sm" variant="light" aria-label="Show IDs (logged)" title="Show full passport / PAN (this view is logged)" onPress={() => reveal(t.id)}><Eye size={14} /></Button>}
                                <Button isIconOnly size="sm" variant="light" aria-label="Edit" onPress={() => { setPax({ ...emptyTraveller, ...t, passport_no: "", pan: "", dob: t.dob || "", passport_expiry: t.passport_expiry || "" }); paxModal.onOpen(); }}><Pencil size={14} /></Button>
                                {!t.is_lead && <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Remove" onPress={() => post({}, `travel/bookings/travellers/${t.id}/delete`)}><Trash2 size={14} /></Button>}
                            </div>
                        </div>
                    ))}
                </div>
            </CardBody></Card>

            <BookingDocuments bookingId={String(id)} />
            <BookingMoneyCard bookingId={String(id)} rev={rev} />
            <BookingCreditNotes key={rev} bookingId={String(id)} hasInvoice={Boolean(b.invoice)} onChanged={load} />
            {b.client?.id && <ClientProfileCard clientId={b.client.id} bookingId={String(id)} onChanged={load} />}

            <Card shadow="sm"><CardBody>
                <Field label="Operations notes"><Textarea aria-label="Notes" minRows={2} defaultValue={b.notes || ""} onBlur={(e) => e.target.value !== (b.notes || "") && post({ notes: e.target.value }, `travel/bookings/${id}/update`, false)} /></Field>
            </CardBody></Card>

            {/* service */}
            <Modal isOpen={svcModal.isOpen} onOpenChange={svcModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>{svc.id ? "Edit service" : "Add service"}</ModalHeader>
                    <ModalBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Type"><Select aria-label="Type" selectedKeys={[svc.type]} onChange={(e) => setSvc((v: any) => ({ ...v, type: e.target.value || "other" }))}>{SERVICE_TYPES.filter((s) => s.key !== "meal").map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}</Select></Field>
                        <Field label="Status"><Select aria-label="Status" selectedKeys={[svc.status]} description={svc.id ? "To cancel, use the cancel button on the service so the supplier's charge is recorded." : undefined} onChange={(e) => setSvc((v: any) => ({ ...v, status: e.target.value || "requested" }))}>{Object.entries(SERVICE_STATUS).filter(([k]) => k !== "cancelled").map(([k, v]) => <SelectItem key={k}>{v.label}</SelectItem>)}</Select></Field>
                        <Field label="Description" className="sm:col-span-2"><Input aria-label="Description" value={svc.description} onValueChange={(x) => setSvc((v: any) => ({ ...v, description: x }))} /></Field>
                        <Field label="Supplier"><Select aria-label="Supplier" placeholder={suppliers.length ? "Choose supplier" : "Add suppliers under Travel → Suppliers"} selectedKeys={svc.supplier_id ? [svc.supplier_id] : []} onChange={(e) => setSvc((v: any) => ({ ...v, supplier_id: e.target.value }))}>{suppliers.map((s) => <SelectItem key={s.id}>{s.name}</SelectItem>)}</Select></Field>
                        <Field label={svc.type === "flight" ? "PNR / ticket no." : "Confirmation no."}><Input aria-label="Confirmation" value={svc.confirmation_no || ""} onValueChange={(x) => setSvc((v: any) => ({ ...v, confirmation_no: x }))} /></Field>
                        <Field label={svc.type === "hotel" ? "Check-in" : "Date"}><Input aria-label="Date" type="date" value={svc.service_date} onValueChange={(x) => setSvc((v: any) => ({ ...v, service_date: x }))} /></Field>
                        <Field label={svc.type === "hotel" ? "Check-out" : "End date (optional)"}><Input aria-label="End date" type="date" value={svc.end_date} onValueChange={(x) => setSvc((v: any) => ({ ...v, end_date: x }))} /></Field>
                        {svc.type === "hotel" && <>
                            <Field label="Room type"><Input aria-label="Room type" value={svc.details.room_type || ""} onValueChange={(x) => setSvc((v: any) => ({ ...v, details: { ...v.details, room_type: x } }))} /></Field>
                            <Field label="Meal plan"><Input aria-label="Meal plan" placeholder="CP / MAP / AP" value={svc.details.meal_plan || ""} onValueChange={(x) => setSvc((v: any) => ({ ...v, details: { ...v.details, meal_plan: x } }))} /></Field>
                        </>}
                        {["transfer", "activity"].includes(svc.type) && <Field label="Pick-up time and place"><Input aria-label="Pick-up" value={svc.details.pickup_time || ""} onValueChange={(x) => setSvc((v: any) => ({ ...v, details: { ...v.details, pickup_time: x } }))} /></Field>}
                        {b.sees_cost && <>
                            <Field label="Supplier cost ₹"><Input aria-label="Cost" type="number" value={String(svc.cost)} onValueChange={(x) => setSvc((v: any) => ({ ...v, cost: x }))} /></Field>
                            <Field label="Selling price ₹"><Input aria-label="Sell" type="number" value={String(svc.sell)} onValueChange={(x) => setSvc((v: any) => ({ ...v, sell: x }))} /></Field>
                            <Field label="Pay supplier by"><Input aria-label="Pay supplier by" type="date" value={svc.supplier_due_date} onValueChange={(x) => setSvc((v: any) => ({ ...v, supplier_due_date: x }))} /></Field>
                        </>}
                    </ModalBody>
                    <ModalFooter>
                        {svc.id && <Button variant="light" color="danger" className="mr-auto" onPress={async () => { if (await post({}, `travel/bookings/services/${svc.id}/delete`)) close(); }}>Remove</Button>}
                        <Button variant="light" onPress={close}>Cancel</Button>
                        <Button color="primary" isLoading={busy} onPress={() => saveService(close)}>Save</Button>
                    </ModalFooter>
                </>)}</ModalContent>
            </Modal>

            {/* traveller */}
            <Modal isOpen={paxModal.isOpen} onOpenChange={paxModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>{pax.id ? "Edit traveller" : "Add traveller"}</ModalHeader>
                    <ModalBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Name as on passport" className="sm:col-span-2"><Input aria-label="Name" value={pax.name} onValueChange={(x) => setPax((v: any) => ({ ...v, name: x }))} /></Field>
                        <Field label="Type"><Select aria-label="Type" selectedKeys={[pax.pax_type]} onChange={(e) => setPax((v: any) => ({ ...v, pax_type: e.target.value || "adult" }))}><SelectItem key="adult">Adult</SelectItem><SelectItem key="child">Child</SelectItem><SelectItem key="infant">Infant</SelectItem></Select></Field>
                        <Field label="Date of birth"><Input aria-label="DOB" type="date" value={pax.dob} onValueChange={(x) => setPax((v: any) => ({ ...v, dob: x }))} /></Field>
                        <Field label={pax.id && pax.passport_masked ? `Passport number (saved ${pax.passport_masked}; type to replace)` : "Passport number"}><Input aria-label="Passport" value={pax.passport_no} onValueChange={(x) => setPax((v: any) => ({ ...v, passport_no: x }))} /></Field>
                        <Field label="Passport expiry"><Input aria-label="Passport expiry" type="date" value={pax.passport_expiry} onValueChange={(x) => setPax((v: any) => ({ ...v, passport_expiry: x }))} /></Field>
                        <Field label={pax.id && pax.has_pan ? "PAN (saved; type to replace)" : "PAN (needed for overseas trips)"}><Input aria-label="PAN" placeholder="ABCDE1234F" value={pax.pan} onValueChange={(x) => setPax((v: any) => ({ ...v, pan: x }))} /></Field>
                        <Field label="Nationality"><Input aria-label="Nationality" value={pax.nationality || ""} onValueChange={(x) => setPax((v: any) => ({ ...v, nationality: x }))} /></Field>
                        <Field label="Meal preference"><Input aria-label="Meal preference" placeholder="Veg / Jain / Non-veg" value={pax.meal_pref || ""} onValueChange={(x) => setPax((v: any) => ({ ...v, meal_pref: x }))} /></Field>
                        <Field label="Seat preference"><Input aria-label="Seat preference" placeholder="Window / Aisle" value={pax.seat_pref || ""} onValueChange={(x) => setPax((v: any) => ({ ...v, seat_pref: x }))} /></Field>
                        <p className="text-xs text-default-500 sm:col-span-2">Passport numbers and PAN are stored encrypted. Only the last 4 characters are shown, and every full view is logged.</p>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={() => saveTraveller(close)}>Save</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>

            {/* supplier payment */}
            <Modal isOpen={payModal.isOpen} onOpenChange={payModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader>Pay supplier</ModalHeader>
                    <ModalBody className="gap-3">
                        <div className="text-sm">{pay.service?.description} · {pay.service?.supplier_name}</div>
                        <Field label="Amount ₹"><Input aria-label="Amount" type="number" value={pay.amount} onValueChange={(x) => setPay((v: any) => ({ ...v, amount: x }))} /></Field>
                        <Field label="Paid on"><Input aria-label="Paid on" type="date" value={pay.paid_at} onValueChange={(x) => setPay((v: any) => ({ ...v, paid_at: x }))} /></Field>
                        <Field label="Reference (UTR / cheque no.)"><Input aria-label="Reference" value={pay.reference} onValueChange={(x) => setPay((v: any) => ({ ...v, reference: x }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => { if (await post({ amount: Number(pay.amount), paid_at: pay.paid_at, reference: pay.reference }, `travel/bookings/services/${pay.service.id}/supplier_payment`)) close(); }}>Record payment</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>

            <CancelBookingModal booking={{ ...b, can_money: canMoney }} isOpen={cancelModal.isOpen} onOpenChange={cancelModal.onOpenChange} onDone={load} />
            <CancelServiceModal service={money} booking={{ ...b, can_money: canMoney }} isOpen={cancelSvcModal.isOpen} onOpenChange={cancelSvcModal.onOpenChange} onDone={load} />
            <SupplierRefundModal service={money} isOpen={refundModal.isOpen} onOpenChange={refundModal.onOpenChange} onDone={load} />

            {/* invoice */}
            <Modal isOpen={invModal.isOpen} onOpenChange={invModal.onOpenChange} size="xl">
                <ModalContent>{(close) => (<>
                    <ModalHeader>GST invoice for {b.booking_no}</ModalHeader>
                    <ModalBody className="gap-3">
                        <div className="text-sm grid grid-cols-2 gap-1">
                            <span className="text-default-500">Package price</span><span className="text-right">{rupees(b.total_sell)}</span>
                            <span className="text-default-500">GST {b.gst_percent}%{b.billing_mode === "margin" ? " on margin" : ""}</span><span className="text-right">{rupees(b.gst)}</span>
                            {b.tcs > 0 && <><span className="text-default-500">TCS {b.tcs_percent}%</span><span className="text-right">{rupees(b.tcs)}</span></>}
                            <span className="font-semibold">Total</span><span className="text-right font-semibold">{rupees(b.client_total)}</span>
                        </div>
                        <Field label="Client's state code (place of supply, for IGST)"><Input aria-label="Place of supply" placeholder="Same state as your GSTIN if empty, e.g. 27 for Maharashtra" maxLength={2} value={inv.place_of_supply} onValueChange={(x) => setInv((v: any) => ({ ...v, place_of_supply: x.replace(/\D/g, "") }))} /></Field>
                        <Field label="Payment plan"><Select aria-label="Payment plan" selectedKeys={[inv.plan]} onChange={(e) => setInv((v: any) => ({ ...v, plan: e.target.value || "full" }))}><SelectItem key="instalments">Advance, second and final payment</SelectItem><SelectItem key="full">One payment</SelectItem></Select></Field>
                        {inv.plan === "full" ? (
                            <Field label="Due date"><Input aria-label="Due date" type="date" value={inv.due_date} onValueChange={(x) => setInv((v: any) => ({ ...v, due_date: x }))} /></Field>
                        ) : inv.rows.map((r: any, i: number) => (
                            <div key={i} className="grid grid-cols-3 gap-2">
                                <Input aria-label="Label" size="sm" value={r.label} onValueChange={(x) => setInv((v: any) => { const rows = [...v.rows]; rows[i] = { ...rows[i], label: x }; return { ...v, rows }; })} />
                                <Input aria-label="Amount" size="sm" type="number" value={r.amount} onValueChange={(x) => setInv((v: any) => { const rows = [...v.rows]; rows[i] = { ...rows[i], amount: x }; return { ...v, rows }; })} />
                                <Input aria-label="Due" size="sm" type="date" value={r.due_date} onValueChange={(x) => setInv((v: any) => { const rows = [...v.rows]; rows[i] = { ...rows[i], due_date: x }; return { ...v, rows }; })} />
                            </div>
                        ))}
                        <p className="text-xs text-default-500">The invoice appears in Client fees with a payment link and automatic WhatsApp reminders before each due date.</p>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={() => createInvoice(close)}>Create invoice</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

export default BookingDetails;
