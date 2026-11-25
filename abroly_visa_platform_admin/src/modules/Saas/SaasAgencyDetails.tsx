import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Radio, RadioGroup, Select, SelectItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea, useDisclosure,
} from "@nextui-org/react";
import { ArrowLeft, CalendarPlus, Gift, Globe, KeyRound, LockKeyhole, Pencil, Repeat, Trash2, XCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import AgencyModulesCard from "./AgencyModulesCard";
import AgencyWhatsappCard from "./AgencyWhatsappCard";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { FormField, KIND_LABEL, METHOD_LABEL, STATUS_META, fmtDate, rupees } from "./saasShared";
import { HEALTH_META, Trend, idleLabel } from "./SaasUsage";
import LoginCodeDialog, { LoginCodeInfo } from "./LoginCodeDialog";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";

const PLATFORM_PORTAL_DOMAIN = (import.meta as any).env?.VITE_PLATFORM_PORTAL_DOMAIN || "techxsolutions.io";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const emptyEdit = {
    name: "", owner_name: "", country_code: "+91", phone_number: "", email: "",
    support_number: "", support_email: "", agency_address: "", meta_description: "",
    primary_color: "", primary_foreground_color: "", dark_primary_color: "",
};

const portalUrlOf = (portal?: string | null) => (portal ? `https://${portal}` : "");

const copyPortal = async (portal?: string | null) => {
    const url = portalUrlOf(portal);
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
        SuccessToast("Copied");
    } catch {
        ErrorToast("Couldn't copy");
    }
};

const SaasAgencyDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [editForm, setEditForm] = useState({ ...emptyEdit });
    const openedEditFromQuery = useRef(false);

    const trialModal = useDisclosure();
    const extendModal = useDisclosure();
    const planModal = useDisclosure();
    const portalModal = useDisclosure();
    const editModal = useDisclosure();
    const [trial, setTrial] = useState({ days: "14", plan_id: "" });
    const [ext, setExt] = useState({ kind: "paid", plan_id: "", months: "12", amount: "", method: "upi", reference: "", note: "" });
    const [portal, setPortal] = useState({ mode: "subdomain", sudomain: "", domain: "" });
    const [newPlan, setNewPlan] = useState("");
    const [loginInfo, setLoginInfo] = useState<LoginCodeInfo>(null);

    const activePlans = plans.filter((p) => p.status === "active");

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/saas_admin/agencies/${id}`);
        if (success) setData(data);
        setLoading(false);
    }, [id]);
    useEffect(() => {
        load();
        (async () => {
            const { success, data } = await commonGetAPICalls("/saas_admin/plans");
            if (success) setPlans(data || []);
        })();
    }, [load]);

    useEffect(() => {
        if (!data?.agency || openedEditFromQuery.current || searchParams.get("edit") !== "1") return;
        openedEditFromQuery.current = true;
        const a = data.agency;
        setEditForm({
            name: a.app_name || a.name || "",
            owner_name: a.username || "",
            country_code: a.country_code || "+91",
            phone_number: a.phone_number || "",
            email: a.email || "",
            support_number: a.support_number || "",
            support_email: a.support_email || "",
            agency_address: a.agency_address || "",
            meta_description: a.meta_description || "",
            primary_color: a.primary_color || "",
            primary_foreground_color: a.primary_foreground_color || "",
            dark_primary_color: a.dark_primary_color || "",
        });
        editModal.onOpen();
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when details load with ?edit=1
    }, [data, searchParams, setSearchParams]);

    const currentPlanId = data?.access?.plan?.id || "";
    const planMeta = (planId: string) => {
        const p = plans.find((x) => x.id === planId);
        if (!p) return { months: 12, amount: "" };
        const months = Number(p.duration_months) === 6 ? 6 : 12;
        const amount = months === 12
            ? Number(p.price_yearly || p.price_monthly || 0)
            : Number(p.price_monthly || p.price_yearly || 0);
        return { months, amount: amount ? String(amount) : "" };
    };

    const run = async (url: string, body: object, close?: () => void) => {
        setBusy(true);
        const { success } = await commonPostAPICall(body, url, true);
        setBusy(false);
        if (success) {
            close?.();
            load();
        }
        return success;
    };

    // new 6-digit login code by email; old agencies without an email get asked for one first
    const sendLogin = async () => {
        let email = data?.agency?.email || "";
        if (!email) {
            email = (window.prompt("This agency has no email yet. Owner's email for the login code:") || "").trim();
            if (!email) return;
        } else if (!window.confirm(`Send a new login code to ${email}? The current code will stop working.`)) return;
        setBusy(true);
        const { success, data: res } = await commonPostAPICall({ email }, `saas_admin/agencies/${id}/send_login`, true);
        setBusy(false);
        if (success) {
            if (res?.login_code) setLoginInfo({ phone: res.phone, code: res.login_code });
            load();
        }
    };

    // forgot passcode / locked out: clear it, sign out everywhere, show a one-time login code (also emailed)
    const resetPasscode = async () => {
        if (!window.confirm("Reset the owner's passcode? Their current passcode stops working and they are signed out of all devices. You'll get a one-time login code to share.")) return;
        setBusy(true);
        const { success, data: res } = await commonPostAPICall({}, `saas_admin/agencies/${id}/reset_passcode`, true);
        setBusy(false);
        if (success && res?.login_code) {
            setLoginInfo({ phone: res.phone, code: res.login_code, reset: true, emailedTo: res.email_sent ? data?.agency?.email : null, loginUrl: res.login_url });
            load();
        }
    };

    const openEdit = () => {
        const a = data?.agency;
        if (!a) return;
        setEditForm({
            name: a.app_name || a.name || "",
            owner_name: a.username || "",
            country_code: a.country_code || "+91",
            phone_number: a.phone_number || "",
            email: a.email || "",
            support_number: a.support_number || "",
            support_email: a.support_email || "",
            agency_address: a.agency_address || "",
            meta_description: a.meta_description || "",
            primary_color: a.primary_color || "",
            primary_foreground_color: a.primary_foreground_color || "",
            dark_primary_color: a.dark_primary_color || "",
        });
        editModal.onOpen();
    };

    const setEdit = (k: keyof typeof emptyEdit) => (v: string) => setEditForm((f) => ({ ...f, [k]: v }));

    const saveEdit = async (close: () => void) => {
        if (!editForm.owner_name.trim() || !editForm.phone_number.trim() || !editForm.email.trim()) {
            return ErrorToast("Owner name, phone number and email are required");
        }
        if (!EMAIL_RE.test(editForm.email.trim())) return ErrorToast("Please enter a valid email address");
        if (editForm.support_email.trim() && !EMAIL_RE.test(editForm.support_email.trim())) {
            return ErrorToast("Please enter a valid support email");
        }
        for (const [label, value] of [
            ["Main colour", editForm.primary_color],
            ["Text on main colour", editForm.primary_foreground_color],
            ["Dark colour", editForm.dark_primary_color],
        ] as const) {
            if (value.trim() && !HEX_RE.test(value.trim())) return ErrorToast(`${label} must be hex like #0f5bd8`);
        }
        const ok = await run(`saas_admin/agencies/${id}/update`, {
            name: editForm.name.trim(),
            owner_name: editForm.owner_name.trim(),
            country_code: editForm.country_code.trim(),
            phone_number: editForm.phone_number.trim(),
            email: editForm.email.trim(),
            support_number: editForm.support_number.trim(),
            support_email: editForm.support_email.trim(),
            agency_address: editForm.agency_address.trim(),
            meta_description: editForm.meta_description.trim(),
            primary_color: editForm.primary_color.trim(),
            primary_foreground_color: editForm.primary_foreground_color.trim(),
            dark_primary_color: editForm.dark_primary_color.trim(),
        }, close);
        return ok;
    };

    const deleteAgency = async () => {
        const name = data?.agency?.name || "this agency";
        if (!window.confirm(`Delete ${name}? This removes the agency and its team from the admin list. Related leads and history stay for records. This cannot be undone from the panel.`)) return;
        if (!window.confirm(`Really delete ${name}? Type confirmation: press OK only if you are sure.`)) return;
        setBusy(true);
        const { success } = await commonPostAPICall({}, `saas_admin/agencies/${id}/delete`, true);
        setBusy(false);
        if (success) navigate("/saas/agencies");
    };

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
    if (!data) return <div>Agency not found. <Button size="sm" onPress={() => navigate("/saas/agencies")}>Back</Button></div>;

    const { agency, access } = data;
    const meta = STATUS_META[agency.status_label] || { label: agency.status_label, color: "default" };
    const portalHost = agency.portal || (agency.domain ? `${agency.sudomain ? `${agency.sudomain}.` : ""}${agency.domain}` : null);

    return (
        <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-start gap-3">
                <Button isIconOnly variant="light" onPress={() => navigate("/saas/agencies")} aria-label="Back"><ArrowLeft size={20} /></Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-semibold break-words">{agency.name}</h1>
                    <div className="text-sm text-default-500 flex flex-wrap items-center gap-x-1">
                        <span>{agency.username} · {agency.country_code} {agency.phone_number}{agency.email ? ` · ${agency.email}` : ""}</span>
                        {portalHost ? (
                            <>
                                <span>·</span>
                                <button
                                    type="button"
                                    className="text-primary hover:underline"
                                    title="Copy portal URL"
                                    onClick={() => copyPortal(portalHost)}
                                >
                                    {portalHost}
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-default-200 bg-content1 p-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                <div><div className="text-xs text-default-500">Status</div><Chip size="sm" variant="flat" color={meta.color}>{meta.label}</Chip></div>
                <div><div className="text-xs text-default-500">Plan</div><div className="font-medium">{access?.plan?.name || "No plan (full access)"}</div></div>
                <div><div className="text-xs text-default-500">Access until</div><div className="font-medium">{fmtDate(access?.ends_at)}</div><div className="text-xs text-default-500">{access?.expired ? "ended" : `${access?.days_left} day(s) left`}</div></div>
                <div><div className="text-xs text-default-500">Team members</div><div className="font-medium">{access?.team_count}{access?.plan?.max_team_members !== null && access?.plan ? ` / ${access.plan.max_team_members}` : ""}</div></div>
                <div><div className="text-xs text-default-500">Leads</div><div className="font-medium">{data.leads}</div></div>
            </div>

            {Array.isArray(data.modules) && data.modules.length > 0 && (
                <AgencyModulesCard agencyId={String(id)} crmType={data.crm_type} modules={data.modules} onSaved={load} />
            )}

            <AgencyWhatsappCard agencyId={String(id)} />

            <div className="flex flex-wrap gap-2">
                <Button variant="flat" startContent={<Pencil size={16} />} onPress={openEdit}>Edit details</Button>
                <Button color="primary" startContent={<CalendarPlus size={16} />} onPress={() => {
                    const planId = currentPlanId || activePlans[0]?.id || "";
                    const meta = planMeta(planId);
                    setExt({ kind: "paid", plan_id: planId, months: String(meta.months), amount: meta.amount, method: "upi", reference: "", note: "" });
                    extendModal.onOpen();
                }}>Record payment / activate</Button>
                <Button variant="flat" startContent={<Gift size={16} />} onPress={() => { setTrial({ days: "14", plan_id: currentPlanId || activePlans[0]?.id || "" }); trialModal.onOpen(); }}>Give free trial</Button>
                <Button variant="flat" startContent={<Repeat size={16} />} onPress={() => { setNewPlan(currentPlanId); planModal.onOpen(); }}>Change plan</Button>
                <Button variant="flat" startContent={<Globe size={16} />} onPress={() => {
                    const custom = Boolean(agency.domain && agency.domain !== PLATFORM_PORTAL_DOMAIN);
                    setPortal({
                        mode: custom ? "custom" : "subdomain",
                        sudomain: agency.sudomain || "",
                        domain: custom ? (agency.domain || "") : "",
                    });
                    portalModal.onOpen();
                }}>Portal domain</Button>
                <Button variant="flat" startContent={<KeyRound size={16} />} isLoading={busy} onPress={sendLogin}>Send new login code</Button>
                <Button variant="flat" color="warning" startContent={<LockKeyhole size={16} />} isLoading={busy} onPress={resetPasscode}>Reset passcode</Button>
                {!access?.expired && (
                    <Button variant="flat" color="danger" startContent={<XCircle size={16} />} isLoading={busy}
                        onPress={() => window.confirm("End this agency's access today? The owner will only see the renew screen.") && run(`saas_admin/agencies/${id}/end_access`, {})}>
                        End access now
                    </Button>
                )}
                <Button variant="flat" color="danger" startContent={<Trash2 size={16} />} isLoading={busy} onPress={deleteAgency}>
                    Delete agency
                </Button>
            </div>

            {data.usage && (
                <div className="rounded-xl border border-default-200 bg-content1 p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">Usage (last 30 days)</span>
                        <Chip size="sm" variant="flat" color={HEALTH_META[data.usage.health].color}>{HEALTH_META[data.usage.health].label} · {data.usage.score}</Chip>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div><div className="text-xs text-default-500">Last active</div><div className="font-medium">{idleLabel(data.usage.days_idle)}</div></div>
                        <div><div className="text-xs text-default-500">Team active this week</div><div className="font-medium">{data.usage.team_active_7d} / {data.usage.team_total}</div></div>
                        <div><div className="text-xs text-default-500">New leads</div><div className="font-medium">{data.usage.leads_30d} <Trend pct={data.usage.lead_trend_pct} /></div></div>
                        <div><div className="text-xs text-default-500">Work on leads</div><div className="font-medium">{data.usage.actions_30d}</div></div>
                        <div><div className="text-xs text-default-500">Lead sources</div><div className="font-medium">{data.usage.source_types.length ? data.usage.source_types.join(", ") : "None"}</div></div>
                    </div>
                    {data.usage.reasons.length > 0 && <ul className="text-sm text-warning-700 list-disc pl-5">{data.usage.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>}
                </div>
            )}
            <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
                <div className="px-3 py-2 text-sm font-semibold border-b border-default-100">Access history</div>
                <div className="overflow-x-auto">
                    <Table aria-label="History" removeWrapper className="min-w-[640px]">
                        <TableHeader>
                            <TableColumn>TYPE</TableColumn><TableColumn>PLAN</TableColumn><TableColumn>FROM</TableColumn><TableColumn>TO</TableColumn><TableColumn>NOTE</TableColumn>
                        </TableHeader>
                        <TableBody items={data.history || []} emptyContent="No trial or plan assigned yet">
                            {(h: any) => (
                                <TableRow key={h.id}>
                                    <TableCell><Chip size="sm" variant="flat" color={h.kind === "trial" ? "primary" : h.kind === "paid" ? "success" : "secondary"}>{KIND_LABEL[h.kind] || h.kind}</Chip></TableCell>
                                    <TableCell>{h.plan || "-"}</TableCell>
                                    <TableCell>{fmtDate(h.starts_at)}</TableCell>
                                    <TableCell>{fmtDate(h.ends_at)}</TableCell>
                                    <TableCell className="text-sm text-default-600">{h.note}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
                <div className="px-3 py-2 text-sm font-semibold border-b border-default-100">Payments</div>
                <div className="overflow-x-auto">
                    <Table aria-label="Payments" removeWrapper className="min-w-[640px]">
                        <TableHeader>
                            <TableColumn>DATE</TableColumn><TableColumn>AMOUNT</TableColumn><TableColumn>PLAN</TableColumn><TableColumn>METHOD</TableColumn><TableColumn>REFERENCE</TableColumn><TableColumn>INVOICE</TableColumn>
                        </TableHeader>
                        <TableBody items={data.payments || []} emptyContent="No payments yet">
                            {(p: any) => (
                                <TableRow key={p.id}>
                                    <TableCell>{fmtDate(p.paid_at)}</TableCell>
                                    <TableCell className="font-medium">{rupees(p.amount)}</TableCell>
                                    <TableCell>{p.plan || "-"}{p.months ? ` · ${p.months} mo` : ""}</TableCell>
                                    <TableCell>{METHOD_LABEL[p.method] || p.method}</TableCell>
                                    <TableCell className="text-sm text-default-600">{p.reference || "-"}</TableCell>
                                    <TableCell>{p.amount > 0 ? <Button size="sm" variant="light" color="primary" onPress={() => navigate(`/saas/invoices/${p.id}`)}>{p.invoice_number || "View"}</Button> : "-"}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* give trial */}
            <Modal isOpen={trialModal.isOpen} onOpenChange={trialModal.onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Give free trial</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">The trial starts today and replaces the current end date.</p>
                                {!access?.expired && access?.kind && access.kind !== "trial" && (
                                    <div className="text-sm bg-warning-50 text-warning-800 rounded-lg p-2">
                                        This agency has a {access.kind} plan until {fmtDate(access.ends_at)}. A trial would cut it short -
                                        use <b>Extend</b> with "Free extension" to give extra days instead.
                                    </div>
                                )}
                                <FormField label="Number of days"><Input aria-label="Days" type="number" min={1} max={365} value={trial.days} onValueChange={(v) => setTrial({ ...trial, days: v })} /></FormField>
                                <FormField label="Plan during the trial">
                                    <Select aria-label="Plan" selectedKeys={trial.plan_id ? [trial.plan_id] : []} onChange={(e) => setTrial({ ...trial, plan_id: e.target.value })}>
                                        {activePlans.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                                    </Select>
                                </FormField>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} onPress={() => {
                                    const days = Number(trial.days);
                                    if (!days || days < 1 || days > 365) return ErrorToast("Enter 1 to 365 days");
                                    run(`saas_admin/agencies/${id}/trial`, { days, plan_id: trial.plan_id || undefined }, onClose);
                                }}>Start trial</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* extend / record payment */}
            <Modal isOpen={extendModal.isOpen} onOpenChange={extendModal.onOpenChange} size="lg" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Record payment / activate plan</ModalHeader>
                            <ModalBody>
                                <RadioGroup orientation="horizontal" value={ext.kind} onValueChange={(v) => setExt({ ...ext, kind: v })}>
                                    <Radio value="paid">They paid</Radio>
                                    <Radio value="complimentary">Free extension</Radio>
                                </RadioGroup>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Plan" className="sm:col-span-2">
                                        <Select aria-label="Plan" selectedKeys={ext.plan_id ? [ext.plan_id] : []}
                                            onChange={(e) => {
                                                const plan_id = e.target.value;
                                                const meta = planMeta(plan_id);
                                                setExt({ ...ext, plan_id, months: String(meta.months), amount: meta.amount });
                                            }}>
                                            {activePlans.map((p) => <SelectItem key={p.id} textValue={p.name}>{`${p.name} · ${p.duration_months || "?"} months · full access`}</SelectItem>)}
                                        </Select>
                                    </FormField>
                                    <FormField label="Access period">
                                        <Input aria-label="Period" isReadOnly value={Number(ext.months) === 12 ? "12 months" : `${ext.months} months`} />
                                    </FormField>
                                    {ext.kind === "paid" && (
                                        <>
                                            <FormField label="Amount received (₹)"><Input aria-label="Amount" type="number" min={0} value={ext.amount} onValueChange={(v) => setExt({ ...ext, amount: v })} /></FormField>
                                            <FormField label="Paid by">
                                                <Select aria-label="Method" selectedKeys={[ext.method]} onChange={(e) => e.target.value && setExt({ ...ext, method: e.target.value })}>
                                                    {["upi", "bank_transfer", "cash", "cheque", "other"].map((m) => <SelectItem key={m}>{METHOD_LABEL[m]}</SelectItem>)}
                                                </Select>
                                            </FormField>
                                            <FormField label="Reference (UTR / cheque no.)" className="sm:col-span-2"><Input aria-label="Reference" value={ext.reference} onValueChange={(v) => setExt({ ...ext, reference: v })} /></FormField>
                                        </>
                                    )}
                                    <FormField label="Note" className="sm:col-span-2"><Input aria-label="Note" value={ext.note} onValueChange={(v) => setExt({ ...ext, note: v })} /></FormField>
                                </div>
                                <p className="text-xs text-default-500">
                                    New access is added after the current end date ({fmtDate(access?.expired ? new Date() : access?.ends_at)}), so no days are lost.
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} onPress={() => {
                                    if (!ext.plan_id) return ErrorToast("Please choose a plan");
                                    run(`saas_admin/agencies/${id}/extend`, {
                                        kind: ext.kind, plan_id: ext.plan_id, months: Number(ext.months),
                                        amount: ext.kind === "paid" ? Number(ext.amount || 0) : 0, method: ext.method, reference: ext.reference, note: ext.note,
                                    }, onClose);
                                }}>Activate plan</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* change plan */}
            <Modal isOpen={planModal.isOpen} onOpenChange={planModal.onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Change plan</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">Limits change right away. The end date stays the same.</p>
                                <Select aria-label="Plan" selectedKeys={newPlan ? [newPlan] : []} onChange={(e) => setNewPlan(e.target.value)}>
                                    {activePlans.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                                </Select>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} isDisabled={!newPlan} onPress={() => run(`saas_admin/agencies/${id}/change_plan`, { plan_id: newPlan }, onClose)}>Change plan</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* portal domain / subdomain */}
            <Modal isOpen={portalModal.isOpen} onOpenChange={portalModal.onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Student portal address</ModalHeader>
                            <ModalBody>
                                <RadioGroup orientation="horizontal" value={portal.mode} onValueChange={(v) => setPortal({ ...portal, mode: v })}>
                                    <Radio value="subdomain">Our subdomain</Radio>
                                    <Radio value="custom">Their own domain</Radio>
                                </RadioGroup>
                                {portal.mode === "subdomain" ? (
                                    <FormField label="Subdomain">
                                        <Input aria-label="Subdomain" placeholder="e.g. globalvisa" value={portal.sudomain}
                                            onValueChange={(v) => setPortal({ ...portal, sudomain: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                                            description={portal.sudomain ? `Portal: ${portal.sudomain}.${PLATFORM_PORTAL_DOMAIN}` : `We host: name.${PLATFORM_PORTAL_DOMAIN}`} />
                                    </FormField>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <FormField label="Their domain"><Input aria-label="Domain" placeholder="e.g. globalvisa.com" value={portal.domain} onValueChange={(v) => setPortal({ ...portal, domain: v })} /></FormField>
                                        <FormField label="Optional host"><Input aria-label="Host" placeholder="portal or www" value={portal.sudomain} onValueChange={(v) => setPortal({ ...portal, sudomain: v })} /></FormField>
                                    </div>
                                )}
                                <p className="text-xs text-default-500">DNS / SSL for custom domains still needs to be pointed at the server.</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} onPress={() => {
                                    if (portal.mode === "subdomain" && !portal.sudomain.trim()) return ErrorToast("Enter a subdomain");
                                    if (portal.mode === "custom" && !portal.domain.trim()) return ErrorToast("Enter their domain");
                                    run(`saas_admin/agencies/${id}/portal`, {
                                        sudomain: portal.mode === "subdomain" ? portal.sudomain.trim() : (portal.sudomain.trim() || null),
                                        domain: portal.mode === "subdomain" ? PLATFORM_PORTAL_DOMAIN : portal.domain.trim().toLowerCase(),
                                    }, onClose);
                                }}>Save portal</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Edit agency details</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Agency / brand name"><Input aria-label="Agency name" value={editForm.name} onValueChange={setEdit("name")} /></FormField>
                                    <FormField label="Owner name *"><Input aria-label="Owner name" value={editForm.owner_name} onValueChange={setEdit("owner_name")} /></FormField>
                                    <FormField label="Owner phone *">
                                        <div className="flex gap-2">
                                            <Input aria-label="Country code" value={editForm.country_code} onValueChange={setEdit("country_code")} className="w-20 shrink-0" />
                                            <Input aria-label="Phone" value={editForm.phone_number} {...phoneInputProps} onValueChange={(v) => setEdit("phone_number")(toPhoneDigits(v))} />
                                        </div>
                                    </FormField>
                                    <FormField label="Owner email *"><Input aria-label="Email" type="email" value={editForm.email} onValueChange={setEdit("email")} /></FormField>
                                    <FormField label="Support phone"><Input aria-label="Support phone" value={editForm.support_number} {...phoneInputProps} onValueChange={(v) => setEdit("support_number")(toPhoneDigits(v))} /></FormField>
                                    <FormField label="Support email"><Input aria-label="Support email" type="email" value={editForm.support_email} onValueChange={setEdit("support_email")} /></FormField>
                                    <FormField label="Agency address" className="sm:col-span-2"><Textarea aria-label="Address" minRows={2} value={editForm.agency_address} onValueChange={setEdit("agency_address")} /></FormField>
                                    <FormField label="Meta description" className="sm:col-span-2"><Textarea aria-label="Meta description" minRows={2} value={editForm.meta_description} onValueChange={setEdit("meta_description")} /></FormField>
                                    <FormField label="Main colour"><Input aria-label="Primary colour" placeholder="#0f5bd8" value={editForm.primary_color} onValueChange={setEdit("primary_color")} /></FormField>
                                    <FormField label="Text on main colour"><Input aria-label="Primary foreground" placeholder="#ffffff" value={editForm.primary_foreground_color} onValueChange={setEdit("primary_foreground_color")} /></FormField>
                                    <FormField label="Dark colour"><Input aria-label="Dark primary" placeholder="#050a30" value={editForm.dark_primary_color} onValueChange={setEdit("dark_primary_color")} /></FormField>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy} onPress={() => saveEdit(onClose)}>Save details</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            <LoginCodeDialog info={loginInfo} onClose={() => setLoginInfo(null)} />
        </div>
    );
};

export default SaasAgencyDetails;
