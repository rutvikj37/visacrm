import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Button, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination,
    Radio, RadioGroup, Select, SelectItem, Spinner, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, useDisclosure,
} from "@nextui-org/react";
import {
    AlarmClock, Ban, Building2, CalendarPlus, Copy, Download, ExternalLink, Eye, Gift, KeyRound, Plus, Repeat, Search, ShieldCheck, Sparkles, XCircle,
} from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { BulkBar, CsvColumn, RowAction, RowActions, downloadCsv, fetchAllPages, today, useCrossPageSelection } from "@/components/ListTools";
import { FormField, METHOD_LABEL, STATUS_META, fmtDate } from "./saasShared";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";
import LoginCodeDialog, { LoginCodeInfo } from "./LoginCodeDialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLATFORM_PORTAL_DOMAIN = (import.meta as any).env?.VITE_PLATFORM_PORTAL_DOMAIN || "techxsolutions.io";

const emptyForm = {
    name: "", owner_name: "", country_code: "+91", phone_number: "", email: "",
    portal_mode: "subdomain", sudomain: "", domain: "",
    plan_id: "", activate: "paid", amount: "", method: "upi", reference: "", note: "", trial_days: "14",
};

type BulkAction = "trial" | "free_days" | "change_plan" | "suspend" | "reactivate" | "end_access";
type ActionTarget = { mode: "trial" | "free_days" | "change_plan"; ids: string[]; label: string };

const SORTS = [
    { key: "ending", label: "Ending soonest" },
    { key: "ending_desc", label: "Ending latest" },
    { key: "newest", label: "Newest first" },
    { key: "oldest", label: "Oldest first" },
    { key: "name", label: "Name A-Z" },
];
const JOINED = [
    { key: "7", label: "Joined in last 7 days" },
    { key: "30", label: "Joined in last 30 days" },
    { key: "90", label: "Joined in last 90 days" },
    { key: "365", label: "Joined in last year" },
];

const CSV_COLUMNS: CsvColumn<any>[] = [
    { label: "Agency", value: (a) => a.name },
    { label: "Owner", value: (a) => a.owner_name },
    { label: "Phone", value: (a) => a.phone },
    { label: "Email", value: (a) => a.email },
    { label: "Plan", value: (a) => a.plan?.name || "" },
    { label: "Status", value: (a) => STATUS_META[a.status]?.label || a.status },
    { label: "Access until", value: (a) => (a.ends_at ? new Date(a.ends_at).toISOString().slice(0, 10) : "") },
    { label: "Days left", value: (a) => a.days_left },
    { label: "Team", value: (a) => a.team_members },
    { label: "Leads", value: (a) => a.leads },
    { label: "Portal", value: (a) => a.portal || "" },
    { label: "Joined", value: (a) => (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : "") },
];

const Stat = ({ icon: Icon, label, value, onPress }: any) => (
    <button type="button" onClick={onPress} className="text-left rounded-xl border border-default-200 bg-content1 p-3 flex flex-row items-center gap-3 hover:border-default-400 transition-colors">
        <div className="p-2 rounded-lg bg-primary-50 text-primary"><Icon size={18} /></div>
        <div><div className="text-xs text-default-500">{label}</div><div className="text-xl font-semibold">{value ?? "-"}</div></div>
    </button>
);

const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); SuccessToast(`${what} copied`); } catch { ErrorToast("Couldn't copy"); }
};

