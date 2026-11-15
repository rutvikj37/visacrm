import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { AlertTriangle, ChevronDown, ExternalLink, Megaphone, PartyPopper, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const STYLE: Record<string, { box: string; icon: any }> = {
    info: { box: "bg-primary-50 text-primary-800 border-primary-100", icon: Megaphone },
    success: { box: "bg-success-50 text-success-800 border-success-100", icon: PartyPopper },
    warning: { box: "bg-warning-50 text-warning-800 border-warning-100", icon: AlertTriangle },
};

/**
 * Messages from the platform (new features, maintenance, offers). Each person can close them.
 * On phones only the newest shows, as one line; tap it to read it (and see how many more there are).
 */
const AnnouncementBanner = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [items, setItems] = useState<any[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/announcements");
            if (success) setItems(data || []);
        })();
    }, []);

    if (!items.length) return null;
    const dismiss = (id: string) => {
        setItems((list) => list.filter((a) => a.id !== id));
        commonPostAPICall({}, `crm/announcements/${id}/dismiss`);
    };
    const go = (url: string) => (url.startsWith("/") ? navigate(url) : window.open(url, "_blank", "noopener"));

    const Item = ({ a, compact }: { a: any; compact: boolean }) => {
        const s = STYLE[a.level] || STYLE.info;
        const Icon = s.icon;
        return (
            <div className={`flex items-start gap-2 sm:gap-3 rounded-xl border px-3 py-2 text-sm ${s.box}`}>
                <Icon size={16} className="shrink-0 mt-0.5" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => compact && setOpen(true)} disabled={!compact}>
                    <div className={`font-semibold ${compact ? "truncate" : ""}`}>{a.title}</div>
                    {!compact && a.body && <div className="whitespace-pre-line opacity-90">{a.body}</div>}
                </button>
                {compact && items.length > 1 && <span className="text-xs shrink-0 self-center opacity-80">+{items.length - 1}</span>}
                {compact && <ChevronDown size={16} className="shrink-0 self-center opacity-70" />}
                {!compact && a.link_url && (
                    <Button size="sm" variant="flat" className="shrink-0 self-center" endContent={a.link_url.startsWith("/") ? null : <ExternalLink size={12} />} onPress={() => go(a.link_url)}>
                        {a.link_label || "Learn more"}
                    </Button>
                )}
                <Button isIconOnly size="sm" variant="light" aria-label="Close" className="shrink-0 -mr-1 -my-1" onPress={() => dismiss(a.id)}><X size={14} /></Button>
            </div>
        );
    };

    return (
        <div className="mb-3">
            {/* phones: one line, tap to open */}
            <div className="sm:hidden flex flex-col gap-2">
                {open ? items.map((a) => <Item key={a.id} a={a} compact={false} />) : <Item a={items[0]} compact />}
                {open && <button type="button" className="text-xs text-default-500 self-center" onClick={() => setOpen(false)}>Show less</button>}
            </div>
            {/* larger screens: all of them */}
            <div className="hidden sm:flex flex-col gap-2">
                {items.map((a) => <Item key={a.id} a={a} compact={false} />)}
            </div>
        </div>
    );
};

export default AnnouncementBanner;
