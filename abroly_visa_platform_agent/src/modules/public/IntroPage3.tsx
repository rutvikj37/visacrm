import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import {
  Users,
  BarChart3,
  BookOpen,
  Briefcase,
  Globe2,
  CheckCircle2,
  Inbox,
  KanbanSquare,
  Shield,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { publicAsset } from "@/utils/appBase";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { openWhatsApp, WHATSAPP_MESSAGES } from "@/utils/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppFloat";

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: easeOut },
};

const staggerParent = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

const features = [
  {
    icon: Inbox,
    title: "Lead inbox that stays tidy",
    description:
      "Capture inquiries from your website, WhatsApp, and walk-ins in one place — assign, follow up, and convert without losing anyone in Excel.",
  },
  {
    icon: KanbanSquare,
    title: "Visa & case tracking",
    description:
      "Move every student through clear stages, keep documents together, and see what is pending before a deadline slips.",
  },
  {
    icon: BookOpen,
    title: "Language prep built in",
    description:
      "Run IELTS, PTE, or TOEFL batches alongside consultancy work — one login for your whole team.",
  },
  {
    icon: Briefcase,
    title: "Jobs & opportunities",
    description:
      "Post roles and keep career options visible to students without juggling another tool.",
  },
  {
    icon: Globe2,
    title: "Your brand, your portal",
    description:
      "Give students a branded portal on your domain while your team works in the agency panel.",
  },
  {
    icon: Smartphone,
    title: "Agency & student mobile apps",
    description:
      "Native Android and iOS apps for your counselors and students — manage cases on the go and keep applicants updated from their phones.",
  },
  {
    icon: BarChart3,
    title: "Clear day-to-day view",
    description:
      "See today’s follow-ups, pipeline health, and team workload so owners know what needs attention now.",
  },
];

const steps = [
  {
    n: "01",
    title: "Set up your agency",
    text: "Add your brand, branches, and team. Invite consultants with role-based access.",
  },
  {
    n: "02",
    title: "Bring leads in",
    text: "Connect website forms, WhatsApp, or add walk-ins. Everything lands in one inbox.",
  },
  {
    n: "03",
    title: "Run the full journey",
    text: "Track applications, visas, fees, and training — then report on what is working.",
  },
];

