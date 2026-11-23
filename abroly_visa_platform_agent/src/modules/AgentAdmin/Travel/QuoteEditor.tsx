import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Autocomplete, AutocompleteItem, Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Select, SelectItem, Spinner, Switch, Tab, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import { ArrowLeft, CheckCircle2, Copy, FileDown, MessageCircle, Plus, Save, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { Field, QUOTE_STATUS, SERVICE_TYPES, apiBase, rupees } from "./travelShared";
import { useOpenPdf, useSendWhatsapp } from "./travelActions";

type Line = { service_type: string; description: string; supplier_id: number | null; rate_id: number | null; qty: number; nights: number; unit_cost: number; markup_type: "percent" | "flat"; markup_value: number };
type Option = { name: string; lines: Line[] };

const blankLine = (): Line => ({ service_type: "hotel", description: "", supplier_id: null, rate_id: null, qty: 1, nights: 0, unit_cost: 0, markup_type: "percent", markup_value: 10 });

/** Same maths as the server (services/travel.ts → quoteTotals), so totals update while typing. */
const calc = (lines: Line[], q: any) => {
    const cost = lines.reduce((a, l) => a + l.unit_cost * l.qty * Math.max(1, l.nights), 0);
    const markup = lines.reduce((a, l) => a + (l.markup_type === "flat" ? l.markup_value : l.unit_cost * l.qty * Math.max(1, l.nights) * l.markup_value / 100), 0);
    const discount = Math.min(Math.max(0, Number(q.discount) || 0), cost + markup);
    const sell = cost + markup - discount;
    const taxable = q.billing_mode === "margin" ? Math.max(0, sell - cost) : sell;
    const gst = Math.round(taxable * (Number(q.gst_percent) || 0)) / 100;
    const tcs = q.is_international ? Math.round((sell + gst) * (Number(q.tcs_percent) || 0)) / 100 : 0;
    const total = sell + gst + tcs;
    const pax = Math.max(1, (Number(q.adults) || 0) + (Number(q.children) || 0));
    return { cost, markup, discount, sell, taxable, gst, tcs, total, profit: sell - cost, per_person: total / pax };
};

/** Quote with up to 3 options, costed from supplier rates with markup, GST and TCS (QT-01..QT-05). */
const QuoteEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [q, setQ] = useState<any>(null);
    const [options, setOptions] = useState<Option[]>([]);
    const [tab, setTab] = useState("0");
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rates, setRates] = useState<any[]>([]);
    const bookModal = useDisclosure();
    const [bookDates, setBookDates] = useState({ start_date: "", end_date: "" });
    const [booking, setBooking] = useState(false);

    const load = async () => {
        const { success, data } = await commonGetAPICalls(`/travel/quotes/${id}`);
        if (!success) return;
        setQ(data);
        setOptions((data.options || []).map((o: any) => ({ name: o.name, lines: (o.lines || []).map((l: any) => ({ ...blankLine(), ...l })) })));
        setTab(String(data.chosen_option ?? 0));
        setDirty(false);
    };
    useEffect(() => { load(); }, [id]);

    const searchRates = async (text: string) => {
        if (!q?.sees_cost) return;
        const date = q?.trip?.travel_date ? `&date=${q.trip.travel_date}` : "";
        const { success, data } = await commonGetAPICalls(`/travel/suppliers/rates?search=${encodeURIComponent(text)}${date}`);
        if (success) setRates(data);
    };

    /** How many units a rate needs for this group (QT-01): rooms for 2 adults each, per-person counts, nights for per-night rates. */
    const unitsFor = (r: any) => {
        const adults = Number(q?.adults) || 0, children = Number(q?.children) || 0, infants = Number(q?.infants) || 0;
        const nights = Number(q?.trip?.nights) || 0;
        if (r.pax_type === "per_room") return { qty: Math.max(1, Math.ceil(adults / 2)), nights };
        if (r.pax_type === "per_adult") return { qty: Math.max(1, adults), nights: 0 };
        if (r.pax_type === "per_child") return { qty: Math.max(1, children), nights: 0 };
        if (r.pax_type === "per_infant") return { qty: Math.max(1, infants), nights: 0 };
        return { qty: 1, nights: 0 };
    };

    /** Refresh unit costs of lines that came from a rate contract (after a rate or the group size changed). */
    const repriceFromRates = async () => {
        const ids = [...new Set(options.flatMap((o) => o.lines.map((l) => l.rate_id)).filter(Boolean))];
        if (!ids.length) return SuccessToast("No lines are linked to supplier rates yet - pick services from the list to link them");
        const { success, data } = await commonGetAPICalls(`/travel/suppliers/rates?ids=${ids.join(",")}`);
        if (!success) return;
        const byId = new Map((data || []).map((r: any) => [r.db_id, r]));
        setOptions((prev) => prev.map((o) => ({ ...o, lines: o.lines.map((l) => { const r: any = l.rate_id ? byId.get(l.rate_id) : null; return r ? { ...l, unit_cost: r.cost, ...unitsFor(r) } : l; }) })));
        setDirty(true);
        SuccessToast("Prices and quantities updated from supplier rates");
    };
    useEffect(() => { if (q?.sees_cost) searchRates(""); }, [q?.sees_cost]);

    const closed = q && ["accepted", "superseded"].includes(q.status);
    const canEdit = q?.sees_cost && !closed;
    const setField = (k: string) => (v: any) => { setQ((x: any) => ({ ...x, [k]: v })); setDirty(true); };
    const changeLines = (oi: number, fn: (l: Line[]) => Line[]) => { setOptions((prev) => prev.map((o, i) => (i === oi ? { ...o, lines: fn([...o.lines]) } : o))); setDirty(true); };
    const setLine = (oi: number, li: number, patch: Partial<Line>) => changeLines(oi, (ls) => { ls[li] = { ...ls[li], ...patch }; return ls; });

    // roles that may not see cost get no unit costs, so use the totals the server worked out
    const totals = useMemo(() => (q ? options.map((o, i) => (q.sees_cost ? calc(o.lines, q) : { ...calc([], q), ...(q.options?.[i]?.totals || {}) })) : []), [options, q]);

    const save = async () => {
        setSaving(true);
        const { success } = await commonPostAPICall({
            title: q.title, adults: q.adults, children: q.children, infants: q.infants, is_international: q.is_international, billing_mode: q.billing_mode,
            gst_percent: q.gst_percent, tcs_percent: q.tcs_percent, discount: q.discount, valid_until: q.valid_until, notes: q.notes,
            chosen_option: Number(tab), options,
        }, `travel/quotes/${id}/update`);
        setSaving(false);
        if (success) { SuccessToast("Quote saved"); setDirty(false); }
        return success;
    };

    const status = async (s: string) => {
        if (dirty && !(await save())) return;
        const { success } = await commonPostAPICall({ status: s }, `travel/quotes/${id}/status`, true);
        if (success) load();
    };

    const newVersion = async () => {
        const { success, data } = await commonPostAPICall({}, `travel/quotes/${id}/version`, true);
        if (success && data?.id) navigate(`/travel/quotes/${data.id}`);
    };

    const openPdf = useOpenPdf();
    const sendWa = useSendWhatsapp();
    const sendWhatsApp = async () => {
        if (dirty && !(await save())) return;
        const lines = options.map((o, i) => `${o.name}: ${rupees(totals[i]?.total)} (${rupees(totals[i]?.per_person)} per person)`).join("\n");
        let link = "";
        if (q.itinerary?.id) {
            const { success, data } = await commonPostAPICall({}, `travel/itineraries/${q.itinerary.id}/share`);
            if (success) link = data.url || `${apiBase()}/v1/public/travel/itinerary/${data.token}`;
        }
        const text = `Hi ${String(q.lead?.name || "").split(" ")[0]}, here is your quote for ${q.title}:\n${lines}\nPrices include GST${q.is_international && Number(q.tcs_percent) > 0 ? " and TCS" : ""}.${q.valid_until ? ` Valid until ${q.valid_until}.` : ""}${link ? `\nFull plan: ${link}` : ""}`;
        await sendWa({ to: q.lead?.phone, lead_id: q.lead?.id, trigger: "quote_sent", vars: { name: String(q.lead?.name || "").split(" ")[0], trip: q.title, total: rupees(totals[oi]?.total), link }, text });
        if (q.status === "draft") status("sent");
    };

    const book = async () => {
        if (dirty && !(await save())) return;
        setBooking(true);
        const { success, data } = await commonPostAPICall({ option: Number(tab), ...bookDates }, `travel/quotes/${id}/book`, true);
        setBooking(false);
        if (success && data?.id) navigate(`/travel/bookings/${data.id}`);
    };

    if (!q) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const oi = Math.min(Number(tab), options.length - 1);
    const t = totals[oi];

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <div className="flex flex-wrap items-center gap-2">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate(q.lead ? `/crm/leads/${q.lead.id}` : "/travel/quotes")}><ArrowLeft size={18} /></Button>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-default-500">{q.number} · version {q.version}{q.lead ? ` · for ${q.lead.name}` : ""}</div>
                    <h1 className="text-xl font-semibold truncate">{q.title}</h1>
                </div>
                <Chip variant="flat" color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip>
                {canEdit && <Button color="primary" startContent={<Save size={16} />} isLoading={saving} isDisabled={!dirty} onPress={save}>{dirty ? "Save" : "Saved"}</Button>}
            </div>

            {q.versions?.length > 1 && (
                <div className="flex flex-wrap gap-2 text-sm items-center"><span className="text-default-500">Versions:</span>
                    {q.versions.map((v: any) => <Chip key={v.id} size="sm" variant={v.id === q.id ? "solid" : "flat"} color={v.id === q.id ? "primary" : "default"} className="cursor-pointer" onClick={() => navigate(`/travel/quotes/${v.id}`)}>v{v.version}</Chip>)}
                </div>
            )}
            {q.booking && <div className="rounded-xl border border-success-200 bg-success-50 p-3 text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Booked as <button className="underline font-medium" onClick={() => navigate(`/travel/bookings/${q.booking.id}`)}>{q.booking.booking_no}</button></div>}
            {!q.sees_cost && <div className="rounded-xl border border-default-200 bg-default-50 p-3 text-sm">Costs and margins are hidden for your role. You can send this quote; a manager sets the prices.</div>}

            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="flat" color="success" startContent={<MessageCircle size={14} />} onPress={sendWhatsApp}>Send on WhatsApp</Button>
                {!closed && <Button size="sm" variant="flat" color="primary" startContent={<CheckCircle2 size={14} />} onPress={bookModal.onOpen}>Client accepted - book it</Button>}
                <Button size="sm" variant="flat" startContent={<FileDown size={14} />} onPress={async () => { if (dirty && !(await save())) return; openPdf(`travel/quotes/${id}/pdf`); }}>PDF</Button>
                <Button size="sm" variant="flat" startContent={<Copy size={14} />} onPress={newVersion}>New version</Button>
                {q.status !== "rejected" && !closed && <Button size="sm" variant="light" color="danger" onPress={() => status("rejected")}>Mark lost</Button>}
                {q.itinerary && <Button size="sm" variant="light" onPress={() => navigate(`/travel/itineraries/${q.itinerary.id}`)}>Open itinerary</Button>}
            </div>

            <Card shadow="sm"><CardBody className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Field label="Title" className="col-span-2 md:col-span-3"><Input aria-label="Title" isDisabled={!canEdit} value={q.title || ""} onValueChange={setField("title")} /></Field>
                <Field label="Adults"><Input aria-label="Adults" type="number" min={0} isDisabled={!canEdit} value={String(q.adults ?? 0)} onValueChange={(v) => setField("adults")(Number(v) || 0)} /></Field>
                <Field label="Children"><Input aria-label="Children" type="number" min={0} isDisabled={!canEdit} value={String(q.children ?? 0)} onValueChange={(v) => setField("children")(Number(v) || 0)} /></Field>
                <Field label="Infants"><Input aria-label="Infants" type="number" min={0} isDisabled={!canEdit} value={String(q.infants ?? 0)} onValueChange={(v) => setField("infants")(Number(v) || 0)} /></Field>
                <Field label="GST billing" className="col-span-2">
                    <Select aria-label="GST billing" isDisabled={!canEdit} selectedKeys={[q.billing_mode]} onChange={(e) => {
                        const mode = e.target.value || "full_value";
                        setQ((x: any) => ({ ...x, billing_mode: mode, gst_percent: mode === "margin" ? q.tax_defaults?.gst_margin_percent ?? 18 : q.tax_defaults?.gst_full_value_percent ?? 5 }));
                        setDirty(true);
                    }}>
                        <SelectItem key="full_value">GST on full package value</SelectItem>
                        <SelectItem key="margin">GST on service charge (margin) only</SelectItem>
                    </Select>
                </Field>
                <Field label="GST %"><Input aria-label="GST %" type="number" isDisabled={!canEdit} value={String(q.gst_percent)} onValueChange={(v) => setField("gst_percent")(v)} /></Field>
                <Field label="Overseas trip (TCS)"><div className="h-10 flex items-center"><Switch isDisabled={!canEdit} isSelected={Boolean(q.is_international)} onValueChange={(v) => { setQ((x: any) => ({ ...x, is_international: v, tcs_percent: v ? (Number(x.tcs_percent) || q.tax_defaults?.tcs_overseas_percent || 0) : 0 })); setDirty(true); }} /></div></Field>
                <Field label="TCS %"><Input aria-label="TCS %" type="number" isDisabled={!canEdit || !q.is_international} value={String(q.tcs_percent)} onValueChange={(v) => setField("tcs_percent")(v)} /></Field>
                <Field label="Valid until"><Input aria-label="Valid until" type="date" isDisabled={!canEdit} value={q.valid_until || ""} onValueChange={setField("valid_until")} /></Field>
            </CardBody></Card>

            <div className="flex items-center gap-2">
                <Tabs selectedKey={String(oi)} onSelectionChange={(k) => { setTab(String(k)); setDirty(true); }} aria-label="Options" variant="solid">
                    {options.map((o, i) => <Tab key={String(i)} title={`${o.name} · ${rupees(totals[i]?.total)}`} />)}
                </Tabs>
                {canEdit && options.length < 3 && <Button size="sm" variant="light" startContent={<Plus size={14} />} onPress={() => {
                    setOptions((p) => [...p, { name: ["Standard", "Deluxe", "Luxury"][p.length] || `Option ${p.length + 1}`, lines: p[p.length - 1]?.lines.map((l) => ({ ...l })) || [] }]);
                    setTab(String(options.length)); setDirty(true);
                }}>Add option</Button>}
            </div>

            {options[oi] && (
                <Card shadow="sm"><CardBody className="gap-3">
                    <div className="flex gap-2 items-end">
                        <Field label="Option name" className="max-w-xs"><Input aria-label="Option name" isDisabled={!canEdit} value={options[oi].name} onValueChange={(v) => { setOptions((p) => p.map((o, i) => (i === oi ? { ...o, name: v } : o))); setDirty(true); }} /></Field>
                        {canEdit && options.length > 1 && <Button size="sm" variant="light" color="danger" onPress={() => { setOptions((p) => p.filter((_, i) => i !== oi)); setTab("0"); setDirty(true); }}>Remove option</Button>}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[900px]">
                            <thead className="text-xs text-default-500 text-left">
                                <tr><th className="p-1 w-28">Type</th><th className="p-1">Service</th><th className="p-1 w-16">Qty</th><th className="p-1 w-16">Nights</th>
                                    {q.sees_cost && <><th className="p-1 w-28">Unit cost ₹</th><th className="p-1 w-36">Markup</th></>}<th className="p-1 w-28 text-right">Selling ₹</th><th className="w-8" /></tr>
                            </thead>
                            <tbody>
                                {options[oi].lines.map((l, li) => {
                                    const lc = l.unit_cost * l.qty * Math.max(1, l.nights);
                                    const lm = l.markup_type === "flat" ? l.markup_value : lc * l.markup_value / 100;
                                    return (
                                        <tr key={li} className="align-top border-t border-default-100">
                                            <td className="p-1"><Select aria-label="Type" size="sm" isDisabled={!canEdit} selectedKeys={[l.service_type]} onChange={(e) => setLine(oi, li, { service_type: e.target.value || "other" })}>{SERVICE_TYPES.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}</Select></td>
                                            <td className="p-1">
                                                {canEdit ? (
                                                    <Autocomplete aria-label="Service" size="sm" allowsCustomValue inputValue={l.description} items={rates} onInputChange={(v) => { setLine(oi, li, { description: v }); searchRates(v); }}
                                                        onSelectionChange={(key) => {
                                                            const r = rates.find((x) => x.id === key);
                                                            if (r) setLine(oi, li, { description: `${r.service}${r.room_type ? ` (${r.room_type})` : ""}${r.meal_plan ? ` ${r.meal_plan}` : ""}${r.supplier_name ? ` - ${r.supplier_name}` : ""}`, unit_cost: r.cost, supplier_id: r.supplier_id, rate_id: r.db_id, service_type: r.service_type, ...unitsFor(r) });
                                                        }}>
                                                        {(r: any) => <AutocompleteItem key={r.id} textValue={r.service}>{`${r.service}${r.room_type ? ` · ${r.room_type}` : ""} · ${r.supplier_name || ""} · ${rupees(r.cost)} ${r.pax_type?.replace("per_", "per ")}`}</AutocompleteItem>}
                                                    </Autocomplete>
                                                ) : <div className="py-2">{l.description}</div>}
                                            </td>
                                            <td className="p-1"><Input aria-label="Qty" size="sm" type="number" min={1} isDisabled={!canEdit} value={String(l.qty)} onValueChange={(v) => setLine(oi, li, { qty: Math.max(1, Number(v) || 1) })} /></td>
                                            <td className="p-1"><Input aria-label="Nights" size="sm" type="number" min={0} isDisabled={!canEdit} value={String(l.nights)} onValueChange={(v) => setLine(oi, li, { nights: Math.max(0, Number(v) || 0) })} /></td>
                                            {q.sees_cost && <>
                                                <td className="p-1"><Input aria-label="Unit cost" size="sm" type="number" min={0} isDisabled={!canEdit} value={String(l.unit_cost)} onValueChange={(v) => setLine(oi, li, { unit_cost: Math.max(0, Number(v) || 0) })} /></td>
                                                <td className="p-1"><div className="flex gap-1">
                                                    <Input aria-label="Markup" size="sm" type="number" min={0} isDisabled={!canEdit} value={String(l.markup_value)} onValueChange={(v) => setLine(oi, li, { markup_value: Math.max(0, Number(v) || 0) })} />
                                                    <Select aria-label="Markup type" size="sm" className="w-20 shrink-0" isDisabled={!canEdit} selectedKeys={[l.markup_type]} onChange={(e) => setLine(oi, li, { markup_type: e.target.value === "flat" ? "flat" : "percent" })}><SelectItem key="percent">%</SelectItem><SelectItem key="flat">₹</SelectItem></Select>
                                                </div></td>
                                            </>}
                                            <td className="p-1 text-right py-2 font-medium">{rupees(q.sees_cost ? Math.round((lc + lm) * 100) / 100 : (l as any).line_sell)}</td>
                                            <td className="p-1">{canEdit && <Button isIconOnly size="sm" variant="light" aria-label="Remove line" onPress={() => changeLines(oi, (ls) => ls.filter((_, i) => i !== li))}><Trash2 size={14} /></Button>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {canEdit && <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => changeLines(oi, (ls) => [...ls, blankLine()])}>Add service</Button>
                        <Button size="sm" variant="light" onPress={repriceFromRates}>Update prices from rates</Button>
                        <span className="text-xs text-default-500 self-center">Picking a supplier rate fills the price, rooms (2 adults per room), people and nights{q.trip?.travel_date ? ` for ${q.trip.travel_date}` : ""}.</span>
                    </div>}

                    {t && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-default-100 pt-3">
                            <div className="flex flex-col gap-2">
                                <Field label="Discount ₹"><Input aria-label="Discount" type="number" min={0} isDisabled={!canEdit} value={String(q.discount || 0)} onValueChange={(v) => setField("discount")(Number(v) || 0)} /></Field>
                                <Field label="Notes for the client"><Textarea aria-label="Notes" minRows={2} isDisabled={!canEdit} value={q.notes || ""} onValueChange={setField("notes")} /></Field>
                            </div>
                            <div className="text-sm flex flex-col gap-1 md:items-end">
                                {q.sees_cost && <Row k="Supplier cost" v={rupees(t.cost)} muted />}
                                {q.sees_cost && <Row k="Markup" v={rupees(t.markup)} muted />}
                                {t.discount > 0 && <Row k="Discount" v={`- ${rupees(t.discount)}`} />}
                                <Row k="Package price" v={rupees(t.sell)} />
                                <Row k={`GST ${q.gst_percent}%${q.billing_mode === "margin" ? ` on ${rupees(t.taxable)}` : ""}`} v={rupees(t.gst)} />
                                {t.tcs > 0 && <Row k={`TCS ${q.tcs_percent}%`} v={rupees(t.tcs)} />}
                                <Row k="Client pays" v={rupees(t.total)} strong />
                                <Row k="Per person" v={rupees(Math.round(t.per_person))} muted />
                                {q.sees_cost && <Row k="Profit" v={rupees(t.profit)} tone={t.profit >= 0 ? "success" : "danger"} />}
                            </div>
                        </div>
                    )}
                </CardBody></Card>
            )}

            <Modal isOpen={bookModal.isOpen} onOpenChange={bookModal.onOpenChange}>
                <ModalContent>
                    {(close) => (<>
                        <ModalHeader>Book “{options[oi]?.name}” option</ModalHeader>
                        <ModalBody className="gap-3">
                            <p className="text-sm text-default-600">This creates a booking with each service, marks the lead as converted and opens the booking so operations can confirm with suppliers.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Travel starts"><Input aria-label="Travel starts" type="date" value={bookDates.start_date} onValueChange={(v) => setBookDates((d) => ({ ...d, start_date: v }))} /></Field>
                                <Field label="Travel ends"><Input aria-label="Travel ends" type="date" value={bookDates.end_date} onValueChange={(v) => setBookDates((d) => ({ ...d, end_date: v }))} /></Field>
                            </div>
                            <p className="text-xs text-default-500">Leave dates empty to use the itinerary or lead dates.</p>
                        </ModalBody>
                        <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={booking} onPress={book}>Create booking</Button></ModalFooter>
                    </>)}
                </ModalContent>
            </Modal>
        </div>
    );
};

const Row = ({ k, v, strong, muted, tone }: { k: string; v: string; strong?: boolean; muted?: boolean; tone?: "success" | "danger" }) => (
    <div className={`flex justify-between gap-6 w-full md:w-80 ${strong ? "text-base font-semibold border-t border-default-200 pt-1" : ""} ${muted ? "text-default-500" : ""} ${tone === "success" ? "text-success font-medium" : tone === "danger" ? "text-danger font-medium" : ""}`}>
        <span>{k}</span><span>{v}</span>
    </div>
);

export default QuoteEditor;