const SaasAgencies = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const status = params.get("status") || "";
    const plan = params.get("plan") || "";
    const sort = params.get("sort") || "";
    const joined = params.get("joined") || "";
    const page = Number(params.get("page") || 1);
    const [search, setSearch] = useState(params.get("search") || "");
    const [rows, setRows] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [pagination, setPagination] = useState<any>({ totalPages: 0 });
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [target, setTarget] = useState<ActionTarget | null>(null);
    const [actionForm, setActionForm] = useState({ days: "14", plan_id: "" });
    const [loginInfo, setLoginInfo] = useState<LoginCodeInfo>(null);
    const [openAfterDialog, setOpenAfterDialog] = useState<string | null>(null);
    const hasLoadedOnce = useRef(false);
    const create = useDisclosure();
    const sel = useCrossPageSelection(rows, (a: any) => a.id);

    const setParam = (k: string, v: string) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v); else next.delete(k);
        if (k !== "page") next.delete("page");
        setParams(next, { replace: true });
    };
    const filtersOn = Boolean(status || plan || joined || params.get("search"));
    const clearFilters = () => { setSearch(""); setParams(sort ? { sort } : {}, { replace: true }); };

    // filters only (no page) - shared by the list, "export all" and "select all matching"
    const filterQuery = useMemo(() => {
        const q = new URLSearchParams();
        if (status) q.set("status", status);
        if (plan) q.set("plan", plan);
        if (sort) q.set("sort", sort);
        if (joined) q.set("joined", joined);
        const s = params.get("search");
        if (s) q.set("search", s);
        return q.toString();
    }, [params, status, plan, sort, joined]);

    const load = useCallback(async () => {
        if (!hasLoadedOnce.current) setLoading(true);
        const { success, data } = await commonGetAPICalls(`/saas_admin/agencies?page=${page}${filterQuery ? `&${filterQuery}` : ""}`);
        if (success) {
            setRows(data.agencies || []);
            setSummary(data.summary);
            setPagination(data.pagination || {});
            hasLoadedOnce.current = true;
        }
        setLoading(false);
    }, [filterQuery, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/saas_admin/plans");
            if (success) setPlans(data || []);
        })();
    }, []);
    useEffect(() => {
        if (search === (params.get("search") || "")) return;
        const t = setTimeout(() => setParam("search", search.trim()), 400);
        return () => clearTimeout(t);
    }, [search]);

    const allMatching = () => fetchAllPages(commonGetAPICalls, `/saas_admin/agencies${filterQuery ? `?${filterQuery}` : ""}`, (d) => d.agencies || []);

    const exportAll = async () => {
        setBusy("export");
        const all = await allMatching();
        setBusy(null);
        if (!all.length) return ErrorToast("Nothing to export");
        downloadCsv(`agencies-${today()}`, CSV_COLUMNS, all);
    };
    const selectAllMatching = async () => {
        setBusy("select_all");
        sel.addAll(await allMatching());
        setBusy(null);
    };

    const runBulk = async (action: BulkAction, ids: string[], extra: Record<string, unknown> = {}) => {
        setBusy(action);
        const { success } = await commonPostAPICall({ action, ids, ...extra }, "saas_admin/agencies/bulk", true);
        setBusy(null);
        if (success) {
            // keep only what's still selected and wasn't part of this run
            if (ids.length > 1 || sel.selected.has(ids[0])) sel.clear();
            load();
        }
        return success;
    };

    const confirmRun = (action: "suspend" | "reactivate" | "end_access", ids: string[], label: string) => {
        const text = {
            suspend: `Suspend ${label}? The owner and their team won't be able to log in until you reactivate.`,
            reactivate: `Reactivate ${label}? They can log in again.`,
            end_access: `End access today for ${label}? Owners will only see the renew screen.`,
        }[action];
        if (window.confirm(text)) runBulk(action, ids);
    };

    const openAction = (mode: ActionTarget["mode"], ids: string[], label: string, currentPlan = "") => {
        setActionForm({ days: mode === "free_days" ? "7" : "14", plan_id: currentPlan });
        setTarget({ mode, ids, label });
    };

    const submitAction = async () => {
        if (!target) return;
        const days = Number(actionForm.days);
        if (target.mode !== "change_plan" && (!Number.isInteger(days) || days < 1 || days > 365)) return ErrorToast("Days must be between 1 and 365");
        if (target.mode === "change_plan" && !actionForm.plan_id) return ErrorToast("Please choose a plan");
        const ok = await runBulk(target.mode, target.ids, {
            ...(target.mode !== "change_plan" ? { days } : {}),
            ...(actionForm.plan_id ? { plan_id: actionForm.plan_id } : {}),
        });
        if (ok) setTarget(null);
    };

    const sendLogin = async (a: any) => {
        if (!window.confirm(`Send a new login code to ${a.email}? ${a.name}'s current code will stop working.`)) return;
        setBusy(`login:${a.id}`);
        const { success, data } = await commonPostAPICall({}, `saas_admin/agencies/${a.id}/send_login`, true);
        setBusy(null);
        if (success && data?.login_code) setLoginInfo({ phone: data.phone, code: data.login_code });
    };

    const rowActions = (a: any): RowAction[] => {
        const one = [a.id];
        const label = a.name;
        return [
            { key: "open", label: "Open details", icon: <Eye size={16} />, onPress: () => navigate(`/saas/agencies/${a.id}`) },
            { key: "extend", label: "Record payment / extend", icon: <CalendarPlus size={16} />, onPress: () => navigate(`/saas/agencies/${a.id}`) },
            { key: "trial", label: "Give free trial", icon: <Gift size={16} />, onPress: () => openAction("trial", one, label, a.plan?.id || "") },
            { key: "free_days", label: "Add free days", icon: <Sparkles size={16} />, onPress: () => openAction("free_days", one, label, "") },
            { key: "change_plan", label: "Change plan", icon: <Repeat size={16} />, onPress: () => openAction("change_plan", one, label, a.plan?.id || "") },
            { key: "send_login", label: "Send new login code", icon: <KeyRound size={16} />, onPress: () => sendLogin(a), hidden: !a.email },
            { key: "copy_phone", label: "Copy phone", icon: <Copy size={16} />, onPress: () => copy(a.phone, "Phone"), hidden: !a.phone },
            { key: "copy_email", label: "Copy email", icon: <Copy size={16} />, onPress: () => copy(a.email, "Email"), hidden: !a.email },
            { key: "portal", label: "Open student portal", icon: <ExternalLink size={16} />, onPress: () => window.open(`https://${a.portal}`, "_blank", "noopener"), hidden: !a.portal },
            { key: "reactivate", label: "Reactivate", icon: <ShieldCheck size={16} />, onPress: () => confirmRun("reactivate", one, label), hidden: a.status !== "suspended" },
            { key: "suspend", label: "Suspend", icon: <Ban size={16} />, danger: true, onPress: () => confirmRun("suspend", one, label), hidden: a.status === "suspended" },
            { key: "end_access", label: "End access now", icon: <XCircle size={16} />, danger: true, onPress: () => confirmRun("end_access", one, label), hidden: a.status === "expired" || a.status === "suspended" },
        ];
    };

    const submit = async (close: () => void) => {
        if (!form.owner_name.trim() || !form.phone_number.trim() || !form.email.trim()) return ErrorToast("Owner name, phone number and email are required");
        if (!EMAIL_RE.test(form.email.trim())) return ErrorToast("Please enter a valid email address");
        if (form.activate === "paid" && !form.plan_id) return ErrorToast("Please choose a 6 or 12 month plan");
        if (form.portal_mode === "subdomain" && !form.sudomain.trim()) return ErrorToast("Enter a subdomain for the student portal");
        if (form.portal_mode === "custom" && !form.domain.trim()) return ErrorToast("Enter the agency's domain");
        setSaving(true);
        const body = {
            name: form.name,
            owner_name: form.owner_name,
            country_code: form.country_code,
            phone_number: form.phone_number,
            email: form.email.trim(),
            sudomain: form.portal_mode === "subdomain" ? form.sudomain.trim().toLowerCase() : (form.sudomain.trim() || null),
            domain: form.portal_mode === "subdomain" ? PLATFORM_PORTAL_DOMAIN : form.domain.trim().toLowerCase(),
            plan_id: form.plan_id || undefined,
            activate: form.activate,
            amount: form.activate === "paid" ? Number(form.amount || 0) : undefined,
            method: form.method,
            reference: form.reference,
            note: form.note,
            trial_days: form.activate === "trial" ? Number(form.trial_days || 0) : 0,
        };
        const { success, data } = await commonPostAPICall(body, "saas_admin/agencies", true);
        setSaving(false);
        if (success) {
            close();
            setForm({ ...emptyForm });
            // email failed: show the code once, then open the agency
            if (data?.login_code) { setLoginInfo({ phone: data.phone, code: data.login_code }); setOpenAfterDialog(data.id); }
            else navigate(`/saas/agencies/${data.id}`);
        }
    };
    const set = (k: keyof typeof emptyForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const activePlans = plans.filter((p) => p.status === "active");
    const selectedPlan = activePlans.find((p) => p.id === form.plan_id);

    const count = sel.ids.length;
    const selLabel = `${count} agenc${count === 1 ? "y" : "ies"}`;
    const pageAllSelected = rows.length > 0 && rows.every((r) => sel.selected.has(r.id));
    const total = pagination.totalItems || 0;

    const showSpinner = loading && !hasLoadedOnce.current;

    return (
        <div className="flex flex-col gap-4 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Agencies</h1>
                    <p className="text-sm text-default-500">Every agency using the platform, their plan and how long their access lasts.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="flat" startContent={<Download size={16} />} isLoading={busy === "export"} onPress={exportAll}>Export</Button>
                    <Button color="primary" startContent={<Plus size={16} />} onPress={() => {
                        const plan12 = plans.find((p) => p.status === "active" && Number(p.duration_months) === 12);
                        const plan = plan12 || plans.find((p) => p.status === "active");
                        const price = plan
                            ? (Number(plan.duration_months) === 12 ? Number(plan.price_yearly || plan.price_monthly || 0) : Number(plan.price_monthly || 0))
                            : 0;
                        setForm({ ...emptyForm, plan_id: plan?.id || "", amount: price ? String(price) : "" });
                        create.onOpen();
                    }}>
                        Create agency
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Stat icon={Building2} label="All agencies" value={summary?.total} onPress={() => setParam("status", "")} />
                <Stat icon={Gift} label="On free trial" value={summary?.trial} onPress={() => setParam("status", "trial")} />
                <Stat icon={Sparkles} label="Paid / active" value={summary?.active} onPress={() => setParam("status", "active")} />
                <Stat icon={AlarmClock} label="Ending in 7 days" value={summary?.expiring_7_days} onPress={() => setParam("status", "expiring")} />
            </div>

            <div className="overflow-x-auto">
                <Tabs selectedKey={status || "all"} onSelectionChange={(k) => setParam("status", k === "all" ? "" : String(k))} variant="underlined" size="sm" aria-label="Status">
                    <Tab key="all" title="All" />
                    <Tab key="trial" title="Free trial" />
                    <Tab key="active" title="Active" />
                    <Tab key="expiring" title="Ending soon" />
                    <Tab key="expired" title="Expired" />
                    <Tab key="suspended" title="Suspended" />
                </Tabs>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <Input aria-label="Search" size="sm" placeholder="Search name, owner, phone, email, subdomain..." startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
                <Select aria-label="Plan" size="sm" placeholder="All plans" selectedKeys={plan ? [plan] : []} onChange={(e) => setParam("plan", e.target.value)}>
                    {plans.filter((p) => p.status === "active").map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                </Select>
                <Select aria-label="Joined" size="sm" placeholder="Joined any time" selectedKeys={joined ? [joined] : []} onChange={(e) => setParam("joined", e.target.value)}>
                    {JOINED.map((j) => <SelectItem key={j.key}>{j.label}</SelectItem>)}
                </Select>
                <Select aria-label="Sort" size="sm" placeholder="Sort: ending soonest" selectedKeys={sort ? [sort] : []} onChange={(e) => setParam("sort", e.target.value)}>
                    {SORTS.map((s) => <SelectItem key={s.key}>{`Sort: ${s.label.toLowerCase()}`}</SelectItem>)}
                </Select>
                {filtersOn ? <Button size="sm" variant="light" onPress={clearFilters}>Clear filters</Button> : <span className="hidden xl:block" />}
            </div>

            <BulkBar
                count={count}
                onClear={sel.clear}
                extra={pageAllSelected && total > count ? (
                    <Button size="sm" variant="light" color="primary" isLoading={busy === "select_all"} onPress={selectAllMatching}>Select all {total} matching</Button>
                ) : null}
            >
                <Button size="sm" variant="flat" startContent={<Gift size={14} />} onPress={() => openAction("trial", sel.ids, selLabel)}>Free trial</Button>
                <Button size="sm" variant="flat" startContent={<Sparkles size={14} />} onPress={() => openAction("free_days", sel.ids, selLabel)}>Add free days</Button>
                <Button size="sm" variant="flat" startContent={<Repeat size={14} />} onPress={() => openAction("change_plan", sel.ids, selLabel)}>Change plan</Button>
                <Button size="sm" variant="flat" startContent={<ShieldCheck size={14} />} isLoading={busy === "reactivate"} onPress={() => confirmRun("reactivate", sel.ids, selLabel)}>Reactivate</Button>
                <Button size="sm" variant="flat" color="danger" startContent={<Ban size={14} />} isLoading={busy === "suspend"} onPress={() => confirmRun("suspend", sel.ids, selLabel)}>Suspend</Button>
                <Button size="sm" variant="flat" color="danger" startContent={<XCircle size={14} />} isLoading={busy === "end_access"} onPress={() => confirmRun("end_access", sel.ids, selLabel)}>End access</Button>
                <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => downloadCsv(`agencies-selected-${today()}`, CSV_COLUMNS, sel.selectedRows)}>Export</Button>
            </BulkBar>

            {/* phones: cards */}
            <div className="md:hidden flex flex-col gap-2">
                {showSpinner ? <div className="flex justify-center p-8"><Spinner /></div> : !rows.length ? <div className="text-center text-sm text-default-500 py-8">No agencies found</div> : rows.map((a: any) => (
                    <div key={a.id} className={`rounded-xl border bg-content1 p-3 flex gap-2 ${sel.selected.has(a.id) ? "border-primary" : "border-default-200"}`}>
                        <Checkbox aria-label={`Select ${a.name}`} isSelected={sel.selected.has(a.id)} onValueChange={() => sel.toggle(a)} className="self-start" />
                        <button type="button" onClick={() => navigate(`/saas/agencies/${a.id}`)} className="text-left min-w-0 flex-1 flex flex-col gap-1.5">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate">{a.name}</div>
                                    <div className="text-xs text-default-500 truncate">{a.owner_name !== a.name ? `${a.owner_name} · ` : ""}{a.phone}</div>
                                </div>
                                <Chip size="sm" variant="flat" color={STATUS_META[a.status]?.color} className="shrink-0">{STATUS_META[a.status]?.label || a.status}</Chip>
                            </div>
                            <div className="text-xs text-default-600 flex flex-wrap gap-x-3">
                                <span>{a.plan?.name || "No plan"}</span>
                                <span className={a.days_left <= 7 && a.status !== "expired" ? "text-danger" : ""}>until {fmtDate(a.ends_at)}{a.status !== "expired" && a.status !== "suspended" ? ` (${a.days_left}d)` : ""}</span>
                                <span>Team {a.team_members}</span>
                                <span>Leads {a.leads}</span>
                            </div>
                        </button>
                        <div className="self-start"><RowActions actions={rowActions(a)} label={`Actions for ${a.name}`} /></div>
                    </div>
                ))}
            </div>

            <div className="max-md:hidden rounded-xl border border-default-200 bg-content1 overflow-x-auto">
                <Table
                    aria-label="Agencies"
                    removeWrapper
                    selectionMode="multiple"
                    selectedKeys={sel.selectedKeys}
                    onSelectionChange={sel.onSelectionChange}
                    onRowAction={(key) => navigate(`/saas/agencies/${key}`)}
                    className="min-w-[960px]"
                >
                    <TableHeader>
                        <TableColumn>AGENCY</TableColumn>
                        <TableColumn>PLAN</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                        <TableColumn>ACCESS UNTIL</TableColumn>
                        <TableColumn>TEAM</TableColumn>
                        <TableColumn>LEADS</TableColumn>
                        <TableColumn align="end" className="sticky right-0 z-10 bg-default-100">ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody items={rows} isLoading={showSpinner} loadingContent={<Spinner />} emptyContent={showSpinner ? " " : filtersOn ? "No agencies match these filters" : "No agencies found"}>
                        {(a: any) => (
                            <TableRow key={a.id} className="cursor-pointer">
                                <TableCell>
                                    <div className="font-medium">{a.name}</div>
                                    <div className="text-xs text-default-500">{a.owner_name !== a.name ? `${a.owner_name} · ` : ""}{a.phone}</div>
                                </TableCell>
                                <TableCell>{a.plan?.name || <span className="text-default-400">No plan</span>}</TableCell>
                                <TableCell><Chip size="sm" variant="flat" color={STATUS_META[a.status]?.color}>{STATUS_META[a.status]?.label || a.status}</Chip></TableCell>
                                <TableCell>
                                    <div className="text-sm">{fmtDate(a.ends_at)}</div>
                                    {a.status !== "expired" && a.status !== "suspended" && (
                                        <div className={`text-xs ${a.days_left <= 7 ? "text-danger" : "text-default-500"}`}>{a.days_left} day(s) left</div>
                                    )}
                                </TableCell>
                                <TableCell>{a.team_members}</TableCell>
                                <TableCell>{a.leads}</TableCell>
                                <TableCell className="sticky right-0 bg-content1 group-data-[hover=true]:bg-default-100 group-aria-[selected=true]:bg-default-100"><div className="flex justify-end"><RowActions actions={rowActions(a)} label={`Actions for ${a.name}`} /></div></TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-default-500">{total ? `${total} agenc${total === 1 ? "y" : "ies"}` : ""}</span>
                {pagination.totalPages > 1 && <Pagination total={pagination.totalPages} page={page} onChange={(p) => setParam("page", String(p))} showControls />}
            </div>

            {/* free trial / free days / change plan - for one agency or the selection */}
            <Modal isOpen={!!target} onOpenChange={(open) => !open && setTarget(null)}>
                <ModalContent>
                    {(onClose) => target && (
                        <>
                            <ModalHeader>
                                {{ trial: "Give free trial", free_days: "Add free days", change_plan: "Change plan" }[target.mode]}
                                <span className="ml-1 font-normal text-default-500">· {target.label}</span>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">
                                    {{
                                        trial: "Starts a free trial from today for the number of days you choose. Any remaining time is replaced.",
                                        free_days: "Adds complimentary days after each agency's current end date (or from today if it has already ended). No payment is recorded.",
                                        change_plan: "Moves the agencies to another plan. Their end dates stay the same; the new plan's limits apply right away.",
                                    }[target.mode]}
                                </p>
                                {target.mode !== "change_plan" && (
                                    <FormField label="Days"><Input aria-label="Days" type="number" min={1} max={365} value={actionForm.days} onValueChange={(v) => setActionForm((f) => ({ ...f, days: v }))} /></FormField>
                                )}
                                <FormField label={target.mode === "change_plan" ? "New plan" : "Plan (optional)"}>
                                    <Select
                                        aria-label="Plan"
                                        placeholder={target.mode === "change_plan" ? "Choose a plan" : "Keep each agency's current plan"}
                                        selectedKeys={actionForm.plan_id ? [actionForm.plan_id] : []}
                                        onChange={(e) => setActionForm((f) => ({ ...f, plan_id: e.target.value }))}
                                    >
                                        {plans.map((p) => <SelectItem key={p.id}>{p.status === "active" ? p.name : `${p.name} (inactive)`}</SelectItem>)}
                                    </Select>
                                </FormField>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={busy === target.mode} onPress={submitAction}>
                                    {{ trial: "Give trial", free_days: "Add days", change_plan: "Change plan" }[target.mode]}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <LoginCodeDialog info={loginInfo} onClose={() => {
                setLoginInfo(null);
                if (openAfterDialog) { const id = openAfterDialog; setOpenAfterDialog(null); navigate(`/saas/agencies/${id}`); }
            }} />

            <Modal isOpen={create.isOpen} onOpenChange={create.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Create agency</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">After you receive payment, create the agency, set their portal, activate 6/12 months, and we email the owner a login code.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Agency / brand name"><Input aria-label="Agency name" value={form.name} onValueChange={set("name")} /></FormField>
                                    <FormField label="Owner name *"><Input aria-label="Owner name" value={form.owner_name} onValueChange={set("owner_name")} /></FormField>
                                    <FormField label="Owner phone *">
                                        <div className="flex gap-2">
                                            <Input aria-label="Country code" value={form.country_code} onValueChange={set("country_code")} className="w-20 shrink-0" />
                                            <Input aria-label="Phone" value={form.phone_number} {...phoneInputProps} onValueChange={(v) => set("phone_number")(toPhoneDigits(v))} />
                                        </div>
                                    </FormField>
                                    <FormField label="Owner email *"><Input aria-label="Email" type="email" value={form.email} onValueChange={set("email")} description="Login details are emailed here" /></FormField>
                                </div>

                                <div className="mt-2 space-y-2">
                                    <div className="text-sm font-medium">Student portal</div>
                                    <RadioGroup orientation="horizontal" value={form.portal_mode} onValueChange={(v) => set("portal_mode")(v)}>
                                        <Radio value="subdomain">Our subdomain</Radio>
                                        <Radio value="custom">Their own domain</Radio>
                                    </RadioGroup>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {form.portal_mode === "subdomain" ? (
                                            <FormField label="Subdomain *" className="sm:col-span-2">
                                                <Input aria-label="Subdomain" placeholder="e.g. globalvisa" value={form.sudomain} onValueChange={(v) => set("sudomain")(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                                    description={form.sudomain ? `Portal: ${form.sudomain}.${PLATFORM_PORTAL_DOMAIN}` : `We host: yourname.${PLATFORM_PORTAL_DOMAIN}`} />
                                            </FormField>
                                        ) : (
                                            <>
                                                <FormField label="Their domain *"><Input aria-label="Domain" placeholder="e.g. globalvisa.com" value={form.domain} onValueChange={set("domain")} /></FormField>
                                                <FormField label="Optional host"><Input aria-label="Host" placeholder="e.g. portal or www" value={form.sudomain} onValueChange={set("sudomain")} description="Leave blank to use the bare domain" /></FormField>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 space-y-2">
                                    <div className="text-sm font-medium">Plan & payment</div>
                                    <RadioGroup orientation="horizontal" value={form.activate} onValueChange={(v) => set("activate")(v)}>
                                        <Radio value="paid">Paid — activate now</Radio>
                                        <Radio value="trial">Free trial</Radio>
                                        <Radio value="none">Create only (activate later)</Radio>
                                    </RadioGroup>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <FormField label="Plan *">
                                            <Select aria-label="Plan" selectedKeys={form.plan_id ? [form.plan_id] : []}
                                                onChange={(e) => {
                                                    const plan_id = e.target.value;
                                                    const p = activePlans.find((x) => x.id === plan_id);
                                                    const price = p
                                                        ? (Number(p.duration_months) === 12 ? Number(p.price_yearly || p.price_monthly || 0) : Number(p.price_monthly || 0))
                                                        : 0;
                                                    setForm((f) => ({ ...f, plan_id, amount: price ? String(price) : f.amount }));
                                                }}>
                                                {activePlans.map((p) => <SelectItem key={p.id} textValue={p.name}>{`${p.name} · full access`}</SelectItem>)}
                                            </Select>
                                        </FormField>
                                        {form.activate === "paid" && (
                                            <>
                                                <FormField label="Amount received (₹)"><Input aria-label="Amount" type="number" min={0} value={form.amount} onValueChange={set("amount")} description={selectedPlan?.duration_months ? `${selectedPlan.duration_months} months access` : undefined} /></FormField>
                                                <FormField label="Paid by">
                                                    <Select aria-label="Method" selectedKeys={[form.method]} onChange={(e) => e.target.value && set("method")(e.target.value)}>
                                                        {["upi", "bank_transfer", "cash", "cheque", "other"].map((m) => <SelectItem key={m}>{METHOD_LABEL[m]}</SelectItem>)}
                                                    </Select>
                                                </FormField>
                                                <FormField label="Reference (UTR / cheque no.)"><Input aria-label="Reference" value={form.reference} onValueChange={set("reference")} /></FormField>
                                            </>
                                        )}
                                        {form.activate === "trial" && (
                                            <FormField label="Free trial (days)"><Input aria-label="Trial days" type="number" min={1} max={365} value={form.trial_days} onValueChange={set("trial_days")} /></FormField>
                                        )}
                                        <FormField label="Note" className="sm:col-span-2"><Input aria-label="Note" value={form.note} onValueChange={set("note")} /></FormField>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => submit(onClose)}>
                                    {form.activate === "paid" ? "Create & activate" : "Create agency"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default SaasAgencies;
