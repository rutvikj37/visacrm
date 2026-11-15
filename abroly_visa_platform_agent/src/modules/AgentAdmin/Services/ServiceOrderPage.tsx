import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Switch, Textarea } from "@heroui/react";
import { ArrowLeft, Bot, Check, Download, FileText, GraduationCap, Lock, MessageCircle, Paperclip, PlayCircle, Receipt, Send, Upload, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { PageSkeleton } from "@/components/ui-kit/Skeletons";
import { ORDER_STATUS, ORDER_STEPS, fileSize, fmtWhen } from "./orderShared";

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const Stepper = ({ status }: { status: string }) => {
    const at = status === "changes_requested" ? 1 : ORDER_STEPS.indexOf(status);
    return (
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            {ORDER_STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${i < at || (i === at && s === "completed") ? "bg-primary text-primary-foreground" : i === at ? "border-2 border-primary text-primary" : "border border-default-300 text-default-400"}`}>
                        {i < at || (i === at && s === "completed") ? <Check size={14} /> : i + 1}
                    </div>
                    <span className={`text-xs ${i === at ? "font-semibold text-primary" : "text-default-500"}`}>{ORDER_STATUS[s].label}</span>
                    {i < ORDER_STEPS.length - 1 && <div className={`h-px w-6 sm:w-12 ${i < at ? "bg-primary" : "bg-default-200"}`} />}
                </div>
            ))}
        </div>
    );
};

const FileChip = ({ f }: { f: any }) => (
    <a href={f.url || undefined} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg border border-default-200 bg-content1 hover:bg-default-50 px-2.5 py-2 text-sm min-w-0 max-w-full">
        <FileText size={16} className="text-danger shrink-0" />
        <span className="truncate min-w-0">{f.name}</span>
        <span className="text-xs text-default-400 shrink-0">{fileSize(f.size)}</span>
        <Download size={14} className="text-default-400 shrink-0" />
    </a>
);

/** One service order: who works on it, the conversation with the student, and the delivered files. */
const ServiceOrderPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall, commonPostAPICallWithFile } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/service_orders/${id}`);
        if (success) setData(data);
    }, [id]);
    useEffect(() => { load(); }, [load]);
    if (!data) return <PageSkeleton />;
    const { order, student, invoice, updates, team } = data;
    const st = ORDER_STATUS[order.status];

    const send = async (action: string) => {
        const fd = new FormData();
        fd.append("action", action);
        if (text.trim()) fd.append("message", text.trim());
        if (action === "message" && internal) fd.append("internal", "true");
        files.forEach((f) => fd.append("files", f));
        setBusy(action);
        const { success } = await commonPostAPICallWithFile(fd, `crm/service_orders/${id}/update`, true);
        setBusy("");
        if (success) { setText(""); setFiles([]); setInternal(false); load(); }
    };
    const assign = async (body: any) => { await commonPostAPICall(body, `crm/service_orders/${id}/assign`, true); load(); };
    // copy the files out first: clearing the input empties the live FileList
    const addFiles = (list: FileList | null) => { const picked = list ? Array.from(list) : []; if (picked.length) setFiles((f) => [...f, ...picked].slice(0, 5)); };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <div className="flex flex-wrap items-start gap-3">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate("/services?tab=orders")}><ArrowLeft size={20} /></Button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap"><h1 className="text-2xl font-semibold">{order.title}</h1><Chip color={st.color} variant="flat">{st.label}</Chip></div>
                    <p className="text-sm text-default-500">Ordered {fmtWhen(order.at)}{order.service?.delivery ? ` · Promised: ${order.service.delivery}` : ""}</p>
                </div>
            </div>

            <Card shadow="sm"><CardBody className="py-3"><Stepper status={order.status} /></CardBody></Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
                    {order.status === "changes_requested" && <div className="rounded-xl bg-warning-50 text-warning-800 text-sm px-4 py-3">The student asked for changes - see their message below, then deliver the updated file.</div>}

                    <Card shadow="sm">
                        <CardHeader className="font-semibold">Conversation & deliveries</CardHeader>
                        <CardBody className="pt-0 flex flex-col gap-3">
                            {updates.map((u: any) => u.kind === "status" ? (
                                <div key={u.id} className="flex items-center gap-2 text-xs text-default-500">
                                    <span className="h-px flex-1 bg-default-200" /><span>{u.message} · {u.author_name} · {fmtWhen(u.at)}</span><span className="h-px flex-1 bg-default-200" />
                                </div>
                            ) : (
                                <div key={u.id} className={`flex gap-3 ${u.author_type === "student" ? "" : "flex-row-reverse"}`}>
                                    {u.author_type === "student"
                                        ? <div className="h-8 w-8 rounded-full bg-secondary-50 text-secondary grid place-items-center shrink-0"><GraduationCap size={16} /></div>
                                        : u.author_type === "system" ? <div className="h-8 w-8 rounded-full bg-default-100 grid place-items-center shrink-0"><Bot size={16} /></div>
                                            : <Avatar size="sm" name={u.author_name || "?"} className="shrink-0" />}
                                    <div className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 flex flex-col gap-2 ${u.internal ? "bg-warning-50 border border-warning-200" : u.kind === "delivery" ? "bg-success-50 border border-success-200" : u.author_type === "student" ? "bg-default-100" : "bg-primary-50"}`}>
                                        <div className="text-xs text-default-500 flex items-center gap-1.5 flex-wrap">
                                            <b className="text-default-700">{u.author_name}</b>{u.author_type === "student" ? " (student)" : ""} · {fmtWhen(u.at)}
                                            {u.kind === "delivery" && <Chip size="sm" color="success" variant="flat" startContent={<Upload size={12} />}>Delivered</Chip>}
                                            {u.internal && <Chip size="sm" color="warning" variant="flat" startContent={<Lock size={12} />}>Internal - student can't see</Chip>}
                                        </div>
                                        {u.message && <div className="text-sm whitespace-pre-wrap break-words">{u.message}</div>}
                                        {u.files.length > 0 && <div className="flex flex-col gap-1.5">{u.files.map((f: any, i: number) => <FileChip key={i} f={f} />)}</div>}
                                    </div>
                                </div>
                            ))}

                            {order.status !== "completed" && (
                                <div className="border-t border-default-100 pt-3 flex flex-col gap-2">
                                    <Textarea aria-label="Message" minRows={2} placeholder={internal ? "Note for your team (the student won't see it)" : "Write to the student, or add a note with the delivery"} value={text} onValueChange={setText} />
                                    {files.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {files.map((f, i) => (
                                                <Chip key={i} variant="flat" startContent={<FileText size={13} />} onClose={() => setFiles(files.filter((_, j) => j !== i))}>{f.name} · {fileSize(f.size)}</Chip>
                                            ))}
                                        </div>
                                    )}
                                    <input ref={fileRef} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.jpg,.jpeg,.png,.webp,.zip" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button size="sm" variant="flat" startContent={<Paperclip size={14} />} onPress={() => fileRef.current?.click()}>Attach files</Button>
                                        <Switch size="sm" isSelected={internal} onValueChange={setInternal}>Internal note</Switch>
                                        <div className="ml-auto flex gap-2">
                                            <Button size="sm" variant="flat" startContent={<Send size={14} />} isLoading={busy === "message"} onPress={() => send("message")}>{internal ? "Add note" : "Send"}</Button>
                                            {!internal && <Button size="sm" color="success" className="text-white" startContent={<Upload size={14} />} isLoading={busy === "deliver"} onPress={() => send("deliver")}>Deliver to student</Button>}
                                        </div>
                                    </div>
                                    <p className="text-xs text-default-400">Deliver sends the attached files (PDF, Word, images ... up to 15 MB each) to the student's portal and emails them. They can approve it or ask for changes.</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>

                <div className="flex flex-col gap-4 min-w-0">
                    <Card shadow="sm">
                        <CardHeader className="font-semibold">Work</CardHeader>
                        <CardBody className="pt-0 gap-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-default-600">Handled by</span>
                                <Select aria-label="Handled by" size="sm" placeholder="Not assigned" selectedKeys={order.assigned_to ? [String(order.assigned_to)] : []} onChange={(e) => assign({ agent_id: e.target.value || null })}>
                                    {team.map((t: any) => <SelectItem key={String(t.id)}>{t.name}</SelectItem>)}
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-default-600">Due date</span>
                                <Input aria-label="Due date" size="sm" type="date" value={order.due_date || ""} onValueChange={(v) => assign({ due_date: v || null })} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {order.status === "new" && <Button size="sm" variant="flat" color="secondary" startContent={<PlayCircle size={14} />} isLoading={busy === "start"} onPress={() => send("start")}>Start work</Button>}
                                {order.status === "delivered" && <Button size="sm" variant="flat" startContent={<Check size={14} />} isLoading={busy === "complete"} onPress={() => send("complete")}>Mark completed</Button>}
                            </div>
                        </CardBody>
                    </Card>

                    {student && (
                        <Card shadow="sm">
                            <CardHeader className="font-semibold">Student</CardHeader>
                            <CardBody className="pt-0 gap-1 text-sm">
                                <div className="font-medium">{student.name}</div>
                                <div className="text-default-500">{student.phone}</div>
                                {student.email && <div className="text-default-500 truncate">{student.email}</div>}
                                <div className="flex gap-2 mt-2">
                                    {student.phone_digits && <Button size="sm" variant="flat" color="success" as="a" href={`https://wa.me/${student.phone_digits}`} target="_blank" rel="noopener" startContent={<MessageCircle size={14} />}>WhatsApp</Button>}
                                    {order.case_id && <Button size="sm" variant="flat" onPress={() => navigate(`/leads/progress/${order.case_id}`)}>Visa case</Button>}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {invoice && (
                        <Card shadow="sm" isPressable onPress={() => navigate(`/fees/${invoice.id}`)}>
                            <CardBody className="flex flex-row items-center gap-3">
                                <div className="p-2 rounded-lg bg-success-50 text-success-600"><Receipt size={18} /></div>
                                <div className="min-w-0 flex-1"><div className="text-sm font-medium">Invoice {invoice.number}</div><div className="text-xs text-default-500">{rupees(invoice.paid)} paid online</div></div>
                                <Chip size="sm" color="success" variant="flat" className="capitalize">{invoice.status}</Chip>
                            </CardBody>
                        </Card>
                    )}
                    {order.service?.description && <div className="text-xs text-default-500 px-1">What was promised: {order.service.description}</div>}
                    <div className="hidden"><X /></div>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrderPage;
