/**
 * Travel CRM demo data for one existing agency (found by its portal subdomain).
 *
 *   npm run demo:seed:travelcrm -- patel            add demo data to patel.<domain>
 *   npm run demo:seed:travelcrm -- patel --remove   remove only the demo data this script added
 *
 * Adds a realistic Indian holiday business: suppliers with rate contracts, a library, itinerary templates,
 * packages with public pages, travel enquiries at every pipeline stage, itineraries and quotes, bookings
 * (travelling now, leaving soon and not ready, next month, completed), travellers, GST invoices with
 * instalments and payments, supplier payments, family members, WhatsApp/email templates and targets.
 *
 * Every row it creates is listed in agent.ui_prefs.travel_demo, so --remove (and a re-run) deletes exactly
 * those rows and nothing the agency entered itself. Nothing is emailed or messaged.
 */
import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import sequelize from "../config/dbconfig";

const DAY = 864e5;
const today = new Date();
const iso = (offset: number) => new Date(today.getTime() + offset * DAY).toISOString().slice(0, 10);
const at = (offset: number, h = 11) => { const d = new Date(today.getTime() + offset * DAY); d.setHours(h, 0, 0, 0); return d; };
const p = (rupees: number) => Math.round(rupees * 100); // money is stored in paise

const SUPPLIERS = [
    { key: "marina", type: "hotel", name: "Marina Bay Hotel Dubai", city: "Dubai", country: "UAE", phone: "+971 4 555 0101", email: "reservations@marinabay.example", contact: "Ahmed Rashid",
      rates: [{ service: "Deluxe room - Marina Bay Hotel", type: "hotel", room: "Deluxe", meal: "CP", pax: "per_room", cost: 7800 }, { service: "Club room - Marina Bay Hotel", type: "hotel", room: "Club", meal: "MAP", pax: "per_room", cost: 12500 }] },
    { key: "desert", type: "dmc", name: "Desert Rose DMC", city: "Dubai", country: "UAE", phone: "+971 50 555 0202", email: "ops@desertrose.example", contact: "Fatima Khan",
      rates: [{ service: "Airport transfer (sedan, both ways)", type: "transfer", pax: "per_unit", cost: 5200 }, { service: "Desert safari with BBQ dinner", type: "activity", pax: "per_adult", cost: 3200 }, { service: "Burj Khalifa 124th floor ticket", type: "activity", pax: "per_adult", cost: 3900 }, { service: "Dubai city tour (half day, SIC)", type: "activity", pax: "per_adult", cost: 1600 }] },
    { key: "kerala", type: "hotel", name: "Green Lagoon Houseboats", city: "Alleppey", country: "India", phone: "+91 477 555 0303", email: "book@greenlagoon.example", contact: "Thomas Mathew", gstin: "32ABCDE1234F1Z5",
      rates: [{ service: "Premium houseboat, 1 night", type: "hotel", room: "Premium AC", meal: "AP", pax: "per_room", cost: 9500 }, { service: "Munnar resort - Valley view", type: "hotel", room: "Valley view", meal: "CP", pax: "per_room", cost: 5600 }] },
    { key: "cabs", type: "transport", name: "Kerala Tour Cabs", city: "Kochi", country: "India", phone: "+91 98470 55504", email: "trips@keralacabs.example", contact: "Biju Varghese", gstin: "32FGHIJ5678K1Z2",
      rates: [{ service: "Innova Crysta with driver, per day", type: "transfer", pax: "per_unit", cost: 4200 }] },
    { key: "thai", type: "dmc", name: "Siam Smiles DMC", city: "Bangkok", country: "Thailand", phone: "+66 2 555 0505", email: "india@siamsmiles.example", contact: "Niran P.",
      rates: [{ service: "Phuket 3* hotel, Patong", type: "hotel", room: "Superior", meal: "CP", pax: "per_room", cost: 3800 }, { service: "Phi Phi island tour with lunch", type: "activity", pax: "per_adult", cost: 3400 }, { service: "Bangkok 4* hotel, Sukhumvit", type: "hotel", room: "Deluxe", meal: "CP", pax: "per_room", cost: 4600 }] },
    { key: "goa", type: "hotel", name: "Sea Breeze Resort Goa", city: "Calangute", country: "India", phone: "+91 832 555 0606", email: "stay@seabreeze.example", contact: "Anita D'Souza", gstin: "30KLMNO9012P1Z8",
      rates: [{ service: "Pool view room - Sea Breeze", type: "hotel", room: "Pool view", meal: "CP", pax: "per_room", cost: 4900 }] },
];

