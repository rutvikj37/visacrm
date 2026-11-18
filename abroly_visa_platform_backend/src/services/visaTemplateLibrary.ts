/**
 * Built-in visa process templates every agency can use straight away (or copy and edit).
 *
 * A template is a list of steps. Each step has questions for the student:
 *   - text_input:    the student types an answer
 *   - file_selector: the student uploads a document
 * When a lead is converted, the chosen template becomes the case's Steps + Questions
 * (the same tables the agency already uses on the visa progress screen).
 */

export type TemplateQuestionType = "text_input" | "file_selector";

export interface TemplateQuestion {
    text: string;
    type: TemplateQuestionType;
}

export interface TemplateStep {
    title: string;
    description?: string;
    due_in_days?: number | null; // due date = case start + this many days
    questions: TemplateQuestion[];
}

export interface LibraryTemplate {
    key: string;
    name: string;
    country: string;
    visa_type: string;
    description: string;
    steps: TemplateStep[];
}

const file = (text: string): TemplateQuestion => ({ text, type: "file_selector" });
const text = (t: string): TemplateQuestion => ({ text: t, type: "text_input" });

const basicDocuments: TemplateStep = {
    title: "Basic documents",
    description: "Upload clear scans (PDF or photo) of your documents.",
    questions: [
        file("Passport - first and last page"),
        file("10th marksheet"),
        file("12th marksheet"),
        file("Graduation marksheets and degree (if any)"),
        file("Resume / CV"),
        text("English test taken (IELTS / PTE / TOEFL / Duolingo) and overall score"),
        file("English test score report"),
    ],
};

