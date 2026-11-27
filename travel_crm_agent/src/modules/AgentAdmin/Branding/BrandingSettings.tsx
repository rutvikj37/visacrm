import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Button, Card, CardBody, CardHeader, Input, Spinner, Textarea } from "@heroui/react";
import { ImagePlus } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { applyBrand, DEFAULT_BRAND } from "@/lib/theme";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";
import { applyCaseFlow } from "@/modules/AgentAdmin/Cases/caseShared";

const DEFAULTS = { primary_color: DEFAULT_BRAND, primary_foreground_color: "#ffffff", dark_primary_color: "#050a30" };

const Field = ({ label, hint, children }: any) => (
    <div className="flex flex-col gap-1 min-w-0">
        <span className="text-xs font-medium text-default-600">{label}</span>
        {children}
        {hint && <span className="text-xs text-default-400">{hint}</span>}
    </div>
);

const ColorField = ({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (v: string) => void }) => (
    <Field label={label}>
        <div className="flex items-center gap-2">
            <input type="color" aria-label={label} value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded border border-default-200 bg-transparent cursor-pointer" />
            <Input aria-label={`${label} hex`} size="sm" value={value} placeholder={fallback} onValueChange={onChange} className="max-w-[140px]" />
        </div>
    </Field>
);

