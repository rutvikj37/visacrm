import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Textarea, useDisclosure } from "@heroui/react";
import { ArrowLeft, Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { Field, PageHead, RATE_TYPES, SERVICE_TYPES, SUPPLIER_TYPES, Tile, fmtDate, rupees } from "./travelShared";

const emptySupplier = { id: "", type: "hotel", name: "", contact_name: "", phone: "", email: "", city: "", country: "", gstin: "", pan: "", bank_details: "", notes: "" };
const emptyRate = { service: "", service_type: "hotel", room_type: "", meal_plan: "", pax_type: "per_room", season: "", valid_from: "", valid_to: "", cost: "" };
const PAX = [{ key: "per_room", label: "Per room per night" }, { key: "per_adult", label: "Per adult" }, { key: "per_child", label: "Per child" }, { key: "per_infant", label: "Per infant" }, { key: "per_unit", label: "Per vehicle / unit" }];

const SupplierForm = ({ form, setForm }: { form: any; setForm: (f: any) => void }) => {
    const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" className="sm:col-span-2"><Input aria-label="Name" value={form.name} onValueChange={set("name")} /></Field>
            <Field label="Type"><Select aria-label="Type" selectedKeys={[form.type]} onChange={(e) => set("type")(e.target.value || "other")}>{SUPPLIER_TYPES.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}</Select></Field>
            <Field label="Contact person"><Input aria-label="Contact person" value={form.contact_name || ""} onValueChange={set("contact_name")} /></Field>
            <Field label="Phone / WhatsApp"><Input aria-label="Phone" value={form.phone || ""} onValueChange={set("phone")} /></Field>
            <Field label="Email"><Input aria-label="Email" value={form.email || ""} onValueChange={set("email")} /></Field>
            <Field label="City"><Input aria-label="City" value={form.city || ""} onValueChange={set("city")} /></Field>
            <Field label="Country"><Input aria-label="Country" value={form.country || ""} onValueChange={set("country")} /></Field>
            <Field label="GSTIN"><Input aria-label="GSTIN" value={form.gstin || ""} onValueChange={set("gstin")} /></Field>
            <Field label="PAN"><Input aria-label="PAN" value={form.pan || ""} onValueChange={set("pan")} /></Field>
            <Field label={form.has_bank ? "Bank details (saved, encrypted; type to replace)" : "Bank details (stored encrypted)"} className="sm:col-span-2"><Textarea aria-label="Bank details" minRows={2} value={form.bank_details || ""} onValueChange={set("bank_details")} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea aria-label="Notes" minRows={2} value={form.notes || ""} onValueChange={set("notes")} /></Field>
        </div>
    );
};

