import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Home, IndianRupee, Menu, MessagesSquare, Route } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { getConfig } from "@/utils/config";

const TABS = [
  { key: "home", label: "Home", icon: Home, to: "/", match: (p: string) => p === "/" },
  { key: "progress", label: "Progress", icon: Route, to: "/my_progress", match: (p: string) => p.startsWith("/my_progress") || p.startsWith("/accepted_applications") },
  { key: "chat", label: "Chat", icon: MessagesSquare, to: "/chat", match: (p: string) => p.startsWith("/chat") },
  { key: "fees", label: "Fees", icon: IndianRupee, to: "/my_fees", match: (p: string) => p.startsWith("/my_fees") },
] as const;

/** Phones only: quick tabs for daily student actions; Menu opens the full sidebar. */
const StudentBottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();

  const planAddons: string[] | null = (() => {
    try { return JSON.parse(getConfig("ADDONS") || "null"); } catch { return null; }
  })();
  const showJobs = !planAddons || planAddons.includes("jobs");

  // Keep five slots on phones: drop Fees when Jobs is in the plan (Fees stays in sidebar).
  const tabs = showJobs
    ? [
        ...TABS.slice(0, 3),
        { key: "jobs", label: "Jobs", icon: Briefcase, to: "/career/1", match: (p: string) => p.startsWith("/career") },
      ]
    : [...TABS];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-default-200 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(t.to)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${active ? "text-primary font-semibold" : "text-default-500"}`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] text-default-500"
        >
          <Menu size={20} />
          Menu
        </button>
      </div>
    </nav>
  );
};

export default StudentBottomNav;
