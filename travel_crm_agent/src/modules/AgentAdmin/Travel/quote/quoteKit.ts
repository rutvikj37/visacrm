/**
 * Quote builder shared bits: service types and their fields, line maths (same as the server's
 * services/travel.ts → quoteTotals) and the description written from a service's details.
 * Amounts here are rupees.
 */

export type Line = {
    service_type: string;
    description: string;
    supplier_id: number | null;
    rate_id: number | null;
    qty: number;
    nights: number;
    unit_cost: number;
    markup_type: "percent" | "flat";
    markup_value: number;
    hidden_markup: number;
    vendor: string | null;
    details: Record<string, string>;
};
export type Option = { name: string; lines: Line[] };

export type FieldDef = {
    key: string;
    label: string;
    type?: "text" | "date" | "time" | "number" | "select";
    options?: string[];
    required?: boolean;
    placeholder?: string;
    wide?: boolean;
};
export type ServiceDef = { key: string; label: string; icon: string; tone: string; fields: FieldDef[]; perUnit?: { qty: string; nights?: string } };

const CABINS = ["Economy", "Premium economy", "Business", "First"];
const MEALS = ["EP (room only)", "CP (breakfast)", "MAP (breakfast + dinner)", "AP (all meals)", "All inclusive"];

/** "Add a service" menu, in the order travel agents reach for them. */
export const QUOTE_SERVICES: ServiceDef[] = [
    {
        key: "flight", label: "Flight", icon: "plane", tone: "sky", perUnit: { qty: "Passengers" },
        fields: [
            { key: "from", label: "From", required: true, placeholder: "e.g. Delhi (DEL)" },
            { key: "to", label: "To", required: true, placeholder: "e.g. Kullu (KUU)" },
            { key: "travel_date", label: "Travel date", type: "date", required: true },
            { key: "airline", label: "Airline", placeholder: "e.g. IndiGo" },
            { key: "flight_no", label: "Flight no.", placeholder: "6E 2133" },
            { key: "depart_time", label: "Departs", type: "time" },
            { key: "arrive_time", label: "Arrives", type: "time" },
            { key: "cabin", label: "Cabin", type: "select", options: CABINS },
            { key: "pnr", label: "PNR" },
            { key: "baggage", label: "Baggage", placeholder: "15 kg check-in + 7 kg cabin" },
        ],
    },
    {
        key: "flight_extras", label: "Flight extras", icon: "luggage", tone: "sky",
        fields: [
            { key: "title", label: "What is it", required: true, placeholder: "Extra baggage, seat, meal…", wide: true },
            { key: "date", label: "Date", type: "date" },
            { key: "flight_no", label: "For flight" },
        ],
    },
    {
        key: "train", label: "Train", icon: "train", tone: "amber", perUnit: { qty: "Passengers" },
        fields: [
            { key: "from", label: "From", required: true },
            { key: "to", label: "To", required: true },
            { key: "travel_date", label: "Travel date", type: "date", required: true },
            { key: "train_name", label: "Train name / no.", placeholder: "12951 Rajdhani" },
            { key: "class", label: "Class", type: "select", options: ["1A", "2A", "3A", "3E", "SL", "CC", "EC", "2S"] },
            { key: "depart_time", label: "Departs", type: "time" },
            { key: "pnr", label: "PNR" },
        ],
    },
    {
        key: "bus", label: "Bus", icon: "bus", tone: "blue", perUnit: { qty: "Seats" },
        fields: [
            { key: "from", label: "From", required: true },
            { key: "to", label: "To", required: true },
            { key: "travel_date", label: "Travel date", type: "date", required: true },
            { key: "operator", label: "Operator" },
            { key: "bus_type", label: "Bus type", type: "select", options: ["AC sleeper", "AC seater", "Volvo semi-sleeper", "Non-AC sleeper", "Non-AC seater"] },
            { key: "depart_time", label: "Departs", type: "time" },
        ],
    },
    {
        key: "hotel", label: "Hotel", icon: "bed", tone: "violet", perUnit: { qty: "Rooms", nights: "Nights" },
        fields: [
            { key: "hotel_name", label: "Hotel name", required: true, placeholder: "e.g. Snow Valley Resorts" },
            { key: "city", label: "City", required: true, placeholder: "e.g. Manali" },
            { key: "check_in", label: "Check-in", type: "date", required: true },
            { key: "check_out", label: "Check-out", type: "date", required: true },
            { key: "room_type", label: "Room type", placeholder: "Deluxe valley view" },
            { key: "rooms", label: "Rooms", type: "number" },
            { key: "meal_plan", label: "Meal plan", type: "select", options: MEALS },
            { key: "star", label: "Category", type: "select", options: ["Budget", "3 star", "4 star", "5 star", "Luxury", "Homestay"] },
        ],
    },
    {
        key: "land_package", label: "Land package", icon: "map", tone: "violet", perUnit: { qty: "People" },
        fields: [
            { key: "title", label: "Package name", required: true, placeholder: "Manali 4N/5D land package", wide: true },
            { key: "start_date", label: "Starts", type: "date" },
            { key: "end_date", label: "Ends", type: "date" },
            { key: "note", label: "What it covers", placeholder: "Hotels, transfers, sightseeing", wide: true },
        ],
    },
    {
        key: "visa", label: "Visa", icon: "stamp", tone: "indigo", perUnit: { qty: "Applicants" },
        fields: [
            { key: "country", label: "Country", required: true },
            { key: "visa_type", label: "Visa type", type: "select", options: ["Tourist", "Business", "Transit", "Visit"] },
            { key: "entries", label: "Entries", type: "select", options: ["Single entry", "Multiple entry"] },
            { key: "validity", label: "Validity / stay", placeholder: "30 days" },
        ],
    },
    {
        key: "activity", label: "Activities", icon: "sparkles", tone: "pink", perUnit: { qty: "People" },
        fields: [
            { key: "title", label: "Activity", required: true, placeholder: "Solang valley paragliding", wide: true },
            { key: "city", label: "City" },
            { key: "date", label: "Date", type: "date" },
            { key: "time", label: "Time", type: "time" },
        ],
    },
    {
        key: "transfer", label: "Cab / Transport", icon: "car", tone: "blue", perUnit: { qty: "Vehicles", nights: "Days" },
        fields: [
            { key: "vehicle", label: "Vehicle", required: true, placeholder: "Innova Crysta" },
            { key: "pickup", label: "Pick-up", required: true, placeholder: "Bhuntar airport" },
            { key: "drop", label: "Drop", required: true, placeholder: "Hotel in Manali" },
            { key: "date", label: "Date", type: "date", required: true },
            { key: "time", label: "Time", type: "time" },
            { key: "end_date", label: "Until (for multi-day)", type: "date" },
        ],
    },
    {
        key: "meal", label: "Fooding", icon: "utensils", tone: "orange", perUnit: { qty: "People" },
        fields: [
            { key: "title", label: "Meal", required: true, placeholder: "Candle-light dinner", wide: true },
            { key: "date", label: "Date", type: "date" },
            { key: "venue", label: "Venue" },
        ],
    },
    {
        key: "admission", label: "Admission / Entry", icon: "ticket", tone: "cyan", perUnit: { qty: "Tickets" },
        fields: [
            { key: "title", label: "Place", required: true, placeholder: "Rohtang pass permit", wide: true },
            { key: "date", label: "Date", type: "date" },
            { key: "time", label: "Time slot", type: "time" },
        ],
    },
    {
        key: "insurance", label: "Travel insurance", icon: "shield", tone: "emerald", perUnit: { qty: "People" },
        fields: [
            { key: "provider", label: "Insurer", required: true },
            { key: "plan", label: "Plan" },
            { key: "start_date", label: "Cover from", type: "date" },
            { key: "end_date", label: "Cover to", type: "date" },
            { key: "sum_insured", label: "Sum insured" },
        ],
    },
    {
        key: "forex", label: "Forex", icon: "coins", tone: "yellow",
        fields: [
            { key: "currency", label: "Currency", required: true, placeholder: "USD" },
            { key: "amount", label: "Amount", placeholder: "1000" },
            { key: "mode", label: "Mode", type: "select", options: ["Cash", "Forex card", "Wire transfer"] },
        ],
    },
    {
        key: "other", label: "Other", icon: "plus", tone: "slate", perUnit: { qty: "Qty" },
        fields: [
            { key: "title", label: "Service", required: true, wide: true },
            { key: "date", label: "Date", type: "date" },
            { key: "note", label: "Note", wide: true },
        ],
    },
];
export const serviceDef = (k: string) => QUOTE_SERVICES.find((s) => s.key === k) || QUOTE_SERVICES[QUOTE_SERVICES.length - 1];

