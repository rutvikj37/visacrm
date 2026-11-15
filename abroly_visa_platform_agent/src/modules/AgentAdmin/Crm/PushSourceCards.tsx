import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Input, Switch } from "@heroui/react";
import { Copy, Instagram, KeyRound, Phone, Search, Store, Trash2 } from "lucide-react";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { timeAgo } from "./crmShared";

/** Lead sources that push leads to us: Google Ads lead forms, Justdial, Sulekha. Plus Instagram DMs (via Facebook). */

type CallFn = (key: string, url: string, body?: object) => Promise<any>;
interface Props { integrations: any[]; busy: string | null; call: CallFn; onRemove: (i: any) => void }

const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); SuccessToast("Copied"); } catch { ErrorToast("Could not copy - please select and copy it manually"); }
};

const CopyField = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-default-600">{label}</span>
        <div className="flex gap-2">
            <Input size="sm" readOnly value={value} aria-label={label} classNames={{ input: "text-xs font-mono" }} />
            <Button size="sm" isIconOnly variant="flat" aria-label={`Copy ${label}`} onPress={() => copy(value)}><Copy size={14} /></Button>
        </div>
    </div>
);

const Stats = ({ i }: { i: any }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-default-500">
        <span>Leads received: <b className="text-default-700">{i.leads_received || 0}</b></span>
        <span>Last lead: {i.last_lead_at ? timeAgo(i.last_lead_at) : "never"}</span>
    </div>
);

const SOURCES: Record<string, { title: string; icon: any; intro: string; steps: React.ReactNode[] }> = {
    google: {
        title: "Google Ads lead forms",
        icon: Search,
        intro: "Leads from lead form assets on Search, YouTube, Display and Performance Max arrive here within seconds.",
        steps: [
            <>In Google Ads open your campaign → <b>Assets</b> → your <b>Lead form</b> → <b>Lead delivery</b>.</>,
            <>Under <b>Webhook integration</b> paste the <b>Webhook URL</b> and the <b>Key</b> below.</>,
            <>Click <b>Send test data</b> - a test lead (tagged "test") should appear in your Lead Inbox.</>,
            <>Tip: add questions like "Which country?" and "Course" to the form - we fill them in automatically.</>,
        ],
    },
    justdial: {
        title: "Justdial",
        icon: Phone,
        intro: "Every enquiry Justdial sends you appears in the Lead Inbox instantly - no more copying from SMS or email.",
        steps: [
            <>Call your Justdial account manager or write to Justdial support and ask to <b>enable the Lead API / push URL</b> for your listing.</>,
            <>Give them the <b>Push URL</b> below (it works with GET or POST).</>,
            <>New Justdial enquiries are added as leads with the category searched and the area.</>,
        ],
    },
    sulekha: {
        title: "Sulekha",
        icon: Store,
        intro: "Sulekha requirement leads land in your Lead Inbox the moment they are assigned to you.",
        steps: [
            <>Ask your Sulekha relationship manager to <b>turn on lead push to your CRM</b>.</>,
            <>Give them the <b>Push URL</b> below (JSON or form post).</>,
            <>Name, mobile, email, city and the service needed are filled in automatically.</>,
        ],
    },
};

