/**
 * What an agency mainly does, set on the Branding page and kept in agent.ui_prefs:
 *   "study"  - student visas (default; universities, offers, intakes)
 *   "travel" - tourist and business visas (appointments, itinerary, cover letters)
 *   "both"   - mixed; each case follows its own visa type
 * The panels and the client portal use it for stage names, wording and which tools to show.
 */
export type BusinessFocus = "study" | "travel" | "both";
export const BUSINESS_FOCUS: BusinessFocus[] = ["study", "travel", "both"];

export const readUiPrefs = (raw: any): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(String(raw)) || {}; } catch { return {}; }
};

export const businessFocusOf = (uiPrefs: any): BusinessFocus => {
    const v = readUiPrefs(uiPrefs).business_focus;
    return BUSINESS_FOCUS.includes(v) ? v : "study";
};

/** Per-agency opt-out: hide itinerary / cover letter / funds block on case progress (Branding focus unchanged). */
export const hideTravelDocumentsOf = (uiPrefs: any): boolean =>
    readUiPrefs(uiPrefs).hide_travel_documents === true;

/** Per-agency opt-out: hide university commission tracking (nav, case UI, API). */
export const hideCommissionsOf = (uiPrefs: any): boolean =>
    readUiPrefs(uiPrefs).hide_commissions === true;

/** Is this visa type a tourist / visitor / business visa (rather than a study visa)? */
export const isTravelVisaType = (visaType?: string | null) =>
    /tour|visit|business|travel|b1|b2|schengen|transit|family|conference/i.test(String(visaType || "")) && !/stud|f-?1\b/i.test(String(visaType || ""));
