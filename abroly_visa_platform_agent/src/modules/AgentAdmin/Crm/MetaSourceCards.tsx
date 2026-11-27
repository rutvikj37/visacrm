import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Input, Switch } from "@heroui/react";
import { Copy, Facebook, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import FormField from "./FormField";
import { formatDateTime, timeAgo } from "./crmShared";

import { appPath } from "@/utils/appBase";
interface CardProps {
    integrations: any[];
    configured: { facebook: boolean; webhook: boolean };
    busy: string | null;
    call: (key: string, url: string, body?: object) => Promise<any>;
    onRemove: (integration: any) => void;
}

const copy = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        SuccessToast("Copied");
    } catch {
        ErrorToast("Could not copy - please select and copy it manually");
    }
};

const Stats = ({ i }: { i: any }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-default-500">
        <span>Leads received: <b className="text-default-700">{i.leads_received || 0}</b></span>
        <span>Last lead: {i.last_lead_at ? timeAgo(i.last_lead_at) : "never"}</span>
        {i.type === "facebook" && <span>Last sync: {i.last_synced_at ? formatDateTime(i.last_synced_at) : "never"}</span>}
    </div>
);

export const FacebookSourceCard = ({ integrations, configured, busy, call, onRemove }: CardProps) => {
    const { commonPostAPICall } = useApiCallUtils();
    const pages = integrations.filter((i) => i.type === "facebook");
    const [connecting, setConnecting] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [tokenForm, setTokenForm] = useState({ page_id: "", page_access_token: "", page_name: "" });
    const setTok = (k: keyof typeof tokenForm) => (v: string) => setTokenForm((f) => ({ ...f, [k]: v }));

    const connect = async () => {
        setConnecting(true);
        const returnUrl = `${window.location.origin}${appPath("/crm/sources")}`;
        const { success, data } = await commonPostAPICall({ return_url: returnUrl }, "crm/meta/facebook/connect_url");
        if (success && data?.url) {
            window.location.href = data.url;
            return;
        }
        setConnecting(false);
    };

    const savePageToken = async () => {
        const r = await call("fb-token", "crm/meta/facebook/page", tokenForm);
        if (r.success) {
            setTokenForm({ page_id: "", page_access_token: "", page_name: "" });
            setShowToken(false);
        }
    };

    return (
        <Card shadow="sm">
            <CardHeader className="flex items-center gap-2 font-semibold">
                <Facebook size={18} /> Facebook & Instagram Lead Ads
                {pages.length > 0 && <Chip size="sm" className="ml-auto" color="success" variant="flat">{pages.length} page(s)</Chip>}
            </CardHeader>
            <CardBody className="gap-3 pt-0">
                <p className="text-sm text-default-500">
                    Connect the Facebook Pages you run lead ads from (Instagram lead ads come through the linked Page).
                    New form submissions arrive in your Lead Inbox within seconds; use <b>Fetch last 7 days</b> to catch anything missed.
                </p>

                {configured.facebook ? (
                    <Button color="primary" variant={pages.length ? "flat" : "solid"} className="self-start" startContent={<Facebook size={16} />} isLoading={connecting} onPress={connect}>
                        {pages.length ? "Add or refresh Pages" : "Connect Facebook Pages"}
                    </Button>
                ) : (
                    <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800 space-y-1">
                        <p className="font-medium">One-click Facebook Login is not switched on for this platform yet.</p>
                        <p>Your platform admin must add the Meta App ID and App secret under <b>SaaS → Meta / Facebook</b> (or set <code>META_APP_ID</code> / <code>META_APP_SECRET</code> on the server). You can still connect a Page with an access token below and sync leads.</p>
                    </div>
                )}

                {(showToken || !configured.facebook || pages.length === 0) && (
                    <div className="flex flex-col gap-3 rounded-xl border border-default-200 p-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium flex-1">Connect with Page access token</span>
                            {configured.facebook && showToken && (
                                <Button size="sm" variant="light" onPress={() => setShowToken(false)}>Hide</Button>
                            )}
                        </div>
                        <p className="text-xs text-default-500">
                            From Meta Business Suite / Graph API Explorer, copy the <b>Page ID</b> and a <b>Page access token</b> with
                            {" "}<code>leads_retrieval</code>, <code>pages_manage_metadata</code>, and <code>pages_show_list</code>.
                            Then click <b>Fetch last 7 days</b> after connecting.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="Page ID"><Input aria-label="Page ID" inputMode="numeric" value={tokenForm.page_id} onValueChange={setTok("page_id")} /></FormField>
                            <FormField label="Page name (optional)"><Input aria-label="Page name" value={tokenForm.page_name} onValueChange={setTok("page_name")} /></FormField>
                            <FormField label="Page access token" className="sm:col-span-2">
                                <Input aria-label="Page access token" type="password" autoComplete="off" value={tokenForm.page_access_token} onValueChange={setTok("page_access_token")} />
                            </FormField>
                        </div>
                        <Button color="primary" variant="flat" className="self-start" isLoading={busy === "fb-token"} onPress={savePageToken}
                            isDisabled={!tokenForm.page_id.trim() || !tokenForm.page_access_token.trim()}>
                            Connect Page
                        </Button>
                    </div>
                )}

                {configured.facebook && !showToken && (
                    <Button size="sm" variant="light" className="self-start" onPress={() => setShowToken(true)}>
                        Or connect with a Page access token
                    </Button>
                )}

                {pages.map((p) => (
                    <div key={p.uuid} className="rounded-xl border border-default-200 p-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium flex-1 min-w-0 truncate">{p.name}</span>
                            <Chip size="sm" color={p.status === "active" ? "success" : "default"} variant="flat">{p.status === "active" ? "Active" : "Off"}</Chip>
                            <Switch size="sm" isSelected={p.status === "active"} isDisabled={busy === p.uuid} onValueChange={() => call(p.uuid, `crm/integrations/${p.uuid}/toggle`)} aria-label="Turn on or off" />
                        </div>
                        <Stats i={p} />
                        {p.last_error && <div className="text-sm bg-danger-50 text-danger rounded-lg p-2 break-words">Last problem: {p.last_error}</div>}
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} isLoading={busy === `s${p.uuid}`} isDisabled={p.status !== "active"}
                                onPress={() => call(`s${p.uuid}`, `crm/integrations/${p.uuid}/sync`)}>
                                Fetch last 7 days
                            </Button>
                            <Button size="sm" variant="flat" color="danger" startContent={<Trash2 size={14} />} onPress={() => onRemove(p)}>Disconnect</Button>
                        </div>
                    </div>
                ))}
            </CardBody>
        </Card>
    );
};

