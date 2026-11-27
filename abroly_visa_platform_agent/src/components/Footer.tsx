import { Link, useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppFloat";
import { whatsappUrl, WHATSAPP_MESSAGES, WHATSAPP_DISPLAY } from "@/utils/whatsapp";

const COMPANY_LINKS = [
  { title: "About Us", to: "/about" },
  { title: "Terms & Conditions", to: "/terms" },
  { title: "Privacy & Policy", to: "/privacy" },
  { title: "Data Deletion Policy", to: "/data-deletion" },
  { title: "Return & Refund Policy", to: "/refund" },
  { title: "Contact Us", to: "/contact_us" },
];

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-gray-900 text-white py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <div className="flex flex-col">
            <Link to="/" className="text-2xl font-bold text-white mb-3">
              TechX CRM
            </Link>
            <p className="text-sm text-gray-400 max-w-xs">
              TechX CRM is a product of TechX Solutions — CRM for visa and study-abroad agencies, with web panel plus
              agency & student apps on Android and iOS.
            </p>
          </div>

          <div className="flex flex-col">
            <h4 className="font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((item) => (
                <li key={item.to}>
                  <button
                    type="button"
                    className="text-sm text-gray-400 hover:text-blue-400 transition-colors duration-200 text-left"
                    onClick={() => navigate(item.to)}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col">
            <h4 className="font-semibold text-white mb-3">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                <a
                  href={whatsappUrl(WHATSAPP_MESSAGES.contact)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#25D366] transition-colors"
                >
                  WhatsApp {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <Mail size={16} />
                <a href="mailto:contact@techxsolutions.in" className="hover:text-blue-400 transition-colors">
                  contact@techxsolutions.in
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <Phone size={16} />
                <a href="tel:+919227048595" className="hover:text-blue-400 transition-colors">
                  {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin size={16} />
                Ahmedabad, Gujarat, India
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row justify-between items-center border-t border-gray-700 pt-6 text-center sm:text-left gap-2">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} TechX CRM. A product of TechX Solutions. All rights reserved.
          </p>
          <p className="text-sm text-gray-400">
            Developed by{" "}
            <a
              href="https://techxsolutions.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400 transition-colors duration-200"
            >
              TechX Solutions
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
