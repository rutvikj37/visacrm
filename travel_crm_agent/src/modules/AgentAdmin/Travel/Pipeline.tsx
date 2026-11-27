import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, useDisclosure } from "@heroui/react";
import { CalendarClock, MessageCircle, Plus } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { LEAD_STATUSES } from "@/modules/AgentAdmin/Crm/crmShared";
import { Field, PageHead, Tile, rupees } from "./travelShared";

const PRIORITY: Record<string, { label: string; color: "danger" | "warning" | "default" }> = { high: { label: "High", color: "danger" }, medium: { label: "Medium", color: "warning" }, low: { label: "Low", color: "default" } };
const short = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : rupees(Math.round(n)));
const day = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** Sales pipeline (prospect tracker): open travel deals by stage, drag to move, with value, priority, close date and owner. */
const Pipeline = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [d, setD] = useState<any>(null);
    const [owner, setOwner] = useState("");
    const dragged = useRef<string | null>(null);
    const [over, setOver] = useState("");
    const edit = useDisclosure();
    const [deal, setDeal] = useState<any>(null);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/travel/pipeline${owner ? `?owner=${owner}` : ""}`);
        if (success) setD(data);
    }, [owner]);
    useEffect(() => { load(); }, [load]);

    const move = async (id: string, stage: string) => {
        setD((x: any) => ({ ...x, deals: x.deals.map((dl: any) => (dl.id === id ? { ...dl, stage } : dl)) }));
        const { success } = await commonPostAPICall({ stage, ...(stage === "lost" ? { lost_reason: "Lost in pipeline" } : {}) }, `travel/pipeline/${id}`);
        load();
        return success;
    };
    const save = async (close: () => void) => {
        const { success } = await commonPostAPICall({ deal_value: deal.value_edit === "" ? null : Number(deal.value_edit), priority: deal.priority, expected_close: deal.expected_close || null }, `travel/pipeline/${deal.id}`, true);
        // phones can not drag cards, so the stage is changed here too
        if (success && deal.stage_edit && deal.stage_edit !== deal.stage) await move(deal.id, deal.stage_edit);
        if (success) { close(); load(); }
    };
    const openDeal = (x: any) => { setDeal({ ...x, stage_edit: x.stage, value_edit: x.value_from === "set" ? String(x.value) : "" }); edit.onOpen(); };

    if (!d) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const s = d.stats;
    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Sales pipeline" sub="Every open travel deal by stage. Drag a card, or tap Edit / move, to change its stage. Booking a quote marks it won."
                actions={<>
                    <Select aria-label="Owner" size="sm" className="w-full sm:w-48" placeholder="Everyone" selectedKeys={owner ? [owner] : []} onChange={(e) => setOwner(e.target.value)}>
                        {d.team.map((t: any) => <SelectItem key={String(t.id)}>{t.name}</SelectItem>)}
                    </Select>
                    <Button color="primary" size="sm" startContent={<Plus size={14} />} onPress={() => navigate("/crm/leads?new=travel")}>New enquiry</Button>
                </>} />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
                <Tile label="Open pipeline" value={short(s.pipeline_value)} hint={`${s.open_deals} deals`} />
                <Tile label="Win rate (90 days)" value={`${s.win_rate}%`} hint={`${s.won_90} won · ${s.lost_90} lost`} />
                <Tile label="Average deal" value={short(s.avg_deal)} hint="Booked in the last 90 days" />
                <Tile label="Closing this month" value={s.closing_this_month} />
                <Tile label="Past close date" value={s.overdue_close} tone={s.overdue_close ? "danger" : undefined} />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:snap-none -mx-1 px-1">
                {[...d.stages, "lost"].map((stage: string) => {
                    const deals = stage === "lost" ? [] : d.deals.filter((x: any) => x.stage === stage);
                    const label = LEAD_STATUSES.find((l) => l.key === stage)?.label || stage;
                    const total = deals.reduce((a: number, x: any) => a + x.value, 0);
                    return (
                        <div key={stage} onDragOver={(e) => { e.preventDefault(); setOver(stage); }} onDragLeave={() => setOver("")}
                            onDrop={(e) => { e.preventDefault(); setOver(""); const id = dragged.current; dragged.current = null; if (id) move(id, stage); }}
                            className={`shrink-0 snap-start rounded-xl p-2 flex flex-col gap-2 ${stage === "lost" ? "hidden sm:flex bg-danger-50/60 border border-dashed border-danger-200 w-48" : "w-[82vw] max-w-72 sm:w-72 bg-default-100/70"} ${over === stage ? "ring-2 ring-primary" : ""}`}>
                            <div className="flex items-center justify-between px-1">
                                <span className="font-semibold text-sm">{stage === "lost" ? "Drop here: lost" : label}</span>
                                {stage !== "lost" && <span className="text-xs text-default-500">{deals.length} · {short(total)}</span>}
                            </div>
                            {deals.map((x: any) => (
                                <div key={x.id} draggable onDragStart={() => { dragged.current = x.id; }}
                                    className="rounded-lg bg-content1 border border-default-200 p-2.5 flex flex-col gap-1 cursor-grab active:cursor-grabbing shadow-sm">
                                    <div className="flex items-start gap-2">
                                        <button type="button" className="font-medium text-sm text-left flex-1 min-w-0 truncate hover:underline" onClick={() => navigate(`/crm/leads/${x.id}`)}>{x.name || "Unnamed"}</button>
                                        <Chip size="sm" variant="flat" color={PRIORITY[x.priority]?.color}>{PRIORITY[x.priority]?.label}</Chip>
                                    </div>
                                    <div className="text-xs text-default-500 truncate">{[x.destination, x.pax ? `${x.pax} pax` : "", x.travel_start ? day(x.travel_start) : ""].filter(Boolean).join(" · ") || "Trip details not set"}</div>
                                    <div className="flex items-center gap-2">
                                        <button type="button" className="font-semibold text-sm hover:underline" title={x.value_from === "quote" ? "From the latest quote" : x.value_from === "budget" ? "From the budget" : "Deal value"} onClick={() => openDeal(x)}>{x.value ? rupees(x.value) : "Set value"}</button>
                                        {x.value_from !== "set" && x.value > 0 && <span className="text-[10px] text-default-400">{x.value_from}</span>}
                                        {x.expected_close && <span className={`ml-auto text-[11px] flex items-center gap-1 ${x.expected_close < today ? "text-danger" : "text-default-500"}`}><CalendarClock size={11} />{day(x.expected_close)}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-default-500">
                                        <span className="truncate flex-1">{x.owner}</span>
                                        {x.phone && <a href={`https://wa.me/${x.phone}`} target="_blank" rel="noopener" className="text-success" aria-label="WhatsApp"><MessageCircle size={13} /></a>}
                                        <button type="button" className="text-primary py-1 px-1 -my-1" onClick={() => openDeal(x)}>Edit / move</button>
                                    </div>
                                </div>
                            ))}
                            {stage !== "lost" && !deals.length && <div className="text-xs text-default-400 px-1 py-4 text-center">No deals</div>}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={edit.isOpen} onOpenChange={edit.onOpenChange}>
                <ModalContent>{(close) => deal && (<>
                    <ModalHeader>{deal.name}</ModalHeader>
                    <ModalBody className="gap-3">
                        <Field label="Deal value ₹ (leave empty to use the latest quote or budget)"><Input aria-label="Deal value" type="number" min={0} value={deal.value_edit} onValueChange={(v) => setDeal((x: any) => ({ ...x, value_edit: v }))} /></Field>
                        <Field label="Stage"><Select aria-label="Stage" selectedKeys={[deal.stage_edit || deal.stage]} onChange={(e) => e.target.value && setDeal((x: any) => ({ ...x, stage_edit: e.target.value }))}>{[...d.stages, "lost"].map((st: string) => <SelectItem key={st}>{st === "lost" ? "Lost" : LEAD_STATUSES.find((l) => l.key === st)?.label || st}</SelectItem>)}</Select></Field>
                        <Field label="Priority"><Select aria-label="Priority" selectedKeys={[deal.priority]} onChange={(e) => setDeal((x: any) => ({ ...x, priority: e.target.value || "medium" }))}>{Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k}>{v.label}</SelectItem>)}</Select></Field>
                        <Field label="Expected close date"><Input aria-label="Expected close" type="date" value={deal.expected_close || ""} onValueChange={(v) => setDeal((x: any) => ({ ...x, expected_close: v }))} /></Field>
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" onPress={() => save(close)}>Save</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

export default Pipeline;
