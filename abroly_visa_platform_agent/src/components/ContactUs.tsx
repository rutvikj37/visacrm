import { Button, Input, Textarea } from "@heroui/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { openWhatsApp, WHATSAPP_DISPLAY, WHATSAPP_MESSAGES, whatsappUrl } from "@/utils/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppFloat";

const SUPPORT_EMAIL = "contact@techxsolutions.in";
const SUPPORT_PHONE = WHATSAPP_DISPLAY;
const SUPPORT_PHONE_TEL = "+919227048595";

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="block space-y-1.5">
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </span>
    {children}
  </label>
);

const ContactUs = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    number: "",
    agency: "",
    message: "",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.name.trim()) return ErrorToast("Please enter your name");
    if (!form.email.trim()) return ErrorToast("Please enter your email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return ErrorToast("Please enter a valid email");
    }
    if (!form.number.trim()) return ErrorToast("Please enter your phone number");
    if (!form.message.trim()) return ErrorToast("Please enter a short message");

    setIsSubmitting(true);

    const subject = encodeURIComponent(
      `TechX CRM enquiry${form.agency.trim() ? ` — ${form.agency.trim()}` : ""}`
    );
    const body = encodeURIComponent(
      [
        `Name: ${form.name.trim()}`,
        `Email: ${form.email.trim()}`,
        `Phone: ${form.number.trim()}`,
        form.agency.trim() ? `Agency: ${form.agency.trim()}` : null,
        "",
        form.message.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );

    // Company landing has no agency context, so open the user's mail app to TechX Solutions.
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    setTimeout(() => {
      setIsSubmitting(false);
      setSent(true);
      SuccessToast("Opening your email app…");
      setForm({ name: "", email: "", number: "", agency: "", message: "" });
    }, 400);
  };

  return (
    <main className="contact-page light bg-white text-slate-900" style={{ colorScheme: "light" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap');
        .contact-page .contact-display {
          font-family: "Outfit", "Quicksand", system-ui, sans-serif;
        }
      `}</style>

      <section className="relative overflow-hidden border-b border-slate-200/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15,91,216,0.14) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(180deg, black 0%, transparent 80%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-12">
          <motion.div {...fade} className="max-w-2xl">
            <p className="contact-display text-sm font-semibold uppercase tracking-[0.16em] text-[#0f5bd8]">
              Contact · TechX Solutions
            </p>
            <h1 className="contact-display mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
              Let’s talk about your agency
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              TechX CRM is a product of TechX Solutions. Tell us how you run leads and cases today — we’ll reply within one business day with next steps or a short walkthrough.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-2 sm:gap-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:pb-16">
        <motion.aside
          {...fade}
          transition={{ ...fade.transition, delay: 0.05 }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <a
              href={whatsappUrl(WHATSAPP_MESSAGES.contact)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 p-4 transition hover:border-[#25D366]/50 hover:bg-[#25D366]/10"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
                <WhatsAppIcon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">WhatsApp</span>
                <span className="mt-0.5 block text-sm text-slate-600">{SUPPORT_PHONE} · usually replies fastest</span>
              </span>
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-[#0f5bd8]/30 hover:bg-[#0f5bd8]/5"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f5bd8]/10 text-[#0f5bd8]">
                <Mail size={20} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Email</span>
                <span className="mt-0.5 block text-sm text-slate-600">{SUPPORT_EMAIL}</span>
              </span>
            </a>

            <a
              href={`tel:${SUPPORT_PHONE_TEL}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-[#0f5bd8]/30 hover:bg-[#0f5bd8]/5"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f5bd8]/10 text-[#0f5bd8]">
                <Phone size={20} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Phone</span>
                <span className="mt-0.5 block text-sm text-slate-600">{SUPPORT_PHONE}</span>
              </span>
            </a>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f5bd8]/10 text-[#0f5bd8]">
                <Clock size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Office hours</p>
                <p className="mt-0.5 text-sm text-slate-600">Mon–Fri, 10:30 AM – 7:30 PM IST</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f5bd8]/10 text-[#0f5bd8]">
                <MapPin size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Office</p>
                <p className="mt-0.5 text-sm text-slate-600">Ahmedabad, Gujarat, India</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[linear-gradient(145deg,#0f5bd8_0%,#0b47a8_100%)] p-5 text-white">
            <p className="contact-display text-lg font-semibold">What to expect</p>
            <ul className="mt-3 space-y-2.5 text-sm text-white/90">
              {[
                "Reply within 1 business day",
                "Walkthrough tailored to visa / study-abroad workflows",
                "No pressure — ask anything about setup and branding",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="mt-5 w-full bg-[#25D366] font-semibold text-white"
              startContent={<WhatsAppIcon className="h-5 w-5" />}
              onPress={() => openWhatsApp(WHATSAPP_MESSAGES.contact)}
            >
              Chat on WhatsApp
            </Button>
          </div>
        </motion.aside>

        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-36px_rgba(15,45,95,0.45)] sm:p-7"
        >
          {sent ? (
            <div className="flex min-h-[22rem] flex-col items-start justify-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={26} />
              </span>
              <h2 className="contact-display text-2xl font-semibold text-slate-900">
                Almost there
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-slate-600">
                Your email app should open with the message ready for{" "}
                <span className="font-medium text-slate-800">{SUPPORT_EMAIL}</span>. If it didn’t, email us directly or call {SUPPORT_PHONE}.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button
                  className="bg-[#0f5bd8] font-semibold text-white"
                  onPress={() => setSent(false)}
                >
                  Send another message
                </Button>
                <Button
                  variant="bordered"
                  className="border-slate-300 font-semibold text-slate-800"
                  onPress={() => {
                    window.location.href = `mailto:${SUPPORT_EMAIL}`;
                  }}
                >
                  Open email again
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="contact-display text-xl font-semibold text-slate-900 sm:text-2xl">
                Send a message
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Share a few details and we’ll get back to you soon.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <Field label="Your name">
                  <Input
                    aria-label="Your name"
                    placeholder="Full name"
                    variant="bordered"
                    radius="lg"
                    value={form.name}
                    onValueChange={update("name")}
                    isRequired
                    classNames={{ inputWrapper: "bg-white" }}
                  />
                </Field>
                <Field label="Work email">
                  <Input
                    aria-label="Work email"
                    placeholder="you@agency.com"
                    type="email"
                    variant="bordered"
                    radius="lg"
                    value={form.email}
                    onValueChange={update("email")}
                    isRequired
                    classNames={{ inputWrapper: "bg-white" }}
                  />
                </Field>
                <Field label="Phone number">
                  <Input
                    aria-label="Phone number"
                    placeholder="10-digit mobile"
                    variant="bordered"
                    radius="lg"
                    value={form.number}
                    onValueChange={(v) => update("number")(toPhoneDigits(v))}
                    {...phoneInputProps}
                    isRequired
                    classNames={{ inputWrapper: "bg-white" }}
                  />
                </Field>
                <Field label="Agency name" hint="Optional">
                  <Input
                    aria-label="Agency name"
                    placeholder="Your consultancy name"
                    variant="bordered"
                    radius="lg"
                    value={form.agency}
                    onValueChange={update("agency")}
                    classNames={{ inputWrapper: "bg-white" }}
                  />
                </Field>
                <Field label="How can we help?">
                  <Textarea
                    aria-label="How can we help?"
                    placeholder="Team size, current tools, or what you want to improve…"
                    variant="bordered"
                    radius="lg"
                    minRows={4}
                    value={form.message}
                    onValueChange={update("message")}
                    isRequired
                    classNames={{ inputWrapper: "bg-white" }}
                  />
                </Field>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-[#0f5bd8] font-semibold text-white sm:w-auto sm:px-8"
                  endContent={<ArrowRight size={18} />}
                  isLoading={isSubmitting}
                >
                  Send message
                </Button>
              </form>
            </>
          )}
        </motion.div>
      </section>
    </main>
  );
};

export default ContactUs;
