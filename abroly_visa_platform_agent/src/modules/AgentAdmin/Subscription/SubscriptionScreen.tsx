import SubscriptionPage from "./SubscriptionPage";

/** /subscription inside the panel. */
const SubscriptionScreen = () => (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
        <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Subscription</h1>
            <p className="text-sm text-default-500">Your plan, renewal date, usage limits, and invoices.</p>
        </div>
        <SubscriptionPage />
    </div>
);

export default SubscriptionScreen;
