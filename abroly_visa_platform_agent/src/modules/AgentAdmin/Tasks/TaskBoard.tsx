import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
    Avatar, Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger,
    Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem,
    Spinner, Tab, Tabs, Textarea, useDisclosure,
} from "@heroui/react";
import {
    CheckSquare, ExternalLink, LayoutGrid, List, MoreVertical, Plus, Search, Trash2,
} from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import EmptyState from "@/components/ui-kit/EmptyState";
import FirstTip from "@/components/help/FirstTip";

const COLUMNS = [
    { key: "todo", label: "To do" },
    { key: "in_progress", label: "In progress" },
    { key: "done", label: "Done" },
] as const;

const PRIORITY_COLOR: Record<string, "default" | "primary" | "warning" | "danger"> = {
    low: "default",
    normal: "primary",
    high: "danger",
};

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
    priority: string;
    due_at?: string | null;
    overdue?: boolean;
    assignee_id: number;
    assignee_name: string;
    created_by: number;
    created_by_name: string;
    related_type: string;
    related_id?: string | null;
    related_link?: string | null;
    related_label?: string | null;
};

const emptyForm = {
    title: "",
    description: "",
    assignee_id: "",
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

/** Agency task board: Kanban + list, assign to team, optional lead/case link. */
const TaskBoard = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const openId = params.get("task") || "";
    const myName = useSelector((state: any) => state.login?.user_name || "");

    const [view, setView] = useState("mine");
    const [status, setStatus] = useState("open");
    const [layout, setLayout] = useState<"kanban" | "list">("kanban");
    const [q, setQ] = useState("");
    const [branch, setBranch] = useState("");
    const [columns, setColumns] = useState<Record<string, Task[]>>({ todo: [], in_progress: [], done: [] });
    const [tasks, setTasks] = useState<Task[]>([]);
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
        const { success, data } = await commonGetAPICalls(
            `/crm/tasks?view=${view}&status=${status}&q=${encodeURIComponent(q)}${branchQuery(branch)}`,
        );
        if (success) {
            setColumns(data.columns || { todo: [], in_progress: [], done: [] });
            setTasks(data.tasks || []);
            setCounts(data.counts || { open: 0, overdue: 0, total: 0 });
        }
        setLoading(false);
    }, [view, status, q, branch]);

    useEffect(() => { loadTeam(); }, [loadTeam]);
    useEffect(() => {
        setLoading(true);
        const t = setTimeout(load, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [load]);

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
        });
        modal.onOpen();
    };

    const openEdit = (t: Task) => {
        setEditingId(t.id);
        setForm({
            title: t.title,
            description: t.description || "",
            assignee_id: String(t.assignee_id),
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
            const all = [...prev.todo, ...prev.in_progress, ...prev.done];
            const t = all.find((x) => x.id === id);
            if (!t) return prev;
            const updated = { ...t, status: next };
            return {
                todo: [...prev.todo.filter((x) => x.id !== id), ...(next === "todo" ? [updated] : [])],
                in_progress: [...prev.in_progress.filter((x) => x.id !== id), ...(next === "in_progress" ? [updated] : [])],
                done: [...prev.done.filter((x) => x.id !== id), ...(next === "done" ? [updated] : [])],
            };
        });
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
                        <DropdownItem key="todo">Move to To do</DropdownItem>
                        <DropdownItem key="in_progress">Move to In progress</DropdownItem>
                        <DropdownItem key="done">Move to Done</DropdownItem>
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

    return (
        <div className="flex flex-col gap-3 p-1 sm:p-2 max-w-full">
            <FirstTip id="tasks-board" title="Assign work to your team">
                Create tasks, assign a counsellor, set a due date, and optionally link a lead or visa case. Drag is via Move to — columns are To do, In progress, and Done.
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
                    <Tab key="all" title="All" />
                </Tabs>
                <Tabs size="sm" aria-label="Status" selectedKey={status} onSelectionChange={(k) => setStatus(String(k))}>
                    <Tab key="open" title="Open" />
                    <Tab key="overdue" title="Overdue" />
                    <Tab key="done" title="Done" />
                    <Tab key="todo" title="To do" />
                    <Tab key="in_progress" title="In progress" />
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-h-[420px]">
                        {COLUMNS.map((col) => (
                            <div key={col.key} className="rounded-xl border border-default-200 bg-default-50/60 flex flex-col min-h-0">
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
                                            <td className="px-3 py-2 capitalize">{t.status.replace("_", " ")}</td>
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
                                    <Chip size="sm" variant="flat" className="capitalize">{selected.status.replace("_", " ")}</Chip>
                                    <Chip size="sm" variant="flat" color={PRIORITY_COLOR[selected.priority]}>{selected.priority}</Chip>
                                    {selected.due_at && <Chip size="sm" variant="flat" color={selected.overdue ? "danger" : "default"}>Due {dueLabel(selected.due_at)}</Chip>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {COLUMNS.map((c) => (
                                        <Button key={c.key} size="sm" variant={selected.status === c.key ? "solid" : "flat"} color={selected.status === c.key ? "primary" : "default"}
                                            onPress={() => setTaskStatus(selected.id, c.key).then(() => { setSelected({ ...selected, status: c.key }); })}>
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
