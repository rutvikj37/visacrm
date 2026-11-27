import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger, Spinner, Switch } from "@heroui/react";
import {
    AlarmClock, AtSign, Bell, CalendarClock, CheckCheck, CheckSquare, CreditCard, FileUp, Inbox, MessageCircle, Sun, UserPlus, Briefcase,
    Megaphone,
} from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const ICONS: Record<string, any> = {
    new_lead: Inbox,
    lead_assigned: UserPlus,
    case_assigned: Briefcase,
    task_assigned: CheckSquare,
    portal_chat: MessageCircle,
    whatsapp_message: MessageCircle,
    follow_up_due: CalendarClock,
    daily_digest: Sun,
    document_uploaded: FileUp,
    trial_ending: AlarmClock,
    plan_ending: AlarmClock,
    plan_expired: AlarmClock,
    payment_received: CreditCard,
    import_done: Inbox,
    payment_failed: CreditCard,
    announcement: Megaphone,
    mention: AtSign,
};

const ago = (v: string) => {
    const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
};

/** Bell with unread count; checks for new notifications every minute. */
const NotificationBell = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    const refreshCount = useCallback(async () => {
        if (document.hidden) return;
        const { success, data } = await commonGetAPICalls("/crm/notifications/unread_count");
        if (success) setUnread(data?.unread || 0);
    }, []);

    useEffect(() => {
        refreshCount();
        const t = setInterval(refreshCount, 60 * 1000);
        return () => clearInterval(t);
    }, [refreshCount]);

    const load = async () => {
        setLoading(true);
        const [list, prefs] = await Promise.all([commonGetAPICalls("/crm/notifications"), commonGetAPICalls("/crm/notifications/settings")]);
        if (list.success) {
            setItems(list.data?.notifications || []);
            setUnread(list.data?.unread || 0);
        }
        if (prefs.success) setSettings(prefs.data);
        setLoading(false);
    };

    const openItem = async (n: any) => {
        if (!n.read_at) {
            commonPostAPICall({ ids: [n.uuid] }, "crm/notifications/read");
            setItems((list) => list.map((x) => (x.uuid === n.uuid ? { ...x, read_at: new Date().toISOString() } : x)));
            setUnread((u) => Math.max(0, u - 1));
        }
        setOpen(false);
        if (n.link) navigate(n.link);
    };

    const markAll = async () => {
        const { success } = await commonPostAPICall({ all: true }, "crm/notifications/read");
        if (success) {
            setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
            setUnread(0);
        }
    };

    const toggleEmail = async (value: boolean) => {
        setSettings((s: any) => ({ ...s, email: value }));
        await commonPostAPICall({ email: value }, "crm/notifications/settings", true);
    };

    return (
        <Popover placement="bottom-end" isOpen={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
            <PopoverTrigger>
                <Button isIconOnly variant="light" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
                    <Badge content={unread > 99 ? "99+" : unread} color="danger" size="sm" isInvisible={!unread} shape="circle">
                        <Bell size={20} />
                    </Badge>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[min(92vw,380px)]">
                <div className="flex items-center justify-between w-full px-4 py-3 border-b border-default-200">
                    <span className="font-semibold">Notifications</span>
                    {unread > 0 && <Button size="sm" variant="light" startContent={<CheckCheck size={14} />} onPress={markAll}>Mark all read</Button>}
                </div>
                <div className="w-full max-h-[60vh] overflow-y-auto">
                    {loading && <div className="flex justify-center p-6"><Spinner size="sm" /></div>}
                    {!loading && items.length === 0 && <p className="text-sm text-default-500 p-6 text-center">You're all caught up.</p>}
                    {!loading && items.map((n) => {
                        const Icon = ICONS[n.type] || Bell;
                        return (
                            <button
                                key={n.uuid}
                                type="button"
                                onClick={() => openItem(n)}
                                className={`w-full text-left flex gap-3 px-4 py-3 border-b border-default-100 hover:bg-default-100 ${n.read_at ? "" : "bg-primary-50/60"}`}
                            >
                                <Icon size={18} className={`mt-0.5 shrink-0 ${n.read_at ? "text-default-400" : "text-primary"}`} />
                                <span className="flex-1 min-w-0">
                                    <span className={`block text-sm break-words ${n.read_at ? "" : "font-semibold"}`}>{n.title}</span>
                                    {n.body && <span className="block text-xs text-default-500 break-words line-clamp-2">{n.body}</span>}
                                </span>
                                <span className="text-[11px] text-default-400 shrink-0">{ago(n.createdAt)}</span>
                            </button>
                        );
                    })}
                </div>
                {settings && (
                    <div className="w-full px-4 py-3 border-t border-default-200 flex items-center justify-between gap-2">
                        <span className="text-xs text-default-500">
                            {!settings.has_email ? "Add an email to your profile to get email alerts" : "Also send important alerts by email"}
                        </span>
                        <Switch size="sm" isSelected={settings.email} isDisabled={!settings.has_email} onValueChange={toggleEmail} aria-label="Email notifications" />
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default NotificationBell;
