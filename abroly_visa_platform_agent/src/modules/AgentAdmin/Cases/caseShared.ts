/**
 * Case stages. Keys are fixed (stored on the case); labels follow what the agency mainly does
 * (Branding > "What does your agency mainly do?"): student visas or tourist & business visas.
 * applyCaseFlow() relabels in place at login, so every screen that imports CASE_STAGES follows.
 */
const STUDY_LABELS: Record<string, string> = {
    documents: "Documents", application: "Application", offer: "Offer", funds: "Fees & funds",
    visa_filed: "Visa filed", biometrics: "Biometrics", decision: "Decision",
};
const TRAVEL_LABELS: Record<string, string> = {
    documents: "Documents", application: "Itinerary & letters", offer: "Bookings", funds: "Funds check",
    visa_filed: "Submitted", biometrics: "Biometrics", decision: "Decision",
};

export type BusinessFocus = "study" | "travel" | "both";
const FOCUS_KEY = "business_focus";
const HIDE_TRAVEL_DOCS_KEY = "hide_travel_documents";
const HIDE_COMMISSIONS_KEY = "hide_commissions";
let focus: BusinessFocus = (() => { try { const v = localStorage.getItem(FOCUS_KEY); return v === "travel" || v === "both" ? v : "study"; } catch { return "study"; } })();
let hideTravelDocuments = (() => { try { return localStorage.getItem(HIDE_TRAVEL_DOCS_KEY) === "1"; } catch { return false; } })();
let hideCommissions = (() => { try { return localStorage.getItem(HIDE_COMMISSIONS_KEY) === "1"; } catch { return false; } })();

export const CASE_STAGES = Object.keys(STUDY_LABELS).map((key) => ({ key, label: (focus === "travel" ? TRAVEL_LABELS : STUDY_LABELS)[key] }));

export const getBusinessFocus = () => focus;
export type CaseFlowPrefs = { hide_travel_documents?: boolean; hide_commissions?: boolean };

export const applyCaseFlow = (next?: string | null, prefs?: CaseFlowPrefs) => {
    focus = next === "travel" || next === "both" ? next : "study";
    try { localStorage.setItem(FOCUS_KEY, focus); } catch { /* private mode */ }
    if (prefs?.hide_travel_documents !== undefined) {
        hideTravelDocuments = Boolean(prefs.hide_travel_documents);
        try { localStorage.setItem(HIDE_TRAVEL_DOCS_KEY, hideTravelDocuments ? "1" : "0"); } catch { /* private mode */ }
    }
    if (prefs?.hide_commissions !== undefined) {
        hideCommissions = Boolean(prefs.hide_commissions);
        try { localStorage.setItem(HIDE_COMMISSIONS_KEY, hideCommissions ? "1" : "0"); } catch { /* private mode */ }
    }
    const labels = focus === "travel" ? TRAVEL_LABELS : STUDY_LABELS;
    CASE_STAGES.forEach((s) => { s.label = labels[s.key]; });
};

/** Tourist / visitor / business visa (not a study visa)? */
export const isTravelVisaType = (visaType?: string | null) =>
    /tour|visit|business|travel|b1|b2|schengen|transit|family|conference/i.test(String(visaType || "")) && !/stud|f-?1\b/i.test(String(visaType || ""));

/** Tourist / business tools only when the agency's branding focus allows it (study = never). */
export const isTravelCase = (c?: { is_travel?: boolean; visa_type?: string | null } | null) => {
    if (focus === "study") return false;
    if (focus === "travel") return true;
    return Boolean(c?.is_travel) || isTravelVisaType(c?.visa_type);
};

/** Itinerary / cover letter / funds block on case progress (ui_prefs.hide_travel_documents opts out). */
export const showTravelDocuments = (c?: { is_travel?: boolean; visa_type?: string | null } | null) =>
    isTravelCase(c) && !hideTravelDocuments;

/** University commission UI (ui_prefs.hide_commissions opts out). */
export const showCommissions = () => !hideCommissions;

/** Stage labels for one case (travel wording for travel cases even in a mixed agency). */
export const stagesForCase = (c?: { is_travel?: boolean; visa_type?: string | null } | null) => {
    const labels = isTravelCase(c) ? TRAVEL_LABELS : STUDY_LABELS;
    return CASE_STAGES.map((s) => ({ key: s.key, label: labels[s.key] }));
};

export const OUTCOMES = [
    { key: "approved", label: "Approved", color: "success" as const },
    { key: "rejected", label: "Rejected", color: "danger" as const },
    { key: "withdrawn", label: "Withdrawn", color: "default" as const },
];

export const stageLabel = (key?: string | null) => CASE_STAGES.find((s) => s.key === key)?.label || key || "-";

export const fmtShortDate = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const isOverdue = (v?: string | null) => Boolean(v) && String(v).slice(0, 10) < new Date().toISOString().slice(0, 10);
