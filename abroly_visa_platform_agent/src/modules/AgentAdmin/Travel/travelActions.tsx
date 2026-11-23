import { useRef, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { Button } from "@heroui/react";
import { ImagePlus, X } from "lucide-react";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

const base = () => `${import.meta.env.VITE_API_BASE_URL}/v1`;

/** Open a server PDF (needs the login header, so fetch it and open the file). */
export const useOpenPdf = () => {
    const token = useSelector((s: any) => s.login.token);
    return async (path: string) => {
        const w = window.open("", "_blank");
        try {
            const r = await axios.get(`${base()}/${path}`, { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" });
            if (!String(r.headers["content-type"] || "").includes("pdf")) { w?.close(); const t = JSON.parse(await (r.data as Blob).text()); return ErrorToast(t.message || "Could not make the PDF"); }
            const url = URL.createObjectURL(r.data);
            if (w) w.location.href = url; else window.open(url, "_blank");
        } catch { w?.close(); ErrorToast("Could not make the PDF"); }
    };
};

/**
 * Send on WhatsApp through the agency's own WhatsApp Business number (template for the event if set up,
 * else free text inside 24 hours). If that is not possible, open WhatsApp with the message ready instead.
 */
export const useSendWhatsapp = () => {
    const token = useSelector((s: any) => s.login.token);
    return async (opts: { to?: string | null; text: string; trigger?: string; vars?: Record<string, any>; lead_id?: string | null }) => {
        const to = String(opts.to || "").replace(/\D/g, "");
        const open = () => window.open(`https://wa.me/${to}?text=${encodeURIComponent(opts.text)}`, "_blank", "noopener");
        if (!to) return open();
        try {
            const r = await axios.post(`${base()}/travel/whatsapp/send`, { ...opts, to }, { headers: { Authorization: `Bearer ${token}` } });
            if (r.data?.data?.sent) { SuccessToast("Sent on WhatsApp"); return true; }
            open();
            return false;
        } catch { open(); return false; }
    };
};

/** Pick and upload a photo (JPG / PNG / WebP up to 5 MB) and get back its public URL. */
export const ImageUpload = ({ value, onChange, label = "Add photo", compact = false }: { value?: string | null; onChange: (url: string | null) => void; label?: string; compact?: boolean }) => {
    const token = useSelector((s: any) => s.login.token);
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const pick = async (file?: File) => {
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        setBusy(true);
        try {
            const r = await axios.post(`${base()}/travel/media`, fd, { headers: { Authorization: `Bearer ${token}` } });
            if (r.data?.success && r.data.data?.url) onChange(r.data.data.url); else ErrorToast(r.data?.message || "Upload failed");
        } catch { ErrorToast("Upload failed"); }
        setBusy(false);
        if (input.current) input.current.value = "";
    };
    return (
        <div className="flex items-center gap-2">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {value ? (
                <div className="relative">
                    <img src={value} alt="" className={`${compact ? "h-10 w-14" : "h-20 w-32"} object-cover rounded-lg border border-default-200`} />
                    <button type="button" aria-label="Remove photo" onClick={() => onChange(null)} className="absolute -top-1.5 -right-1.5 bg-content1 rounded-full border border-default-200 p-0.5"><X size={12} /></button>
                </div>
            ) : null}
            <Button size="sm" variant="flat" isIconOnly={compact} aria-label={label} isLoading={busy} startContent={compact ? undefined : <ImagePlus size={14} />} onPress={() => input.current?.click()}>{compact ? <ImagePlus size={14} /> : value ? "Change" : label}</Button>
        </div>
    );
};
