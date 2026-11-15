import { useState } from "react";
import { Button } from "@heroui/react";
import { Lightbulb, X } from "lucide-react";
import { TUTORIAL_ENABLED, markTipSeen, tipSeen } from "./onboardingStore";

/** A small hint shown the first time someone opens a screen. "Got it" hides it for good (in this browser). */
const FirstTip = ({ id, title, children }: { id: string; title: string; children: any }) => {
    const [open, setOpen] = useState(() => !tipSeen(id));
    if (!TUTORIAL_ENABLED || !open) return null;
    const close = () => { markTipSeen(id); setOpen(false); };
    return (
        <div role="note" className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50/60 px-3 py-2.5 text-sm">
            <Lightbulb size={18} className="text-warning-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                <div className="font-medium text-default-800">{title}</div>
                <div className="text-default-600">{children}</div>
            </div>
            <Button size="sm" variant="flat" className="shrink-0 max-sm:hidden" onPress={close}>Got it</Button>
            <button type="button" aria-label="Close tip" className="sm:hidden text-default-500 p-1" onClick={close}><X size={16} /></button>
        </div>
    );
};

export default FirstTip;
