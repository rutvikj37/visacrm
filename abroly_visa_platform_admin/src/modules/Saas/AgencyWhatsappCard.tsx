import { useCallback, useEffect, useState } from "react";
import { Button, Chip, Input, Switch } from "@nextui-org/react";
import { Copy, MessageCircle, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { fmtDate } from "./saasShared";

/**
 * Super Admin: connect an agency's WhatsApp Cloud API number for them (when the agency can't do it itself).
 * Same data and checks as the agency's own Leads > Lead sources > WhatsApp card; the agency sees the
 * connected number there too. Every change goes to the agency's activity log.
 */
type WaNumber = {
    uuid: string; name: string; status: string; last_error?: string | null; leads_received?: number;
    last_lead_at?: string | null; webhook_url?: string | null; verify_token?: string | null; app_secret_saved?: boolean;
    settings?: { auto_create_leads?: boolean } | null;
};

const emptyForm = { phone_number_id: "", waba_id: "", access_token: "", app_secret: "" };

const AgencyWhatsappCard = ({ agencyId }: { agencyId: string }) => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [numbers, setNumbers] = useState<WaNumber[]>([]);
    const [planAllows, setPlanAllows] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [mode, setMode] = useState<"closed" | "update" | "add">("closed");
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/saas_admin/agencies/${agencyId}/whatsapp`);
        if (success && data) {
            setNumbers(Array.isArray(data.numbers) ? data.numbers : []);
            setPlanAllows(data.plan_allows !== false);
        }
        setLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agencyId]);
    useEffect(() => { load(); }, [load]);

    const set = (k: keyof typeof emptyForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const formOpen = mode !== "closed" || (loaded && numbers.length === 0);
    const copy = async (v?: string | null) => {
        if (!v) return;
        try { await navigator.clipboard.writeText(v); SuccessToast("Copied"); } catch { ErrorToast("Couldn't copy"); }
    };

    const save = async () => {
        setBusy("save");
        const { success } = await commonPostAPICall({ ...form, add_number: mode === "add" }, `saas_admin/agencies/${agencyId}/whatsapp`, true);
        setBusy(null);
        if (success) { setForm(emptyForm); setMode("closed"); load(); }
    };

    const act = async (n: WaNumber, action: "toggle" | "delete") => {
        if (action === "delete" && !window.confirm(`Disconnect ${n.name}? New WhatsApp chats stop becoming leads. Leads already received are kept.`)) return;
        setBusy(n.uuid);
        const { success } = await commonPostAPICall({}, `saas_admin/agencies/${agencyId}/whatsapp/${n.uuid}/${action}`, true);
        setBusy(null);
        if (success) load();
    };

    const appSecretSaved = mode === "update" && numbers[0]?.app_secret_saved;

    return (
        <div className="rounded-xl border border-default-200 bg-content1 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-success" />
                <h3 className="font-semibold">WhatsApp leads</h3>
                {numbers.length > 0 && (
                    <Chip size="sm" variant="flat" color={numbers.some((n) => n.status === "active") ? "success" : "default"} className="ml-auto">
                        {numbers.some((n) => n.status === "active") ? "Connected" : "Off"}
                    </Chip>
                )}
            </div>
            <p className="text-sm text-default-500">
                Connect the agency's WhatsApp Cloud API number for them. Chats can auto-become leads, or wait in the WhatsApp inbox
                until staff taps Add as lead (review first). The agency sees this number under Leads → Lead sources.
            </p>
            {!planAllows && (
                <div className="text-sm rounded-lg bg-warning-50 text-warning-700 p-2">
                    This agency's plan doesn't include WhatsApp leads. Change the plan (or its sources) first.
                </div>
            )}

            {numbers.map((n) => {
                const autoCreate = n.settings?.auto_create_leads !== false;
                return (
                <div key={n.uuid} className="rounded-xl border border-default-200 p-3 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium flex-1 min-w-0 truncate">{n.name}</span>
                        <Switch size="sm" isSelected={n.status === "active"} isDisabled={busy === n.uuid} onValueChange={() => act(n, "toggle")} aria-label="Turn on or off" />
                    </div>
                    <div className="text-xs text-default-500">
                        {n.leads_received || 0} lead(s) received · last lead {n.last_lead_at ? fmtDate(n.last_lead_at) : "never"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-default-50 px-2 py-1.5">
                        <div className="min-w-0 flex-1 text-xs text-default-600">
                            <b>{autoCreate ? "Auto-create leads" : "Review first"}</b>
                            {" — "}
                            {autoCreate ? "new chats become leads" : "new chats wait in inbox until Add as lead"}
                        </div>
                        <Switch
                            size="sm"
                            isSelected={!autoCreate}
                            isDisabled={busy === `mode-${n.uuid}`}
                            onValueChange={async (on) => {
                                setBusy(`mode-${n.uuid}`);
                                const { success } = await commonPostAPICall(
                                    { auto_create_leads: !on },
                                    `saas_admin/agencies/${agencyId}/whatsapp/${n.uuid}/mode`,
                                    true,
                                );
                                setBusy(null);
                                if (success) load();
                            }}
                            aria-label="Review first"
                        />
                    </div>
                    {n.last_error && <div className="text-sm bg-danger-50 text-danger rounded-lg p-2 break-words">Last problem: {n.last_error}</div>}
                    <div className="text-xs text-default-500">
                        In the Meta app: <b>WhatsApp → Configuration → Webhook</b> - paste this link and verify token, then subscribe to <b>messages</b>.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-2">
                        <div className="flex gap-2 items-center min-w-0">
                            <Input size="sm" readOnly value={n.webhook_url || ""} aria-label="Webhook link" classNames={{ input: "text-xs" }} />
                            <Button size="sm" isIconOnly variant="flat" onPress={() => copy(n.webhook_url)} aria-label="Copy link"><Copy size={14} /></Button>
                        </div>
                        <div className="flex gap-2 items-center min-w-0">
                            <Input size="sm" readOnly value={n.verify_token || ""} aria-label="Verify token" classNames={{ input: "text-xs" }} />
                            <Button size="sm" isIconOnly variant="flat" onPress={() => copy(n.verify_token)} aria-label="Copy token"><Copy size={14} /></Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {mode === "closed" && n === numbers[0] && <Button size="sm" variant="flat" onPress={() => { setForm(emptyForm); setMode("update"); }}>Update details</Button>}
                        <Button size="sm" variant="flat" color="danger" startContent={<Trash2 size={14} />} className="ml-auto" isLoading={busy === n.uuid} onPress={() => act(n, "delete")}>Disconnect</Button>
                    </div>
                </div>
                );
            })}
            {numbers.length > 0 && mode === "closed" && (
                <Button size="sm" variant="light" className="self-start" onPress={() => { setForm(emptyForm); setMode("add"); }}>+ Add another WhatsApp number</Button>
            )}

            {formOpen && planAllows && (
                <div className="flex flex-col gap-3">
                    <ol className="text-sm text-default-500 list-decimal ml-5 space-y-1">
                        <li><b>business.facebook.com</b> → WhatsApp Manager: add the agency's number to WhatsApp Cloud API and verify it by OTP.</li>
                        <li>Meta app → <b>WhatsApp → API Setup</b>: copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b>.</li>
                        <li>Business Settings → <b>System users</b> → generate a <b>permanent token</b> with whatsapp_business_messaging and whatsapp_business_management.</li>
                        <li>The app's <b>App secret</b> is in App settings → Basic (needed if the token is from your own Meta app).</li>
                    </ol>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="Phone number ID" labelPlacement="outside" placeholder="e.g. 123456789012345" inputMode="numeric" value={form.phone_number_id} onValueChange={set("phone_number_id")} />
                        <Input label="WhatsApp Business Account ID" labelPlacement="outside" placeholder="e.g. 102938475610293" inputMode="numeric" value={form.waba_id} onValueChange={set("waba_id")} />
                        <Input label="Permanent access token" labelPlacement="outside" placeholder="EAAG..." type="password" autoComplete="off" value={form.access_token} onValueChange={set("access_token")} />
                        <Input label={appSecretSaved ? "App secret (saved - leave empty to keep)" : "App secret"} labelPlacement="outside" placeholder="32 characters" type="password" autoComplete="off" value={form.app_secret} onValueChange={set("app_secret")} />
                    </div>
                    <div className="flex gap-2 justify-end">
                        {numbers.length > 0 && <Button variant="light" onPress={() => { setForm(emptyForm); setMode("closed"); }}>Cancel</Button>}
                        <Button color="success" className="text-white" isLoading={busy === "save"}
                            isDisabled={!form.phone_number_id || !form.waba_id || form.access_token.length < 20}
                            onPress={save}>
                            {mode === "add" ? "Add number" : numbers.length ? "Save" : "Connect WhatsApp"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgencyWhatsappCard;
