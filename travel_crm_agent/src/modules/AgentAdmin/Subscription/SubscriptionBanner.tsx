import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Clock } from "lucide-react";

/** Reminder at the top of the panel during a trial and in the last 7 days of a plan. */
const SubscriptionBanner = () => {
    const navigate = useNavigate();
    const subscription = useSelector((state: any) => state.login.subscription);
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    if (!subscription || subscription.expired || !subscription.ends_at) return null;
    const trial = subscription.kind === "trial";
    if (!trial && subscription.days_left > 7) return null;

    const urgent = subscription.days_left <= 3;
    const text = trial
        ? `Free trial: ${subscription.days_left} day(s) left`
        : `Your plan ends in ${subscription.days_left} day(s)`;

    return (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-sm ${urgent ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-800"}`}>
            <Clock size={16} className="shrink-0" />
            <span className="font-medium truncate min-w-0">{text}</span>
            <span className="hidden sm:inline">{isOwner ? "- choose a plan to keep your leads flowing." : "- your agency owner can renew it."}</span>
            {isOwner && <Button size="sm" color={urgent ? "danger" : "warning"} variant="flat" className="ml-auto shrink-0" onPress={() => navigate("/subscription")}>View plans</Button>}
        </div>
    );
};

export default SubscriptionBanner;
