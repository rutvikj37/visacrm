import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, MessagesSquare, Store } from "lucide-react";
import { Button } from "@nextui-org/react";
import ProgressTracker from "./ProgressTracker";
import InstallAppCard from "@/components/InstallAppCard";
import AchievementBanner from "@/modules/AchievementBanner/AchievementBanner";
import { getConfig } from "@/utils/config";

const BASE_LINKS = [
  {
    title: "Chat with counsellor",
    description: "Ask questions and get updates on your case.",
    icon: MessagesSquare,
    navigateTo: "/chat",
  },
  {
    title: "Services",
    description: "Browse extra help your agency offers.",
    icon: Store,
    navigateTo: "/services",
  },
];

const JOBS_LINK = {
  title: "Job openings",
  description: "Career guidance and openings from your agency.",
  icon: Briefcase,
  navigateTo: "/career/1",
};

/** Slim quick-links strip for logged-in home — no “raise application” path. */
const HomeServices = () => {
  const navigate = useNavigate();
  const planAddons: string[] | null = (() => {
    try { return JSON.parse(getConfig("ADDONS") || "null"); } catch { return null; }
  })();
  const showJobs = !planAddons || planAddons.includes("jobs");
  const links = showJobs ? [...BASE_LINKS, JOBS_LINK] : BASE_LINKS;

  return (
    <section className="flex flex-col gap-3 max-w-2xl mx-auto w-full">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Quick links</h2>
        <p className="text-sm text-default-500">
          Support for your study abroad journey
        </p>
      </div>
      <div className="rounded-xl border border-default-200 bg-content1 divide-y divide-default-200">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.navigateTo}
              type="button"
              onClick={() => navigate(item.navigateTo)}
              className="flex w-full items-start gap-3 p-4 text-left hover:bg-default-50 transition-colors"
            >
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-default-500 mt-0.5">{item.description}</p>
              </div>
              <ArrowRight size={16} className="text-default-400 mt-1 shrink-0" />
            </button>
          );
        })}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between rounded-xl border border-default-200 bg-content1 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Need more support?</p>
          <p className="text-xs text-default-500">
            Reach your agency for profile assessment and documentation help.
          </p>
        </div>
        <Button
          color="primary"
          className="w-full sm:w-auto"
          onPress={() => navigate("/contact_us")}
        >
          Contact us
        </Button>
      </div>
    </section>
  );
};

/** Logged-in home: campaign hero (if any), progress, then quick links. */
const HomeWithProgress = () => (
  <div className="flex flex-col gap-4 w-full min-w-0">
    <AchievementBanner target_type="home" />
    <InstallAppCard />
    <ProgressTracker compact />
    <HomeServices />
  </div>
);

export default HomeWithProgress;
