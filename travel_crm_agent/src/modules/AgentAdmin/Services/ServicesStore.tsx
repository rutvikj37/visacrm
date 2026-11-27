import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ORDER_STATUS } from "./orderShared";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Switch, Tab, Tabs, Textarea, Tooltip, useDisclosure,
} from "@heroui/react";
import { Copy, CreditCard, IndianRupee, MessageCircle, Package, Pencil, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import EmptyState from "@/components/ui-kit/EmptyState";
import FirstTip from "@/components/help/FirstTip";

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const EMPTY = { id: "", name: "", category: "", description: "", delivery: "", price: "", gst_percent: "18", active: true, sort_order: "0" };
const CATEGORIES = ["Coaching", "Documents", "Visa", "Settling in", "Finance", "Other"];

const Field = ({ label, hint, className = "", children }: any) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
        <span className="text-xs font-medium text-default-600">{label}</span>
        {children}
        {hint && <span className="text-xs text-default-400">{hint}</span>}
    </div>
);

const Stat = ({ icon: Icon, label, value, tone }: any) => (
    <div className="rounded-xl border border-default-200 bg-content1 p-3 flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${tone}`}><Icon size={18} /></div>
        <div className="min-w-0"><div className="text-xl font-semibold leading-tight">{value}</div><div className="text-xs text-default-500 truncate">{label}</div></div>
    </div>
);

