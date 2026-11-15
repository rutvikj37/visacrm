import toast from "react-hot-toast";

/**
 * "Done · Undo" message instead of an "Are you sure?" pop-up for actions that can be reversed.
 * undoToast("3 leads deleted", async () => { ...put them back... })
 */
export const undoToast = (message: string, onUndo: () => Promise<any> | void, ms = 6000) =>
    toast.custom((t) => (
        <div className={`${t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"} transition-all flex items-center gap-3 rounded-xl bg-default-900 text-white px-4 py-3 shadow-lg text-sm`}>
            <span>{message}</span>
            <button type="button" className="font-semibold text-primary-200 hover:text-white"
                onClick={async () => { toast.dismiss(t.id); await onUndo(); }}>Undo</button>
        </div>
    ), { duration: ms });
