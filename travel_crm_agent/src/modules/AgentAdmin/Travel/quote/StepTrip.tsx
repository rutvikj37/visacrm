import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem, Button, Input, Select, SelectItem } from "@heroui/react";
import { CalendarDays, Globe2, Home, Search, UserPlus, Users, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { Field } from "../travelShared";
import { Choice, Counter, Panel, useQuote } from "./QuoteContext";
import { INDIAN_STATES, nightsBetween } from "./quoteKit";

/** Step 1: where and when, the customer, and who is travelling. */
const StepTrip = () => {
    const { q, set, canEdit } = useQuote();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const trip = q.trip || {};
    const setTrip = (patch: Record<string, any>) => {
        const next = { ...trip, ...patch };
        const intl = next.destination_type === "international";
        set({ trip: next, is_international: intl, ...(patch.destination_type && intl !== q.is_international ? { tcs_percent: intl ? (q.tax_defaults?.tcs_overseas_percent ?? 0) : 0 } : {}) });
    };
    const nights = nightsBetween(trip.start_date, trip.end_date);

    // customer search / add
    const [mode, setMode] = useState<"pick" | "add">("pick");
    const [search, setSearch] = useState("");
    const [found, setFound] = useState<any[]>([]);
    const [form, setForm] = useState({ name: "", phone: "", email: "" });
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (q.lead || mode !== "pick") return;
        const h = setTimeout(async () => {
            const { success, data } = await commonGetAPICalls(`/travel/quotes/customers?search=${encodeURIComponent(search)}`);
            if (success) setFound(data);
        }, 250);
        return () => clearTimeout(h);
    }, [search, mode, q.lead]);

    const attach = async (body: any) => {
        setBusy(true);
        const { success, data } = await commonPostAPICall(body, `travel/quotes/${q.id}/customer`);
        setBusy(false);
        if (success && data) { set({ lead: data }); SuccessToast(`${data.name || "Customer"} added to the quote`); setForm({ name: "", phone: "", email: "" }); }
    };

    const travellers: any[] = q.travellers || [];
    const totalPax = (q.adults || 0) + (q.children || 0) + (q.infants || 0);

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
                <Panel title="Trip details" sub="Where the traveller is going and when">
                    <div className="flex flex-col gap-4">
                        <Field label="Destination type">
                            <Choice disabled={!canEdit} value={trip.destination_type === "international" ? "international" : "domestic"} onChange={(v) => setTrip({ destination_type: v })}
                                items={[{ key: "domestic", title: "Domestic", text: "Within India · GST, no TCS", icon: <Home size={15} className="text-default-500" /> }, { key: "international", title: "International", text: "Overseas · TCS may apply", icon: <Globe2 size={15} className="text-default-500" /> }]} />
                        </Field>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {trip.destination_type === "international"
                                ? <Field label="Country"><Input aria-label="Country" isDisabled={!canEdit} placeholder="e.g. Thailand" value={trip.country || ""} onValueChange={(v) => setTrip({ country: v })} /></Field>
                                : <Field label="State of travel">
                                    <Autocomplete aria-label="State of travel" isDisabled={!canEdit} placeholder="Select state…" selectedKey={trip.state || null} defaultItems={INDIAN_STATES.map((s) => ({ key: s }))}
                                        onSelectionChange={(k) => setTrip({ state: k ? String(k) : null })}>
                                        {(s: any) => <AutocompleteItem key={s.key}>{s.key}</AutocompleteItem>}
                                    </Autocomplete>
                                </Field>}
                            <Field label="Place of travel"><Input aria-label="Place of travel" isDisabled={!canEdit} placeholder={trip.destination_type === "international" ? "e.g. Phuket, Krabi" : "e.g. Manali, Kasol"} value={trip.place || ""} onValueChange={(v) => setTrip({ place: v })} /></Field>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-default-600 mb-1">Travel dates <span className="text-danger">*</span></div>
                            <div className="grid grid-cols-2 rounded-xl border border-default-200 overflow-hidden">
                                <label className="p-3 border-r border-default-200">
                                    <span className="block text-[10px] font-semibold tracking-wide text-default-500 uppercase">Departure</span>
                                    <input type="date" disabled={!canEdit} value={trip.start_date || ""} onChange={(e) => setTrip({ start_date: e.target.value || null, ...(trip.end_date && e.target.value > trip.end_date ? { end_date: e.target.value } : {}) })} className="w-full bg-transparent text-sm font-medium outline-none mt-0.5" />
                                </label>
                                <label className="p-3">
                                    <span className="block text-[10px] font-semibold tracking-wide text-default-500 uppercase">Return</span>
                                    <input type="date" disabled={!canEdit} min={trip.start_date || undefined} value={trip.end_date || ""} onChange={(e) => setTrip({ end_date: e.target.value || null })} className="w-full bg-transparent text-sm font-medium outline-none mt-0.5" />
                                </label>
                            </div>
                            {trip.start_date && trip.end_date && <div className="text-xs text-default-500 mt-1.5 flex items-center gap-1"><CalendarDays size={13} /> {nights} night{nights === 1 ? "" : "s"} · {nights + 1} day{nights ? "s" : ""}</div>}
                        </div>
                    </div>
                </Panel>

                <Panel title={<>Customer <span className="text-danger">*</span></>} sub="Who this quote is for">
                    {q.lead ? (
                        <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/60 dark:bg-primary/10 p-3">
                            <span className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">{String(q.lead.name || "?").split(" ").map((x: string) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{q.lead.name}</div>
                                <div className="text-xs text-default-500 truncate">{[q.lead.phone, q.lead.email].filter(Boolean).join(" · ")}</div>
                            </div>
                            {canEdit && q.status !== "accepted" && <Button size="sm" variant="light" startContent={<X size={14} />} onPress={() => set({ lead: null })}>Change</Button>}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="inline-flex rounded-xl bg-default-100 p-1 self-start">
                                <button type="button" onClick={() => setMode("pick")} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${mode === "pick" ? "bg-content1 shadow-sm font-medium" : "text-default-600"}`}><Search size={14} /> Existing customer</button>
                                <button type="button" onClick={() => setMode("add")} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${mode === "add" ? "bg-content1 shadow-sm font-medium" : "text-default-600"}`}><UserPlus size={14} /> New customer</button>
                            </div>
                            {mode === "pick" ? (
                                <>
                                    <Input aria-label="Search customers" isDisabled={!canEdit} placeholder="Search by name, phone or email" startContent={<Search size={15} />} value={search} onValueChange={setSearch} />
                                    <div className="flex flex-col divide-y divide-default-100 rounded-xl border border-default-200 max-h-64 overflow-y-auto">
                                        {found.length ? found.map((c) => (
                                            <button key={c.id} type="button" disabled={!canEdit || busy} onClick={() => attach({ lead_id: c.id })} className="flex items-center gap-3 p-2.5 text-left hover:bg-default-50">
                                                <span className="h-8 w-8 rounded-full bg-default-100 grid place-items-center text-xs font-semibold">{String(c.name || "?").slice(0, 1).toUpperCase()}</span>
                                                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{c.name || "No name"}</div><div className="text-xs text-default-500 truncate">{[c.phone, c.email, c.city].filter(Boolean).join(" · ")}</div></div>
                                                <span className="text-xs text-primary">Select</span>
                                            </button>
                                        )) : <div className="p-4 text-sm text-default-500 text-center">No customers found. <button type="button" className="text-primary underline" onClick={() => setMode("add")}>Add a new one</button></div>}
                                    </div>
                                </>
                            ) : (
                                <div className="grid sm:grid-cols-3 gap-3">
                                    <Field label="Full name *"><Input aria-label="Full name" isDisabled={!canEdit} value={form.name} onValueChange={(v) => setForm((f) => ({ ...f, name: v }))} /></Field>
                                    <Field label="Phone *"><Input aria-label="Phone" isDisabled={!canEdit} type="tel" placeholder="98765 43210" value={form.phone} onValueChange={(v) => setForm((f) => ({ ...f, phone: v }))} /></Field>
                                    <Field label="Email"><Input aria-label="Email" isDisabled={!canEdit} type="email" value={form.email} onValueChange={(v) => setForm((f) => ({ ...f, email: v }))} /></Field>
                                    <div className="sm:col-span-3"><Button color="primary" isLoading={busy} isDisabled={!canEdit || !form.name.trim() || (!form.phone.trim() && !form.email.trim())} startContent={<UserPlus size={15} />} onPress={() => attach(form)}>Add customer</Button>
                                        <span className="text-xs text-default-500 ml-3">Saved as a travel lead, so it shows in your CRM too.</span></div>
                                </div>
                            )}
                        </div>
                    )}
                </Panel>
            </div>

            <div className="flex flex-col gap-4">
                <Panel title="Travellers" sub={`${totalPax} total`}>
                    <div className="flex flex-col gap-2">
                        <Counter label="Adults" hint="12+ yrs" min={1} disabled={!canEdit} value={q.adults || 0} onChange={(n) => set({ adults: n })} />
                        <Counter label="Children" hint="2–12 yrs" disabled={!canEdit} value={q.children || 0} onChange={(n) => set({ children: n })} />
                        <Counter label="Infants" hint="0–2 yrs" disabled={!canEdit} value={q.infants || 0} onChange={(n) => set({ infants: n })} />
                    </div>
                </Panel>
                <Panel title="Traveller names" sub="Optional · used on vouchers later" right={<Users size={16} className="text-default-400" />}>
                    <div className="flex flex-col gap-2">
                        {travellers.map((tr, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <Input aria-label="Name" size="sm" isDisabled={!canEdit} placeholder="Name as on ID" value={tr.name || ""} onValueChange={(v) => set({ travellers: travellers.map((x, j) => (j === i ? { ...x, name: v } : x)) })} />
                                <Select aria-label="Type" size="sm" className="w-28 shrink-0" isDisabled={!canEdit} selectedKeys={[tr.pax_type || "adult"]} onChange={(e) => set({ travellers: travellers.map((x, j) => (j === i ? { ...x, pax_type: e.target.value || "adult" } : x)) })}>
                                    <SelectItem key="adult">Adult</SelectItem><SelectItem key="child">Child</SelectItem><SelectItem key="infant">Infant</SelectItem>
                                </Select>
                                {canEdit && <Button isIconOnly size="sm" variant="light" aria-label="Remove" onPress={() => set({ travellers: travellers.filter((_, j) => j !== i) })}><X size={14} /></Button>}
                            </div>
                        ))}
                        {canEdit && travellers.length < Math.max(totalPax, 1) && <Button size="sm" variant="flat" onPress={() => set({ travellers: [...travellers, { name: travellers.length === 0 ? q.lead?.name || "" : "", pax_type: "adult" }] })}>Add a name</Button>}
                    </div>
                </Panel>
            </div>
        </div>
    );
};

export default StepTrip;
