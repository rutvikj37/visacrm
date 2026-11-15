import { useCallback, useEffect, useState } from "react";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner,
    Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure,
} from "@nextui-org/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { FormField, fmtDate, rupees } from "./saasShared";

const EMPTY = { code: "", description: "", kind: "percent", value: "", max_discount: "", plan_ids: [] as string[], billing: "any", valid_from: "", valid_until: "", max_uses: "", per_agency_limit: "1", status: "active" };
const day = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

/** Discount codes agencies can enter when they pay online. */
const SaasCoupons = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [rows, setRows] = useState<any[] | null>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [form, setForm] = useState<any>(EMPTY);
    const [editing, setEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const modal = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/saas_admin/coupons");
        setRows(success ? data || [] : []);
    }, []);
    useEffect(() => {
        load();
        (async () => {
            const { success, data } = await commonGetAPICalls("/saas_admin/plans");
            if (success) setPlans(Array.isArray(data) ? data : data?.plans || []);
        })();
    }, [load]);

    const open = (c?: any) => {
        setEditing(c?.id || null);
        setForm(c ? {
            code: c.code, description: c.description || "", kind: c.kind, value: String(c.value), max_discount: c.max_discount ? String(c.max_discount) : "",
            plan_ids: c.plan_ids || [], billing: c.billing, valid_from: day(c.valid_from), valid_until: day(c.valid_until),
            max_uses: c.max_uses ? String(c.max_uses) : "", per_agency_limit: c.per_agency_limit ? String(c.per_agency_limit) : "", status: c.status,
        } : EMPTY);
        modal.onOpen();
    };
    const save = async (close: () => void) => {
        setSaving(true);
        const { success } = await commonPostAPICall(form, editing ? `/saas_admin/coupons/${editing}/update` : "/saas_admin/coupons", true);
        setSaving(false);
        if (success) { close(); load(); }
    };
    const remove = async (c: any) => {
        if (!window.confirm(`Delete coupon ${c.code}?`)) return;
        const { success } = await commonPostAPICall({}, `/saas_admin/coupons/${c.id}/delete`, true);
        if (success) load();
    };
    const set = (k: string) => (v: any) => setForm({ ...form, [k]: v });
    const expired = (c: any) => c.valid_until && new Date(c.valid_until).getTime() < Date.now();

    return (
        <div className="flex flex-col gap-4 p-2 max-w-full">
            <div className="flex flex-wrap items-start gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Coupons</h1>
                    <p className="text-sm text-default-500">Discount codes agencies enter when they renew online. A use is counted only when the payment succeeds.</p>
                </div>
                <Button color="primary" className="ml-auto" startContent={<Plus size={16} />} onPress={() => open()}>New coupon</Button>
            </div>
            <Card shadow="sm">
                <CardBody className="p-0 overflow-x-auto">
                    <Table aria-label="Coupons" removeWrapper className="min-w-[820px]">
                        <TableHeader>
                            <TableColumn>CODE</TableColumn><TableColumn>DISCOUNT</TableColumn><TableColumn>FOR</TableColumn><TableColumn>VALID</TableColumn>
                            <TableColumn>USED</TableColumn><TableColumn>DISCOUNT GIVEN</TableColumn><TableColumn>STATUS</TableColumn><TableColumn> </TableColumn>
                        </TableHeader>
                        <TableBody items={rows || []} isLoading={!rows} loadingContent={<Spinner />} emptyContent={rows ? "No coupons yet" : " "}>
                            {(c: any) => (
                                <TableRow key={c.id}>
                                    <TableCell><div className="font-mono font-semibold">{c.code}</div>{c.description && <div className="text-xs text-default-500">{c.description}</div>}</TableCell>
                                    <TableCell>{c.label}</TableCell>
                                    <TableCell className="text-sm">{c.plan_names?.length ? c.plan_names.join(", ") : "All plans"}{c.billing !== "any" ? ` · ${c.billing}` : ""}</TableCell>
                                    <TableCell className="text-sm">{c.valid_from || c.valid_until ? `${c.valid_from ? fmtDate(c.valid_from) : "Now"} - ${c.valid_until ? fmtDate(c.valid_until) : "no end"}` : "Always"}</TableCell>
                                    <TableCell className="text-sm">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}{c.per_agency_limit ? <div className="text-xs text-default-500">{c.per_agency_limit}x per agency</div> : null}</TableCell>
                                    <TableCell>{rupees(c.discount_given)}</TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="flat" color={c.status !== "active" ? "default" : expired(c) ? "warning" : "success"}>
                                            {c.status !== "active" ? "Off" : expired(c) ? "Expired" : "Active"}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button isIconOnly size="sm" variant="light" aria-label="Edit" onPress={() => open(c)}><Pencil size={15} /></Button>
                                            <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete" onPress={() => remove(c)}><Trash2 size={15} /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>

            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{editing ? `Edit ${form.code}` : "New coupon"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Code *"><Input aria-label="Code" placeholder="LAUNCH20" value={form.code} onValueChange={(v) => set("code")(v.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} /></FormField>
                                    <FormField label="Note (only you see it)"><Input aria-label="Note" value={form.description} onValueChange={set("description")} /></FormField>
                                    <FormField label="Type">
                                        <Select aria-label="Type" selectedKeys={[form.kind]} onChange={(e) => e.target.value && set("kind")(e.target.value)}>
                                            <SelectItem key="percent">Percent off</SelectItem>
                                            <SelectItem key="flat">Fixed amount off (₹)</SelectItem>
                                        </Select>
                                    </FormField>
                                    <FormField label={form.kind === "percent" ? "Discount % *" : "Discount ₹ *"}><Input aria-label="Discount" type="number" value={form.value} onValueChange={set("value")} /></FormField>
                                    {form.kind === "percent" && <FormField label="Maximum discount ₹ (optional)"><Input aria-label="Maximum discount" type="number" value={form.max_discount} onValueChange={set("max_discount")} /></FormField>}
                                    <FormField label="Billing">
                                        <Select aria-label="Billing" selectedKeys={[form.billing]} onChange={(e) => e.target.value && set("billing")(e.target.value)}>
                                            <SelectItem key="any">Monthly and yearly</SelectItem>
                                            <SelectItem key="monthly">Monthly only</SelectItem>
                                            <SelectItem key="yearly">Yearly only</SelectItem>
                                        </Select>
                                    </FormField>
                                    <FormField label="Plans" className="sm:col-span-2">
                                        <Select aria-label="Plans" selectionMode="multiple" placeholder="All plans" selectedKeys={new Set(form.plan_ids)} onSelectionChange={(keys) => set("plan_ids")(Array.from(keys as Set<string>))}>
                                            {plans.map((p: any) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                                        </Select>
                                    </FormField>
                                    <FormField label="Valid from"><Input aria-label="Valid from" type="date" value={form.valid_from} onValueChange={set("valid_from")} /></FormField>
                                    <FormField label="Valid until"><Input aria-label="Valid until" type="date" value={form.valid_until} onValueChange={set("valid_until")} /></FormField>
                                    <FormField label="Total uses (empty = no limit)"><Input aria-label="Total uses" type="number" value={form.max_uses} onValueChange={set("max_uses")} /></FormField>
                                    <FormField label="Uses per agency (empty = no limit)"><Input aria-label="Uses per agency" type="number" value={form.per_agency_limit} onValueChange={set("per_agency_limit")} /></FormField>
                                    <div className="sm:col-span-2 flex items-center gap-2">
                                        <Switch aria-label="Active" size="sm" isSelected={form.status === "active"} onValueChange={(v) => set("status")(v ? "active" : "inactive")} />
                                        <span className="text-sm">Agencies can use this code</span>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => save(onClose)}>{editing ? "Save" : "Create coupon"}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default SaasCoupons;