/** Tailwind classes per tone (kept literal so Tailwind keeps them). */
export const TONE: Record<string, string> = {
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
    slate: "bg-default-100 text-default-700",
};

export const blankLine = (type = "hotel"): Line => ({
    service_type: type, description: "", supplier_id: null, rate_id: null, qty: 1, nights: 0, unit_cost: 0,
    markup_type: "flat", markup_value: 0, hidden_markup: 0, vendor: null, details: { cost_basis: "total" },
});

const shortDate = (v?: string) => {
    if (!v) return "";
    const d = new Date(`${v}T00:00:00`);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
export const nightsBetween = (a?: string, b?: string) => {
    if (!a || !b) return 0;
    const n = Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    return n > 0 ? n : 0;
};

/** Customer-facing one-liner for a service, written from its details. */
export const describe = (l: Line) => {
    const d = l.details || {};
    const join = (...xs: (string | undefined | false)[]) => xs.filter(Boolean).join(" · ");
    switch (l.service_type) {
        case "flight": return join(d.from && d.to ? `${d.from} → ${d.to}` : "Flight", d.airline && `${d.airline}${d.flight_no ? ` ${d.flight_no}` : ""}`, shortDate(d.travel_date), d.cabin);
        case "train": return join(d.from && d.to ? `Train ${d.from} → ${d.to}` : "Train", d.train_name, d.class, shortDate(d.travel_date));
        case "bus": return join(d.from && d.to ? `Bus ${d.from} → ${d.to}` : "Bus", d.bus_type, d.operator, shortDate(d.travel_date));
        case "hotel": {
            const n = nightsBetween(d.check_in, d.check_out);
            return join(d.hotel_name ? `${d.hotel_name}${d.city ? `, ${d.city}` : ""}` : "Hotel stay", d.room_type, d.meal_plan?.split(" ")[0], d.check_in && `${shortDate(d.check_in)}${d.check_out ? ` → ${shortDate(d.check_out)}` : ""}${n ? ` (${n}N)` : ""}`);
        }
        case "transfer": return join(d.vehicle || "Cab", d.pickup && d.drop ? `${d.pickup} → ${d.drop}` : d.pickup || d.drop, shortDate(d.date));
        case "visa": return join(`${d.country || ""} ${d.visa_type || ""} visa`.trim(), d.entries, d.validity);
        case "insurance": return join(`Travel insurance${d.provider ? ` - ${d.provider}` : ""}`, d.plan, d.start_date && `${shortDate(d.start_date)} → ${shortDate(d.end_date)}`);
        case "forex": return join(`Forex ${d.amount || ""} ${d.currency || ""}`.trim(), d.mode);
        case "land_package": return join(d.title || "Land package", d.start_date && `${shortDate(d.start_date)} → ${shortDate(d.end_date)}`);
        default: return join(d.title || serviceDef(l.service_type).label, d.city, shortDate(d.date), d.venue);
    }
};

// ---------------------------------------------------------------- maths (rupees)

const r2 = (n: number) => Math.round(n * 100) / 100;
export const lineCost = (l: Line) => (Number(l.unit_cost) || 0) * Math.max(1, Number(l.qty) || 1) * Math.max(1, Number(l.nights) || 0);
export const lineMarkup = (l: Line) => (l.markup_type === "flat" ? Number(l.markup_value) || 0 : lineCost(l) * (Number(l.markup_value) || 0) / 100);
export const lineHidden = (l: Line) => Math.min(Math.max(0, Number(l.hidden_markup) || 0), lineMarkup(l));

export type QuoteMoney = { billing_mode: string; gst_percent: number | string; tcs_percent: number | string; is_international: boolean; discount: number | string; gst_inclusive: boolean; adults: number; children: number };

export const totals = (lines: Line[], q: QuoteMoney) => {
    const cost = lines.reduce((a, l) => a + lineCost(l), 0);
    const markup = lines.reduce((a, l) => a + lineMarkup(l), 0);
    const hidden = lines.reduce((a, l) => a + lineHidden(l), 0);
    const discount = Math.min(Math.max(0, Number(q.discount) || 0), cost + markup);
    const rate = Math.max(0, Number(q.gst_percent) || 0);
    const gross = cost + markup - discount;
    const grossTaxable = q.billing_mode === "margin" ? Math.max(0, gross - cost - hidden) : gross;
    const gst = r2(q.gst_inclusive ? grossTaxable * rate / (100 + rate) : grossTaxable * rate / 100);
    const sell = q.gst_inclusive ? gross - gst : gross;
    const costOfTravel = cost + Math.min(hidden, Math.max(0, sell - cost));
    const tcs = q.is_international ? r2((sell + gst) * (Number(q.tcs_percent) || 0) / 100) : 0;
    const total = sell + gst + tcs;
    const pax = Math.max(1, (Number(q.adults) || 0) + (Number(q.children) || 0));
    return {
        cost, markup, hidden, discount, sell, cost_of_travel: costOfTravel, processing: Math.max(0, sell - costOfTravel),
        taxable: q.gst_inclusive ? grossTaxable - gst : grossTaxable, gst, tcs, total, profit: sell - cost,
        margin_pct: cost > 0 ? ((sell - cost) / cost) * 100 : 0, per_person: total / pax,
    };
};
export type Totals = ReturnType<typeof totals>;

export const INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
