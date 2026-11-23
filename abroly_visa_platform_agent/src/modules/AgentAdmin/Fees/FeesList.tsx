import FirstTip from "@/components/help/FirstTip";
import { CardListSkeleton, ListSkeleton } from "@/components/ui-kit/Skeletons";
import EmptyState from "@/components/ui-kit/EmptyState";
import { BranchPicker } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Spinner,
    Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import { Plus, Search, Settings, MessageCircle, Receipt } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import InvoiceFormModal from "./InvoiceFormModal";
import { Field, STATUS, fmtDate, rupees } from "./feesShared";

const Tile = ({ label, value, tone }: { label: string; value: string; tone?: "danger" }) => (
    <div className="rounded-xl border border-default-200 bg-content1 p-2.5 sm:p-4 min-w-0">
        <div className="text-[11px] sm:text-xs text-default-500 truncate">{label}</div>
        <div className={`text-base sm:text-2xl font-semibold mt-0.5 sm:mt-1 truncate ${tone === "danger" ? "text-danger" : ""}`}>{value}</div>
    </div>
);

const FeesEmptyBase = ({ filtered, onNew }: { filtered: boolean; onNew: () => void }) => filtered
    ? <EmptyState compact icon={Receipt} title="No invoices here" text="Nothing matches this filter." />
    : <EmptyState icon={Receipt} title="No invoices yet" text="Bill a student's service fee with GST and instalments. They can pay by UPI, bank transfer or an online link."
        actions={<Button size="sm" color="primary" startContent={<Plus size={14} />} onPress={onNew}>Create your first invoice</Button>} />;