export const WhatsappSourceCard = ({ integrations, busy, call, onRemove }: CardProps) => {
    // an agency can connect more than one WhatsApp number (e.g. sales and operations); replies go from the number the client wrote to
    const allNumbers = integrations.filter((i) => i.type === "whatsapp");
    const wa = allNumbers[0];
    const [showForm, setShowForm] = useState(false);
    const [addMode, setAddMode] = useState(false);
    const [form, setForm] = useState({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
    const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

    const save = async () => {
        const r = await call("wa-save", "crm/meta/whatsapp", { ...form, add_number: addMode });
        if (r.success) {
            setForm({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
            setShowForm(false);
            setAddMode(false);
        }
    };

    const formOpen = !wa || showForm;

    return (
        <Card shadow="sm">
            <CardHeader className="flex items-center gap-2 font-semibold">
                <MessageCircle size={18} /> WhatsApp Business
                {wa && <Chip size="sm" className="ml-auto" color={wa.status === "active" ? "success" : "default"} variant="flat">{wa.status === "active" ? "Connected" : "Off"}</Chip>}
            </CardHeader>
            <CardBody className="gap-3 pt-0">
                <p className="text-sm text-default-500">
                    WhatsApp chats can become leads automatically, or wait in the WhatsApp inbox until your team taps <b>Add as lead</b> (review first).
                    Messages show on the lead timeline and the team can reply from the CRM.
                </p>

                {allNumbers.map((wa) => {
                    const autoCreate = wa.settings?.auto_create_leads !== false;
                    return (
                    <div key={wa.uuid} className="rounded-xl border border-default-200 p-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium flex-1 min-w-0 truncate">{wa.name}</span>
                            <Switch size="sm" isSelected={wa.status === "active"} isDisabled={busy === wa.uuid} onValueChange={() => call(wa.uuid, `crm/integrations/${wa.uuid}/toggle`)} aria-label="Turn on or off" />
                        </div>
                        <Stats i={wa} />
                        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-default-50 px-2 py-1.5">
                            <div className="min-w-0 flex-1 text-xs text-default-600">
                                <b>{autoCreate ? "Auto-create leads" : "Review first"}</b>
                                {" — "}
                                {autoCreate
                                    ? "every new chat becomes a lead"
                                    : "new chats stay in WhatsApp inbox until you add them as leads"}
                            </div>
                            <Switch
                                size="sm"
                                isSelected={!autoCreate}
                                isDisabled={busy === `mode-${wa.uuid}`}
                                onValueChange={(on) => call(`mode-${wa.uuid}`, `crm/integrations/${wa.uuid}/whatsapp_mode`, { auto_create_leads: !on })}
                                aria-label="Review first"
                            />
                        </div>
                        {wa.last_error && <div className="text-sm bg-danger-50 text-danger rounded-lg p-2 break-words">Last problem: {wa.last_error}</div>}
                        <div className="text-xs text-default-500">
                            In your Meta app go to <b>WhatsApp → Configuration → Webhook</b>, paste this link and verify token, then subscribe to <b>messages</b>.
                            {!wa.app_secret_saved && " Add your App secret below if the token comes from your own Meta app."}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-2">
                            <div className="flex gap-2 items-center min-w-0">
                                <Input size="sm" readOnly value={wa.webhook_url || ""} aria-label="Webhook link" classNames={{ input: "text-xs" }} />
                                <Button size="sm" isIconOnly variant="flat" onPress={() => copy(wa.webhook_url)} aria-label="Copy link"><Copy size={14} /></Button>
                            </div>
                            <div className="flex gap-2 items-center min-w-0">
                                <Input size="sm" readOnly value={wa.verify_token || ""} aria-label="Verify token" classNames={{ input: "text-xs" }} />
                                <Button size="sm" isIconOnly variant="flat" onPress={() => copy(wa.verify_token)} aria-label="Copy token"><Copy size={14} /></Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {!showForm && wa === allNumbers[0] && <Button size="sm" variant="flat" onPress={() => { setAddMode(false); setShowForm(true); }}>Update details</Button>}
                            <Button size="sm" variant="flat" color="danger" startContent={<Trash2 size={14} />} className="ml-auto" onPress={() => onRemove(wa)}>Disconnect</Button>
                        </div>
                    </div>
                    );
                })}
                {allNumbers.length > 0 && !showForm && <Button size="sm" variant="light" className="self-start" onPress={() => { setAddMode(true); setShowForm(true); }}>+ Add another WhatsApp number</Button>}

                {formOpen && (
                    <div className="flex flex-col gap-3">
                        <ol className="text-sm text-default-500 list-decimal ml-5 space-y-1">
                            <li>Open <b>business.facebook.com</b> → WhatsApp Manager and add your business number (WhatsApp Cloud API).</li>
                            <li>In your Meta app: <b>WhatsApp → API Setup</b> — copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b> from that screen (do not reuse an old ID).</li>
                            <li>Business Settings → <b>Users → System users</b> → open the system user → <b>Assign assets</b> → add this <b>WhatsApp account</b> with <b>Manage</b> permission, then generate a <b>permanent token</b> with whatsapp_business_messaging and whatsapp_business_management.</li>
                            <li>Your app's <b>App secret</b> is in App settings → Basic. After connect, paste the webhook URL + verify token under WhatsApp → Configuration and subscribe to <b>messages</b>.</li>
                        </ol>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="Phone number ID"><Input aria-label="Phone number ID" inputMode="numeric" value={form.phone_number_id} onValueChange={set("phone_number_id")} /></FormField>
                            <FormField label="WhatsApp Business Account ID"><Input aria-label="WhatsApp Business Account ID" inputMode="numeric" value={form.waba_id} onValueChange={set("waba_id")} /></FormField>
                            <FormField label="Permanent access token"><Input aria-label="Access token" type="password" autoComplete="off" value={form.access_token} onValueChange={set("access_token")} /></FormField>
                            <FormField label={wa?.app_secret_saved ? "App secret (saved - leave empty to keep)" : "App secret"}>
                                <Input aria-label="App secret" type="password" autoComplete="off" value={form.app_secret} onValueChange={set("app_secret")} />
                            </FormField>
                        </div>
                        <div className="flex gap-2">
                            <Button color="primary" variant="flat" isLoading={busy === "wa-save"} onPress={save}
                                isDisabled={!form.phone_number_id.trim() || !form.waba_id.trim() || !form.access_token.trim()}>
                                {addMode ? "Add number" : wa ? "Save" : "Connect WhatsApp"}
                            </Button>
                            {wa && <Button variant="light" onPress={() => { setShowForm(false); setAddMode(false); }}>Cancel</Button>}
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};
