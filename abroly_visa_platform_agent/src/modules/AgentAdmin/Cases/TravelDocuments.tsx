import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Input, Spinner, Switch, Textarea } from "@heroui/react";
import { CalendarRange, FileSignature, Plane, Plus, Printer, Save, Sparkles, Trash2, Wallet } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { longDate, printCoverLetter, printItinerary, type PrintAgency } from "./travelPrint";

/**
 * Tourist / business visa tools on the case page: trip + day-by-day itinerary, cover letter and a funds check.
 * Saved on the case (POST /crm/cases/:id/travel_docs). "Share with client" shows them in the client portal.
 */

type Day = { date: string; city: string; plan: string; stay: string };
type Docs = {
    trip: { purpose: string; destination: string; from_city: string; start_date: string; end_date: string; travellers: { name: string; passport_no: string; relation: string }[]; host: string };
    itinerary: Day[];
    flights: { date: string; from: string; to: string; flight: string }[];
    cover_letter: { kind: "tourist" | "business"; addressed_to: string; subject: string; body: string; signed_by: string };
    funds: { country_key: string; days: number; balance: number; trip_cost: number; sponsor: string };
    shared: boolean;
    updated_at?: string;
};

const EMPTY: Docs = {
    trip: { purpose: "tourism", destination: "", from_city: "", start_date: "", end_date: "", travellers: [{ name: "", passport_no: "", relation: "Self" }], host: "" },
    itinerary: [], flights: [],
    cover_letter: { kind: "tourist", addressed_to: "", subject: "", body: "", signed_by: "" },
    funds: { country_key: "schengen", days: 0, balance: 0, trip_cost: 0, sponsor: "" },
    shared: false,
};

// ready-made day plans: [city, plan, stay] per day
const SAMPLES: Record<string, { label: string; destination: string; days: [string, string, string][] }> = {
    switzerland: { label: "Switzerland - 7 days", destination: "Switzerland", days: [
        ["Zurich", "Arrive Zurich. Check in, evening walk at Bahnhofstrasse and Lake Zurich.", "Hotel in Zurich"],
        ["Lucerne", "Train to Lucerne. Chapel Bridge, Old Town, Lake Lucerne cruise.", "Hotel in Lucerne"],
        ["Lucerne", "Day trip to Mount Titlis (Engelberg).", "Hotel in Lucerne"],
        ["Interlaken", "Train to Interlaken. Harder Kulm viewpoint.", "Hotel in Interlaken"],
        ["Interlaken", "Day trip to Jungfraujoch - Top of Europe.", "Hotel in Interlaken"],
        ["Geneva", "Train to Geneva. Jet d'Eau, Old Town, United Nations office.", "Hotel in Geneva"],
        ["Geneva", "Check out and fly back to India.", "-"],
    ] },
    france_italy: { label: "France + Italy - 8 days", destination: "France and Italy (Schengen)", days: [
        ["Paris", "Arrive Paris. Check in, Seine river cruise in the evening.", "Hotel in Paris"],
        ["Paris", "Eiffel Tower, Louvre Museum, Champs-Elysees.", "Hotel in Paris"],
        ["Paris", "Day trip to Versailles Palace.", "Hotel in Paris"],
        ["Rome", "Fly Paris to Rome. Colosseum and Roman Forum.", "Hotel in Rome"],
        ["Rome", "Vatican Museums, St. Peter's Basilica, Trevi Fountain.", "Hotel in Rome"],
        ["Florence", "Train to Florence. Duomo, Ponte Vecchio, Uffizi Gallery.", "Hotel in Florence"],
        ["Venice", "Train to Venice. Gondola ride, St. Mark's Square.", "Hotel in Venice"],
        ["Venice", "Check out and fly back to India.", "-"],
    ] },
    london: { label: "United Kingdom - 6 days", destination: "United Kingdom", days: [
        ["London", "Arrive London Heathrow. Check in, walk along the Thames.", "Hotel in London"],
        ["London", "Tower of London, Tower Bridge, London Eye.", "Hotel in London"],
        ["London", "Buckingham Palace, Westminster Abbey, British Museum.", "Hotel in London"],
        ["Edinburgh", "Train to Edinburgh. Edinburgh Castle and Royal Mile.", "Hotel in Edinburgh"],
        ["Edinburgh", "Day tour of the Scottish Highlands.", "Hotel in Edinburgh"],
        ["London", "Train back to London and fly to India.", "-"],
    ] },
    dubai: { label: "Dubai - 5 days", destination: "Dubai, UAE", days: [
        ["Dubai", "Arrive Dubai. Check in, Dubai Marina dhow cruise dinner.", "Hotel in Dubai"],
        ["Dubai", "Burj Khalifa, Dubai Mall and fountain show.", "Hotel in Dubai"],
        ["Dubai", "Desert safari with BBQ dinner.", "Hotel in Dubai"],
        ["Abu Dhabi", "Day trip to Abu Dhabi - Sheikh Zayed Mosque, Ferrari World.", "Hotel in Dubai"],
        ["Dubai", "Gold and spice souk shopping, fly back to India.", "-"],
    ] },
    usa: { label: "USA East Coast - 7 days", destination: "USA", days: [
        ["New York", "Arrive JFK. Check in, Times Square in the evening.", "Hotel in New York"],
        ["New York", "Statue of Liberty, Wall Street, 9/11 Memorial.", "Hotel in New York"],
        ["New York", "Central Park, Metropolitan Museum, Empire State Building.", "Hotel in New York"],
        ["Washington DC", "Bus to Washington DC. Capitol, Lincoln Memorial.", "Hotel in Washington DC"],
        ["Washington DC", "Smithsonian museums, White House (outside).", "Hotel in Washington DC"],
        ["Niagara Falls", "Fly to Buffalo, Niagara Falls - Maid of the Mist.", "Hotel near Niagara Falls"],
        ["New York", "Return to New York and fly back to India.", "-"],
    ] },
    business: { label: "Business trip - 4 days", destination: "", days: [
        ["", "Arrive. Check in near the client's office.", "Business hotel"],
        ["", "Meetings at the host company's office (10:00 - 17:00).", "Business hotel"],
        ["", "Trade fair / factory visit and product discussions.", "Business hotel"],
        ["", "Wrap-up meeting, fly back to India.", "-"],
    ] },
};

