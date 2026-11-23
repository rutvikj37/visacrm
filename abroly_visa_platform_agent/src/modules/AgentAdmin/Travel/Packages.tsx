import { useEffect, useState } from "react";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea, useDisclosure } from "@heroui/react";
import { MessageCircle, Package, Pencil, Plus } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { Field, PageHead, apiBase, fmtDate, rupees, waLink } from "./travelShared";

const empty = { id: "", title: "", destination: "", nights: "4", price_pp: "", valid_from: "", valid_to: "", highlights: "", image_url: "", itinerary_id: "", status: "active" };

/** Fixed packages with price per person and validity, shared on WhatsApp (PK-01, PK-02). */
const Packages = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [rows, setRows] = useState<any[] | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const modal = useDisclosure();
    const [form, setForm] = useState<any>(empty);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const { success, data } = await commonGetAPICalls("/travel/packages");
        setRows(success ? data : []);
    };
    useEffect(() => { load(); }, []);

    const open = async (p?: any) => {
        const { success, data } = await commonGetAPICalls("/travel/itineraries?templates=1");
        setTemplates(success ? data : []);
        setForm(p ? { ...empty, ...p, nights: String(p.nights), price_pp: String(p.price_pp), valid_from: p.valid_from || "", valid_to: p.valid_to || "", itinerary_id: p.itinerary?.id || "", highlights: p.highlights || "", image_url: p.image_url || "" } : empty);
        modal.onOpen();
    };
    const save = async (close: () => void) => {
        setSaving(true);
        const body = { ...form, nights: Number(form.nights) || 0, price_pp: Number(form.price_pp) || 0, itinerary_id: form.itinerary_id || null };
        const { success } = await commonPostAPICall(body, form.id ? `travel/packages/${form.id}/update` : "travel/packages", true);
        setSaving(false);
        if (success) { close(); load(); }
    };
    const share = async (p: any) => {
        let link = "";
        if (p.itinerary?.id) {
            const { success, data } = await commonPostAPICall({}, `travel/itineraries/${p.itinerary.id}/share`);
            if (success) link = data.url || `${apiBase()}/v1/public/travel/itinerary/${data.token}`;
        }
        const text = `${p.title}\n${[p.destination, `${p.nights}N/${p.nights + 1}D`].filter(Boolean).join(" · ")}\nFrom ${rupees(p.price_pp)} per person${p.valid_to ? ` (valid till ${fmtDate(p.valid_to)})` : ""}${p.highlights ? `\n${p.highlights}` : ""}${link ? `\nDay plan: ${link}` : ""}\nReply to book!`;
        window.open(waLink("", text), "_blank", "noopener");
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Packages" sub="Ready trips with a price per person you can share in one tap"
                actions={<Button color="primary" startContent={<Plus size={16} />} onPress={() => open()}>New package</Button>} />
            {rows === null ? <CardListSkeleton /> : !rows.length ? (
                <EmptyState icon={Package} title="No packages yet" text="Add your fixed packages (for example Kerala 5N/6D from ₹18,999) and share them on WhatsApp." actions={<Button color="primary" startContent={<Plus size={14} />} onPress={() => open()}>Add a package</Button>} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {rows.map((p) => (
                        <Card key={p.id} shadow="sm" className={p.status === "inactive" ? "opacity-60" : ""}>
                            {p.image_url && <img src={p.image_url} alt="" className="h-36 w-full object-cover" />}
                            <CardBody className="gap-1">
                                <div className="flex items-start gap-2"><div className="font-semibold flex-1">{p.title}</div>{p.status === "inactive" && <Chip size="sm">Hidden</Chip>}</div>
                                <div className="text-sm text-default-500">{[p.destination, `${p.nights}N/${p.nights + 1}D`].filter(Boolean).join(" · ")}</div>
                                <div className="text-lg font-semibold">{rupees(p.price_pp)} <span className="text-xs font-normal text-default-500">per person</span></div>
                                {(p.valid_from || p.valid_to) && <div className="text-xs text-default-500">Valid {p.valid_from ? fmtDate(p.valid_from) : ""} – {p.valid_to ? fmtDate(p.valid_to) : "open"}</div>}
                                {p.highlights && <div className="text-xs text-default-600 line-clamp-2">{p.highlights}</div>}
                                <div className="flex gap-2 mt-2">
                                    <Button size="sm" variant="flat" color="success" className="flex-1" startContent={<MessageCircle size={14} />} onPress={() => share(p)}>Share</Button>
                                    <Button size="sm" variant="flat" startContent={<Pencil size={14} />} onPress={() => open(p)}>Edit</Button>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>{form.id ? "Edit package" : "New package"}</ModalHeader>
                    <ModalBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Package name" className="sm:col-span-2"><Input aria-label="Package name" value={form.title} onValueChange={(v) => setForm((f: any) => ({ ...f, title: v }))} /></Field>
                        <Field label="Destination"><Input aria-label="Destination" value={form.destination} onValueChange={(v) => setForm((f: any) => ({ ...f, destination: v }))} /></Field>
                        <Field label="Nights"><Input aria-label="Nights" type="number" value={form.nights} onValueChange={(v) => setForm((f: any) => ({ ...f, nights: v }))} /></Field>
                        <Field label="Price per person ₹"><Input aria-label="Price per person" type="number" value={form.price_pp} onValueChange={(v) => setForm((f: any) => ({ ...f, price_pp: v }))} /></Field>
                        <Field label="Day plan (template itinerary)"><Select aria-label="Template" placeholder="None" selectedKeys={form.itinerary_id ? [form.itinerary_id] : []} onChange={(e) => setForm((f: any) => ({ ...f, itinerary_id: e.target.value }))}>{templates.map((t) => <SelectItem key={t.id}>{t.title}</SelectItem>)}</Select></Field>
                        <Field label="Valid from"><Input aria-label="Valid from" type="date" value={form.valid_from} onValueChange={(v) => setForm((f: any) => ({ ...f, valid_from: v }))} /></Field>
                        <Field label="Valid to"><Input aria-label="Valid to" type="date" value={form.valid_to} onValueChange={(v) => setForm((f: any) => ({ ...f, valid_to: v }))} /></Field>
                        <Field label="Highlights" className="sm:col-span-2"><Textarea aria-label="Highlights" minRows={2} value={form.highlights} onValueChange={(v) => setForm((f: any) => ({ ...f, highlights: v }))} /></Field>
                        <Field label="Image URL (optional)" className="sm:col-span-2"><Input aria-label="Image URL" value={form.image_url} onValueChange={(v) => setForm((f: any) => ({ ...f, image_url: v }))} /></Field>
                        <Field label="Show in catalogue"><Select aria-label="Status" selectedKeys={[form.status]} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value || "active" }))}><SelectItem key="active">Yes</SelectItem><SelectItem key="inactive">Hidden</SelectItem></Select></Field>
                    </ModalBody>
                    <ModalFooter>
                        {form.id && <Button variant="light" color="danger" className="mr-auto" onPress={async () => { const { success } = await commonPostAPICall({}, `travel/packages/${form.id}/delete`, true); if (success) { close(); load(); } }}>Delete</Button>}
                        <Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={saving} onPress={() => save(close)}>Save</Button>
                    </ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

export default Packages;
