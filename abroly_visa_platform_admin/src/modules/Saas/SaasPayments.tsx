import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Button, Chip, Input, Pagination, Select, SelectItem, Spinner, Switch, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs,
} from "@nextui-org/react";
import { BellRing, Building2, CheckCheck, Copy, Download, FileText, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { BulkBar, CsvColumn, RowAction, RowActions, downloadCsv, fetchAllPages, today, useCrossPageSelection } from "@/components/ListTools";
import { METHOD_LABEL, fmtDate, rupees } from "./saasShared";

const isoDate = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

const PAID_CSV: CsvColumn<any>[] = [
    { label: "Date", value: (p) => isoDate(p.paid_at) },
    { label: "Agency", value: (p) => p.agency },
    { label: "Amount (INR)", value: (p) => p.amount },
    { label: "Coupon", value: (p) => p.coupon_code || "" },
    { label: "Discount (INR)", value: (p) => p.discount || 0 },
    { label: "Plan", value: (p) => p.plan || "" },
    { label: "Months", value: (p) => p.months || "" },
    { label: "Method", value: (p) => METHOD_LABEL[p.method] || p.method },
    { label: "Reference", value: (p) => p.reference || "" },
    { label: "Invoice", value: (p) => p.invoice_number || "" },
];
const FAILED_CSV: CsvColumn<any>[] = [
    { label: "Failed on", value: (p) => isoDate(p.failed_at) },
    { label: "Agency", value: (p) => p.agency },
    { label: "Amount (INR)", value: (p) => p.amount },
    { label: "Plan", value: (p) => p.plan || "" },
    { label: "Months", value: (p) => p.months || "" },
    { label: "Reason", value: (p) => p.failure_reason || "" },
    { label: "Reminders", value: (p) => p.followup_count || 0 },
    { label: "Last reminder", value: (p) => isoDate(p.last_followup_at) },
    { label: "Status", value: (p) => (p.resolved ? "Closed" : "Following up") },
];

const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); SuccessToast(`${what} copied`); } catch { ErrorToast("Couldn't copy"); }
};

