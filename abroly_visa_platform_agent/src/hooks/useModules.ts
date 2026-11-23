import { useSelector } from "react-redux";

/**
 * Travel CRM: which modules this agency has (Super Admin → CRM type / modules) and the words that go with them.
 * modules null = not loaded yet or an older backend → treat everything as on, as before.
 */
export type CrmType = "visa" | "travel" | "both";

const DEFAULT_LABELS = { client: "Applicant", clients: "Applicants", case: "Application", cases: "Applications", agent: "Counsellor" };

export const useModules = () => {
    const crmType: CrmType = useSelector((s: any) => s.login.crm_type) || "visa";
    const modules: string[] | null = useSelector((s: any) => s.login.modules);
    const labels = useSelector((s: any) => s.login.labels) || DEFAULT_LABELS;
    const has = (key?: string | null) => !key || !modules || modules.includes(key);
    return { crmType, modules, labels, has, travel: has("itinerary") || has("bookings") };
};

export default useModules;
