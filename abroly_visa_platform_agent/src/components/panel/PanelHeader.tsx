import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { SidebarTrigger } from "@/components/ui/sidebar";
import NotificationBell from "@/modules/AgentAdmin/Notifications/NotificationBell";
import GlobalSearch from "./GlobalSearch";
import HelpDrawer from "@/components/help/HelpDrawer";
import ThemeModeButton from "./ThemeModeButton";

/** Page titles for the top bar, by path prefix (longest match wins). */
const TITLES: [string, string][] = [
    ["/today", "Today"], ["/dashboard", "Reports"], ["/reports", "Branch report"],
    ["/crm/leads", "Lead Inbox"], ["/crm/chats", "Chats"], ["/crm/calendar", "Calendar"], ["/crm/sources", "Lead sources"], ["/crm/templates", "Visa templates"],
    ["/cases/board", "Case board"], ["/leads/progress", "Visa case"], ["/leads", "Visa cases"], ["/fees", "Client fees"], ["/services", "Services store"], ["/services/orders", "Service order"], ["/settings/payments", "Payments"],
    ["/branches", "Branches"], ["/activity", "Activity log"], ["/team/roles", "Roles & branches"], ["/sub_agent", "Team"], ["/subscription", "Subscription"], ["/branding", "Branding"],
    ["/profile", "Profile"], ["/contact_us", "Contact us"],
];

export const pageTitle = (path: string, isOwner: boolean) => {
    if (path === "/") return isOwner ? "Today" : "Today";
    const hit = TITLES.filter(([p]) => path === p || path.startsWith(`${p}/`) || path.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
    return hit ? hit[1] : "";
};

/** Top bar: menu button, agency logo + name, current page, notifications. */
const PanelHeader = ({ onMenu }: { onMenu?: () => void }) => {
    const { pathname } = useLocation();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const agency = useSelector((state: any) => state.login.agency);
    const name = agency?.name || "Agency";
    const title = pageTitle(pathname, isOwner);
    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-default-100 bg-background/90 backdrop-blur px-3 sm:px-4">
            <SidebarTrigger onClick={onMenu} className="-ml-1" />
            <div className="flex items-center gap-2 min-w-0">
                {agency?.logo
                    ? <img src={agency.logo} alt="" className="h-7 w-7 rounded-md object-cover shrink-0" />
                    : <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold shrink-0">{name.slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0 leading-tight">
                    <div className="text-sm font-semibold truncate">{title || name}</div>
                    {title && <div className="text-[11px] text-default-500 truncate">{name}</div>}
                </div>
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2"><GlobalSearch /><ThemeModeButton /><HelpDrawer /><NotificationBell /></div>
        </header>
    );
};

export default PanelHeader;