export const VISA_TEMPLATE_LIBRARY: LibraryTemplate[] = [
    {
        key: "canada-study",
        name: "Canada - Study Permit",
        country: "Canada",
        visa_type: "Student Visa",
        description: "College / university admission, GIC, medicals and study permit filing with IRCC.",
        steps: [
            basicDocuments,
            {
                title: "College application",
                description: "We shortlist programs and apply on your behalf.",
                questions: [
                    text("Preferred programs / colleges (in order of preference)"),
                    text("Preferred intake (e.g. Sep 2026)"),
                    file("Letters of recommendation"),
                    file("Statement of purpose draft"),
                ],
            },
            {
                title: "Offer letter & tuition deposit",
                questions: [
                    file("Offer / acceptance letter"),
                    file("Tuition fee payment receipt"),
                ],
            },
            {
                title: "GIC & proof of funds",
                questions: [
                    file("GIC certificate"),
                    file("Bank statements - last 6 months"),
                    file("Sponsor income proof (ITR / salary slips)"),
                    text("Who is sponsoring your studies? (name and relation)"),
                ],
            },
            {
                title: "Medical & biometrics",
                questions: [
                    file("Upfront medical exam receipt (IME / eMedical)"),
                    text("Biometrics appointment date and location"),
                ],
            },
            {
                title: "Study permit filing",
                questions: [
                    file("Signed application forms"),
                    file("Passport size photo (white background)"),
                    text("IRCC application number (we will update this)"),
                ],
            },
            {
                title: "Decision & pre-departure",
                questions: [
                    file("Visa / approval letter (POE letter)"),
                    text("Planned travel date"),
                ],
            },
        ],
    },
    {
        key: "uk-study",
        name: "UK - Student Visa",
        country: "United Kingdom",
        visa_type: "Student Visa",
        description: "University offer, CAS, TB test, 28-day funds, IHS and visa application.",
        steps: [
            basicDocuments,
            {
                title: "University application",
                questions: [
                    text("Preferred universities and courses"),
                    text("Preferred intake (Jan / May / Sep)"),
                    file("Statement of purpose"),
                    file("Letters of recommendation"),
                ],
            },
            {
                title: "Offer & deposit",
                questions: [
                    file("Conditional / unconditional offer letter"),
                    file("Deposit payment receipt"),
                ],
            },
            {
                title: "Funds (28-day rule) & CAS",
                questions: [
                    file("Bank statement showing funds held for 28 days"),
                    file("Education loan sanction letter (if any)"),
                    file("CAS statement"),
                ],
            },
            {
                title: "TB test & visa application",
                questions: [
                    file("TB test certificate"),
                    file("IHS payment receipt"),
                    text("VFS biometrics appointment date"),
                ],
            },
            {
                title: "Decision & travel",
                questions: [
                    file("Visa vignette / eVisa confirmation"),
                    text("Planned travel date"),
                ],
            },
        ],
    },
    {
        key: "australia-study",
        name: "Australia - Student Visa (Subclass 500)",
        country: "Australia",
        visa_type: "Student Visa",
        description: "Offer, Genuine Student statement, COE, OSHC, funds and visa lodgement.",
        steps: [
            basicDocuments,
            {
                title: "Admission",
                questions: [
                    text("Preferred universities and courses"),
                    text("Preferred intake (Feb / Jul / Nov)"),
                    file("Offer letter"),
                ],
            },
            {
                title: "Genuine Student & financials",
                questions: [
                    file("Genuine Student (GS) statement"),
                    file("Bank statements / education loan letter"),
                    file("Sponsor income proof (ITR for 3 years)"),
                ],
            },
            {
                title: "COE & OSHC",
                questions: [
                    file("Tuition fee receipt"),
                    file("Confirmation of Enrolment (COE)"),
                    file("OSHC health cover certificate"),
                ],
            },
            {
                title: "Visa lodgement",
                questions: [
                    text("ImmiAccount application reference (we will update this)"),
                    file("Health examination (HAP ID) letter"),
                    text("Biometrics appointment date"),
                ],
            },
            {
                title: "Decision & travel",
                questions: [
                    file("Visa grant notice"),
                    text("Planned travel date"),
                ],
            },
        ],
    },
    {
        key: "usa-f1",
        name: "USA - F-1 Student Visa",
        country: "United States",
        visa_type: "Student Visa",
        description: "Admission, I-20, SEVIS fee, DS-160 and visa interview preparation.",
        steps: [
            basicDocuments,
            {
                title: "Admission",
                questions: [
                    text("Preferred universities and programs"),
                    text("GRE / GMAT / SAT score (if taken)"),
                    file("Statement of purpose"),
                    file("Letters of recommendation"),
                ],
            },
            {
                title: "I-20 & funds",
                questions: [
                    file("Admission letter"),
                    file("Bank statements / loan sanction letter"),
                    file("I-20 form"),
                ],
            },
            {
                title: "SEVIS & DS-160",
                questions: [
                    file("SEVIS I-901 fee receipt"),
                    file("DS-160 confirmation page"),
                    file("Visa fee (MRV) receipt"),
                ],
            },
            {
                title: "Interview",
                questions: [
                    text("OFC (biometrics) appointment date"),
                    text("Visa interview date and consulate"),
                ],
            },
            {
                title: "Decision & travel",
                questions: [
                    file("Visa stamp page"),
                    text("Planned travel date"),
                ],
            },
        ],
    },
    {
        key: "germany-study",
        name: "Germany - Student Visa",
        country: "Germany",
        visa_type: "Student Visa",
        description: "APS, admission, blocked account, health insurance and embassy appointment.",
        steps: [
            basicDocuments,
            {
                title: "APS & admission",
                questions: [
                    file("APS certificate"),
                    text("Universities applied to (uni-assist / direct)"),
                    file("Admission letter"),
                ],
            },
            {
                title: "Blocked account & insurance",
                questions: [
                    file("Blocked account confirmation"),
                    file("Travel / health insurance certificate"),
                ],
            },
            {
                title: "Embassy appointment",
                questions: [
                    file("Visa application form (VIDEX)"),
                    file("Motivation letter"),
                    text("Embassy / VFS appointment date"),
                ],
            },
            {
                title: "Decision & travel",
                questions: [
                    file("Visa copy"),
                    text("Planned travel date"),
                ],
            },
        ],
    },
    {
        key: "tourist-general",
        name: "Tourist / Visitor Visa (any country)",
        country: "Any",
        visa_type: "Tourist Visa",
        description: "Standard document checklist for tourist and visitor visas.",
        steps: [
            {
                title: "Travel details",
                questions: [
                    text("Country you want to visit and purpose of travel"),
                    text("Planned travel dates"),
                    text("Who is travelling with you?"),
                ],
            },
            {
                title: "Documents",
                questions: [
                    file("Passport - first and last page"),
                    file("Old passports / previous visas (if any)"),
                    file("Passport size photo (white background)"),
                    file("Bank statements - last 6 months"),
                    file("Income tax returns - last 2 years"),
                    file("Employment letter / business registration"),
                ],
            },
            {
                title: "Bookings",
                questions: [
                    file("Flight reservation"),
                    file("Hotel bookings / invitation letter"),
                    file("Travel insurance"),
                ],
            },
            {
                title: "Appointment & decision",
                questions: [
                    text("Biometrics / interview appointment date"),
                    file("Visa copy"),
                ],
            },
        ],
    },
];