/** Supplier master with what is owed to each (SP-01, SP-03). */
export const Suppliers = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [rows, setRows] = useState<any[] | null>(null);
    const [search, setSearch] = useState("");
    const modal = useDisclosure();
    const [form, setForm] = useState<any>(emptySupplier);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/travel/suppliers${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
        setRows(success ? data : []);
    }, [search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const save = async (close: () => void) => {
        setSaving(true);
        const { success, data } = await commonPostAPICall(form, "travel/suppliers", true);
        setSaving(false);
        if (success) { close(); navigate(`/travel/suppliers/${data.id}`); }
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Suppliers" sub="Hotels, DMCs, transporters and airlines, their rates and what you owe them"
                actions={<Button color="primary" startContent={<Plus size={16} />} onPress={() => { setForm(emptySupplier); modal.onOpen(); }}>Add supplier</Button>} />
            <Input aria-label="Search" className="sm:max-w-xs" placeholder="Search supplier" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            {rows === null ? <CardListSkeleton /> : !rows.length ? (
                <EmptyState icon={Truck} title="No suppliers yet" text="Add the hotels, DMCs and cab operators you book with. Their rates then appear when you price a quote." actions={<Button color="primary" startContent={<Plus size={14} />} onPress={() => { setForm(emptySupplier); modal.onOpen(); }}>Add a supplier</Button>} />
            ) : (
                <div className="flex flex-col gap-2">
                    {rows.map((s) => (
                        <Card key={s.id} isPressable shadow="sm" onPress={() => navigate(`/travel/suppliers/${s.id}`)}>
                            <CardBody className="flex-row items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate">{s.name}</div>
                                    <div className="text-xs text-default-500 truncate">{[SUPPLIER_TYPES.find((t) => t.key === s.type)?.label, s.city, s.phone].filter(Boolean).join(" · ")}</div>
                                </div>
                                {s.supplier_due !== undefined && <div className="text-right"><div className="text-xs text-default-500">Owed</div><div className={`font-semibold ${s.supplier_due > 0 ? "text-warning-600" : ""}`}>{rupees(s.supplier_due)}</div></div>}
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>Add supplier</ModalHeader>
                    <ModalBody><SupplierForm form={form} setForm={setForm} /></ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={saving} onPress={() => save(close)}>Save</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

/** One supplier: rate contracts and the ledger of services booked with them (SP-02, SP-03). */
export const SupplierDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [d, setD] = useState<any>(null);
    const editModal = useDisclosure();
    const [form, setForm] = useState<any>(emptySupplier);
    const rateModal = useDisclosure();
    const [rate, setRate] = useState<any>(emptyRate);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        const { success, data } = await commonGetAPICalls(`/travel/suppliers/${id}`);
        if (success) setD(data);
    };
    useEffect(() => { load(); }, [id]);

    if (!d) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const s = d.supplier;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <div className="flex items-center gap-2">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate("/travel/suppliers")}><ArrowLeft size={18} /></Button>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-default-500">{SUPPLIER_TYPES.find((t) => t.key === s.type)?.label}{s.city ? ` · ${s.city}` : ""}</div>
                    <h1 className="text-xl font-semibold truncate">{s.name}</h1>
                </div>
                <Button variant="flat" startContent={<Pencil size={14} />} onPress={() => { setForm({ ...emptySupplier, ...s, bank_details: "" }); editModal.onOpen(); }}>Edit</Button>
            </div>
            <div className="text-sm text-default-600 flex flex-wrap gap-x-4 gap-y-1">
                {s.contact_name && <span>{s.contact_name}</span>}{s.phone && <a className="text-primary" href={`tel:${s.phone}`}>{s.phone}</a>}{s.email && <a className="text-primary" href={`mailto:${s.email}`}>{s.email}</a>}{s.gstin && <span>GSTIN {s.gstin}</span>}
            </div>
            {d.supplier_payable !== undefined && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Tile label="Booked with them" value={rupees(d.supplier_payable)} />
                    <Tile label="Paid" value={rupees(d.supplier_paid_total)} />
                    <Tile label="Still owed" value={rupees(d.supplier_payable - d.supplier_paid_total)} tone={d.supplier_payable - d.supplier_paid_total > 0 ? "danger" : undefined} />
                </div>
            )}

            <Card shadow="sm"><CardBody className="gap-2">
                <div className="flex items-center justify-between"><div className="font-semibold">Rate contracts</div><Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => { setRate({ ...emptyRate, service_type: s.type === "transport" ? "transfer" : s.type === "activity" ? "activity" : "hotel", pax_type: s.type === "hotel" ? "per_room" : "per_unit" }); rateModal.onOpen(); }}>Add rate</Button></div>
                {!d.rates.length ? <p className="text-sm text-default-500">No rates yet. Rates you add here show up when you price a quote.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                        <thead className="text-xs text-default-500 text-left"><tr><th className="p-2">Service</th><th className="p-2">Season</th><th className="p-2">Valid</th><th className="p-2">Basis</th><th className="p-2 text-right">Cost</th><th /></tr></thead>
                        <tbody>{d.rates.map((r: any) => (
                            <tr key={r.id} className="border-t border-default-100">
                                <td className="p-2"><div className="font-medium">{r.service}</div><div className="text-xs text-default-500">{[r.room_type, r.meal_plan].filter(Boolean).join(" · ")}</div></td>
                                <td className="p-2">{r.season || "-"}</td>
                                <td className="p-2 whitespace-nowrap">{r.valid_from || r.valid_to ? `${r.valid_from ? fmtDate(r.valid_from) : "…"} – ${r.valid_to ? fmtDate(r.valid_to) : "…"}` : "Any time"}</td>
                                <td className="p-2">{PAX.find((p) => p.key === r.pax_type)?.label}</td>
                                <td className="p-2 text-right">{r.cost !== undefined ? rupees(r.cost) : "-"}</td>
                                <td className="p-2 text-right"><Button isIconOnly size="sm" variant="light" aria-label="Remove rate" onPress={async () => { const { success } = await commonPostAPICall({}, `travel/suppliers/rates/${r.id}/delete`, true); if (success) load(); }}><Trash2 size={14} /></Button></td>
                            </tr>
                        ))}</tbody>
                    </table></div>
                )}
            </CardBody></Card>

            <Card shadow="sm"><CardBody className="gap-2">
                <div className="font-semibold">Ledger</div>
                {!d.ledger.length ? <p className="text-sm text-default-500">Nothing booked with this supplier yet.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                        <thead className="text-xs text-default-500 text-left"><tr><th className="p-2">Booking</th><th className="p-2">Service</th><th className="p-2">Date</th><th className="p-2 text-right">Cost</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Due</th></tr></thead>
                        <tbody>{d.ledger.map((l: any) => (
                            <tr key={l.id} className="border-t border-default-100 cursor-pointer hover:bg-default-50" onClick={() => l.booking && navigate(`/travel/bookings/${l.booking.id}`)}>
                                <td className="p-2">{l.booking?.booking_no}</td>
                                <td className="p-2">{l.description} <Chip size="sm" variant="flat" className="ml-1">{l.status}</Chip></td>
                                <td className="p-2 whitespace-nowrap">{fmtDate(l.service_date)}</td>
                                <td className="p-2 text-right">{l.cost !== undefined ? rupees(l.cost) : "-"}</td>
                                <td className="p-2 text-right">{l.supplier_paid !== undefined ? rupees(l.supplier_paid) : "-"}</td>
                                <td className={`p-2 text-right ${l.supplier_due > 0 ? "font-medium text-warning-600" : ""}`}>{l.supplier_due !== undefined ? rupees(l.supplier_due) : "-"}{l.supplier_due > 0 && l.supplier_due_date ? <div className="text-[11px] text-default-500">by {fmtDate(l.supplier_due_date)}</div> : null}</td>
                            </tr>
                        ))}</tbody>
                    </table></div>
                )}
            </CardBody></Card>

            <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>Edit supplier</ModalHeader>
                    <ModalBody><SupplierForm form={form} setForm={setForm} /></ModalBody>
                    <ModalFooter>
                        <Button variant="light" color="danger" className="mr-auto" onPress={async () => { const { success } = await commonPostAPICall({}, `travel/suppliers/${id}/delete`, true); if (success) navigate("/travel/suppliers"); }}>Delete</Button>
                        <Button variant="light" onPress={close}>Cancel</Button>
                        <Button color="primary" isLoading={busy} onPress={async () => { setBusy(true); const body = { ...form }; if (!body.bank_details) delete body.bank_details; const { success } = await commonPostAPICall(body, `travel/suppliers/${id}/update`, true); setBusy(false); if (success) { close(); load(); } }}>Save</Button>
                    </ModalFooter>
                </>)}</ModalContent>
            </Modal>

            <Modal isOpen={rateModal.isOpen} onOpenChange={rateModal.onOpenChange} size="2xl">
                <ModalContent>{(close) => (<>
                    <ModalHeader>Add rate</ModalHeader>
                    <ModalBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Service" className="sm:col-span-2"><Input aria-label="Service" placeholder="e.g. Deluxe room, Airport transfer (sedan)" value={rate.service} onValueChange={(v) => setRate((r: any) => ({ ...r, service: v }))} /></Field>
                        <Field label="Type"><Select aria-label="Type" selectedKeys={[rate.service_type]} onChange={(e) => setRate((r: any) => ({ ...r, service_type: e.target.value || "other" }))}>{SERVICE_TYPES.filter((t) => RATE_TYPES.includes(t.key)).map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}</Select></Field>
                        <Field label="Charged"><Select aria-label="Charged" selectedKeys={[rate.pax_type]} onChange={(e) => setRate((r: any) => ({ ...r, pax_type: e.target.value || "per_unit" }))}>{PAX.map((p) => <SelectItem key={p.key}>{p.label}</SelectItem>)}</Select></Field>
                        <Field label="Room type"><Input aria-label="Room type" value={rate.room_type} onValueChange={(v) => setRate((r: any) => ({ ...r, room_type: v }))} /></Field>
                        <Field label="Meal plan"><Input aria-label="Meal plan" placeholder="EP / CP / MAP / AP" value={rate.meal_plan} onValueChange={(v) => setRate((r: any) => ({ ...r, meal_plan: v }))} /></Field>
                        <Field label="Season"><Input aria-label="Season" placeholder="Peak / Off-peak" value={rate.season} onValueChange={(v) => setRate((r: any) => ({ ...r, season: v }))} /></Field>
                        <Field label="Cost ₹"><Input aria-label="Cost" type="number" value={rate.cost} onValueChange={(v) => setRate((r: any) => ({ ...r, cost: v }))} /></Field>
                        <Field label="Valid from"><Input aria-label="Valid from" type="date" value={rate.valid_from} onValueChange={(v) => setRate((r: any) => ({ ...r, valid_from: v }))} /></Field>
                        <Field label="Valid to"><Input aria-label="Valid to" type="date" value={rate.valid_to} onValueChange={(v) => setRate((r: any) => ({ ...r, valid_to: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy} onPress={async () => { setBusy(true); const { success } = await commonPostAPICall({ ...rate, cost: Number(rate.cost) || 0 }, `travel/suppliers/${id}/rates`, true); setBusy(false); if (success) { close(); load(); } }}>Add rate</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

export default Suppliers;
