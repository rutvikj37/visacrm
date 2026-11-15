import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
    Radio, RadioGroup, Select, SelectItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure,
} from "@nextui-org/react";
import { ArrowLeft, CalendarPlus, Gift, KeyRound, Repeat, XCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { FormField, KIND_LABEL, METHOD_LABEL, STATUS_META, fmtDate, rupees } from "./saasShared";
import { HEALTH_META, Trend, idleLabel } from "./SaasUsage";
import LoginCodeDialog, { LoginCodeInfo } from "./LoginCodeDialog";

const MONTH_OPTIONS = [1, 3, 6, 12, 24];

const SaasAgencyDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const trialModal = useDisclosure();
    const extendModal = useDisclosure();
    const planModal = useDisclosure();
    const [trial, setTrial] = useState({ days: "14", plan_id: "" });
    const [ext, setExt] = useState({ kind: "paid", plan_id: "", months: "12", amount: "", method: "upi", reference: "", note: "" });
    const [newPlan, setNewPlan] = useState("");
    const [loginInfo, setLoginInfo] = useState<LoginCodeInfo>(null);

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

    const currentPlanId = data?.access?.plan?.id || "";
    const planPrice = (planId: string, months: number) => {
        const p = plans.find((x) => x.id === planId);
        if (!p) return "";
        return String(months === 12 && p.price_yearly ? p.price_yearly : p.price_monthly * months);
    };

    const run = async (url: string, body: object, close?: () => void) => {
        setBusy(true);
        const { success } = await commonPostAPICall(body, url, true);
        setBusy(false);
        if (success) {
            close?.();
            load();
        }
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

    if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
    if (!data) return <div>Agency not found. <Button size="sm" onPress={() => navigate("/saas/agencies")}>Back</Button></div>;

    const { agency, access } = data;
    const meta = STATUS_META[agency.status_label] || { label: agency.status_label, color: "default" };

    return (
        <div className="flex flex-col gap-4 max-w-5xl">
            <div className="flex items-start gap-3">
                <Button isIconOnly variant="light" onPress={() => navigate("/saas/agencies")} aria-label="Back"><ArrowLeft size={20} /></Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-semibold break-words">{agency.name}</h1>
                    <div className="text-sm text-default-500">
                        {agency.username} · {agency.country_code} {agency.phone_number}{agency.email ? ` · ${agency.email}` : ""}
                        {agency.domain ? ` · ${agency.sudomain ? `${agency.sudomain}.` : ""}${agency.domain}` : ""}
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

            <div className="flex flex-wrap gap-2">
                <Button color="primary" startContent={<CalendarPlus size={16} />} onPress={() => {
                    const planId = currentPlanId || plans[0]?.id || "";
                    setExt({ kind: "paid", plan_id: planId, months: "12", amount: planPrice(planId, 12), method: "upi", reference: "", note: "" });
                    extendModal.onOpen();
                }}>Extend / record payment</Button>
                <Button variant="flat" startContent={<Gift size={16} />} onPress={() => { setTrial({ days: "14", plan_id: currentPlanId || plans[0]?.id || "" }); trialModal.onOpen(); }}>Give free trial</Button>
                <Button variant="flat" startContent={<Repeat size={16} />} onPress={() => { setNewPlan(currentPlanId); planModal.onOpen(); }}>Change plan</Button>
                <Button variant="flat" startContent={<KeyRound size={16} />} isLoading={busy} onPress={sendLogin}>Send new login code</Button>
                {!access?.expired && (
                    <Button variant="flat" color="danger" startContent={<XCircle size={16} />} isLoading={busy}
                        onPress={() => window.confirm("End this agency's access today? The owner will only see the renew screen.") && run(`saas_admin/agencies/${id}/end_access`, {})}>
                        End access now
                    </Button>
                )}
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
                                        {plans.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
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
                            <ModalHeader>Extend access</ModalHeader>
                            <ModalBody>
                                <RadioGroup orientation="horizontal" value={ext.kind} onValueChange={(v) => setExt({ ...ext, kind: v })}>
                                    <Radio value="paid">They paid</Radio>
                                    <Radio value="complimentary">Free extension</Radio>
                                </RadioGroup>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Plan">
                                        <Select aria-label="Plan" selectedKeys={ext.plan_id ? [ext.plan_id] : []}
                                            onChange={(e) => setExt({ ...ext, plan_id: e.target.value, amount: planPrice(e.target.value, Number(ext.months)) })}>
                                            {plans.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                                        </Select>
                                    </FormField>
                                    <FormField label="Period">
                                        <Select aria-label="Months" selectedKeys={[ext.months]}
                                            onChange={(e) => e.target.value && setExt({ ...ext, months: e.target.value, amount: planPrice(ext.plan_id, Number(e.target.value)) })}>
                                            {MONTH_OPTIONS.map((m) => <SelectItem key={String(m)}>{m === 12 ? "1 year" : m === 24 ? "2 years" : `${m} month${m > 1 ? "s" : ""}`}</SelectItem>)}
                                        </Select>
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
                                    The new time is added after the current end date ({fmtDate(access?.expired ? new Date() : access?.ends_at)}), so no days are lost.
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
                                }}>Extend</Button>
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
                                    {plans.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
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
            <LoginCodeDialog info={loginInfo} onClose={() => setLoginInfo(null)} />
        </div>
    );
};

export default SaasAgencyDetails;
