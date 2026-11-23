import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, useDisclosure } from "@heroui/react";
import { FileUp, Trash2, UserPlus } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { Field, fmtDate, rupees } from "./travelShared";

const KINDS = [{ key: "ticket", label: "Ticket" }, { key: "visa", label: "Visa" }, { key: "insurance", label: "Insurance" }, { key: "voucher", label: "Voucher" }, { key: "passport", label: "Passport copy (not shared)" }, { key: "other", label: "Other" }];

/** Tickets, visas, insurance and other files on a booking (VC-02). Shared ones show on the client's trip kit page. */
export const BookingDocuments = ({ bookingId }: { bookingId: string }) => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const token = useSelector((s: any) => s.login.token);
    const [docs, setDocs] = useState<any[]>([]);
    const [kind, setKind] = useState("ticket");
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const load = async () => { const { success, data } = await commonGetAPICalls(`/travel/bookings/${bookingId}/documents`); if (success) setDocs(data); };
    useEffect(() => { load(); }, [bookingId]);
    const upload = async (files: FileList | null) => {
        if (!files?.length) return;
        const fd = new FormData();
        Array.from(files).slice(0, 5).forEach((f) => fd.append("files", f));
        fd.append("kind", kind);
        setBusy(true);
        try {
            const r = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/v1/travel/bookings/${bookingId}/documents`, fd, { headers: { Authorization: `Bearer ${token}` } });
            if (r.data?.success) { SuccessToast(r.data.message); load(); } else ErrorToast(r.data?.message || "Upload failed");
        } catch (e: any) { ErrorToast(e?.response?.data?.message || "Upload failed"); }
        setBusy(false);
        if (input.current) input.current.value = "";
    };
    return (
        <Card shadow="sm"><CardBody className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold flex-1">Tickets & documents</div>
                <Select aria-label="Document type" size="sm" className="w-48" selectedKeys={[kind]} onChange={(e) => setKind(e.target.value || "other")}>{KINDS.map((k) => <SelectItem key={k.key}>{k.label}</SelectItem>)}</Select>
                <input ref={input} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx" className="hidden" onChange={(e) => upload(e.target.files)} />
                <Button size="sm" variant="flat" isLoading={busy} startContent={<FileUp size={14} />} onPress={() => input.current?.click()}>Upload</Button>
            </div>
            {!docs.length ? <p className="text-sm text-default-500">Upload e-tickets, visas and insurance here. Shared files appear on the client's trip kit page.</p> : (
                <div className="flex flex-col divide-y divide-default-100">
                    {docs.map((d) => (
                        <div key={d.id} className="py-2 flex items-center gap-2 text-sm">
                            <a href={d.url} target="_blank" rel="noopener" className="text-primary font-medium truncate flex-1">{d.name}</a>
                            <Chip size="sm" variant="flat">{KINDS.find((k) => k.key === d.kind)?.label.split(" (")[0] || d.kind}</Chip>
                            {!d.share_with_client && <Chip size="sm" variant="flat" color="warning">Not shared</Chip>}
                            <Button isIconOnly size="sm" variant="light" aria-label="Remove" onPress={async () => { const { success } = await commonPostAPICall({}, `travel/bookings/documents/${d.id}/delete`, true); if (success) load(); }}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                </div>
            )}
        </CardBody></Card>
    );
};

/** GST credit notes after cancellations / changes, and refunds paid back (PY-03, PY-07, BK-06). */
export const BookingCreditNotes = ({ bookingId, hasInvoice, onChanged }: { bookingId: string; hasInvoice: boolean; onChanged: () => void }) => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const role = useSelector((s: any) => s.login.team_role);
    const canMoney = role === "owner" || role === "accounts";
    const [rows, setRows] = useState<any[]>([]);
    const cnModal = useDisclosure();
    const refundModal = useDisclosure();
    const [form, setForm] = useState({ amount: "", reason: "" });
    const [refund, setRefund] = useState<any>({ note: null, amount: "", reference: "" });
    const [busy, setBusy] = useState(false);
    const load = async () => { const { success, data } = await commonGetAPICalls(`/travel/bookings/${bookingId}/credit_notes`); if (success) setRows(data); };
    useEffect(() => { load(); }, [bookingId]);
    if (!canMoney || !hasInvoice) return null;
    return (
        <Card shadow="sm"><CardBody className="gap-2">
            <div className="flex items-center justify-between"><div className="font-semibold">Credit notes & refunds</div><Button size="sm" variant="flat" onPress={() => { setForm({ amount: "", reason: "" }); cnModal.onOpen(); }}>Issue credit note</Button></div>
            {!rows.length ? <p className="text-sm text-default-500">Use a credit note when a service is cancelled or the price drops. It lowers the invoice; if the client already paid more, the difference becomes a refund.</p> : (
                <div className="flex flex-col divide-y divide-default-100 text-sm">
                    {rows.map((r) => (
                        <div key={r.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-medium">{r.number}</span><span>{rupees(r.amount)}</span><span className="text-default-500 flex-1">{r.reason} · {fmtDate(r.issue_date)}</span>
                            {r.refund_due > 0 && <span className={r.refunded >= r.refund_due ? "text-success" : "text-warning-600"}>Refund {rupees(r.refunded)} of {rupees(r.refund_due)}</span>}
                            {r.refund_due > r.refunded && <Button size="sm" variant="flat" onPress={() => { setRefund({ note: r, amount: String(r.refund_due - r.refunded), reference: "" }); refundModal.onOpen(); }}>Record refund</Button>}
                        </div>
                    ))}
                </div>
            )}
            <Modal isOpen={cnModal.isOpen} onOpenChange={cnModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader>Issue credit note</ModalHeader>
                    <ModalBody className="gap-3">
                        <Field label="Amount to credit, including GST ₹"><Input aria-label="Amount" type="number" value={form.amount} onValueChange={(v) => setForm((f) => ({ ...f, amount: v }))} /></Field>
                        <Field label="Reason"><Textarea aria-label="Reason" minRows={2} placeholder="e.g. Desert safari cancelled by the client" value={form.reason} onValueChange={(v) => setForm((f) => ({ ...f, reason: v }))} /></Field>
                        <p className="text-xs text-default-500">GST is reduced in the same proportion as on the invoice. Later instalments shrink first.</p>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => { setBusy(true); const { success } = await commonPostAPICall({ amount: Number(form.amount), reason: form.reason }, `travel/bookings/${bookingId}/credit_note`, true); setBusy(false); if (success) { close(); load(); onChanged(); } }}>Issue</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
            <Modal isOpen={refundModal.isOpen} onOpenChange={refundModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader>Refund against {refund.note?.number}</ModalHeader>
                    <ModalBody className="gap-3">
                        <Field label="Amount refunded ₹"><Input aria-label="Amount" type="number" value={refund.amount} onValueChange={(v) => setRefund((r: any) => ({ ...r, amount: v }))} /></Field>
                        <Field label="Reference (UTR / cheque no.)"><Input aria-label="Reference" value={refund.reference} onValueChange={(v) => setRefund((r: any) => ({ ...r, reference: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => { setBusy(true); const { success } = await commonPostAPICall({ amount: Number(refund.amount), reference: refund.reference }, `travel/credit_notes/${refund.note.id}/refund`, true); setBusy(false); if (success) { close(); load(); onChanged(); } }}>Record refund</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </CardBody></Card>
    );
};

const emptyMember = { id: "", name: "", relation: "", pax_type: "adult", dob: "", anniversary: "", passport_no: "", passport_expiry: "", pan: "", meal_pref: "", seat_pref: "" };

/** The client behind a booking: preferences, family members (one tap onto the booking) and past trips (CP-01). */
export const ClientProfileCard = ({ clientId, bookingId, onChanged }: { clientId: number; bookingId: string; onChanged: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((s: any) => s.login.team_role) === "owner";
    const [d, setD] = useState<any>(null);
    const [prefs, setPrefs] = useState<any>({});
    const memberModal = useDisclosure();
    const eraseModal = useDisclosure();
    const [m, setM] = useState<any>(emptyMember);
    const [erase, setErase] = useState({ confirm: "", reason: "" });
    const [busy, setBusy] = useState(false);
    const load = async () => { const { success, data } = await commonGetAPICalls(`/travel/clients/${clientId}`); if (success) { setD(data); setPrefs(data.prefs || {}); } };
    useEffect(() => { if (clientId) load(); }, [clientId]);
    if (!d) return null;
    const setP = (k: string) => (v: string) => setPrefs((p: any) => ({ ...p, [k]: v }));
    return (
        <Card shadow="sm"><CardBody className="gap-3">
            <div className="flex items-center justify-between"><div className="font-semibold">Client profile · {d.client.name}</div>{isOwner && <Button size="sm" variant="light" color="danger" onPress={() => { setErase({ confirm: "", reason: "" }); eraseModal.onOpen(); }}>Erase personal data</Button>}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Field label="Meal"><Input aria-label="Meal" size="sm" placeholder="Veg / Jain" value={prefs.meal || ""} onValueChange={setP("meal")} /></Field>
                <Field label="Seat"><Input aria-label="Seat" size="sm" placeholder="Window" value={prefs.seat || ""} onValueChange={setP("seat")} /></Field>
                <Field label="Hotel"><Input aria-label="Hotel" size="sm" placeholder="4 star, near beach" value={prefs.hotel || ""} onValueChange={setP("hotel")} /></Field>
                <Field label="Room"><Input aria-label="Room" size="sm" placeholder="Twin, non-smoking" value={prefs.room || ""} onValueChange={setP("room")} /></Field>
                <Field label="Birthday"><Input aria-label="Birthday" size="sm" type="date" value={prefs.birthday || ""} onValueChange={setP("birthday")} /></Field>
                <Field label="Anniversary"><Input aria-label="Anniversary" size="sm" type="date" value={prefs.anniversary || ""} onValueChange={setP("anniversary")} /></Field>
                <Field label="Interests" className="col-span-2"><Input aria-label="Interests" size="sm" placeholder="Beaches, shopping, adventure" value={prefs.interests || ""} onValueChange={setP("interests")} /></Field>
            </div>
            <div className="flex justify-end"><Button size="sm" variant="flat" onPress={async () => { const { success } = await commonPostAPICall(prefs, `travel/clients/${clientId}/prefs`, true); if (success) load(); }}>Save preferences</Button></div>

            <div className="flex items-center justify-between"><div className="text-sm font-medium">Family members</div><Button size="sm" variant="light" startContent={<UserPlus size={14} />} onPress={() => { setM(emptyMember); memberModal.onOpen(); }}>Add</Button></div>
            {!d.members.length ? <p className="text-xs text-default-500">Save the family once; next time add them to a booking in one tap. Use “Save to profile” on a traveller to keep them.</p> : (
                <div className="flex flex-col divide-y divide-default-100 text-sm">
                    {d.members.map((x: any) => (
                        <div key={x.id} className="py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium">{x.name}</span><span className="text-default-500 capitalize">{[x.relation, x.pax_type, x.dob ? `DOB ${fmtDate(x.dob)}` : "", x.passport_masked ? `Passport ${x.passport_masked}` : ""].filter(Boolean).join(" · ")}</span>
                            <div className="ml-auto flex gap-1">
                                {bookingId && <Button size="sm" variant="flat" onPress={async () => { const { success } = await commonPostAPICall({ member_id: x.id }, `travel/bookings/${bookingId}/travellers/from_member`, true); if (success) onChanged(); }}>Add to booking</Button>}
                                <Button isIconOnly size="sm" variant="light" aria-label="Remove" onPress={async () => { const { success } = await commonPostAPICall({}, `travel/clients/members/${x.id}/delete`, true); if (success) load(); }}><Trash2 size={14} /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {bookingId && d.trips.length > 1 && (<>
                <div className="text-sm font-medium">Past and other trips</div>
                <div className="flex flex-wrap gap-2">{d.trips.filter((t: any) => t.id !== bookingId).map((t: any) => <Chip key={t.id} variant="flat" className="cursor-pointer" onClick={() => navigate(`/travel/bookings/${t.id}`)}>{t.booking_no} · {t.title} · {fmtDate(t.start_date)}</Chip>)}</div>
            </>)}

            <Modal isOpen={memberModal.isOpen} onOpenChange={memberModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>Add family member</ModalHeader>
                    <ModalBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Name as on passport" className="sm:col-span-2"><Input aria-label="Name" value={m.name} onValueChange={(v) => setM((x: any) => ({ ...x, name: v }))} /></Field>
                        <Field label="Relation"><Input aria-label="Relation" placeholder="Spouse / Son / Mother" value={m.relation} onValueChange={(v) => setM((x: any) => ({ ...x, relation: v }))} /></Field>
                        <Field label="Type"><Select aria-label="Type" selectedKeys={[m.pax_type]} onChange={(e) => setM((x: any) => ({ ...x, pax_type: e.target.value || "adult" }))}><SelectItem key="adult">Adult</SelectItem><SelectItem key="child">Child</SelectItem><SelectItem key="infant">Infant</SelectItem></Select></Field>
                        <Field label="Date of birth"><Input aria-label="DOB" type="date" value={m.dob} onValueChange={(v) => setM((x: any) => ({ ...x, dob: v }))} /></Field>
                        <Field label="Passport number"><Input aria-label="Passport" value={m.passport_no} onValueChange={(v) => setM((x: any) => ({ ...x, passport_no: v }))} /></Field>
                        <Field label="Passport expiry"><Input aria-label="Passport expiry" type="date" value={m.passport_expiry} onValueChange={(v) => setM((x: any) => ({ ...x, passport_expiry: v }))} /></Field>
                        <Field label="PAN"><Input aria-label="PAN" value={m.pan} onValueChange={(v) => setM((x: any) => ({ ...x, pan: v }))} /></Field>
                        <Field label="Meal preference"><Input aria-label="Meal" value={m.meal_pref} onValueChange={(v) => setM((x: any) => ({ ...x, meal_pref: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => { setBusy(true); const body: any = { ...m }; delete body.id; for (const k of ["passport_no", "pan"]) if (!body[k]) delete body[k]; const { success } = await commonPostAPICall(body, `travel/clients/${clientId}/members`, true); setBusy(false); if (success) { close(); load(); } }}>Save</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
            <Modal isOpen={eraseModal.isOpen} onOpenChange={eraseModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader>Erase {d.client.name}'s personal data</ModalHeader>
                    <ModalBody className="gap-3">
                        <p className="text-sm">For a deletion request under the DPDP Act. This permanently removes passport numbers, PAN, dates of birth, uploaded documents, family members, preferences and email. Bookings and invoices stay because GST law requires them. This can not be undone.</p>
                        <Field label="Reason / request reference"><Input aria-label="Reason" value={erase.reason} onValueChange={(v) => setErase((e) => ({ ...e, reason: v }))} /></Field>
                        <Field label="Type ERASE to confirm"><Input aria-label="Confirm" value={erase.confirm} onValueChange={(v) => setErase((e) => ({ ...e, confirm: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="danger" isDisabled={erase.confirm !== "ERASE"} isLoading={busy} onPress={async () => { setBusy(true); const { success } = await commonPostAPICall(erase, `travel/clients/${clientId}/erase`, true); setBusy(false); if (success) { close(); load(); onChanged(); } }}>Erase permanently</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </CardBody></Card>
    );
};
