import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { BadgeDollarSign, MoreVertical, Search } from "lucide-react";
import EmptyState from "@/components/ui-kit/EmptyState";
import FirstTip from "@/components/help/FirstTip";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { CommissionFormModal, commissionStatus, fmtDate, money } from "./commissionShared";

const Tile = ({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) => (
    <div className="rounded-xl border border-default-200 bg-content1 p-2.5 sm:p-4 min-w-0">
        <div className="text-[11px] sm:text-xs text-default-500 truncate">{label}</div>
        <div className={`text-base sm:text-xl font-semibold mt-0.5 sm:mt-1 truncate ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`}>{value}</div>
    </div>
);

/** Commission from universities and partners: what is expected, invoiced and received. */
const CommissionsPage = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const status = params.get("status") || "open";
    const [search, setSearch] = useState("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<any>(null);
    const edit = useDisclosure();

    const load = useCallback(async () => {
        setLoading(true);
        const qs = new URLSearchParams();
        if (status === "overdue") qs.set("due", "overdue"); else if (status !== "all") qs.set("status", status);
        if (search.trim()) qs.set("q", search.trim());
        const { success, data, message } = await commonGetAPICalls(`/crm/commissions?${qs.toString()}`);
        setData(success ? data : { error: message, commissions: [], totals: [] });
        setLoading(false);
    }, [status, search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const setStatus = async (c: any, next: string) => {
        const { success } = await commonPostAPICall({ status: next }, `crm/commissions/${c.id}`, true);
        if (success) load();
    };
    const remove = async (c: any) => {
        if (!window.confirm(`Delete the commission from ${c.partner}?`)) return;
        const { success } = await commonPostAPICall({}, `crm/commissions/${c.id}/delete`, true);
        if (success) load();
    };

    const canManage = Boolean(data?.can_manage);
    const list: any[] = data?.commissions || [];

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <FirstTip id="commissions" title="Commissions">Add a commission from a student's case (Universities → Add commission). Mark it invoiced when you bill the university, and received when the money arrives.</FirstTip>
            <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Commissions</h1>
                <p className="text-sm text-default-500">Money due from universities and partners for your students</p>
            </div>

            {data?.error ? (
                <EmptyState icon={BadgeDollarSign} title="Not available" text={data.error} />
            ) : (
                <>
                    {(data?.totals || []).map((t: any) => (
                        <div key={t.currency} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                            <Tile label={`Expected (${t.currency})`} value={money(t.expected, t.currency)} />
                            <Tile label="Outstanding" value={money(t.outstanding, t.currency)} />
                            <Tile label="Overdue" value={money(t.overdue, t.currency)} tone={t.overdue ? "danger" : undefined} />
                            <Tile label="Received" value={money(t.received, t.currency)} tone="success" />
                        </div>
                    ))}

                    <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                        <div className="overflow-x-auto">
                            <Tabs selectedKey={status} onSelectionChange={(k) => { const p = new URLSearchParams(params); p.set("status", String(k)); setParams(p); }} variant="underlined" aria-label="Commission status">
                                <Tab key="open" title="Open" /><Tab key="overdue" title="Overdue" /><Tab key="expected" title="Expected" /><Tab key="invoiced" title="Invoiced" /><Tab key="received" title="Received" /><Tab key="cancelled" title="Cancelled" /><Tab key="all" title="All" />
                            </Tabs>
                        </div>
                        <Input aria-label="Search" className="lg:max-w-xs lg:ml-auto" placeholder="Search university or partner" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
                    </div>

                    {loading && !data ? (
                        <div className="py-16 grid place-items-center"><Spinner /></div>
                    ) : !list.length ? (
                        <EmptyState icon={BadgeDollarSign} title={status === "open" ? "No open commissions" : "Nothing here"}
                            text="Open a visa case, add the universities the student applied to, then use “Add commission” on the one they join." />
                    ) : (
                        <div className="flex flex-col gap-2">
                            {list.map((c) => {
                                const st = commissionStatus(c.status);
                                return (
                                    <div key={c.id} className="rounded-xl border border-default-200 bg-content1 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                        <button type="button" className="text-left min-w-0 flex-1" onClick={() => c.case_id && navigate(`/leads/progress/${c.case_id}`)}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold truncate">{c.partner}</span>
                                                <Chip size="sm" variant="flat" color={st.color}>{st.label}</Chip>
                                                {c.overdue && <Chip size="sm" variant="flat" color="danger">Overdue</Chip>}
                                            </div>
                                            <div className="text-xs text-default-500 truncate">
                                                {[c.student?.name, c.university?.course, c.university?.intake].filter(Boolean).join(" · ") || "No student"}
                                                {c.basis === "percent" && c.percent !== null ? ` · ${c.percent}% of ${money(c.tuition_fee, c.currency)}` : ""}
                                            </div>
                                            <div className="text-xs text-default-400">
                                                {[c.due_on && `Expected by ${fmtDate(c.due_on)}`, c.invoice_ref && `Invoice ${c.invoice_ref}`, c.invoiced_on && `Invoiced ${fmtDate(c.invoiced_on)}`, c.received_on && `Received ${fmtDate(c.received_on)}`].filter(Boolean).join(" · ")}
                                            </div>
                                        </button>
                                        <div className="grid grid-cols-3 gap-3 text-xs sm:w-80 shrink-0">
                                            <div><div className="text-default-500">Expected</div><div className="font-medium">{money(c.amount_expected, c.currency)}</div></div>
                                            <div><div className="text-default-500">Received</div><div className="font-medium">{money(c.amount_received, c.currency)}</div></div>
                                            <div><div className="text-default-500">Balance</div><div className="font-semibold">{money(c.balance, c.currency)}</div></div>
                                        </div>
                                        {canManage && (
                                            <Dropdown>
                                                <DropdownTrigger><Button isIconOnly size="sm" variant="light" aria-label="Actions" className="self-end sm:self-center"><MoreVertical size={16} /></Button></DropdownTrigger>
                                                <DropdownMenu aria-label="Commission actions" onAction={(k) => {
                                                    if (k === "edit") { setEditing(c); edit.onOpen(); }
                                                    else if (k === "delete") remove(c);
                                                    else setStatus(c, String(k));
                                                }}>
                                                    {c.status !== "invoiced" && c.status !== "received" ? <DropdownItem key="invoiced">Mark invoiced</DropdownItem> : null as any}
                                                    {c.status !== "received" ? <DropdownItem key="received">Mark received (in full)</DropdownItem> : null as any}
                                                    <DropdownItem key="edit">Edit / part payment</DropdownItem>
                                                    {c.status !== "cancelled" ? <DropdownItem key="cancelled">Cancel</DropdownItem> : <DropdownItem key="expected">Reopen</DropdownItem>}
                                                    <DropdownItem key="delete" className="text-danger" color="danger">Delete</DropdownItem>
                                                </DropdownMenu>
                                            </Dropdown>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
            <CommissionFormModal isOpen={edit.isOpen} onOpenChange={edit.onOpenChange} commission={editing} onSaved={load} />
        </div>
    );
};

export default CommissionsPage;
