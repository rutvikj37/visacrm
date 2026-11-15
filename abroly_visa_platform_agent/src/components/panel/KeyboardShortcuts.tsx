import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Kbd, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from "@heroui/react";

/**
 * Keyboard shortcuts for people who live in the CRM (ignored while typing in a field):
 *   /  or Ctrl+K   search            n   new lead
 *   g t  Today     g l  Lead Inbox   g c  Case board   g k  Calendar   g f  Client fees
 *   ?   this help                    in the lead panel: Up / Down (or k / j) previous / next lead
 */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
    { keys: ["/"], label: "Search leads, students and invoices" },
    { keys: ["n"], label: "Add a new lead" },
    { keys: ["g", "t"], label: "Go to Today" },
    { keys: ["g", "l"], label: "Go to Lead Inbox" },
    { keys: ["g", "m"], label: "Go to Chats" },
    { keys: ["g", "c"], label: "Go to Case board" },
    { keys: ["g", "k"], label: "Go to Calendar" },
    { keys: ["g", "f"], label: "Go to Client fees" },
    { keys: ["↑", "↓"], label: "Previous / next lead (in the lead panel)" },
    { keys: ["Esc"], label: "Close a panel or window" },
    { keys: ["?"], label: "Show these shortcuts" },
];

const typing = (el: EventTarget | null) => {
    const t = el as HTMLElement | null;
    return Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable));
};

const KeyboardShortcuts = () => {
    const navigate = useNavigate();
    const help = useDisclosure();
    const pendingG = useRef(0);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
            if (document.querySelector('[role="dialog"]') && e.key !== "?") return; // a window is open
            const k = e.key;
            if (pendingG.current && Date.now() - pendingG.current < 1200) {
                pendingG.current = 0;
                const to: Record<string, string> = { t: "/", l: "/crm/leads", m: "/crm/chats", c: "/cases/board", k: "/crm/calendar", f: "/fees" };
                if (to[k]) { e.preventDefault(); navigate(to[k]); }
                return;
            }
            if (k === "g") { pendingG.current = Date.now(); return; }
            if (k === "/") { e.preventDefault(); window.dispatchEvent(new Event("open-search")); return; }
            if (k === "n") { e.preventDefault(); navigate("/crm/leads?add=1"); return; }
            if (k === "?") { e.preventDefault(); help.onOpen(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <Modal isOpen={help.isOpen} onOpenChange={help.onOpenChange} size="md">
            <ModalContent>
                <ModalHeader>Keyboard shortcuts</ModalHeader>
                <ModalBody className="pb-6">
                    <div className="flex flex-col divide-y divide-default-100">
                        {SHORTCUTS.map((s) => (
                            <div key={s.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <span>{s.label}</span>
                                <span className="flex gap-1 shrink-0">{s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                            </div>
                        ))}
                    </div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default KeyboardShortcuts;