// guide amounts only (agencies adjust); [label, currency, per day, approx INR per unit]
const FUNDS_GUIDE: Record<string, [string, string, number, number]> = {
    schengen: ["Schengen (general guide)", "EUR", 100, 90],
    switzerland: ["Switzerland", "CHF", 100, 95],
    uk: ["United Kingdom", "GBP", 100, 107],
    usa: ["USA", "USD", 150, 84],
    canada: ["Canada", "CAD", 150, 61],
    australia: ["Australia", "AUD", 150, 55],
    uae: ["Dubai / UAE", "AED", 350, 23],
};

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => (a && b ? Math.max(1, Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000) + 1) : 0);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const PURPOSES = [["tourism", "Tourism / holiday"], ["business", "Business meetings"], ["conference", "Conference / trade fair"], ["family", "Visiting family"]];

const writeLetter = (d: Docs, ctx: { client: string; country: string; visaType: string }): Docs["cover_letter"] => {
    const t = d.trip;
    const name = t.travellers[0]?.name || ctx.client || "[Applicant name]";
    const passport = t.travellers[0]?.passport_no || "[passport number]";
    const dest = t.destination || ctx.country || "[destination]";
    const dates = t.start_date ? `from ${longDate(t.start_date)} to ${longDate(t.end_date)} (${daysBetween(t.start_date, t.end_date)} days)` : "[travel dates]";
    const cities = [...new Set(d.itinerary.map((x) => x.city).filter(Boolean))];
    const others = t.travellers.slice(1).filter((x) => x.name);
    const business = d.cover_letter.kind === "business" || t.purpose === "business" || t.purpose === "conference";
    const visa = ctx.visaType || (business ? "Business Visa" : "Tourist Visa");
    const addressed_to = d.cover_letter.addressed_to || `The Visa Officer\nEmbassy / Consulate of ${ctx.country || dest}\nNew Delhi`;
    if (business) {
        return {
            kind: "business", addressed_to,
            subject: `${visa} for ${name} - business visit ${dates}`,
            body: [
                "Respected Sir / Madam,",
                `We request you to kindly grant a ${visa} to our employee ${name} (passport no. ${passport}), who will travel to ${dest} ${dates} to ${t.purpose === "conference" ? "attend a conference / trade fair" : "attend business meetings"}${t.host ? ` with ${t.host.split("\n")[0]}` : ""}.`,
                cities.length ? `During the visit ${name.split(" ")[0]} will be in ${cities.join(", ")}. The detailed itinerary, the invitation letter, flight reservation and hotel bookings are enclosed.` : "The invitation letter, itinerary, flight reservation and hotel bookings are enclosed.",
                `All expenses of the trip - travel, stay, insurance and daily expenses - will be borne by our company. ${name.split(" ")[0]} is a permanent employee and will return to India after the visit to continue their duties.`,
                "We confirm that the purpose of this visit is business only and no paid work will be done in the destination country. Please find our company registration, bank statements and income tax returns enclosed.",
                "Thank you for your consideration.",
            ].join("\n\n"),
            signed_by: d.cover_letter.signed_by || "For [Company name]\n\n\nAuthorised signatory\n[Name, designation]\n[Phone, email]",
        };
    }
    return {
        kind: "tourist", addressed_to,
        subject: `Application for a ${visa} ${dates}`,
        body: [
            "Respected Sir / Madam,",
            `I, ${name}, holder of Indian passport no. ${passport}, am applying for a ${visa} to visit ${dest} ${dates} for ${t.purpose === "family" ? "visiting my family" : "tourism"}.${others.length ? ` I will be travelling with ${others.map((x) => `${x.name}${x.relation ? ` (${x.relation.toLowerCase()})` : ""}`).join(", ")}.` : ""}`,
            cities.length ? `During the trip I plan to visit ${cities.join(", ")}. My day-by-day itinerary, return flight reservation, hotel bookings and travel insurance are enclosed.` : "My itinerary, return flight reservation, hotel bookings and travel insurance are enclosed.",
            `All the expenses of this trip will be borne by ${d.funds.sponsor ? d.funds.sponsor : "me"}. My bank statements for the last six months and income tax returns for the last three years are enclosed as proof of funds.`,
            "I have strong family, professional and financial ties in India. I will return to India at the end of my trip to resume my work, and I will follow all the rules and conditions of the visa.",
            "I request you to kindly grant me the visa. Thank you for your time and consideration.",
        ].join("\n\n"),
        signed_by: d.cover_letter.signed_by || `Yours sincerely,\n\n\n${name}\n${others.length ? "" : ""}`,
    };
};

