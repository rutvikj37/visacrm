import { useSelector } from "react-redux";

/**
 * Which modules this agency has (Super Admin → modules) and the words that go with them.
 * This is the Travel CRM, so the CRM type is always "travel" (the Visa CRM is a separate app).
 * modules null = not loaded yet or an older backend → treat everything as on, as before.
 */
export type CrmType = "visa" | "travel" | "both";

const DEFAULT_LABELS = { client: "Traveller", clients: "Travellers", case: "Booking", cases: "Bookings", agent: "Travel consultant" };

export const useModules = () => {
    const crmType = "travel" as CrmType;
    const modules: string[] | null = useSelector((s: any) => s.login.modules);
    const labels = useSelector((s: any) => s.login.labels) || DEFAULT_LABELS;
    const has = (key?: string | null) => !key || !modules || modules.includes(key);
    return { crmType, modules, labels, has, travel: has("itinerary") || has("bookings") };
};

export default useModules;