const LIBRARY = [
    ["destination", "Dubai", "Dubai", "Skyscrapers, desert dunes and world-class shopping. Best October to March."],
    ["hotel", "Marina Bay Hotel Dubai", "Dubai", "4-star hotel at Dubai Marina, 5 minutes from the beach and metro."],
    ["activity", "Desert safari with BBQ dinner", "Dubai", "Dune bashing, camel ride, henna, tanoura show and buffet dinner."],
    ["activity", "Burj Khalifa 124th floor", "Dubai", "Fast-track entry to At the Top, best at sunset."],
    ["transfer", "Airport transfer (private sedan)", "Dubai", "Meet and greet at arrivals, up to 3 guests with luggage."],
    ["destination", "Kerala", "Kerala", "Backwaters, tea gardens and beaches. Great for families and honeymoons."],
    ["hotel", "Premium houseboat, Alleppey", "Kerala", "Overnight cruise with all meals cooked on board."],
    ["activity", "Munnar tea garden tour", "Kerala", "Tea museum, Mattupetty dam and Echo point."],
    ["activity", "Phi Phi island tour", "Thailand", "Speedboat to Maya Bay, snorkelling and lunch on the beach."],
    ["note", "Visa and insurance note", "", "We can arrange your tourist visa and travel insurance with this trip - ask your consultant."],
] as const;

const TEMPLATES = [
    { key: "dubai", title: "Dubai Delight 4N/5D", destination: "Dubai", theme: "modern",
      days: [["Arrival in Dubai", "Dubai", [["transfer", "Private airport transfer to the hotel"], ["hotel", "Check in at Marina Bay Hotel (Deluxe room)"], ["activity", "Evening Dhow cruise at Dubai Marina with dinner"]]],
          ["City tour and Burj Khalifa", "Dubai", [["sightseeing", "Half-day city tour: Jumeirah Mosque, Dubai Frame, Gold Souk"], ["sightseeing", "Burj Khalifa 124th floor at sunset"], ["sightseeing", "Dubai Fountain show"]]],
          ["Desert safari", "Dubai", [["note", "Free morning for shopping at Dubai Mall"], ["activity", "Desert safari with dune bashing, camel ride and BBQ dinner"]]],
          ["Abu Dhabi day trip", "Abu Dhabi", [["sightseeing", "Sheikh Zayed Grand Mosque"], ["sightseeing", "Ferrari World or Louvre Abu Dhabi (optional)"]]],
          ["Departure", "Dubai", [["transfer", "Check out and private transfer to the airport"]]]],
      inclusions: "4 nights hotel with breakfast\nPrivate airport transfers\nCity tour, Burj Khalifa, desert safari, Abu Dhabi tour\nDhow cruise dinner", exclusions: "Flights\nUAE visa (we can arrange)\nTourism Dirham fee paid at the hotel\nLunches and personal expenses",
      cancellation: "Free cancellation up to 21 days before travel. 50% charge 20-8 days before. No refund within 7 days.", price: 42999, image: null },
    { key: "kerala", title: "Kerala Backwaters & Hills 5N/6D", destination: "Kerala", theme: "elegant",
      days: [["Arrive Kochi, drive to Munnar", "Munnar", [["transfer", "Pick-up at Kochi airport in a private Innova"], ["hotel", "Munnar resort, valley view room"]]],
          ["Munnar sightseeing", "Munnar", [["sightseeing", "Tea museum, Mattupetty dam, Echo point"], ["sightseeing", "Eravikulam National Park"]]],
          ["Munnar to Thekkady", "Thekkady", [["activity", "Spice plantation walk"], ["activity", "Kathakali show (optional)"]]],
          ["Alleppey houseboat", "Alleppey", [["hotel", "Premium AC houseboat with all meals"], ["note", "Cruise through the backwaters and village canals"]]],
          ["Kovalam beach", "Kovalam", [["note", "Relax at the beach"]]],
          ["Departure from Trivandrum", "Trivandrum", [["transfer", "Drop at Trivandrum airport"]]]],
      inclusions: "5 nights stay (incl. 1 night houseboat)\nPrivate car for all transfers and sightseeing\nBreakfast daily, all meals on the houseboat", exclusions: "Flights or trains\nEntry tickets\nLunch and dinner except on the houseboat",
      cancellation: "Free cancellation up to 15 days before travel. 25% charge 14-7 days before. 100% within 7 days.", price: 24999, image: null },
    { key: "thai", title: "Thailand Fun 5N/6D (Phuket + Bangkok)", destination: "Thailand", theme: "classic",
      days: [["Arrive Phuket", "Phuket", [["transfer", "Airport transfer to Patong"], ["hotel", "Phuket 3* hotel, Patong"]]],
          ["Phi Phi island tour", "Phuket", [["activity", "Phi Phi island tour by speedboat with lunch"]]],
          ["Free day in Phuket", "Phuket", [["note", "Optional: Big Buddha and Old Town"]]],
          ["Fly to Bangkok", "Bangkok", [["flight", "Phuket to Bangkok domestic flight"], ["hotel", "Bangkok 4* hotel, Sukhumvit"]]],
          ["Bangkok city and temples", "Bangkok", [["sightseeing", "Grand Palace, Wat Pho, Wat Arun"]]],
          ["Departure", "Bangkok", [["transfer", "Transfer to Suvarnabhumi airport"]]]],
      inclusions: "5 nights hotel with breakfast\nPhi Phi tour with lunch\nAll transfers on SIC basis", exclusions: "International flights\nThailand visa on arrival fee\nPersonal expenses",
      cancellation: "Free cancellation up to 21 days before travel.", price: 38999, image: null },
    { key: "goa", title: "Goa Beach Break 3N/4D", destination: "Goa", theme: "classic",
      days: [["Arrive Goa", "Calangute", [["transfer", "Airport pick-up"], ["hotel", "Sea Breeze Resort, pool view room"]]],
          ["North Goa tour", "North Goa", [["sightseeing", "Fort Aguada, Baga, Anjuna, Chapora"]]],
          ["South Goa tour", "South Goa", [["sightseeing", "Old Goa churches, Colva beach, Miramar"]]],
          ["Departure", "Goa", [["transfer", "Drop at the airport"]]]],
      inclusions: "3 nights with breakfast\nAirport transfers\nNorth and South Goa tours", exclusions: "Flights\nWater sports", cancellation: "Free cancellation up to 7 days before travel.", price: 12999, image: null },
];