const SaasPayments = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [tab, setTab] = useState<"paid" | "failed">("paid");
    const [openOnly, setOpenOnly] = useState(true);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [method, setMethod] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const hasLoadedOnce = useRef(false);
    const rows: any[] = data?.payments || [];
    const sel = useCrossPageSelection(rows, (p: any) => p.id);

    // debounce the search box
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const filterQuery = useMemo(() => {
        const q = new URLSearchParams();
        if (tab === "failed") { q.set("status", "failed"); if (openOnly) q.set("open", "1"); }
        if (search) q.set("search", search);
        if (method && tab === "paid") q.set("method", method);
        if (from) q.set("from", from);
        if (to) q.set("to", to);
        return q.toString();
    }, [tab, openOnly, search, method, from, to]);
    const filtersOn = Boolean(search || method || from || to);

    const load = useCallback(async () => {
        if (!hasLoadedOnce.current) setLoading(true);
        const { success, data } = await commonGetAPICalls(`/saas_admin/payments?page=${page}${filterQuery ? `&${filterQuery}` : ""}`);
        if (success) { setData(data); hasLoadedOnce.current = true; }
        setLoading(false);
    }, [page, filterQuery]);
    useEffect(() => { load(); }, [load]);

    const switchTab = (k: "paid" | "failed") => { setTab(k); setPage(1); sel.clear(); };
    const clearFilters = () => { setSearchInput(""); setSearch(""); setMethod(""); setFrom(""); setTo(""); setPage(1); };
    const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

    const act = async (ids: string[], action: "remind" | "resolve") => {
        setBusy(`${ids.length === 1 ? ids[0] : "bulk"}:${action}`);
        const { success } = ids.length === 1
            ? await commonPostAPICall({}, `/saas_admin/payments/${ids[0]}/${action}`, true)
            : await commonPostAPICall({ action, ids }, "/saas_admin/payments/bulk", true);
        setBusy(null);
        if (success) { if (ids.length > 1) sel.clear(); load(); }
    };

    const exportAll = async () => {
        setBusy("export");
        const all = await fetchAllPages(commonGetAPICalls, `/saas_admin/payments${filterQuery ? `?${filterQuery}` : ""}`, (d) => d.payments || []);
        setBusy(null);
        if (!all.length) return ErrorToast("Nothing to export");
        downloadCsv(`payments-${tab === "failed" ? "failed-" : ""}${today()}`, tab === "failed" ? FAILED_CSV : PAID_CSV, all);
    };

    const paidActions = (p: any): RowAction[] => [
        { key: "invoice", label: "Open invoice", icon: <FileText size={16} />, onPress: () => navigate(`/saas/invoices/${p.id}`), hidden: !(p.amount > 0) },
        { key: "agency", label: "Open agency", icon: <Building2 size={16} />, onPress: () => navigate(`/saas/agencies/${p.agency_id}`) },
        { key: "copy_ref", label: "Copy reference", icon: <Copy size={16} />, onPress: () => copy(p.reference, "Reference"), hidden: !p.reference },
        { key: "copy_inv", label: "Copy invoice number", icon: <Copy size={16} />, onPress: () => copy(p.invoice_number, "Invoice number"), hidden: !p.invoice_number },
    ];
    const failedActions = (p: any): RowAction[] => [
        { key: "remind", label: "Send reminder now", icon: <BellRing size={16} />, onPress: () => act([p.id], "remind") },
        { key: "resolve", label: "Mark as handled", icon: <CheckCheck size={16} />, onPress: () => act([p.id], "resolve"), hidden: p.resolved },
        { key: "agency", label: "Open agency", icon: <Building2 size={16} />, onPress: () => navigate(`/saas/agencies/${p.agency_id}`) },
    ];

    const count = sel.ids.length;
    const total = data?.pagination?.totalItems || 0;
    const pageAllSelected = rows.length > 0 && rows.every((r) => sel.selected.has(r.id));
    const selectAllMatching = async () => {
        setBusy("select_all");
        sel.addAll(await fetchAllPages(commonGetAPICalls, `/saas_admin/payments${filterQuery ? `?${filterQuery}` : ""}`, (d) => d.payments || []));
        setBusy(null);
    };
    const selectedTotal = sel.selectedRows.reduce((s, p: any) => s + Number(p.amount || 0), 0);

    const showSpinner = loading && !hasLoadedOnce.current;

    return (
        <div className="flex flex-col gap-4 max-w-full">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Payments</h1>
                    <p className="text-sm text-default-500">Online (Razorpay) and payments you recorded. Click a payment to open its GST invoice.</p>
                </div>
                <Button variant="flat" startContent={<Download size={16} />} isLoading={busy === "export"} onPress={exportAll}>Export</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
                <div className="rounded-xl border border-default-200 bg-content1 p-3">
                    <div className="text-xs text-default-500">Received this month</div>
                    <div className="text-xl font-semibold">{rupees(data?.this_month)}</div>
                </div>
                <button type="button" onClick={() => { switchTab("failed"); setOpenOnly(true); }} className="text-left rounded-xl border border-default-200 bg-content1 p-3 hover:border-default-400 transition-colors">
                    <div className="text-xs text-default-500">Failed payments to follow up</div>
                    <div className={`text-xl font-semibold ${data?.open_failures ? "text-danger" : ""}`}>{data?.open_failures ?? "-"}</div>
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Tabs aria-label="Payments" size="sm" selectedKey={tab} onSelectionChange={(k) => switchTab(k as any)}>
                    <Tab key="paid" title="Received" />
                    <Tab key="failed" title={`Failed${data?.open_failures ? ` (${data.open_failures})` : ""}`} />
                </Tabs>
                {tab === "failed" && (
                    <div className="flex items-center gap-2 text-sm">
                        <Switch size="sm" aria-label="Open only" isSelected={openOnly} onValueChange={resetPage(setOpenOnly)} />Only not followed up yet
                    </div>
                )}
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 items-center ${tab === "paid" ? "xl:grid-cols-[2fr_1fr_1fr_1fr_auto]" : "xl:grid-cols-[2fr_1fr_1fr_auto]"}`}>
                <Input aria-label="Search" size="sm" placeholder={tab === "paid" ? "Search agency, phone, reference, invoice no..." : "Search agency, phone..."} startContent={<Search size={16} />} value={searchInput} onValueChange={setSearchInput} isClearable onClear={() => setSearchInput("")} />
                {tab === "paid" && (
                    <Select aria-label="Method" size="sm" placeholder="All methods" selectedKeys={method ? [method] : []} onChange={(e) => resetPage(setMethod)(e.target.value)}>
                        {Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k}>{v}</SelectItem>)}
                    </Select>
                )}
                <Input aria-label="From date" size="sm" type="date" label="From" labelPlacement="outside-left" value={from} max={to || undefined} onValueChange={resetPage(setFrom)} />
                <Input aria-label="To date" size="sm" type="date" label="To" labelPlacement="outside-left" value={to} min={from || undefined} onValueChange={resetPage(setTo)} />
                {filtersOn ? <Button size="sm" variant="light" onPress={clearFilters}>Clear filters</Button> : <span className="hidden xl:block" />}
            </div>

            <BulkBar
                count={count}
                onClear={sel.clear}
                extra={<>
                    {tab === "paid" && <span className="text-sm text-default-600">· {rupees(selectedTotal)}</span>}
                    {pageAllSelected && total > count && (
                        <Button size="sm" variant="light" color="primary" isLoading={busy === "select_all"} onPress={selectAllMatching}>Select all {total} matching</Button>
                    )}
                </>}
            >
                {tab === "failed" && <>
                    <Button size="sm" variant="flat" startContent={<BellRing size={14} />} isLoading={busy === "bulk:remind"} onPress={() => window.confirm(`Send a reminder to ${count} agency owner(s) now?`) && act(sel.ids, "remind")}>Send reminders</Button>
                    <Button size="sm" variant="flat" startContent={<CheckCheck size={14} />} isLoading={busy === "bulk:resolve"} onPress={() => act(sel.ids, "resolve")}>Mark handled</Button>
                </>}
                <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => downloadCsv(`payments-selected-${today()}`, tab === "failed" ? FAILED_CSV : PAID_CSV, sel.selectedRows)}>Export</Button>
            </BulkBar>

            {tab === "paid" ? (
                <div className="rounded-xl border border-default-200 bg-content1 overflow-x-auto">
                    <Table aria-label="Payments" removeWrapper selectionMode="multiple" selectedKeys={sel.selectedKeys} onSelectionChange={sel.onSelectionChange}
                        onRowAction={(key) => {
                            const p = rows.find((x: any) => x.id === key);
                            if (p) navigate(p.amount > 0 ? `/saas/invoices/${p.id}` : `/saas/agencies/${p.agency_id}`);
                        }} className="min-w-[960px]">
                        <TableHeader>
                            <TableColumn>DATE</TableColumn><TableColumn>AGENCY</TableColumn><TableColumn>AMOUNT</TableColumn>
                            <TableColumn>PLAN</TableColumn><TableColumn>METHOD</TableColumn><TableColumn>REFERENCE</TableColumn><TableColumn>INVOICE</TableColumn>
                            <TableColumn align="end" className="sticky right-0 z-10 bg-default-100">ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody items={rows} isLoading={showSpinner} loadingContent={<Spinner />} emptyContent={showSpinner ? " " : filtersOn ? "No payments match these filters" : "No payments yet"}>
                            {(p: any) => (
                                <TableRow key={p.id} className="cursor-pointer">
                                    <TableCell>{fmtDate(p.paid_at)}</TableCell>
                                    <TableCell className="font-medium">{p.agency}</TableCell>
                                    <TableCell>{rupees(p.amount)}{p.coupon_code ? <div className="text-xs text-default-500">{p.coupon_code} · -{rupees(p.discount)}</div> : null}</TableCell>
                                    <TableCell>{p.plan || "-"}{p.months ? ` · ${p.months} mo` : ""}</TableCell>
                                    <TableCell>{METHOD_LABEL[p.method] || p.method}</TableCell>
                                    <TableCell className="text-sm text-default-600">{p.reference || "-"}</TableCell>
                                    <TableCell className="text-sm">{p.amount > 0 ? <span className="text-primary font-medium">{p.invoice_number || "View"}</span> : "-"}</TableCell>
                                    <TableCell className="sticky right-0 bg-content1"><div className="flex justify-end"><RowActions actions={paidActions(p)} label={`Actions for payment from ${p.agency}`} /></div></TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table aria-label="Failed payments" removeWrapper selectionMode="multiple" selectedKeys={sel.selectedKeys} onSelectionChange={sel.onSelectionChange} className="min-w-[960px]">
                            <TableHeader>
                                <TableColumn>FAILED ON</TableColumn><TableColumn>AGENCY</TableColumn><TableColumn>AMOUNT</TableColumn><TableColumn>REASON</TableColumn>
                                <TableColumn>REMINDERS</TableColumn><TableColumn>STATUS</TableColumn>
                                <TableColumn align="end" className="sticky right-0 z-10 bg-default-100">ACTIONS</TableColumn>
                            </TableHeader>
                            <TableBody items={rows} isLoading={showSpinner} loadingContent={<Spinner />} emptyContent={showSpinner ? " " : filtersOn ? "No failed payments match these filters" : "No failed payments"}>
                                {(p: any) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{fmtDate(p.failed_at)}</TableCell>
                                        <TableCell><button type="button" className="font-medium text-left hover:underline" onClick={() => navigate(`/saas/agencies/${p.agency_id}`)}>{p.agency}</button></TableCell>
                                        <TableCell>{rupees(p.amount)}<div className="text-xs text-default-500">{p.plan}{p.months ? ` · ${p.months} mo` : ""}</div></TableCell>
                                        <TableCell className="text-sm max-w-[240px]">{p.failure_reason || <span className="text-default-400">Not given</span>}</TableCell>
                                        <TableCell className="text-sm">{p.followup_count || 0}{p.last_followup_at ? <div className="text-xs text-default-500">last {fmtDate(p.last_followup_at)}</div> : null}</TableCell>
                                        <TableCell><Chip size="sm" variant="flat" color={p.resolved ? "default" : "warning"}>{p.resolved ? "Closed" : "Following up"}</Chip></TableCell>
                                        <TableCell className="sticky right-0 bg-content1">
                                            <div className="flex justify-end items-center gap-1">
                                                {!p.resolved && <Button size="sm" variant="flat" startContent={<BellRing size={14} />} isLoading={busy === `${p.id}:remind`} onPress={() => act([p.id], "remind")}>Remind</Button>}
                                                <RowActions actions={failedActions(p)} label={`Actions for failed payment from ${p.agency}`} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="px-3 py-2 text-xs text-default-500 border-t border-default-100">Owners are told right away, then reminded after 1 and 3 days. Reminders stop when they pay or you mark it handled.</div>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-default-500">{total ? `${total} payment${total === 1 ? "" : "s"}` : ""}</span>
                {data?.pagination?.totalPages > 1 && <Pagination total={data.pagination.totalPages} page={page} onChange={setPage} showControls />}
            </div>
        </div>
    );
};

export default SaasPayments;
