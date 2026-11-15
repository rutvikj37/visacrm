import { CreditCard } from "lucide-react";
import SubscriptionPage from "./SubscriptionPage";

/** /subscription inside the panel. */
const SubscriptionScreen = () => (
    <div className="flex flex-col gap-4 p-1 sm:p-2">
        <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><CreditCard size={24} /> Subscription</h1>
            <p className="text-sm text-default-500">Your plan, how long it lasts, and renewals.</p>
        </div>
        <SubscriptionPage />
    </div>
);

export default SubscriptionScreen;
