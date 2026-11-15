import { useEffect, useState } from "react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

/** Number of chats with unread WhatsApp / Instagram messages, for the menu. Refreshes every 30 s and when a chat is opened. */
const UnreadChatsBadge = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [n, setN] = useState(0);
    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (document.hidden) return;
            const { success, data } = await commonGetAPICalls("/crm/conversations/unread");
            if (alive && success) setN(Number(data?.unread_chats || 0));
        };
        load();
        const t = setInterval(load, 30000);
        window.addEventListener("chats-changed", load);
        return () => { alive = false; clearInterval(t); window.removeEventListener("chats-changed", load); };
    }, []);
    if (!n) return null;
    return <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-success text-white text-[11px] font-semibold grid place-items-center">{n > 99 ? "99+" : n}</span>;
};

export default UnreadChatsBadge;
