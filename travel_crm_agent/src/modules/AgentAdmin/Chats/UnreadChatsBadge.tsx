import { useEffect, useState } from "react";
import { useChatUpdates } from "@/lib/realtime";
import useApiCallUtils from "@/hooks/useApiCallUtils";

/** Unread student portal chats for the menu badge. */
const UnreadChatsBadge = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [n, setN] = useState(0);
    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (document.hidden) return;
            const { success, data } = await commonGetAPICalls("/crm/portal_chats/unread");
            if (alive && success) setN(Number(data?.unread_chats || 0));
        };
        load();
        const t = setInterval(load, 60000); // fallback; live updates come over the WebSocket
        window.addEventListener("chats-changed", load);
        return () => { alive = false; clearInterval(t); window.removeEventListener("chats-changed", load); };
    }, []);
    useChatUpdates(async () => {
        const { success, data } = await commonGetAPICalls("/crm/portal_chats/unread");
        if (success) setN(Number(data?.unread_chats || 0));
    });
    if (!n) return null;
    return <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-semibold grid place-items-center">{n > 99 ? "99+" : n}</span>;
};

export default UnreadChatsBadge;