// ------------------------------------------------------------------ tourist & business visas
// Seven steps that follow the case stages: trip -> documents -> finances -> work / invitation -> bookings
// -> appointment -> decision. `extra` adds country-specific items to a step.
type TravelExtra = Partial<Record<"trip" | "personal" | "finance" | "work" | "bookings" | "appointment", TemplateQuestion[]>>;
const travelSteps = (business: boolean, extra: TravelExtra = {}): TemplateStep[] => [
    {
        title: "Trip details", due_in_days: 2,
        description: business ? "Tell us about the meetings / event and your travel plan." : "Tell us where you want to go and who is travelling.",
        questions: [
            text(business ? "Purpose of the trip (meetings, trade fair, conference) and the company you will visit" : "Cities / places you want to visit"),
            text("Planned travel dates (from - to)"),
            text("Who is travelling? (names and relation)"),
            ...(extra.trip || []),
        ],
    },
    {
        title: "Personal documents", due_in_days: 4,
        description: "Clear colour scans of every page that has a stamp.",
        questions: [
            file("Passport - first and last page (valid 6+ months after return)"),
            file("Old passports / previous visas (if any)"),
            file("Passport size photo (white background, recent)"),
            file("Aadhaar card and PAN card"),
            ...(extra.personal || []),
        ],
    },
    {
        title: "Financial documents", due_in_days: 6,
        description: "Statements must show regular income and enough balance for the trip.",
        questions: [
            file("Bank statements - last 6 months (stamped by the bank)"),
            file("Income tax returns / Form 16 - last 3 years"),
            business ? file("Company bank statements - last 6 months") : file("Salary slips - last 3 months (or business proof if self-employed)"),
            text("Who is paying for the trip? (self / company / sponsor)"),
            ...(extra.finance || []),
        ],
    },
    business ? {
        title: "Company & invitation", due_in_days: 8,
        description: "Letters on company letterhead, signed and stamped.",
        questions: [
            file("Invitation letter from the company / event you are visiting"),
            file("Cover letter from your company (purpose, dates, who pays)"),
            file("Company registration / GST certificate"),
            file("Visiting card and employee ID / proof of directorship"),
            ...(extra.work || []),
        ],
    } : {
        title: "Work & ties to India", due_in_days: 8,
        description: "Shows the visa officer you will come back after the trip.",
        questions: [
            file("Leave letter / NOC from employer (or business registration if self-employed)"),
            file("Property papers or other ties to India (optional, helps)"),
            file("Students: school / college ID and bonafide letter"),
            ...(extra.work || []),
        ],
    },
    {
        title: "Bookings & itinerary", due_in_days: 10,
        description: "We prepare the day-by-day itinerary and cover letter for you.",
        questions: [
            file("Flight reservation (return)"),
            file("Hotel bookings for every night"),
            file("Travel insurance"),
            text("Any changes to the itinerary we prepared?"),
            ...(extra.bookings || []),
        ],
    },
    {
        title: "Appointment & submission", due_in_days: 14,
        description: "Carry the original documents and the printed file to the appointment.",
        questions: [
            text("Appointment date and centre (VFS / embassy)"),
            file("Signed application form"),
            ...(extra.appointment || []),
        ],
    },
    {
        title: "Decision & passport",
        description: "Upload the visa copy once your passport is back.",
        questions: [file("Visa copy (first page with the visa)")],
    },
];

