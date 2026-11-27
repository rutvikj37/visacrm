import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Tab, Tabs, useDisclosure } from "@heroui/react";
import { Map, Plus, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { Field, ITINERARY_STATUS, PageHead, fmtDate } from "./travelShared";

/** Itineraries for leads, and reusable templates such as "Dubai 4N/5D" (IT-01..IT-03). */
const Itineraries = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const tab = params.get("tab") === "templates" ? "templates" : "trips";
    const [search, setSearch] = useState("");
    const [rows, setRows] = useState<any[] | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const create = useDisclosure();
    const [form, setForm] = useState({ title: "", destination: "", nights: "4", template_id: "", is_template: false });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const q = new URLSearchParams();
        if (tab === "templates") q.set("templates", "1");
        if (search.trim()) q.set("search", search.trim());
        const { success, data } = await commonGetAPICalls(`/travel/itineraries?${q.toString()}`);
        setRows(success ? data : []);
    }, [tab, search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const openCreate = async (asTemplate = false) => {
        const { success, data } = await commonGetAPICalls("/travel/itineraries?templates=1");
        setTemplates(success ? data : []);
        setForm({ title: "", destination: "", nights: "4", template_id: "", is_template: asTemplate });
        create.onOpen();
    };
    useEffect(() => {
        if (params.get("new") === "1") { openCreate(); const n = new URLSearchParams(params); n.delete("new"); setParams(n, { replace: true }); }
    }, []);

    const submit = async () => {
        setSaving(true);
        const { success, data } = await commonPostAPICall({ ...form, nights: Number(form.nights) || 0, template_id: form.template_id || undefined }, "travel/itineraries");
        setSaving(false);
        if (success && data?.id) navigate(`/travel/itineraries/${data.id}`);
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Itineraries" sub="Day-by-day trip plans you can share as a link or PDF"
                actions={<>
                    <Button variant="flat" onPress={() => openCreate(true)}>New template</Button>
                    <Button color="primary" startContent={<Plus size={16} />} onPress={() => openCreate(false)}>New itinerary</Button>
                </>} />
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <Tabs selectedKey={tab} onSelectionChange={(k) => setParams(k === "templates" ? { tab: "templates" } : {}, { replace: true })} variant="underlined" aria-label="Itinerary type">
                    <Tab key="trips" title="Client trips" /><Tab key="templates" title="Templates" />
                </Tabs>
                <Input aria-label="Search" className="sm:max-w-xs sm:ml-auto" placeholder="Search title" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            </div>
            {rows === null ? <CardListSkeleton /> : !rows.length ? (
                <EmptyState icon={Map} title={tab === "templates" ? "No templates yet" : "No itineraries yet"}
                    text={tab === "templates" ? "Save your best-selling trips as templates (for example Dubai 4N/5D) and copy them for each client." : "Build a day-by-day plan with hotels, sightseeing and transfers, then share it with the client."}
                    actions={<Button color="primary" startContent={<Plus size={14} />} onPress={() => openCreate(tab === "templates")}>{tab === "templates" ? "Create a template" : "Create an itinerary"}</Button>} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {rows.map((r) => (
                        <Card key={r.id} isPressable shadow="sm" onPress={() => navigate(`/travel/itineraries/${r.id}`)}>
                            <CardBody className="gap-1">
                                <div className="flex items-start gap-2">
                                    <div className="font-semibold flex-1 min-w-0 truncate">{r.title}</div>
                                    {!r.is_template && <Chip size="sm" variant="flat" color={ITINERARY_STATUS[r.status]?.color}>{ITINERARY_STATUS[r.status]?.label}</Chip>}
                                </div>
                                <div className="text-sm text-default-500 truncate">{[r.destination, `${r.nights}N/${r.nights + 1}D`].filter(Boolean).join(" · ")}</div>
                                <div className="text-xs text-default-400 truncate">{r.lead ? `For ${r.lead.name || "lead"} · ` : ""}Updated {fmtDate(r.updatedAt)}</div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={create.isOpen} onOpenChange={create.onOpenChange}>
                <ModalContent>
                    {(close) => (<>
                        <ModalHeader>{form.is_template ? "New template" : "New itinerary"}</ModalHeader>
                        <ModalBody className="gap-3">
                            {templates.length > 0 && !form.is_template && (
                                <Field label="Start from a template (optional)">
                                    <Select aria-label="Template" placeholder="Blank itinerary" selectedKeys={form.template_id ? [form.template_id] : []} onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}>
                                        {templates.map((t) => <SelectItem key={t.id}>{`${t.title} (${t.nights}N)`}</SelectItem>)}
                                    </Select>
                                </Field>
                            )}
                            <Field label="Title"><Input aria-label="Title" placeholder="e.g. Dubai family holiday 4N/5D" value={form.title} onValueChange={(v) => setForm((f) => ({ ...f, title: v }))} /></Field>
                            {!form.template_id && (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Destination"><Input aria-label="Destination" placeholder="Dubai" value={form.destination} onValueChange={(v) => setForm((f) => ({ ...f, destination: v }))} /></Field>
                                    <Field label="Nights"><Input aria-label="Nights" type="number" min={0} max={60} value={form.nights} onValueChange={(v) => setForm((f) => ({ ...f, nights: v }))} /></Field>
                                </div>
                            )}
                            <p className="text-xs text-default-500">To build one for a specific client, open their lead and choose “Create itinerary” so it is linked to them.</p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={close}>Cancel</Button>
                            <Button color="primary" isLoading={saving} onPress={submit}>Create</Button>
                        </ModalFooter>
                    </>)}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default Itineraries;
