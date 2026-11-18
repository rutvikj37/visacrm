import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
    Avatar, Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger,
    Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem,
    Spinner, Tab, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import {
    CheckCircle2, CheckSquare, CircleDot, ExternalLink, LayoutGrid, List, MoreVertical, Play, Plus, Search, Trash2,
} from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import EmptyState from "@/components/ui-kit/EmptyState";
import FirstTip from "@/components/help/FirstTip";

const COLUMNS = [
    { key: "todo", label: "Pending" },
    { key: "in_progress", label: "In progress" },
    { key: "ready_for_review", label: "Ready" },
    { key: "done", label: "Completed" },
] as const;

const emptyColumns = () => ({
    todo: [] as Task[],
    in_progress: [] as Task[],
    ready_for_review: [] as Task[],
    done: [] as Task[],
});

const PRIORITY_COLOR: Record<string, "default" | "primary" | "warning" | "danger"> = {
    low: "default",
    normal: "primary",
    high: "danger",
};

const statusLabel = (s: string) => COLUMNS.find((c) => c.key === s)?.label || s.replace(/_/g, " ");

const dueLabel = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

const toLocalInput = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Task = {
    id: number;
    title: string;
    description?: string;
    status: string;
    status_label?: string;
    priority: string;
    due_at?: string | null;
    overdue?: boolean;
    assignee_id: number;
    assignee_name: string;
    created_by: number;
    created_by_name: string;
    tagged_member_ids?: number[];
    tagged_members?: { id: number; name: string }[];
    related_type: string;
    related_id?: string | null;
    related_link?: string | null;
    related_label?: string | null;
};

const emptyForm = {
    title: "",
    description: "",
    assignee_id: "",
    tagged_member_ids: [] as string[],
    priority: "normal",
    due_at: "",
    related_type: "none",
    related_id: "",
    status: "todo",
};

const controlProps = {
    variant: "bordered" as const,
    classNames: {
        inputWrapper: "bg-content1 border-default-200 shadow-none",
        trigger: "bg-content1 border-default-200 shadow-none",
        input: "bg-transparent",
    },
};

