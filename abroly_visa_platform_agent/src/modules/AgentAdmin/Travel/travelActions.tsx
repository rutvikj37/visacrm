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

/**
 * Several photos at once: pick one or many (up to 10 per upload), see them as thumbnails, remove or move first.
 * `max` caps the total; the first photo is the main one.
 */
export const MultiImageUpload = ({ value, onChange, max = 8, label = "Add photos", compact = false }: { value?: string[] | null; onChange: (urls: string[]) => void; max?: number; label?: string; compact?: boolean }) => {
    const token = useSelector((s: any) => s.login.token);
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const list = (value || []).filter(Boolean);
    const room = Math.max(0, max - list.length);
    const pick = async (files?: FileList | null) => {
        const chosen = Array.from(files || []).slice(0, Math.min(10, room));
        if (!chosen.length) { if (files?.length) ErrorToast(`Up to ${max} photos here`); return; }
        if ((files?.length || 0) > chosen.length) ErrorToast(`Only ${chosen.length} more photo${chosen.length === 1 ? "" : "s"} fit here (up to ${max})`);
        const fd = new FormData();
        chosen.forEach((f) => fd.append("files", f));
        setBusy(true);
        try {
            const r = await axios.post(`${base()}/travel/media`, fd, { headers: { Authorization: `Bearer ${token}` } });
            const urls: string[] = r.data?.data?.urls || (r.data?.data?.url ? [r.data.data.url] : []);
            if (r.data?.success && urls.length) onChange([...list, ...urls].slice(0, max)); else ErrorToast(r.data?.message || "Upload failed");
        } catch { ErrorToast("Upload failed"); }
        setBusy(false);
        if (input.current) input.current.value = "";
    };
    const size = compact ? "h-9 w-12" : "h-16 w-24";
    return (
        <div className="flex flex-wrap items-center gap-2">
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files)} />
            {(compact ? list.slice(0, 2) : list).map((u, i) => (
                <div key={u} className="relative group">
                    <img src={u} alt="" className={`${size} object-cover rounded-lg border ${i === 0 && list.length > 1 ? "border-primary" : "border-default-200"}`} />
                    <button type="button" aria-label="Remove photo" onClick={() => onChange(list.filter((x) => x !== u))} className="absolute -top-1.5 -right-1.5 bg-content1 rounded-full border border-default-200 p-0.5"><X size={12} /></button>
                    {i > 0 && !compact && <button type="button" onClick={() => onChange([u, ...list.filter((x) => x !== u)])} className="absolute bottom-0.5 left-0.5 text-[9px] px-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100">Make main</button>}
                </div>
            ))}
            {compact && list.length > 2 && <span className="text-[11px] text-default-500">+{list.length - 2}</span>}
            {room > 0 && <Button size="sm" variant="flat" isIconOnly={compact} aria-label={label} isLoading={busy} startContent={compact ? undefined : <ImagePlus size={14} />} onPress={() => input.current?.click()}>{compact ? <ImagePlus size={14} /> : list.length ? "Add more" : label}</Button>}
            {!compact && <span className="text-[11px] text-default-400">{list.length}/{max}</span>}
        </div>
    );
};