export const PushSourceCard = ({ type, integrations, busy, call, onRemove }: Props & { type: "google" | "justdial" | "sulekha" }) => {
    const meta = SOURCES[type];
    const Icon = meta.icon;
    const i = integrations.find((x) => x.type === type);
    const [showSteps, setShowSteps] = useState(!i);

    return (
        <Card shadow="sm">
            <CardHeader className="flex items-center gap-2 font-semibold">
                <Icon size={18} /> {meta.title}
                {i && <Chip size="sm" className="ml-auto" color={i.status === "active" ? "success" : "default"} variant="flat">{i.status === "active" ? "Connected" : "Off"}</Chip>}
            </CardHeader>
            <CardBody className="gap-3 pt-0">
                <p className="text-sm text-default-500">{meta.intro}</p>
                {!i ? (
                    <Button color="primary" className="self-start" isLoading={busy === `push-${type}`} onPress={() => call(`push-${type}`, "crm/integrations/push", { type })}>
                        Get my {type === "google" ? "webhook" : "push"} link
                    </Button>
                ) : (
                    <>
                        <CopyField label={type === "google" ? "Webhook URL" : "Push URL"} value={i.webhook_url} />
                        {type === "google" && i.google_key && <CopyField label="Key" value={i.google_key} />}
                        <Stats i={i} />
                        {i.last_error && <div className="text-sm bg-danger-50 text-danger rounded-lg p-2 break-words">Last problem: {i.last_error}</div>}
                        <div className="flex flex-wrap items-center gap-2">
                            <Switch size="sm" isSelected={i.status === "active"} isDisabled={busy === i.uuid} onValueChange={() => call(i.uuid, `crm/integrations/${i.uuid}/toggle`)}>On</Switch>
                            <Button size="sm" variant="light" onPress={() => setShowSteps((s) => !s)}>{showSteps ? "Hide steps" : "How to set up"}</Button>
                            <Button size="sm" variant="flat" startContent={<KeyRound size={14} />} isLoading={busy === `rk${i.uuid}`}
                                onPress={() => window.confirm(`Make a new ${type === "google" ? "URL and key" : "URL"}? The old one stops working and you must update it in ${meta.title}.`) && call(`rk${i.uuid}`, `crm/integrations/${i.uuid}/regenerate_key`)}>
                                New link
                            </Button>
                            <Button size="sm" variant="flat" color="danger" className="ml-auto" startContent={<Trash2 size={14} />} onPress={() => onRemove(i)}>Remove</Button>
                        </div>
                    </>
                )}
                {showSteps && (
                    <ol className="list-decimal pl-5 text-sm text-default-600 flex flex-col gap-1">
                        {meta.steps.map((s, n) => <li key={n}>{s}</li>)}
                    </ol>
                )}
            </CardBody>
        </Card>
    );
};

/** Instagram business accounts linked to the connected Facebook Pages: their DMs become leads. */
export const InstagramSourceCard = ({ integrations, busy, call, onRemove, hasFacebook }: Props & { hasFacebook: boolean }) => {
    const accounts = integrations.filter((i) => i.type === "instagram");
    return (
        <Card shadow="sm">
            <CardHeader className="flex items-center gap-2 font-semibold">
                <Instagram size={18} /> Instagram DMs
                {accounts.length > 0 && <Chip size="sm" className="ml-auto" color="success" variant="flat">{accounts.length} account(s)</Chip>}
            </CardHeader>
            <CardBody className="gap-3 pt-0">
                <p className="text-sm text-default-500">
                    Messages to your Instagram business account become leads, and your team can reply from the lead page.
                    Your Instagram account must be a <b>Business / Creator account linked to a Facebook Page</b>.
                </p>
                {!accounts.length && (
                    <div className="text-sm rounded-lg bg-default-100 p-3">
                        {hasFacebook
                            ? <>No Instagram account found on your connected Pages. Link Instagram to your Page (Instagram app → Settings → Business tools → Connect a Facebook Page), then click <b>Add or refresh Pages</b> in the Facebook card above.</>
                            : <>Connect your Facebook Page in the card above - the Instagram account linked to it is connected automatically.</>}
                    </div>
                )}
                {accounts.map((a) => (
                    <div key={a.uuid} className="rounded-xl border border-default-200 p-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium flex-1 min-w-0 truncate">{a.name}{a.settings?.page_name ? <span className="text-default-500 font-normal"> · via {a.settings.page_name}</span> : null}</span>
                            <Switch size="sm" isSelected={a.status === "active"} isDisabled={busy === a.uuid} onValueChange={() => call(a.uuid, `crm/integrations/${a.uuid}/toggle`)} aria-label="Turn on or off" />
                        </div>
                        <Stats i={a} />
                        {a.last_error && <div className="text-sm bg-warning-50 text-warning-700 rounded-lg p-2 break-words">{a.last_error}</div>}
                        <Button size="sm" variant="flat" color="danger" className="self-start" startContent={<Trash2 size={14} />} onPress={() => onRemove(a)}>Disconnect</Button>
                    </div>
                ))}
            </CardBody>
        </Card>
    );
};