/** Client fees: every invoice, what is outstanding and overdue. */
const FeesList = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const status = params.get("status") || "";
    const page = Number(params.get("page") || 1);
    const [search, setSearch] = useState("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const create = useDisclosure();
    const FeesEmpty = () => <FeesEmptyBase filtered={Boolean(status || search.trim() || params.get("branch") || params.get("case"))} onNew={create.onOpen} />;
    const settingsModal = useDisclosure();
    const [settings, setSettings] = useState<any>(null);
    const [savingSettings, setSavingSettings] = useState(false);

    const setParam = (k: string, v: string) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v); else next.delete(k);
        if (k !== "page") next.delete("page");
        setParams(next, { replace: true });
    };

    const load = useCallback(async () => {
        // Soft refresh: keep prior invoices visible (list shows skeleton only when empty)
        setLoading(true);
        const q = new URLSearchParams({ page: String(page) });
        if (status) q.set("status", status);
        if (search.trim()) q.set("search", search.trim());
        if (params.get("case")) q.set("case_id", String(params.get("case")));
        if (params.get("branch")) q.set("branch", String(params.get("branch")));
        const { success, data } = await commonGetAPICalls(`/crm/fees/invoices?${q.toString()}`);
        if (success) setData(data);
        setLoading(false);
    }, [page, status, search, params]);
    useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

    const openSettings = async () => {
        const { success, data } = await commonGetAPICalls("/crm/fees/settings");
        if (success) { setSettings({ ...data, razorpay_key_secret: "", cashfree_secret: "" }); settingsModal.onOpen(); }
    };
    const saveSettings = async (close: () => void) => {
        setSavingSettings(true);
        const { success } = await commonPostAPICall(settings, "crm/fees/settings", true);
        setSavingSettings(false);
        if (success) close();
    };
    const setS = (k: string) => (v: string) => setSettings((s: any) => ({ ...s, [k]: v }));
    const s = data?.summary;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <FirstTip id="fees" title="Client fees">Create an invoice, then send the payment link on WhatsApp. GST is worked out from your billing settings and you get a reminder on Today before it is due.</FirstTip>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Client fees</h1>
                    <p className="text-sm text-default-500">Invoices, payments received and what is still due</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {isOwner && <Button variant="flat" className="w-full sm:w-auto" startContent={<Settings size={16} />} onPress={openSettings}>Billing settings</Button>}
                    {data?.can_manage && <Button color="primary" className="w-full sm:w-auto" startContent={<Plus size={16} />} onPress={create.onOpen}>New invoice</Button>}
                </div>
            </div>

            {s && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Tile label="Outstanding" value={rupees(s.outstanding)} />
                    <Tile label={`Overdue (${s.overdue_count})`} value={rupees(s.overdue_amount)} tone={s.overdue_count ? "danger" : undefined} />
                    <Tile label="Received this month" value={rupees(s.received_this_month)} />
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                <div className="overflow-x-auto">
                    <Tabs selectedKey={status || "all"} onSelectionChange={(k) => setParam("status", k === "all" ? "" : String(k))} variant="underlined" aria-label="Invoice status">
                        <Tab key="all" title="All" /><Tab key="due" title="Due" /><Tab key="overdue" title="Overdue" /><Tab key="paid" title="Paid" /><Tab key="cancelled" title="Cancelled" />
                    </Tabs>
                </div>
                <BranchPicker value={params.get("branch") || ""} onChange={(v) => setParam("branch", v)} className="w-full lg:w-48 lg:ml-auto" />
                <Input aria-label="Search" className="lg:max-w-xs" placeholder="Search student name or phone" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            </div>

            {/* phones: one card per invoice, with a WhatsApp reminder button */}
            <div className="md:hidden flex flex-col gap-2">
                {loading && !(data?.invoices || []).length ? <CardListSkeleton /> : !(data?.invoices || []).length ? (
                    <FeesEmpty />
                ) : data.invoices.map((inv: any) => {
                    const st = inv.overdue ? { label: "Overdue", color: "danger" as const } : { label: STATUS[inv.status]?.label, color: STATUS[inv.status]?.color };
                    const wa = inv.student?.phone_digits && inv.balance > 0
                        ? `https://wa.me/${inv.student.phone_digits}?text=${encodeURIComponent(`Hi ${String(inv.student?.name || "").split(" ")[0]}, a reminder about invoice ${inv.number}: ${rupees(inv.next_due?.amount || inv.balance)} is due${inv.next_due?.due_date ? ` by ${fmtDate(inv.next_due.due_date)}` : ""}.`)}`
                        : null;
                    return (
                        <div key={inv.id} className="rounded-xl border border-default-200 bg-content1 p-3 flex flex-col gap-2">
                            <button type="button" className="text-left flex items-start gap-2" onClick={() => navigate(`/fees/${inv.id}`)}>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate">{inv.student?.name || "Student"}</div>
                                    <div className="text-xs text-default-500 truncate">{inv.number}{inv.title ? ` · ${inv.title}` : ""}</div>
                                </div>
                                <Chip size="sm" variant="flat" color={st.color} className="shrink-0">{st.label}</Chip>
                            </button>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div><div className="text-default-500">Total</div><div className="font-medium">{rupees(inv.total)}</div></div>
                                <div><div className="text-default-500">Paid</div><div className="font-medium">{rupees(inv.amount_paid)}</div></div>
                                <div><div className="text-default-500">Balance</div><div className="font-semibold">{rupees(inv.balance)}</div></div>
                            </div>
                            {inv.next_due && <div className={`text-xs ${inv.overdue ? "text-danger font-medium" : "text-default-600"}`}>Next: {rupees(inv.next_due.amount)} by {fmtDate(inv.next_due.due_date)}</div>}
                            <div className="flex gap-2">
                                <Button size="sm" variant="flat" className="flex-1" onPress={() => navigate(`/fees/${inv.id}`)}>Open</Button>
                                {wa && <Button as="a" href={wa} target="_blank" rel="noopener" size="sm" variant="flat" color="success" className="flex-1" startContent={<MessageCircle size={14} />}>Remind</Button>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Card shadow="sm" className="max-md:hidden">
                <CardBody className="p-0 overflow-x-auto">
                    <Table aria-label="Invoices" removeWrapper onRowAction={(key) => navigate(`/fees/${key}`)} className="min-w-[820px]">
                        <TableHeader>
                            <TableColumn>INVOICE</TableColumn><TableColumn>STUDENT</TableColumn><TableColumn>TOTAL</TableColumn>
                            <TableColumn>PAID</TableColumn><TableColumn>BALANCE</TableColumn><TableColumn>NEXT DUE</TableColumn><TableColumn>STATUS</TableColumn>
                        </TableHeader>
                        <TableBody items={data?.invoices || []} isLoading={loading && !(data?.invoices || []).length} loadingContent={<div className="w-full px-3 bg-content1"><ListSkeleton rows={5} /></div>} emptyContent={loading ? " " : <FeesEmpty />}>
                            {(inv: any) => (
                                <TableRow key={inv.id} className="cursor-pointer">
                                    <TableCell><div className="font-medium">{inv.number}</div><div className="text-xs text-default-500 truncate max-w-[200px]">{inv.title || fmtDate(inv.issue_date)}</div></TableCell>
                                    <TableCell><div>{inv.student?.name}</div><div className="text-xs text-default-500">{inv.student?.phone}</div></TableCell>
                                    <TableCell>{rupees(inv.total)}</TableCell>
                                    <TableCell>{rupees(inv.amount_paid)}</TableCell>
                                    <TableCell className="font-medium">{rupees(inv.balance)}</TableCell>
                                    <TableCell>{inv.next_due ? <span className={inv.overdue ? "text-danger font-medium" : ""}>{rupees(inv.next_due.amount)} · {fmtDate(inv.next_due.due_date)}</span> : "-"}</TableCell>
                                    <TableCell><Chip size="sm" variant="flat" color={inv.overdue ? "danger" : STATUS[inv.status]?.color}>{inv.overdue ? "Overdue" : STATUS[inv.status]?.label}</Chip></TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>
            {data?.pagination?.totalPages > 1 && <div className="flex justify-center"><Pagination total={data.pagination.totalPages} page={page} onChange={(p) => setParam("page", String(p))} showControls /></div>}

            <InvoiceFormModal isOpen={create.isOpen} onOpenChange={create.onOpenChange} onCreated={(id) => navigate(`/fees/${id}`)} />

            <Modal isOpen={settingsModal.isOpen} onOpenChange={settingsModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => settings && (
                        <>
                            <ModalHeader>Billing settings</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Business name on invoices"><Input aria-label="Business name" value={settings.legal_name} onValueChange={setS("legal_name")} /></Field>
                                    <Field label="GSTIN (optional)"><Input aria-label="GSTIN" value={settings.gstin} onValueChange={setS("gstin")} /></Field>
                                    <Field label="Invoice number prefix"><Input aria-label="Prefix" value={settings.invoice_prefix} onValueChange={setS("invoice_prefix")} /></Field>
                                    <Field label="Default GST %"><Input aria-label="GST" type="number" min={0} max={28} value={String(settings.default_gst_percent ?? 0)} onValueChange={setS("default_gst_percent")} /></Field>
                                    <Field label="Address" className="sm:col-span-2"><Textarea aria-label="Address" minRows={2} value={settings.address} onValueChange={setS("address")} /></Field>
                                    <Field label="UPI ID (shown on invoices)"><Input aria-label="UPI ID" placeholder="yourname@bank" value={settings.upi_id} onValueChange={setS("upi_id")} /></Field>
                                    <Field label="Bank details (shown on invoices)"><Textarea aria-label="Bank details" minRows={2} value={settings.bank_details} onValueChange={setS("bank_details")} /></Field>
                                    <Field label="Terms / footer note" className="sm:col-span-2"><Textarea aria-label="Terms" minRows={2} value={settings.terms} onValueChange={setS("terms")} /></Field>
                                </div>
                                <div className="rounded-xl border border-default-200 p-3 flex flex-col gap-3">
                                    <div>
                                        <div className="font-medium text-sm">Online payment links (your own Razorpay account)</div>
                                        <div className="text-xs text-default-500">Money goes straight to your Razorpay account. Find the keys in Razorpay Dashboard → Account & Settings → API Keys.</div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Key ID"><Input aria-label="Razorpay key id" placeholder="rzp_live_..." value={settings.razorpay_key_id} onValueChange={setS("razorpay_key_id")} /></Field>
                                        <Field label={settings.razorpay_secret_masked ? `Key Secret (saved ${settings.razorpay_secret_masked})` : "Key Secret"}>
                                            <Input aria-label="Razorpay key secret" type="password" autoComplete="off" placeholder={settings.razorpay_secret_masked ? "Leave empty to keep" : ""} value={settings.razorpay_key_secret} onValueChange={setS("razorpay_key_secret")} />
                                        </Field>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-default-200 p-3 flex flex-col gap-3">
                                    <div>
                                        <div className="font-medium text-sm">Or Cashfree (your own Cashfree account)</div>
                                        <div className="text-xs text-default-500">Cashfree Dashboard → Developers → API Keys (Payment Gateway). Test keys start with TEST and use the sandbox.</div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="App ID"><Input aria-label="Cashfree app id" value={settings.cashfree_app_id || ""} onValueChange={setS("cashfree_app_id")} /></Field>
                                        <Field label={settings.cashfree_secret_masked ? `Secret Key (saved ${settings.cashfree_secret_masked})` : "Secret Key"}>
                                            <Input aria-label="Cashfree secret" type="password" autoComplete="off" placeholder={settings.cashfree_secret_masked ? "Leave empty to keep" : ""} value={settings.cashfree_secret || ""} onValueChange={setS("cashfree_secret")} />
                                        </Field>
                                        <Field label="Use for payment links" className="sm:col-span-2">
                                            <select aria-label="Payment gateway" className="h-10 rounded-medium bg-default-100 px-3 text-sm" value={settings.payment_gateway || "razorpay"} onChange={(e) => setS("payment_gateway")(e.target.value)}>
                                                <option value="razorpay">Razorpay</option><option value="cashfree">Cashfree</option>
                                            </select>
                                        </Field>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={savingSettings} onPress={() => saveSettings(onClose)}>Save</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default FeesList;
