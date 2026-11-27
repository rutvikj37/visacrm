import { useCallback, useEffect, useState } from "react";
import {
    Button, Card, CardBody, CardFooter, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Select, SelectItem, Spinner, Switch, Textarea, useDisclosure,
} from "@nextui-org/react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { FormField, rupees } from "./saasShared";
import { getProduct } from "@/utils/product";

type Feature = { key: string; label: string };
type Draft = {
    id?: string; name: string; description: string; price: string; duration_months: string;
    unlimited: boolean; max_team_members: string; sources: string[]; addons: string[]; active: boolean; sort_order: string;
    quote_limit: string; // Travel CRM: new quotes a month, "" = unlimited
    extra: Record<string, any>; // other saved features (e.g. modules), kept as they are
};

const emptyDraft = (): Draft => ({
    name: "", description: "", price: "0", duration_months: "6", unlimited: true, max_team_members: "",
    sources: [], addons: [], active: true, sort_order: "0", quote_limit: "", extra: {},
});

/** Saved features other than sources/add-ons: the quote limit, plus anything else (kept untouched on save). */
const fromFeatures = (f: any) => {
    const { sources, addons, quote_limit, ...extra } = f || {};
    void sources; void addons;
    return { quote_limit: Number(quote_limit) > 0 ? String(quote_limit) : "", extra };
};

const packagePrice = (p: any) => {
    if (Number(p.duration_months) === 12) return Number(p.price_yearly || p.price_monthly || 0);
    return Number(p.price_monthly || p.price_yearly || 0);
};

