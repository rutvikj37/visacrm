import { Button } from "@heroui/react";
import { GraduationCap, LogIn, Plane } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AgencyBrand } from "@/utils/agencyHost";

/**
 * Header and footer for the public pages of an agency's own address (<agency>/agency/...),
 * in the agency's name and logo - no TechX CRM branding there.
 */

/** The agency's student login, on the student portal next to this panel (https://<agency>/login). */
export const studentLoginUrl = () => `${window.location.protocol}//${window.location.host}/login`;

export const AgencyHeader = ({ brand }: { brand: AgencyBrand | null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const onLogin = location.pathname === "/login";
  const name = brand?.name || "";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button type="button" onClick={() => navigate("/")} className="flex min-w-0 items-center gap-3" aria-label={name || "Home"}>
          {brand?.logo ? (
            <img src={brand.logo} alt={name} className="h-10 w-auto max-w-[160px] object-contain" />
          ) : brand ? (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: brand.color || "#0f5bd8" }}>
                <Plane size={18} />
              </span>
              <span className="truncate text-lg font-semibold text-slate-900">{name}</span>
            </>
          ) : (
            <span className="h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <Button
            as="a"
            href={studentLoginUrl()}
            variant="light"
            className="font-medium text-slate-700"
            startContent={<GraduationCap size={17} />}
          >
            <span className="hidden sm:inline">Student login</span>
            <span className="sm:hidden">Student</span>
          </Button>
          {!onLogin && (
            <Button
              onPress={() => navigate("/login")}
              className="font-medium text-white"
              style={{ background: brand?.color || "#0f5bd8" }}
              startContent={<LogIn size={17} />}
            >
              Staff login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export const AgencyFooter = ({ brand }: { brand: AgencyBrand | null }) => (
  <footer className="border-t border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
      <span>© {new Date().getFullYear()} {brand?.name || ""}</span>
      <span className="flex items-center gap-4">
        <a href={studentLoginUrl()} className="hover:text-slate-800">Student login</a>
        <span>Powered by TechX CRM</span>
      </span>
    </div>
  </footer>
);
