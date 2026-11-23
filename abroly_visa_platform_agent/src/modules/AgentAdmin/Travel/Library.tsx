import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Tab, Tabs, Textarea, useDisclosure } from "@heroui/react";
import { Library as LibraryIcon, Plus, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { Field, LIBRARY_TYPES, PageHead } from "./travelShared";

const empty = { id: "", type: "activity", name: "", destination: "", star: "", description: "", photo: "" };

/** Master library of destinations, hotels, sightseeing and transfers used in itineraries (IT-02). */
const Library = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [type, setType] = useState("");
    const [search, setSearch] = useState("");
    const [rows, setRows] = useState<any[] | null>(null);
    const modal = useDisclosure();
    const [form, setForm] = useState<any>(empty);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const q = new URLSearchParams();
        if (type) q.set("type", type);
        if (search.trim()) q.set("search", search.trim());
        const { success, data } = await commonGetAPICalls(`/travel/library?${q.toString()}`);
        setRows(success ? data : []);
    }, [type, search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const open = (x?: any) => { setForm(x ? { ...empty, ...x, star: x.star ? String(x.star) : "", photo: x.photos?.[0] || "", description: x.description || "", destination: x.destination || "" } : { ...empty, type: type || "activity" }); modal.onOpen(); };
    const save = async (close: () => void) => {
        setSaving(true);
        const body = { ...form, star: form.star ? Number(form.star) : null, photos: form.photo ? [form.photo] : [] };
        const { success } = await commonPostAPICall(body, form.id ? `travel/library/${form.id}/update` : "travel/library", true);
        setSaving(false);
        if (success) { close(); load(); }
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Library" sub="Hotels, sightseeing, transfers and text blocks you reuse in every itinerary"
                actions={<Button color="primary" startContent={<Plus size={16} />} onPress={() => open()}>Add item</Button>} />
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="overflow-x-auto"><Tabs selectedKey={type || "all"} onSelectionChange={(k) => setType(k === "all" ? "" : String(k))} variant="underlined" aria-label="Type">
                    <Tab key="all" title="All" />{LIBRARY_TYPES.map((t) => <Tab key={t.key} title={t.label} />)}
                </Tabs></div>
                <Input aria-label="Search" className="sm:max-w-xs sm:ml-auto" placeholder="Search name or destination" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            </div>
            {rows === null ? <CardListSkeleton /> : !rows.length ? (
                <EmptyState icon={LibraryIcon} title="Library is empty" text="Add the hotels and sightseeing you sell often. In the itinerary builder, “From library” drops them into a day." actions={<Button color="primary" startContent={<Plus size={14} />} onPress={() => open()}>Add the first item</Button>} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {rows.map((x) => (
                        <Card key={x.id} isPressable shadow="sm" onPress={() => open(x)}>
                            {x.photos?.[0] && <img src={x.photos[0]} alt="" className="h-28 w-full object-cover" />}
                            <CardBody className="gap-1">
                                <div className="flex items-start gap-2"><div className="font-semibold flex-1 truncate">{x.name}{x.star ? ` · ${x.star}★` : ""}</div><Chip size="sm" variant="flat">{LIBRARY_TYPES.find((t) => t.key === x.type)?.label}</Chip></div>
                                {x.destination && <div className="text-xs text-default-500">{x.destination}</div>}
                                {x.description && <div className="text-sm text-default-600 line-clamp-2">{x.description}</div>}
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="xl" scrollBehavior="inside">
                <ModalContent>{(close) => (<>
                    <ModalHeader>{form.id ? "Edit item" : "Add to library"}</ModalHeader>
                    <ModalBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Type"><Select aria-label="Type" selectedKeys={[form.type]} onChange={(e) => setForm((f: any) => ({ ...f, type: e.target.value || "activity" }))}>{LIBRARY_TYPES.map((t) => <SelectItem key={t.key}>{t.label}</SelectItem>)}</Select></Field>
                        <Field label="Destination / city"><Input aria-label="Destination" value={form.destination} onValueChange={(v) => setForm((f: any) => ({ ...f, destination: v }))} /></Field>
                        <Field label="Name" className="sm:col-span-2"><Input aria-label="Name" value={form.name} onValueChange={(v) => setForm((f: any) => ({ ...f, name: v }))} /></Field>
                        {form.type === "hotel" && <Field label="Star rating"><Input aria-label="Star rating" type="number" min={1} max={7} value={form.star} onValueChange={(v) => setForm((f: any) => ({ ...f, star: v }))} /></Field>}
                        <Field label="Description" className="sm:col-span-2"><Textarea aria-label="Description" minRows={3} value={form.description} onValueChange={(v) => setForm((f: any) => ({ ...f, description: v }))} /></Field>
                        <Field label="Photo URL (optional)" className="sm:col-span-2"><Input aria-label="Photo URL" value={form.photo} onValueChange={(v) => setForm((f: any) => ({ ...f, photo: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter>
                        {form.id && <Button variant="light" color="danger" className="mr-auto" onPress={async () => { const { success } = await commonPostAPICall({}, `travel/library/${form.id}/delete`, true); if (success) { close(); load(); } }}>Delete</Button>}
                        <Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={saving} onPress={() => save(close)}>Save</Button>
                    </ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

export default Library;
