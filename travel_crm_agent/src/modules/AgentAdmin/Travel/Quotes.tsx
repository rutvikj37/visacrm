import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalHeader, Tab, Tabs, useDisclosure } from "@heroui/react";
import { ArrowRight, CalendarRange, FileText, Map, Plus, Receipt, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { PageHead, QUOTE_STATUS, fmtDate, rupees } from "./travelShared";

const KINDS = [
    { key: "quote", icon: Receipt, title: "Quote", text: "Pricing only - full GST, margin and booking-ready flow. No day plan." },
    { key: "quote_itinerary", icon: FileText, title: "Quote + Itinerary", text: "Full quote plus the day-wise customer itinerary, built together.", best: true },
    { key: "itinerary", icon: Map, title: "Itinerary", text: "Just the day-wise plan, no pricing. Turn it into a quote later." },
];

/** All quotes as a table (cards on phones), with search, status tabs and the "New quote" chooser. */
const Quotes = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const status = params.get("status") || "";
    const [rows, setRows] = useState<any[] | null>(null);
    const [search, setSearch] = useState("");
    const chooser = useDisclosure();
    const [creating, setCreating] = useState("");

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/travel/quotes${status ? `?status=${status}` : ""}`);
        setRows(success ? data : []);
    }, [status]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (params.get("new") === "1") { chooser.onOpen(); const n = new URLSearchParams(params); n.delete("new"); setParams(n, { replace: true }); } }, []);

    const shown = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!rows || !s) return rows;
        return rows.filter((q) => [q.number, q.title, q.lead?.name, q.lead?.phone, q.trip?.place].some((v) => String(v || "").toLowerCase().includes(s)));
    }, [rows, search]);
    const seesProfit = (rows || []).some((q) => q.profit !== undefined);

    const start = async (kind: string) => {
        if (kind === "itinerary") { chooser.onClose(); navigate("/travel/itineraries?new=1"); return; }
        setCreating(kind);
        const { success, data } = await commonPostAPICall({ kind }, "travel/quotes");
        setCreating("");
        if (success && data?.id) navigate(`/travel/quotes/${data.id}?step=1`);
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Quotes" sub={rows ? `${rows.length} quotation${rows.length === 1 ? "" : "s"}` : "Priced trips with GST, margin and day plans"}
                actions={<Button color="primary" startContent={<Plus size={16} />} onPress={chooser.onOpen}>New quote</Button>} />
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="overflow-x-auto">
                    <Tabs selectedKey={status || "all"} onSelectionChange={(k) => setParams(k === "all" ? {} : { status: String(k) }, { replace: true })} variant="underlined" aria-label="Quote status">
                        <Tab key="all" title="All" /><Tab key="draft" title="Draft" /><Tab key="sent" title="Sent" /><Tab key="accepted" title="Booked" /><Tab key="rejected" title="Lost" />
                    </Tabs>
                </div>
                <Input aria-label="Search quotes" className="sm:max-w-xs sm:ml-auto" placeholder="Search customer, place, number" startContent={<Search size={16} />} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} />
            </div>

            {shown === null ? <CardListSkeleton /> : !shown.length ? (
                <EmptyState icon={FileText} title={rows?.length ? "No quotes match" : "Build your first quote"} text="Add a customer, pick services, set your margin and GST, then share a branded PDF." actions={<Button color="primary" startContent={<Plus size={16} />} onPress={chooser.onOpen}>New quote</Button>} />
            ) : (
                <>
                    {/* desktop table */}
                    <div className="hidden md:block rounded-2xl border border-default-200 bg-content1 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-default-50 dark:bg-default-100/40 text-xs text-default-500 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Quote #</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Destination</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount</th>{seesProfit && <th className="px-4 py-3 font-medium text-right">Profit</th>}
                                    <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Trip date</th><th className="px-4 py-3 font-medium">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-default-100">
                                {shown.map((q) => (
                                    <tr key={q.id} className="hover:bg-default-50 cursor-pointer" onClick={() => navigate(`/travel/quotes/${q.id}`)}>
                                        <td className="px-4 py-3"><div className="font-medium">{q.number}</div><div className="text-[11px] text-default-500">v{q.version}{q.kind === "quote_itinerary" ? " · with itinerary" : ""}</div></td>
                                        <td className="px-4 py-3"><div className="font-medium truncate max-w-[200px]">{q.lead?.name || <span className="text-default-400">No customer</span>}</div><div className="text-[11px] text-default-500">{q.lead?.phone}</div></td>
                                        <td className="px-4 py-3"><div className="truncate max-w-[200px]">{q.trip?.place || q.title}</div><div className="text-[11px] text-default-500">{q.trip?.destination_type === "international" ? "International" : "Domestic"}</div></td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{rupees(Math.round(q.total ?? q.sell_total))}</td>
                                        {seesProfit && <td className={`px-4 py-3 text-right tabular-nums ${Number(q.profit) >= 0 ? "text-success-600" : "text-danger"}`}>{rupees(Math.round(q.profit || 0))}</td>}
                                        <td className="px-4 py-3"><Chip size="sm" variant="flat" color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip></td>
                                        <td className="px-4 py-3 text-default-600">{q.trip?.start_date ? fmtDate(q.trip.start_date) : "-"}</td>
                                        <td className="px-4 py-3 text-default-500">{fmtDate(q.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* phone cards */}
                    <div className="md:hidden flex flex-col gap-2">
                        {shown.map((q) => (
                            <button key={q.id} type="button" onClick={() => navigate(`/travel/quotes/${q.id}`)} className="rounded-2xl border border-default-200 bg-content1 p-3 text-left shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold truncate">{q.lead?.name || q.title}</div>
                                        <div className="text-xs text-default-500 truncate">{q.number} · {q.trip?.place || q.title}</div>
                                        {q.trip?.start_date && <div className="text-xs text-default-500 flex items-center gap-1 mt-0.5"><CalendarRange size={12} /> {fmtDate(q.trip.start_date)}</div>}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-semibold">{rupees(Math.round(q.total ?? q.sell_total))}</div>
                                        <Chip size="sm" variant="flat" color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}

            <Modal isOpen={chooser.isOpen} onOpenChange={chooser.onOpenChange} size="3xl" placement="center" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader className="flex-col items-start">What do you want to create?<span className="text-sm font-normal text-default-500">Start with pricing, or build the customer itinerary first.</span></ModalHeader>
                    <ModalBody className="pb-6">
                        <div className="grid sm:grid-cols-3 gap-3">
                            {KINDS.map((k) => (
                                <button key={k.key} type="button" disabled={!!creating} onClick={() => start(k.key)}
                                    className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:shadow-md disabled:opacity-60 ${k.best ? "border-primary bg-primary-50/60 dark:bg-primary/10" : "border-default-200 hover:border-default-400"}`}>
                                    {k.best && <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">Popular</span>}
                                    <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><k.icon size={20} /></span>
                                    <span className="font-semibold">{k.title}</span>
                                    <span className="text-xs text-default-500 flex-1">{k.text}</span>
                                    <span className="text-sm text-primary font-medium flex items-center gap-1">{creating === k.key ? "Creating…" : "Continue"} <ArrowRight size={14} /></span>
                                </button>
                            ))}
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default Quotes;
