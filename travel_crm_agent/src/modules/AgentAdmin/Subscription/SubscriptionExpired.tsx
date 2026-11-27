import { useSelector } from "react-redux";
import { Button, Card, CardBody } from "@heroui/react";
import { LogOut, TimerOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { handleLogout } from "@/utils/LogoutUtils";
import SubscriptionPage from "./SubscriptionPage";

/** Full-screen view when the agency's access has ended: the owner can renew, team members are told to ask the owner. */
const SubscriptionExpired = () => {
    const navigate = useNavigate();
    const role = useSelector((state: any) => state.login.role_type);
    const name = useSelector((state: any) => state.login.user_name);

    return (
        <div className="min-h-screen bg-default-50 flex flex-col">
            <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-default-100 border-b border-default-200">
                <span className="font-semibold truncate">{name || "Your account"}</span>
                <Button size="sm" variant="light" startContent={<LogOut size={16} />} onPress={() => handleLogout(navigate)}>Log out</Button>
            </header>
            <main className="flex-1 flex flex-col items-center gap-5 p-4 sm:p-8">
                <Card shadow="sm" className="w-full max-w-5xl bg-danger-50">
                    <CardBody className="flex flex-row items-center gap-3">
                        <TimerOff className="text-danger shrink-0" size={28} />
                        <div>
                            <div className="font-semibold">
                                {role === "agent" ? "Your subscription has ended" : "Your agency's subscription has ended"}
                            </div>
                            <div className="text-sm text-default-600">
                                {role === "agent"
                                    ? "Your leads and visa cases are safe. Renew below to continue where you left off."
                                    : "Please ask your agency owner to renew. Your work is safe."}
                            </div>
                        </div>
                    </CardBody>
                </Card>
                {role === "agent" && <SubscriptionPage onRenewed={() => window.location.reload()} />}
            </main>
        </div>
    );
};

export default SubscriptionExpired;
