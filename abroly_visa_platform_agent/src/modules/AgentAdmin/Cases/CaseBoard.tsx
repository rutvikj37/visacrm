import FirstTip from "@/components/help/FirstTip";
import { BoardSkeleton, ListSkeleton } from "@/components/ui-kit/Skeletons";
import EmptyState from "@/components/ui-kit/EmptyState";
import { BranchPicker, branchName, useBranches } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, Checkbox, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Input, Modal, ModalBody, ModalContent,
    ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, Tab, Textarea, useDisclosure,
} from "@heroui/react";
import type { Selection } from "@heroui/react";
import { AlertCircle, CalendarClock, FileCheck2, GripVertical, KanbanSquare, List, MessageCircle, MoreVertical, Search, User, UserPlus, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { sourceLabel } from "@/modules/AgentAdmin/Crm/crmShared";
import { CASE_STAGES, OUTCOMES, fmtShortDate, stageLabel } from "./caseShared";

/** Visa cases: list by default, board (kanban) optional via ?view=board.
 * Reports drill-down: ?converted=1&from=&to=&source=&branch= shows cases from converted leads in that period. */
const CaseBoard = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const view = params.get("view") === "board" ? "board" : "list";
    const convertedFilter = params.get("converted") === "1" || params.get("converted") === "true";
    const convertedFrom = params.get("from") || "";
    const convertedTo = params.get("to") || "";
    const convertedSource = params.get("source") || "";
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const isManager = isOwner || teamRole === "branch_manager";
    const PAGE_SIZE = 25;
    const page = Math.max(1, Number(params.get("page") || 1) || 1);
    const [cases, setCases] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [assignee, setAssignee] = useState("");
    const [country, setCountry] = useState("");
    // ?stage=approved|rejected|withdrawn|<stage> (old Approved / Rejected / Withdrawn lists link here)
    const [stageFilter, setStageFilter] = useState(() => params.get("stage") || "");
    const [branch, setBranch] = useState(() => new URLSearchParams(window.location.search).get("branch") || "");
    const [focusCol, setFocusCol] = useState<string>("documents");
    // bulk actions (list view)
    const [selected, setSelected] = useState<Selection>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkText, setBulkText] = useState("");
    const messageModal = useDisclosure();
    const branches = useBranches();
    const [dragId, setDragId] = useState<number | null>(null);
    const [overCol, setOverCol] = useState<string | null>(null);

    const setPage = (p: number) => {
        const n = new URLSearchParams(params);
        if (p <= 1) n.delete("page");
        else n.set("page", String(p));
        setParams(n, { replace: true });
    };

    const setView = (next: "list" | "board") => {
        const n = new URLSearchParams(params);
        if (next === "board") n.set("view", "board");
        else n.delete("view");
        n.delete("page");
        setParams(n, { replace: true });
    };

    const clearConvertedFilter = () => {
        const n = new URLSearchParams(params);
        ["converted", "from", "to", "source"].forEach((k) => n.delete(k));
        setParams(n, { replace: true });
    };

    const load = useCallback(async () => {
        const q = new URLSearchParams();
        if (search.trim()) q.set("search", search.trim());
        if (assignee) q.set("assigned_to", assignee);
        if (branch) q.set("branch", branch);
        if (country) q.set("country", country);
        // a result filter loads every case with that result, not only the last 60 days
        const result = OUTCOMES.some((o) => o.key === stageFilter) || stageFilter === "not_started" ? stageFilter : "";
        if (result) q.set("result", result);
        else if (stageFilter && CASE_STAGES.some((s) => s.key === stageFilter)) q.set("stage", stageFilter);
        if (convertedFilter) {
            q.set("converted", "1");
            if (convertedFrom) q.set("from", convertedFrom);
            if (convertedTo) q.set("to", convertedTo);
            if (convertedSource) q.set("source", convertedSource);
        }
        if (view === "list") {
            q.set("page", String(page));
            q.set("limit", String(PAGE_SIZE));
        }
        const { success, data } = await commonGetAPICalls(`/crm/cases?${q.toString()}`);
        if (success) {
            setCases(data?.cases || []);
            setPagination(data?.pagination || { totalPages: 1, totalItems: data?.cases?.length || 0 });
        }
        setLoading(false);
    }, [search, assignee, branch, country, stageFilter, convertedFilter, convertedFrom, convertedTo, convertedSource, view, page]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);
    useEffect(() => {
        if (!isManager) return;
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/team");
            if (success) setTeam(data || []);
        })();
    }, [isManager]);
    useEffect(() => {
        if (page !== 1) setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, assignee, branch, country, stageFilter, convertedFilter, view]);

    const countries = useMemo(() => [...new Set(cases.map((c) => c.country).filter(Boolean))].sort(), [cases]);
    // server already applies country/stage/result when paginating list; keep a light pass for board
    const visible = view === "list" ? cases : cases.filter((c) => {
        if (country && c.country !== country) return false;
        if (stageFilter) {
            if (stageFilter === "not_started") return Boolean(c.not_started);
            if (OUTCOMES.some((o) => o.key === stageFilter)) return c.outcome === stageFilter;
            return !c.outcome && c.stage === stageFilter;
        }
        return true;
    });

    const moveStage = async (c: any, stage: string) => {
        if (c.stage === stage) return;
        setCases((list) => list.map((x) => (x.id === c.id ? { ...x, stage, status: "visa_progress", outcome: null } : x)));
        const { success } = await commonPostAPICall({ stage }, `crm/cases/${c.id}/stage`);
        if (!success) load();
    };
    const setOutcome = async (c: any, outcome: string) => {
        const { success } = await commonPostAPICall({ outcome }, `crm/cases/${c.id}/outcome`, true);
        if (success) load();
    };

    const selectedIds: number[] = selected === "all" ? visible.map((c) => c.id) : Array.from(selected).map((k) => Number(k)).filter((id) => visible.some((c) => c.id === id));
    const toggleOne = (id: number, on: boolean) => {
        const next = new Set(selected === "all" ? visible.map((c) => String(c.id)) : Array.from(selected).map(String));
        if (on) next.add(String(id)); else next.delete(String(id));
        setSelected(next);
    };
    const runBulk = async (action: string, extra: object) => {
        if (!selectedIds.length) return false;
        setBulkBusy(true);
        const { success } = await commonPostAPICall({ ids: selectedIds, action, ...extra }, "crm/cases/bulk", true);
        setBulkBusy(false);
        if (success) { if (action !== "message") load(); setSelected(new Set()); }
        return success;
    };

    const onDrop = async (col: string) => {
        const c = cases.find((x) => x.id === dragId);
        setDragId(null);
        setOverCol(null);
        if (!c) return;
        if (CASE_STAGES.some((s) => s.key === col)) {
            if (c.outcome) {
                await commonPostAPICall({ outcome: "reopen" }, `crm/cases/${c.id}/outcome`);
            }
            await moveStage({ ...c, stage: c.outcome ? null : c.stage }, col);
            if (c.outcome) load();
        } else if (c.outcome !== col) {
            await setOutcome(c, col);
        }
    };

    const columns: { key: string; label: string; items: any[]; outcome?: (typeof OUTCOMES)[number] }[] = [
        ...CASE_STAGES.map((s) => ({ key: s.key, label: s.label, items: visible.filter((c) => !c.outcome && c.stage === s.key) })),
        ...OUTCOMES.map((o) => ({ key: o.key, label: o.label, items: visible.filter((c) => c.outcome === o.key), outcome: o })),
    ];

    const caseStatusChip = (c: any) => {
        if (c.outcome === "approved") return <Chip size="sm" variant="flat" color="success">Approved</Chip>;
        if (c.outcome === "rejected") return <Chip size="sm" variant="flat" color="danger">Rejected</Chip>;
        if (c.outcome === "withdrawn") return <Chip size="sm" variant="flat">Withdrawn</Chip>;
        if (c.not_started) return <Chip size="sm" variant="flat" color="warning">Not started</Chip>;
        return <Chip size="sm" variant="flat" color="primary">{stageLabel(c.stage || "documents")}</Chip>;
    };

    const ActionsMenu = ({ c }: { c: any }) => (
        <Dropdown>
            <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light" aria-label="Case actions" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical size={16} />
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Case actions" onAction={(key) => {
                const k = String(key);
                if (k === "open") {
                    navigate(`/leads/progress/${c.id}`);
                    return;
                }
                if (k.startsWith("stage:")) {
                    const stage = k.slice(6);
                    if (c.outcome) commonPostAPICall({ outcome: "reopen" }, `crm/cases/${c.id}/outcome`).then(() => moveStage({ ...c, stage: null }, stage).then(load));
                    else moveStage(c, stage);
                } else if (k.startsWith("outcome:")) setOutcome(c, k.slice(8));
            }}>
                <DropdownItem key="open">Open case</DropdownItem>
                <DropdownSection title="Move to stage" showDivider>
                    {CASE_STAGES.map((s) => <DropdownItem key={`stage:${s.key}`} isDisabled={!c.outcome && c.stage === s.key}>{s.label}</DropdownItem>)}
                </DropdownSection>
                <DropdownSection title="Result">
                    {OUTCOMES.map((o) => <DropdownItem key={`outcome:${o.key}`} isDisabled={c.outcome === o.key}>{o.label}</DropdownItem>)}
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
    );

    const CaseCard = ({ c }: { c: any }) => {
        const pct = c.steps_total ? Math.round((c.steps_done / c.steps_total) * 100) : 0;
        return (
            <Card
                shadow="sm"
                className={`w-full ${dragId === c.id ? "opacity-50" : ""}`}
            >
                <CardBody className="p-3 gap-2">
                    <div className="flex items-start gap-1">
                        <button
                            type="button"
                            draggable
                            aria-label="Drag to move case"
                            title="Drag to another stage"
                            className="hidden sm:inline-flex mt-0.5 p-1 rounded-md text-default-400 hover:text-default-600 hover:bg-default-100 cursor-grab active:cursor-grabbing shrink-0"
                            onDragStart={(e) => {
                                e.stopPropagation();
                                setDragId(c.id);
                                e.dataTransfer?.setData("text/plain", String(c.id));
                                e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => { setDragId(null); setOverCol(null); }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GripVertical size={16} />
                        </button>
                        <button
                            type="button"
                            className="flex-1 min-w-0 text-left rounded-md hover:bg-default-50 -m-1 p-1"
                            onClick={() => navigate(`/leads/progress/${c.id}`)}
                        >
                            <div className="font-medium text-sm truncate">{c.student?.name || "Student"}</div>
                            <div className="text-xs text-default-500 truncate">{[c.country, c.university].filter(Boolean).join(" · ") || "-"}</div>
                            {(c.course || c.intake) && <div className="text-xs text-default-400 truncate">{[c.course, c.intake].filter(Boolean).join(" · ")}</div>}
                        </button>
                        <ActionsMenu c={c} />
                    </div>
                    {c.steps_total > 0 && (
                        <div>
                            <div className="flex justify-between text-[11px] text-default-500 mb-1"><span>Steps</span><span>{c.steps_done}/{c.steps_total}</span></div>
                            <div className="h-1.5 rounded-full bg-default-100"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                        {c.to_review > 0 && <Chip size="sm" variant="flat" color="warning" startContent={<FileCheck2 size={12} />}>{c.to_review} to review</Chip>}
                        {c.overdue_steps > 0 ? (
                            <Chip size="sm" variant="flat" color="danger" startContent={<AlertCircle size={12} />}>{c.overdue_steps} overdue</Chip>
                        ) : c.next_due && !c.outcome ? (
                            <Chip size="sm" variant="flat" startContent={<CalendarClock size={12} />}>Due {fmtShortDate(c.next_due)}</Chip>
                        ) : null}
                    </div>
                    <div className="text-[11px] text-default-500 flex items-center gap-1"><User size={11} />{c.assignee?.name || "Unassigned"}{branches.length > 0 && c.branch_id ? ` · ${branchName(branches, c.branch_id)}` : ""}</div>
                </CardBody>
            </Card>
        );
    };

    const filters = (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 max-w-5xl">
            <BranchPicker value={branch} onChange={setBranch} className="w-full" size="md" />
            <Input aria-label="Search" placeholder="Search student name or phone" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            <Select
                aria-label="Country"
                placeholder="All countries"
                selectedKeys={country ? [country] : []}
                onSelectionChange={(keys) => {
                    const v = Array.from(keys)[0];
                    setCountry(v ? String(v) : "");
                }}
            >
                {countries.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
            </Select>
            {view === "list" && (
                <Select
                    aria-label="Stage"
                    placeholder="All stages"
                    selectedKeys={stageFilter ? [stageFilter] : []}
                    onSelectionChange={(keys) => {
                        const v = Array.from(keys)[0];
                        setStageFilter(v ? String(v) : "");
                    }}
                >
                    {[
                        <SelectItem key="not_started">Not started</SelectItem>,
                        ...CASE_STAGES.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>),
                        ...OUTCOMES.map((o) => <SelectItem key={o.key}>{o.label}</SelectItem>),
                    ]}
                </Select>
            )}
            {isManager && (
                <Select
                    aria-label="Handled by"
                    placeholder="Anyone"
                    selectedKeys={assignee ? [assignee] : []}
                    onSelectionChange={(keys) => {
                        const v = Array.from(keys)[0];
                        setAssignee(v ? String(v) : "");
                    }}
                >
                    {[<SelectItem key="unassigned">Unassigned</SelectItem>, ...team.map((m) => <SelectItem key={String(m.id)}>{m.username}</SelectItem>)]}
                </Select>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <FirstTip id="cases" title="Visa cases">Open a case to work the steps. Use List for a simple overview, or Board to drag cases across stages.</FirstTip>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Visa cases</h1>
                    <p className="text-sm text-default-500">
                        {view === "list"
                            ? "Your file sheet in CRM — client, country, DS-160, appointment, payment and staff"
                            : "Cases by stage — drag or use ⋮ to move"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-sm text-default-500">{visible.filter((c) => c.status === "visa_progress").length} in progress</span>
                    <Tabs size="sm" selectedKey={view} onSelectionChange={(k) => setView(k === "board" ? "board" : "list")} aria-label="View">
                        <Tab key="list" title={<span className="flex items-center gap-1"><List size={14} />List</span>} />
                        <Tab key="board" title={<span className="flex items-center gap-1"><KanbanSquare size={14} />Board</span>} />
                    </Tabs>
                </div>
            </div>

            {convertedFilter && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg bg-success-50 text-success-800 px-3 py-2">
                    <span>
                        Showing converted cases
                        {convertedFrom && convertedTo ? ` from leads created ${convertedFrom} → ${convertedTo}` : ""}
                        {convertedSource ? ` · ${sourceLabel(convertedSource)}` : ""}
                        {branch ? ` · ${branchName(branches, Number(branch)) || "branch"}` : ""}
                    </span>
                    <Button size="sm" variant="light" startContent={<X size={14} />} onPress={clearConvertedFilter}>Clear</Button>
                </div>
            )}

            {filters}

            {view === "list" && selectedIds.length > 0 && (
                <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 shadow-sm">
                    <span className="text-sm font-medium text-primary-700">{selectedIds.length} selected</span>
                    {isManager && (
                        <Dropdown>
                            <DropdownTrigger><Button size="sm" variant="flat" startContent={<UserPlus size={14} />} isDisabled={bulkBusy}>Assign</Button></DropdownTrigger>
                            <DropdownMenu aria-label="Assign to" className="max-h-80 overflow-y-auto" onAction={(k) => runBulk("assign", { value: k === "none" ? null : Number(k) })}>
                                {[<DropdownItem key="none">Unassigned</DropdownItem>, ...team.map((m) => <DropdownItem key={String(m.id)}>{m.username}</DropdownItem>)]}
                            </DropdownMenu>
                        </Dropdown>
                    )}
                    <Dropdown>
                        <DropdownTrigger><Button size="sm" variant="flat" startContent={<KanbanSquare size={14} />} isDisabled={bulkBusy}>Move stage</Button></DropdownTrigger>
                        <DropdownMenu aria-label="Move to stage" onAction={(k) => runBulk("stage", { value: String(k) })}>
                            {CASE_STAGES.map((st) => <DropdownItem key={st.key}>{st.label}</DropdownItem>)}
                        </DropdownMenu>
                    </Dropdown>
                    <Button size="sm" variant="flat" startContent={<MessageCircle size={14} />} isDisabled={bulkBusy} onPress={() => { setBulkText(""); messageModal.onOpen(); }}>Message</Button>
                    <Button size="sm" variant="light" className="ml-auto" onPress={() => setSelected(new Set())}>Clear</Button>
                </div>
            )}

            {loading ? (view === "list" ? <Card shadow="sm"><CardBody className="p-3"><ListSkeleton rows={6} /></CardBody></Card> : <BoardSkeleton />) : !cases.length ? (
                stageFilter && !convertedFilter ? (
                <EmptyState
                    compact
                    icon={KanbanSquare}
                    title="No cases here"
                    text={stageFilter === "not_started" ? "No accepted cases are waiting to start." : "No cases match this filter."}
                    actions={<Button size="sm" variant="flat" onPress={() => setStageFilter("")}>Show all cases</Button>}
                />
                ) : (
                <EmptyState
                    icon={KanbanSquare}
                    title={convertedFilter ? "No converted cases match" : "No visa cases yet"}
                    text={convertedFilter
                        ? "No visa cases from converted leads in this report filter. Clear the filter or pick another period in Reports."
                        : "When you convert a lead to a visa case, it appears here and moves across the stages."}
                    actions={convertedFilter
                        ? <Button size="sm" color="primary" onPress={clearConvertedFilter}>Clear converted filter</Button>
                        : <Button size="sm" color="primary" onPress={() => navigate("/crm/leads?status=interested")}>Open interested leads</Button>}
                />
                )
            ) : view === "list" ? (
                <>
                    {/* Mobile cards */}
                    <div className="md:hidden flex flex-col gap-2">
                        {!visible.length ? (
                            <div className="text-sm text-default-500 text-center py-10">No cases match these filters.</div>
                        ) : visible.map((c) => {
                            const pct = c.steps_total ? Math.round((c.steps_done / c.steps_total) * 100) : 0;
                            return (
                                <Card key={c.id} shadow="sm" isPressable onPress={() => navigate(`/leads/progress/${c.id}`)}>
                                    <CardBody className="p-3 gap-2">
                                        <div className="flex items-start gap-2">
                                            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                                <Checkbox aria-label={`Select ${c.student?.name || "case"}`} size="sm" isSelected={selectedIds.includes(c.id)} onValueChange={(on) => toggleOne(c.id, on)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{c.student?.name || "Student"}</div>
                                                <div className="text-xs text-default-500 truncate">{[c.country, c.university, c.course].filter(Boolean).join(" · ") || "-"}</div>
                                            </div>
                                            {caseStatusChip(c)}
                                            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                                <ActionsMenu c={c} />
                                            </div>
                                        </div>
                                        {c.steps_total > 0 && (
                                            <div className="text-xs text-default-500">Steps {c.steps_done}/{c.steps_total} ({pct}%)</div>
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                            {c.file_tracker?.ds160_status && <Chip size="sm" variant="flat">DS-160: {c.file_tracker.ds160_status}</Chip>}
                                            {c.file_tracker?.appointment_status && <Chip size="sm" variant="flat">{c.file_tracker.appointment_status}</Chip>}
                                            {c.file_tracker?.payment_status && <Chip size="sm" variant="flat">{c.file_tracker.payment_status}</Chip>}
                                        </div>
                                        <div className="text-[11px] text-default-500 flex flex-wrap gap-x-3 gap-y-1">
                                            <span className="inline-flex items-center gap-1"><User size={11} />{c.assignee?.name || "Unassigned"}</span>
                                            {c.overdue_steps > 0 ? (
                                                <span className="text-danger inline-flex items-center gap-1"><AlertCircle size={11} />{c.overdue_steps} overdue</span>
                                            ) : c.next_due && !c.outcome ? (
                                                <span className="inline-flex items-center gap-1"><CalendarClock size={11} />Due {fmtShortDate(c.next_due)}</span>
                                            ) : null}
                                        </div>
                                    </CardBody>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Desktop table */}
                    <Card shadow="sm" className="max-md:hidden">
                        <CardBody className="p-0 overflow-x-auto">
                            <Table aria-label="Visa cases" removeWrapper selectionMode="multiple" selectionBehavior="toggle" selectedKeys={selected} onSelectionChange={setSelected}
                                onRowAction={(key) => navigate(`/leads/progress/${key}`)} className="min-w-[860px]">
                                <TableHeader>
                                    <TableColumn>FILE / CLIENT</TableColumn>
                                    <TableColumn>COUNTRY / VISA</TableColumn>
                                    <TableColumn>DS-160</TableColumn>
                                    <TableColumn>DOCS</TableColumn>
                                    <TableColumn>APPOINTMENT</TableColumn>
                                    <TableColumn>PAYMENT</TableColumn>
                                    <TableColumn>STAGE</TableColumn>
                                    <TableColumn>STAFF</TableColumn>
                                    <TableColumn align="end">ACTIONS</TableColumn>
                                </TableHeader>
                                <TableBody emptyContent="No cases match these filters." items={visible}>
                                    {(c: any) => {
                                        const ft = c.file_tracker || {};
                                        return (
                                            <TableRow key={String(c.id)} className="cursor-pointer">
                                                <TableCell>
                                                    <div className="font-medium">{c.student?.name || "Student"}</div>
                                                    <div className="text-xs text-default-500">#{c.id}{c.student?.phone ? ` · ${c.student.phone}` : ""}</div>
                                                    {c.to_review > 0 && <Chip size="sm" variant="flat" color="warning" className="mt-1">{c.to_review} to review</Chip>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{c.country || "-"}</div>
                                                    <div className="text-xs text-default-500 truncate max-w-[180px]">{[c.university, c.course, c.intake].filter(Boolean).join(" · ") || "—"}</div>
                                                </TableCell>
                                                <TableCell className="text-xs">{ft.ds160_status || <span className="text-default-400">—</span>}</TableCell>
                                                <TableCell className="text-xs">{ft.doc_checklist_status || <span className="text-default-400">—</span>}</TableCell>
                                                <TableCell>
                                                    <div className="text-xs">{ft.appointment_status || <span className="text-default-400">—</span>}</div>
                                                    {(c.biometrics_on || c.interview_on) && (
                                                        <div className="text-[11px] text-default-500">
                                                            {[c.biometrics_on && `OFC ${fmtShortDate(c.biometrics_on)}`, c.interview_on && `IV ${fmtShortDate(c.interview_on)}`].filter(Boolean).join(" · ")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">{ft.payment_status || <span className="text-default-400">—</span>}</TableCell>
                                                <TableCell>{caseStatusChip(c)}</TableCell>
                                                <TableCell className="text-sm">
                                                    {c.assignee?.name || <span className="text-default-400">Unassigned</span>}
                                                    {branches.length > 0 && c.branch_id && <div className="text-xs text-default-500">{branchName(branches, c.branch_id)}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                                        <ActionsMenu c={c} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }}
                                </TableBody>
                            </Table>
                        </CardBody>
                    </Card>
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center">
                            <Pagination total={pagination.totalPages} page={page} onChange={setPage} showControls />
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="sm:hidden flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                        {columns.map((col) => (
                            <button
                                key={col.key}
                                type="button"
                                onClick={() => setFocusCol(col.key)}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                                    focusCol === col.key
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-default-200 bg-content1 text-default-600"
                                }`}
                            >
                                {col.label}
                                <span className="ml-1 opacity-70">{col.items.length}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
                        {columns.map((col) => (
                            <div
                                key={col.key}
                                id={`board-col-${col.key}`}
                                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                                onDrop={(e) => { e.preventDefault(); onDrop(col.key); }}
                                className={`snap-start shrink-0 w-[min(100%,280px)] sm:w-[260px] rounded-xl p-2 flex flex-col gap-2 transition-colors ${
                                    focusCol === col.key ? "ring-2 ring-primary/40 sm:ring-0" : ""
                                } ${overCol === col.key ? "bg-primary-50 ring-2 ring-primary" : "bg-default-100/70"} ${
                                    focusCol !== col.key ? "hidden sm:flex" : "flex"
                                }`}
                            >
                                <div className="flex items-center justify-between px-1 py-1">
                                    <span className="text-sm font-semibold flex items-center gap-2">
                                        {col.outcome ? <Chip size="sm" variant="flat" color={col.outcome.color}>{col.label}</Chip> : col.label}
                                    </span>
                                    <span className="text-xs text-default-500">{col.items.length}</span>
                                </div>
                                {col.items.length === 0 && <div className="text-xs text-default-400 px-1 py-4 text-center">{col.outcome ? "Last 60 days" : "No cases"}</div>}
                                {col.items.map((c: any) => <CaseCard key={c.id} c={c} />)}
                            </div>
                        ))}
                    </div>
                </>
            )}
            <Modal isOpen={messageModal.isOpen} onOpenChange={messageModal.onOpenChange} size="lg">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Message {selectedIds.length} case{selectedIds.length === 1 ? "" : "s"}</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500">Each student gets this in their portal chat (once, even with several selected cases). Use {"{name}"} for the student's first name.</p>
                                <Textarea aria-label="Message" autoFocus minRows={4} maxLength={2000} placeholder="Hi {name}, please upload your updated bank statement by Friday."
                                    value={bulkText} onValueChange={setBulkText} />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={bulkBusy} isDisabled={!bulkText.trim()} onPress={async () => { if (await runBulk("message", { message: bulkText })) onClose(); }}>Send</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default CaseBoard;
