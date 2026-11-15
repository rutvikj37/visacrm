import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { CalendarDays, Home, Inbox, KanbanSquare, Menu, Plus } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Phones only (below md): a bottom tab bar for the screens used all day, plus a round "+" button to add a lead.
 * "Menu" opens the full sidebar.
 */
const TABS = [
    { key: "home", label: "Home", icon: Home, to: "/", match: (p: string) => p === "/" || p.startsWith("/today") },
    { key: "inbox", label: "Leads", icon: Inbox, to: "/crm/leads", match: (p: string) => p.startsWith("/crm/leads") },
    { key: "cases", label: "Cases", icon: KanbanSquare, to: "/cases/board", match: (p: string) => p.startsWith("/cases") || p.startsWith("/leads/progress") },
    { key: "calendar", label: "Calendar", icon: CalendarDays, to: "/crm/calendar", match: (p: string) => p.startsWith("/crm/calendar") },
];

// pages where the "+" button would cover a form or the page's own actions
const NO_FAB = ["/crm/chats", "/crm/leads/", "/leads/progress/", "/fees/", "/subscription", "/branding", "/crm/messages", "/crm/templates"];

const PanelBottomNav = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { setOpenMobile } = useSidebar();
    const role = useSelector((state: any) => state.login.team_role);
    const canAddLeads = role !== "accounts";
    const showFab = canAddLeads && !NO_FAB.some((p) => pathname.startsWith(p));

    return (
        <>
            {showFab && (
                <button type="button" aria-label="Add lead" onClick={() => navigate("/crm/leads?add=1")}
                    className="md:hidden fixed right-4 bottom-[76px] z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 grid place-items-center active:scale-95 transition">
                    <Plus size={26} />
                </button>
            )}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-default-200 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
                <div className="grid grid-cols-5">
                    {TABS.map((t) => {
                        const active = t.match(pathname);
                        const Icon = t.icon;
                        return (
                            <button key={t.key} type="button" onClick={() => navigate(t.to)}
                                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${active ? "text-primary font-semibold" : "text-default-500"}`}>
                                <Icon size={20} strokeWidth={active ? 2.4 : 2} />{t.label}
                            </button>
                        );
                    })}
                    <button type="button" onClick={() => setOpenMobile(true)} className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-default-500">
                        <Menu size={20} />Menu
                    </button>
                </div>
            </nav>
        </>
    );
};

export default PanelBottomNav;
