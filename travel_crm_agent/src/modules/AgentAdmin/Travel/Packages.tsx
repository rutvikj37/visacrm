import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Tab, Tabs, Textarea, Tooltip, useDisclosure } from "@heroui/react";
import { CalendarDays, Copy, ExternalLink, Link2, MapPin, MessageCircle, Package, Pencil, Plus, Route, Search, Sparkles, TreePalm } from "lucide-react";
import { SuccessToast } from "@/utils/Toaster";
import { ImageUpload } from "./travelActions";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { Field, PageHead, Tile, apiBase, fmtDate, rupees, waLink } from "./travelShared";

const empty = { id: "", title: "", destination: "", nights: "4", price_pp: "", valid_from: "", valid_to: "", highlights: "", image_url: "", itinerary_id: "", status: "active" };

const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d: string) => Math.round((Date.parse(`${d}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) / 864e5);
/** "5D4N" like a travel poster. */
const durationTag = (n: number) => (n > 0 ? `${n + 1}D${n}N` : "Day trip");
/** Highlights as short tags: one per line, or comma separated. */
const tagsOf = (h?: string | null) => String(h || "").split(/\n|,|•|·|\|/).map((s) => s.replace(/^[-*\s]+/, "").trim()).filter(Boolean);

type Filter = "all" | "active" | "expiring" | "hidden";
const stateOf = (p: any): { key: "hidden" | "expired" | "expiring" | "live" | "upcoming"; label: string; color: "default" | "danger" | "warning" | "success" | "primary" } => {
    if (p.status === "inactive") return { key: "hidden", label: "Hidden", color: "default" };
    if (p.valid_to && daysUntil(p.valid_to) < 0) return { key: "expired", label: "Expired", color: "danger" };
    if (p.valid_from && daysUntil(p.valid_from) > 0) return { key: "upcoming", label: `From ${fmtDate(p.valid_from)}`, color: "primary" };
    if (p.valid_to && daysUntil(p.valid_to) <= 30) { const n = daysUntil(p.valid_to); return { key: "expiring", label: n === 0 ? "Ends today" : `Ends in ${n} day${n === 1 ? "" : "s"}`, color: "warning" }; }
    return { key: "live", label: "Live", color: "success" };
};

/** Fixed packages with price per person and validity, shared on WhatsApp (PK-01, PK-02). */
const Packages = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [rows, setRows] = useState<any[] | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const modal = useDisclosure();
    const [form, setForm] = useState<any>(empty);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");

    const [catalogue, setCatalogue] = useState("");
    const load = async () => {
        const { success, data } = await commonGetAPICalls("/travel/packages");
        setRows(success ? data : []);
        setCatalogue((data || [])[0]?.catalogue_url || "");
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
    const linkFor = async (p: any) => {
        // the public package page has the day plan and an enquiry form that creates a lead
        if (p.public_url) return p.public_url as string;
        if (p.itinerary?.id) {
            const { success, data } = await commonPostAPICall({}, `travel/itineraries/${p.itinerary.id}/share`);
            if (success) return (data.url || `${apiBase()}/v1/public/travel/itinerary/${data.token}`) as string;
        }
        return "";
    };
    const share = async (p: any) => {
        const link = await linkFor(p);
        const text = `${p.title}\n${[p.destination, `${p.nights}N/${p.nights + 1}D`].filter(Boolean).join(" · ")}\nFrom ${rupees(p.price_pp)} per person${p.valid_to ? ` (valid till ${fmtDate(p.valid_to)})` : ""}${p.highlights ? `\n${p.highlights}` : ""}${link ? `\nDetails and booking: ${link}` : ""}\nReply to book!`;
        window.open(waLink("", text), "_blank", "noopener");
    };
    const copyLink = async (p: any) => {
        const link = await linkFor(p);
        if (!link) return;
        await navigator.clipboard?.writeText(link);
        SuccessToast("Package link copied");
    };

    const stats = useMemo(() => {
        const list = rows || [];
        const live = list.filter((p) => ["live", "expiring", "upcoming"].includes(stateOf(p).key));
        const prices = live.map((p) => Number(p.price_pp)).filter((n) => n > 0);
        return {
            live: live.length,
            from: prices.length ? Math.min(...prices) : 0,
            expiring: list.filter((p) => stateOf(p).key === "expiring").length,
            hidden: list.filter((p) => ["hidden", "expired"].includes(stateOf(p).key)).length,
            destinations: new Set(live.map((p) => String(p.destination || "").trim().toLowerCase()).filter(Boolean)).size,
        };
    }, [rows]);

    const shown = useMemo(() => {
        const s = search.trim().toLowerCase();
        return (rows || []).filter((p) => {
            const st = stateOf(p).key;
            if (filter === "active" && !["live", "expiring", "upcoming"].includes(st)) return false;
            if (filter === "expiring" && st !== "expiring") return false;
            if (filter === "hidden" && !["hidden", "expired"].includes(st)) return false;
            return !s || [p.title, p.destination, p.highlights].some((v) => String(v || "").toLowerCase().includes(s));
        });
    }, [rows, search, filter]);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Packages" sub="Ready trips with a price per person. Each has a public page with an enquiry form that creates a lead."
                actions={<>
                    {catalogue && <Button variant="flat" startContent={<Copy size={16} />} onPress={async () => { await navigator.clipboard?.writeText(catalogue); SuccessToast("Catalogue link copied - add it to your website, Instagram bio or WhatsApp"); }}>Copy catalogue link</Button>}
                    {catalogue && <Button variant="flat" isIconOnly aria-label="Open catalogue" onPress={() => window.open(catalogue, "_blank", "noopener")}><ExternalLink size={16} /></Button>}
                    <Button color="primary" startContent={<Plus size={16} />} onPress={() => open()}>New package</Button>
                </>} />
            {rows === null ? <CardListSkeleton /> : !rows.length ? (
                <EmptyState icon={Package} title="No packages yet" text="Add your fixed packages (for example Kerala 5N/6D from ₹18,999) and share them on WhatsApp." actions={<Button color="primary" startContent={<Plus size={14} />} onPress={() => open()}>Add a package</Button>} />
            ) : (<>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Tile label="Live packages" value={stats.live} hint={`${stats.destinations} destination${stats.destinations === 1 ? "" : "s"}`} />
                    <Tile label="Starting from" value={stats.from ? rupees(stats.from) : "-"} hint="per person, lowest live price" />
                    <Tile label="Ending in 30 days" value={stats.expiring} hint="extend or replace them" tone={stats.expiring ? "danger" : undefined} />
                    <Tile label="Hidden or expired" value={stats.hidden} hint="not in your catalogue" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <Tabs aria-label="Filter packages" size="sm" radius="full" selectedKey={filter} onSelectionChange={(k) => setFilter(k as Filter)}>
                        <Tab key="all" title={`All (${rows.length})`} />
                        <Tab key="active" title="Live" />
                        <Tab key="expiring" title="Ending soon" />
                        <Tab key="hidden" title="Hidden / expired" />
                    </Tabs>
                    <Input aria-label="Search packages" size="sm" radius="full" className="sm:max-w-xs" placeholder="Search name, destination, highlight" startContent={<Search size={15} className="text-default-400" />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
                </div>
                {!shown.length ? (
                    <div className="rounded-2xl border border-dashed border-default-300 p-10 text-center text-sm text-default-500">No packages match. Try another filter or search.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {shown.map((p) => <PackageCard key={p.id} p={p} onShare={() => share(p)} onCopy={() => copyLink(p)} onEdit={() => open(p)} />)}
                        <button type="button" onClick={() => open()} className="group min-h-[320px] rounded-2xl border-2 border-dashed border-default-300 hover:border-primary hover:bg-primary-50/40 transition flex flex-col items-center justify-center gap-2 text-default-500 hover:text-primary">
                            <span className="h-12 w-12 rounded-full bg-default-100 group-hover:bg-primary group-hover:text-white flex items-center justify-center transition"><Plus size={22} /></span>
                            <span className="font-medium">Add a package</span>
                            <span className="text-xs text-default-400 max-w-[220px]">A fixed trip with one price per person, ready to share</span>
                        </button>
                    </div>
                )}
            </>)}
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
                        <Field label="Highlights (one per line - shown as tags)" className="sm:col-span-2"><Textarea aria-label="Highlights" minRows={2} value={form.highlights} onValueChange={(v) => setForm((f: any) => ({ ...f, highlights: v }))} /></Field>
                        <Field label="Photo" className="sm:col-span-2"><ImageUpload value={form.image_url || null} onChange={(url) => setForm((f: any) => ({ ...f, image_url: url || "" }))} /></Field>
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

/** Poster-style package card: photo with duration tag, status and title over it; price, tags and validity below. */
const PackageCard = ({ p, onShare, onCopy, onEdit }: { p: any; onShare: () => void; onCopy: () => void; onEdit: () => void }) => {
    const st = stateOf(p);
    const tags = tagsOf(p.highlights);
    const dim = st.key === "hidden" || st.key === "expired";
    return (
        <div className={`group rounded-2xl bg-content1 border border-default-200 shadow-sm hover:shadow-lg transition overflow-hidden flex flex-col ${dim ? "opacity-70" : ""}`}>
            <div className="relative h-52 overflow-hidden">
                {p.image_url ? (
                    <img src={p.image_url} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition duration-500" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-700">
                        <TreePalm className="absolute -right-6 -bottom-6 text-white/15" size={170} strokeWidth={1.2} />
                        <div className="absolute left-4 top-14 grid grid-cols-6 gap-1.5 opacity-40">{Array.from({ length: 24 }).map((_, i) => <span key={i} className="h-1 w-1 rounded-full bg-white" />)}</div>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold tracking-tight text-primary shadow">{durationTag(Number(p.nights) || 0)}</span>
                </div>
                <Chip size="sm" color={st.color} variant="solid" className="absolute right-3 top-3 shadow">{st.label}</Chip>
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    {p.destination && <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85"><MapPin size={12} />{p.destination}</div>}
                    <div className="mt-0.5 text-lg font-bold leading-snug line-clamp-2">{p.title}</div>
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide text-default-500">Starting from</div>
                        <div className="whitespace-nowrap text-2xl font-extrabold text-primary leading-tight">{rupees(p.price_pp)}<span className="ml-1 text-xs font-normal text-default-500">/ person</span></div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-default-100 px-2 py-1 text-xs font-semibold text-default-700">{p.nights}N / {Number(p.nights) + 1}D</span>
                </div>
                {(p.valid_from || p.valid_to) && <div className="flex items-center gap-1.5 text-xs text-default-600"><CalendarDays size={13} className="shrink-0" /><span className="truncate">Valid {p.valid_from ? fmtDate(p.valid_from) : "now"} – {p.valid_to ? fmtDate(p.valid_to) : "until changed"}</span></div>}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 4).map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700 max-w-full truncate"><Sparkles size={11} className="shrink-0" />{t}</span>)}
                        {tags.length > 4 && <span className="rounded-full bg-default-100 px-2.5 py-1 text-[11px] text-default-500">+{tags.length - 4} more</span>}
                    </div>
                )}
                <div className={`flex items-center gap-1.5 text-xs ${p.itinerary ? "text-default-600" : "text-default-400"}`}>
                    <Route size={13} className="shrink-0" />
                    <span className="truncate">{p.itinerary ? `Day plan: ${p.itinerary.title}` : "No day plan linked - the public page shows highlights only"}</span>
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                    <Button size="sm" color="success" className="flex-1 text-white font-medium" startContent={<MessageCircle size={15} />} onPress={onShare}>Share on WhatsApp</Button>
                    {(p.public_url || p.itinerary) && <Tooltip content="Copy link"><Button size="sm" variant="flat" isIconOnly aria-label="Copy link" onPress={onCopy}><Link2 size={15} /></Button></Tooltip>}
                    {p.public_url && <Tooltip content="Open public page"><Button size="sm" variant="flat" isIconOnly aria-label="Open public page" onPress={() => window.open(p.public_url, "_blank", "noopener")}><ExternalLink size={15} /></Button></Tooltip>}
                    <Tooltip content="Edit"><Button size="sm" variant="flat" isIconOnly aria-label="Edit package" onPress={onEdit}><Pencil size={15} /></Button></Tooltip>
                </div>
            </div>
        </div>
    );
};

export default Packages;
