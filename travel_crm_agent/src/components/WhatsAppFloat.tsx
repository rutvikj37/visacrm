import { motion } from "framer-motion";
import { openWhatsApp, WHATSAPP_MESSAGES } from "@/utils/whatsapp";

const WhatsAppIcon = ({ className = "h-7 w-7" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden>
    <path d="M16.02 3C9.4 3 4 8.36 4 14.92c0 2.1.56 4.14 1.62 5.95L4 29l8.36-2.18a12.1 12.1 0 0 0 3.66.56h.01c6.62 0 12.02-5.36 12.02-11.92C28.05 8.36 22.64 3 16.02 3zm0 21.7h-.01a10 10 0 0 1-5.1-1.4l-.36-.21-4.96 1.3 1.32-4.82-.24-.39a9.8 9.8 0 0 1-1.5-5.26C5.17 9.55 10.04 4.7 16.02 4.7c5.97 0 10.84 4.84 10.84 10.8 0 5.96-4.87 10.8-10.84 10.8zm5.94-8.08c-.32-.16-1.92-.94-2.22-1.05-.3-.11-.51-.16-.73.16-.21.32-.84 1.05-1.03 1.27-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.59-1.6-.96-.85-1.6-1.9-1.79-2.22-.19-.32-.02-.49.14-.65.15-.15.32-.38.48-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.57-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.54.08-.83.4-.28.32-1.09 1.06-1.09 2.59 0 1.52 1.11 3 1.27 3.2.16.21 2.18 3.33 5.28 4.67.74.32 1.32.51 1.77.65.74.24 1.42.2 1.96.12.6-.09 1.92-.78 2.19-1.54.27-.76.27-1.41.19-1.54-.08-.14-.29-.21-.61-.37z" />
  </svg>
);

/** Fixed WhatsApp chat button on public marketing pages. */
const WhatsAppFloat = () => (
  <motion.button
    type="button"
    aria-label="Chat on WhatsApp"
    title="Chat on WhatsApp"
    onClick={() => openWhatsApp(WHATSAPP_MESSAGES.contact)}
    className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_28px_-8px_rgba(37,211,102,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
    initial={{ opacity: 0, scale: 0.7, y: 16 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay: 1.1, type: "spring", stiffness: 260, damping: 18 }}
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.96 }}
  >
    <motion.span
      aria-hidden
      className="absolute inset-0 rounded-full bg-[#25D366]/40"
      animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
    />
    <WhatsAppIcon className="relative h-8 w-8 sm:h-9 sm:w-9" />
  </motion.button>
);

export { WhatsAppIcon };
export default WhatsAppFloat;
