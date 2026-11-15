import { Navigate } from "react-router-dom";

// Old marketplace screens now live in the SaaS section
export const RedirectToAgencies = () => <Navigate to="/saas/agencies" replace />;
export const RedirectToPlans = () => <Navigate to="/saas/plans" replace />;
export const RedirectToPayments = () => <Navigate to="/saas/payments" replace />;
