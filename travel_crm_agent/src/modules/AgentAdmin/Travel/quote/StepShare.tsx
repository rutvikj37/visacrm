import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/react";
import { CheckCircle2, Copy, FileDown, Link2, MessageCircle, PartyPopper, Send, XCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { Field, apiBase, fmtDate, rupees } from "../travelShared";
import { useOpenPdf, useSendWhatsapp } from "../travelActions";
import { Panel, ServiceIcon, useQuote } from "./QuoteContext";
import { describe, serviceDef } from "./quoteKit";

/** Step 7: PDF, WhatsApp, web link, then book it when the customer says yes. */
const StepShare = () => {
    const { q, t, lines, options, oi, save, reload } = useQuote();
    const navigate = useNavigate();
    const { commonPostAPICall } = useApiCallUtils();
    const openPdf = useOpenPdf();
    const sendWa = useSendWhatsapp();
    const bookModal = useDisclosure();
    const [dates, setDates] = useState({ start_date: q.trip?.start_date || "", end_date: q.trip?.end_date || "" });
    const [busy, setBusy] = useState("");
    const closed = ["accepted", "superseded"].includes(q.status);
    const first = String(q.lead?.name || "").split(" ")[0];

    const shareLink = async () => {
        if (!q.itinerary?.id) return "";
        const { success, data } = await commonPostAPICall({}, `travel/itineraries/${q.itinerary.id}/share`);
        return success ? data.url || `${apiBase()}/v1/public/travel/itinerary/${data.token}` : "";
    };
    const status = async (s: string) => {
        const { success } = await commonPostAPICall({ status: s }, `travel/quotes/${q.id}/status`, true);
        if (success) await reload();
    };
    const whatsapp = async () => {
        setBusy("wa");
        if (!(await save())) { setBusy(""); return; }
        const link = await shareLink();
        const opts = options.length > 1 ? options.map((o, i) => `${o.name}: ${rupees(Math.round(i === oi ? t.total : q.options?.[i]?.totals?.total || 0))}`).join("\n") : `Total: ${rupees(Math.round(t.total))}`;
        const text = `Hi ${first}, here is your quote for ${q.title}${q.trip?.start_date ? ` (${fmtDate(q.trip.start_date)}${q.trip.end_date ? ` – ${fmtDate(q.trip.end_date)}` : ""})` : ""}:\n${opts}\nPrices include GST${t.tcs > 0 ? " and TCS" : ""}.${q.valid_until ? ` Valid until ${fmtDate(q.valid_until)}.` : ""}${link ? `\nDay-wise plan: ${link}` : ""}`;
        await sendWa({ to: q.lead?.phone, lead_id: q.lead?.id, trigger: "quote_sent", vars: { name: first, trip: q.title, total: rupees(Math.round(t.total)), link }, text });
        if (q.status === "draft") await status("sent");
        setBusy("");
    };
    const copyLink = async () => {
        setBusy("link");
        const link = await shareLink();
        setBusy("");
        if (link) { await navigator.clipboard.writeText(link); SuccessToast("Link copied"); }
    };
    const book = async () => {
        setBusy("book");
        if (!(await save())) { setBusy(""); return; }
        const { success, data } = await commonPostAPICall({ option: oi, ...dates }, `travel/quotes/${q.id}/book`, true);
        setBusy("");
        if (success && data?.id) navigate(`/travel/bookings/${data.id}`);
    };
    const newVersion = async () => {
        const { success, data } = await commonPostAPICall({}, `travel/quotes/${q.id}/version`, true);
        if (success && data?.id) navigate(`/travel/quotes/${data.id}?step=1`);
    };

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-4">
                {q.booking ? (
                    <div className="rounded-2xl border border-success-200 bg-success-50 dark:bg-success/10 p-5 flex items-center gap-4">
                        <PartyPopper className="text-success" size={28} />
                        <div className="flex-1"><div className="font-semibold">Booked as {q.booking.booking_no}</div><div className="text-sm text-default-600">Confirm suppliers, collect payments and send vouchers from the booking.</div></div>
                        <Button color="success" variant="flat" onPress={() => navigate(`/travel/bookings/${q.booking.id}`)}>Open booking</Button>
                    </div>
                ) : (
                    <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-600 text-primary-foreground p-5 sm:p-6 shadow-sm">
                        <div className="text-xs uppercase tracking-widest opacity-80">Ready to send</div>
                        <div className="text-2xl font-bold mt-1">{q.title}</div>
                        <div className="text-sm opacity-90 mt-1">{[q.lead?.name, q.trip?.place, q.trip?.start_date && `${fmtDate(q.trip.start_date)}${q.trip.end_date ? ` – ${fmtDate(q.trip.end_date)}` : ""}`].filter(Boolean).join(" · ")}</div>
                        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
                            <div><div className="text-xs opacity-80">Total payable</div><div className="text-3xl font-bold tabular-nums">{rupees(Math.round(t.total))}</div><div className="text-xs opacity-80">{rupees(Math.round(t.per_person))} per person · incl. GST{t.tcs > 0 ? " & TCS" : ""}</div></div>
                            {q.valid_until && <div className="text-xs opacity-90">Valid until {fmtDate(q.valid_until)}</div>}
                        </div>
                    </div>
                )}

                <Panel title="Share with the customer">
                    <div className="grid sm:grid-cols-3 gap-3">
                        <ShareTile icon={<MessageCircle size={20} />} title="Send on WhatsApp" text={q.lead?.phone ? `To ${q.lead.phone}` : "Pick a chat"} tone="text-success" busy={busy === "wa"} onPress={whatsapp} />
                        <ShareTile icon={<FileDown size={20} />} title="Download PDF" text="Branded quotation" tone="text-primary" onPress={async () => { if (await save()) openPdf(`travel/quotes/${q.id}/pdf`); }} />
                        <ShareTile icon={<Link2 size={20} />} title="Copy web link" text={q.itinerary?.id ? "Day-wise plan page" : "Build the itinerary first"} tone="text-secondary" busy={busy === "link"} disabled={!q.itinerary?.id} onPress={copyLink} />
                    </div>
                </Panel>

                <Panel title="What the customer gets" sub={`${lines.length} service${lines.length === 1 ? "" : "s"}${options.length > 1 ? ` · ${options.length} options` : ""}`}>
                    <div className="divide-y divide-default-100">
                        {lines.map((l, i) => (
                            <div key={i} className="flex items-center gap-3 py-2"><ServiceIcon type={l.service_type} size={12} /><span className="text-sm flex-1 truncate">{l.details?.wording || describe(l) || serviceDef(l.service_type).label}</span></div>
                        ))}
                    </div>
                </Panel>
            </div>

            <div className="flex flex-col gap-4">
                <Panel title="Next steps">
                    <div className="flex flex-col gap-2">
                        {!closed && <Button color="primary" size="lg" startContent={<CheckCircle2 size={18} />} onPress={bookModal.onOpen}>Customer said yes - book it</Button>}
                        {q.status === "draft" && <Button variant="flat" startContent={<Send size={16} />} onPress={() => status("sent")}>Mark as sent</Button>}
                        <Button variant="flat" startContent={<Copy size={16} />} onPress={newVersion}>Make a new version</Button>
                        {!closed && q.status !== "rejected" && <Button variant="light" color="danger" startContent={<XCircle size={16} />} onPress={() => status("rejected")}>Mark as lost</Button>}
                        {q.status === "rejected" && <Button variant="light" onPress={() => status("draft")}>Reopen quote</Button>}
                    </div>
                </Panel>
                {q.versions?.length > 1 && (
                    <Panel title="Versions">
                        <div className="flex flex-wrap gap-2">
                            {q.versions.map((v: any) => <button key={v.id} type="button" onClick={() => navigate(`/travel/quotes/${v.id}`)} className={`px-3 py-1 rounded-full text-sm border ${v.id === q.id ? "bg-primary text-primary-foreground border-primary" : "border-default-200"}`}>v{v.version}</button>)}
                        </div>
                    </Panel>
                )}
            </div>

            <Modal isOpen={bookModal.isOpen} onOpenChange={bookModal.onOpenChange}>
                <ModalContent>
                    {(close) => (<>
                        <ModalHeader>Book {options.length > 1 ? `“${options[oi]?.name}”` : "this quote"}</ModalHeader>
                        <ModalBody className="gap-3">
                            <p className="text-sm text-default-600">Creates a booking with each service, marks the lead as won and opens it so operations can confirm with suppliers.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Travel starts"><Input aria-label="Travel starts" type="date" value={dates.start_date} onValueChange={(v) => setDates((d) => ({ ...d, start_date: v }))} /></Field>
                                <Field label="Travel ends"><Input aria-label="Travel ends" type="date" value={dates.end_date} onValueChange={(v) => setDates((d) => ({ ...d, end_date: v }))} /></Field>
                            </div>
                        </ModalBody>
                        <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" isLoading={busy === "book"} onPress={book}>Create booking</Button></ModalFooter>
                    </>)}
                </ModalContent>
            </Modal>
        </div>
    );
};

const ShareTile = ({ icon, title, text, tone, onPress, busy, disabled }: { icon: any; title: string; text: string; tone: string; onPress: () => void; busy?: boolean; disabled?: boolean }) => (
    <button type="button" disabled={disabled || busy} onClick={onPress} className="flex flex-col items-start gap-2 rounded-2xl border border-default-200 p-4 text-left hover:border-primary hover:shadow-sm transition-all disabled:opacity-50 disabled:hover:border-default-200">
        <span className={tone}>{icon}</span>
        <span className="font-medium text-sm">{busy ? "Working…" : title}</span>
        <span className="text-xs text-default-500">{text}</span>
    </button>
);

export default StepShare;
