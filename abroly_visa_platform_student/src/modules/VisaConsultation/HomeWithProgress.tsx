import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import { Button } from "@nextui-org/react";
import ProgressTracker from "./ProgressTracker";
import InstallAppCard from "@/components/InstallAppCard";
import AchievementBanner from "@/modules/AchievementBanner/AchievementBanner";

const SERVICES = [
  {
    title: "Visa & Course Consultation",
    description: "Expert visa support and personalised course selection.",
    icon: MapPin,
    navigateTo: "/services/visa_consultation",
  },
  {
    title: "Job Placement Support",
    description: "Career guidance and exclusive job opportunities.",
    icon: Briefcase,
    navigateTo: "/career/1",
  },
];

/** Slim services/links strip for logged-in home — replaces heavy PrivateIntroPage embed. */
const HomeServices = () => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Services</h2>
        <p className="text-sm text-default-500">
          Quick links to support your study abroad journey
        </p>
      </div>
      <div className="rounded-xl border border-default-200 bg-content1 divide-y divide-default-200">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.navigateTo}
              type="button"
              onClick={() => navigate(service.navigateTo)}
              className="flex w-full items-start gap-3 p-4 text-left hover:bg-default-50 transition-colors"
            >
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{service.title}</p>
                <p className="text-xs text-default-500 mt-0.5">{service.description}</p>
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
            Profile assessment, university selection, and visa documentation help.
          </p>
        </div>
        <Button
          color="primary"
          className="w-full sm:w-auto"
          onPress={() => navigate("/contact")}
        >
          Contact Us
        </Button>
      </div>
    </section>
  );
};

/** Logged-in home: live campaign hero (if any), then progress + service links. */
const HomeWithProgress = () => (
  <div className="flex flex-col gap-4">
    <AchievementBanner target_type="home" />
    <InstallAppCard />
    <ProgressTracker compact />
    <HomeServices />
  </div>
);

export default HomeWithProgress;
