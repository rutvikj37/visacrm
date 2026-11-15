import FirstTip from "@/components/help/FirstTip";
import { BoardSkeleton } from "@/components/ui-kit/Skeletons";
import EmptyState from "@/components/ui-kit/EmptyState";
import { BranchPicker, branchName, useBranches } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Input, Select, SelectItem, Spinner,
} from "@heroui/react";
import { AlertCircle, CalendarClock, FileCheck2, KanbanSquare, MoreVertical, Search, User } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { CASE_STAGES, OUTCOMES, fmtShortDate, isOverdue } from "./caseShared";

/** All visa cases by stage; drag a card (desktop) or use its menu to move it. */
const CaseBoard = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const isManager = isOwner || teamRole === "branch_manager";
    const [cases, setCases] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [assignee, setAssignee] = useState("");
    const [country, setCountry] = useState("");
    // ?branch= from the Branches page
    const [branch, setBranch] = useState(() => new URLSearchParams(window.location.search).get("branch") || "");
    const branches = useBranches();
    const [dragId, setDragId] = useState<number | null>(null);
    const [overCol, setOverCol] = useState<string | null>(null);

    const load = useCallback(async () => {
        const q = new URLSearchParams();
        if (search.trim()) q.set("search", search.trim());
        if (assignee) q.set("assigned_to", assignee);
        if (branch) q.set("branch", branch);
        const { success, data } = await commonGetAPICalls(`/crm/cases?${q.toString()}`);
        if (success) setCases(data?.cases || []);
        setLoading(false);
    }, [search, assignee, branch]);

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

    const countries = useMemo(() => [...new Set(cases.map((c) => c.country).filter(Boolean))].sort(), [cases]);
    const visible = cases.filter((c) => !country || c.country === country);

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
        ...CASE_STAGES.map((s) => ({ key: s.key, label: s.label, items: visible.filter((c) => c.stage === s.key) })),
        ...OUTCOMES.map((o) => ({ key: o.key, label: o.label, items: visible.filter((c) => c.outcome === o.key), outcome: o })),
    ];

    const CaseCard = ({ c }: { c: any }) => {
        const pct = c.steps_total ? Math.round((c.steps_done / c.steps_total) * 100) : 0;
        return (
            <Card
                shadow="sm"
                isPressable
                onPress={() => navigate(`/leads/progress/${c.id}`)}
                draggable
                onDragStart={(e: any) => { setDragId(c.id); e.dataTransfer?.setData("text/plain", String(c.id)); }}
                onDragEnd={() => { setDragId(null); setOverCol(null); }}
                className={`w-full ${dragId === c.id ? "opacity-50" : ""}`}
            >
                <CardBody className="p-3 gap-2">
                    <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{c.student?.name || "Student"}</div>
                            <div className="text-xs text-default-500 truncate">{[c.country, c.university].filter(Boolean).join(" · ") || "-"}</div>
                            {(c.course || c.intake) && <div className="text-xs text-default-400 truncate">{[c.course, c.intake].filter(Boolean).join(" · ")}</div>}
                        </div>
                        <Dropdown>
                            <DropdownTrigger>
                                <Button isIconOnly size="sm" variant="light" aria-label="Move case"><MoreVertical size={16} /></Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Case actions" onAction={(key) => {
                                const k = String(key);
                                if (k.startsWith("stage:")) {
                                    const stage = k.slice(6);
                                    if (c.outcome) commonPostAPICall({ outcome: "reopen" }, `crm/cases/${c.id}/outcome`).then(() => moveStage({ ...c, stage: null }, stage).then(load));
                                    else moveStage(c, stage);
                                } else if (k.startsWith("outcome:")) setOutcome(c, k.slice(8));
                            }}>
                                <DropdownSection title="Move to stage" showDivider>
                                    {CASE_STAGES.map((s) => <DropdownItem key={`stage:${s.key}`} isDisabled={c.stage === s.key}>{s.label}</DropdownItem>)}
                                </DropdownSection>
                                <DropdownSection title="Result">
                                    {OUTCOMES.map((o) => <DropdownItem key={`outcome:${o.key}`} isDisabled={c.outcome === o.key}>{o.label}</DropdownItem>)}
                                </DropdownSection>
                            </DropdownMenu>
                        </Dropdown>
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

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <FirstTip id="cases" title="Case board">Each card is a student's visa case. Drag it to the next stage as you go - the student sees their progress in the portal.</FirstTip>
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Case board</h1>
                    <p className="text-sm text-default-500">Every visa case by stage — drag a card to move it, or use its menu</p>
                </div>
                <div className="text-sm text-default-500 shrink-0">{visible.filter((c) => c.status === "visa_progress").length} in progress</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 max-w-4xl">
                <BranchPicker value={branch} onChange={setBranch} className="w-full" size="md" />
                <Input aria-label="Search" placeholder="Search student name or phone" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
                <Select aria-label="Country" placeholder="All countries" selectedKeys={country ? [country] : []} onChange={(e) => setCountry(e.target.value)}>
                    {countries.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                </Select>
                {isManager && (
                    <Select aria-label="Handled by" placeholder="Anyone" selectedKeys={assignee ? [assignee] : []} onChange={(e) => setAssignee(e.target.value)}>
                        {[<SelectItem key="unassigned">Unassigned</SelectItem>, ...team.map((m) => <SelectItem key={String(m.id)}>{m.username}</SelectItem>)]}
                    </Select>
                )}
            </div>

            {loading ? <BoardSkeleton /> : !cases.length ? (
                <EmptyState icon={KanbanSquare} title="No visa cases yet" text="When you convert a lead to a visa case, it appears here and moves across the stages."
                    actions={<Button size="sm" color="primary" onPress={() => navigate("/crm/leads?status=interested")}>Open interested leads</Button>} />
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
                    {columns.map((col) => (
                        <div
                            key={col.key}
                            onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                            onDrop={(e) => { e.preventDefault(); onDrop(col.key); }}
                            className={`snap-start shrink-0 w-[260px] rounded-xl p-2 flex flex-col gap-2 transition-colors ${overCol === col.key ? "bg-primary-50 ring-2 ring-primary" : "bg-default-100/70"}`}
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
            )}
        </div>
    );
};

export default CaseBoard;
