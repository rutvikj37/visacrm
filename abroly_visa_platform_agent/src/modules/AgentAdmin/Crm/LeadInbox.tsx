import FirstTip from "@/components/help/FirstTip";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton, ListSkeleton } from "@/components/ui-kit/Skeletons";
import { undoToast } from "@/components/ui-kit/undoToast";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Drawer, DrawerBody, DrawerContent } from "@heroui/react";
import LeadDetails from "./LeadDetails";
import LeadCards from "./LeadCards";
import { BranchPicker, branchName, useBranchAccess, useBranches } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, Chip, Input, Pagination, Select, SelectItem, Spinner,
    Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, Tab, useDisclosure, Selection,
} from "@heroui/react";
import { AlarmClock, Bookmark, CalendarClock, ChevronDown, Inbox, KanbanSquare, List, MessageCircle, MoreVertical, Pencil, Phone, Plug, Plus, Search, SlidersHorizontal, Upload, UserPlus, Users, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import CommonConfirmation from "@/components/CommonConfirmation";
import LeadFormModal from "./LeadFormModal";
import ImportLeadsModal from "./ImportLeadsModal";
import ConvertLeadModal from "./ConvertLeadModal";
import LeadBoard from "./LeadBoard";
import {
    LEAD_SOURCES, LEAD_STATUSES, SELECTABLE_STATUSES, STATUS_MENU_STATUSES, followUpState, formatDateTime, formatPhone,
    sourceLabel, statusMeta, temperatureMeta, timeAgo, whatsappLink,
} from "./crmShared";
import {
    SavedView, allViews, applyFiltersToParams, filtersFromParams, loadCustomViews,
    resolveViewFilters, saveCustomViews, viewMatchesParams,
} from "./savedViews";

const PAGE_SIZE = 20;

const StatCard = ({ icon: Icon, label, value, onPress, tone = "default" }: any) => (
    <Card isPressable={!!onPress} onPress={onPress} shadow="sm" className="w-full">
        <CardBody className="flex flex-row items-center gap-3 p-4">
            <div className={`p-2 rounded-lg ${tone === "danger" ? "bg-danger-50 text-danger" : tone === "warning" ? "bg-warning-50 text-warning-600" : "bg-primary-50 text-primary"}`}>
                <Icon size={20} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-default-500 truncate">{label}</div>
                <div className="text-xl font-semibold">{value ?? "-"}</div>
            </div>
        </CardBody>
    </Card>
);

const LeadInbox = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const role = useSelector((state: any) => state.login.role_type);
    const isOwner = role === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const isManager = isOwner || teamRole === "branch_manager";

    const status = params.get("status") || "all";
    const source = params.get("source") || "";
    const assignedTo = params.get("assigned_to") || "";
    const followUp = params.get("follow_up") || "";
    const temperature = params.get("temperature") || "";
    const branch = params.get("branch") || "";
    const created = params.get("created") || "";
    const branches = useBranches();
    const { isOwner: ownerForBranches, myBranch } = useBranchAccess();
    const view = params.get("view") === "board" ? "board" : "list";
    const [boardRefresh, setBoardRefresh] = useState(0);
    const page = Number(params.get("page") || 1);
    const userKey = useSelector((state: any) => state.login.user_name || state.login.email || "anon");
    const [customViews, setCustomViews] = useState<SavedView[]>(() => loadCustomViews(userKey));
    useEffect(() => { setCustomViews(loadCustomViews(userKey)); }, [userKey]);
    const savedViews = useMemo(() => allViews(userKey), [userKey, customViews]);
    const activeViewId = useMemo(
        () => savedViews.find((v) => viewMatchesParams(v.filters, params, myBranch))?.id || null,
        [savedViews, params, myBranch],
    );

    const [search, setSearch] = useState(params.get("search") || "");
    const [leads, setLeads] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>({ totalPages: 0, totalItems: 0 });
    const [summary, setSummary] = useState<any>(null);
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Selection>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkTags, setBulkTags] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    // side panel: the lead opened from the table (larger screens)
    const [panelUuid, setPanelUuid] = useState<string | null>(null);
    const panelIndex = panelUuid ? leads.findIndex((l) => l.uuid === panelUuid) : -1;
    const panelPrev = panelIndex > 0 ? () => setPanelUuid(leads[panelIndex - 1].uuid) : null;
    const panelNext = panelIndex >= 0 && panelIndex < leads.length - 1 ? () => setPanelUuid(leads[panelIndex + 1].uuid) : null;
    useEffect(() => {
        if (!panelUuid) return;
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
            if ((e.key === "ArrowDown" || e.key === "j") && panelNext) { e.preventDefault(); panelNext(); }
            if ((e.key === "ArrowUp" || e.key === "k") && panelPrev) { e.preventDefault(); panelPrev(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [panelUuid, panelIndex, leads]);

    const addModal = useDisclosure();
    const editModal = useDisclosure();
    const [editLead, setEditLead] = useState<any>(null);
    const convertModal = useDisclosure();
    const [convertLead, setConvertLead] = useState<any>(null);
    const importModal = useDisclosure();
    const deleteConfirm = useDisclosure();

    const openEdit = (lead: any) => {
        setEditLead(lead);
        editModal.onOpen();
    };

    const openConvert = (lead: any) => {
        setConvertLead(lead);
        convertModal.onOpen();
    };

    // "+" button on phones links here with ?add=1
    // Travel desk links here with ?new=travel to open a holiday enquiry
    const [addLine, setAddLine] = useState<"visa" | "travel" | undefined>(undefined);
    useEffect(() => {
        const isNewTravel = params.get("new") === "travel";
        if (params.get("add") !== "1" && !isNewTravel) return;
        setAddLine(isNewTravel ? "travel" : undefined);
        addModal.onOpen();
        const next = new URLSearchParams(params); next.delete("add"); next.delete("new"); setParams(next, { replace: true });
    }, [params]);

    // inline edits in the table (no need to open the lead)
    const quickStatus = async (lead: any, status: string) => {
        if (status === lead.status) return;
        if (status === "converted") { openConvert(lead); return; } // same convert → visa case flow
        if (status === "lost") { setPanelUuid(lead.uuid); return; } // needs a reason - open the lead
        setLeads((list) => list.map((l) => (l.uuid === lead.uuid ? { ...l, status } : l)));
        const { success } = await commonPostAPICall({ status }, `crm/leads/${lead.uuid}/status`, true);
        if (!success) loadLeads(); else loadSummary();
    };
    const quickAssign = async (lead: any, agentId: string) => {
        const id = agentId === "none" ? null : Number(agentId);
        if ((lead.assigned_to || null) === id) return;
        const { success } = await commonPostAPICall({ agent_id: id }, `crm/leads/${lead.uuid}/assign`, true);
        if (success) loadLeads();
    };
    const stop = { onClick: (e: any) => e.stopPropagation(), onPointerDown: (e: any) => e.stopPropagation(), onKeyDown: (e: any) => e.stopPropagation() };

    const filtered = Boolean(source || assignedTo || followUp || temperature || branch || created || params.get("search") || (status && status !== "all"));
    const InboxEmpty = () => filtered ? (
        <EmptyState compact icon={Inbox} title="No leads match these filters" text="Try another status or clear the filters."
            actions={<Button size="sm" variant="flat" onPress={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</Button>} />
    ) : (
        <EmptyState icon={Inbox} title="No leads yet" text="Leads from your website, Facebook, WhatsApp, IndiaMART and more arrive here automatically."
            actions={<>
                {isOwner && <Button size="sm" color="primary" startContent={<Plug size={14} />} onPress={() => navigate("/crm/sources")}>Connect a lead source</Button>}
                <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={addModal.onOpen}>Add a lead</Button>
                <Button size="sm" variant="flat" startContent={<Upload size={14} />} onPress={importModal.onOpen}>Import a file</Button>
            </>} />
    );

    const updateParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        if (key !== "page") next.delete("page");
        setParams(next, { replace: true });
    };

    const applySavedView = (v: SavedView) => {
        const filters = resolveViewFilters(v.filters, myBranch);
        setParams(applyFiltersToParams(filters, view === "board" ? "board" : undefined), { replace: true });
        if (filters.search !== undefined) setSearch(filters.search || "");
    };

    const saveCurrentView = () => {
        const name = window.prompt("Name this view");
        if (!name?.trim()) return;
        const next: SavedView = {
            id: `custom-${Date.now()}`,
            name: name.trim().slice(0, 40),
            filters: filtersFromParams(params),
        };
        const list = [...loadCustomViews(userKey), next];
        saveCustomViews(userKey, list);
        setCustomViews(list);
    };

    const removeCustomView = (id: string) => {
        const list = loadCustomViews(userKey).filter((v) => v.id !== id);
        saveCustomViews(userKey, list);
        setCustomViews(list);
    };

    const query = useMemo(() => {
        const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (status && status !== "all") q.set("status", status);
        if (source) q.set("source", source);
        if (assignedTo) q.set("assigned_to", assignedTo);
        if (followUp) q.set("follow_up", followUp);
        if (temperature) q.set("temperature", temperature);
        if (branch) q.set("branch", branch);
        if (created) q.set("created", created);
        const s = params.get("search");
        if (s) q.set("search", s);
        return q.toString();
    }, [params, page, status, source, assignedTo, followUp, temperature, branch, created]);

    const hasLeadsRef = useRef(false);
    const loadLeads = useCallback(async () => {
        // Only blank the list on first load; keep rows while filters/pages refresh
        if (!hasLeadsRef.current) setLoading(true);
        const { success, data } = await commonGetAPICalls(`/crm/leads?${query}`);
        if (success) {
            const next = data?.leads || [];
            setLeads(next);
            setPagination(data?.pagination || {});
            hasLeadsRef.current = next.length > 0 || hasLeadsRef.current;
        }
        setLoading(false);
        setSelected(new Set());
    }, [query]);

    const loadSummary = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/leads/summary${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`);
        if (success) setSummary(data);
    }, [branch]);

    useEffect(() => { loadLeads(); }, [loadLeads]);
    useEffect(() => { loadSummary(); }, [loadSummary]);
    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/team");
            if (success) setTeam(data || []);
        })();
    }, []);

    // search with a small delay
    useEffect(() => {
        const current = params.get("search") || "";
        if (search === current) return;
        const t = setTimeout(() => updateParam("search", search.trim()), 400);
        return () => clearTimeout(t);
    }, [search]);

    const refresh = () => { loadLeads(); loadSummary(); setBoardRefresh((n) => n + 1); };

    const selectedUuids = useMemo(() => {
        if (selected === "all") return leads.filter((l) => l.status !== "converted").map((l) => l.uuid);
        return Array.from(selected as Set<string>);
    }, [selected, leads]);

    /** Bulk actions apply at once and offer "Undo" (no "Are you sure?" pop-up). */
    const runBulk = async (action: string, value?: any) => {
        if (!selectedUuids.length) return;
        const uuids = [...selectedUuids];
        const before = leads.filter((l) => uuids.includes(l.uuid)).map((l) => ({
            uuid: l.uuid, status: l.status, assigned_to: l.assigned_to || null, branch_id: l.branch_id || null, tags: Array.isArray(l.tags) ? [...l.tags] : [],
        }));
        const silent = ["delete", "status", "assign", "branch", "tag_add", "tag_remove"].includes(action);
        setBulkBusy(true);
        const { success } = await commonPostAPICall({ uuids, action, value }, "crm/leads/bulk", !silent);
        setBulkBusy(false);
        if (!success) return;
        if (action === "tag_add" || action === "tag_remove") setBulkTags("");
        refresh();
        const n = uuids.length;
        // put each group back the way it was
        const restoreGroups = async (field: "status" | "assigned_to" | "branch_id", bulkAction: string) => {
            const groups = new Map<any, string[]>();
            before.forEach((b) => groups.set(b[field], [...(groups.get(b[field]) || []), b.uuid]));
            for (const [v, list] of groups) await commonPostAPICall({ uuids: list, action: bulkAction, value: v }, "crm/leads/bulk");
            refresh();
        };
        if (action === "delete") undoToast(`${n} lead(s) deleted`, async () => { await commonPostAPICall({ uuids }, "crm/leads/restore", true); refresh(); });
        else if (action === "status") undoToast(`${n} lead(s) updated`, () => restoreGroups("status", "status"));
        else if (action === "assign") undoToast(`${n} lead(s) reassigned`, () => restoreGroups("assigned_to", "assign"));
        else if (action === "branch") undoToast(`${n} lead(s) moved`, () => restoreGroups("branch_id", "branch"));
        else if (action === "tag_add") undoToast(`${n} lead(s) tagged`, async () => {
            await commonPostAPICall({ uuids, action: "tag_remove", value }, "crm/leads/bulk");
            refresh();
        });
        else if (action === "tag_remove") undoToast(`${n} lead(s) untagged`, async () => {
            await commonPostAPICall({ uuids, action: "tag_add", value }, "crm/leads/bulk");
            refresh();
        });
    };

    const runBulkTags = (action: "tag_add" | "tag_remove") => {
        const tags = bulkTags.split(",").map((t) => t.trim()).filter(Boolean);
        if (!tags.length) return;
        runBulk(action, tags);
    };

    const openCount = summary
        ? Object.entries(summary.by_status || {}).filter(([k]) => !["converted", "lost", "junk"].includes(k)).reduce((a, [, v]) => a + Number(v), 0)
        : undefined;

    const tabs = [
        { key: "all", label: "All", count: summary?.total },
        { key: "open", label: "Open", count: openCount },
        ...LEAD_STATUSES.map((s) => ({ key: s.key, label: s.label, count: summary?.by_status?.[s.key] || 0 })),
    ];

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <FirstTip id="inbox" title="Your Lead Inbox">Click a lead to open it on the side and use the arrow keys to go to the next one. Change status or owner straight from the list, and set a follow-up on every lead you talk to.</FirstTip>
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2"><Inbox size={24} /> Lead Inbox</h1>
                    <p className="text-sm text-default-500 max-sm:hidden">All enquiries from your website, IndiaMART, imports and your team in one place.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isOwner && (
                        <Button variant="flat" className="max-sm:hidden" startContent={<Plug size={16} />} onPress={() => navigate("/crm/sources")}>Lead sources</Button>
                    )}
                    <Tabs size="sm" selectedKey={view} onSelectionChange={(k) => updateParam("view", k === "board" ? "board" : "")} aria-label="View">
                        <Tab key="list" title={<span className="flex items-center gap-1"><List size={14} />List</span>} />
                        <Tab key="board" title={<span className="flex items-center gap-1"><KanbanSquare size={14} />Board</span>} />
                    </Tabs>
                    <Button variant="flat" startContent={<Upload size={16} />} onPress={importModal.onOpen}>Import</Button>
                    <Button color="primary" className="max-md:hidden" startContent={<Plus size={16} />} onPress={addModal.onOpen}>Add lead</Button>
                </div>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Open leads" value={openCount} onPress={() => updateParam("status", "open")} />
                <StatCard icon={UserPlus} label="New today" value={summary?.new_today} onPress={() => updateParam("status", "new")} />
                <StatCard icon={CalendarClock} label="Follow-ups today" value={summary?.follow_ups_today} tone="warning" onPress={() => updateParam("follow_up", "today")} />
                <StatCard icon={AlarmClock} label="Overdue follow-ups" value={summary?.follow_ups_overdue} tone="danger" onPress={() => updateParam("follow_up", "overdue")} />
            </div>

            {/* saved views */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-default-500 flex items-center gap-1 shrink-0"><Bookmark size={14} /> Views</span>
                {savedViews.map((v) => (
                    <Chip
                        key={v.id}
                        size="sm"
                        variant={activeViewId === v.id ? "solid" : "flat"}
                        color={activeViewId === v.id ? "primary" : "default"}
                        className="cursor-pointer"
                        onClick={() => applySavedView(v)}
                        endContent={!v.preset ? (
                            <button type="button" aria-label={`Remove ${v.name}`} className="ml-0.5 opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeCustomView(v.id); }}>
                                <X size={12} />
                            </button>
                        ) : undefined}
                    >
                        {v.name}
                    </Chip>
                ))}
                {filtered && (
                    <Button size="sm" variant="light" onPress={saveCurrentView}>Save current filters</Button>
                )}
            </div>

            {view === "list" && (<>
            {/* status tabs */}
            <div className="overflow-x-auto">
                <Tabs
                    selectedKey={status}
                    onSelectionChange={(k) => updateParam("status", String(k))}
                    variant="underlined"
                    aria-label="Lead status"
                >
                    {tabs.map((t) => (
                        <Tab key={t.key} title={<span className="flex items-center gap-1">{t.label}{t.count !== undefined && <Chip size="sm" variant="flat">{t.count}</Chip>}</span>} />
                    ))}
                </Tabs>
            </div>

            </>)}

            {/* filters (folded on phones) */}
            {(() => {
                const active = [source, assignedTo, temperature, followUp, branch].filter(Boolean).length;
                return (
                    <div className="sm:hidden flex gap-2">
                        <Input className="flex-1" placeholder="Search name, phone..." startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
                        <Button variant={active ? "solid" : "flat"} color={active ? "primary" : "default"} startContent={<SlidersHorizontal size={16} />} onPress={() => setShowFilters((v) => !v)}>{active ? active : "Filters"}</Button>
                    </div>
                );
            })()}
            <div className={`flex flex-col gap-2 ${showFilters ? "" : "max-sm:hidden"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 items-stretch">
                <BranchPicker value={branch} onChange={(v) => updateParam("branch", v)} className="w-full" />
                <Input
                    className="max-sm:hidden"
                    placeholder="Search name, phone, email, country..."
                    startContent={<Search size={16} />}
                    value={search}
                    onValueChange={setSearch}
                    isClearable
                    onClear={() => setSearch("")}
                />
                <Select aria-label="Source" placeholder="All sources" selectedKeys={source ? [source] : []} onChange={(e) => updateParam("source", e.target.value)}>
                    {LEAD_SOURCES.map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                </Select>
                {isManager ? (
                    <Select aria-label="Assigned to" placeholder="Anyone" selectedKeys={assignedTo ? [assignedTo] : []} onChange={(e) => updateParam("assigned_to", e.target.value)}>
                        {[
                            <SelectItem key="me">Assigned to me</SelectItem>,
                            <SelectItem key="unassigned">Unassigned</SelectItem>,
                            ...team.map((m) => <SelectItem key={String(m.id)}>{m.username || `#${m.id}`}</SelectItem>),
                        ]}
                    </Select>
                ) : <div className="hidden xl:block" />}
                <Select aria-label="Lead score" placeholder="Any score" selectedKeys={temperature ? [temperature] : []} onChange={(e) => updateParam("temperature", e.target.value)}>
                    <SelectItem key="hot">Hot</SelectItem>
                    <SelectItem key="warm">Warm</SelectItem>
                    <SelectItem key="cold">Cold</SelectItem>
                </Select>
                <Select aria-label="Follow-up" placeholder="Any follow-up" selectedKeys={followUp ? [followUp] : []} onChange={(e) => updateParam("follow_up", e.target.value)}>
                    <SelectItem key="overdue">Overdue</SelectItem>
                    <SelectItem key="today">Due today</SelectItem>
                    <SelectItem key="upcoming">Upcoming</SelectItem>
                </Select>
            </div>
            </div>

            {view === "board" ? <LeadBoard query={query} refreshKey={boardRefresh} onChanged={loadSummary} /> : (<>
            {/* bulk actions */}
            {isManager && selectedUuids.length > 0 && (
                <Card shadow="sm" className="bg-primary-50">
                    <CardBody className="flex flex-col gap-2 p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-sm font-medium">{selectedUuids.length} selected</span>
                            <div className="flex flex-wrap gap-2 sm:ml-auto">
                                <Select aria-label="Assign selected" size="sm" placeholder="Assign to..." className="w-44" isDisabled={bulkBusy}
                                    onChange={(e) => e.target.value && runBulk("assign", e.target.value === "none" ? null : Number(e.target.value))}>
                                    {[<SelectItem key="none">Unassign</SelectItem>, ...team.map((m) => <SelectItem key={String(m.id)}>{m.username || `#${m.id}`}</SelectItem>)]}
                                </Select>
                                <Select aria-label="Set status" size="sm" placeholder="Set status..." className="w-40" isDisabled={bulkBusy}
                                    onChange={(e) => e.target.value && runBulk("status", e.target.value)}>
                                    {SELECTABLE_STATUSES.filter((s) => s.key !== "lost").map((s) => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                                </Select>
                                {ownerForBranches && branches.length > 0 && (
                                    <Select aria-label="Move selected to branch" size="sm" placeholder="Move to branch..." className="w-48" isDisabled={bulkBusy}
                                        onChange={(e) => e.target.value && window.confirm(`Move ${selectedUuids.length} lead(s) to ${e.target.value === "none" ? "no branch" : branchName(branches, Number(e.target.value))}? Leads of people outside that branch go to its next counsellor.`) && runBulk("branch", e.target.value === "none" ? null : Number(e.target.value))}>
                                        {[...branches.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>), <SelectItem key="none">No branch</SelectItem>]}
                                    </Select>
                                )}
                                <Button size="sm" color="danger" variant="flat" isDisabled={bulkBusy} onPress={() => runBulk("delete")}>Delete</Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                aria-label="Bulk tags"
                                size="sm"
                                className="w-full sm:w-56"
                                placeholder="Tags (comma separated)"
                                value={bulkTags}
                                onValueChange={setBulkTags}
                                isDisabled={bulkBusy}
                            />
                            <Button size="sm" variant="flat" isDisabled={bulkBusy || !bulkTags.trim()} onPress={() => runBulkTags("tag_add")}>Add tags</Button>
                            <Button size="sm" variant="flat" isDisabled={bulkBusy || !bulkTags.trim()} onPress={() => runBulkTags("tag_remove")}>Remove tags</Button>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* phones: cards */}
            <div className="md:hidden">
                {loading && !leads.length ? <CardListSkeleton /> : !leads.length ? <InboxEmpty /> : <LeadCards
                    leads={leads} loading={false} selectable={isManager}
                    selected={selected === "all" ? new Set(leads.map((l) => l.uuid)) : new Set(Array.from(selected as Set<any>).map(String))}
                    onToggle={(uuid) => setSelected((prev) => {
                        const next = new Set(prev === "all" ? leads.map((l) => l.uuid) : Array.from(prev as Set<any>).map(String));
                        if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
                        return next;
                    })}
                    branchLabel={(id) => (branches.length && id ? branchName(branches, id) : null)}
                />}
            </div>

            {/* table */}
            <Card shadow="sm" className="max-md:hidden">
                <CardBody className="p-0 overflow-x-auto">
                    <Table
                        aria-label="Leads"
                        removeWrapper
                        selectionMode={isManager ? "multiple" : "none"}
                        selectedKeys={selected}
                        onSelectionChange={setSelected}
                        disabledKeys={leads.filter((l) => l.status === "converted").map((l) => l.uuid)}
                        onRowAction={(key) => setPanelUuid(String(key))}
                        className="min-w-[860px]"
                    >
                        <TableHeader>
                            <TableColumn>LEAD</TableColumn>
                            <TableColumn>INTERESTED IN</TableColumn>
                            <TableColumn>SOURCE</TableColumn>
                            <TableColumn>STATUS</TableColumn>
                            <TableColumn>ASSIGNED</TableColumn>
                            <TableColumn>FOLLOW-UP</TableColumn>
                            <TableColumn>LAST ACTIVITY</TableColumn>
                            <TableColumn align="end">ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody
                            isLoading={loading && !leads.length}
                            loadingContent={<div className="w-full px-3 bg-content1"><ListSkeleton rows={6} /></div>}
                            emptyContent={loading ? " " : <InboxEmpty />}
                            items={leads}
                        >
                            {(lead: any) => {
                                const meta = statusMeta(lead.status);
                                const fu = followUpState(lead.next_follow_up_at);
                                return (
                                    <TableRow key={lead.uuid} className="cursor-pointer">
                                        <TableCell>
                                            <div className="font-medium">{lead.name || "Unnamed"}{temperatureMeta(lead.score).key !== "cold" && <Chip size="sm" variant="flat" color={temperatureMeta(lead.score).color} className="ml-2">{temperatureMeta(lead.score).label}</Chip>}{lead.enquiry_count > 1 && <Chip size="sm" variant="flat" color="warning" className="ml-2">x{lead.enquiry_count}</Chip>}</div>
                                            <div className="text-xs text-default-500 whitespace-nowrap">{formatPhone(lead) || lead.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{lead.interested_country || "-"}</div>
                                            <div className="text-xs text-default-500 truncate max-w-[180px]">{lead.interested_course || lead.visa_type || ""}</div>
                                        </TableCell>
                                        <TableCell><Chip size="sm" variant="flat">{sourceLabel(lead.source)}</Chip></TableCell>
                                        <TableCell>
                                            {lead.status === "converted" ? <Chip size="sm" color={meta.color} variant="flat">{meta.label}</Chip> : (
                                                <div {...stop}>
                                                    <Dropdown>
                                                        <DropdownTrigger>
                                                            <button type="button" aria-label="Change status"><Chip size="sm" color={meta.color} variant="flat" className="cursor-pointer" endContent={<ChevronDown size={12} />}>{meta.label}</Chip></button>
                                                        </DropdownTrigger>
                                                        <DropdownMenu aria-label="Status" onAction={(k) => quickStatus(lead, String(k))} selectedKeys={[lead.status]} selectionMode="single">
                                                            {STATUS_MENU_STATUSES.map((st) => (
                                                                <DropdownItem key={st.key}>
                                                                    {st.label}{st.key === "lost" || st.key === "converted" ? "..." : ""}
                                                                </DropdownItem>
                                                            ))}
                                                        </DropdownMenu>
                                                    </Dropdown>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {isManager && lead.status !== "converted" ? (
                                                <div {...stop}>
                                                    <Dropdown>
                                                        <DropdownTrigger>
                                                            <button type="button" className="text-left hover:text-primary inline-flex items-center gap-1" aria-label="Change assignee">
                                                                {lead.assignee?.username || <span className="text-default-400">Unassigned</span>}<ChevronDown size={12} className="text-default-400" />
                                                            </button>
                                                        </DropdownTrigger>
                                                        <DropdownMenu aria-label="Assign to" onAction={(k) => quickAssign(lead, String(k))}>
                                                            {[<DropdownItem key="none">Unassigned</DropdownItem>, ...team.map((m) => <DropdownItem key={String(m.id)}>{m.username || `#${m.id}`}</DropdownItem>)]}
                                                        </DropdownMenu>
                                                    </Dropdown>
                                                </div>
                                            ) : (lead.assignee?.username || <span className="text-default-400">Unassigned</span>)}
                                            {branches.length > 0 && lead.branch_id && <div className="text-xs text-default-500">{branchName(branches, lead.branch_id)}</div>}
                                        </TableCell>
                                        <TableCell>
                                            {lead.next_follow_up_at ? (
                                                <span className={`text-xs ${fu === "overdue" ? "text-danger font-medium" : fu === "today" ? "text-warning-600 font-medium" : "text-default-600"}`}>
                                                    {formatDateTime(lead.next_follow_up_at)}
                                                </span>
                                            ) : <span className="text-default-400 text-xs">-</span>}
                                        </TableCell>
                                        <TableCell className="text-xs text-default-500">{timeAgo(lead.last_activity_at || lead.createdAt)}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                const wa = whatsappLink(lead);
                                                const tel = lead.phone_normalized ? `tel:+${String(lead.phone_normalized).replace(/\D/g, "")}` : null;
                                                return (
                                                    <div {...stop} className="flex justify-end">
                                                        <Dropdown placement="bottom-end">
                                                            <DropdownTrigger>
                                                                <Button isIconOnly size="sm" variant="light" aria-label="Lead actions">
                                                                    <MoreVertical size={16} />
                                                                </Button>
                                                            </DropdownTrigger>
                                                            <DropdownMenu
                                                                aria-label="Lead actions"
                                                                onAction={(key) => {
                                                                    const k = String(key);
                                                                    if (k === "open") setPanelUuid(lead.uuid);
                                                                    else if (k === "edit") openEdit(lead);
                                                                    else if (k === "call" && tel) {
                                                                        window.location.href = tel;
                                                                        setTimeout(() => setPanelUuid(lead.uuid), 700);
                                                                    } else if (k === "whatsapp" && wa) {
                                                                        window.open(wa, "_blank", "noopener,noreferrer");
                                                                    }
                                                                }}
                                                            >
                                                                <DropdownItem key="open">Open</DropdownItem>
                                                                {lead.status !== "converted" ? (
                                                                    <DropdownItem key="edit" startContent={<Pencil size={14} />}>Edit</DropdownItem>
                                                                ) : null}
                                                                {tel ? (
                                                                    <DropdownItem key="call" startContent={<Phone size={14} />}>Call</DropdownItem>
                                                                ) : null}
                                                                {wa ? (
                                                                    <DropdownItem key="whatsapp" startContent={<MessageCircle size={14} />} className="text-success">WhatsApp</DropdownItem>
                                                                ) : null}
                                                            </DropdownMenu>
                                                        </Dropdown>
                                                    </div>
                                                );
                                            })()}
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
                    <Pagination total={pagination.totalPages} page={page} onChange={(p) => updateParam("page", String(p))} showControls />
                </div>
            )}

            </>)}

            <Drawer isOpen={Boolean(panelUuid)} onOpenChange={(open) => { if (!open) setPanelUuid(null); }} size="3xl" placement="right" hideCloseButton>
                <DrawerContent>
                    {() => (
                        <DrawerBody className="p-3 sm:p-4">
                            {panelUuid && (
                                <LeadDetails key={panelUuid} leadUuid={panelUuid} embedded onClose={() => setPanelUuid(null)}
                                    onChanged={() => { loadLeads(); loadSummary(); }} onPrev={panelPrev} onNext={panelNext} />
                            )}
                        </DrawerBody>
                    )}
                </DrawerContent>
            </Drawer>
            <LeadFormModal isOpen={addModal.isOpen} onOpenChange={(o) => { addModal.onOpenChange(); if (!o) setAddLine(undefined); }} team={team} canAssign={isManager} onSaved={refresh} defaultLine={addLine} />
            <LeadFormModal
                isOpen={editModal.isOpen}
                onOpenChange={(open) => {
                    if (open) editModal.onOpen();
                    else { editModal.onClose(); setEditLead(null); }
                }}
                lead={editLead}
                team={team}
                canAssign={isManager}
                onSaved={() => { setEditLead(null); refresh(); }}
            />
            <ConvertLeadModal
                isOpen={convertModal.isOpen}
                onOpenChange={(open) => {
                    if (open) convertModal.onOpen();
                    else { convertModal.onClose(); setConvertLead(null); }
                }}
                lead={convertLead}
                team={team}
                canAssign={isManager}
                onConverted={() => { setConvertLead(null); refresh(); }}
            />
            <ImportLeadsModal isOpen={importModal.isOpen} onOpenChange={importModal.onOpenChange} team={team} canAssign={isManager} onImported={refresh} />
            <CommonConfirmation
                isOpen={deleteConfirm.isOpen}
                onOpenChange={deleteConfirm.onOpenChange}
                title={`Delete ${selectedUuids.length} lead(s)?`}
                nagativeTitle="Cancel"
                positiveTitle="Delete"
                handleSubmit={() => { deleteConfirm.onClose(); runBulk("delete"); }}
            />
        </div>
    );
};

export default LeadInbox;