const ProductPreview = () => (
  <motion.div
    className="relative mx-auto w-full max-w-xl md:mx-0"
    initial={{ opacity: 0, y: 36, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.75, delay: 0.2, ease: easeOut }}
  >
    <motion.div
      aria-hidden
      className="absolute -inset-3 rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,rgba(15,91,216,0.18),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.14),transparent_50%)] sm:-inset-6"
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-28px_rgba(15,45,95,0.45)] backdrop-blur-sm"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <img src={publicAsset("techx-crm-icon.png")} alt="" className="h-7 w-7 rounded-lg" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Agency panel</p>
            <p className="text-xs text-slate-500">Today · pipeline · team</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 p-5">
        {[
          { label: "Open leads", value: "128", tone: "bg-sky-50 text-sky-800" },
          { label: "Follow-ups", value: "24", tone: "bg-amber-50 text-amber-800" },
          { label: "Visa pending", value: "17", tone: "bg-indigo-50 text-indigo-800" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className={`rounded-xl px-3 py-3 ${s.tone}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * 0.1, duration: 0.4, ease: easeOut }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <p className="text-[11px] font-medium opacity-80">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-2.5 px-5 pb-5">
        {[
          { name: "Ananya Shah", stage: "Documents", meta: "Canada · Study" },
          { name: "Rahul Mehta", stage: "Interview", meta: "UK · Study" },
          { name: "Priya Nair", stage: "Offer letter", meta: "Australia · Study" },
        ].map((row, i) => (
          <motion.div
            key={row.name}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.14, duration: 0.45, ease: easeOut }}
            whileHover={{ x: 4, backgroundColor: "rgba(248,250,252,1)" }}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f5bd8]/10 text-sm font-semibold text-[#0f5bd8]">
                {row.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                <p className="truncate text-xs text-slate-500">{row.meta}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
              {row.stage}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </motion.div>
);

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_55%,#f8fafc_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(15,91,216,0.14) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(180deg, black 0%, transparent 75%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,91,216,0.16),transparent_65%)] blur-2xl"
        animate={{ x: [0, 18, 0], y: [0, 12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:pb-20 md:pt-16 lg:gap-12 lg:pb-24 lg:pt-20">
        <motion.div
          className="space-y-6 md:space-y-7"
          variants={staggerParent}
          initial="hidden"
          animate="show"
        >
          <motion.p
            variants={staggerItem}
            className="landing-display text-sm font-semibold uppercase tracking-[0.16em] text-[#0f5bd8]"
          >
            TechX CRM
          </motion.p>

          <motion.h1
            variants={staggerItem}
            className="landing-display max-w-xl text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]"
          >
            The CRM built for visa & study-abroad agencies
          </motion.h1>

          <motion.p
            variants={staggerItem}
            className="max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg"
          >
            Run leads, student cases, language prep, and your branded portal from one calm workspace — so your team spends less time chasing updates and more time closing.
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"
          >
            <Button
              size="lg"
              className="w-full bg-[#25D366] px-7 font-semibold text-white sm:w-auto"
              startContent={<WhatsAppIcon className="h-5 w-5" />}
              onPress={() => openWhatsApp(WHATSAPP_MESSAGES.sales)}
            >
              Chat on WhatsApp
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="w-full border-slate-300 bg-white/70 px-7 font-semibold text-slate-800 sm:w-auto"
              onPress={() => navigate("/login")}
            >
              Login to panel
            </Button>
          </motion.div>

          <motion.div
            variants={staggerItem}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm text-slate-600"
          >
            <span className="inline-flex items-center gap-1.5">
              <Smartphone size={16} className="text-[#0f5bd8]" /> Agency & student apps · Android & iOS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield size={16} className="text-[#0f5bd8]" /> Role-based team access
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={16} className="text-[#0f5bd8]" /> Built for Indian consultancies
            </span>
          </motion.div>
        </motion.div>

        <ProductPreview />
      </div>
    </section>
  );
};

const FeaturesSection = () => (
  <section className="border-t border-slate-200/80 bg-white py-16 sm:py-20">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <motion.div {...fadeUp} className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0f5bd8]">
          What you get
        </p>
        <h2 className="landing-display mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Everything your consultancy needs — without the clutter
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          TechX CRM replaces scattered spreadsheets, chat threads, and folders with one workflow your whole office can follow.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="group space-y-3"
            >
              <motion.div
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f5bd8]/10 text-[#0f5bd8] transition-colors group-hover:bg-[#0f5bd8] group-hover:text-white"
                whileHover={{ rotate: [-2, 2, 0], scale: 1.06 }}
                transition={{ duration: 0.35 }}
              >
                <Icon size={22} />
              </motion.div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{feature.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

const HowItWorksSection = () => (
  <section className="border-t border-slate-200/80 bg-slate-50 py-16 sm:py-20">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <motion.div {...fadeUp} className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0f5bd8]">
          How it works
        </p>
        <h2 className="landing-display mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Up and running in three clear steps
        </h2>
      </motion.div>

      <div className="relative mt-12 grid gap-8 md:grid-cols-3">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-[#0f5bd8]/30 to-transparent md:block"
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: easeOut, delay: 0.2 }}
        />
        {steps.map((step, index) => (
          <motion.div
            key={step.n}
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: index * 0.1 }}
            whileHover={{ y: -3 }}
            className="relative"
          >
            <motion.p
              className="landing-display text-4xl font-semibold text-[#0f5bd8]/25"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + index * 0.1, duration: 0.45 }}
            >
              {step.n}
            </motion.p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

type PublicPlan = {
  id: string;
  name: string;
  description?: string | null;
  duration_months?: number | null;
  package_price?: number;
  price_monthly?: number;
  price_yearly?: number;
  max_team_members?: number | null;
  features?: { sources?: string[]; addons?: string[] };
};

type FeatureMeta = { key: string; label: string };

const FALLBACK_PLANS: PublicPlan[] = [
  {
    id: "6-months",
    name: "6 Months",
    description: "Full CRM access for growing consultancies — renew when you’re ready.",
    duration_months: 6,
    package_price: 0,
    max_team_members: null,
    features: { sources: ["website", "csv", "whatsapp", "facebook"], addons: ["language_prep", "jobs"] },
  },
  {
    id: "12-months",
    name: "12 Months",
    description: "Best value for established agencies that want a full year of uninterrupted access.",
    duration_months: 12,
    package_price: 0,
    max_team_members: null,
    features: {
      sources: ["website", "csv", "whatsapp", "facebook", "google", "indiamart"],
      addons: ["language_prep", "jobs", "event_banners", "side_banner"],
    },
  },
];

const CORE_INCLUDES = [
  "Lead inbox & follow-ups",
  "Visa / case tracking",
  "Team & branch access",
  "Branded student portal",
];

const MOBILE_APP_INCLUDES = [
  "Agency mobile app — Android & iOS",
  "Student mobile app — Android & iOS",
];

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const planPriceLabel = (plan: PublicPlan) => {
  const amount = Number(plan.package_price ?? 0);
  if (amount > 0) {
    const months = Number(plan.duration_months || 0);
    return {
      amount: rupees(amount),
      period: months === 12 ? "per year" : months === 6 ? "for 6 months" : months > 0 ? `for ${months} months` : "per plan",
    };
  }
  return { amount: "Custom", period: "talk to us for pricing" };
};

const PricingSection = () => {
  const { commonPublicGetApiCalls } = useApiCallUtils();
  const [plans, setPlans] = useState<PublicPlan[]>(FALLBACK_PLANS);
  const [featureLabels, setFeatureLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { success, data } = await commonPublicGetApiCalls("/public/saas/plans");
      if (cancelled) return;
      if (success && Array.isArray(data?.plans) && data.plans.length) {
        setPlans(data.plans);
      }
      const labels: Record<string, string> = {};
      for (const f of (data?.features?.sources || []) as FeatureMeta[]) labels[f.key] = f.label;
      for (const f of (data?.features?.addons || []) as FeatureMeta[]) labels[f.key] = f.label;
      if (Object.keys(labels).length) setFeatureLabels(labels);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featuredId =
    plans.find((p) => Number(p.duration_months) === 12)?.id ||
    plans[plans.length - 1]?.id;

  return (
    <section id="pricing" className="scroll-mt-20 border-t border-slate-200/80 bg-slate-50 py-14 sm:py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0f5bd8]">
            Pricing
          </p>
          <h2 className="landing-display mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Simple plans for visa agencies
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Every plan includes the web CRM plus agency and student mobile apps on Android and iOS — so your team and students can work from anywhere.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-2 text-sm font-medium text-slate-700 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone size={16} className="text-[#0f5bd8]" /> Agency app · Android & iOS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone size={16} className="text-[#0f5bd8]" /> Student app · Android & iOS
            </span>
          </div>
        </motion.div>

        <div
          className={`mt-10 grid gap-5 sm:mt-12 sm:gap-6 ${
            plans.length === 1
              ? "mx-auto max-w-md"
              : plans.length === 2
                ? "mx-auto max-w-4xl md:grid-cols-2"
                : "md:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {(loading ? FALLBACK_PLANS : plans).map((plan, index) => {
            const price = planPriceLabel(plan);
            const isFeatured = plan.id === featuredId;
            const sourceCount = plan.features?.sources?.length || 0;
            const addonCount = plan.features?.addons?.length || 0;
            const highlightExtras = [
              ...(plan.features?.addons || []).map((k) => featureLabels[k] || k),
            ].slice(0, 4);
            const blurb =
              Number(plan.duration_months) === 12
                ? "Best value — web CRM plus agency & student apps (Android & iOS) for a full year."
                : Number(plan.duration_months) === 6
                  ? "Web CRM plus agency & student apps (Android & iOS) for half a year."
                  : plan.description || "Full CRM access with agency & student mobile apps.";

            return (
              <motion.div
                key={plan.id}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.06 }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 sm:p-7 ${
                  isFeatured
                    ? "border-[#0f5bd8] shadow-[0_24px_50px_-28px_rgba(15,91,216,0.55)]"
                    : "border-slate-200 shadow-[0_16px_40px_-32px_rgba(15,45,95,0.35)]"
                }`}
              >
                {isFeatured ? (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-md bg-[#0f5bd8] px-2.5 py-1 text-xs font-semibold text-white">
                    <Sparkles size={12} /> Most popular
                  </span>
                ) : null}

                <div className="space-y-1">
                  <h3 className="landing-display text-xl font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{blurb}</p>
                </div>

                <div className="mt-6">
                  <p className="landing-display text-3xl font-semibold tracking-tight text-slate-900">
                    {price.amount}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{price.period}</p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {MOBILE_APP_INCLUDES.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm font-medium text-slate-800">
                      <Smartphone size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {CORE_INCLUDES.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {plan.max_team_members == null ? (
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>Unlimited team members</span>
                    </li>
                  ) : (
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>Up to {plan.max_team_members} team members</span>
                    </li>
                  )}
                  {sourceCount > 0 ? (
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>
                        {sourceCount === 1
                          ? "1 lead source (website, WhatsApp, ads & more)"
                          : `${sourceCount} lead sources (website, WhatsApp, ads & more)`}
                      </span>
                    </li>
                  ) : null}
                  {highlightExtras.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {addonCount > highlightExtras.length ? (
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5bd8]" />
                      <span>+{addonCount - highlightExtras.length} more add-on{addonCount - highlightExtras.length === 1 ? "" : "s"}</span>
                    </li>
                  ) : null}
                </ul>

                <Button
                  size="lg"
                  className={`mt-8 w-full font-semibold text-white ${
                    isFeatured ? "bg-[#25D366]" : "bg-[#128C7E]"
                  }`}
                  startContent={<WhatsAppIcon className="h-5 w-5" />}
                  onPress={() =>
                    openWhatsApp(
                      Number(plan.duration_months) === 12
                        ? WHATSAPP_MESSAGES.pricing12
                        : Number(plan.duration_months) === 6
                          ? WHATSAPP_MESSAGES.pricing6
                          : WHATSAPP_MESSAGES.pricing
                    )
                  }
                >
                  Talk to sales on WhatsApp
                </Button>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          {...fadeUp}
          className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500"
        >
          Need a custom setup for multiple branches?{" "}
          <button
            type="button"
            className="font-medium text-[#25D366] hover:underline"
            onClick={() => openWhatsApp(WHATSAPP_MESSAGES.pricing)}
          >
            WhatsApp us
          </button>{" "}
          and we’ll tailor a plan.
        </motion.p>
      </div>
    </section>
  );
};

const outcomes = [
  {
    before: "Leads buried in WhatsApp & Excel",
    after: "One inbox your whole team can work from",
    icon: Inbox,
  },
  {
    before: "“Where is this student’s file?”",
    after: "Cases, docs & stages in one clear timeline",
    icon: KanbanSquare,
  },
  {
    before: "Owners chasing updates all day",
    after: "A calm daily view of what needs attention",
    icon: BarChart3,
  },
];

const AudienceSection = () => (
  <section className="relative overflow-hidden border-t border-slate-200/80 py-14 sm:py-16 md:py-20">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#eef5ff_0%,#ffffff_42%,#f8fafc_100%)]"
    />
    <div
      aria-hidden
      className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,91,216,0.14),transparent_70%)] blur-2xl"
    />
    <div
      aria-hidden
      className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(37,211,102,0.12),transparent_70%)] blur-2xl"
    />

    <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0f5bd8]">
          Life with TechX CRM
        </p>
        <h2 className="landing-display mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Less chasing. More closing.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Replace scattered chats and spreadsheets with one shared workspace — so every counselor knows the next step, and every student stays on track.
        </p>
      </motion.div>

      <div className="mx-auto mt-10 max-w-3xl space-y-4 sm:mt-12 sm:space-y-5">
        {outcomes.map((row, index) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.after}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: easeOut }}
              whileHover={{ scale: 1.01 }}
              className="grid items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur-sm sm:grid-cols-[1fr_auto_1.15fr] sm:gap-4 sm:px-5 sm:py-5"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Before</p>
                  <p className="mt-0.5 text-sm text-slate-500 line-through decoration-slate-300">{row.before}</p>
                </div>
              </div>

              <div className="hidden justify-center sm:flex" aria-hidden>
                <motion.span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0f5bd8]/10 text-[#0f5bd8]"
                  animate={{ rotate: [0, 12, -8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
                >
                  <Sparkles size={14} />
                </motion.span>
              </div>

              <motion.div
                className="rounded-xl bg-[#0f5bd8]/5 px-3 py-2.5 sm:px-4"
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.45 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0f5bd8]">With TechX CRM</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{row.after}</p>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      <motion.div {...fadeUp} className="mt-10 flex flex-col items-center gap-3 text-center sm:mt-12">
        <p className="max-w-md text-sm text-slate-600">
          Want to see this with your own agency workflow?
        </p>
        <Button
          size="lg"
          className="w-full bg-[#25D366] font-semibold text-white sm:w-auto sm:px-8"
          startContent={<WhatsAppIcon className="h-5 w-5" />}
          onPress={() => openWhatsApp(WHATSAPP_MESSAGES.walkthrough)}
        >
          Get a free walkthrough on WhatsApp
        </Button>
      </motion.div>
    </div>
  </section>
);

const CTAFinal = () => {
  const navigate = useNavigate();

  return (
    <section id="cta" className="border-t border-slate-200/80 bg-[linear-gradient(180deg,#f4f8ff_0%,#eef4ff_100%)] py-16 sm:py-20">
      <motion.div {...fadeUp} className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="landing-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Ready to simplify how your agency runs?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Start a conversation with TechX Solutions, or log in if you already have an agency panel.
        </p>
        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            size="lg"
            className="bg-[#25D366] px-8 font-semibold text-white"
            startContent={<WhatsAppIcon className="h-5 w-5" />}
            onPress={() => openWhatsApp(WHATSAPP_MESSAGES.sales)}
          >
            WhatsApp sales
          </Button>
          <Button
            size="lg"
            variant="bordered"
            className="border-slate-300 bg-white px-8 font-semibold text-slate-800"
            onPress={() => navigate("/login")}
          >
            Agency login
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Questions?{" "}
          <button
            type="button"
            className="font-medium text-[#25D366] hover:underline"
            onClick={() => openWhatsApp(WHATSAPP_MESSAGES.contact)}
          >
            WhatsApp
          </button>{" "}
          ·{" "}
          <a className="font-medium text-[#0f5bd8] hover:underline" href="mailto:contact@techxsolutions.in">
            contact@techxsolutions.in
          </a>{" "}
          ·{" "}
          <a className="font-medium text-[#0f5bd8] hover:underline" href="tel:+919227048595">
            +91 92270 48595
          </a>
        </p>
      </motion.div>
    </section>
  );
};

const IntroPage3 = () => {
  useEffect(() => {
    if (window.location.hash === "#pricing") {
      requestAnimationFrame(() => {
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="landing-page light bg-white text-slate-900" style={{ colorScheme: "light" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap');
        .landing-page .landing-display {
          font-family: "Outfit", "Quicksand", system-ui, sans-serif;
        }
        .landing-page h1,
        .landing-page h2,
        .landing-page h3 {
          color: #0f172a;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-page *,
          .landing-page *::before,
          .landing-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <AudienceSection />
      <CTAFinal />
    </main>
  );
};

export default IntroPage3;
