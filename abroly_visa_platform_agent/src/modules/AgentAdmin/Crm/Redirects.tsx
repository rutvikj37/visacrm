import { Navigate } from "react-router-dom";

// Old marketplace screens: everything now starts in the Lead Inbox (add lead -> convert to visa case)
export const RedirectToLeadInbox = () => <Navigate to="/crm/leads" replace />;
