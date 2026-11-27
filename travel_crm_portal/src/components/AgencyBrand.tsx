import { LANGUAGES, Lang, setLang, useT } from "@/utils/i18n";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { getAppName, getConfig } from "@/utils/config";

/**
 * Agency logo, or its first letter in the brand colour when there is no logo (or it fails to load).
 * wide: keep the logo's own shape at this height (wordmark logos stay whole instead of being cropped square);
 * onShape tells the caller whether the loaded logo is a wide wordmark, e.g. to skip repeating the name next to it.
 */
export const AgencyLogo = ({ size = 32, wide = false, onShape }: { size?: number; wide?: boolean; onShape?: (wordmark: boolean) => void }) => {
    const [broken, setBroken] = useState(false);
    const url = getConfig("FAVICON_URL");
    const name = getAppName() || "A";
    const ok = url && !broken && url !== "/logo.png";
    if (!ok) {
        return <div className="rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.45 }}>{name.slice(0, 1).toUpperCase()}</div>;
    }
    return wide
        ? <img
            src={url} alt={name}
            onError={() => { setBroken(true); onShape?.(false); }}
            onLoad={(e) => { const i = e.currentTarget; onShape?.(i.naturalWidth > i.naturalHeight * 1.6); }}
            className="object-contain shrink-0"
            style={{ height: size, width: "auto", maxWidth: size * 5 }}
        />
        : <img src={url} alt="" onError={() => setBroken(true)} className="rounded-lg object-cover shrink-0" style={{ width: size, height: size }} />;
};

const TITLES: [string, string][] = [
    ["/chat", "Chat with counsellor"],
    ["/my_progress", "@my_progress"],
    ["/my_fees", "@my_fees"],
    ["/services", "@services"],
    ["/student_profile", "My profile"],
    ["/accepted_applications", "My applications"],
    ["/career", "Careers"],
    ["/faq", "FAQs"],
    ["/contact_us", "Contact us"],
    ["/health", "Health insurance"],
    ["/sim", "SIM cards"],
];

/** Top bar: page title + agency name, language, chat shortcut. */
export const StudentTopBar = () => {
    const { pathname } = useLocation();
    const { t, lang } = useT();
    const hit = TITLES.filter(([p]) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p))
        .sort((a, b) => b[0].length - a[0].length)[0];
    const raw = hit?.[1] || "";
    const title = raw.startsWith("@") ? t(raw.slice(1)) : raw;
    const agency = getAppName() || "Student portal";
    return (
        <div className="flex items-center gap-2 min-w-0 flex-1">
            <AgencyLogo size={28} />
            <div className="min-w-0 leading-tight">
                <div className="text-sm font-semibold truncate">{title || agency}</div>
                {title ? <div className="text-[11px] text-default-500 truncate">{agency}</div> : null}
            </div>
            <select
                aria-label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                className="ml-auto rounded-lg border border-default-200 bg-transparent px-2 py-1 text-xs shrink-0"
            >
                {LANGUAGES.map((l) => <option key={l.key} value={l.key}>{l.short}</option>)}
            </select>
            {pathname !== "/chat" && (
                <Link
                    to="/chat"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium shrink-0 no-underline"
                >
                    <MessagesSquare size={14} /><span className="max-sm:hidden">Chat</span>
                </Link>
            )}
        </div>
    );
};
