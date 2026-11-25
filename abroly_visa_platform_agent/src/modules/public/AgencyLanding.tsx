import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import {
  CalendarCheck,
  FileCheck2,
  Globe2,
  LogIn,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Mail,
  ShieldCheck,
  Users,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAgencyBrand } from "@/utils/agencyHost";

/**
 * Landing at https://<agency address>/agency/ - the agency's own front door for its team,
 * in the agency's name, logo and colour (the TechX CRM sales page only shows on the shared host).
 */
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

const TRAVEL_DESTINATIONS = ["USA", "Canada", "UK", "Schengen", "Dubai", "Australia", "Singapore", "Thailand"];
const STUDY_DESTINATIONS = ["Canada", "UK", "Australia", "USA", "Germany", "Ireland", "New Zealand", "France"];

const AgencyLanding = () => {
  const navigate = useNavigate();
  const { host, brand } = useAgencyBrand();
  const color = brand?.color || "#0f5bd8";
  const name = brand?.name || "";
  const travel = brand?.focus !== "study";
  const portalUrl = host ? `${window.location.protocol}//${window.location.host}/` : "/";
  const phoneDigits = (brand?.phone || "").replace(/\D/g, "");
  const destinations = travel ? TRAVEL_DESTINATIONS : STUDY_DESTINATIONS;
  // agencies with the "Client portal" module off have no portal at /, so no link to it
  const showPortal = brand?.portal === true;

  const tools = travel
    ? [
        { icon: FileCheck2, title: "Visa files", desc: "DS-160, document checklist, application form and payment status for every client." },
        { icon: CalendarCheck, title: "Appointments", desc: "Biometrics, interview dates, interview training and passport collection in one timeline." },
        { icon: MessageCircle, title: "Follow-ups", desc: "Next follow-up dates, reminders and WhatsApp chats so no client is left waiting." },
        { icon: Users, title: "Team & branches", desc: "Assign files to staff, see who is working on what across every office." },
      ]
    : [
        { icon: FileCheck2, title: "Student cases", desc: "Applications, offers, documents and visa stages for every student." },
        { icon: CalendarCheck, title: "Intakes & deadlines", desc: "University deadlines, biometrics and interview dates on one calendar." },
        { icon: MessageCircle, title: "Follow-ups", desc: "Reminders and WhatsApp chats so no student is left waiting." },
        { icon: Users, title: "Team & branches", desc: "Assign students to counsellors across every office." },
      ];

  return (
    <main className="agency-landing light min-h-screen bg-white text-slate-900" style={{ colorScheme: "light", ["--brand" as any]: color }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap');
        .agency-landing .display { font-family: "Outfit", system-ui, sans-serif; }
        .agency-landing .brand-text { color: var(--brand); }
        .agency-landing .brand-bg { background: var(--brand); }
        .agency-landing .brand-soft { background: color-mix(in srgb, var(--brand) 9%, white); }
        .agency-landing .brand-border { border-color: color-mix(in srgb, var(--brand) 22%, white); }
        @keyframes al-fly { 0% { offset-distance: 0%; } 100% { offset-distance: 100%; } }
        .agency-landing .al-plane { offset-path: path("M 10 230 C 160 60, 360 40, 560 120"); animation: al-fly 9s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) { .agency-landing .al-plane { animation: none; } }
      `}</style>

      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {brand?.logo ? (
              <img src={brand.logo} alt={name} className="h-10 w-auto max-w-[160px] object-contain" />
            ) : (
              <div className="brand-bg flex h-9 w-9 items-center justify-center rounded-lg text-white"><Plane size={18} /></div>
            )}
            {!brand?.logo && <span className="display truncate text-lg font-semibold">{name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {showPortal && (
              <Button as="a" href={portalUrl} variant="light" className="hidden font-medium text-slate-600 sm:flex">
                Client portal
              </Button>
            )}
            <Button onPress={() => navigate("/login")} className="brand-bg font-medium text-white" startContent={<LogIn size={17} />}>
              Staff login
            </Button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="brand-soft absolute inset-0" />
        <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl brand-bg" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
            <span className="brand-border inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] brand-text">
              <ShieldCheck size={14} /> Team workspace
            </span>
            <h1 className="display mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              {travel ? "Every visa file and trip," : "Every student and case,"}{" "}
              <span className="brand-text">{name ? `handled by ${name}` : "in one place"}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {travel
                ? "Clients, visa applications, appointments, documents and follow-ups for the whole team - from enquiry to passport collection."
                : "Leads, applications, documents and follow-ups for the whole team - from enquiry to visa."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onPress={() => navigate("/login")} className="brand-bg font-semibold text-white shadow-lg" startContent={<LogIn size={18} />}>
                Login to the panel
              </Button>
              {showPortal && (
                <Button size="lg" as="a" href={portalUrl} variant="bordered" className="brand-border bg-white font-semibold text-slate-800" endContent={<ExternalLink size={16} />}>
                  Client portal
                </Button>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {destinations.map((d) => (
                <span key={d} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{d}</span>
              ))}
            </div>
          </motion.div>

          {/* travel illustration */}
          <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative hidden md:block">
            <div className="relative mx-auto aspect-[6/5] w-full max-w-md rounded-3xl border border-white bg-white/70 p-6 shadow-xl backdrop-blur">
              <svg viewBox="0 0 580 300" className="absolute inset-0 h-full w-full" aria-hidden>
                <circle cx="290" cy="170" r="120" fill="none" stroke={color} strokeOpacity="0.14" strokeWidth="2" />
                <ellipse cx="290" cy="170" rx="120" ry="44" fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="2" />
                <ellipse cx="290" cy="170" rx="50" ry="120" fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="2" />
                <path d="M 10 230 C 160 60, 360 40, 560 120" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="2" strokeDasharray="6 8" />
              </svg>
              <div className="al-plane absolute left-0 top-0" style={{ color }}>
                <Plane size={26} fill="currentColor" style={{ transform: "rotate(45deg)" }} />
              </div>
              <div className="relative flex h-full flex-col justify-end gap-3">
                {(travel
                  ? [["USA · Visitor", "Interview done", "Approved"], ["Schengen · Tourist", "Biometrics booked", "In process"], ["Dubai · Tourist", "Documents received", "Submitted"]]
                  : [["Canada · Study", "Offer letter", "In process"], ["UK · Study", "CAS issued", "Approved"], ["Australia · Study", "Documents", "Submitted"]]
                ).map(([a, b, c]) => (
                  <div key={a} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{a}</p>
                      <p className="text-xs text-slate-500">{b}</p>
                    </div>
                    <span className="brand-soft brand-text rounded-full px-2.5 py-1 text-[11px] font-semibold">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* tools */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] brand-text">Inside the panel</p>
          <h2 className="display mt-2 text-3xl font-semibold tracking-tight text-slate-900">Everything the team needs for each file</h2>
        </motion.div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map(({ icon: Icon, title, desc }) => (
            <motion.div key={title} {...fadeUp} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="brand-soft brand-text flex h-11 w-11 items-center justify-center rounded-xl"><Icon size={22} /></div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* contact */}
      {(brand?.address || brand?.phone || brand?.email || brand?.website) && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.2fr] md:py-16">
            <motion.div {...fadeUp}>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] brand-text">Visit us</p>
              <h2 className="display mt-2 text-3xl font-semibold tracking-tight text-slate-900">{name}</h2>
              {brand?.tagline && <p className="mt-3 text-slate-600">{brand.tagline}</p>}
            </motion.div>
            <motion.div {...fadeUp} className="grid gap-3 sm:grid-cols-2">
              {brand?.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(brand.address)}`}
                  target="_blank" rel="noreferrer"
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm sm:col-span-2"
                >
                  <MapPin className="mt-0.5 shrink-0 brand-text" size={20} />
                  <span className="text-sm leading-relaxed text-slate-700">{brand.address}</span>
                </a>
              )}
              {brand?.phone && (
                <a href={`tel:+${phoneDigits}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm">
                  <Phone className="shrink-0 brand-text" size={20} />
                  <span className="text-sm font-medium text-slate-800">{brand.phone}</span>
                </a>
              )}
              {brand?.website ? (
                <a href={brand.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm">
                  <Globe2 className="shrink-0 brand-text" size={20} />
                  <span className="truncate text-sm font-medium text-slate-800">{brand.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              ) : brand?.email ? (
                <a href={`mailto:${brand.email}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm">
                  <Mail className="shrink-0 brand-text" size={20} />
                  <span className="truncate text-sm font-medium text-slate-800">{brand.email}</span>
                </a>
              ) : null}
            </motion.div>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} {name}</span>
          <span>Powered by TechX CRM</span>
        </div>
      </footer>
    </main>
  );
};

export default AgencyLanding;
