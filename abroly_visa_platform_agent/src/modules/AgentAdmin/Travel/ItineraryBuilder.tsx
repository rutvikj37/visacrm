import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Textarea, useDisclosure,
} from "@heroui/react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, ExternalLink, FileDown, FileText, GripVertical, Library, MessageCircle, Plus, Save, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { DAY_ITEM_TYPES, Field, ITINERARY_STATUS, apiBase } from "./travelShared";
import { ImageUpload, useOpenPdf, useSendWhatsapp } from "./travelActions";

type Item = { type: string; text: string; library_item_id?: string | null; image?: string | null };
type Day = { title: string; city?: string | null; notes?: string | null; image?: string | null; items: Item[] };

const LIB_TO_DAY: Record<string, string> = { hotel: "hotel", activity: "sightseeing", transfer: "transfer", meal: "meal", destination: "note", note: "note" };

/**
 * Day-by-day itinerary builder (IT-01, IT-03, IT-04, IT-05).
 * Days and items can be dragged to reorder (or moved with the arrows on touch screens).
 */
const ItineraryBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [it, setIt] = useState<any>(null);
    const [days, setDays] = useState<Day[]>([]);
    const [meta, setMeta] = useState<any>({});
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [library, setLibrary] = useState<any[]>([]);
    const [libFor, setLibFor] = useState<number | null>(null);
    const [libSearch, setLibSearch] = useState("");
    const libModal = useDisclosure();
    const drag = useRef<{ kind: "day" | "item"; day: number; item?: number } | null>(null);

    const load = async () => {
        const { success, data } = await commonGetAPICalls(`/travel/itineraries/${id}`);
        if (!success) return;
        setIt(data);
        setDays((data.days || []).map((d: any) => ({ title: d.title, city: d.city, notes: d.notes, image: d.image || null, items: d.items || [] })));
        setMeta({ title: data.title, destination: data.destination || "", start_date: data.start_date || "", inclusions: data.inclusions || "", exclusions: data.exclusions || "", terms: data.terms || "", cancellation_policy: data.cancellation_policy || "", theme: data.theme || "classic", cover_image: data.cover_image || null });
        setDirty(false);
    };
    useEffect(() => { load(); }, [id]);

    const change = (fn: (d: Day[]) => Day[]) => { setDays((prev) => fn(prev.map((d) => ({ ...d, items: [...d.items] })))); setDirty(true); };
    const setM = (k: string) => (v: string) => { setMeta((m: any) => ({ ...m, [k]: v })); setDirty(true); };

    const save = async () => {
        setSaving(true);
        const { success } = await commonPostAPICall({ ...meta, days }, `travel/itineraries/${id}/update`);
        setSaving(false);
        if (success) { SuccessToast("Itinerary saved"); setDirty(false); }
        return success;
    };

    const moveDay = (from: number, to: number) => change((d) => { if (to < 0 || to >= d.length) return d; const [x] = d.splice(from, 1); d.splice(to, 0, x); return d; });
    const moveItem = (day: number, from: number, toDay: number, to: number) => change((d) => {
        const [x] = d[day].items.splice(from, 1);
        if (!x) return d;
        d[toDay].items.splice(Math.max(0, Math.min(to, d[toDay].items.length)), 0, x);
        return d;
    });

    const openLibrary = async (dayIndex: number) => {
        setLibFor(dayIndex);
        if (!library.length) {
            const { success, data } = await commonGetAPICalls("/travel/library");
            if (success) setLibrary(data);
        }
        libModal.onOpen();
    };
    const libFiltered = useMemo(() => library.filter((l) => !libSearch.trim() || `${l.name} ${l.destination || ""}`.toLowerCase().includes(libSearch.trim().toLowerCase())), [library, libSearch]);

    const openPdf = useOpenPdf();
    const sendWa = useSendWhatsapp();
    const share = async (via: "whatsapp" | "open" | "copy") => {
        if (dirty && !(await save())) return;
        const { success, data } = await commonPostAPICall({}, `travel/itineraries/${id}/share`);
        if (!success) return;
        const url = data.url || `${apiBase()}/v1/public/travel/itinerary/${data.token}`;
        if (via === "copy") { await navigator.clipboard?.writeText(url); SuccessToast("Link copied"); }
        else if (via === "open") window.open(url, "_blank", "noopener");
        else await sendWa({ to: it?.lead_phone, lead_id: it?.lead?.id, trigger: "itinerary_shared", vars: { name: String(it?.lead?.name || "").split(" ")[0], trip: meta.title, link: url }, text: `Hi ${String(it?.lead?.name || "").split(" ")[0]}, here is your trip plan "${meta.title}": ${url}` });
        load();
    };

    const makeQuote = async () => {
        if (dirty && !(await save())) return;
        const { success, data } = await commonPostAPICall({ itinerary_id: id, lead_id: it?.lead?.id }, "travel/quotes");
        if (success && data?.id) navigate(`/travel/quotes/${data.id}`);
    };

    const saveAsTemplate = async () => {
        const { success, data } = await commonPostAPICall({ copy_from: id, is_template: true, title: `${meta.title} (template)` }, "travel/itineraries");
        if (success && data?.id) SuccessToast("Saved as a template");
    };

    if (!it) return <div className="py-16 grid place-items-center"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate(it.lead ? `/crm/leads/${it.lead.id}` : "/travel/itineraries")}><ArrowLeft size={18} /></Button>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-default-500">{it.is_template ? "Template" : it.lead ? `Itinerary for ${it.lead.name || "lead"}` : "Itinerary"}</div>
                    <h1 className="text-xl font-semibold truncate">{meta.title}</h1>
                </div>
                {!it.is_template && <Chip variant="flat" color={ITINERARY_STATUS[it.status]?.color}>{ITINERARY_STATUS[it.status]?.label}</Chip>}
                <Button color="primary" startContent={<Save size={16} />} isLoading={saving} isDisabled={!dirty} onPress={save}>{dirty ? "Save" : "Saved"}</Button>
            </div>

            {it.status === "changes_requested" && it.client_note && (
                <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm"><b>Client asked for changes:</b> {it.client_note}</div>
            )}

            {!it.is_template && (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" color="success" startContent={<MessageCircle size={14} />} onPress={() => share("whatsapp")}>Send on WhatsApp</Button>
                    <Button size="sm" variant="flat" startContent={<ExternalLink size={14} />} onPress={() => share("open")}>Client page</Button>
                    <Button size="sm" variant="flat" startContent={<FileDown size={14} />} onPress={async () => { if (dirty && !(await save())) return; openPdf(`travel/itineraries/${id}/pdf`); }}>PDF</Button>
                    <Button size="sm" variant="flat" startContent={<Copy size={14} />} onPress={() => share("copy")}>Copy link</Button>
                    <Button size="sm" variant="flat" color="primary" startContent={<FileText size={14} />} onPress={makeQuote}>{it.quotes?.length ? "New quote" : "Price this trip"}</Button>
                    <Button size="sm" variant="light" onPress={saveAsTemplate}>Save as template</Button>
                </div>
            )}
            {it.quotes?.length > 0 && (
                <div className="flex flex-wrap gap-2 text-sm">
                    <span className="text-default-500">Quotes:</span>
                    {it.quotes.map((q: any) => <Chip key={q.id} variant="flat" className="cursor-pointer" onClick={() => navigate(`/travel/quotes/${q.id}`)}>{q.number} v{q.version} · {q.status}</Chip>)}
                </div>
            )}

            <Card shadow="sm"><CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Title" className="sm:col-span-3"><Input aria-label="Title" value={meta.title} onValueChange={setM("title")} /></Field>
                <Field label="Destination"><Input aria-label="Destination" value={meta.destination} onValueChange={setM("destination")} /></Field>
                <Field label="Start date"><Input aria-label="Start date" type="date" value={meta.start_date} onValueChange={setM("start_date")} /></Field>
                <Field label="Length"><div className="h-10 flex items-center text-sm">{Math.max(0, days.length - 1)} nights / {days.length} days</div></Field>
                <Field label="Design (client page and PDF)">
                    <Select aria-label="Design" selectedKeys={[meta.theme || "classic"]} onChange={(e) => setM("theme")(e.target.value || "classic")}>
                        <SelectItem key="classic">Classic</SelectItem><SelectItem key="modern">Modern</SelectItem><SelectItem key="elegant">Elegant</SelectItem>
                    </Select>
                </Field>
                <Field label="Cover photo" className="sm:col-span-2"><ImageUpload value={meta.cover_image} onChange={(url) => { setMeta((m: any) => ({ ...m, cover_image: url })); setDirty(true); }} label="Add cover photo" /></Field>
            </CardBody></Card>

            <div className="flex flex-col gap-3">
                {days.map((d, di) => (
                    <Card key={di} shadow="sm"
                        onDragOver={(e: any) => e.preventDefault()}
                        onDrop={(e: any) => {
                            e.preventDefault();
                            const s = drag.current; drag.current = null;
                            if (!s) return;
                            if (s.kind === "day" && s.day !== di) moveDay(s.day, di);
                            if (s.kind === "item" && s.item !== undefined) moveItem(s.day, s.item, di, d.items.length);
                        }}>
                        <CardBody className="gap-2">
                            <div className="flex items-center gap-2">
                                <span draggable onDragStart={() => { drag.current = { kind: "day", day: di }; }} className="cursor-grab text-default-400 hidden sm:block" title="Drag to reorder days"><GripVertical size={18} /></span>
                                <Chip color="primary" variant="flat" className="shrink-0">Day {di + 1}</Chip>
                                <Input aria-label="Day title" size="sm" value={d.title} onValueChange={(v) => change((x) => { x[di].title = v; return x; })} className="flex-1" />
                                <Input aria-label="City" size="sm" placeholder="City" value={d.city || ""} onValueChange={(v) => change((x) => { x[di].city = v; return x; })} className="w-32 hidden sm:block" />
                                <Button isIconOnly size="sm" variant="light" aria-label="Move day up" isDisabled={di === 0} onPress={() => moveDay(di, di - 1)}><ArrowUp size={14} /></Button>
                                <Button isIconOnly size="sm" variant="light" aria-label="Move day down" isDisabled={di === days.length - 1} onPress={() => moveDay(di, di + 1)}><ArrowDown size={14} /></Button>
                                <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Remove day" isDisabled={days.length <= 1} onPress={() => change((x) => { x.splice(di, 1); return x; })}><Trash2 size={14} /></Button>
                            </div>
                            <div className="flex flex-col gap-1.5 sm:pl-7">
                                {d.items.map((item, ii) => (
                                    <div key={ii} className="flex items-start gap-2"
                                        draggable onDragStart={(e) => { e.stopPropagation(); drag.current = { kind: "item", day: di, item: ii }; }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const s = drag.current; drag.current = null; if (s?.kind === "item" && s.item !== undefined) moveItem(s.day, s.item, di, ii); }}>
                                        <span className="cursor-grab text-default-300 pt-2 hidden sm:block"><GripVertical size={14} /></span>
                                        <Select aria-label="Type" size="sm" className="w-32 shrink-0" selectedKeys={[item.type]} onChange={(e) => change((x) => { x[di].items[ii].type = e.target.value || "note"; return x; })}>
                                            {DAY_ITEM_TYPES.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}
                                        </Select>
                                        <Textarea aria-label="Details" size="sm" minRows={1} value={item.text} onValueChange={(v) => change((x) => { x[di].items[ii].text = v; return x; })} className="flex-1" />
                                        <ImageUpload compact value={item.image} onChange={(url) => change((x) => { x[di].items[ii].image = url; return x; })} label="Photo" />
                                        <Button isIconOnly size="sm" variant="light" aria-label="Remove" onPress={() => change((x) => { x[di].items.splice(ii, 1); return x; })}><Trash2 size={14} /></Button>
                                    </div>
                                ))}
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => change((x) => { x[di].items.push({ type: "sightseeing", text: "" }); return x; })}>Add item</Button>
                                    <Button size="sm" variant="light" startContent={<Library size={14} />} onPress={() => openLibrary(di)}>From library</Button>
                                </div>
                                <Textarea aria-label="Day notes" size="sm" minRows={1} placeholder="Notes for this day (optional)" value={d.notes || ""} onValueChange={(v) => change((x) => { x[di].notes = v; return x; })} />
                                <ImageUpload value={d.image} onChange={(url) => change((x) => { x[di].image = url; return x; })} label="Day photo" />
                            </div>
                        </CardBody>
                    </Card>
                ))}
                <Button variant="bordered" startContent={<Plus size={16} />} onPress={() => change((x) => [...x, { title: `Day ${x.length + 1}`, items: [] }])}>Add day</Button>
            </div>

            <Card shadow="sm"><CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Inclusions"><Textarea aria-label="Inclusions" minRows={4} placeholder={"4 nights hotel with breakfast\nAirport transfers\nDesert safari with BBQ dinner"} value={meta.inclusions} onValueChange={setM("inclusions")} /></Field>
                <Field label="Exclusions"><Textarea aria-label="Exclusions" minRows={4} placeholder={"Flights\nTourism Dirham fee\nPersonal expenses"} value={meta.exclusions} onValueChange={setM("exclusions")} /></Field>
                <Field label="Cancellation policy"><Textarea aria-label="Cancellation policy" minRows={3} value={meta.cancellation_policy} onValueChange={setM("cancellation_policy")} /></Field>
                <Field label="Terms"><Textarea aria-label="Terms" minRows={3} value={meta.terms} onValueChange={setM("terms")} /></Field>
            </CardBody></Card>

            <Modal isOpen={libModal.isOpen} onOpenChange={libModal.onOpenChange} size="lg" scrollBehavior="inside">
                <ModalContent>
                    {(close) => (<>
                        <ModalHeader>Add from library</ModalHeader>
                        <ModalBody>
                            <Input aria-label="Search library" placeholder="Search hotels, sightseeing, transfers" value={libSearch} onValueChange={setLibSearch} />
                            {!libFiltered.length ? <p className="text-sm text-default-500 py-4">Nothing in your library yet. Add hotels and sightseeing under Travel → Library.</p> : (
                                <div className="flex flex-col divide-y divide-default-100">
                                    {libFiltered.map((l) => (
                                        <button key={l.id} type="button" className="text-left py-2 px-1 hover:bg-default-50 rounded" onClick={() => {
                                            if (libFor === null) return;
                                            change((x) => { x[libFor].items.push({ type: LIB_TO_DAY[l.type] || "note", text: [l.name, l.description].filter(Boolean).join(" - "), library_item_id: l.id, image: l.photos?.[0] || null }); return x; });
                                            close();
                                        }}>
                                            <div className="font-medium text-sm">{l.name}{l.star ? ` · ${l.star}★` : ""}</div>
                                            <div className="text-xs text-default-500 line-clamp-1">{[l.type, l.destination, l.description].filter(Boolean).join(" · ")}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter><Button variant="light" onPress={close}>Close</Button></ModalFooter>
                    </>)}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default ItineraryBuilder;
