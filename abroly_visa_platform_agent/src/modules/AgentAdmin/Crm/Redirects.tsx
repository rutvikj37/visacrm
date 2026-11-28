import { Navigate } from "react-router-dom";
import CommissionsPage from "@/modules/AgentAdmin/Commissions/CommissionsPage";
import { showCommissions } from "@/modules/AgentAdmin/Cases/caseShared";

// Old marketplace screens: everything now starts in the Lead Inbox (add lead -> convert to visa case)
export const RedirectToLeadInbox = () => <Navigate to="/crm/leads" replace />;

/** Legacy agent / leads calendars → unified CRM calendar */
export const RedirectToCrmCalendar = () => <Navigate to="/crm/calendar" replace />;

/** Old page → its replacement, keeping the query string (e.g. /dashboard?tab=branches → /reports?tab=branches). */
const redirectTo = (path: string) => {
    const Redirect = () => {
        const extra = window.location.search.replace(/^\?/, "");
        const [base, own] = path.split("?");
        const query = [own, extra].filter(Boolean).join("&");
        return <Navigate to={`${base}${query ? `?${query}` : ""}`} replace />;
    };
    return Redirect;
};

// old visa case lists → the case board (one place for every case)
export const RedirectToCaseBoard = redirectTo("/cases/board");
export const RedirectToApprovedCases = redirectTo("/cases/board?stage=approved");
export const RedirectToRejectedCases = redirectTo("/cases/board?stage=rejected");
export const RedirectToWithdrawnCases = redirectTo("/cases/board?stage=withdrawn");
// owner reports used to live at /dashboard; everyone now uses /reports
export const RedirectToReports = redirectTo("/reports");
// old "Students" / "Applications" lists → cases accepted but not started yet
export const RedirectToNotStartedCases = redirectTo("/cases/board?stage=not_started");

/** Commissions page, or home when the agency opted out (ui_prefs.hide_commissions). */
export const CommissionsRoute = () => (showCommissions() ? <CommissionsPage /> : <Navigate to="/" replace />);