/** Owner screen: how the student portal looks (name, logo, colours, support details). */
const BrandingSettings = () => {
    const { commonGetAPICalls, commonPostAPICallWithFile } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const fileRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<any>(null);
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/branding");
        if (success) {
            setForm({ ...data, app_name: data.app_name || "", primary_color: data.primary_color || "", primary_foreground_color: data.primary_foreground_color || "", dark_primary_color: data.dark_primary_color || "", support_number: data.support_number || "", support_email: data.support_email || "", agency_address: data.agency_address || "", meta_description: data.meta_description || "", business_focus: data.business_focus || "study" });
            setLogoPreview(data.logo_url || null);
        }
    }, []);
    useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

    if (!isOwner) {
        return (
            <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Branding</h1>
                    <p className="text-sm text-default-500">Only the agency owner can change branding.</p>
                </div>
            </div>
        );
    }
    if (!form) {
        return (
            <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Branding</h1>
                    <p className="text-sm text-default-500">Name, logo and colours for your student portal</p>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center gap-2 py-14">
                    <Spinner size="sm" />
                    <span className="text-sm text-default-500">Loading…</span>
                </div>
            </div>
        );
    }

    const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));
    const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return ErrorToast("Please choose a PNG, JPG or WEBP image");
        if (f.size > 2 * 1024 * 1024) return ErrorToast("Logo must be smaller than 2 MB");
        setLogo(f);
        setLogoPreview(URL.createObjectURL(f));
    };
    const save = async () => {
        setSaving(true);
        const fd = new FormData();
        for (const k of ["app_name", "primary_color", "primary_foreground_color", "dark_primary_color", "support_number", "support_email", "agency_address", "meta_description", "business_focus"]) fd.append(k, form[k] ?? "");
        if (logo) fd.append("logo", logo);
        const { success, data } = await commonPostAPICallWithFile(fd, "crm/branding");
        setSaving(false);
        if (success) {
            SuccessToast("Branding saved");
            setLogo(null);
            if (data?.logo_url) setLogoPreview(data.logo_url);
            // CSS vars update live via applyBrand; avoid full reload flash
            applyBrand(form.primary_color || null);
            applyCaseFlow(form.business_focus);
        }
    };

    const primary = /^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : DEFAULTS.primary_color;
    const onPrimary = /^#[0-9a-fA-F]{6}$/.test(form.primary_foreground_color) ? form.primary_foreground_color : DEFAULTS.primary_foreground_color;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Branding</h1>
                <p className="text-sm text-default-500">Name, logo and colours for your student portal and this panel</p>
            </div>

            <Card shadow="sm">
                <CardHeader className="flex flex-col items-start gap-0.5">
                    <span className="font-semibold">What does your agency mainly do?</span>
                    <span className="text-xs text-default-500 font-normal">Sets case stage names, the tools on each case and the wording in your client portal.</span>
                </CardHeader>
                <CardBody className="pt-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                        { key: "study", title: "Student visas", text: "Universities, offers, intakes, study permits." },
                        { key: "travel", title: "Tourist & business visas", text: "Appointments, itinerary, cover letters, funds check." },
                        { key: "both", title: "Both", text: "Each case follows its visa type." },
                    ].map((o) => {
                        const on = form.business_focus === o.key;
                        return (
                            <button key={o.key} type="button" onClick={() => set("business_focus")(o.key)} aria-pressed={on}
                                className={`text-left rounded-xl border-2 p-3 transition-colors ${on ? "border-primary bg-primary/5" : "border-default-200 hover:border-default-300"}`}>
                                <span className="block text-sm font-semibold text-foreground">{o.title}</span>
                                <span className="block text-xs text-default-500 mt-0.5">{o.text}</span>
                            </button>
                        );
                    })}
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardHeader className="font-semibold">Name & logo</CardHeader>
                <CardBody className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Agency / portal name"><Input aria-label="Portal name" value={form.app_name} onValueChange={set("app_name")} /></Field>
                    <Field label="Logo" hint="PNG, JPG or WEBP, up to 2 MB. Also used as the browser tab icon.">
                        <div className="flex items-center gap-3">
                            <div className="h-14 w-14 rounded-lg border border-default-200 bg-default-50 flex items-center justify-center overflow-hidden">
                                {logoPreview ? <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus size={20} className="text-default-400" />}
                            </div>
                            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickLogo} />
                            <Button size="sm" variant="flat" onPress={() => fileRef.current?.click()}>{logoPreview ? "Change logo" : "Upload logo"}</Button>
                        </div>
                    </Field>
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardHeader className="font-semibold">Colours</CardHeader>
                <CardBody className="pt-0 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ColorField label="Main colour" value={form.primary_color} fallback={DEFAULTS.primary_color} onChange={set("primary_color")} />
                        <ColorField label="Text on main colour" value={form.primary_foreground_color} fallback={DEFAULTS.primary_foreground_color} onChange={set("primary_foreground_color")} />
                        <ColorField label="Dark colour (footer, dark areas)" value={form.dark_primary_color} fallback={DEFAULTS.dark_primary_color} onChange={set("dark_primary_color")} />
                    </div>
                    <div className="rounded-xl border border-default-200 p-4 flex flex-wrap items-center gap-3">
                        <span className="text-xs text-default-500">Preview</span>
                        <span className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: primary, color: onPrimary }}>Get free counselling</span>
                        <span className="text-sm font-semibold" style={{ color: primary }}>{form.app_name || "Your agency"}</span>
                    </div>
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardHeader className="font-semibold">Support details shown to students</CardHeader>
                <CardBody className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Support phone / WhatsApp"><Input aria-label="Support phone" value={form.support_number} {...phoneInputProps} onValueChange={(v) => set("support_number")(toPhoneDigits(v))} /></Field>
                    <Field label="Support email"><Input aria-label="Support email" type="email" value={form.support_email} onValueChange={set("support_email")} /></Field>
                    <div className="sm:col-span-2"><Field label="Office address"><Textarea aria-label="Address" minRows={2} value={form.agency_address} onValueChange={set("agency_address")} /></Field></div>
                    <div className="sm:col-span-2"><Field label="Short description (shown on Google and when the link is shared)"><Textarea aria-label="Description" minRows={2} value={form.meta_description} onValueChange={set("meta_description")} /></Field></div>
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardBody className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                    <div className="flex-1">
                        <div className="font-medium">Student portal address</div>
                        <div className="text-default-500">
                            {form.portal_address
                                ? `${form.portal_address} — students open this link for your branded landing page and login.`
                                : "Not set yet — platform admin can assign your subdomain or custom domain."}
                        </div>
                    </div>
                    <Button color="primary" isLoading={saving} onPress={save}>Save branding</Button>
                </CardBody>
            </Card>
        </div>
    );
};

export default BrandingSettings;
