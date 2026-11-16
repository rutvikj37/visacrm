import { Button } from "@heroui/react";
import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { openWhatsApp, WHATSAPP_DISPLAY, WHATSAPP_MESSAGES } from "@/utils/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppFloat";

const COMPANY = {
  product: "TechX CRM",
  company: "TechX Solutions",
  website: "https://techxsolutions.in/",
  email: "contact@techxsolutions.in",
  phone: WHATSAPP_DISPLAY,
  address: "Ahmedabad, Gujarat, India",
};

type PageKey = "about" | "terms" | "privacy" | "refund";

const META: Record<PageKey, { title: string; eyebrow: string }> = {
  about: { title: "About Us", eyebrow: "Company" },
  terms: { title: "Terms & Conditions", eyebrow: "Legal" },
  privacy: { title: "Privacy Policy", eyebrow: "Legal" },
  refund: { title: "Return & Refund Policy", eyebrow: "Legal" },
};

const Shell = ({
  page,
  children,
}: {
  page: PageKey;
  children: ReactNode;
}) => {
  const meta = META[page];
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  return (
    <main className="company-page light bg-white text-slate-900" style={{ colorScheme: "light" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&display=swap');
        .company-page .company-display {
          font-family: "Outfit", "Quicksand", system-ui, sans-serif;
        }
      `}</style>

      <section className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_75%)]">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="company-display text-sm font-semibold uppercase tracking-[0.16em] text-[#0f5bd8]">
            {meta.eyebrow}
          </p>
          <h1 className="company-display mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            <span className="font-semibold text-slate-800">{COMPANY.product}</span> is a product of{" "}
            <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0f5bd8] hover:underline">
              {COMPANY.company}
            </a>
            , built for visa and study-abroad agencies.
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-sm leading-relaxed text-slate-700 sm:px-6 sm:py-12 sm:text-[15px]">
        {children}
      </article>

      <section className="border-t border-slate-200/80 bg-slate-50">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">Need help with {COMPANY.product}?</p>
            <p className="mt-1 text-sm text-slate-600">
              WhatsApp {COMPANY.phone} · {COMPANY.email}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="bg-[#25D366] font-semibold text-white"
              startContent={<WhatsAppIcon className="h-5 w-5" />}
              onPress={() => openWhatsApp(WHATSAPP_MESSAGES.contact)}
            >
              WhatsApp us
            </Button>
            <Button
              variant="bordered"
              className="border-slate-300 font-semibold text-slate-800"
              onPress={() => navigate("/contact_us")}
            >
              Contact page
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

const H = ({ children }: { children: ReactNode }) => (
  <h2 className="company-display text-lg font-semibold text-slate-900 sm:text-xl">{children}</h2>
);

const P = ({ children }: { children: ReactNode }) => <p>{children}</p>;

const Ul = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

export const AboutPage = () => (
  <Shell page="about">
    <P>
      {COMPANY.company} is an IT and software company based in {COMPANY.address}. We build business platforms,
      automation, and digital products that help Indian MSMEs and service businesses operate more efficiently.
    </P>
    <P>
      <strong>{COMPANY.product}</strong> is our CRM platform for visa consultancy and study-abroad agencies. It brings
      leads, student cases, documents, language prep, team workflows, a branded student portal, and agency & student
      mobile apps (Android & iOS) into one system — so agencies can stop running on WhatsApp chats and spreadsheets.
    </P>
    <H>What we stand for</H>
    <Ul
      items={[
        "Practical software built around how visa agencies actually work",
        "Clear ownership of leads, cases, and follow-ups across the team",
        "White-label portals so agencies can serve students under their own brand",
        "Honest support from the team that builds and maintains the product",
      ]}
    />
    <H>Who builds TechX CRM</H>
    <P>
      {COMPANY.product} is designed, developed, and maintained by {COMPANY.company}. When you subscribe to{" "}
      {COMPANY.product}, you are buying a product from {COMPANY.company} — not a third-party reseller.
    </P>
    <H>Get in touch</H>
    <P>
      Website:{" "}
      <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="text-[#0f5bd8] hover:underline">
        techxsolutions.in
      </a>
      <br />
      Email:{" "}
      <a href={`mailto:${COMPANY.email}`} className="text-[#0f5bd8] hover:underline">
        {COMPANY.email}
      </a>
      <br />
      Phone / WhatsApp: {COMPANY.phone}
      <br />
      Office: {COMPANY.address}
    </P>
    <P>
      Prefer a form? Visit our{" "}
      <Link to="/contact_us" className="font-medium text-[#0f5bd8] hover:underline">
        Contact Us
      </Link>{" "}
      page.
    </P>
  </Shell>
);

export const TermsPage = () => (
  <Shell page="terms">
    <P>
      These Terms & Conditions (“Terms”) apply to your use of <strong>{COMPANY.product}</strong>, a software product of{" "}
      <strong>{COMPANY.company}</strong> (“we”, “us”, “our”). By creating an account, logging in, or paying for a plan,
      you agree to these Terms.
    </P>
    <H>1. The product</H>
    <P>
      {COMPANY.product} provides cloud CRM tools for visa / study-abroad agencies, including lead management, case
      tracking, team access, student portal, optional modules, and related mobile apps where included in your plan.
      Features may vary by subscription plan.
    </P>
    <H>2. Accounts & access</H>
    <Ul
      items={[
        "You must provide accurate agency and user details when registering or being invited.",
        "You are responsible for keeping login codes, OTPs, and account access secure.",
        "Agency owners are responsible for their team members’ use of the panel.",
        "We may suspend access for unpaid invoices, abuse, or security risk.",
      ]}
    />
    <H>3. Subscriptions & payments</H>
    <P>
      Paid plans are billed as per the pricing shown at purchase or agreed with our sales team. Prices may include
      applicable taxes (such as GST in India) as stated at checkout or on the invoice. Renewals and upgrades follow the
      plan duration you select (for example 6 or 12 months) unless otherwise agreed in writing.
    </P>
    <H>4. Acceptable use</H>
    <P>You agree not to misuse {COMPANY.product}, including by:</P>
    <Ul
      items={[
        "Uploading unlawful, harmful, or infringing content",
        "Attempting to breach security, scrape, or overload the service",
        "Using the platform for spam or activities unrelated to legitimate consultancy operations",
        "Sharing access in a way that violates your plan limits or these Terms",
      ]}
    />
    <H>5. Your data</H>
    <P>
      You retain ownership of the student, lead, and agency data you enter into {COMPANY.product}. You grant us
      permission to host and process that data solely to provide and improve the service, as described in our{" "}
      <Link to="/privacy" className="text-[#0f5bd8] hover:underline">
        Privacy Policy
      </Link>
      .
    </P>
    <H>6. Service availability</H>
    <P>
      We aim for reliable uptime but do not guarantee uninterrupted access. Planned maintenance or issues beyond our
      reasonable control may temporarily affect the service. We will work to restore access promptly.
    </P>
    <H>7. Intellectual property</H>
    <P>
      {COMPANY.product}, its software, branding, and documentation are owned by {COMPANY.company}. Your subscription
      grants a limited, non-exclusive, non-transferable right to use the product for your agency during the paid or
      trial period — not ownership of the software.
    </P>
    <H>8. Limitation of liability</H>
    <P>
      To the fullest extent permitted by law, {COMPANY.company} is not liable for indirect, incidental, or consequential
      losses (including lost leads, lost profits, or data loss caused by factors outside our control). Our total
      liability for a claim relating to the service is limited to the fees you paid us for {COMPANY.product} in the
      three (3) months before the claim.
    </P>
    <H>9. Changes</H>
    <P>
      We may update these Terms as the product evolves. Continued use after changes are posted means you accept the
      updated Terms. Material changes may also be communicated by email or in-panel notice.
    </P>
    <H>10. Contact</H>
    <P>
      Questions about these Terms:{" "}
      <a href={`mailto:${COMPANY.email}`} className="text-[#0f5bd8] hover:underline">
        {COMPANY.email}
      </a>{" "}
      · WhatsApp {COMPANY.phone} · {COMPANY.address}
    </P>
    <P className="text-xs text-slate-500">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</P>
  </Shell>
);

export const PrivacyPage = () => (
  <Shell page="privacy">
    <P>
      This Privacy Policy explains how <strong>{COMPANY.company}</strong> collects and uses information when you use{" "}
      <strong>{COMPANY.product}</strong>. {COMPANY.product} is a TechX Solutions product.
    </P>
    <H>1. Information we collect</H>
    <Ul
      items={[
        "Account details: name, mobile number, email, agency name, and login-related data",
        "Business data you enter: leads, students, documents, notes, payments you record, and similar CRM content",
        "Usage & technical data: device/browser type, IP address, logs needed for security and performance",
        "Billing details needed for invoices and payment processing (for example via Razorpay where enabled)",
      ]}
    />
    <H>2. How we use information</H>
    <Ul
      items={[
        "To provide, secure, and improve TechX CRM",
        "To authenticate users and send login codes / important service notices",
        "To process subscriptions and support requests",
        "To prevent fraud, abuse, and unauthorized access",
      ]}
    />
    <H>3. Agency responsibility</H>
    <P>
      Agencies using {COMPANY.product} may store personal data of students and leads. The agency is responsible for
      collecting that data lawfully and using it only for legitimate consultancy purposes. {COMPANY.company} processes
      that data as a service provider to host and operate the CRM.
    </P>
    <H>4. Sharing</H>
    <P>
      We do not sell your personal data. We may share limited information with trusted processors (such as hosting,
      email, SMS, or payment providers) only as needed to run the product, or when required by law.
    </P>
    <H>5. Data retention & security</H>
    <P>
      We retain account and CRM data while your agency uses the service and for a reasonable period afterward for
      backups, dispute resolution, and legal compliance. We use industry-standard safeguards; no method of transmission
      or storage is 100% secure.
    </P>
    <H>6. Your choices</H>
    <P>
      Agency owners may update profile and branding settings in the panel. For account deletion, data export, or privacy
      questions, contact{" "}
      <a href={`mailto:${COMPANY.email}`} className="text-[#0f5bd8] hover:underline">
        {COMPANY.email}
      </a>{" "}
      or WhatsApp {COMPANY.phone}.
    </P>
    <H>7. Updates</H>
    <P>
      We may update this Policy from time to time. The latest version will be available on this page.
    </P>
    <P className="text-xs text-slate-500">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</P>
  </Shell>
);

export const RefundPage = () => (
  <Shell page="refund">
    <P>
      This Return & Refund Policy applies to paid subscriptions for <strong>{COMPANY.product}</strong>, a product of{" "}
      <strong>{COMPANY.company}</strong>.
    </P>
    <H>1. Nature of the service</H>
    <P>
      {COMPANY.product} is a digital software-as-a-service product. Once access is activated for your agency, the service
      is considered delivered digitally. There is no physical product to “return.”
    </P>
    <H>2. Free trial / demo</H>
    <P>
      Where a free trial or demo is offered, you can evaluate the product before paying. We encourage agencies to use
      the trial or a walkthrough with our team before purchasing a paid plan.
    </P>
    <H>3. Refund eligibility</H>
    <Ul
      items={[
        "If you were charged incorrectly due to a billing error on our side, we will correct it or refund the excess amount.",
        "If the service cannot be activated for reasons solely attributable to TechX Solutions after payment, you may request a refund of that unused payment.",
        "Duplicate payments for the same subscription period are refundable for the duplicate amount after verification.",
      ]}
    />
    <H>4. Non-refundable cases</H>
    <Ul
      items={[
        "Change of mind after the plan has been activated and the agency has started using the panel",
        "Unused remaining days on a plan that was cancelled mid-cycle (unless required by applicable law or agreed in writing)",
        "Issues caused by incorrect information provided by the agency, local device/network problems, or third-party outages outside our control",
        "Add-on or custom development fees once work has started, unless otherwise agreed in writing",
      ]}
    />
    <H>5. How to request a refund</H>
    <P>
      Email{" "}
      <a href={`mailto:${COMPANY.email}`} className="text-[#0f5bd8] hover:underline">
        {COMPANY.email}
      </a>{" "}
      or WhatsApp {COMPANY.phone} with your agency name, registered mobile/email, payment reference / invoice number, and
      reason. We typically respond within 2–3 business days.
    </P>
    <H>6. Processing</H>
    <P>
      Approved refunds are processed to the original payment method where possible. Bank or gateway timelines may take
      additional business days after we initiate the refund.
    </P>
    <H>7. Cancellations</H>
    <P>
      You may choose not to renew at the end of your plan period. Access continues until the current paid period ends
      unless earlier suspension is required under our Terms.
    </P>
    <P className="text-xs text-slate-500">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</P>
  </Shell>
);