// travel enquiries across the pipeline
const LEADS = [
    { name: "Amit & Pooja Shah", phone: "9000009101", city: "Ahmedabad", dest: ["Dubai"], start: 9, nights: 4, adults: 2, children: 1, ages: [8], budget: 160000, hotel: "4_star", trip: "family", status: "converted", source: "facebook", booking: "soon" },
    { name: "Rahul Mehta", phone: "9000009102", city: "Surat", dest: ["Dubai"], start: -2, nights: 4, adults: 2, children: 0, budget: 120000, hotel: "4_star", trip: "honeymoon", status: "converted", source: "website", booking: "now" },
    { name: "Nisha & Karan Iyer", phone: "9000009103", city: "Mumbai", dest: ["Kerala"], start: 32, nights: 5, adults: 2, children: 0, budget: 70000, hotel: "4_star", trip: "honeymoon", status: "converted", source: "instagram", booking: "next" },
    { name: "Desai family", phone: "9000009104", city: "Vadodara", dest: ["Goa"], start: -24, nights: 3, adults: 4, children: 2, ages: [6, 10], budget: 90000, hotel: "4_star", trip: "family", status: "converted", source: "manual", booking: "done" },
    { name: "Vikram Rao", phone: "9000009105", city: "Pune", dest: ["Thailand"], start: 40, nights: 5, adults: 4, children: 0, budget: 220000, hotel: "3_star", trip: "friends", status: "counselling", source: "google", quote: "sent", priority: "high", close: 6 },
    { name: "Sneha Patel", phone: "9000009106", city: "Ahmedabad", dest: ["Dubai"], start: 55, nights: 4, adults: 2, children: 2, ages: [5, 9], budget: 200000, hotel: "5_star", trip: "family", status: "interested", source: "facebook", quote: "sent", priority: "medium", close: 12, sentAgo: 4 },
    { name: "Arjun Nair", phone: "9000009107", city: "Kochi", dest: ["Kerala"], start: 25, nights: 5, adults: 2, children: 0, budget: 60000, hotel: "3_star", trip: "honeymoon", status: "interested", source: "indiamart", quote: "draft", priority: "medium", close: 10 },
    { name: "Meera Joshi", phone: "9000009108", city: "Nashik", dest: ["Goa"], start: 18, nights: 3, adults: 3, children: 0, budget: 45000, hotel: "4_star", trip: "friends", status: "follow_up", source: "whatsapp", priority: "low", close: 9 },
    { name: "Corporate offsite - Infiniti Tech", phone: "9000009109", city: "Bengaluru", dest: ["Thailand"], start: 70, nights: 4, adults: 18, children: 0, budget: 1100000, hotel: "4_star", trip: "corporate", status: "contacted", source: "website", priority: "high", close: 20 },
    { name: "Farhan Sheikh", phone: "9000009110", city: "Hyderabad", dest: ["Dubai"], start: 28, nights: 3, adults: 2, children: 0, budget: 90000, hotel: "4_star", trip: "honeymoon", status: "new", source: "facebook" },
    { name: "Kavya Reddy", phone: "9000009111", city: "Chennai", dest: ["Kerala"], start: 45, nights: 5, adults: 2, children: 1, ages: [4], budget: 80000, hotel: "4_star", trip: "family", status: "new", source: "justdial" },
    { name: "Rohit Verma", phone: "9000009112", city: "Delhi", dest: ["Thailand"], start: 35, nights: 5, adults: 2, children: 0, budget: 110000, hotel: "4_star", trip: "honeymoon", status: "lost", source: "google", lost: "Booked with another agent at a lower price" },
] as const;