const TRAVEL_TEMPLATES: LibraryTemplate[] = [
    {
        key: "schengen-tourist", name: "Schengen Tourist Visa (Europe)", country: "Schengen (Europe)", visa_type: "Tourist Visa",
        description: "Short-stay tourist visa for France, Italy, Switzerland, Germany, Spain and other Schengen countries.",
        steps: travelSteps(false, {
            bookings: [file("Schengen travel insurance - min EUR 30,000 cover for all days")],
            appointment: [text("Main destination country (where you stay longest) - you apply to that embassy")],
        }),
    },
    {
        key: "schengen-business", name: "Schengen Business Visa (Europe)", country: "Schengen (Europe)", visa_type: "Business Visa",
        description: "Short-stay business visa for meetings, trade fairs and conferences in the Schengen area.",
        steps: travelSteps(true, {
            work: [file("Trade fair / conference registration (if attending one)")],
            bookings: [file("Schengen travel insurance - min EUR 30,000 cover for all days")],
        }),
    },
    {
        key: "uk-visitor", name: "UK Standard Visitor Visa (tourism)", country: "United Kingdom", visa_type: "Tourist Visa",
        description: "UK visitor visa for holidays and visiting family.",
        steps: travelSteps(false, { trip: [text("Have you travelled to the UK, USA, Canada or Schengen before? Which years?")], finance: [file("Sponsor's letter and documents (if someone else pays)")] }),
    },
    {
        key: "uk-business-visitor", name: "UK Standard Visitor Visa (business)", country: "United Kingdom", visa_type: "Business Visa",
        description: "UK visitor visa for meetings, conferences and site visits (no paid work).",
        steps: travelSteps(true, { trip: [text("Have you travelled to the UK, USA, Canada or Schengen before? Which years?")] }),
    },
    {
        key: "usa-b1b2", name: "USA B1/B2 Visitor Visa", country: "USA", visa_type: "Business / Tourist Visa (B1/B2)",
        description: "US visitor visa for business and tourism, with DS-160 and interview preparation.",
        steps: travelSteps(false, {
            trip: [text("Purpose: tourism, business meetings or both?")],
            personal: [file("DS-160 confirmation page"), text("Previous US visa refusals (if any) - year and reason")],
            appointment: [text("OFC (biometrics) date and consulate interview date"), text("Mock interview done? (we schedule it)")],
        }),
    },
    {
        key: "canada-trv", name: "Canada Visitor Visa (TRV)", country: "Canada", visa_type: "Tourist Visa",
        description: "Canada temporary resident visa for tourism or visiting family.",
        steps: travelSteps(false, { work: [file("Invitation letter from family in Canada (if visiting family)")], appointment: [text("Biometrics date at VFS")] }),
    },
    {
        key: "dubai-tourist", name: "Dubai / UAE Tourist Visa (30 or 60 days)", country: "United Arab Emirates", visa_type: "Tourist Visa",
        description: "Quick e-visa for Dubai and the UAE - usually ready in 3-5 working days.",
        steps: [
            { title: "Trip details", due_in_days: 1, questions: [text("Travel dates and 30 or 60 day visa?"), text("Who is travelling? (names and relation)")] },
            { title: "Documents", due_in_days: 2, questions: [file("Passport - first and last page"), file("Passport size photo (white background)"), file("PAN card")] },
            { title: "Bookings", due_in_days: 3, questions: [file("Return flight ticket"), file("Hotel booking / host address in UAE")] },
            { title: "Visa issued", questions: [file("E-visa copy")] },
        ],
    },
    {
        key: "australia-visitor-600", name: "Australia Visitor Visa (subclass 600)", country: "Australia", visa_type: "Tourist Visa",
        description: "Australia visitor visa for tourism, family visits or business visitor activities.",
        steps: travelSteps(false, { personal: [file("Health / medical exam (if asked by the department)")], appointment: [text("Biometrics date at VFS (if asked)")] }),
    },
];
VISA_TEMPLATE_LIBRARY.push(...TRAVEL_TEMPLATES);

export const findLibraryTemplate = (key: string) => VISA_TEMPLATE_LIBRARY.find((t) => t.key === key) || null;

const MAX_STEPS = 30;
const MAX_QUESTIONS = 30;

/** Clean and validate steps coming from the client. Throws a readable message. */
export const sanitizeSteps = (raw: any): TemplateStep[] => {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("Add at least one step");
    if (raw.length > MAX_STEPS) throw new Error(`A template can have up to ${MAX_STEPS} steps`);
    return raw.map((step: any, i: number) => {
        const title = String(step?.title || "").trim().slice(0, 255);
        if (!title) throw new Error(`Step ${i + 1} needs a title`);
        const questions = Array.isArray(step?.questions) ? step.questions : [];
        if (questions.length > MAX_QUESTIONS) throw new Error(`Step ${i + 1} can have up to ${MAX_QUESTIONS} questions`);
        const due = step?.due_in_days === "" || step?.due_in_days === null || step?.due_in_days === undefined ? null : Math.round(Number(step.due_in_days));
        if (due !== null && (!Number.isFinite(due) || due < 0 || due > 730)) throw new Error(`Step ${i + 1}: due days must be between 0 and 730`);
        return {
            title,
            description: step?.description ? String(step.description).trim().slice(0, 2000) : "",
            due_in_days: due,
            questions: questions
                .map((q: any) => ({
                    text: String(q?.text || "").trim().slice(0, 1000),
                    type: (q?.type === "file_selector" ? "file_selector" : "text_input") as TemplateQuestionType,
                }))
                .filter((q: TemplateQuestion) => q.text),
        };
    });
};
