/** TechX Solutions sales WhatsApp (E.164 without +). */
export const WHATSAPP_E164 = "919227048595";
export const WHATSAPP_DISPLAY = "+91 92270 48595";

export const whatsappUrl = (message?: string) => {
  const base = `https://wa.me/${WHATSAPP_E164}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
};

export const openWhatsApp = (message?: string) => {
  window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
};

export const WHATSAPP_MESSAGES = {
  sales:
    "Hi TechX CRM team, I’m interested in your plans for our visa / study-abroad agency. Please share details.",
  pricing6:
    "Hi TechX CRM team, I’m interested in the 6 Months plan. Please share next steps.",
  pricing12:
    "Hi TechX CRM team, I’m interested in the 12 Months plan. Please share next steps.",
  pricing:
    "Hi TechX CRM team, I’d like to talk about pricing for TechX CRM.",
  contact:
    "Hi TechX CRM team, I’d like to connect about TechX CRM for our agency.",
  walkthrough:
    "Hi TechX CRM team, I’d like a short walkthrough of TechX CRM for our agency.",
};
