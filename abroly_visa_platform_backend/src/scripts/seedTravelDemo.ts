/**
 * Demo agency for tourist & business visa clients: "Wanderly Visa & Travel".
 *
 *   npm run demo:seed:travel
 *
 * Wipes the previous travel demo agency (found by its owner phone AND name - never touches another agency)
 * and builds it again: branches, team, leads from every source with chats / follow-ups / timelines,
 * tourist and business visa cases at every stage (with itineraries, cover letters and funds checks),
 * fees and receipts, travel services and orders, appointments calendar, message templates, contact
 * requests, notifications, marketing spend, agency profile, portal banners, tasks and portal chats.
 * Nothing is emailed or messaged. Login codes are printed at the end (new codes on every run).
 *
 * Portal address: TRAVEL_DEMO_SUBDOMAIN.TRAVEL_DEMO_DOMAIN (default travel.techxsolutions.io).
 */
import dotenv from "dotenv";
dotenv.config();

import { Op } from "sequelize";
import sequelize from "../config/dbconfig";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (d: number, h = 10, m = 0) => { const x = new Date(now.getTime() + d * DAY); x.setHours(h, m, 0, 0); return x; };
const dateOnly = (d: number) => daysFromNow(d).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nice = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthKey = (offset: number) => { const d = new Date(now.getFullYear(), now.getMonth() + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const rupees = (r: number) => Math.round(r * 100); // money is stored in paise

const OWNER_PHONE = process.env.TRAVEL_DEMO_OWNER_PHONE || "9000000501";
const PORTAL_DOMAIN = process.env.TRAVEL_DEMO_DOMAIN || "techxsolutions.io";
const PORTAL_SUBDOMAIN = process.env.TRAVEL_DEMO_SUBDOMAIN || "travel";
const BRAND = { name: "Wanderly Visa & Travel", color: "#4f46e5", prefix: "WVT" };
const OWNER = { name: "Nikhil Shah", email: "nikhil@wanderly.example", designation: "Founder & Director" };

// ------------------------------------------------------------------ people
const TEAM = [
    { name: "Ritu Malhotra", phone: "9000000502", email: "ritu@wanderly.example", role: "branch_manager", branch: "Mumbai", designation: "Branch Manager" },
    { name: "Karan Bhatt", phone: "9000000503", email: "karan@wanderly.example", role: "counsellor", branch: "Ahmedabad", designation: "Senior Visa Consultant" },
    { name: "Sneha Kulkarni", phone: "9000000504", email: "sneha@wanderly.example", role: "counsellor", branch: "Mumbai", designation: "Visa Consultant" },
    { name: "Imran Sheikh", phone: "9000000505", email: "imran@wanderly.example", role: "documents", branch: "Ahmedabad", designation: "Documentation Officer" },
    { name: "Meena Joshi", phone: "9000000506", email: "meena@wanderly.example", role: "accounts", branch: "Ahmedabad", designation: "Accounts Executive" },
] as const;

const BRANCHES = [
    { name: "Ahmedabad", city: "Ahmedabad", address: "7th Floor, Venus Atlantis, Prahlad Nagar, Ahmedabad 380015", phone: "+91 79 4100 2200", email: "ahmedabad@wanderly.example", routing: ["Gandhinagar", "Vadodara", "Surat"] },
    { name: "Mumbai", city: "Mumbai", address: "Office 1204, One BKC, Bandra Kurla Complex, Mumbai 400051", phone: "+91 22 4100 3300", email: "mumbai@wanderly.example", routing: ["Pune", "Thane"] },
];

type Template = "schengen-tourist" | "schengen-business" | "uk-visitor" | "uk-business-visitor" | "usa-b1b2" | "canada-trv" | "dubai-tourist" | "australia-visitor-600";
type Stage = "documents" | "application" | "offer" | "funds" | "visa_filed" | "biometrics" | "decision";
type CaseSpec = { template: Template; destination: string; stage?: Stage; outcome?: "approved" | "rejected"; counsellor: string; hero?: boolean; travelIn: number; days: number };
type LeadSpec = {
    name: string; phone: string; city: string; country: string; visa: string; source: string;
    status: "new" | "contacted" | "follow_up" | "interested" | "counselling" | "lost" | "junk" | "convert";
    score: number; message: string; daysAgo: number; email?: string;
    followUp?: [number, number, number, string]; lost?: string; chat?: "whatsapp" | "instagram"; owner?: string; case?: CaseSpec;
};

const LEADS: LeadSpec[] = [
    // ---- converted to visa cases
    { name: "Mehul Desai", phone: "9000000601", city: "Ahmedabad", country: "Switzerland", visa: "Tourist Visa", source: "facebook", status: "convert", score: 91, daysAgo: 24, email: "mehul.desai@example.com", message: "Family trip to Switzerland in summer, 4 people", owner: "Karan Bhatt", chat: "whatsapp",
      case: { template: "schengen-tourist", destination: "Switzerland", stage: "application", counsellor: "Karan Bhatt", hero: true, travelIn: 45, days: 7 } },
    { name: "Rajesh Kothari", phone: "9000000602", city: "Surat", country: "Germany", visa: "Business Visa", source: "indiamart", status: "convert", score: 88, daysAgo: 20, email: "rajesh@kotharitextiles.example", message: "Need business visa for Heimtextil trade fair, Frankfurt", owner: "Karan Bhatt",
      case: { template: "schengen-business", destination: "Frankfurt, Germany", stage: "funds", counsellor: "Karan Bhatt", hero: true, travelIn: 30, days: 5 } },
    { name: "Anjali Mehta", phone: "9000000603", city: "Mumbai", country: "USA", visa: "Business / Tourist Visa (B1/B2)", source: "google", status: "convert", score: 84, daysAgo: 35, email: "anjali.mehta@example.com", message: "B1/B2 for client meetings in New York + holiday", owner: "Sneha Kulkarni", chat: "whatsapp",
      case: { template: "usa-b1b2", destination: "New York, USA", stage: "visa_filed", counsellor: "Sneha Kulkarni", travelIn: 60, days: 10 } },
    { name: "Sunil Patel", phone: "9000000604", city: "Vadodara", country: "United Kingdom", visa: "Tourist Visa", source: "website", status: "convert", score: 86, daysAgo: 48, email: "sunil.patel@example.com", message: "Visiting London and Scotland with wife", owner: "Karan Bhatt",
      case: { template: "uk-visitor", destination: "United Kingdom", outcome: "approved", counsellor: "Karan Bhatt", hero: true, travelIn: 12, days: 6 } },
    { name: "Hetal Shah", phone: "9000000605", city: "Ahmedabad", country: "United Arab Emirates", visa: "Tourist Visa", source: "instagram", status: "convert", score: 80, daysAgo: 15, email: "hetal.shah@example.com", message: "Dubai visa for 5 family members, Diwali trip", owner: "Sneha Kulkarni", chat: "instagram",
      case: { template: "dubai-tourist", destination: "Dubai, UAE", outcome: "approved", counsellor: "Sneha Kulkarni", travelIn: 8, days: 5 } },
    { name: "Farhan Qureshi", phone: "9000000606", city: "Mumbai", country: "Canada", visa: "Tourist Visa", source: "justdial", status: "convert", score: 76, daysAgo: 40, email: "farhan.q@example.com", message: "Visiting my brother in Toronto", owner: "Ritu Malhotra",
      case: { template: "canada-trv", destination: "Toronto, Canada", stage: "biometrics", counsellor: "Ritu Malhotra", travelIn: 75, days: 21 } },
    { name: "Pooja Iyer", phone: "9000000607", city: "Pune", country: "Australia", visa: "Tourist Visa", source: "facebook", status: "convert", score: 74, daysAgo: 18, email: "pooja.iyer@example.com", message: "Sydney + Melbourne holiday in March", owner: "Sneha Kulkarni",
      case: { template: "australia-visitor-600", destination: "Australia", stage: "offer", counsellor: "Sneha Kulkarni", travelIn: 90, days: 12 } },
    { name: "Vikram Rao", phone: "9000000608", city: "Mumbai", country: "United Kingdom", visa: "Business Visa", source: "website", status: "convert", score: 79, daysAgo: 6, email: "vikram.rao@rao-pharma.example", message: "Meetings with a distributor in Manchester", owner: "Ritu Malhotra",
      case: { template: "uk-business-visitor", destination: "Manchester, UK", stage: "documents", counsellor: "Ritu Malhotra", travelIn: 40, days: 4 } },
    { name: "Neel Joshi", phone: "9000000609", city: "Ahmedabad", country: "France", visa: "Tourist Visa", source: "google", status: "convert", score: 72, daysAgo: 9, email: "neel.joshi@example.com", message: "Honeymoon - Paris and Italy", owner: "Karan Bhatt", chat: "whatsapp",
      case: { template: "schengen-tourist", destination: "France and Italy", stage: "documents", counsellor: "Karan Bhatt", travelIn: 50, days: 8 } },
    { name: "Deepa Nair", phone: "9000000610", city: "Mumbai", country: "USA", visa: "Business / Tourist Visa (B1/B2)", source: "sulekha", status: "convert", score: 60, daysAgo: 55, email: "deepa.nair@example.com", message: "Tourist visa to visit daughter in Texas", owner: "Sneha Kulkarni",
      case: { template: "usa-b1b2", destination: "Texas, USA", outcome: "rejected", counsellor: "Sneha Kulkarni", travelIn: 30, days: 30 } },
    { name: "Amit Bansal", phone: "9000000611", city: "Surat", country: "Netherlands", visa: "Business Visa", source: "indiamart", status: "convert", score: 82, daysAgo: 22, email: "amit@bansalexports.example", message: "Business visa for 3 employees - Amsterdam meetings", owner: "Karan Bhatt",
      case: { template: "schengen-business", destination: "Amsterdam, Netherlands", stage: "offer", counsellor: "Karan Bhatt", travelIn: 35, days: 6 } },
    { name: "Kavita Reddy", phone: "9000000612", city: "Pune", country: "United Arab Emirates", visa: "Tourist Visa", source: "whatsapp", status: "convert", score: 70, daysAgo: 2, email: "kavita.reddy@example.com", message: "Dubai 30 day visa for 2", owner: "Sneha Kulkarni", chat: "whatsapp",
      case: { template: "dubai-tourist", destination: "Dubai, UAE", stage: "documents", counsellor: "Sneha Kulkarni", travelIn: 20, days: 6 } },

    // ---- open leads (inbox, follow-ups, chats)
    { name: "Rohit Agarwal", phone: "9000000613", city: "Ahmedabad", country: "Schengen", visa: "Tourist Visa", source: "facebook", status: "new", score: 66, daysAgo: 0, message: "Europe tour in May for 6 people - which visa?", chat: "whatsapp" },
    { name: "Nidhi Jain", phone: "9000000614", city: "Surat", country: "Singapore", visa: "Tourist Visa", source: "instagram", status: "new", score: 52, daysAgo: 0, message: "DM: Singapore visa charges?", chat: "instagram" },
    { name: "Harshad Mistry", phone: "9000000615", city: "Vadodara", country: "Germany", visa: "Business Visa", source: "indiamart", status: "new", score: 71, daysAgo: 1, message: "Business visa for Hannover Messe, 2 directors" },
    { name: "Sapna Thakur", phone: "9000000616", city: "Mumbai", country: "Japan", visa: "Tourist Visa", source: "google", status: "new", score: 48, daysAgo: 1, message: "Japan cherry blossom trip in April" },
    { name: "Gaurav Sethi", phone: "9000000617", city: "Pune", country: "USA", visa: "Business / Tourist Visa (B1/B2)", source: "website", status: "contacted", score: 63, daysAgo: 3, email: "gaurav.sethi@example.com", message: "Need earliest B1/B2 interview date", owner: "Sneha Kulkarni", followUp: [0, 11, 30, "Share interview slot options"] },
    { name: "Bhavna Trivedi", phone: "9000000618", city: "Ahmedabad", country: "United Kingdom", visa: "Tourist Visa", source: "facebook", status: "contacted", score: 58, daysAgo: 4, message: "Parents want to visit me in London", owner: "Karan Bhatt", chat: "whatsapp", followUp: [1, 12, 0, "Explain sponsor documents for parents"] },
    { name: "Manish Goyal", phone: "9000000619", city: "Surat", country: "China", visa: "Business Visa", source: "indiamart", status: "contacted", score: 69, daysAgo: 5, message: "Canton Fair business visa", owner: "Karan Bhatt", followUp: [-1, 16, 0, "Send invitation letter format - overdue"] },
    { name: "Ayesha Khan", phone: "9000000620", city: "Mumbai", country: "Schengen", visa: "Tourist Visa", source: "website", status: "follow_up", score: 64, daysAgo: 7, email: "ayesha.khan@example.com", message: "Spain + Portugal in June", owner: "Ritu Malhotra", followUp: [0, 15, 0, "Confirm travel dates and main country"] },
    { name: "Prakash Menon", phone: "9000000621", city: "Pune", country: "Canada", visa: "Tourist Visa", source: "justdial", status: "follow_up", score: 55, daysAgo: 8, message: "Visiting son for convocation", owner: "Ritu Malhotra", followUp: [0, 17, 30, "Call about invitation letter from son"] },
    { name: "Tejal Parikh", phone: "9000000622", city: "Ahmedabad", country: "Australia", visa: "Tourist Visa", source: "instagram", status: "follow_up", score: 51, daysAgo: 9, message: "Australia visa for parents", owner: "Sneha Kulkarni", chat: "instagram", followUp: [2, 11, 0, "Share checklist for senior citizens"] },
    { name: "Corporate - Shree Ceramics", phone: "9000000623", city: "Morbi", country: "Italy", visa: "Business Visa", source: "manual", status: "interested", score: 85, daysAgo: 10, email: "hr@shreeceramics.example", message: "5 employees for Cersaie fair, Bologna - corporate account", owner: "Karan Bhatt", followUp: [1, 16, 30, "Send corporate quote for 5 visas"] },
    { name: "Ravi Chandran", phone: "9000000624", city: "Mumbai", country: "USA", visa: "Business / Tourist Visa (B1/B2)", source: "google", status: "interested", score: 73, daysAgo: 11, message: "Family of 4, first US visa", owner: "Sneha Kulkarni", followUp: [3, 12, 0, "DS-160 forms - collect details"] },
    { name: "Swati Deshpande", phone: "9000000625", city: "Pune", country: "Schengen", visa: "Tourist Visa", source: "facebook", status: "counselling", score: 78, daysAgo: 12, message: "Booked office visit for Saturday", owner: "Ritu Malhotra", followUp: [2, 11, 0, "Office meeting - Europe itinerary"] },
    { name: "Jignesh Panchal", phone: "9000000626", city: "Surat", country: "United Arab Emirates", visa: "Business Visa", source: "whatsapp", status: "counselling", score: 68, daysAgo: 14, message: "Multiple entry business visa for Dubai", owner: "Karan Bhatt", chat: "whatsapp", followUp: [0, 18, 0, "Call about 90-day multiple entry"] },
    { name: "Lata Sharma", phone: "9000000627", city: "Ahmedabad", country: "Thailand", visa: "Tourist Visa", source: "sulekha", status: "lost", score: 22, daysAgo: 30, message: "Visa on arrival - did not need help", owner: "Karan Bhatt", lost: "Visa not required" },
    { name: "Dinesh Rawal", phone: "9000000628", city: "Vadodara", country: "Schengen", visa: "Tourist Visa", source: "google", status: "lost", score: 18, daysAgo: 38, message: "Went with a cheaper agent", owner: "Karan Bhatt", lost: "Price" },
    { name: "Test Enquiry", phone: "9000000629", city: "Mumbai", country: "-", visa: "-", source: "website", status: "junk", score: 2, daysAgo: 16, message: "test" },
    { name: "Komal Vyas", phone: "9000000630", city: "Ahmedabad", country: "Schengen", visa: "Tourist Visa", source: "instagram", status: "new", score: 57, daysAgo: 0, message: "DM: Switzerland visa for 2 adults, July", chat: "instagram" },
];

const CHATS: Record<string, [("in" | "out"), string, number][]> = {
    "Rohit Agarwal": [["in", "Hi, we are 6 people planning a Europe tour in May. Which visa do we need?", 42], ["out", "Hi Rohit! You need a Schengen tourist visa, applied to the country where you stay longest. Which countries are you covering?", 35], ["in", "France, Switzerland and Italy, mostly Switzerland", 22]],
    "Nidhi Jain": [["in", "Hello, what are your charges for a Singapore visa?", 18]],
    "Komal Vyas": [["in", "Switzerland visa for 2 adults in July - how much time does it take?", 12]],
    "Bhavna Trivedi": [["in", "My parents want to visit me in London for 3 months", 2 * 24 * 60], ["out", "Sure! They can apply for a UK Standard Visitor visa. I'll share the checklist and the sponsor letter format.", 2 * 24 * 60 - 30]],
    "Tejal Parikh": [["in", "Can my parents (68 and 65) apply for an Australia visa?", 3 * 24 * 60], ["out", "Yes, the subclass 600 visitor visa. A medical may be asked at their age - we'll guide them.", 3 * 24 * 60 - 40]],
    "Jignesh Panchal": [["in", "I travel to Dubai every month for business", 4 * 24 * 60], ["out", "A multiple-entry business visa will suit you. Shall I call you this evening?", 4 * 24 * 60 - 25]],
    "Mehul Desai": [["out", "Hi Mehul, your Switzerland itinerary and cover letter are ready in the client portal. Please check them.", 5 * 60], ["in", "Looks great! Can we add one more day in Interlaken?", 3 * 60]],
    "Anjali Mehta": [["in", "Got my US interview date!", 24 * 60], ["out", "Great news! Your mock interview is booked for Friday 4 pm.", 24 * 60 - 10]],
    "Neel Joshi": [["out", "Hi Neel, please upload both passports and 6 months of bank statements in the client portal.", 26 * 60], ["in", "Uploaded passports, statements by tomorrow", 22 * 60]],
    "Hetal Shah": [["out", "Your Dubai e-visas are approved for all 5 travellers! 🎉 Copies are in your portal.", 3 * 24 * 60], ["in", "Thank you so much, super quick!", 3 * 24 * 60 - 20]],
    "Kavita Reddy": [["in", "Sending passport photos now", 90]],
};

const SERVICES = [
    { name: "Travel Insurance (Schengen compliant)", category: "Insurance", price: 1200, gst: 18, delivery: "Same day", description: "EUR 30,000+ medical cover for every day of the trip. Accepted by all Schengen embassies." },
    { name: "Flight Reservation for Visa", category: "Bookings", price: 999, gst: 18, delivery: "Within 4 hours", description: "Verifiable return flight reservation (PNR) for your visa file - no full ticket needed." },
    { name: "Hotel Booking for Visa", category: "Bookings", price: 1499, gst: 18, delivery: "Same day", description: "Confirmed, refundable hotel bookings for every night of your itinerary." },
    { name: "Itinerary + Cover Letter", category: "Documentation", price: 2500, gst: 18, delivery: "1 working day", description: "Day-by-day itinerary and a personal or company cover letter, written for your embassy." },
    { name: "VFS / Embassy Appointment Booking", category: "Appointments", price: 1500, gst: 18, delivery: "1-3 days", description: "We find and book the earliest appointment slot and send reminders." },
    { name: "US Visa Mock Interview", category: "Interview prep", price: 3000, gst: 18, delivery: "1 session (45 min)", description: "One-on-one mock B1/B2 interview with feedback on answers and documents." },
    { name: "Forex & Travel Card", category: "Travel", price: 500, gst: 18, delivery: "1 day", description: "Best rates on currency and a multi-currency travel card delivered home." },
];

// itinerary plans for cases with travel documents
const PLANS: Record<string, [string, string, string][]> = {
    switzerland: [
        ["Zurich", "Arrive Zurich. Check in, evening walk at Bahnhofstrasse and Lake Zurich.", "Hotel Schweizerhof, Zurich"],
        ["Lucerne", "Train to Lucerne. Chapel Bridge, Old Town, Lake Lucerne cruise.", "Hotel des Balances, Lucerne"],
        ["Lucerne", "Day trip to Mount Titlis (Engelberg) - Cliff Walk and Ice Flyer.", "Hotel des Balances, Lucerne"],
        ["Interlaken", "Scenic train to Interlaken. Harder Kulm viewpoint.", "Hotel Interlaken"],
        ["Interlaken", "Day trip to Jungfraujoch - Top of Europe.", "Hotel Interlaken"],
        ["Geneva", "Train to Geneva. Jet d'Eau, Old Town, Palais des Nations.", "Hotel Cornavin, Geneva"],
        ["Geneva", "Check out, fly Geneva - Mumbai.", "-"],
    ],
    frankfurt: [
        ["Frankfurt", "Arrive Frankfurt. Check in near Messe Frankfurt.", "Mercure Hotel Frankfurt Messe"],
        ["Frankfurt", "Heimtextil trade fair - Hall 4, meetings with buyers (10:00 - 18:00).", "Mercure Hotel Frankfurt Messe"],
        ["Frankfurt", "Heimtextil trade fair - supplier meetings and booth visits.", "Mercure Hotel Frankfurt Messe"],
        ["Cologne", "Visit to buyer's office and warehouse in Cologne.", "Mercure Hotel Frankfurt Messe"],
        ["Frankfurt", "Wrap-up meeting, fly Frankfurt - Mumbai.", "-"],
    ],
    newyork: [
        ["New York", "Arrive JFK. Check in, Times Square.", "Hilton Midtown, New York"],
        ["New York", "Client meeting at Madison Avenue office (10:00 - 16:00).", "Hilton Midtown, New York"],
        ["New York", "Client workshop and dinner.", "Hilton Midtown, New York"],
        ["New York", "Statue of Liberty, 9/11 Memorial, Wall Street.", "Hilton Midtown, New York"],
        ["Washington DC", "Train to Washington DC. Capitol, Lincoln Memorial.", "Hotel Harrington, Washington DC"],
        ["Washington DC", "Smithsonian museums.", "Hotel Harrington, Washington DC"],
        ["Niagara Falls", "Fly to Buffalo. Niagara Falls - Maid of the Mist.", "Sheraton at the Falls"],
        ["New York", "Return to New York, Central Park.", "Hilton Midtown, New York"],
        ["New York", "Shopping and Broadway show.", "Hilton Midtown, New York"],
        ["New York", "Fly JFK - Mumbai.", "-"],
    ],
    uk: [
        ["London", "Arrive Heathrow. Check in, walk along the Thames.", "Park Plaza Westminster, London"],
        ["London", "Tower of London, Tower Bridge, London Eye.", "Park Plaza Westminster, London"],
        ["London", "Buckingham Palace, Westminster Abbey, British Museum.", "Park Plaza Westminster, London"],
        ["Edinburgh", "Train to Edinburgh. Edinburgh Castle, Royal Mile.", "Apex Grassmarket, Edinburgh"],
        ["Edinburgh", "Day tour of the Scottish Highlands and Loch Ness.", "Apex Grassmarket, Edinburgh"],
        ["London", "Train to London, fly Heathrow - Ahmedabad.", "-"],
    ],
    amsterdam: [
        ["Amsterdam", "Arrive Schiphol. Check in.", "NH Amsterdam Zuid"],
        ["Amsterdam", "Meetings at the importer's office, Zuidas (10:00 - 17:00).", "NH Amsterdam Zuid"],
        ["Rotterdam", "Port of Rotterdam - warehouse and logistics partner visit.", "NH Amsterdam Zuid"],
        ["Amsterdam", "Product presentation to retail buyers.", "NH Amsterdam Zuid"],
        ["Amsterdam", "Contract discussion and wrap-up.", "NH Amsterdam Zuid"],
        ["Amsterdam", "Fly Amsterdam - Mumbai.", "-"],
    ],
};

// travel documents per demo client (filled itinerary, cover letter, funds check)
const TRAVEL_DOCS: Record<string, { plan: string; purpose: string; from: string; travellers: [string, string, string][]; host?: string; kind: "tourist" | "business"; funds: [string, number, number, string]; flight: [string, string, string]; shared: boolean }> = {
    "Mehul Desai": { plan: "switzerland", purpose: "tourism", from: "Mumbai", kind: "tourist", shared: true,
        travellers: [["Mehul Desai", "Z4829173", "Self"], ["Priya Desai", "Z4829174", "Wife"], ["Aarav Desai", "Z5512980", "Son (12)"], ["Isha Desai", "Z5512981", "Daughter (9)"]],
        funds: ["switzerland", 1850000, 620000, "me (Mehul Desai)"], flight: ["Mumbai (BOM)", "Zurich (ZRH)", "LX 155"] },
    "Rajesh Kothari": { plan: "frankfurt", purpose: "conference", from: "Mumbai", kind: "business", shared: true,
        travellers: [["Rajesh Kothari", "W7731450", "Self"]], host: "Heimtextil 2027, Messe Frankfurt GmbH, Ludwig-Erhard-Anlage 1, 60327 Frankfurt am Main",
        funds: ["schengen", 2400000, 210000, "Kothari Textiles Pvt Ltd"], flight: ["Mumbai (BOM)", "Frankfurt (FRA)", "LH 757"] },
    "Anjali Mehta": { plan: "newyork", purpose: "business", from: "Mumbai", kind: "business", shared: false,
        travellers: [["Anjali Mehta", "V9021374", "Self"]], host: "Brightline Analytics Inc., 420 Madison Avenue, New York, NY 10017",
        funds: ["usa", 1600000, 380000, "Nexa Consulting Pvt Ltd"], flight: ["Mumbai (BOM)", "New York (JFK)", "AI 119"] },
    "Sunil Patel": { plan: "uk", purpose: "tourism", from: "Ahmedabad", kind: "tourist", shared: true,
        travellers: [["Sunil Patel", "T6620194", "Self"], ["Rekha Patel", "T6620195", "Wife"]],
        funds: ["uk", 1450000, 290000, "me (Sunil Patel)"], flight: ["Ahmedabad (AMD)", "London (LHR)", "AI 171"] },
    "Amit Bansal": { plan: "amsterdam", purpose: "business", from: "Mumbai", kind: "business", shared: false,
        travellers: [["Amit Bansal", "X1187420", "Director"], ["Rohan Gupta", "X2290183", "Export Manager"], ["Neha Kapoor", "X3301928", "Quality Head"]], host: "Holland Home Imports B.V., Gustav Mahlerlaan 300, 1082 ME Amsterdam",
        funds: ["schengen", 4200000, 540000, "Bansal Exports Pvt Ltd"], flight: ["Mumbai (BOM)", "Amsterdam (AMS)", "KL 878"] },
};

const STAGES = ["documents", "application", "offer", "funds", "visa_filed", "biometrics", "decision"] as const;

const xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bannerSvg = (title: string, sub: string, tag: string, color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
<rect width="1200" height="600" fill="url(#g)"/>
<circle cx="1040" cy="110" r="220" fill="#ffffff" opacity="0.07"/><circle cx="1120" cy="560" r="180" fill="#ffffff" opacity="0.05"/>
<path d="M760 420 q120 -160 300 -120" stroke="#ffffff" stroke-width="4" fill="none" stroke-dasharray="14 12" opacity="0.6"/>
<g transform="translate(1040 290) rotate(-20)"><path d="M-60 0 L60 0 L80 -10 L60 -16 L10 -16 L-20 -60 L-38 -60 L-20 -16 L-50 -16 L-62 -32 L-74 -32 L-66 -8 Z" fill="#ffffff" opacity="0.9"/></g>
<rect x="80" y="110" rx="22" width="${tag.length * 17 + 48}" height="44" fill="#fde68a"/><text x="104" y="141" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#78350f">${xml(tag)}</text>
<text x="80" y="250" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${xml(title)}</text>
<text x="80" y="320" font-family="Arial, sans-serif" font-size="30" fill="#e0e7ff">${xml(sub)}</text>
<text x="80" y="520" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" opacity="0.85">${xml(BRAND.name)}</text>
</svg>`;

const main = async () => {
    await sequelize.authenticate();
    const ModelInitializer = (await import("../config/modelInitializer")).default;
    const init = ModelInitializer.getInstance();
    if (!init.isModelInitialized()) init.setupAssociationsOnly();

    const Agent = (await import("../model/Agent")).default as any;
    const User = (await import("../model/User")).default as any;
    const CrmLead = (await import("../model/CrmLead")).default as any;
    const CrmLeadActivity = (await import("../model/CrmLeadActivity")).default as any;
    const AgencyLeads = (await import("../model/AgencyLeads")).default as any;
    const RaisedApplications = (await import("../model/RaisedApplications")).default as any;
    const Step = (await import("../model/Step")).default as any;
    const Question = (await import("../model/Question")).default as any;
    const AgencyBranch = (await import("../model/AgencyBranch")).default as any;
    const AgencyService = (await import("../model/AgencyService")).default as any;
    const ServiceOrder = (await import("../model/ServiceOrder")).default as any;
    const ServiceOrderUpdate = (await import("../model/ServiceOrderUpdate")).default as any;
    const ClientInvoice = (await import("../model/ClientInvoice")).default as any;
    const ClientPayment = (await import("../model/ClientPayment")).default as any;
    const MessageTemplate = (await import("../model/MessageTemplate")).default as any;
    const Notification = (await import("../model/Notification")).default as any;
    const ContactUs = (await import("../model/ContactUs")).default as any;
    const LeadsCalendar = (await import("../model/LeadsCalendar")).default as any;
    const MarketingSpend = (await import("../model/MarketingSpend")).default as any;
    const VisaTemplate = (await import("../model/VisaTemplate")).default as any;
    const SaasSubscription = (await import("../model/SaasSubscription")).default as any;
    const SaasPayment = (await import("../model/SaasPayment")).default as any;
    const SaasPlan = (await import("../model/SaasPlan")).default as any;
    const ActivityLog = (await import("../model/ActivityLog")).default as any;
    const SideBanner = (await import("../model/SideBanner")).default as any;
    const AgencyTask = (await import("../model/AgencyTask")).default as any;
    const PortalChatMessage = (await import("../model/PortalChatMessage")).default as any;
    const { AgentProfile, BranchOffice, Language } = (await import("../model/AgentProfile")) as any;
    const { applyPeriod, ensureDefaultPlans } = await import("../services/saas");
    const { convertLeadToCase } = await import("../services/leadConversion");
    const { findLibraryTemplate } = await import("../services/visaTemplateLibrary");
    const { normalizePhone } = await import("../services/leadIngestion");
    const { sanitizeTravelDocs } = await import("../services/travelDocs");
    const { nextNumber, recordPayment } = await import("../v1/controller/FeesController");
    const { createOrderForInvoice } = await import("../v1/controller/ServiceOrderController");
    const { setLoginCode, setStudentLoginCode } = await import("../services/agencyLogin");

    const setTimes = async (table: string, id: number, at: Date) =>
        sequelize.query(`UPDATE \`${table}\` SET createdAt = ?, updatedAt = ? WHERE id = ?`, { replacements: [at, at, id] });

    // ---------------------------------------------------------------- 0. safety: only ever touch our own demo agency
    const teamPhones = [OWNER_PHONE, ...TEAM.map((t) => t.phone)];
    const owners: any[] = await Agent.findAll({ where: { phone_number: OWNER_PHONE, role: "agent" }, paranoid: false });
    const foreign = owners.find((o) => o.dataValues.app_name !== BRAND.name);
    if (foreign) throw new Error(`Owner phone ${OWNER_PHONE} belongs to another agency ("${foreign.dataValues.app_name || foreign.dataValues.username}"). Set TRAVEL_DEMO_OWNER_PHONE.`);
    const old: any = owners[0] || null;
    const strangers: any[] = await Agent.findAll({ where: { phone_number: teamPhones, ...(old ? { [Op.and]: [{ id: { [Op.ne]: old.dataValues.id } }, { [Op.or]: [{ parent_uuid: { [Op.ne]: old.dataValues.uuid } }, { parent_uuid: null }] }] } : {}) }, paranoid: false, raw: true });
    if (strangers.length) throw new Error(`Demo team phones are already used by other accounts: ${strangers.map((s) => s.phone_number).join(", ")}`);

    // ---------------------------------------------------------------- 1. wipe the previous travel demo
    if (old) {
        const ag = old.dataValues;
        const team: any[] = await Agent.findAll({ where: { parent_uuid: ag.uuid }, attributes: ["id"], paranoid: false, raw: true });
        const staffIds = [ag.id, ...team.map((t) => t.id)];
        const students: any[] = await User.findAll({ where: { agency_uuid: ag.uuid }, attributes: ["id", "uuid"], paranoid: false, raw: true });
        const studentIds = students.map((s) => s.id);
        const cases: any[] = await AgencyLeads.findAll({ where: { agent_uuid: ag.uuid }, attributes: ["id"], paranoid: false, raw: true });
        const caseIds = cases.map((c) => c.id);
        const steps: any[] = caseIds.length ? await Step.findAll({ where: { lead_id: caseIds }, attributes: ["id"], paranoid: false, raw: true }) : [];
        const orders: any[] = await ServiceOrder.findAll({ where: { agency_uuid: ag.uuid }, attributes: ["id"], raw: true });
        const f = { force: true } as const;
        if (steps.length) await Question.destroy({ where: { step_id: steps.map((s) => s.id) }, ...f });
        if (caseIds.length) await Step.destroy({ where: { lead_id: caseIds }, ...f });
        await AgencyLeads.destroy({ where: { agent_uuid: ag.uuid }, ...f });
        if (studentIds.length) await RaisedApplications.destroy({ where: { student_id: studentIds }, ...f });
        if (orders.length) await ServiceOrderUpdate.destroy({ where: { order_id: orders.map((o) => o.id) } });
        await ServiceOrder.destroy({ where: { agency_uuid: ag.uuid } });
        await ClientPayment.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await ClientInvoice.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await AgencyService.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await AgencyTask.destroy({ where: { agency_uuid: ag.uuid }, ...f }).catch(() => AgencyTask.destroy({ where: { agency_uuid: ag.uuid } }));
        await PortalChatMessage.destroy({ where: { agency_uuid: ag.uuid } });
        await CrmLeadActivity.destroy({ where: { agency_uuid: ag.uuid } });
        await CrmLead.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await LeadsCalendar.destroy({ where: { [Op.or]: [{ created_by: staffIds }, { assgin_to: staffIds }] }, ...f });
        await ContactUs.destroy({ where: { agent_id: staffIds }, ...f });
        await SideBanner.destroy({ where: { agent_uuid: ag.uuid }, ...f }).catch(() => SideBanner.destroy({ where: { agent_uuid: ag.uuid } }));
        for (const M of [AgentProfile, BranchOffice, Language]) await M.destroy({ where: { agent_uuid: ag.uuid }, ...f }).catch(() => {});
        for (const M of [MessageTemplate, Notification, MarketingSpend, VisaTemplate, AgencyBranch, SaasSubscription, SaasPayment, ActivityLog]) {
            await M.destroy({ where: { agency_uuid: ag.uuid }, ...f }).catch(() => M.destroy({ where: { agency_uuid: ag.uuid } }));
        }
        if (studentIds.length) await User.destroy({ where: { id: studentIds }, ...f });
        await Agent.destroy({ where: { id: staffIds }, ...f });
        console.log(`Removed the previous travel demo (${staffIds.length} staff, ${studentIds.length} clients, ${caseIds.length} cases).`);
    }

    const clash: any = await Agent.findOne({ where: { domain: PORTAL_DOMAIN, sudomain: PORTAL_SUBDOMAIN, role: "agent" } });
    if (clash) throw new Error(`Portal address ${PORTAL_SUBDOMAIN}.${PORTAL_DOMAIN} is already used by "${clash.dataValues.app_name || clash.dataValues.username}". Set TRAVEL_DEMO_SUBDOMAIN.`);

    // ---------------------------------------------------------------- 2. agency, plan, branches, team
    await ensureDefaultPlans();
    const plans: any[] = await SaasPlan.findAll({ order: [["price_yearly", "DESC"]] });
    const plan = plans.find((p) => p.dataValues.name === "Pro") || plans[0];
    const owner: any = await Agent.create({
        username: OWNER.name, app_name: BRAND.name, email: OWNER.email,
        phone_number: OWNER_PHONE, country_code: "+91", role: "agent", status: "active", is_verified: 1,
        designation: OWNER.designation, primary_color: BRAND.color,
        support_number: "+91 98790 00000", support_email: "hello@wanderly.example",
        agency_address: "7th Floor, Venus Atlantis, Prahlad Nagar, Ahmedabad, Gujarat 380015",
        meta_description: "Tourist and business visa experts - Schengen, UK, USA, Canada, Dubai and Australia. Itinerary, cover letters, insurance and appointments handled for you.",
        domain: PORTAL_DOMAIN, sudomain: PORTAL_SUBDOMAIN, expires_at: new Date(), saas_plan_id: plan.dataValues.id,
        ui_prefs: JSON.stringify({ checklist_hidden: true, business_focus: "travel" }),
        billing_settings: JSON.stringify({
            legal_name: "Wanderly Visa & Travel Pvt Ltd", gstin: "24AACCW4321K1Z2",
            address: "7th Floor, Venus Atlantis, Prahlad Nagar, Ahmedabad, Gujarat 380015",
            invoice_prefix: BRAND.prefix, default_gst_percent: 18, upi_id: "wanderly@icici",
            bank_details: "ICICI Bank, A/c 012305004321, IFSC ICIC0000123", terms: "Service fees are non-refundable once the application is submitted. Embassy / VFS fees are paid at actuals.",
        }),
    });
    const agencyUuid = owner.dataValues.uuid, agencyId = owner.dataValues.id;
    await applyPeriod({ agencyUuid, planId: plan.dataValues.id, kind: "complimentary", startsAt: daysFromNow(-60), endsAt: daysFromNow(305), note: "Travel demo agency", adminId: null });

    const branchByName: Record<string, number> = {};
    for (const b of BRANCHES) {
        const row: any = await AgencyBranch.create({ agency_uuid: agencyUuid, name: b.name, city: b.city, address: b.address, phone: b.phone, email: b.email, routing_cities: b.routing });
        branchByName[b.name] = row.dataValues.id;
    }
    const staffByName: Record<string, number> = { [OWNER.name]: agencyId };
    const codes: { who: string; phone: string; code: string }[] = [{ who: `${OWNER.name} (owner)`, phone: OWNER_PHONE, code: await setLoginCode(agencyId) }];
    for (const t of TEAM) {
        const m: any = await Agent.create({
            username: t.name, email: t.email, phone_number: t.phone, country_code: "+91", role: "sub-agent", status: "active", is_verified: 1,
            designation: t.designation, team_role: t.role, branch_id: branchByName[t.branch], parent_uuid: agencyUuid, parent_id: agencyId,
        });
        staffByName[t.name] = m.dataValues.id;
        codes.push({ who: `${t.name} (${t.designation})`, phone: t.phone, code: await setLoginCode(m.dataValues.id) });
    }
    const branchOfStaff = (name?: string) => branchByName[TEAM.find((x) => x.name === name)?.branch || "Ahmedabad"];

    const templates: Record<string, any> = {};
    for (const key of ["schengen-tourist", "schengen-business", "uk-visitor", "uk-business-visitor", "usa-b1b2", "canada-trv", "dubai-tourist", "australia-visitor-600"]) {
        const lib: any = findLibraryTemplate(key);
        if (!lib) throw new Error(`Template ${key} missing from the library`);
        templates[key] = lib;
        await VisaTemplate.create({ agency_uuid: agencyUuid, name: lib.name, country: lib.country, visa_type: lib.visa_type, description: lib.description, steps: lib.steps, based_on: key, created_by: agencyId });
    }

    // ---------------------------------------------------------------- 3. leads (+ timelines, chats, follow-ups)
    const leadByName: Record<string, any> = {};
    for (const l of LEADS) {
        const created = daysFromNow(-l.daysAgo, 9 + (l.phone.charCodeAt(9) % 8), (l.phone.charCodeAt(8) * 7) % 60);
        if (created > now) created.setTime(now.getTime() - 45 * 60 * 1000);
        const assignee = l.owner ? staffByName[l.owner] : null;
        const fu = l.followUp ? daysFromNow(l.followUp[0], l.followUp[1], l.followUp[2]) : null;
        const lead: any = await CrmLead.create({
            agency_uuid: agencyUuid, name: l.name, country_code: "+91", phone_number: l.phone, phone_normalized: normalizePhone(l.phone, "+91")?.normalized || null,
            email: l.email || null, city: l.city, interested_country: l.country, interested_course: l.visa, visa_type: l.visa,
            message: l.message, source: l.source, source_ref: l.chat === "instagram" ? `ig_${l.phone.slice(-4)}` : null,
            status: l.status === "convert" ? "interested" : l.status, lost_reason: l.lost || null, score: l.score,
            assigned_to: assignee, branch_id: assignee ? branchOfStaff(l.owner) : branchByName.Ahmedabad,
            next_follow_up_at: fu, follow_up_note: l.followUp ? l.followUp[3] : null, last_activity_at: created, enquiry_count: 1,
        });
        await setTimes("crm_leads", lead.dataValues.id, created);
        const act = async (type: string, message: string, at: Date, by: number | null = null, meta: any = null) => {
            const a: any = await CrmLeadActivity.create({ lead_id: lead.dataValues.id, agency_uuid: agencyUuid, type, message, meta, created_by: by });
            await setTimes("crm_lead_activities", a.dataValues.id, at);
        };
        await act("created", `Lead received via ${l.source}`, created);
        if (assignee) await act("assignment", `Assigned to ${l.owner}`, new Date(created.getTime() + 20 * 60 * 1000), agencyId);
        if (!["new", "junk"].includes(l.status) && assignee) {
            await act("call", "Call: discussed destination, travel dates and documents", new Date(created.getTime() + DAY / 2), assignee);
            await act("note", `Shared ${l.country} ${l.visa.toLowerCase()} checklist and fees`, new Date(created.getTime() + DAY), assignee);
        }
        if (l.status === "lost") await act("status_change", `Marked lost: ${l.lost}`, new Date(created.getTime() + 3 * DAY), assignee);
        if (fu) await act("follow_up", `Follow-up set: ${l.followUp![3]}`, new Date(Math.min(now.getTime() - 60 * 60 * 1000, created.getTime() + 2 * DAY)), assignee);
        for (const [dir, text, minsAgo] of CHATS[l.name] || []) {
            await act(l.chat || "whatsapp", text, new Date(now.getTime() - minsAgo * 60 * 1000), dir === "out" ? assignee || agencyId : null, { direction: dir });
        }
        const lastChat = (CHATS[l.name] || []).reduce((m, c) => Math.min(m, c[2]), Infinity);
        if (lastChat !== Infinity) await CrmLead.update({ last_activity_at: new Date(now.getTime() - lastChat * 60 * 1000) }, { where: { id: lead.dataValues.id } });
        leadByName[l.name] = lead;
    }

    // ---------------------------------------------------------------- 4. visa cases at every stage (real conversion)
    const caseOf: Record<string, { id: number; studentId: number; spec: CaseSpec; lead: LeadSpec }> = {};
    for (const l of LEADS.filter((x) => x.case)) {
        const spec = l.case!;
        const tpl = templates[spec.template];
        const lead = await CrmLead.findByPk(leadByName[l.name].dataValues.id);
        const counsellorId = staffByName[spec.counsellor];
        const travelStart = dateOnly(spec.outcome ? -spec.travelIn + 40 : spec.travelIn);
        const result: any = await convertLeadToCase({
            agencyUuid, agencyId, userId: counsellorId, lead, country: l.country, intake: null, course: null, visaType: tpl.visa_type,
            university: null, assignTo: counsellorId, branchId: branchOfStaff(spec.counsellor), template: tpl,
        });
        const caseId = result.caseId, studentId = result.studentId;
        const convertedAt = new Date(now.getTime() - Math.max(1, l.daysAgo - 2) * DAY);
        await setTimes("agency_leads", caseId, convertedAt);
        await sequelize.query("UPDATE crm_leads SET converted_at = ? WHERE id = ?", { replacements: [convertedAt, lead.dataValues.id] });
        await setTimes("user", studentId, convertedAt);

        const steps: any[] = await Step.findAll({ where: { lead_id: caseId }, order: [["step_order", "ASC"]] });
        const stageIdx = spec.outcome ? STAGES.length : STAGES.indexOf(spec.stage || "documents");
        const doneCount = spec.outcome ? steps.length : Math.min(steps.length - 1, Math.round((steps.length * stageIdx) / STAGES.length));
        for (const [i, st] of steps.entries()) {
            const done = i < doneCount;
            await Step.update({
                step_status: done ? 1 : 0,
                due_date: done ? null : dateOnly(i === doneCount ? (l.name === "Neel Joshi" ? -1 : 2 + (i % 3)) : 5 + i * 3),
            }, { where: { id: st.dataValues.id } });
            if (done) await Question.update({ status: "completed", question_answer: "Received and verified" }, { where: { step_id: st.dataValues.id } });
        }
        const caseStatus = spec.outcome === "approved" ? "visa_completed" : spec.outcome === "rejected" ? "visa_rejected" : "visa_progress";
        const visaDates: any = {};
        if (spec.outcome || ["visa_filed", "biometrics"].includes(spec.stage || "")) visaDates.visa_lodged_on = dateOnly(spec.outcome ? -20 : -6);
        if (spec.stage === "biometrics") visaDates.biometrics_on = dateOnly(3);
        if (spec.stage === "visa_filed" && spec.template === "usa-b1b2") visaDates.biometrics_on = dateOnly(9);
        if (spec.outcome) visaDates.decision_on = dateOnly(-5);
        await AgencyLeads.update({
            status: caseStatus, case_stage: spec.outcome ? "decision" : spec.stage, stage_updated_at: new Date(now.getTime() - (1 + (caseId % 5)) * DAY), ...visaDates,
            ...(spec.outcome === "rejected" && { reason: "Refused under 214(b): ties to India not shown strongly enough. Reapply with property papers and a longer travel history." }),
        }, { where: { id: caseId }, silent: true });

        // documents waiting for review
        if (!spec.outcome && ["documents", "application"].includes(spec.stage!)) {
            const openStep = steps[doneCount];
            if (openStep) {
                const qs: any[] = await Question.findAll({ where: { step_id: openStep.dataValues.id }, order: [["id", "ASC"]], limit: 2 });
                for (const q of qs) {
                    await Question.update({ status: "provided", question_answer: q.dataValues.question_type === "text_input" ? "Switzerland, 7 days in June - Zurich, Lucerne, Interlaken, Geneva" : "Uploaded via client portal" }, { where: { id: q.dataValues.id } });
                }
            }
        }
        // one document sent back for a redo (shows the red "please redo" item in the portal)
        if (l.name === "Neel Joshi") {
            const q: any = await Question.findOne({ where: { step_id: steps[0].dataValues.id, question_type: "file_selector" }, order: [["id", "ASC"]] });
            if (q) await Question.update({ status: "rejected", reason: "Passport scan is blurry - please upload a clear colour scan" }, { where: { id: q.dataValues.id } });
        }

        // itinerary, cover letter, funds check
        const td = TRAVEL_DOCS[l.name];
        if (td) {
            const plan = PLANS[td.plan];
            const start = travelStart, end = addDays(start, plan.length - 1);
            const first = td.travellers[0][0];
            const business = td.kind === "business";
            const cities = [...new Set(plan.map((p) => p[0]))].join(", ");
            const docs = sanitizeTravelDocs({
                trip: { purpose: td.purpose, destination: spec.destination, from_city: td.from, start_date: start, end_date: end, host: td.host || "",
                    travellers: td.travellers.map(([name, passport_no, relation]) => ({ name, passport_no, relation })) },
                itinerary: plan.map(([city, p, stay], i) => ({ date: addDays(start, i), city, plan: p, stay })),
                flights: [{ date: start, from: td.flight[0], to: td.flight[1], flight: td.flight[2] }, { date: end, from: td.flight[1], to: td.flight[0], flight: td.flight[2].replace(/\d+$/, (n) => String(Number(n) + 1)) }],
                cover_letter: business ? {
                    kind: "business", addressed_to: `The Visa Officer\nEmbassy / Consulate of ${l.country}\nMumbai`,
                    subject: `${tpl.visa_type} for ${first} - business visit ${nice(start)} to ${nice(end)}`,
                    body: `Respected Sir / Madam,\n\nWe request you to kindly grant a ${tpl.visa_type} to ${td.travellers.length > 1 ? `our team led by ${first}` : `our ${td.travellers[0][2] === "Self" ? "director" : "employee"} ${first}`} (passport no. ${td.travellers[0][1]}), who will travel to ${spec.destination} from ${nice(start)} to ${nice(end)} to ${td.purpose === "conference" ? "attend the trade fair and meet buyers" : "attend business meetings"} with ${(td.host || "").split(",")[0]}.\n\nDuring the visit the team will be in ${cities}. The detailed itinerary, the invitation letter, flight reservation and hotel bookings are enclosed.\n\nAll expenses of the trip - travel, stay, insurance and daily expenses - will be borne by ${td.funds[3]}. The travellers will return to India after the visit to continue their duties.\n\nWe confirm that the purpose of this visit is business only and no paid work will be done abroad. Our company registration, GST certificate, bank statements and income tax returns are enclosed.\n\nThank you for your consideration.`,
                    signed_by: `For ${td.funds[3]}\n\n\nAuthorised signatory\n${first}, Director`,
                } : {
                    kind: "tourist", addressed_to: `The Visa Officer\nEmbassy / Consulate of ${l.country}\nMumbai`,
                    subject: `Application for a ${tpl.visa_type} from ${nice(start)} to ${nice(end)}`,
                    body: `Respected Sir / Madam,\n\nI, ${first}, holder of Indian passport no. ${td.travellers[0][1]}, am applying for a ${tpl.visa_type} to visit ${spec.destination} from ${nice(start)} to ${nice(end)} (${plan.length} days) for tourism.${td.travellers.length > 1 ? ` I will be travelling with ${td.travellers.slice(1).map(([n, , r]) => `${n} (${r.toLowerCase()})`).join(", ")}.` : ""}\n\nDuring the trip we plan to visit ${cities}. Our day-by-day itinerary, return flight reservation, hotel bookings and travel insurance are enclosed.\n\nAll the expenses of this trip will be borne by ${td.funds[3]}. My bank statements for the last six months and income tax returns for the last three years are enclosed as proof of funds.\n\nI run a family business in India and have strong family and financial ties here. We will return to India at the end of the trip and will follow all the conditions of the visa.\n\nI request you to kindly grant us the visa. Thank you for your time and consideration.`,
                    signed_by: `Yours sincerely,\n\n\n${first}`,
                },
                funds: { country_key: td.funds[0], days: plan.length, balance: td.funds[1], trip_cost: td.funds[2], sponsor: td.funds[3] },
                shared: td.shared, updated_at: daysFromNow(-1, 15).toISOString(),
            });
            await AgencyLeads.update({ travel_docs: JSON.stringify(docs) }, { where: { id: caseId }, silent: true });
        }
        caseOf[l.name] = { id: caseId, studentId, spec, lead: l };
        if (spec.hero) codes.push({ who: `${l.name} (client, ${spec.outcome || spec.stage})`, phone: l.phone, code: await setStudentLoginCode(studentId) });
    }

    // ---------------------------------------------------------------- 5. services, fees, receipts, service orders
    const serviceIds: number[] = [];
    for (const [i, s] of SERVICES.entries()) {
        const row: any = await AgencyService.create({ agency_uuid: agencyUuid, name: s.name, category: s.category, description: s.description, price: rupees(s.price), gst_percent: s.gst, delivery: s.delivery, active: true, sort_order: i, created_by: agencyId });
        serviceIds.push(row.dataValues.id);
    }
    const invoice = async (o: { name: string; title: string; lines: [string, number][]; gst: number; issuedDaysAgo: number; dueIn: number; installments?: [string, number, number][]; payments?: [number, string, number, string?][]; serviceIndex?: number }) => {
        const c = caseOf[o.name];
        const items = o.lines.map(([description, amount]) => ({ description, amount: rupees(amount) }));
        const subtotal = items.reduce((s, i) => s + i.amount, 0);
        const gstAmount = Math.round((subtotal * o.gst) / 100);
        const total = subtotal + gstAmount;
        const inst = o.installments?.map(([label, share, due]) => ({ label, amount: Math.round(total * share), due_date: dateOnly(due) }));
        if (inst) inst[inst.length - 1].amount = total - inst.slice(0, -1).reduce((s, i) => s + i.amount, 0);
        const inv: any = await sequelize.transaction(async (t: any) => ClientInvoice.create({
            agency_uuid: agencyUuid, number: await nextNumber(agencyUuid, BRAND.prefix, t), student_id: c.studentId, case_id: c.id,
            branch_id: branchOfStaff(c.spec.counsellor), title: o.title, items, subtotal, gst_percent: o.gst, gst_amount: gstAmount, total,
            issue_date: dateOnly(-o.issuedDaysAgo), due_date: inst ? inst[inst.length - 1].due_date : dateOnly(o.dueIn), installments: inst || null,
            notes: `Thank you for choosing ${BRAND.name}. Embassy / VFS fees are paid at actuals.`, created_by: staffByName["Meena Joshi"],
            service_id: o.serviceIndex !== undefined ? serviceIds[o.serviceIndex] : null,
        }, { transaction: t }));
        await setTimes("client_invoices", inv.dataValues.id, daysFromNow(-o.issuedDaysAgo, 11));
        for (const [share, method, daysAgo, ref] of o.payments || []) {
            const fresh: any = await ClientInvoice.findByPk(inv.dataValues.id);
            const amount = share >= 1 ? Number(fresh.dataValues.total) - Number(fresh.dataValues.amount_paid) : Math.round(total * share);
            const p: any = await recordPayment(fresh, amount, method, { reference: ref || null, paidAt: daysFromNow(-daysAgo, 15), userId: staffByName["Meena Joshi"] });
            await setTimes("client_payments", p.dataValues.id, daysFromNow(-daysAgo, 15));
        }
        return inv;
    };
    const fam = (n: number, fee: number): [string, number][] => [[`Visa service fee (${n} traveller${n > 1 ? "s" : ""})`, fee * n]];
    await invoice({ name: "Mehul Desai", title: "Schengen tourist visa - family of 4", lines: [...fam(4, 6500), ["Embassy + VFS fees (at actuals)", 37600]], gst: 18, issuedDaysAgo: 20, dueIn: 3,
        installments: [["Advance", 0.5, -19], ["Before appointment", 0.5, 3]], payments: [[0.5, "upi", 18, "UTR 3301 8890 1123"]] });
    await invoice({ name: "Rajesh Kothari", title: "Schengen business visa", lines: [...fam(1, 8500), ["Embassy + VFS fees (at actuals)", 9400]], gst: 18, issuedDaysAgo: 17, dueIn: -2 }); // unpaid, overdue
    await invoice({ name: "Anjali Mehta", title: "USA B1/B2 visa", lines: [...fam(1, 7500), ["MRV visa fee (at actuals)", 15200]], gst: 18, issuedDaysAgo: 32, dueIn: -20, payments: [[1, "card", 30, "POS 55120"]] });
    await invoice({ name: "Sunil Patel", title: "UK visitor visa - 2 travellers", lines: [...fam(2, 6000), ["UK visa fees (at actuals)", 28800]], gst: 18, issuedDaysAgo: 45, dueIn: -30, payments: [[1, "bank_transfer", 42, "NEFT ICIC0000123"]] });
    await invoice({ name: "Hetal Shah", title: "Dubai tourist visa - 5 travellers", lines: [["Dubai 30-day e-visa incl. govt fee (x5)", 7500 * 5]], gst: 18, issuedDaysAgo: 14, dueIn: -10, payments: [[1, "upi", 13, "UTR 7781 0042 5590"]] });
    await invoice({ name: "Farhan Qureshi", title: "Canada visitor visa", lines: [...fam(1, 7000), ["IRCC + biometrics fees (at actuals)", 10500]], gst: 18, issuedDaysAgo: 36, dueIn: -15, payments: [[0.6, "cash", 35, "Receipt 2041"], [1, "upi", 10, "UTR 1120 4471 8820"]] });
    await invoice({ name: "Pooja Iyer", title: "Australia visitor visa (600)", lines: [...fam(1, 6500), ["Department visa fee (at actuals)", 11300]], gst: 18, issuedDaysAgo: 15, dueIn: 6, payments: [[0.4, "upi", 14, "UTR 5590 2210 3345"]] });
    await invoice({ name: "Vikram Rao", title: "UK business visitor visa", lines: [...fam(1, 7500), ["UK visa fee (at actuals)", 14400]], gst: 18, issuedDaysAgo: 4, dueIn: 2 }); // unpaid, due soon
    await invoice({ name: "Amit Bansal", title: "Schengen business visa - 3 employees", lines: [...fam(3, 8000), ["Embassy + VFS fees (at actuals)", 28200]], gst: 18, issuedDaysAgo: 19, dueIn: 10,
        installments: [["Advance", 0.5, -18], ["On visa approval", 0.5, 10]], payments: [[0.5, "bank_transfer", 17, "RTGS BANSALEXP 0091"]] });
    await invoice({ name: "Neel Joshi", title: "Schengen tourist visa - couple", lines: [...fam(2, 6500), ["Embassy + VFS fees (at actuals)", 18800]], gst: 18, issuedDaysAgo: 7, dueIn: 1, payments: [[0.3, "upi", 6, "UTR 6620 1180 2203"]] });
    const svcInvoices = [
        await invoice({ name: "Mehul Desai", title: SERVICES[3].name, lines: [[SERVICES[3].name, SERVICES[3].price]], gst: 18, issuedDaysAgo: 5, dueIn: 0, serviceIndex: 3, payments: [[1, "upi", 5, "Razorpay pay_Demo4471"]] }),
        await invoice({ name: "Rajesh Kothari", title: SERVICES[0].name, lines: [[SERVICES[0].name, SERVICES[0].price]], gst: 18, issuedDaysAgo: 9, dueIn: 0, serviceIndex: 0, payments: [[1, "upi", 9, "Razorpay pay_Demo2209"]] }),
        await invoice({ name: "Anjali Mehta", title: SERVICES[5].name, lines: [[SERVICES[5].name, SERVICES[5].price]], gst: 18, issuedDaysAgo: 3, dueIn: 0, serviceIndex: 5, payments: [[1, "card", 3, "POS 88014"]] }),
        await invoice({ name: "Pooja Iyer", title: SERVICES[1].name, lines: [[SERVICES[1].name, SERVICES[1].price]], gst: 18, issuedDaysAgo: 1, dueIn: 0, serviceIndex: 1, payments: [[1, "upi", 1, "Razorpay pay_Demo9930"]] }),
        await invoice({ name: "Sunil Patel", title: SERVICES[6].name, lines: [[SERVICES[6].name, SERVICES[6].price]], gst: 18, issuedDaysAgo: 8, dueIn: 0, serviceIndex: 6, payments: [[1, "upi", 8, "UTR 2203 7781 4410"]] }),
    ];
    const orderPlan: [string, string, string[]][] = [
        ["delivered", "Karan Bhatt", ["Itinerary drafted: Zurich - Lucerne - Interlaken - Geneva", "Itinerary and cover letter shared in your portal - please confirm or ask for changes"]],
        ["completed", "Imran Sheikh", ["Policy issued: EUR 50,000 cover, Schengen compliant", "Insurance certificate added to the visa file"]],
        ["in_progress", "Sneha Kulkarni", ["Mock interview booked for Friday 4 pm", "Shared the top 25 B1/B2 interview questions"]],
        ["new", "Imran Sheikh", []],
        ["completed", "Meena Joshi", ["Forex card loaded with GBP 1,500", "Card delivered home"]],
    ];
    for (const [i, inv] of svcInvoices.entries()) {
        const order: any = await createOrderForInvoice(await ClientInvoice.findByPk(inv.dataValues.id));
        const [status, who, notes] = orderPlan[i];
        for (const msg of notes) await ServiceOrderUpdate.create({ order_id: order.dataValues.id, agency_uuid: agencyUuid, kind: "message", author_type: "staff", author_id: staffByName[who], author_name: who, message: msg, internal: false });
        await ServiceOrder.update({
            status, assigned_to: staffByName[who], due_date: dateOnly(status === "new" ? 1 : 3),
            ...(status === "delivered" && { delivered_at: daysFromNow(-1) }), ...(status === "completed" && { delivered_at: daysFromNow(-6), completed_at: daysFromNow(-5) }),
            last_update_at: daysFromNow(-(i % 3)),
        }, { where: { id: order.dataValues.id } });
    }

    // ---------------------------------------------------------------- 6. calendar, templates, contact requests, notifications, spend
    const events: [string, string, number, string, string][] = [
        ["Farhan Qureshi", "Biometrics at VFS Mumbai (Canada)", 3, "10:30:00", "Ritu Malhotra"],
        ["Anjali Mehta", "US visa interview - Mumbai consulate", 9, "08:45:00", "Sneha Kulkarni"],
        ["Anjali Mehta", "Mock B1/B2 interview", 2, "16:00:00", "Sneha Kulkarni"],
        ["Mehul Desai", "Swiss VFS appointment - family of 4", 6, "09:15:00", "Karan Bhatt"],
        ["Rajesh Kothari", "Funds review call - company statements", 0, "17:30:00", "Karan Bhatt"],
        ["Neel Joshi", "Document check at office", 1, "12:00:00", "Imran Sheikh"],
        ["Amit Bansal", "Collect invitation letters for 3 employees", 4, "11:00:00", "Karan Bhatt"],
        ["Sunil Patel", "Passport collection - visa approved", -2, "15:00:00", "Karan Bhatt"],
    ];
    for (const [name, description, day, time, who] of events) {
        await LeadsCalendar.create({ created_by: agencyId, assgin_to: staffByName[who], description, lead_id: caseOf[name].id, user_id: caseOf[name].studentId, event_type: "event", date: daysFromNow(day, 0), time, is_done: day < 0 ? 1 : 0, is_last: 1 });
    }
    const tmpl: [string, string, string, string | null, string][] = [
        ["Welcome new enquiry", "whatsapp", "lead_created", null, "Hi {{name}}, thanks for contacting {{agency}}! Tell us your destination and travel dates - we'll send the exact visa checklist."],
        ["Appointment reminder", "whatsapp", "manual", null, "Hi {{name}}, reminder: your {{country}} visa appointment is tomorrow. Carry your passport, printed file and appointment letter."],
        ["Documents pending", "email", "documents_pending", "Documents pending for your {{country}} visa", "Dear {{name}},\n\n{{pending_count}} documents are still pending for your visa file. Please upload them here: {{portal_link}}\n\nTeam {{agency}}"],
        ["Fee reminder", "whatsapp", "fee_due", null, "Hi {{name}}, a payment of Rs {{amount}} is due on {{due_date}}. Pay online from your client portal: {{portal_link}}"],
        ["Welcome to the client portal", "email", "lead_converted", "Your {{agency}} client portal is ready", "Dear {{name}},\n\nTrack your {{country}} visa, upload documents, see your itinerary and pay fees here: {{portal_link}}\n\nTeam {{agency}}"],
        ["Visa approved", "whatsapp", "manual", null, "Congratulations {{name}}! Your {{country}} visa is approved 🎉 Your passport is ready for collection. Have a wonderful trip!"],
    ];
    for (const [i, [name, channel, trigger, subject, body]] of tmpl.entries()) {
        await MessageTemplate.create({ agency_uuid: agencyUuid, name, channel, trigger, subject, body, is_active: true, sent_count: [56, 23, 31, 28, 19, 14][i] });
    }
    const contacts = [
        ["Arvind Pillai", "9000000701", "arvind.p@example.com", "Do you do group visas for a 20-person company offsite in Bali?"],
        ["Shruti Dave", "9000000702", "shruti.dave@example.com", "Need a transit visa for a layover in Frankfurt."],
        ["Mahesh Kapadia", "9000000703", "", "Schengen visa for my parents, they are senior citizens."],
        ["Rina Ghosh", "9000000704", "rina.ghosh@example.com", "What are your charges for a US B1/B2 visa?"],
        ["Sanjay Bhalla", "9000000705", "sanjay@bhallaauto.example", "Corporate account for frequent business travel to China and Germany."],
    ];
    for (const [i, [name, number, email, message]] of contacts.entries()) {
        const c: any = await ContactUs.create({ name, number, email, message, agent_id: agencyId });
        await setTimes("contact_us", c.dataValues.id, daysFromNow(-i * 2, 12 + i));
    }
    const notes: [string, string, string, string, number, boolean][] = [
        ["new_lead", "New lead: Rohit Agarwal", "Facebook · Schengen · Europe tour for 6", `/crm/leads/${leadByName["Rohit Agarwal"].dataValues.uuid}`, 0, false],
        ["whatsapp_message", "WhatsApp from Rohit Agarwal", "France, Switzerland and Italy, mostly Switzerland", `/crm/chats`, 0, false],
        ["document_uploaded", "Mehul Desai uploaded documents", "2 documents waiting for review", `/leads/progress/${caseOf["Mehul Desai"].id}`, 0, false],
        ["payment_received", "Payment received: Mehul Desai", "Rs 2,950 by UPI (Itinerary + Cover Letter)", `/fees`, 5, true],
        ["follow_up_due", "4 follow-ups due today", "Gaurav Sethi, Ayesha Khan, Prakash Menon and 1 more", `/crm/leads?follow_up=today`, 0, false],
        ["case_assigned", "New visa case: Kavita Reddy", "Dubai tourist visa · 2 travellers", `/leads/progress/${caseOf["Kavita Reddy"].id}`, 2, true],
    ];
    for (const [type, title, body, link, daysAgo, read] of notes) {
        const n: any = await Notification.create({ agency_uuid: agencyUuid, recipient_id: agencyId, type, title, body, link, read_at: read ? daysFromNow(-daysAgo, 18) : null });
        await setTimes("notifications", n.dataValues.id, daysFromNow(-daysAgo, 9 + (title.length % 8)));
    }
    const spend: [string, number, number][] = [["facebook", 25000, 21000], ["google", 18000, 16000], ["instagram", 12000, 9000], ["indiamart", 6000, 6000], ["justdial", 3500, 3000], ["sulekha", 2000, 2000]];
    for (const [source, thisMonth, lastMonth] of spend) {
        await MarketingSpend.create({ agency_uuid: agencyUuid, month: monthKey(0), source, amount: thisMonth });
        await MarketingSpend.create({ agency_uuid: agencyUuid, month: monthKey(-1), source, amount: lastMonth });
    }

    // ---------------------------------------------------------------- 7. agency profile
    const profile: any = await AgentProfile.create({
        agent_uuid: agencyUuid,
        officeStreetAddress: "7th Floor, Venus Atlantis, Prahlad Nagar", officeArea: "Prahlad Nagar", officeCity: "Ahmedabad",
        officeStateProvince: "Gujarat", officeCountry: "India", officePostalCode: "380015", latitude: "23.0120", longitude: "72.5108",
        aboutUs: "Since 2012, Wanderly Visa & Travel has filed 15,000+ tourist and business visas for families, business travellers and companies across Gujarat and Mumbai - with a 96% approval rate.",
        detailedDescription: "<p>We prepare complete visa files: the right checklist, itinerary, cover and company letters, insurance, flight and hotel reservations, funds check and appointment booking.</p><p>Specialisations: Schengen (tourist & business), UK visitor, USA B1/B2 with mock interviews, Canada TRV, Australia 600, Dubai and corporate travel desks.</p>",
        website: "https://wanderly.example", socialFacebook: "https://facebook.com/wanderly.example", socialInstagram: "https://instagram.com/wanderly.example",
        socialLinkedIn: "https://linkedin.com/company/wanderly-example", socialYouTube: "https://youtube.com/@wanderly-example",
        contactEmail: "hello@wanderly.example", contactPhoneNumber: "+91 98790 00000", contactWhatsApp: "+91 98790 00000",
        operatingHoursWeekdays: "Mon - Sat, 10:00 AM - 7:30 PM", operatingHoursWeekends: "Sunday 11:00 AM - 2:00 PM", operatingHoursTimeZone: "IST (GMT+5:30)",
    });
    await BranchOffice.create({ agent_uuid: agencyUuid, streetAddress: "Office 1204, One BKC", city: "Mumbai", stateProvince: "Maharashtra", country: "India", postalCode: "400051", agentProfileUUID: profile.dataValues.uuid });
    for (const language of ["English", "Hindi", "Gujarati", "Marathi"]) await Language.create({ agent_uuid: agencyUuid, language });

    // ---------------------------------------------------------------- 8. portal banners (home updates)
    const fs = await import("fs"), path = await import("path");
    const bannerDir = path.join(__dirname, "..", "..", "public", "banners");
    fs.mkdirSync(bannerDir, { recursive: true });
    const banners: [string, string, string, string, string][] = [
        ["Europe summer visas are open", "Apply 60 days before travel - Schengen slots fill fast", "SUMMER 2027", "travel-demo-europe.svg", "home"],
        ["Visa approved - Patel family, UK", "London and Edinburgh - approved in 9 working days", "VISA APPROVED", "travel-demo-approved.svg", "home"],
        ["US visa mock interviews", "45-minute one-on-one practice before your consulate interview", "B1/B2", "travel-demo-usa.svg", "visa_consultation"],
    ];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1), monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59);
    for (const [i, [title, sub, tag, file, target_type]] of banners.entries()) {
        fs.writeFileSync(path.join(bannerDir, file), bannerSvg(title, sub, tag, [BRAND.color, "#0d9488", "#b45309"][i]));
        await SideBanner.create({ agent_uuid: agencyUuid, campaign_title: title, image: file, start_date: monthStart, end_date: monthEnd, status: "accept", position: "1", target_type, responses: 0 });
    }

    // ---------------------------------------------------------------- 9. tasks board + portal chats
    const tasks: [string, string, "todo" | "in_progress" | "ready_for_review" | "done", "low" | "normal" | "high", string, number | null, string | null][] = [
        ["Book Swiss VFS slot for Desai family", "4 travellers - try for a morning slot", "done", "high", "Imran Sheikh", -3, "Mehul Desai"],
        ["Review Kothari company bank statements", "Check average balance vs trip cost", "in_progress", "high", "Karan Bhatt", 0, "Rajesh Kothari"],
        ["Get invitation letters from Holland Home Imports", "Need letters for all 3 employees", "todo", "high", "Karan Bhatt", 3, "Amit Bansal"],
        ["Prepare DS-160 for Anjali", "Double-check employment history", "done", "normal", "Sneha Kulkarni", -10, "Anjali Mehta"],
        ["Send corporate quote to Shree Ceramics", "5 Italy business visas + insurance", "todo", "normal", "Karan Bhatt", 1, null],
        ["Re-check Neel's passport scan", "Asked for a clear colour scan", "ready_for_review", "normal", "Imran Sheikh", 1, "Neel Joshi"],
        ["Monthly GST report", "Visa service invoices", "todo", "low", "Meena Joshi", 6, null],
        ["Reapplication plan for Deepa Nair", "Add property papers and travel history", "todo", "normal", "Sneha Kulkarni", 5, "Deepa Nair"],
    ];
    for (const [title, description, status, priority, who, due, rel] of tasks) {
        const createdAt = daysFromNow(-4, 11);
        const row: any = await AgencyTask.create({
            agency_uuid: agencyUuid, created_by: agencyId, assignee_id: staffByName[who], title, description, status, priority,
            due_at: due === null ? null : daysFromNow(due, 17), related_type: rel ? "case" : "none", related_id: rel ? String(caseOf[rel].id) : null,
            completed_at: status === "done" ? daysFromNow(-1, 16) : null,
        });
        await sequelize.query("UPDATE `agency_tasks` SET createdAt = ?, updatedAt = ? WHERE id = ?", { replacements: [createdAt, createdAt, row.dataValues.id] });
    }
    const portalChats: [string, string, ["student" | "agent", string, number, boolean?][]][] = [
        ["Mehul Desai", "Karan Bhatt", [["agent", "Hi Mehul, your Switzerland itinerary and cover letter are in 'Your travel documents'. Please check the hotels.", 300], ["student", "Thank you! Can the kids' passports be uploaded as one PDF?", 200], ["agent", "Yes, one PDF per person is perfect.", 190], ["student", "Done, uploaded all 4 passports", 45, false]]],
        ["Rajesh Kothari", "Karan Bhatt", [["agent", "Rajesh ji, please pay the balance so we can book your Frankfurt appointment.", 26 * 60], ["student", "Will pay today evening by UPI", 25 * 60]]],
        ["Sunil Patel", "Karan Bhatt", [["agent", "Congratulations! Your UK visas are approved. Passports are ready at our office.", 3 * 24 * 60], ["student", "Wonderful, thank you! Will collect tomorrow.", 3 * 24 * 60 - 30]]],
    ];
    for (const [client, agent, msgs] of portalChats) {
        for (const [from, body, minsAgo, read] of msgs) {
            const at = new Date(now.getTime() - minsAgo * 60 * 1000);
            const row: any = await PortalChatMessage.create({ agency_uuid: agencyUuid, student_id: caseOf[client].studentId, sender_type: from, sender_id: from === "student" ? caseOf[client].studentId : staffByName[agent], body, read_at: read === false ? null : new Date(at.getTime() + 5 * 60 * 1000) });
            await sequelize.query("UPDATE `portal_chat_messages` SET createdAt = ? WHERE id = ?", { replacements: [at, row.dataValues.id] });
        }
    }

    // ---------------------------------------------------------------- done
    console.log(`\nTravel demo "${BRAND.name}" is ready: ${LEADS.length} leads, ${Object.keys(caseOf).length} visa cases, ${await ClientInvoice.count({ where: { agency_uuid: agencyUuid } })} invoices, ${await ServiceOrder.count({ where: { agency_uuid: agencyUuid } })} service orders, ${tasks.length} tasks.`);
    console.log(`Client portal: https://${PORTAL_SUBDOMAIN}.${PORTAL_DOMAIN}   Agency panel: https://${PORTAL_SUBDOMAIN}.${PORTAL_DOMAIN}/agency`);
    console.log(`\nLogin codes (mobile number + 6-digit code; new codes on every run):`);
    for (const c of codes) console.log(`  ${c.who.padEnd(44)} +91 ${c.phone}   ${c.code}`);
    await sequelize.close();
};

main().catch(async (e) => {
    console.error("Travel demo seed failed:", e?.message || e);
    if (e?.parent?.sqlMessage) console.error("SQL:", e.parent.sqlMessage);
    await sequelize.close().catch(() => {});
    process.exit(1);
});