const Section = ({ icon: Icon, title, hint, right, children }: { icon: any; title: string; hint?: string; right?: ReactNode; children: ReactNode }) => (
    <div className="rounded-xl border border-default-200 bg-content1 p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-2">
            <Icon size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                {hint && <div className="text-xs text-default-500">{hint}</div>}
            </div>
            {right}
        </div>
        {children}
    </div>
);

/** Label above the field (same pattern as the rest of the panel). */
const L = ({ t, className = "", children }: { t: ReactNode; className?: string; children: ReactNode }) => (
    <label className={`flex flex-col gap-1 text-xs text-default-600 min-w-0 ${className}`}>{t}{children}</label>
);

const sel = "rounded-lg border-2 border-default-200 bg-transparent px-2 h-10 text-sm text-foreground min-w-0";

const TravelDocuments = ({ caseId }: { caseId: string }) => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [docs, setDocs] = useState<Docs | null>(null);
    const [ctx, setCtx] = useState<{ client: string; country: string; visaType: string; agency: PrintAgency }>({ client: "", country: "", visaType: "", agency: {} });
    const [tab, setTab] = useState<"itinerary" | "letter" | "funds">("itinerary");
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls(`/crm/cases/${caseId}/travel_docs`);
            if (!success) return;
            const client = data?.client?.name || "";
            const base: Docs = data?.docs ? { ...EMPTY, ...data.docs, trip: { ...EMPTY.trip, ...data.docs.trip }, cover_letter: { ...EMPTY.cover_letter, ...data.docs.cover_letter }, funds: { ...EMPTY.funds, ...data.docs.funds } } : {
                ...EMPTY,
                trip: { ...EMPTY.trip, destination: data?.country || "", travellers: [{ name: client, passport_no: "", relation: "Self" }], purpose: /business/i.test(data?.visa_type || "") ? "business" : "tourism" },
                cover_letter: { ...EMPTY.cover_letter, kind: /business/i.test(data?.visa_type || "") ? "business" : "tourist" },
            };
            if (!base.trip.travellers.length) base.trip.travellers = [{ name: client, passport_no: "", relation: "Self" }];
            setDocs(base);
            setCtx({ client, country: data?.country || "", visaType: data?.visa_type || "", agency: data?.agency || {} });
        })();
    }, [caseId]);

    const tripDays = useMemo(() => (docs ? daysBetween(docs.trip.start_date, docs.trip.end_date) : 0), [docs?.trip.start_date, docs?.trip.end_date]);

    if (!docs) return <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center gap-2 py-10"><Spinner size="sm" /><span className="text-sm text-default-500">Loading travel documents…</span></div>;

    const update = (fn: (d: Docs) => Docs) => { setDocs((d) => (d ? fn(d) : d)); setDirty(true); };
    const setTrip = (k: keyof Docs["trip"], v: any) => update((d) => ({ ...d, trip: { ...d.trip, [k]: v } }));
    const setDay = (i: number, k: keyof Day, v: string) => update((d) => ({ ...d, itinerary: d.itinerary.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
    const setLetter = (k: keyof Docs["cover_letter"], v: string) => update((d) => ({ ...d, cover_letter: { ...d.cover_letter, [k]: v } }));
    const setFunds = (k: keyof Docs["funds"], v: any) => update((d) => ({ ...d, funds: { ...d.funds, [k]: v } }));

    const fillDays = () => update((d) => {
        if (!d.trip.start_date || !d.trip.end_date) return d;
        const n = Math.min(60, daysBetween(d.trip.start_date, d.trip.end_date));
        return { ...d, itinerary: Array.from({ length: n }, (_, i) => ({ ...(d.itinerary[i] || { city: "", plan: "", stay: "" }), date: addDays(d.trip.start_date, i) })) };
    });
    const useSample = (key: string) => {
        const s = SAMPLES[key]; if (!s) return;
        update((d) => {
            const start = d.trip.start_date || addDays(new Date().toISOString().slice(0, 10), 30);
            const dest = s.destination || d.trip.destination;
            return {
                ...d,
                trip: { ...d.trip, start_date: start, end_date: addDays(start, s.days.length - 1), destination: dest || d.trip.destination, purpose: key === "business" ? "business" : d.trip.purpose },
                itinerary: s.days.map(([city, plan, stay], i) => ({ date: addDays(start, i), city: city || (d.itinerary[i]?.city || ""), plan, stay })),
            };
        });
    };

    const save = async (overrides?: Partial<Docs>) => {
        setSaving(true);
        const body = { ...docs, ...overrides };
        const { success, data } = await commonPostAPICall({ docs: body }, `crm/cases/${caseId}/travel_docs`, true);
        setSaving(false);
        if (success) { setDocs((d) => (d ? { ...d, ...overrides, updated_at: data?.docs?.updated_at } : d)); setDirty(false); }
    };

    const guide = FUNDS_GUIDE[docs.funds.country_key] || FUNDS_GUIDE.schengen;
    const fundDays = docs.funds.days || tripDays || 0;
    const people = Math.max(1, docs.trip.travellers.filter((x) => x.name.trim()).length);
    const living = fundDays * people * guide[2] * guide[3];
    const needed = living + (Number(docs.funds.trip_cost) || 0);
    const balance = Number(docs.funds.balance) || 0;
    const ratio = needed ? balance / needed : 0;
    const verdict = !needed || !balance ? null : ratio >= 1.5 ? "strong" : ratio >= 1 ? "ok" : "low";

    const TabBtn = ({ k, icon: Icon, label }: { k: typeof tab; icon: any; label: string }) => (
        <button type="button" onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary text-primary-foreground" : "text-default-600 hover:bg-default-100"}`}>
            <Icon size={15} /> {label}
        </button>
    );

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Travel documents</h2>
                    <p className="text-xs text-default-500">Itinerary, cover letter and funds check for this {ctx.visaType || "visa"} file{docs.updated_at ? ` · saved ${new Date(docs.updated_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Switch size="sm" isSelected={docs.shared} onValueChange={(v) => save({ shared: v })}>
                        <span className="text-xs">Share with client</span>
                    </Switch>
                    <Button size="sm" color="primary" startContent={<Save size={15} />} isLoading={saving} onPress={() => save()} variant={dirty ? "solid" : "flat"}>{dirty ? "Save changes" : "Saved"}</Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl border border-default-200 bg-content1 p-1 w-fit max-w-full">
                <TabBtn k="itinerary" icon={CalendarRange} label="Itinerary" />
                <TabBtn k="letter" icon={FileSignature} label="Cover letter" />
                <TabBtn k="funds" icon={Wallet} label="Funds check" />
            </div>

            {tab === "itinerary" && (
                <>
                    <Section icon={Plane} title="Trip" hint="Basic details used in the itinerary and the cover letter.">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <label className="flex flex-col gap-1 text-xs text-default-600">Purpose
                                <select className={sel} value={docs.trip.purpose} onChange={(e) => setTrip("purpose", e.target.value)}>{PURPOSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                            </label>
                            <L t={"Destination"}><Input size="sm" aria-label="Destination" value={docs.trip.destination} onValueChange={(v) => setTrip("destination", v)} /></L>
                            <L t={"From"}><Input size="sm" type="date" aria-label="From" value={docs.trip.start_date} onValueChange={(v) => setTrip("start_date", v)} /></L>
                            <L t={"To"}><Input size="sm" type="date" aria-label="To" value={docs.trip.end_date} onValueChange={(v) => setTrip("end_date", v)} /></L>
                            <L t={"Departure city"}><Input size="sm" aria-label="Departure city" value={docs.trip.from_city} onValueChange={(v) => setTrip("from_city", v)} /></L>
                            <L t={docs.trip.purpose === "business" || docs.trip.purpose === "conference" ? "Company / event visiting (name, address)" : "Host / contact abroad (optional)"} className="sm:col-span-1 lg:col-span-3"><Input size="sm" aria-label="Field" value={docs.trip.host} onValueChange={(v) => setTrip("host", v)} /></L>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="text-xs font-medium text-default-600">Travellers</div>
                            {docs.trip.travellers.map((tr, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                                    <Input size="sm" aria-label="Name" placeholder="Full name (as in passport)" value={tr.name} onValueChange={(v) => setTrip("travellers", docs.trip.travellers.map((x, j) => (j === i ? { ...x, name: v } : x)))} className="col-span-2 sm:col-span-1" />
                                    <Input size="sm" aria-label="Passport number" placeholder="Passport no." value={tr.passport_no} onValueChange={(v) => setTrip("travellers", docs.trip.travellers.map((x, j) => (j === i ? { ...x, passport_no: v.toUpperCase() } : x)))} />
                                    <Input size="sm" aria-label="Relation" placeholder="Relation" value={tr.relation} onValueChange={(v) => setTrip("travellers", docs.trip.travellers.map((x, j) => (j === i ? { ...x, relation: v } : x)))} />
                                    <Button isIconOnly size="sm" variant="light" aria-label="Remove traveller" isDisabled={docs.trip.travellers.length === 1} onPress={() => setTrip("travellers", docs.trip.travellers.filter((_, j) => j !== i))}><Trash2 size={15} /></Button>
                                </div>
                            ))}
                            <Button size="sm" variant="flat" className="w-fit" startContent={<Plus size={14} />} onPress={() => setTrip("travellers", [...docs.trip.travellers, { name: "", passport_no: "", relation: "" }])}>Add traveller</Button>
                        </div>
                    </Section>

                    <Section icon={CalendarRange} title="Day-by-day itinerary" hint={tripDays ? `${tripDays} days · ${longDate(docs.trip.start_date)} to ${longDate(docs.trip.end_date)}` : "Set the trip dates, or start from a ready-made plan."}
                        right={
                            <div className="flex flex-wrap gap-2">
                                <select className={`${sel} h-8 text-xs`} value="" onChange={(e) => { useSample(e.target.value); e.currentTarget.value = ""; }} aria-label="Ready-made plan">
                                    <option value="">Ready-made plan…</option>
                                    {Object.entries(SAMPLES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                                </select>
                                <Button size="sm" variant="flat" isDisabled={!docs.trip.start_date || !docs.trip.end_date} onPress={fillDays}>Fill dates</Button>
                                <Button size="sm" variant="flat" startContent={<Printer size={14} />} isDisabled={!docs.itinerary.length} onPress={() => printItinerary(docs, { client: ctx.client, country: ctx.country, visaType: ctx.visaType, agency: ctx.agency })}>Print / PDF</Button>
                            </div>
                        }>
                        {docs.itinerary.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-default-300 py-8 text-center text-sm text-default-500">No days yet. Pick a ready-made plan or set dates and press <b>Fill dates</b>.</div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {docs.itinerary.map((d, i) => (
                                    <div key={i} className="grid grid-cols-1 sm:grid-cols-[150px_140px_1fr_170px_auto] gap-2 items-start rounded-lg bg-default-50 dark:bg-default-100/40 p-2">
                                        <div className="flex sm:flex-col gap-1">
                                            <span className="text-xs font-semibold text-primary">Day {i + 1}</span>
                                            <Input size="sm" type="date" aria-label={`Day ${i + 1} date`} value={d.date} onValueChange={(v) => setDay(i, "date", v)} />
                                        </div>
                                        <Input size="sm" aria-label="City" placeholder="City" value={d.city} onValueChange={(v) => setDay(i, "city", v)} />
                                        <Textarea size="sm" aria-label="Plan" placeholder="Places, meetings, activities" minRows={1} value={d.plan} onValueChange={(v) => setDay(i, "plan", v)} />
                                        <Input size="sm" aria-label="Stay" placeholder="Hotel / stay" value={d.stay} onValueChange={(v) => setDay(i, "stay", v)} />
                                        <Button isIconOnly size="sm" variant="light" aria-label="Remove day" onPress={() => update((x) => ({ ...x, itinerary: x.itinerary.filter((_, j) => j !== i) }))}><Trash2 size={15} /></Button>
                                    </div>
                                ))}
                                <Button size="sm" variant="flat" className="w-fit" startContent={<Plus size={14} />} onPress={() => update((x) => ({ ...x, itinerary: [...x.itinerary, { date: x.itinerary.length && x.itinerary[x.itinerary.length - 1].date ? addDays(x.itinerary[x.itinerary.length - 1].date, 1) : "", city: "", plan: "", stay: "" }] }))}>Add day</Button>
                            </div>
                        )}
                    </Section>

                    <Section icon={Plane} title="Flights" hint="Reservation details shown at the top of the itinerary.">
                        {docs.flights.map((f, i) => (
                            <div key={i} className="grid grid-cols-2 sm:grid-cols-[150px_1fr_1fr_130px_auto] gap-2 items-center">
                                <Input size="sm" type="date" aria-label="Flight date" value={f.date} onValueChange={(v) => update((d) => ({ ...d, flights: d.flights.map((x, j) => (j === i ? { ...x, date: v } : x)) }))} />
                                <Input size="sm" aria-label="From" placeholder="From" value={f.from} onValueChange={(v) => update((d) => ({ ...d, flights: d.flights.map((x, j) => (j === i ? { ...x, from: v } : x)) }))} />
                                <Input size="sm" aria-label="To" placeholder="To" value={f.to} onValueChange={(v) => update((d) => ({ ...d, flights: d.flights.map((x, j) => (j === i ? { ...x, to: v } : x)) }))} />
                                <Input size="sm" aria-label="Flight" placeholder="Flight no." value={f.flight} onValueChange={(v) => update((d) => ({ ...d, flights: d.flights.map((x, j) => (j === i ? { ...x, flight: v.toUpperCase() } : x)) }))} />
                                <Button isIconOnly size="sm" variant="light" aria-label="Remove flight" onPress={() => update((d) => ({ ...d, flights: d.flights.filter((_, j) => j !== i) }))}><Trash2 size={15} /></Button>
                            </div>
                        ))}
                        <Button size="sm" variant="flat" className="w-fit" startContent={<Plus size={14} />} onPress={() => update((d) => ({ ...d, flights: [...d.flights, { date: d.flights.length ? d.trip.end_date : d.trip.start_date, from: d.flights.length ? d.flights[0].to : d.trip.from_city, to: d.flights.length ? d.trip.from_city : d.trip.destination, flight: "" }] }))}>Add flight</Button>
                    </Section>
                </>
            )}

            {tab === "letter" && (
                <Section icon={FileSignature} title="Cover letter" hint="Written from the trip details. Edit freely, then print on plain paper (tourist) or the company's letterhead (business)."
                    right={
                        <div className="flex flex-wrap gap-2">
                            <select className={`${sel} h-8 text-xs`} value={docs.cover_letter.kind} onChange={(e) => setLetter("kind", e.target.value)} aria-label="Letter type">
                                <option value="tourist">Tourist - from the applicant</option>
                                <option value="business">Business - from the company</option>
                            </select>
                            <Button size="sm" color="primary" variant="flat" startContent={<Sparkles size={14} />} onPress={() => update((d) => ({ ...d, cover_letter: writeLetter(d, ctx) }))}>{docs.cover_letter.body ? "Rewrite from trip" : "Write letter"}</Button>
                            <Button size="sm" variant="flat" startContent={<Printer size={14} />} isDisabled={!docs.cover_letter.body} onPress={() => printCoverLetter(docs, { client: ctx.client })}>Print / PDF</Button>
                        </div>
                    }>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <L t={"To"}><Textarea size="sm" aria-label="To" minRows={2} value={docs.cover_letter.addressed_to} onValueChange={(v) => setLetter("addressed_to", v)} /></L>
                        <L t={"Signature block"}><Textarea size="sm" aria-label="Signature block" minRows={2} value={docs.cover_letter.signed_by} onValueChange={(v) => setLetter("signed_by", v)} /></L>
                    </div>
                    <L t={"Subject"}><Input size="sm" aria-label="Subject" value={docs.cover_letter.subject} onValueChange={(v) => setLetter("subject", v)} /></L>
                    <L t={"Letter"}><Textarea aria-label="Letter" minRows={12} maxRows={30} value={docs.cover_letter.body} onValueChange={(v) => setLetter("body", v)} placeholder="Press 'Write letter' to draft it from the trip details." /></L>
                </Section>
            )}

            {tab === "funds" && (
                <Section icon={Wallet} title="Funds check" hint="Does the bank balance cover the trip? Guide amounts only - always check the embassy's current rules.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <label className="flex flex-col gap-1 text-xs text-default-600">Country rule
                            <select className={sel} value={docs.funds.country_key} onChange={(e) => setFunds("country_key", e.target.value)}>{Object.entries(FUNDS_GUIDE).map(([k, g]) => <option key={k} value={k}>{g[0]} - {g[1]} {g[2]}/day</option>)}</select>
                        </label>
                        <L t={"Days"}><Input size="sm" type="number" aria-label="Days" placeholder={tripDays ? String(tripDays) : "0"} value={docs.funds.days ? String(docs.funds.days) : ""} onValueChange={(v) => setFunds("days", Number(v) || 0)} description={!docs.funds.days && tripDays ? `From trip dates: ${tripDays}` : undefined} /></L>
                        <L t={"Bank balance (₹)"}><Input size="sm" type="number" aria-label="Bank balance (₹)" value={docs.funds.balance ? String(docs.funds.balance) : ""} onValueChange={(v) => setFunds("balance", Number(v) || 0)} /></L>
                        <L t={"Flights + hotels already booked (₹)"}><Input size="sm" type="number" aria-label="Flights + hotels already booked (₹)" value={docs.funds.trip_cost ? String(docs.funds.trip_cost) : ""} onValueChange={(v) => setFunds("trip_cost", Number(v) || 0)} /></L>
                        <L t={"Who pays (for the cover letter)"} className="sm:col-span-2"><Input size="sm" aria-label="Who pays (for the cover letter)" placeholder="Me / my father Mr. ... / ABC Pvt Ltd" value={docs.funds.sponsor} onValueChange={(v) => setFunds("sponsor", v)} /></L>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="rounded-lg bg-default-50 dark:bg-default-100/40 p-3"><div className="text-xs text-default-500">Daily expenses ({fundDays} days × {people} {people > 1 ? "people" : "person"} × {guide[1]} {guide[2]})</div><div className="text-lg font-semibold">{inr(living)}</div></div>
                        <div className="rounded-lg bg-default-50 dark:bg-default-100/40 p-3"><div className="text-xs text-default-500">Total needed</div><div className="text-lg font-semibold">{inr(needed)}</div></div>
                        <div className={`rounded-lg p-3 ${verdict === "strong" ? "bg-success-50 text-success-800" : verdict === "ok" ? "bg-warning-50 text-warning-800" : verdict === "low" ? "bg-danger-50 text-danger-700" : "bg-default-50 dark:bg-default-100/40"}`}>
                            <div className="text-xs opacity-80">Result</div>
                            <div className="text-lg font-semibold">{verdict === "strong" ? "Strong - funds look good" : verdict === "ok" ? "Enough, but tight" : verdict === "low" ? `Short by ${inr(needed - balance)}` : "Enter balance"}</div>
                        </div>
                    </div>
                    <p className="text-xs text-default-500">Approx. rate used: 1 {guide[1]} ≈ ₹{guide[3]}. Officers prefer a balance of about 1.5× the trip cost, steady for 6 months, with no sudden large deposits.</p>
                </Section>
            )}
        </section>
    );
};

export default TravelDocuments;