const Field = ({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) => (
    <div className="flex flex-col gap-1.5 min-w-0">
        <label className="text-sm font-medium text-default-700">
            {label}
            {required ? <span className="text-danger"> *</span> : null}
        </label>
        {children}
    </div>
);

const primaryAction = (status: string): { next: string; label: string; icon: any } | null => {
    if (status === "todo") return { next: "in_progress", label: "Start", icon: Play };
    if (status === "in_progress") return { next: "ready_for_review", label: "Mark as ready", icon: CircleDot };
    if (status === "ready_for_review") return { next: "done", label: "Mark completed", icon: CheckCircle2 };
    return null;
};

/** Agency task board: Kanban + list, assign to team, tag colleagues, optional lead/case link. */
const TaskBoard = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const openId = params.get("task") || "";
    const myName = useSelector((state: any) => state.login?.user_name || "");

    const PAGE_SIZE = 25;
    const [view, setView] = useState("mine");
    const [status, setStatus] = useState("open");
    const [layout, setLayout] = useState<"kanban" | "list">("kanban");
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");
    const [branch, setBranch] = useState("");
    const [columns, setColumns] = useState<Record<string, Task[]>>(emptyColumns());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
    const [counts, setCounts] = useState({ open: 0, overdue: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [team, setTeam] = useState<any[]>([]);
    const [form, setForm] = useState({ ...emptyForm });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const modal = useDisclosure();
    const detail = useDisclosure();
    const [selected, setSelected] = useState<Task | null>(null);

    const loadTeam = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/team");
        if (success) setTeam((data || []).map((m: any) => m.dataValues || m));
    }, []);

    const load = useCallback(async () => {
        const layoutQ = layout === "list" ? `&layout=list&page=${page}&limit=${PAGE_SIZE}` : "";
        const { success, data } = await commonGetAPICalls(
            `/crm/tasks?view=${view}&status=${status}&q=${encodeURIComponent(q)}${branchQuery(branch)}${layoutQ}`,
        );
        if (success) {
            setColumns(data.columns || emptyColumns());
            setTasks(data.tasks || []);
            setCounts(data.counts || { open: 0, overdue: 0, total: 0 });
            setPagination(data.pagination || { totalPages: 1, totalItems: data.tasks?.length || 0 });
        }
        setLoading(false);
    }, [view, status, q, branch, layout, page]);

    useEffect(() => { loadTeam(); }, [loadTeam]);
    useEffect(() => {
        setLoading(true);
        const t = setTimeout(load, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [load]);
    useEffect(() => { setPage(1); }, [view, status, q, branch, layout]);

    useEffect(() => {
        if (!openId || !tasks.length) return;
        const t = tasks.find((x) => String(x.id) === openId);
        if (t) { setSelected(t); detail.onOpen(); }
    }, [openId, tasks]);

    const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

    const openCreate = () => {
        setEditingId(null);
        const me = team.find((m) => m.username && myName && m.username === myName) || team[0];
        setForm({
            ...emptyForm,
            assignee_id: me ? String(me.id) : "",
            tagged_member_ids: [],
        });
        modal.onOpen();
    };

    const openEdit = (t: Task) => {
        setEditingId(t.id);
        setForm({
            title: t.title,
            description: t.description || "",
            assignee_id: String(t.assignee_id),
            tagged_member_ids: (t.tagged_member_ids || []).map(String),
            priority: t.priority || "normal",
            due_at: toLocalInput(t.due_at),
            related_type: t.related_type || "none",
            related_id: t.related_id || "",
            status: t.status,
        });
        modal.onOpen();
    };

    const save = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        const body = {
            title: form.title.trim(),
            description: form.description,
            assignee_id: Number(form.assignee_id),
            tagged_member_ids: form.tagged_member_ids.map(Number).filter(Boolean),
            priority: form.priority,
            due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
            related_type: form.related_type,
            related_id: form.related_type === "none" ? null : form.related_id.trim() || null,
            status: form.status,
        };
        const { success } = editingId
            ? await commonPostAPICall(body, `crm/tasks/${editingId}/update`, true)
            : await commonPostAPICall(body, "crm/tasks", true);
        setSaving(false);
        if (success) { modal.onClose(); await load(); }
    };

    const setTaskStatus = async (id: number, next: string) => {
        setColumns((prev) => {
            const all = [
                ...prev.todo,
                ...prev.in_progress,
                ...(prev.ready_for_review || []),
                ...prev.done,
            ];
            const t = all.find((x) => x.id === id);
            if (!t) return prev;
            const updated = { ...t, status: next, status_label: statusLabel(next) };
            return {
                todo: [...prev.todo.filter((x) => x.id !== id), ...(next === "todo" ? [updated] : [])],
                in_progress: [...prev.in_progress.filter((x) => x.id !== id), ...(next === "in_progress" ? [updated] : [])],
                ready_for_review: [...(prev.ready_for_review || []).filter((x) => x.id !== id), ...(next === "ready_for_review" ? [updated] : [])],
                done: [...prev.done.filter((x) => x.id !== id), ...(next === "done" ? [updated] : [])],
            };
        });
        setSelected((s) => (s && s.id === id ? { ...s, status: next, status_label: statusLabel(next) } : s));
        await commonPostAPICall({ status: next }, `crm/tasks/${id}/status`, false);
        load();
    };

    const remove = async (id: number) => {
        if (!window.confirm("Delete this task?")) return;
        const { success } = await commonPostAPICall({}, `crm/tasks/${id}/delete`, true);
        if (success) { detail.onClose(); await load(); }
    };

    const openRelated = (t: Task) => {
        if (t.related_link) navigate(t.related_link);
    };

    const TaskCard = ({ t }: { t: Task }) => (
        <div
            className="rounded-lg border border-default-200 bg-content1 p-3 flex flex-col gap-2 shadow-sm hover:border-primary/40 cursor-pointer"
            onClick={() => { setSelected(t); detail.onOpen(); setParams({ task: String(t.id) }, { replace: true }); }}
        >
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 font-medium text-sm leading-snug">{t.title}</div>
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" aria-label="Task actions" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical size={14} />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Move" onAction={(key) => {
                        if (key === "edit") openEdit(t);
                        else if (key === "delete") remove(t.id);
                        else setTaskStatus(t.id, String(key));
                    }}>
                        <DropdownItem key="todo">Move to Pending</DropdownItem>
                        <DropdownItem key="in_progress">Move to In progress</DropdownItem>
                        <DropdownItem key="ready_for_review">Move to Ready</DropdownItem>
                        <DropdownItem key="done">Move to Completed</DropdownItem>
                        <DropdownItem key="edit">Edit</DropdownItem>
                        <DropdownItem key="delete" className="text-danger" color="danger">Delete</DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <Chip size="sm" variant="flat" color={PRIORITY_COLOR[t.priority] || "default"}>{t.priority}</Chip>
                {t.overdue && <Chip size="sm" color="danger" variant="flat">Overdue</Chip>}
                {t.due_at && <span className={`text-[11px] ${t.overdue ? "text-danger" : "text-default-500"}`}>{dueLabel(t.due_at)}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-default-500">
                <Avatar size="sm" name={t.assignee_name} className="w-5 h-5 text-[10px]" />
                <span className="truncate">{t.assignee_name}</span>
            </div>
            {!!t.tagged_members?.length && (
                <div className="flex -space-x-1.5 items-center">
                    {t.tagged_members.slice(0, 4).map((m) => (
                        <Avatar key={m.id} size="sm" name={m.name} title={m.name} className="w-5 h-5 text-[9px] ring-1 ring-content1" />
                    ))}
                    {t.tagged_members.length > 4 && (
                        <span className="text-[10px] text-default-400 pl-2">+{t.tagged_members.length - 4}</span>
                    )}
                </div>
            )}
            {t.related_type !== "none" && (
                <button
                    type="button"
                    className="text-left text-[11px] text-primary truncate flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); openRelated(t); }}
                >
                    <ExternalLink size={12} />{t.related_label || (t.related_type === "lead" ? "Lead" : "Case")}
                </button>
            )}
        </div>
    );

    const teamOptions = useMemo(() => team.map((m) => ({ id: String(m.id), name: m.username || `#${m.id}` })), [team]);
    const taggableOptions = useMemo(
        () => teamOptions.filter((m) => m.id !== form.assignee_id),
        [teamOptions, form.assignee_id],
    );
    const action = selected ? primaryAction(selected.status) : null;

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-full">
            <FirstTip id="tasks-board" title="Assign work to your team">
                Create tasks, assign a counsellor, tag colleagues, set a due date, and move work Pending → In progress → Ready → Completed.
            </FirstTip>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                        <CheckSquare size={22} /> Tasks
                    </h1>
                    <p className="text-sm text-default-500">
                        {counts.open} open{counts.overdue ? ` · ${counts.overdue} overdue` : ""}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={layout === "kanban" ? "solid" : "flat"} color={layout === "kanban" ? "primary" : "default"} isIconOnly aria-label="Kanban" onPress={() => setLayout("kanban")}><LayoutGrid size={16} /></Button>
                    <Button size="sm" variant={layout === "list" ? "solid" : "flat"} color={layout === "list" ? "primary" : "default"} isIconOnly aria-label="List" onPress={() => setLayout("list")}><List size={16} /></Button>
                    <Button color="primary" startContent={<Plus size={16} />} onPress={openCreate}>New task</Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                <Tabs size="sm" aria-label="View" selectedKey={view} onSelectionChange={(k) => setView(String(k))}>
                    <Tab key="mine" title="Mine" />
                    <Tab key="assigned_by_me" title="Assigned by me" />
                    <Tab key="tagged_me" title="Tagged me" />
                    <Tab key="all" title="All" />
                </Tabs>
                <Tabs size="sm" aria-label="Status" selectedKey={status} onSelectionChange={(k) => setStatus(String(k))}>
                    <Tab key="open" title="Open" />
                    <Tab key="overdue" title="Overdue" />
                    <Tab key="todo" title="Pending" />
                    <Tab key="in_progress" title="In progress" />
                    <Tab key="ready_for_review" title="Ready" />
                    <Tab key="done" title="Completed" />
                </Tabs>
                <Input size="sm" className="sm:w-56" aria-label="Search" placeholder="Search tasks" startContent={<Search size={14} />} value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
                <BranchPicker value={branch} onChange={setBranch} />
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Spinner label="Loading tasks…" /></div>
            ) : layout === "kanban" ? (
                !tasks.length ? (
                    <EmptyState icon={CheckSquare} title="No tasks yet" text="Create a task and assign it to a team member." actions={<Button color="primary" startContent={<Plus size={16} />} onPress={openCreate}>New task</Button>} />
                ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 min-h-[420px]">
                        {COLUMNS.map((col) => (
                            <div key={col.key} className="rounded-xl border border-default-200 bg-default-50/60 flex flex-col min-h-0 min-w-[240px] w-[260px] shrink-0 md:flex-1 md:min-w-[200px]">
                                <div className="px-3 py-2 border-b border-default-100 flex items-center justify-between">
                                    <span className="text-sm font-semibold">{col.label}</span>
                                    <Chip size="sm" variant="flat">{(columns[col.key] || []).length}</Chip>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                                    {(columns[col.key] || []).map((t) => <TaskCard key={t.id} t={t} />)}
                                    {!columns[col.key]?.length && (
                                        <div className="text-xs text-default-400 text-center py-6">No cards</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
                    {!tasks.length ? (
                        <EmptyState icon={CheckSquare} title="No tasks yet" text="Create a task and assign it to a team member." actions={<Button color="primary" startContent={<Plus size={16} />} onPress={openCreate}>New task</Button>} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-default-100/80 text-default-600 text-xs uppercase">
                                    <tr>
                                        <th className="text-left px-3 py-2">Title</th>
                                        <th className="text-left px-3 py-2">Assignee</th>
                                        <th className="text-left px-3 py-2">Status</th>
                                        <th className="text-left px-3 py-2">Due</th>
                                        <th className="text-left px-3 py-2">Linked</th>
                                        <th className="px-3 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.map((t) => (
                                        <tr key={t.id} className="border-t border-default-100 hover:bg-default-50 cursor-pointer" onClick={() => { setSelected(t); detail.onOpen(); }}>
                                            <td className="px-3 py-2 font-medium">
                                                {t.title}
                                                {t.priority === "high" && <Chip size="sm" color="danger" variant="flat" className="ml-2">High</Chip>}
                                            </td>
                                            <td className="px-3 py-2 text-default-600">{t.assignee_name}</td>
                                            <td className="px-3 py-2">{statusLabel(t.status)}</td>
                                            <td className={`px-3 py-2 ${t.overdue ? "text-danger" : "text-default-600"}`}>{dueLabel(t.due_at) || "—"}</td>
                                            <td className="px-3 py-2">{t.related_label || "—"}</td>
                                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <Button size="sm" variant="light" onPress={() => openEdit(t)}>Edit</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center border-t border-default-200 p-3">
                            <Pagination total={pagination.totalPages} page={page} onChange={setPage} showControls />
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="lg" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{editingId ? "Edit task" : "New task"}</ModalHeader>
                            <ModalBody className="flex flex-col gap-5">
                                <Field label="Title" required>
                                    <Input {...controlProps} aria-label="Title" placeholder="What needs doing?" value={form.title} onValueChange={(v) => setField("title", v)} />
                                </Field>
                                <Field label="Description">
                                    <Textarea {...controlProps} aria-label="Description" placeholder="Optional details" minRows={2} value={form.description} onValueChange={(v) => setField("description", v)} />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                                    <Field label="Assignee" required>
                                        <Select
                                            {...controlProps}
                                            aria-label="Assignee"
                                            selectedKeys={form.assignee_id ? [form.assignee_id] : []}
                                            onSelectionChange={(keys) => {
                                                const v = Array.from(keys)[0];
                                                if (v) setField("assignee_id", String(v));
                                            }}
                                        >
                                            {teamOptions.map((m) => <SelectItem key={m.id}>{m.name}</SelectItem>)}
                                        </Select>
                                    </Field>
                                    <Field label="Status">
                                        <Select
                                            {...controlProps}
                                            aria-label="Status"
                                            selectedKeys={[form.status]}
                                            onSelectionChange={(keys) => {
                                                const v = Array.from(keys)[0];
                                                if (v) setField("status", String(v));
                                            }}
                                        >
                                            {COLUMNS.map((c) => <SelectItem key={c.key}>{c.label}</SelectItem>)}
                                        </Select>
                                    </Field>
                                </div>
                                <Field label="Tag colleagues">
                                    <Select
                                        {...controlProps}
                                        aria-label="Tag colleagues"
                                        selectionMode="multiple"
                                        placeholder="Optional watchers"
                                        selectedKeys={new Set(form.tagged_member_ids)}
                                        onSelectionChange={(keys) => {
                                            setField("tagged_member_ids", Array.from(keys as Set<string>).map(String));
                                        }}
                                    >
                                        {taggableOptions.map((m) => <SelectItem key={m.id}>{m.name}</SelectItem>)}
                                    </Select>
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                                    <Field label="Priority">
                                        <Select
                                            {...controlProps}
                                            aria-label="Priority"
                                            selectedKeys={[form.priority]}
                                            onSelectionChange={(keys) => {
                                                const v = Array.from(keys)[0];
                                                if (v) setField("priority", String(v));
                                            }}
                                        >
                                            <SelectItem key="low">Low</SelectItem>
                                            <SelectItem key="normal">Normal</SelectItem>
                                            <SelectItem key="high">High</SelectItem>
                                        </Select>
                                    </Field>
                                    <Field label="Due">
                                        <Input {...controlProps} type="datetime-local" aria-label="Due" value={form.due_at} onValueChange={(v) => setField("due_at", v)} />
                                    </Field>
                                </div>
                                <Field label="Link to">
                                    <Select
                                        {...controlProps}
                                        aria-label="Link to"
                                        selectedKeys={[form.related_type]}
                                        onSelectionChange={(keys) => {
                                            const v = Array.from(keys)[0];
                                            if (v) setField("related_type", String(v));
                                        }}
                                    >
                                        <SelectItem key="none">Nothing</SelectItem>
                                        <SelectItem key="lead">CRM lead</SelectItem>
                                        <SelectItem key="case">Visa case</SelectItem>
                                    </Select>
                                </Field>
                                {form.related_type === "lead" && (
                                    <Field label="Lead UUID">
                                        <Input {...controlProps} aria-label="Lead UUID" placeholder="Paste lead uuid from Lead Inbox URL" value={form.related_id} onValueChange={(v) => setField("related_id", v)} />
                                    </Field>
                                )}
                                {form.related_type === "case" && (
                                    <Field label="Case ID">
                                        <Input {...controlProps} aria-label="Case ID" placeholder="Numeric id from /leads/progress/15" value={form.related_id} onValueChange={(v) => setField("related_id", v)} />
                                    </Field>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="flat" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} isDisabled={!form.title.trim() || !form.assignee_id} onPress={save}>
                                    {editingId ? "Save" : "Create"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={detail.isOpen} onOpenChange={(open) => { detail.onOpenChange(); if (!open) setParams({}, { replace: true }); }} size="md" scrollBehavior="inside">
                <ModalContent>
                    {() => selected && (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                <span>{selected.title}</span>
                                <span className="text-xs font-normal text-default-500">
                                    Assigned to {selected.assignee_name} · by {selected.created_by_name}
                                </span>
                            </ModalHeader>
                            <ModalBody className="flex flex-col gap-3">
                                {selected.description && <p className="text-sm whitespace-pre-wrap text-default-700">{selected.description}</p>}
                                <div className="flex flex-wrap gap-2">
                                    <Chip size="sm" variant="flat">{statusLabel(selected.status)}</Chip>
                                    <Chip size="sm" variant="flat" color={PRIORITY_COLOR[selected.priority]}>{selected.priority}</Chip>
                                    {selected.due_at && <Chip size="sm" variant="flat" color={selected.overdue ? "danger" : "default"}>Due {dueLabel(selected.due_at)}</Chip>}
                                </div>
                                {!!selected.tagged_members?.length && (
                                    <div className="flex flex-wrap gap-1.5 items-center text-xs text-default-600">
                                        <span>Tagged:</span>
                                        {selected.tagged_members.map((m) => (
                                            <Chip key={m.id} size="sm" variant="flat" avatar={<Avatar name={m.name} />}>{m.name}</Chip>
                                        ))}
                                    </div>
                                )}
                                {action && (
                                    <Button
                                        color="primary"
                                        startContent={<action.icon size={16} />}
                                        onPress={() => setTaskStatus(selected.id, action.next)}
                                    >
                                        {action.label}
                                    </Button>
                                )}
                                {selected.status === "done" && (
                                    <Button variant="flat" onPress={() => setTaskStatus(selected.id, "in_progress")}>
                                        Reopen
                                    </Button>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {COLUMNS.map((c) => (
                                        <Button key={c.key} size="sm" variant={selected.status === c.key ? "solid" : "flat"} color={selected.status === c.key ? "primary" : "default"}
                                            onPress={() => setTaskStatus(selected.id, c.key)}>
                                            {c.label}
                                        </Button>
                                    ))}
                                </div>
                                {selected.related_type !== "none" && (
                                    <Button variant="flat" color="primary" startContent={<ExternalLink size={14} />} onPress={() => openRelated(selected)}>
                                        Open {selected.related_type === "lead" ? "lead" : "case"}{selected.related_label ? `: ${selected.related_label}` : ""}
                                    </Button>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" color="danger" startContent={<Trash2 size={14} />} onPress={() => remove(selected.id)}>Delete</Button>
                                <Button variant="flat" onPress={() => openEdit(selected)}>Edit</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default TaskBoard;