const run = async () => {
    const args = process.argv.slice(2);
    const sub = (args.find((a) => !a.startsWith("--")) || "").toLowerCase();
    const remove = args.includes("--remove");
    if (!sub) { console.error("Usage: npm run demo:seed:travelcrm -- <subdomain> [--remove]"); process.exit(1); }

    const ModelInitializer = (await import("../config/modelInitializer")).default;
    const init = ModelInitializer.getInstance();
    if (!init.isModelInitialized()) init.setupAssociationsOnly();
    const Agent = (await import("../model/Agent")).default;
    const User = (await import("../model/User")).default;
    const CrmLead = (await import("../model/CrmLead")).default;
    const CrmLeadActivity = (await import("../model/CrmLeadActivity")).default;
    const ClientInvoice = (await import("../model/ClientInvoice")).default;
    const ClientPayment = (await import("../model/ClientPayment")).default;
    const MessageTemplate = (await import("../model/MessageTemplate")).default;
    const T = await import("../model/Travel");
    const { encryptPii } = await import("../helpers/crypto");
    const { quoteTotals } = await import("../services/travel");
    const { clearModuleCache } = await import("../services/modules");

    const agency: any = await Agent.findOne({ where: { role: "agent", sudomain: sub } });
    if (!agency) { console.error(`No agency with subdomain "${sub}"`); process.exit(1); }
    const agencyUuid = agency.dataValues.uuid, ownerId = agency.dataValues.id;
    let prefs: any = {};
    try { prefs = agency.dataValues.ui_prefs ? JSON.parse(agency.dataValues.ui_prefs) : {}; } catch { prefs = {}; }
    const old = prefs.travel_demo || {};

    // ---- remove what an earlier run added (only those ids)
    const models: Record<string, any> = {
        payments: ClientPayment, invoices: ClientInvoice, travellers: T.BookingTraveller, services: T.BookingService, bookings: T.Booking, quotes: T.Quotation,
        itineraries: T.Itinerary, packages: T.TourPackage, rates: T.SupplierRate, suppliers: T.TravelSupplier, library: T.LibraryItem, members: T.ClientMember,
        targets: T.TravelTarget, activities: CrmLeadActivity, leads: CrmLead, templates: MessageTemplate, clients: User,
    };
    for (const [k, model] of Object.entries(models)) {
        const ids = Array.isArray(old[k]) ? old[k] : [];
        if (ids.length) await model.destroy({ where: { id: ids, ...(k === "clients" ? { agency_uuid: agencyUuid } : {}) }, force: true });
    }
    delete prefs.travel_demo;
    if (remove) {
        await Agent.update({ ui_prefs: JSON.stringify(prefs) }, { where: { id: ownerId } });
        console.log(`Removed the demo data from ${agency.dataValues.app_name || sub}.`);
        await sequelize.close();
        return;
    }

    const made: Record<string, number[]> = {};
    // if anything fails, remove what this run already created
    (globalThis as any).__demoUndo = async () => {
        for (const [k, model] of Object.entries(models).reverse()) { const ids = made[k] || []; if (ids.length) await model.destroy({ where: { id: ids }, force: true }).catch(() => null); }
    };
    const keep = (k: string, row: any) => { (made[k] = made[k] || []).push(row.dataValues.id); return row; };
    const log = (leadId: number, type: string, message: string, when: Date) => CrmLeadActivity.create({ lead_id: leadId, agency_uuid: agencyUuid, type, message, created_by: ownerId, createdAt: when, updatedAt: when } as any).then((r) => keep("activities", r));

    // make sure the travel modules are on (a visa agency becomes Visa + Travel; data of a module switched off is kept)
    if (agency.dataValues.crm_type === "visa") await Agent.update({ crm_type: "both" }, { where: { id: ownerId } });

    // ---- suppliers and rate contracts
    const supplierId: Record<string, number> = {}, rateBy: Record<string, any> = {};
    for (const s of SUPPLIERS) {
        const row = keep("suppliers", await T.TravelSupplier.create({ agency_uuid: agencyUuid, type: s.type, name: s.name, contact_name: s.contact, phone: s.phone, email: s.email, city: s.city, country: s.country, gstin: (s as any).gstin || null, notes: "Demo supplier", created_by: ownerId }));
        supplierId[s.key] = row.dataValues.id;
        for (const r of s.rates) {
            const rate = keep("rates", await T.SupplierRate.create({ agency_uuid: agencyUuid, supplier_id: row.dataValues.id, service: r.service, service_type: r.type, room_type: (r as any).room || null, meal_plan: (r as any).meal || null, pax_type: r.pax, season: "Nov - Mar", valid_from: iso(-60), valid_to: iso(150), cost: p(r.cost), currency: "INR" }));
            rateBy[r.service] = { ...r, id: rate.dataValues.id, supplier_id: row.dataValues.id };
        }
    }
    for (const [type, name, destination, description] of LIBRARY) keep("library", await T.LibraryItem.create({ agency_uuid: agencyUuid, type, name, destination: destination || null, description, created_by: ownerId }));

    // ---- itinerary templates and packages
    const tpl: Record<string, any> = {};
    for (const t of TEMPLATES) {
        const days = t.days.map(([title, city, items], i) => ({ day: i + 1, title, city, notes: null, image: null, items: (items as any[]).map(([type, text]) => ({ type, text, library_item_id: null, image: null })) }));
        tpl[t.key] = keep("itineraries", await T.Itinerary.create({ agency_uuid: agencyUuid, is_template: true, title: t.title, destination: t.destination, nights: days.length - 1, days, inclusions: t.inclusions, exclusions: t.exclusions, cancellation_policy: t.cancellation, terms: "Prices are per person on twin sharing and subject to availability at the time of booking.", theme: t.theme, status: "draft", created_by: ownerId }));
        keep("packages", await T.TourPackage.create({ agency_uuid: agencyUuid, title: t.title, destination: t.destination, nights: days.length - 1, itinerary_id: tpl[t.key].dataValues.id, price_pp: p(t.price), valid_from: iso(-10), valid_to: iso(120), highlights: t.inclusions.split("\n").slice(0, 3).join(" · "), status: "active", public_slug: `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}-${crypto.randomBytes(3).toString("hex")}`, created_by: ownerId }));
    }

    // quote lines for a template, priced from the rate contracts
    const linesFor = (key: string, adults: number, children: number, nights: number) => {
        const rooms = Math.max(1, Math.ceil(adults / 2));
        const pax = adults + children;
        const L = (service: string, qty: number, n: number, markup = 15) => { const r = rateBy[service]; return { service_type: r.type, description: service, supplier_id: r.supplier_id, rate_id: r.id, qty, nights: n, unit_cost: p(r.cost), markup_type: "percent", markup_value: markup }; };
        if (key === "dubai") return [L("Deluxe room - Marina Bay Hotel", rooms, nights), L("Airport transfer (sedan, both ways)", 1, 0, 20), L("Desert safari with BBQ dinner", pax, 0), L("Burj Khalifa 124th floor ticket", pax, 0), L("Dubai city tour (half day, SIC)", pax, 0)];
        if (key === "kerala") return [L("Munnar resort - Valley view", rooms, Math.max(1, nights - 1)), L("Premium houseboat, 1 night", rooms, 1), L("Innova Crysta with driver, per day", 1, nights + 1, 12)];
        if (key === "thai") return [L("Phuket 3* hotel, Patong", rooms, 3), L("Bangkok 4* hotel, Sukhumvit", rooms, 2), L("Phi Phi island tour with lunch", pax, 0)];
        return [L("Pool view room - Sea Breeze", rooms, nights)];
    };
    const keyOf = (dest: string) => (/dubai/i.test(dest) ? "dubai" : /kerala/i.test(dest) ? "kerala" : /thai/i.test(dest) ? "thai" : "goa");

    let qn = 0, bn = 0, inv = 0, rc = 0;
    const prefix = "PT";
    for (const [i, L] of LEADS.entries()) {
        const created = at(-(30 - i * 2), 10 + (i % 6));
        const lead = keep("leads", await CrmLead.create({
            agency_uuid: agencyUuid, name: L.name, country_code: "+91", phone_number: L.phone, phone_normalized: `91${L.phone}`, email: `${L.name.split(" ")[0].toLowerCase()}@example.com`,
            city: L.city, source: L.source, campaign: L.source === "facebook" ? "Holiday season leads" : null, message: `Looking for a ${L.trip} trip to ${L.dest.join(", ")}`,
            status: L.status, lost_reason: (L as any).lost || null, assigned_to: ownerId, tags: ["demo"],
            business_line: "travel", destinations: L.dest, travel_start: iso(L.start), travel_end: iso(L.start + L.nights), nights: L.nights, adults: L.adults, children: L.children,
            child_ages: (L as any).ages || null, infants: 0, budget: p(L.budget), hotel_category: L.hotel, trip_type: L.trip, departure_city: L.city,
            priority: (L as any).priority || null, expected_close: (L as any).close ? iso((L as any).close) : null,
            next_follow_up_at: ["new", "contacted", "follow_up", "interested", "counselling"].includes(L.status) ? at(i % 3 === 0 ? 0 : 1 + (i % 4), 11) : null,
            last_activity_at: created, createdAt: created, updatedAt: created,
        } as any));
        const leadId = lead.dataValues.id;
        await log(leadId, "created", `New enquiry via ${L.source}`, created);
        if (L.status !== "new") await log(leadId, "call", "Called - discussed dates, hotel category and budget", new Date(created.getTime() + 3 * 3600e3));

        const key = keyOf(L.dest[0]);
        const wantsQuote = (L as any).quote || (L as any).booking;
        if (!wantsQuote) continue;

        // itinerary for this lead from the template
        const t = tpl[key].dataValues;
        const shareToken = crypto.randomBytes(18).toString("hex");
        const it = keep("itineraries", await T.Itinerary.create({
            agency_uuid: agencyUuid, crm_lead_id: leadId, is_template: false, title: `${t.title} - ${L.name.split(" ")[0]}`, destination: t.destination, nights: t.nights, start_date: iso(L.start),
            days: t.days, inclusions: t.inclusions, exclusions: t.exclusions, cancellation_policy: t.cancellation_policy, terms: t.terms, theme: t.theme,
            status: (L as any).booking ? "accepted" : (L as any).quote === "sent" ? "sent" : "draft", share_token: shareToken, created_by: ownerId,
        }));
        const lines = linesFor(key, L.adults, L.children, L.nights);
        const intl = key === "dubai" || key === "thai";
        const opts = [{ name: "Standard", lines }, ...(key === "dubai" ? [{ name: "Deluxe", lines: lines.map((l) => (l.description.startsWith("Deluxe room") ? { ...l, description: "Club room - Marina Bay Hotel", rate_id: rateBy["Club room - Marina Bay Hotel"].id, unit_cost: p(12500) } : l)) }] : [])];
        const q = { discount: p(L.adults + L.children > 3 ? 2000 : 0), billing_mode: "full_value", gst_percent: 5, tcs_percent: intl ? 2 : 0, is_international: intl, adults: L.adults, children: L.children };
        const tot = quoteTotals(lines as any, { discount: q.discount, billingMode: "full_value", gstPercent: 5, tcsPercent: q.tcs_percent, international: intl, travellers: L.adults + L.children });
        qn += 1;
        const sentAt = new Date(today.getTime() - (((L as any).sentAgo ?? 1) * DAY));
        const quote = keep("quotes", await T.Quotation.create({
            agency_uuid: agencyUuid, number: `QT-D${String(qn).padStart(3, "0")}`, crm_lead_id: leadId, itinerary_id: it.dataValues.id, version: 1, title: t.title, ...q, options: opts,
            chosen_option: 0, cost_total: tot.cost, sell_total: tot.total, status: (L as any).booking ? "accepted" : (L as any).quote, valid_until: iso(10),
            sent_at: (L as any).quote === "sent" || (L as any).booking ? sentAt : null, created_by: ownerId,
        }));
        await log(leadId, "note", `Quote ${quote.dataValues.number} for ${t.title}: Rs ${Math.round(tot.total / 100).toLocaleString("en-IN")}`, sentAt);
        if (!(L as any).booking) continue;

        // ---- booking
        const client = keep("clients", await User.create({ username: L.name, phone_number: L.phone, country_code: "+91", email: `${L.name.split(" ")[0].toLowerCase()}@example.com`, user_type: "user", agency_uuid: agencyUuid, travel_prefs: { meal: L.trip === "family" ? "Veg" : "No preference", seat: "Window", hotel: L.hotel.replace("_", " "), interests: key === "dubai" ? "Shopping, desert" : "Beaches, nature" } } as any));
        bn += 1;
        const stage = (L as any).booking as "now" | "soon" | "next" | "done";
        const booking = keep("bookings", await T.Booking.create({
            agency_uuid: agencyUuid, booking_no: `BK-D${String(bn).padStart(3, "0")}`, crm_lead_id: leadId, quotation_id: quote.dataValues.id, itinerary_id: it.dataValues.id,
            user_id: client.dataValues.id, title: t.title, destination: t.destination, is_international: intl, start_date: iso(L.start), end_date: iso(L.start + L.nights),
            status: stage === "done" ? "completed" : stage === "now" ? "in_progress" : "confirmed", total_sell: tot.sell, total_cost: tot.cost, tax_total: tot.gst + tot.tcs, discount: tot.discount,
            billing_mode: "full_value", gst_percent: 5, tcs_percent: q.tcs_percent, share_token: crypto.randomBytes(18).toString("hex"), ops_owner_id: ownerId, created_by: ownerId,
            createdAt: at(L.start - 20), updatedAt: at(L.start - 20),
        } as any));
        await it.update({ booking_id: booking.dataValues.id });
        await lead.update({ converted_at: at(L.start - 20), converted_booking_id: booking.dataValues.id, converted_student_id: client.dataValues.id });
        await log(leadId, "converted", `Booked: ${booking.dataValues.booking_no} (${t.title})`, at(L.start - 20));

        // services: confirmed for trips that are ready; the "soon" trip still has open items (shows on the dashboard)
        let hotelDay = 0; // hotels follow one another through the trip
        for (const [li, l] of lines.entries()) {
            const confirmed = stage !== "soon" || li === 0;
            const checkIn = l.service_type === "hotel" ? Math.min(hotelDay, Math.max(0, L.nights - 1)) : Math.min(li, Math.max(0, L.nights - 1));
            if (l.service_type === "hotel") hotelDay += Math.max(1, l.nights);
            const cost = l.unit_cost * l.qty * Math.max(1, l.nights);
            const paid = stage === "done" || stage === "now" ? cost : stage === "next" ? Math.round(cost * 0.3) : li === 0 ? Math.round(cost * 0.5) : 0;
            keep("services", await T.BookingService.create({
                agency_uuid: agencyUuid, booking_id: booking.dataValues.id, type: l.service_type === "activity" ? "activity" : l.service_type, description: l.description, supplier_id: l.supplier_id,
                confirmation_no: confirmed ? `${l.description.slice(0, 3).toUpperCase()}-${10000 + bn * 100 + li}` : null, status: confirmed ? "confirmed" : "requested",
                service_date: iso(L.start + checkIn), end_date: l.service_type === "hotel" ? iso(L.start + checkIn + Math.max(1, l.nights)) : null,
                cost, sell: cost + Math.round(cost * l.markup_value / 100), details: l.service_type === "hotel" ? { room_type: (rateBy[l.description] as any).room || "", meal_plan: (rateBy[l.description] as any).meal || "", qty: l.qty, nights: l.nights } : { pickup_time: "09:00 from hotel lobby", qty: l.qty },
                supplier_due_date: iso(stage === "soon" ? L.start - 3 : L.start - 10), supplier_paid: paid,
                supplier_payments: paid ? [{ amount: paid, paid_at: iso(L.start - 12), method: "bank_transfer", reference: `UTR${700000 + bn * 10 + li}` }] : null,
            }));
        }
        // travellers (passports encrypted; the "soon" trip is missing a passport and PAN - shows as not ready)
        const names = [L.name.split(" & ")[0].replace(/ family$/, "").trim() || L.name, ...Array.from({ length: L.adults - 1 }, (_, k) => `Adult ${k + 2} ${L.name.split(" ").pop()}`), ...Array.from({ length: L.children }, (_, k) => `Child ${k + 1} ${L.name.split(" ").pop()}`)];
        for (const [ti, n] of names.entries()) {
            const child = ti >= L.adults;
            const hasDocs = !(stage === "soon" && ti === names.length - 1);
            const passport = `Z${String(4100000 + bn * 10 + ti)}`;
            keep("travellers", await T.BookingTraveller.create({
                agency_uuid: agencyUuid, booking_id: booking.dataValues.id, name: n, pax_type: child ? "child" : "adult", dob: child ? iso(-365 * (((L as any).ages || [8])[ti - L.adults] || 8)) : iso(-365 * (32 + ti)),
                nationality: "Indian", is_lead: ti === 0, meal_pref: L.trip === "family" ? "Veg" : null, seat_pref: "Window",
                ...(hasDocs ? { passport_no_enc: encryptPii(passport), passport_last4: passport.slice(-4), passport_expiry: iso(365 * 6) } : {}),
                ...(ti === 0 && intl && stage !== "soon" ? { pan_enc: encryptPii(`ABCPD${4000 + bn}F`) } : {}),
            }));
        }
        // family members saved on the client profile
        if (L.children) keep("members", await T.ClientMember.create({ agency_uuid: agencyUuid, user_id: client.dataValues.id, name: names[names.length - 1], relation: "Child", pax_type: "child", dob: iso(-365 * 8), nationality: "Indian" }));

        // GST invoice with instalments and payments (the "soon" trip is the only one not invoiced yet)
        if (stage === "soon") continue;
        inv += 1;
        const subtotal = tot.sell + tot.tcs;
        const total = subtotal + tot.gst;
        const a1 = Math.round(total * 0.3), a2 = Math.round(total * 0.4), a3 = total - a1 - a2;
        const due = (d: number) => iso(L.start - d);
        const paid = stage === "done" || stage === "now" ? total : stage === "next" ? a1 : 0;
        const invoice = keep("invoices", await ClientInvoice.create({
            agency_uuid: agencyUuid, number: `${prefix}-D${String(inv).padStart(3, "0")}`, student_id: client.dataValues.id, title: t.title,
            items: [{ description: `${t.title} (${booking.dataValues.booking_no})`, amount: tot.sell }, ...(tot.tcs ? [{ description: "TCS @ 2% on overseas tour package", amount: tot.tcs }] : [])],
            subtotal, gst_percent: 5, gst_amount: tot.gst, total, amount_paid: paid, status: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid",
            issue_date: iso(L.start - 20), due_date: due(5), installments: [{ label: "Advance", amount: a1, due_date: due(20) }, { label: "Second payment", amount: a2, due_date: due(12) }, { label: "Final payment", amount: a3, due_date: due(5) }],
            booking_id: booking.dataValues.id, billing_mode: "full_value", sac_code: "998552", place_of_supply: "24", taxable_value: tot.sell, cgst: tot.gst - Math.floor(tot.gst / 2), sgst: Math.floor(tot.gst / 2), igst: 0,
            tcs_percent: q.tcs_percent, tcs_amount: tot.tcs,
        } as any));
        await booking.update({ invoice_id: invoice.dataValues.id });
        const pays = stage === "next" ? [a1] : paid ? [a1, a2, a3] : [];
        for (const [pi, amount] of pays.entries()) {
            rc += 1;
            keep("payments", await ClientPayment.create({ agency_uuid: agencyUuid, invoice_id: invoice.dataValues.id, receipt_number: `RCPT-D${String(rc).padStart(3, "0")}`, amount, method: pi === 0 ? "upi" : "razorpay", reference: `DEMO${900000 + rc}`, paid_at: at(L.start - 20 + pi * 7), received_by: ownerId }));
        }
    }

    // WhatsApp / email templates for travel events (free text; add your approved WhatsApp template names to use them outside 24 hours)
    const MSG: [string, string, string][] = [
        ["Quote sent", "quote_sent", "Hi {{name}}, here is your quote for {{trip}}: {{total}}. Full plan: {{link}}"],
        ["Itinerary shared", "itinerary_shared", "Hi {{name}}, here is your trip plan for {{trip}}: {{link}}"],
        ["Booking confirmed", "booking_confirmed", "Hi {{name}}, your trip {{trip}} is confirmed (booking {{booking_no}}), starting {{start_date}}. We will share vouchers soon."],
        ["Trip kit", "trip_kit", "Hi {{name}}, your tickets, vouchers and day plan for {{trip}}: {{link}}"],
        ["Trip tomorrow", "trip_tomorrow", "Hi {{name}}, your trip {{trip}} starts tomorrow! Have a wonderful time - call us any time."],
        ["Welcome back", "welcome_back", "Welcome back, {{name}}! We hope you loved {{trip}}. A quick review would mean a lot to us."],
    ];
    for (const [name, trigger, body] of MSG) keep("templates", await MessageTemplate.create({ agency_uuid: agencyUuid, name: `${name} (demo)`, channel: "whatsapp", trigger, body, is_active: false } as any));
    // monthly sales target for the owner
    // (leave a target the agency already set alone)
    if (!(await T.TravelTarget.findOne({ where: { agency_uuid: agencyUuid, agent_id: ownerId, month: iso(0).slice(0, 7) } }))) {
        keep("targets", await T.TravelTarget.create({ agency_uuid: agencyUuid, agent_id: ownerId, month: iso(0).slice(0, 7), amount: p(500000) }));
    }

    prefs.travel_demo = made;
    await Agent.update({ ui_prefs: JSON.stringify(prefs) }, { where: { id: ownerId } });
    clearModuleCache(agencyUuid);
    const count = Object.values(made).reduce((s, a) => s + a.length, 0);
    console.log(`Added ${count} demo records to ${agency.dataValues.app_name || sub}: ${LEADS.length} enquiries, ${qn} quotes, ${bn} bookings, ${inv} invoices, ${SUPPLIERS.length} suppliers, ${TEMPLATES.length} packages.`);
    await sequelize.close();
};

run().catch(async (e) => {
    console.error("Demo seed failed:", e?.parent?.sqlMessage || e?.message, e?.sql ? `\nSQL: ${String(e.sql).slice(0, 300)}` : "", e?.errors ? JSON.stringify(e.errors.map((x: any) => x.message)) : "");
    try { await (globalThis as any).__demoUndo?.(); console.error("Rolled back the rows this run had added."); } catch { /* ignore */ }
    try { await sequelize.close(); } catch { /* ignore */ }
    process.exit(1);
});