/** Services the agency sells to its students; students buy and pay in the student portal. */
const ServicesStore = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [params] = useSearchParams();
    const [tab, setTab] = useState(params.get("tab") === "orders" ? "orders" : "services");
    const [orderFilter, setOrderFilter] = useState("open");
    const [orders, setOrders] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [form, setForm] = useState<any>(EMPTY);
    const [saving, setSaving] = useState(false);
    const modal = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/services");
        if (success) setData(data);
    }, []);
    const loadOrders = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/service_orders?status=${orderFilter}&page=${page}`);
        setOrders(success ? data : { orders: [], pages: 0, counts: {} });
    }, [page, orderFilter]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { loadOrders(); }, [loadOrders]);

    if (!data) return <div className="p-2"><CardListSkeleton /></div>;
    const canManage = data.can_manage;
    const set = (k: string) => (v: any) => setForm({ ...form, [k]: v });
    const open = (s?: any) => {
        setForm(s ? { id: s.id, name: s.name, category: s.category || "", description: s.description || "", delivery: s.delivery || "", price: String(s.price), gst_percent: String(s.gst_percent), active: s.active, sort_order: String(s.sort_order || 0) } : EMPTY);
        modal.onOpen();
    };
    const save = async (close: () => void) => {
        setSaving(true);
        const { success } = await commonPostAPICall({ ...form, id: form.id || undefined, price: Number(form.price), gst_percent: Number(form.gst_percent || 0), sort_order: Number(form.sort_order || 0) }, "crm/services", true);
        setSaving(false);
        if (success) { close(); load(); }
    };
    const toggle = async (s: any, active: boolean) => {
        setData({ ...data, services: data.services.map((x: any) => (x.id === s.id ? { ...x, active } : x)) });
        await commonPostAPICall({ ...s, active }, "crm/services", false);
        load();
    };
    const remove = async (s: any) => {
        if (!window.confirm(`Remove "${s.name}"? Students can no longer buy it. Invoices already paid stay in Client fees.`)) return;
        const { success } = await commonPostAPICall({}, `crm/services/${s.id}/delete`, true);
        if (success) load();
    };
    const shareText = (s: any) => `${s.name} - ${rupees(s.total)}${s.gst_percent ? " incl. GST" : ""}\n${s.description || ""}\nBuy and pay online: ${data.portal_url || ""}`.trim();
    const copy = async (s: any) => { try { await navigator.clipboard.writeText(shareText(s)); SuccessToast("Copied - paste it in WhatsApp or email"); } catch { /* clipboard blocked */ } };
    const gstPreview = Number(form.price || 0) * (1 + Number(form.gst_percent || 0) / 100);
    const activeCount = data.services.filter((s: any) => s.active).length;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Services store</h1>
                    <p className="text-sm text-default-500">Sell services in the student portal — payments go to your Razorpay account</p>
                </div>
                {canManage && <Button color="primary" className="w-full sm:w-auto sm:ml-auto" startContent={<Plus size={16} />} onPress={() => open()}>Add service</Button>}
            </div>

            <FirstTip id="services" title="How the services store works">Add a service with its price and GST. It appears under "Services" in your student portal. When a student pays, a paid GST invoice and receipt are created in Client fees and you get a notification.</FirstTip>

            {!data.razorpay_ready && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3">
                    <CreditCard size={20} className="text-warning-600 shrink-0" />
                    <div className="min-w-0 flex-1 text-sm"><div className="font-medium text-default-800">Connect Razorpay to take payments</div><div className="text-default-600">Students can see your services, but can't pay until your Razorpay keys are added.</div></div>
                    <Button size="sm" color="warning" variant="flat" onPress={() => navigate("/settings/payments")}>Connect Razorpay</Button>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Stat icon={Package} label="Services on sale" value={`${activeCount} / ${data.services.length}`} tone="bg-primary-50 text-primary" />
                <Stat icon={ShoppingBag} label="Orders (last 30 days)" value={data.last_30_days.orders} tone="bg-secondary-50 text-secondary" />
                <Stat icon={IndianRupee} label="Collected (last 30 days)" value={rupees(data.last_30_days.revenue)} tone="bg-success-50 text-success-600" />
                <Stat icon={CreditCard} label="Online payments" value={data.razorpay_ready ? "Connected" : "Not set up"} tone={data.razorpay_ready ? "bg-success-50 text-success-600" : "bg-warning-50 text-warning-600"} />
            </div>

            <Tabs aria-label="Services store" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
                <Tab key="services" title={`Services (${data.services.length})`} />
                <Tab key="orders" title={orders?.counts?.open ? `Orders (${orders.counts.open} open)` : "Orders"} />
            </Tabs>

            {tab === "services" && (!data.services.length ? (
                <EmptyState icon={Store} title="No services yet" text="Add what you sell — IELTS coaching, SOP writing, visa file charges, accommodation, airport pickup — with a price. Students can then buy it in their portal."
                    actions={canManage ? <Button color="primary" className="w-full sm:w-auto" startContent={<Plus size={16} />} onPress={() => open()}>Add your first service</Button> : null} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {data.services.map((s: any) => (
                        <Card key={s.id} shadow="sm" className={s.active ? "" : "opacity-70"}>
                            <CardBody className="gap-3">
                                <div className="flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {s.category && <Chip size="sm" variant="flat" color="primary">{s.category}</Chip>}
                                            {!s.active && <Chip size="sm" variant="flat">Hidden</Chip>}
                                        </div>
                                        <div className="font-semibold text-lg leading-snug mt-1">{s.name}</div>
                                    </div>
                                    {canManage && <Tooltip content={s.active ? "On sale - click to hide" : "Hidden - click to put on sale"}><Switch size="sm" aria-label="On sale" isSelected={s.active} onValueChange={(v) => toggle(s, v)} /></Tooltip>}
                                </div>
                                {s.description && <p className="text-sm text-default-600 line-clamp-3">{s.description}</p>}
                                <div className="flex items-end gap-2">
                                    <div>
                                        <div className="text-2xl font-semibold">{rupees(s.total)}</div>
                                        <div className="text-xs text-default-500">{s.gst_percent ? `${rupees(s.price)} + ${s.gst_percent}% GST` : "No GST"}{s.delivery ? ` · ${s.delivery}` : ""}</div>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <div className="text-sm font-medium">{s.sold} sold</div>
                                        <div className="text-xs text-default-500">{rupees(s.revenue)} collected</div>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 border-t border-default-100 pt-3">
                                    <Button size="sm" variant="flat" color="success" startContent={<MessageCircle size={14} />} as="a" target="_blank" rel="noopener"
                                        href={`https://wa.me/?text=${encodeURIComponent(shareText(s))}`}>Share</Button>
                                    <Tooltip content="Copy text with the portal link"><Button size="sm" variant="flat" isIconOnly aria-label="Copy" onPress={() => copy(s)}><Copy size={14} /></Button></Tooltip>
                                    {canManage && <Button size="sm" variant="flat" className="ml-auto" startContent={<Pencil size={14} />} onPress={() => open(s)}>Edit</Button>}
                                    {canManage && <Button size="sm" variant="flat" color="danger" isIconOnly aria-label="Remove" onPress={() => remove(s)}><Trash2 size={14} /></Button>}
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            ))}

            {tab === "orders" && (
                <div className="flex flex-col gap-3">
                    <Tabs size="sm" variant="light" aria-label="Order status" selectedKey={orderFilter} onSelectionChange={(k) => { setOrderFilter(String(k)); setPage(1); }}>
                        <Tab key="open" title={`To do${orders?.counts?.open ? ` (${orders.counts.open})` : ""}`} />
                        <Tab key="delivered" title={`Delivered${orders?.counts?.delivered ? ` (${orders.counts.delivered})` : ""}`} />
                        <Tab key="completed" title="Completed" />
                        <Tab key="all" title="All" />
                    </Tabs>
                    <Card shadow="sm">
                        <CardBody className="p-0">
                            {!orders ? <div className="p-4"><CardListSkeleton cards={2} /></div> : !orders.orders.length ? (
                                <EmptyState compact icon={ShoppingBag} title={orderFilter === "open" ? "Nothing to do" : "No orders here"} text="When a student buys a service, its order shows here. Open it to chat with the student and deliver the files." />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[820px]">
                                        <thead><tr className="text-left text-xs text-default-500 border-b border-default-100">
                                            <th className="font-medium px-4 py-3">Ordered</th><th className="font-medium">Student</th><th className="font-medium">Service</th><th className="font-medium">Status</th><th className="font-medium">Handled by</th><th className="font-medium">Due</th><th className="font-medium">Invoice</th>
                                        </tr></thead>
                                        <tbody>
                                            {orders.orders.map((o: any) => (
                                                <tr key={o.id} className="border-b border-default-100 last:border-0 hover:bg-default-50 cursor-pointer" onClick={() => navigate(`/services/orders/${o.id}`)}>
                                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(o.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</td>
                                                    <td><div className="font-medium">{o.student?.name || "-"}</div><div className="text-xs text-default-500">{o.student?.phone}</div></td>
                                                    <td className="font-medium">{o.title}</td>
                                                    <td><Chip size="sm" variant="flat" color={ORDER_STATUS[o.status]?.color}>{o.status_label}</Chip></td>
                                                    <td>{o.assigned_name || <span className="text-default-400">Not assigned</span>}</td>
                                                    <td className={o.overdue ? "text-danger font-medium" : ""}>{o.due_date ? new Date(`${o.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "-"}</td>
                                                    <td className="text-default-600">{o.invoice ? `${o.invoice.number} · ${rupees(o.invoice.total)}` : "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}
            {tab === "orders" && orders?.pages > 1 && <Pagination className="self-center" total={orders.pages} page={page} onChange={setPage} />}

            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{form.id ? `Edit ${form.name}` : "Add service"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Service name *" className="sm:col-span-2"><Input aria-label="Service name" placeholder="e.g. IELTS coaching (6 weeks)" value={form.name} onValueChange={set("name")} /></Field>
                                    <Field label="Category">
                                        <Input aria-label="Category" list="svc-categories" placeholder="e.g. Coaching" value={form.category} onValueChange={set("category")} />
                                        <datalist id="svc-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                                    </Field>
                                    <Field label="Delivery" hint="Shown to the student"><Input aria-label="Delivery" placeholder="e.g. Online, 6 weeks" value={form.delivery} onValueChange={set("delivery")} /></Field>
                                    <Field label="Description" className="sm:col-span-2"><Textarea aria-label="Description" minRows={3} placeholder="What the student gets" value={form.description} onValueChange={set("description")} /></Field>
                                    <Field label="Price (₹, before GST) *"><Input aria-label="Price" type="number" min={1} startContent={<span className="text-default-400 text-sm">₹</span>} value={form.price} onValueChange={set("price")} /></Field>
                                    <Field label="GST %" hint={Number(form.price) > 0 ? `Student pays ${rupees(gstPreview)}` : "0 if you don't charge GST"}>
                                        <Input aria-label="GST percent" type="number" min={0} max={28} value={form.gst_percent} onValueChange={set("gst_percent")} />
                                    </Field>
                                    <Field label="Order in the list" hint="Lower numbers show first"><Input aria-label="Sort order" type="number" value={form.sort_order} onValueChange={set("sort_order")} /></Field>
                                    <div className="flex items-end pb-2"><Switch isSelected={form.active} onValueChange={set("active")}>On sale in the student portal</Switch></div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={saving} onPress={() => save(onClose)}>{form.id ? "Save" : "Add service"}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default ServicesStore;