const SaasPlans = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const travel = getProduct() === "travel";
    const [plans, setPlans] = useState<any[]>([]);
    const [features, setFeatures] = useState<{ sources: Feature[]; addons: Feature[] }>({ sources: [], addons: [] });
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Draft>(emptyDraft());
    const [saving, setSaving] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const editor = useDisclosure();

    const load = useCallback(async () => {
        const [p, f] = await Promise.all([commonGetAPICalls("/saas_admin/plans"), commonGetAPICalls("/saas_admin/features")]);
        if (p.success) setPlans(p.data || []);
        if (f.success) {
            const sources = f.data?.sources || [];
            const addons = f.data?.addons || [];
            setFeatures({ sources, addons });
            setDraft((d) => d.id ? d : {
                ...emptyDraft(),
                sources: sources.map((x: Feature) => x.key),
                addons: addons.map((x: Feature) => x.key),
            });
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const openNew = () => {
        setDraft({
            ...emptyDraft(),
            sources: features.sources.map((f) => f.key),
            addons: features.addons.map((f) => f.key),
        });
        editor.onOpen();
    };
    const openEdit = (p: any) => {
        setDraft({
            id: p.id, name: p.name, description: p.description || "",
            price: String(packagePrice(p)),
            duration_months: String(p.duration_months || 6),
            unlimited: p.max_team_members === null, max_team_members: p.max_team_members === null ? "" : String(p.max_team_members),
            sources: p.features?.sources || [], addons: p.features?.addons || [], active: p.status === "active", sort_order: String(p.sort_order || 0),
            ...fromFeatures(p.features),
        });
        editor.onOpen();
    };
    const toggle = (list: "sources" | "addons", key: string) =>
        setDraft((d) => ({ ...d, [list]: d[list].includes(key) ? d[list].filter((k) => k !== key) : [...d[list], key] }));

    const planBody = (d: Draft, status?: "active" | "inactive") => {
        const months = Number(d.duration_months) === 12 ? 12 : 6;
        const price = Number(d.price || 0);
        return {
            name: d.name,
            description: d.description,
            price_monthly: months === 6 ? price : 0,
            price_yearly: months === 12 ? price : 0,
            duration_months: months,
            max_team_members: d.unlimited ? null : Number(d.max_team_members || 0),
            features: { ...d.extra, sources: d.sources, addons: d.addons, ...(Number(d.quote_limit) > 0 ? { quote_limit: Math.round(Number(d.quote_limit)) } : {}) },
            status: status || (d.active ? "active" : "inactive"),
            sort_order: Number(d.sort_order || 0),
        };
    };

    const save = async (close: () => void) => {
        if (!draft.name.trim()) return ErrorToast("Plan name is required");
        setSaving(true);
        const body = planBody(draft);
        const { success } = draft.id
            ? await commonPostAPICall(body, `saas_admin/plans/${draft.id}/update`, true)
            : await commonPostAPICall(body, "saas_admin/plans", true);
        setSaving(false);
        if (success) { close(); load(); }
    };

    const remove = async (p: any) => {
        if (!window.confirm(`Delete the plan "${p.name}"?`)) return;
        const { success } = await commonPostAPICall({}, `saas_admin/plans/${p.id}/delete`, true);
        if (success) load();
    };

    const setStatus = async (p: any, status: "active" | "inactive") => {
        setTogglingId(p.id);
        const draftFromPlan: Draft = {
            id: p.id, name: p.name, description: p.description || "",
            price: String(packagePrice(p)),
            duration_months: String(p.duration_months || 6),
            unlimited: p.max_team_members === null,
            max_team_members: p.max_team_members === null ? "" : String(p.max_team_members),
            sources: p.features?.sources || [], addons: p.features?.addons || [],
            active: status === "active", sort_order: String(p.sort_order || 0),
            ...fromFeatures(p.features),
        };
        const { success } = await commonPostAPICall(planBody(draftFromPlan, status), `saas_admin/plans/${p.id}/update`, true);
        setTogglingId(null);
        if (success) load();
    };

    const label = (list: Feature[], key: string) => list.find((f) => f.key === key)?.label || key;

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-4 p-2 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Plans</h1>
                    <p className="text-sm text-default-500">
                        Two durations with full access. Receive payment manually, then activate the plan on the agency.
                        Package price ₹0 means online checkout is off.
                    </p>
                </div>
                <Button color="primary" startContent={<Plus size={16} />} onPress={openNew}>New plan</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {plans.map((p) => (
                    <Card key={p.id} shadow="sm" className={p.status !== "active" ? "opacity-60" : ""}>
                        <CardBody className="gap-3">
                            <div className="flex items-start gap-2">
                                <div className="flex-1">
                                    <div className="text-lg font-semibold">{p.name}</div>
                                    {p.description && <div className="text-sm text-default-500">{p.description}</div>}
                                </div>
                                <Chip size="sm" variant="flat" color={p.status === "active" ? "success" : "default"}>
                                    {p.status === "active" ? "Enabled" : "Disabled"}
                                </Chip>
                            </div>
                            <div>
                                <span className="text-2xl font-bold">{rupees(packagePrice(p))}</span>
                                <span className="text-sm text-default-500">
                                    {" "}/ {p.duration_months ? `${p.duration_months} months` : "package"}
                                </span>
                            </div>
                            <div className="text-sm flex items-center gap-2"><Users size={14} /> {p.max_team_members === null ? "Unlimited team" : `${p.max_team_members} team member(s)`}</div>
                            {travel && <div className="text-sm text-default-600">{Number(p.features?.quote_limit) > 0 ? `${p.features.quote_limit} new quotes / month` : "Unlimited quotes"}</div>}
                            <div>
                                <div className="text-xs text-default-500 mb-1">Lead sources</div>
                                <div className="flex flex-wrap gap-1">
                                    {p.features.sources.length ? p.features.sources.map((k: string) => <Chip key={k} size="sm" variant="flat">{label(features.sources, k)}</Chip>) : <span className="text-xs text-default-400">None</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-default-500 mb-1">Add-ons</div>
                                <div className="flex flex-wrap gap-1">
                                    {p.features.addons.length ? p.features.addons.map((k: string) => <Chip key={k} size="sm" variant="flat" color="secondary">{label(features.addons, k)}</Chip>) : <span className="text-xs text-default-400">None</span>}
                                </div>
                            </div>
                            <div className="text-xs text-default-500">{p.agencies} agency(ies) on this plan</div>
                        </CardBody>
                        <CardFooter className="gap-2 pt-0 flex-wrap">
                            <Button size="sm" variant="flat" startContent={<Pencil size={14} />} onPress={() => openEdit(p)}>Edit</Button>
                            {p.status === "active" ? (
                                <Button size="sm" variant="flat" color="warning" isLoading={togglingId === p.id} onPress={() => setStatus(p, "inactive")}>Disable</Button>
                            ) : (
                                <Button size="sm" variant="flat" color="success" isLoading={togglingId === p.id} onPress={() => setStatus(p, "active")}>Enable</Button>
                            )}
                            <Button size="sm" variant="flat" color="danger" isIconOnly aria-label="Delete" onPress={() => remove(p)}><Trash2 size={14} /></Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <Modal isOpen={editor.isOpen} onOpenChange={editor.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{draft.id ? "Edit plan" : "New plan"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Plan name *"><Input aria-label="Plan name" value={draft.name} onValueChange={(v) => setDraft({ ...draft, name: v })} /></FormField>
                                    <FormField label="Duration">
                                        <Select aria-label="Duration" selectedKeys={[draft.duration_months]} onChange={(e) => e.target.value && setDraft({ ...draft, duration_months: e.target.value })}>
                                            <SelectItem key="6">6 months</SelectItem>
                                            <SelectItem key="12">12 months</SelectItem>
                                        </Select>
                                    </FormField>
                                    <FormField label="Short description" className="sm:col-span-2"><Textarea aria-label="Description" minRows={1} value={draft.description} onValueChange={(v) => setDraft({ ...draft, description: v })} /></FormField>
                                    <FormField label="Package price (₹)">
                                        <Input aria-label="Package price" type="number" min={0} value={draft.price} onValueChange={(v) => setDraft({ ...draft, price: v })} description="0 = manual activation only (no online pay)" />
                                    </FormField>
                                    <FormField label="Display order"><Input aria-label="Order" type="number" value={draft.sort_order} onValueChange={(v) => setDraft({ ...draft, sort_order: v })} /></FormField>
                                    <FormField label="Team members">
                                        <div className="flex items-center gap-3">
                                            <Input aria-label="Team limit" type="number" min={0} isDisabled={draft.unlimited} value={draft.max_team_members} onValueChange={(v) => setDraft({ ...draft, max_team_members: v })} className="w-28" />
                                            <Switch size="sm" isSelected={draft.unlimited} onValueChange={(v) => setDraft({ ...draft, unlimited: v })}>Unlimited</Switch>
                                        </div>
                                    </FormField>
                                    {travel && (
                                        <FormField label="New quotes per month">
                                            <div className="flex items-center gap-3">
                                                <Input aria-label="Quote limit" type="number" min={0} placeholder="Unlimited" value={draft.quote_limit} onValueChange={(v) => setDraft({ ...draft, quote_limit: v })} className="w-28" />
                                                <span className="text-xs text-default-500">Empty = unlimited. Resets on the 1st.</span>
                                            </div>
                                        </FormField>
                                    )}
                                    <FormField label="Status"><Switch size="sm" isSelected={draft.active} onValueChange={(v) => setDraft({ ...draft, active: v })}>Available</Switch></FormField>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                    <div className="flex flex-col gap-2">
                                        <div className="text-sm font-medium">Lead sources</div>
                                        {features.sources.map((f) => (
                                            <Checkbox key={f.key} isSelected={draft.sources.includes(f.key)} onValueChange={() => toggle("sources", f.key)}>{f.label}</Checkbox>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="text-sm font-medium">Paid add-ons</div>
                                        {features.addons.map((f) => (
                                            <Checkbox key={f.key} isSelected={draft.addons.includes(f.key)} onValueChange={() => toggle("addons", f.key)}>{f.label}</Checkbox>
                                        ))}
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => save(onClose)}>Save plan</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default SaasPlans;
