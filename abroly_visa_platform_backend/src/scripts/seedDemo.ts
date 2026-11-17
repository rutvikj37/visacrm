/**
 * Demo agency for client demos: "Global Pathways Overseas".
 *
 *   npm run demo:seed
 *
 * Wipes the previous demo agency (found by its owner phone) and builds it again with data on every
 * agency-panel page and in the student portal: branches, team, leads from every source (with chats,
 * follow-ups and timelines), visa cases at every stage, fees and receipts, services and orders,
 * calendar, message templates, contact requests, notifications, marketing spend, job posts,
 * AgencyTask board items, PortalChat threads, and demo students. Nothing is emailed or messaged.
 * Everyone logs in with a fixed 6-digit code that is printed at the end (a new set on every run).
 * To add Tasks/Chats without wiping: npm run demo:seed:tasks-chats
 *
 * Portal address: DEMO_PORTAL_DOMAIN / DEMO_PORTAL_SUBDOMAIN (defaults match local dev, where
 * IS_LOCAL_USE=true makes the student portal open the agency at universe.in / techxuniverse).
 */
import dotenv from "dotenv";
dotenv.config();

import { Op } from "sequelize";
import sequelize from "../config/dbconfig";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (d: number, h = 10, m = 0) => { const x = new Date(now.getTime() + d * DAY); x.setHours(h, m, 0, 0); return x; };
const dateOnly = (d: number) => daysFromNow(d).toISOString().slice(0, 10);
const monthKey = (offset: number) => { const d = new Date(now.getFullYear(), now.getMonth() + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const rupees = (r: number) => Math.round(r * 100); // money is stored in paise

const OWNER_PHONE = process.env.DEMO_OWNER_PHONE || "9000000201";
const PORTAL_DOMAIN = process.env.DEMO_PORTAL_DOMAIN || "universe.in";
const PORTAL_SUBDOMAIN = process.env.DEMO_PORTAL_SUBDOMAIN || "techxuniverse";
const BRAND = { name: "Global Pathways Overseas", color: "#0e7490" };

// ------------------------------------------------------------------ people
const TEAM = [
    { name: "Rohan Mehta", phone: "9000000202", email: "rohan@globalpathways.example", role: "branch_manager", branch: "Surat", designation: "Branch Manager" },
    { name: "Neha Patel", phone: "9000000203", email: "neha@globalpathways.example", role: "counsellor", branch: "Ahmedabad", designation: "Senior Counsellor" },
    { name: "Arjun Desai", phone: "9000000204", email: "arjun@globalpathways.example", role: "counsellor", branch: "Vadodara", designation: "Visa Counsellor" },
    { name: "Kavya Iyer", phone: "9000000205", email: "kavya@globalpathways.example", role: "documents", branch: "Ahmedabad", designation: "Documentation Officer" },
    { name: "Sameer Khan", phone: "9000000206", email: "sameer@globalpathways.example", role: "accounts", branch: "Ahmedabad", designation: "Accounts Executive" },
] as const;

const BRANCHES = [
    { name: "Ahmedabad", city: "Ahmedabad", address: "4th Floor, Shivalik Shilp, Iscon Cross Road, Ahmedabad 380015", phone: "+91 79 4000 1200", email: "ahmedabad@globalpathways.example", routing: ["Gandhinagar", "Anand"] },
    { name: "Surat", city: "Surat", address: "Office 510, Rajhans Platinum, Adajan, Surat 395009", phone: "+91 261 400 2200", email: "surat@globalpathways.example", routing: ["Navsari", "Bharuch"] },
    { name: "Vadodara", city: "Vadodara", address: "2nd Floor, Atlantis K10, Sarabhai Road, Vadodara 390007", phone: "+91 265 400 3300", email: "vadodara@globalpathways.example", routing: ["Anand"] },
];

type CaseSpec = {
    template: "canada-study" | "uk-study" | "australia-study" | "usa-f1" | "germany-study";
    university: string; intake: string;
    stage?: "documents" | "application" | "offer" | "funds" | "visa_filed" | "biometrics" | "decision";
    outcome?: "approved" | "rejected" | "withdrawn";
    counsellor: string; // team member name
    hero?: boolean;     // demo student who gets a portal login code
};
type LeadSpec = {
    name: string; phone: string; city: string; country: string; course: string; source: string;
    status: "new" | "contacted" | "follow_up" | "interested" | "counselling" | "lost" | "junk" | "convert";
    score: number; message: string; daysAgo: number; email?: string; intake?: string;
    followUp?: [number, number, number, string]; // [days from today, hour, minute, note]
    lost?: string; chat?: "whatsapp" | "instagram"; owner?: string;
    case?: CaseSpec;
};

const LEADS: LeadSpec[] = [
    // ---- converted to visa cases
    { name: "Aarav Shah", phone: "9000000301", city: "Ahmedabad", country: "Canada", course: "MBA", source: "facebook", status: "convert", score: 92, daysAgo: 58, email: "aarav.shah@example.com", message: "Want to study MBA in Canada, Sep intake", owner: "Neha Patel", chat: "whatsapp",
      case: { template: "canada-study", university: "University of Toronto", intake: "Sep 2026", outcome: "approved", counsellor: "Neha Patel", hero: true } },
    { name: "Diya Patel", phone: "9000000302", city: "Surat", country: "United Kingdom", course: "MSc Data Science", source: "website", status: "convert", score: 88, daysAgo: 55, email: "diya.patel@example.com", message: "IELTS 7.5, looking for UK universities", owner: "Rohan Mehta",
      case: { template: "uk-study", university: "University of Manchester", intake: "Sep 2026", outcome: "approved", counsellor: "Rohan Mehta" } },
    { name: "Kabir Mehta", phone: "9000000303", city: "Vadodara", country: "Australia", course: "Bachelor of Nursing", source: "google", status: "convert", score: 85, daysAgo: 47, email: "kabir.mehta@example.com", message: "Nursing in Australia with PR pathway", owner: "Arjun Desai", chat: "whatsapp",
      case: { template: "australia-study", university: "Monash University", intake: "Feb 2027", stage: "biometrics", counsellor: "Arjun Desai", hero: true } },
    { name: "Ananya Rao", phone: "9000000304", city: "Ahmedabad", country: "Germany", course: "MS Mechanical Engineering", source: "indiamart", status: "convert", score: 81, daysAgo: 44, email: "ananya.rao@example.com", message: "Public universities in Germany - no tuition?", owner: "Neha Patel",
      case: { template: "germany-study", university: "TU Munich", intake: "Oct 2026", stage: "visa_filed", counsellor: "Neha Patel" } },
    { name: "Vihaan Joshi", phone: "9000000305", city: "Ahmedabad", country: "Canada", course: "PG Diploma Business Management", source: "instagram", status: "convert", score: 79, daysAgo: 40, email: "vihaan.joshi@example.com", message: "PGWP after diploma?", owner: "Neha Patel",
      case: { template: "canada-study", university: "Humber College", intake: "Jan 2027", stage: "funds", counsellor: "Neha Patel" } },
    { name: "Ishita Trivedi", phone: "9000000306", city: "Surat", country: "USA", course: "MS Computer Science", source: "website", status: "convert", score: 84, daysAgo: 38, email: "ishita.trivedi@example.com", message: "F1 visa for MS CS, GRE 320", owner: "Rohan Mehta",
      case: { template: "usa-f1", university: "Arizona State University", intake: "Aug 2026", stage: "offer", counsellor: "Rohan Mehta" } },
    { name: "Reyansh Kapoor", phone: "9000000307", city: "Vadodara", country: "United Kingdom", course: "BSc Business Management", source: "justdial", status: "convert", score: 70, daysAgo: 33, email: "reyansh.kapoor@example.com", message: "UK undergrad after 12th commerce", owner: "Arjun Desai",
      case: { template: "uk-study", university: "Coventry University", intake: "Jan 2027", stage: "application", counsellor: "Arjun Desai" } },
    { name: "Saanvi Nair", phone: "9000000308", city: "Ahmedabad", country: "Australia", course: "Master of Information Technology", source: "facebook", status: "convert", score: 77, daysAgo: 21, email: "saanvi.nair@example.com", message: "Masters in IT, Australia Feb intake", owner: "Neha Patel", chat: "whatsapp",
      case: { template: "australia-study", university: "Deakin University", intake: "Feb 2027", stage: "documents", counsellor: "Neha Patel", hero: true } },
    { name: "Aditya Verma", phone: "9000000309", city: "Surat", country: "Canada", course: "MEng Electrical", source: "google", status: "convert", score: 74, daysAgo: 16, email: "aditya.verma@example.com", message: "MEng in Canada with co-op", owner: "Rohan Mehta",
      case: { template: "canada-study", university: "University of Waterloo", intake: "Jan 2027", stage: "documents", counsellor: "Rohan Mehta" } },
    { name: "Myra Singh", phone: "9000000310", city: "Ahmedabad", country: "USA", course: "MBA", source: "sulekha", status: "convert", score: 72, daysAgo: 30, email: "myra.singh@example.com", message: "MBA in USA, GMAT 680", owner: "Neha Patel",
      case: { template: "usa-f1", university: "University of Texas at Dallas", intake: "Aug 2026", stage: "application", counsellor: "Neha Patel" } },
    { name: "Arnav Gupta", phone: "9000000311", city: "Vadodara", country: "Germany", course: "MSc Data Engineering", source: "csv", status: "convert", score: 68, daysAgo: 52, email: "arnav.gupta@example.com", message: "Germany masters, blocked account help", owner: "Arjun Desai",
      case: { template: "germany-study", university: "RWTH Aachen", intake: "Oct 2026", outcome: "rejected", counsellor: "Arjun Desai" } },
    { name: "Kiara Bhatt", phone: "9000000312", city: "Surat", country: "Canada", course: "Diploma Hospitality Management", source: "whatsapp", status: "convert", score: 60, daysAgo: 49, email: "kiara.bhatt@example.com", message: "Hospitality diploma in Canada", owner: "Rohan Mehta",
      case: { template: "canada-study", university: "Seneca Polytechnic", intake: "Sep 2026", outcome: "withdrawn", counsellor: "Rohan Mehta" } },
    { name: "Dhruv Chauhan", phone: "9000000313", city: "Ahmedabad", country: "Australia", course: "MBA", source: "facebook", status: "convert", score: 90, daysAgo: 60, email: "dhruv.chauhan@example.com", message: "MBA in Sydney", owner: "Neha Patel",
      case: { template: "australia-study", university: "University of Sydney", intake: "Jul 2026", outcome: "approved", counsellor: "Neha Patel" } },
    { name: "Riya Solanki", phone: "9000000314", city: "Vadodara", country: "United Kingdom", course: "MSc Finance", source: "website", status: "convert", score: 80, daysAgo: 27, email: "riya.solanki@example.com", message: "MSc Finance, Russell Group", owner: "Arjun Desai",
      case: { template: "uk-study", university: "University of Leeds", intake: "Sep 2026", stage: "offer", counsellor: "Arjun Desai" } },

    // ---- open leads (inbox, follow-ups, chats)
    { name: "Krish Malhotra", phone: "9000000315", city: "Ahmedabad", country: "Canada", course: "MS Data Analytics", source: "facebook", status: "new", score: 64, daysAgo: 0, message: "Is IELTS mandatory for Canada?", chat: "whatsapp" },
    { name: "Pari Shah", phone: "9000000316", city: "Surat", country: "Australia", course: "Accounting", source: "instagram", status: "new", score: 55, daysAgo: 0, message: "DM: fees for Masters in Accounting?", chat: "instagram" },
    { name: "Yash Thakkar", phone: "9000000317", city: "Vadodara", country: "United Kingdom", course: "MBA", source: "google", status: "new", score: 48, daysAgo: 1, message: "One year MBA options UK" },
    { name: "Anika Jain", phone: "9000000318", city: "Ahmedabad", country: "Germany", course: "MS Automotive Engineering", source: "website", status: "new", score: 70, daysAgo: 1, email: "anika.jain@example.com", message: "Need help with APS certificate" },
    { name: "Om Prajapati", phone: "9000000319", city: "Anand", country: "Canada", course: "Diploma IT", source: "justdial", status: "new", score: 35, daysAgo: 2, message: "Call me after 6pm" },
    { name: "Navya Reddy", phone: "9000000320", city: "Surat", country: "USA", course: "MS Biotechnology", source: "sulekha", status: "new", score: 58, daysAgo: 3, message: "Spring intake possible?" },
    { name: "Laksh Agarwal", phone: "9000000321", city: "Ahmedabad", country: "Ireland", course: "MSc Cloud Computing", source: "indiamart", status: "contacted", score: 52, daysAgo: 4, message: "Ireland stay back rules", owner: "Neha Patel", followUp: [0, 11, 30, "Share Dublin university shortlist"] },
    { name: "Tara Kulkarni", phone: "9000000322", city: "Vadodara", country: "New Zealand", course: "Hospitality", source: "facebook", status: "contacted", score: 45, daysAgo: 5, message: "Work rights during study?", owner: "Arjun Desai", chat: "whatsapp", followUp: [1, 12, 0, "Call back about NZ work rights"] },
    { name: "Ved Sharma", phone: "9000000323", city: "Surat", country: "Canada", course: "PG Diploma Supply Chain", source: "google", status: "contacted", score: 61, daysAgo: 6, message: "Budget around 18 lakh", owner: "Rohan Mehta", followUp: [-1, 16, 0, "Send cost sheet - overdue"] },
    { name: "Mira Pandya", phone: "9000000324", city: "Ahmedabad", country: "United Kingdom", course: "LLM", source: "website", status: "follow_up", score: 66, daysAgo: 7, email: "mira.pandya@example.com", message: "LLM in London", owner: "Neha Patel", followUp: [0, 15, 0, "Discuss scholarship options"] },
    { name: "Shaurya Rana", phone: "9000000325", city: "Gandhinagar", country: "Australia", course: "Civil Engineering", source: "whatsapp", status: "follow_up", score: 57, daysAgo: 8, message: "PR points for engineering", owner: "Neha Patel", chat: "whatsapp", followUp: [0, 17, 30, "Explain PR points and course list"] },
    { name: "Zara Sheikh", phone: "9000000326", city: "Surat", country: "Canada", course: "Early Childhood Education", source: "instagram", status: "follow_up", score: 50, daysAgo: 9, message: "ECE diploma, need loan help", owner: "Rohan Mehta", chat: "instagram", followUp: [2, 11, 0, "Loan options with HDFC Credila"] },
    { name: "Rudra Bhavsar", phone: "9000000327", city: "Vadodara", country: "Germany", course: "MSc Computer Science", source: "csv", status: "follow_up", score: 63, daysAgo: 10, message: "German language needed?", owner: "Arjun Desai", followUp: [3, 10, 30, "Shortlist English-taught programs"] },
    { name: "Avni Dave", phone: "9000000328", city: "Ahmedabad", country: "USA", course: "MS Data Science", source: "facebook", status: "interested", score: 76, daysAgo: 11, email: "avni.dave@example.com", message: "Ready to apply for Fall", owner: "Neha Patel", followUp: [1, 16, 30, "Collect transcripts and LORs"] },
    { name: "Kunal Soni", phone: "9000000329", city: "Surat", country: "Canada", course: "MBA", source: "google", status: "interested", score: 73, daysAgo: 12, message: "Wants Toronto colleges", owner: "Rohan Mehta", followUp: [4, 12, 0, "Application fee payment"] },
    { name: "Ira Choksi", phone: "9000000330", city: "Anand", country: "Australia", course: "Master of Public Health", source: "website", status: "interested", score: 69, daysAgo: 13, message: "MPH in Melbourne", owner: "Arjun Desai" },
    { name: "Atharv Pillai", phone: "9000000331", city: "Ahmedabad", country: "United Kingdom", course: "MSc AI", source: "indiamart", status: "counselling", score: 82, daysAgo: 14, email: "atharv.pillai@example.com", message: "Booked counselling for Saturday", owner: "Neha Patel", followUp: [2, 11, 0, "Counselling session at office"] },
    { name: "Sia Mistry", phone: "9000000332", city: "Surat", country: "Canada", course: "Nursing", source: "facebook", status: "counselling", score: 78, daysAgo: 15, message: "Parents joining the session", owner: "Rohan Mehta", followUp: [0, 18, 0, "Family counselling call"] },
    { name: "Parth Rathod", phone: "9000000333", city: "Vadodara", country: "Germany", course: "MBA", source: "justdial", status: "counselling", score: 71, daysAgo: 18, message: "Comparing Germany vs Canada", owner: "Arjun Desai", followUp: [5, 15, 0, "Second counselling - final country"] },
    { name: "Nisha Vora", phone: "9000000334", city: "Ahmedabad", country: "Canada", course: "Diploma", source: "website", status: "lost", score: 20, daysAgo: 35, message: "Budget too low", owner: "Neha Patel", lost: "Budget too low" },
    { name: "Harsh Panchal", phone: "9000000335", city: "Surat", country: "Australia", course: "Cookery", source: "sulekha", status: "lost", score: 18, daysAgo: 42, message: "Went with another agency", owner: "Rohan Mehta", lost: "Chose another agency" },
    { name: "Meera Iyer", phone: "9000000336", city: "Vadodara", country: "USA", course: "MS", source: "google", status: "lost", score: 25, daysAgo: 29, message: "Postponed to next year", owner: "Arjun Desai", lost: "Postponed plans" },
    { name: "Test Enquiry", phone: "9000000337", city: "Ahmedabad", country: "Canada", course: "-", source: "website", status: "junk", score: 2, daysAgo: 20, message: "test test" },
    { name: "Jiya Modi", phone: "9000000338", city: "Navsari", country: "Ireland", course: "MSc Marketing", source: "facebook", status: "contacted", score: 54, daysAgo: 3, message: "Ireland vs UK for marketing", owner: "Rohan Mehta", followUp: [1, 11, 0, "Compare Ireland and UK costs"] },
    { name: "Aryan Bhatia", phone: "9000000339", city: "Ahmedabad", country: "Canada", course: "MS Cybersecurity", source: "manual", status: "interested", score: 75, daysAgo: 6, message: "Walk-in enquiry at office", owner: "Neha Patel", followUp: [6, 12, 0, "Mock IELTS test"] },
    { name: "Tanvi Kothari", phone: "9000000340", city: "Bharuch", country: "Australia", course: "Bachelor of Business", source: "instagram", status: "new", score: 46, daysAgo: 0, message: "DM: scholarships for undergrad?", chat: "instagram" },
];

// short WhatsApp / Instagram conversations shown in Chats and on the lead timeline
const CHATS: Record<string, [("in" | "out"), string, number][]> = {
    "Krish Malhotra": [["in", "Hi, is IELTS mandatory for Canada?", 40], ["out", "Hi Krish! Most colleges need IELTS/PTE, a few accept Duolingo. Which course are you looking at?", 32], ["in", "MS Data Analytics, Sep intake", 20]],
    "Pari Shah": [["in", "Hello! What are the fees for Masters in Accounting in Australia?", 25]],
    "Tanvi Kothari": [["in", "Are there scholarships for undergrad in Australia?", 15]],
    "Tara Kulkarni": [["in", "Can I work while studying in NZ?", 2 * 24 * 60], ["out", "Yes - up to 20 hours a week during term. Shall I call you tomorrow to explain?", 2 * 24 * 60 - 30], ["in", "Yes please, after 12", 2 * 24 * 60 - 45]],
    "Shaurya Rana": [["in", "How many PR points for civil engineering?", 3 * 24 * 60], ["out", "Civil engineering is on the skilled list - I'll share the points table and course list today.", 3 * 24 * 60 - 60]],
    "Zara Sheikh": [["in", "Can you help with an education loan?", 4 * 24 * 60], ["out", "Sure! We work with Credila and Avanse. I'll send you the documents list.", 4 * 24 * 60 - 20]],
    "Aarav Shah": [["out", "Congratulations Aarav - your Canada study permit is approved! 🎉", 3 * 24 * 60], ["in", "Thank you so much! When is the pre-departure session?", 3 * 24 * 60 - 15], ["out", "This Friday at 5 pm at our Ahmedabad office.", 3 * 24 * 60 - 25]],
    "Kabir Mehta": [["in", "Got my biometrics slot for next week", 24 * 60], ["out", "Great! Carry your passport, appointment letter and CoE. All the best!", 24 * 60 - 10]],
    "Saanvi Nair": [["out", "Hi Saanvi, please upload your passport and marksheets in the student portal.", 26 * 60], ["in", "Uploaded passport and 10th/12th, degree tomorrow", 22 * 60]],
};

const SERVICES = [
    { name: "IELTS Coaching (6 weeks)", category: "Test prep", price: 12000, gst: 18, delivery: "6 weeks, Mon-Fri batches", description: "Classroom + online coaching with 4 full mock tests." },
    { name: "SOP & LOR Writing", category: "Documentation", price: 7500, gst: 18, delivery: "5 working days", description: "Statement of purpose and 2 letters of recommendation, unlimited revisions." },
    { name: "Visa File Preparation", category: "Visa", price: 15000, gst: 18, delivery: "7 working days", description: "Complete visa file with financial documents check and mock interview." },
    { name: "Education Loan Assistance", category: "Finance", price: 2500, gst: 18, delivery: "2-3 weeks", description: "Loan application with partner banks and NBFCs." },
    { name: "Forex & Travel Card", category: "Travel", price: 1500, gst: 18, delivery: "2 days", description: "Best rates on forex and a multi-currency travel card." },
    { name: "Accommodation Search", category: "Travel", price: 3000, gst: 18, delivery: "1 week", description: "Shortlist of verified student housing near campus." },
];

// steps done per stage (the rest stay open; the next open step gets a due date)
const STAGES = ["documents", "application", "offer", "funds", "visa_filed", "biometrics", "decision"] as const;

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
    const JobPost = (await import("../model/JobPost")).default as any;
    const JobApplicants = (await import("../model/JobApplicants")).default as any;
    const VisaTemplate = (await import("../model/VisaTemplate")).default as any;
    const StudentBasicDetails = (await import("../model/StudentBasicDetails")).default as any;
    const SaasSubscription = (await import("../model/SaasSubscription")).default as any;
    const SaasPayment = (await import("../model/SaasPayment")).default as any;
    const SaasPlan = (await import("../model/SaasPlan")).default as any;
    const ActivityLog = (await import("../model/ActivityLog")).default as any;
    const SideBanner = (await import("../model/SideBanner")).default as any;
    const ServiceFormResponse = (await import("../model/ServiceFromResponse")).default as any;
    const { AgentProfile, BranchOffice, Language } = (await import("../model/AgentProfile")) as any;
    const { applyPeriod, ensureDefaultPlans } = await import("../services/saas");
    const { convertLeadToCase } = await import("../services/leadConversion");
    const { findLibraryTemplate } = await import("../services/visaTemplateLibrary");
    const { normalizePhone } = await import("../services/leadIngestion");
    const { nextNumber, recordPayment } = await import("../v1/controller/FeesController");
    const { createOrderForInvoice } = await import("../v1/controller/ServiceOrderController");
    const { setLoginCode, setStudentLoginCode } = await import("../services/agencyLogin");

    const setTimes = async (table: string, id: number, at: Date) =>
        sequelize.query(`UPDATE \`${table}\` SET createdAt = ?, updatedAt = ? WHERE id = ?`, { replacements: [at, at, id] });

    // ---------------------------------------------------------------- 1. wipe the previous demo
    const old: any = await Agent.findOne({ where: { phone_number: OWNER_PHONE, role: "agent" }, paranoid: false });
    if (old) {
        const ag = old.dataValues;
        const team: any[] = await Agent.findAll({ where: { parent_uuid: ag.uuid }, attributes: ["id"], paranoid: false, raw: true });
        const staffIds = [ag.id, ...team.map((t) => t.id)];
        const students: any[] = await User.findAll({ where: { agency_uuid: ag.uuid }, attributes: ["id", "uuid"], paranoid: false, raw: true });
        const studentIds = students.map((s) => s.id);
        const cases: any[] = await AgencyLeads.findAll({ where: { agent_uuid: ag.uuid }, attributes: ["id"], paranoid: false, raw: true });
        const caseIds = cases.map((c) => c.id);
        const steps: any[] = caseIds.length ? await Step.findAll({ where: { lead_id: caseIds }, attributes: ["id"], paranoid: false, raw: true }) : [];
        const jobs: any[] = await JobPost.findAll({ where: { agent_uuid: ag.uuid }, attributes: ["uuid"], paranoid: false, raw: true });
        const orders: any[] = await ServiceOrder.findAll({ where: { agency_uuid: ag.uuid }, attributes: ["id"], raw: true });
        const f = { force: true } as const;
        if (steps.length) await Question.destroy({ where: { step_id: steps.map((s) => s.id) }, ...f });
        if (caseIds.length) await Step.destroy({ where: { lead_id: caseIds }, ...f });
        await AgencyLeads.destroy({ where: { agent_uuid: ag.uuid }, ...f });
        if (studentIds.length) await RaisedApplications.destroy({ where: { student_id: studentIds }, ...f });
        if (students.length) await StudentBasicDetails.destroy({ where: { student_uuid: students.map((s) => s.uuid) }, ...f });
        if (jobs.length) await JobApplicants.destroy({ where: { job_post_uuid: jobs.map((j) => j.uuid) }, ...f });
        await JobPost.destroy({ where: { agent_uuid: ag.uuid }, ...f });
        if (orders.length) await ServiceOrderUpdate.destroy({ where: { order_id: orders.map((o) => o.id) } });
        await ServiceOrder.destroy({ where: { agency_uuid: ag.uuid } });
        await ClientPayment.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await ClientInvoice.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await AgencyService.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        const AgencyTask = (await import("../model/AgencyTask")).default as any;
        const PortalChatMessage = (await import("../model/PortalChatMessage")).default as any;
        await AgencyTask.destroy({ where: { agency_uuid: ag.uuid }, ...f }).catch(() => AgencyTask.destroy({ where: { agency_uuid: ag.uuid } }));
        await PortalChatMessage.destroy({ where: { agency_uuid: ag.uuid } });
        await CrmLeadActivity.destroy({ where: { agency_uuid: ag.uuid } });
        await CrmLead.destroy({ where: { agency_uuid: ag.uuid }, ...f });
        await LeadsCalendar.destroy({ where: { [Op.or]: [{ created_by: staffIds }, { assgin_to: staffIds }] }, ...f });
        await ContactUs.destroy({ where: { agent_id: staffIds }, ...f });
        await ServiceFormResponse.destroy({ where: { agent_id: staffIds } }).catch(() => {});
        await SideBanner.destroy({ where: { agent_uuid: ag.uuid }, ...f }).catch(() => SideBanner.destroy({ where: { agent_uuid: ag.uuid } }));
        for (const M of [AgentProfile, BranchOffice, Language]) await M.destroy({ where: { agent_uuid: ag.uuid }, ...f }).catch(() => {});
        for (const M of [MessageTemplate, Notification, MarketingSpend, VisaTemplate, AgencyBranch, SaasSubscription, SaasPayment, ActivityLog]) {
            await M.destroy({ where: { agency_uuid: ag.uuid }, ...f }).catch(() => M.destroy({ where: { agency_uuid: ag.uuid } }));
        }
        if (studentIds.length) await User.destroy({ where: { id: studentIds }, ...f });
        await Agent.destroy({ where: { id: staffIds }, ...f });
        console.log(`Removed the previous demo agency (${staffIds.length} staff, ${studentIds.length} students, ${caseIds.length} cases).`);
    }

    // the local portal address must not belong to another agency
    const clash: any = await Agent.findOne({ where: { domain: PORTAL_DOMAIN, sudomain: PORTAL_SUBDOMAIN, role: "agent" } });
    if (clash) throw new Error(`Portal address ${PORTAL_SUBDOMAIN}.${PORTAL_DOMAIN} is already used by agency "${clash.dataValues.app_name || clash.dataValues.username}". Set DEMO_PORTAL_DOMAIN / DEMO_PORTAL_SUBDOMAIN.`);

    // ---------------------------------------------------------------- 2. agency, plan, branches, team
    await ensureDefaultPlans();
    const plans: any[] = await SaasPlan.findAll({ order: [["price_yearly", "DESC"]] });
    const plan = plans.find((p) => p.dataValues.name === "Pro") || plans[0];

    const owner: any = await Agent.create({
        username: "Priya Sharma", app_name: BRAND.name, email: "priya@globalpathways.example",
        phone_number: OWNER_PHONE, country_code: "+91", role: "agent", status: "active", is_verified: 1,
        designation: "Founder & Director", primary_color: BRAND.color,
        support_number: "+91 98250 00000", support_email: "hello@globalpathways.example",
        agency_address: "4th Floor, Shivalik Shilp, Iscon Cross Road, Ahmedabad, Gujarat 380015",
        meta_description: "Study abroad and visa consultants in Ahmedabad, Surat and Vadodara - Canada, UK, Australia, USA and Germany.",
        domain: PORTAL_DOMAIN, sudomain: PORTAL_SUBDOMAIN, expires_at: new Date(), saas_plan_id: plan.dataValues.id,
        ui_prefs: JSON.stringify({ checklist_hidden: true }),
        billing_settings: JSON.stringify({
            legal_name: "Global Pathways Overseas Pvt Ltd", gstin: "24AABCG1234F1Z5",
            address: "4th Floor, Shivalik Shilp, Iscon Cross Road, Ahmedabad, Gujarat 380015",
            invoice_prefix: "GPO", default_gst_percent: 18, upi_id: "globalpathways@hdfcbank",
            bank_details: "HDFC Bank, A/c 50200012345678, IFSC HDFC0001234", terms: "Fees once paid are non-refundable after the university application is submitted.",
        }),
    });
    const agencyUuid = owner.dataValues.uuid, agencyId = owner.dataValues.id;
    await applyPeriod({ agencyUuid, planId: plan.dataValues.id, kind: "complimentary", startsAt: daysFromNow(-60), endsAt: daysFromNow(305), note: "Demo agency", adminId: null });

    const branchByName: Record<string, number> = {};
    for (const b of BRANCHES) {
        const row: any = await AgencyBranch.create({ agency_uuid: agencyUuid, name: b.name, city: b.city, address: b.address, phone: b.phone, email: b.email, routing_cities: b.routing });
        branchByName[b.name] = row.dataValues.id;
    }

    const staffByName: Record<string, number> = { "Priya Sharma": agencyId };
    const codes: { who: string; phone: string; code: string }[] = [{ who: "Priya Sharma (owner)", phone: OWNER_PHONE, code: await setLoginCode(agencyId) }];
    for (const t of TEAM) {
        const m: any = await Agent.create({
            username: t.name, email: t.email, phone_number: t.phone, country_code: "+91", role: "sub-agent", status: "active", is_verified: 1,
            designation: t.designation, team_role: t.role, branch_id: branchByName[t.branch], parent_uuid: agencyUuid, parent_id: agencyId,
        });
        staffByName[t.name] = m.dataValues.id;
        codes.push({ who: `${t.name} (${t.designation})`, phone: t.phone, code: await setLoginCode(m.dataValues.id) });
    }
    const branchOfStaff = (name?: string) => {
        const t = TEAM.find((x) => x.name === name);
        return t ? branchByName[t.branch] : branchByName.Ahmedabad;
    };

    // visa templates the agency has saved (Visa templates page)
    const templates: Record<string, any> = {};
    for (const key of ["canada-study", "uk-study", "australia-study", "usa-f1", "germany-study"]) {
        const lib: any = findLibraryTemplate(key);
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
            email: l.email || null, city: l.city, interested_country: l.country, interested_course: l.course, intake: l.case?.intake || null,
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
            await act("call", "Call: discussed courses, budget and intake", new Date(created.getTime() + DAY / 2), assignee);
            await act("note", `Shortlisted ${l.country} options for ${l.course}`, new Date(created.getTime() + DAY), assignee);
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

    // ---------------------------------------------------------------- 4. visa cases (real conversion) at every stage
    const caseOf: Record<string, { id: number; studentId: number; studentUuid: string; spec: CaseSpec; lead: LeadSpec }> = {};
    for (const l of LEADS.filter((x) => x.case)) {
        const spec = l.case!;
        const lead = await CrmLead.findByPk(leadByName[l.name].dataValues.id);
        const counsellorId = staffByName[spec.counsellor];
        const result: any = await convertLeadToCase({
            agencyUuid, agencyId, userId: counsellorId, lead, country: l.country, intake: spec.intake, course: l.course,
            university: spec.university, assignTo: counsellorId, branchId: branchOfStaff(spec.counsellor), template: templates[spec.template],
        });
        const caseId = result.caseId, studentId = result.studentId;
        const student: any = await User.findByPk(studentId);
        const convertedAt = new Date(now.getTime() - Math.max(1, l.daysAgo - 4) * DAY);
        await setTimes("agency_leads", caseId, convertedAt);
        await sequelize.query("UPDATE crm_leads SET converted_at = ? WHERE id = ?", { replacements: [convertedAt, lead.dataValues.id] });
        await setTimes("user", studentId, convertedAt);

        // progress: steps done up to the stage, outcome for finished cases
        const steps: any[] = await Step.findAll({ where: { lead_id: caseId }, order: [["step_order", "ASC"]] });
        const stageIdx = spec.outcome ? STAGES.length : STAGES.indexOf(spec.stage || "documents");
        const doneCount = spec.outcome ? (spec.outcome === "withdrawn" ? Math.floor(steps.length / 3) : steps.length) : Math.min(steps.length - 1, Math.round((steps.length * stageIdx) / STAGES.length));
        for (const [i, st] of steps.entries()) {
            const done = i < doneCount;
            await Step.update({
                step_status: done ? 1 : 0,
                // first open step: due soon (one case overdue to show the warning); later ones spread out
                due_date: done ? null : dateOnly(i === doneCount ? (spec.stage === "documents" && l.name === "Aditya Verma" ? -2 : 3 + (i % 4)) : 7 + i * 5),
            }, { where: { id: st.dataValues.id } });
            if (done) await Question.update({ status: "completed", question_answer: "Received and verified" }, { where: { step_id: st.dataValues.id } });
        }
        const caseStatus = spec.outcome === "approved" ? "visa_completed" : spec.outcome === "rejected" ? "visa_rejected" : spec.outcome === "withdrawn" ? "withdrawn" : "visa_progress";
        await AgencyLeads.update({
            status: caseStatus, case_stage: spec.outcome ? "decision" : spec.stage, stage_updated_at: new Date(now.getTime() - (2 + (caseId % 6)) * DAY),
            ...(spec.outcome === "rejected" && { reason: "Refused: funds history not sufficient (blocked account opened late). Reapplying for the summer intake." }),
            ...(spec.outcome === "withdrawn" && { reason: "Student withdrew - decided to take a job offer in India." }),
        }, { where: { id: caseId }, silent: true });

        // documents waiting for review (Today > Documents to review, case page)
        if (!spec.outcome && ["documents", "application"].includes(spec.stage!)) {
            const openStep = steps[doneCount];
            if (openStep) {
                const qs: any[] = await Question.findAll({ where: { step_id: openStep.dataValues.id }, order: [["id", "ASC"]], limit: 3 });
                for (const q of qs) {
                    await Question.update({
                        status: "provided",
                        question_answer: q.dataValues.question_type === "text_input" ? "IELTS Academic - overall 7.0 (L 7.5, R 7.0, W 6.5, S 7.0)" : "Uploaded via student portal",
                    }, { where: { id: q.dataValues.id } });
                }
            }
        }
        caseOf[l.name] = { id: caseId, studentId, studentUuid: student.dataValues.uuid, spec, lead: l };
        if (spec.hero) codes.push({ who: `${l.name} (student, ${spec.outcome || spec.stage})`, phone: l.phone, code: await setStudentLoginCode(studentId) });
    }

    // student profiles for the demo students
    const profiles: Record<string, any> = {
        "Aarav Shah": { field_of_study: "Business Administration", degree_level: "Masters", preferred_country: "Canada", budget: "25-30 lakh", academic_performance: "B.Com 78%", test_scores: true, test_score_details: { score: "IELTS 7.5", validity_period: dateOnly(400) } },
        "Kabir Mehta": { field_of_study: "Nursing", degree_level: "Bachelors", preferred_country: "Australia", budget: "30-35 lakh", academic_performance: "12th Science 82%", test_scores: true, test_score_details: { score: "PTE 65", validity_period: dateOnly(500) } },
        "Saanvi Nair": { field_of_study: "Information Technology", degree_level: "Masters", preferred_country: "Australia", budget: "28-32 lakh", academic_performance: "B.Tech IT 8.1 CGPA", test_scores: true, test_score_details: { score: "IELTS 7.0", validity_period: dateOnly(600) } },
    };
    for (const [name, p] of Object.entries(profiles)) {
        await StudentBasicDetails.create({
            student_uuid: caseOf[name].studentUuid, study_abroad_intentions: "Yes", study_abroad_reasons: "Global exposure and post-study work rights",
            career_goals: "Work in my field abroad for a few years", preferred_job_roles: "Analyst, Manager", course_selection: caseOf[name].lead.course,
            program_duration: "2 years", university_preferences: caseOf[name].spec.university, scholarship_requirements: false, ...p,
        });
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
            agency_uuid: agencyUuid, number: await nextNumber(agencyUuid, "GPO", t), student_id: c.studentId, case_id: c.id,
            branch_id: branchOfStaff(c.spec.counsellor), title: o.title, items, subtotal, gst_percent: o.gst, gst_amount: gstAmount, total,
            issue_date: dateOnly(-o.issuedDaysAgo), due_date: inst ? inst[inst.length - 1].due_date : dateOnly(o.dueIn), installments: inst || null,
            notes: "Thank you for choosing Global Pathways Overseas.", created_by: staffByName["Sameer Khan"],
            service_id: o.serviceIndex !== undefined ? serviceIds[o.serviceIndex] : null,
        }, { transaction: t }));
        await setTimes("client_invoices", inv.dataValues.id, daysFromNow(-o.issuedDaysAgo, 11));
        for (const [share, method, daysAgo, ref] of o.payments || []) {
            const fresh: any = await ClientInvoice.findByPk(inv.dataValues.id);
            const amount = share >= 1 ? Number(fresh.dataValues.total) - Number(fresh.dataValues.amount_paid) : Math.round(total * share);
            const p: any = await recordPayment(fresh, amount, method, { reference: ref || null, paidAt: daysFromNow(-daysAgo, 15), userId: staffByName["Sameer Khan"] });
            await setTimes("client_payments", p.dataValues.id, daysFromNow(-daysAgo, 15));
        }
        return inv;
    };
    const visaFee: [string, number][] = [["Visa filing & documentation", 45000], ["University application processing", 15000]];
    await invoice({ name: "Aarav Shah", title: "Canada study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 50, dueIn: -30, payments: [[0.5, "upi", 48, "UTR 4021 7781 2210"], [1, "bank_transfer", 20, "NEFT HDFC0001234"]] });
    await invoice({ name: "Diya Patel", title: "UK study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 47, dueIn: -25, payments: [[1, "upi", 40, "UTR 3398 1102 4456"]] });
    await invoice({ name: "Dhruv Chauhan", title: "Australia study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 55, dueIn: -35, payments: [[1, "cheque", 45, "Cheque 004512"]] });
    await invoice({ name: "Kabir Mehta", title: "Australia study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 40, dueIn: 10,
        installments: [["Registration", 0.4, -35], ["Before visa filing", 0.4, -5], ["After visa decision", 0.2, 25]], payments: [[0.4, "upi", 34, "UTR 7781 2009 1140"], [0.4, "card", 4, "POS 88231"]] });
    await invoice({ name: "Ananya Rao", title: "Germany study visa package", lines: [["Visa filing & documentation", 40000], ["APS & blocked account assistance", 10000]], gst: 18, issuedDaysAgo: 36, dueIn: -6, payments: [[0.5, "upi", 30, "UTR 5512 7781 0034"]] }); // overdue balance
    await invoice({ name: "Vihaan Joshi", title: "Canada study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 32, dueIn: 2, payments: [[0.3, "cash", 28, "Receipt book 112"]] }); // balance due in 2 days
    await invoice({ name: "Ishita Trivedi", title: "USA F1 visa package", lines: [["F1 visa filing & mock interviews", 35000], ["University applications (4)", 20000]], gst: 18, issuedDaysAgo: 30, dueIn: 12,
        installments: [["Registration", 0.5, -28], ["Before I-20", 0.5, 12]], payments: [[0.5, "upi", 27, "UTR 6620 1134 8890"]] });
    await invoice({ name: "Saanvi Nair", title: "Australia study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 18, dueIn: 1 }); // unpaid, due tomorrow
    await invoice({ name: "Aditya Verma", title: "Canada study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 14, dueIn: -3 }); // unpaid, overdue
    await invoice({ name: "Riya Solanki", title: "UK study visa package", lines: visaFee, gst: 18, issuedDaysAgo: 22, dueIn: 8, payments: [[0.25, "upi", 20, "UTR 1203 4498 2201"]] });
    // services bought by students -> service orders
    const svcInvoices = [
        await invoice({ name: "Kabir Mehta", title: SERVICES[0].name, lines: [[SERVICES[0].name, SERVICES[0].price]], gst: 18, issuedDaysAgo: 38, dueIn: -30, serviceIndex: 0, payments: [[1, "upi", 37, "UTR 9902 1132 0045"]] }),
        await invoice({ name: "Saanvi Nair", title: SERVICES[1].name, lines: [[SERVICES[1].name, SERVICES[1].price]], gst: 18, issuedDaysAgo: 6, dueIn: 0, serviceIndex: 1, payments: [[1, "upi", 5, "Razorpay pay_Demo123"]] }),
        await invoice({ name: "Ishita Trivedi", title: SERVICES[2].name, lines: [[SERVICES[2].name, SERVICES[2].price]], gst: 18, issuedDaysAgo: 9, dueIn: 0, serviceIndex: 2, payments: [[1, "card", 8, "POS 77120"]] }),
        await invoice({ name: "Aarav Shah", title: SERVICES[5].name, lines: [[SERVICES[5].name, SERVICES[5].price]], gst: 18, issuedDaysAgo: 4, dueIn: 0, serviceIndex: 5, payments: [[1, "upi", 3, "UTR 4410 2290 7781"]] }),
    ];
    const orderPlan: [string, string, string[]][] = [
        ["completed", "Kavya Iyer", ["Batch allotted: Morning batch (Mon-Fri 8-10 am)", "Mock test 1: overall 6.5", "Mock test 4: overall 7.0 - course completed"]],
        ["in_progress", "Neha Patel", ["Questionnaire received from student", "First SOP draft in progress"]],
        ["delivered", "Rohan Mehta", ["Financial documents checked", "Visa file delivered for review - please confirm"]],
        ["new", "Kavya Iyer", []],
    ];
    for (const [i, inv] of svcInvoices.entries()) {
        const order: any = await createOrderForInvoice(await ClientInvoice.findByPk(inv.dataValues.id));
        const [status, who, notes] = orderPlan[i];
        for (const msg of notes) await ServiceOrderUpdate.create({ order_id: order.dataValues.id, agency_uuid: agencyUuid, kind: "message", author_type: "staff", author_id: staffByName[who], author_name: who, message: msg, internal: false });
        await ServiceOrder.update({
            status, assigned_to: staffByName[who], due_date: dateOnly(status === "new" ? 7 : 4),
            ...(status === "delivered" && { delivered_at: daysFromNow(-1) }), ...(status === "completed" && { delivered_at: daysFromNow(-10), completed_at: daysFromNow(-8) }),
            last_update_at: daysFromNow(-(i + 1)),
        }, { where: { id: order.dataValues.id } });
    }

    // ---------------------------------------------------------------- 6. calendar, templates, contact requests, notifications, spend
    const events: [string, string, number, string, string][] = [
        ["Kabir Mehta", "Biometrics appointment at VFS Ahmedabad", 2, "10:30:00", "Arjun Desai"],
        ["Ishita Trivedi", "Mock F1 visa interview", 1, "16:00:00", "Rohan Mehta"],
        ["Aarav Shah", "Pre-departure briefing", 4, "17:00:00", "Neha Patel"],
        ["Saanvi Nair", "Document review call", 0, "18:30:00", "Kavya Iyer"],
        ["Vihaan Joshi", "GIC & funds discussion with parents", 3, "11:00:00", "Neha Patel"],
        ["Riya Solanki", "Offer letter walkthrough", -1, "15:00:00", "Arjun Desai"],
    ];
    for (const [name, description, day, time, who] of events) {
        await LeadsCalendar.create({ created_by: agencyId, assgin_to: staffByName[who], description, lead_id: caseOf[name].id, user_id: caseOf[name].studentId, event_type: "event", date: daysFromNow(day, 0), time, is_done: day < 0 ? 1 : 0, is_last: 1 });
    }

    const tmpl: [string, string, string, string | null, string][] = [
        ["Welcome new enquiry", "whatsapp", "lead_created", null, "Hi {{name}}, thank you for contacting {{agency}}! Our counsellor will call you shortly. Meanwhile, tell us your preferred country and intake."],
        ["Follow-up after counselling", "whatsapp", "manual", null, "Hi {{name}}, it was great speaking with you. Shall we start your {{country}} application this week?"],
        ["Documents pending", "email", "documents_pending", "Documents pending for your {{country}} application", "Dear {{name}},\n\n{{pending_count}} documents are still pending for your application. Please upload them here: {{portal_link}}\n\nTeam {{agency}}"],
        ["Fee reminder", "whatsapp", "fee_due", null, "Hi {{name}}, a payment of Rs {{amount}} is due on {{due_date}}. Pay online from your student portal: {{portal_link}}"],
        ["Welcome to the student portal", "email", "lead_converted", "Your {{agency}} student portal is ready", "Dear {{name}},\n\nTrack your {{country}} application, upload documents and pay fees here: {{portal_link}}\n\nTeam {{agency}}"],
    ];
    for (const [i, [name, channel, trigger, subject, body]] of tmpl.entries()) {
        await MessageTemplate.create({ agency_uuid: agencyUuid, name, channel, trigger, subject, body, is_active: true, sent_count: [42, 18, 26, 31, 14][i] });
    }

    const contacts = [
        ["Rahul Vyas", "9000000401", "rahul.vyas@example.com", "Do you help with spouse visas for Canada?"],
        ["Sneha Parikh", "9000000402", "sneha.parikh@example.com", "Want to visit your Surat office this Saturday."],
        ["Mohit Jadeja", "9000000403", "", "Need help with a UK visitor visa for my parents."],
        ["Pooja Rawal", "9000000404", "pooja.rawal@example.com", "What are your charges for SOP writing?"],
        ["Faizan Qureshi", "9000000405", "faizan.q@example.com", "Interested in MBBS abroad, please call."],
    ];
    for (const [i, [name, number, email, message]] of contacts.entries()) {
        const c: any = await ContactUs.create({ name, number, email, message, agent_id: agencyId });
        await setTimes("contact_us", c.dataValues.id, daysFromNow(-i * 2, 12 + i));
    }

    const notes: [string, string, string, string, number, boolean][] = [
        ["new_lead", "New lead: Krish Malhotra", "Facebook · Canada · MS Data Analytics", `/crm/leads/${leadByName["Krish Malhotra"].dataValues.uuid}`, 0, false],
        ["whatsapp_message", "WhatsApp from Krish Malhotra", "MS Data Analytics, Sep intake", `/crm/chats`, 0, false],
        ["document_uploaded", "Saanvi Nair uploaded documents", "3 documents waiting for review", `/leads/progress/${caseOf["Saanvi Nair"].id}`, 0, false],
        ["payment_received", "Payment received: Kabir Mehta", "Rs 29,736 by card", `/fees`, 4, true],
        ["follow_up_due", "4 follow-ups due today", "Mira Pandya, Shaurya Rana, Sia Mistry and 1 more", `/crm/leads?follow_up=today`, 0, false],
        ["case_assigned", "New visa case: Aditya Verma", "Canada · University of Waterloo", `/leads/progress/${caseOf["Aditya Verma"].id}`, 12, true],
    ];
    for (const [type, title, body, link, daysAgo, read] of notes) {
        const n: any = await Notification.create({ agency_uuid: agencyUuid, recipient_id: agencyId, type, title, body, link, read_at: read ? daysFromNow(-daysAgo, 18) : null });
        await setTimes("notifications", n.dataValues.id, daysFromNow(-daysAgo, 9 + (title.length % 8)));
    }

    const spend: [string, number, number][] = [["facebook", 22000, 18000], ["google", 15000, 12000], ["instagram", 9000, 8000], ["indiamart", 5000, 5000], ["justdial", 3000, 3000], ["sulekha", 2500, 2000]];
    for (const [source, thisMonth, lastMonth] of spend) {
        await MarketingSpend.create({ agency_uuid: agencyUuid, month: monthKey(0), source, amount: thisMonth });
        await MarketingSpend.create({ agency_uuid: agencyUuid, month: monthKey(-1), source, amount: lastMonth });
    }

    // ---------------------------------------------------------------- 7. job posts (Career page in the portal) + applications
    const jobs = [
        { jobType: "Full-time", country: "CA", jobRole: "Warehouse Associate", salaryMin: 2800, salaryMax: 3400, experienceRequired: 1, educationLevel: "12th pass", workPermit: "Employment Visa (ECNR)", overtime: true, accommodation: false, transportation: true, food: "Not included", medicalInsurance: true, workHours: "40 hours/week", agentCharges: "Rs 1,50,000", skillsRequired: "Forklift, inventory, teamwork", description: "Warehouse role in Brampton, Ontario with overtime." },
        { jobType: "Full-time", country: "DE", jobRole: "Nursing Assistant", salaryMin: 2600, salaryMax: 3100, experienceRequired: 2, educationLevel: "GNM / B.Sc Nursing", workPermit: "Employment Visa (ECNR)", overtime: false, accommodation: true, transportation: false, food: "Subsidised", medicalInsurance: true, workHours: "38 hours/week", agentCharges: "Rs 2,00,000", skillsRequired: "Patient care, German B1", description: "Hospital placement in Bavaria. German B1 required (training support available)." },
        { jobType: "Temporary/Contract", country: "AE", jobRole: "Hotel Front Desk Executive", salaryMin: 1800, salaryMax: 2300, experienceRequired: 1, educationLevel: "Hotel management diploma", workPermit: "Employment Visa (ECR)", overtime: true, accommodation: true, transportation: true, food: "Included", medicalInsurance: true, workHours: "48 hours/week", agentCharges: "Rs 60,000", skillsRequired: "English, guest relations", description: "2-year contract with a 4-star hotel in Dubai." },
    ];
    const jobUuids: string[] = [];
    for (const j of jobs) {
        const row: any = await JobPost.create({ agent_uuid: agencyUuid, ...j, applicationDeadline: daysFromNow(20), job_post_end_date: daysFromNow(30) });
        jobUuids.push(row.dataValues.uuid);
    }
    await JobApplicants.create({ job_post_uuid: jobUuids[0], user_uuid: caseOf["Kiara Bhatt"].studentUuid, status: "accept" });
    await JobApplicants.create({ job_post_uuid: jobUuids[1], user_uuid: caseOf["Kabir Mehta"].studentUuid, status: "pending" });
    await JobApplicants.create({ job_post_uuid: jobUuids[2], user_uuid: caseOf["Arnav Gupta"].studentUuid, status: "pending" });

    // ---------------------------------------------------------------- 8. agency profile (Basic profile page + portal "about")
    const profile: any = await AgentProfile.create({
        agent_uuid: agencyUuid,
        officeStreetAddress: "4th Floor, Shivalik Shilp, Iscon Cross Road", officeArea: "Satellite", officeCity: "Ahmedabad",
        officeStateProvince: "Gujarat", officeCountry: "India", officePostalCode: "380015", latitude: "23.0273", longitude: "72.5070",
        aboutUs: "Founded in 2014, Global Pathways Overseas has helped 4,000+ students study in Canada, the UK, Australia, the USA and Germany. Our mission: honest counselling and a visa file done right the first time.",
        detailedDescription: "<p>We handle everything from university shortlisting and applications to SOPs, education loans, visa filing and pre-departure briefings.</p><p>Specialisations: Canada SDS and non-SDS, UK Graduate route, Australia subclass 500, USA F1 and Germany APS + blocked account.</p>",
        website: "https://globalpathways.example", socialFacebook: "https://facebook.com/globalpathways.example", socialInstagram: "https://instagram.com/globalpathways.example",
        socialLinkedIn: "https://linkedin.com/company/globalpathways-example", socialYouTube: "https://youtube.com/@globalpathways-example",
        contactEmail: "hello@globalpathways.example", contactPhoneNumber: "+91 98250 00000", contactWhatsApp: "+91 98250 00000",
        operatingHoursWeekdays: "Mon - Sat, 10:00 AM - 7:00 PM", operatingHoursWeekends: "Sunday by appointment", operatingHoursTimeZone: "IST (GMT+5:30)",
    });
    for (const b of BRANCHES.slice(1)) {
        await BranchOffice.create({ agent_uuid: agencyUuid, streetAddress: b.address.split(",").slice(0, 2).join(","), city: b.city, stateProvince: "Gujarat", country: "India", postalCode: b.address.match(/(\d{6})/)?.[1] || "", agentProfileUUID: profile.dataValues.uuid });
    }
    for (const language of ["English", "Hindi", "Gujarati"]) await Language.create({ agent_uuid: agencyUuid, language });

    // ---------------------------------------------------------------- 9. achievement banners (portal side banners) + one waiting for approval
    const fs = await import("fs"), path = await import("path");
    const bannerDir = path.join(__dirname, "..", "..", "public", "banners");
    fs.mkdirSync(bannerDir, { recursive: true });
    const banners: [string, string, string, "1" | "2", string][] = [
        ["Visa approved - Aarav Shah, University of Toronto", "demo-visa-approved.png", "visa_consultation", "1", "accept"],
        ["Jobs abroad - Canada, Germany & UAE", "demo-jobs-abroad.png", "career", "1", "accept"],
        ["International SIM + Forex offer", "demo-sim-forex.png", "sim_card", "1", "accept"],
        ["Student health insurance from Rs 1,499/mo", "demo-health-insurance.png", "health_ins", "1", "accept"],
        ["Visa approved - Diya Patel, University of Manchester", "demo-visa-approved.png", "visa_consultation", "2", "pending"],
    ];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1), monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
    for (const [campaign_title, file, target_type, position, status] of banners) {
        fs.copyFileSync(path.join(__dirname, "demo-assets", file), path.join(bannerDir, file));
        await SideBanner.create({ agent_uuid: agencyUuid, campaign_title, image: file, start_date: monthStart, end_date: monthEnd, status, position, target_type, responses: 0 });
    }

    // ---------------------------------------------------------------- 10. health insurance / SIM card requests from the portal
    const requests: [string, string, string, string, string, string, string][] = [
        ["health", "Kabir Mehta", "kabir.mehta@example.com", "9000000303", "Australia", "Overseas Student Health Cover - single", "pending"],
        ["health", "Ananya Rao", "ananya.rao@example.com", "9000000304", "Germany", "Public health insurance (TK)", "completed"],
        ["data", "Aarav Shah", "aarav.shah@example.com", "9000000301", "Canada", "Unlimited calls + 20 GB/month", "pending"],
        ["data", "Diya Patel", "diya.patel@example.com", "9000000302", "United Kingdom", "UK SIM with 30 GB data", "completed"],
    ];
    for (const [type, name, email, phone, country, need, status] of requests) {
        await ServiceFormResponse.create({
            type_of_response: type, name, email, phone, country_of_study_or_travel: country, status, agent_id: agencyId,
            ...(type === "health" ? { coverage_type: need, start_date_of_insurance: daysFromNow(20) } : { data_requirements: need }),
        });
    }

    // ---------------------------------------------------------------- 11. tasks kanban + portal chats (additive helper; no login changes)
    const { seedDemoTasksAndChats } = await import("./seedDemoTasksChats");
    const taskChat = await seedDemoTasksAndChats({ agencyUuid, replace: false, closeDb: false });

    // ---------------------------------------------------------------- done
    const counts = {
        leads: LEADS.length, cases: Object.keys(caseOf).length, invoices: await ClientInvoice.count({ where: { agency_uuid: agencyUuid } }),
        payments: await ClientPayment.count({ where: { agency_uuid: agencyUuid } }), orders: await ServiceOrder.count({ where: { agency_uuid: agencyUuid } }),
        tasks: taskChat.taskCounts.total, portalChats: taskChat.messageCount,
    };
    console.log(`\nDemo agency "${BRAND.name}" is ready: ${counts.leads} leads, ${counts.cases} visa cases, ${counts.invoices} invoices, ${counts.payments} payments, ${counts.orders} service orders, ${counts.tasks} tasks, ${counts.portalChats} portal chat messages.`);
    console.log(`Student portal: ${PORTAL_SUBDOMAIN}.${PORTAL_DOMAIN}  (local dev: the student portal app)`);
    console.log(`\nLogin codes (mobile number + 6-digit code; new codes on every run):`);
    for (const c of codes) console.log(`  ${c.who.padEnd(44)} +91 ${c.phone}   ${c.code}`);
    await sequelize.close();
};

main().catch(async (e) => {
    console.error("Demo seed failed:", e?.message || e);
    if (e?.parent?.sqlMessage) console.error("SQL:", e.parent.sqlMessage);
    await sequelize.close().catch(() => {});
    process.exit(1);
});
