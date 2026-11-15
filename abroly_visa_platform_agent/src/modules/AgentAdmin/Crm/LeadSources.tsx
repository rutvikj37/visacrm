import FirstTip from "@/components/help/FirstTip";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Button, Card, CardBody, CardHeader, Chip, Code, Input, Spinner, Switch, Tab, Tabs, useDisclosure } from "@heroui/react";
import { ArrowLeft, Copy, FileSpreadsheet, Globe, Lock, Plus, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import CommonConfirmation from "@/components/CommonConfirmation";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { formatDateTime, timeAgo } from "./crmShared";
import { FacebookSourceCard, WhatsappSourceCard } from "./MetaSourceCards";
import { InstagramSourceCard, PushSourceCard } from "./PushSourceCards";
import SourceBranchCard from "./SourceBranchCard";

const copy = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        SuccessToast("Copied");
    } catch {
        ErrorToast("Could not copy - please select and copy it manually");
    }
};

const htmlSnippet = (url: string) => `<form action="${url}" method="POST">
  <input name="name" placeholder="Full name" required>
  <input name="phone" placeholder="Phone / WhatsApp" required>
  <input name="email" type="email" placeholder="Email">
  <input name="country" placeholder="Country you want to go">
  <input name="course" placeholder="Course">
  <textarea name="message" placeholder="Your question"></textarea>
  <!-- spam trap: keep hidden -->
  <input name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
  <!-- optional: page to show after submit -->
  <input type="hidden" name="_redirect" value="https://your-website.com/thank-you">
  <button type="submit">Get free counselling</button>
</form>`;

const jsonSnippet = (url: string) => `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Rahul Sharma","phone":"+91 98765 43210","email":"rahul@example.com","country":"Canada","course":"MBA","message":"Need help with study visa"}'`;

const StatusLine = ({ integration }: { integration: any }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-default-500">
        <span>Leads received: <b className="text-default-700">{integration.leads_received || 0}</b></span>
        <span>Last lead: {integration.last_lead_at ? timeAgo(integration.last_lead_at) : "never"}</span>
        {integration.type === "indiamart" && <span>Last sync: {integration.last_synced_at ? formatDateTime(integration.last_synced_at) : "never"}</span>}
    </div>
);

const LockedSource = ({ title }: { title: string }) => {
    const navigate = useNavigate();
    return (
        <Card shadow="sm" className="bg-default-50">
            <CardBody className="flex flex-row items-center gap-3">
                <Lock size={18} className="text-default-500 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="font-medium">{title}</div>
                    <div className="text-sm text-default-500">Not included in your plan.</div>
                </div>
                <Button size="sm" color="primary" variant="flat" onPress={() => navigate("/subscription")}>Upgrade</Button>
            </CardBody>
        </Card>
    );
};

const LeadSources = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";

    const [integrations, setIntegrations] = useState<any[]>([]);
    const [autoAssign, setAutoAssign] = useState(false);
    const [rules, setRules] = useState({ new_lead_hours: "", stale_days: "" });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [newFormName, setNewFormName] = useState("");
    const [crmKey, setCrmKey] = useState("");
    const [toDelete, setToDelete] = useState<any>(null);
    const [metaConfig, setMetaConfig] = useState({ facebook: false, webhook: false });
    const [params, setParams] = useSearchParams();
    // SaaS plan: which sources the agency may connect (no plan = all)
    const subscription = useSelector((state: any) => state.login.subscription);
    const allowedSources: string[] | null = subscription?.plan ? (subscription.plan.features?.sources || []) : null;
    const isLocked = (key: string) => Boolean(allowedSources && !allowedSources.includes(key));
    const deleteConfirm = useDisclosure();

    const load = useCallback(async () => {
        const [list, settings, meta] = await Promise.all([
            commonGetAPICalls("/crm/integrations"),
            commonGetAPICalls("/crm/settings"),
            commonGetAPICalls("/crm/meta/status"),
        ]);
        if (meta.success) setMetaConfig(meta.data);
        if (list.success) setIntegrations(list.data || []);
        if (settings.success) {
            setAutoAssign(Boolean(settings.data?.auto_assign));
            setRules({ new_lead_hours: settings.data?.rules?.new_lead_hours ? String(settings.data.rules.new_lead_hours) : "", stale_days: settings.data?.rules?.stale_days ? String(settings.data.rules.stale_days) : "" });
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // coming back from Facebook: show the result once
    useEffect(() => {
        const result = params.get("meta");
        if (!result) return;
        const message = params.get("meta_message") || "";
        if (result === "connected") SuccessToast(message || "Facebook connected");
        else ErrorToast(message || "Facebook was not connected");
        const next = new URLSearchParams(params);
        next.delete("meta");
        next.delete("meta_message");
        setParams(next, { replace: true });
    }, []);

    const call = async (key: string, url: string, body: object = {}) => {
        setBusy(key);
        const result = await commonPostAPICall(body, url, true);
        setBusy(null);
        if (result.success) await load();
        return result;
    };

    if (!isOwner) {
        return <div className="p-6">Only the agency owner can manage lead sources.</div>;
    }
    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    const websites = integrations.filter((i) => i.type === "website");
    const indiamart = integrations.find((i) => i.type === "indiamart");

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
            <FirstTip id="sources" title="Connect your lead sources">Pick where your enquiries come from and follow the steps on its card. Then press "Send test lead" to check it lands in the inbox.</FirstTip>
            <div className="flex items-start gap-3">
                <Button isIconOnly variant="light" onPress={() => navigate("/crm/leads")} aria-label="Back"><ArrowLeft size={20} /></Button>
                <div>
                    <h1 className="text-2xl font-semibold">Lead sources</h1>
                    <p className="text-sm text-default-500">Connect where your enquiries come from. New leads land in your Lead Inbox automatically.</p>
                </div>
            </div>

            {/* settings */}
            <Card shadow="sm">
                <CardBody className="flex flex-row items-center gap-4">
                    <div className="flex-1">
                        <div className="font-medium">Auto-assign new leads</div>
                        <div className="text-sm text-default-500">Share new leads one by one (round robin) between your active team members.</div>
                    </div>
                    <Switch
                        isSelected={autoAssign}
                        isDisabled={busy === "settings"}
                        onValueChange={async (v) => {
                            const r = await call("settings", "crm/settings", { auto_assign: v });
                            if (!r.success) setAutoAssign(!v);
                        }}
                        aria-label="Auto-assign"
                    />
                </CardBody>
            </Card>

            {/* follow-up rules */}
            <Card shadow="sm">
                <CardBody className="gap-3">
                    <div>
                        <div className="font-medium">Follow-up rules</div>
                        <div className="text-sm text-default-500">Automatic reminders so no lead is forgotten. Leave a box empty to switch a rule off.</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-default-600">Remind if a new lead is not contacted within (hours)</span>
                            <Input aria-label="New lead hours" type="number" min={1} max={72} placeholder="e.g. 2" value={rules.new_lead_hours} onValueChange={(v) => setRules((r) => ({ ...r, new_lead_hours: v }))} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-default-600">Remind if an open lead has no activity for (days)</span>
                            <Input aria-label="Stale days" type="number" min={1} max={60} placeholder="e.g. 3" value={rules.stale_days} onValueChange={(v) => setRules((r) => ({ ...r, stale_days: v }))} />
                        </div>
                        <Button color="primary" variant="flat" isLoading={busy === "rules"} onPress={() => call("rules", "crm/settings", { rules })}>Save rules</Button>
                    </div>
                </CardBody>
            </Card>

            {/* website */}
            {isLocked("website") ? <LockedSource title="Website & landing pages" /> : (
            <>
            <Card shadow="sm">
                <CardHeader className="flex items-center gap-2 font-semibold"><Globe size={18} /> Website & landing pages</CardHeader>
                <CardBody className="gap-4 pt-0 min-w-0">
                    <p className="text-sm text-default-500">
                        Each form gets its own private link. Point your website form, landing page, WordPress plugin, Zapier or Pabbly to it.
                    </p>
                    {websites.map((w) => (
                        <div key={w.uuid} className="rounded-xl border border-default-200 p-3 flex flex-col gap-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium flex-1 min-w-0 truncate">{w.name}</span>
                                <Chip size="sm" color={w.status === "active" ? "success" : "default"} variant="flat">{w.status === "active" ? "Active" : "Off"}</Chip>
                                <Switch size="sm" isSelected={w.status === "active"} isDisabled={busy === w.uuid} onValueChange={() => call(w.uuid, `crm/integrations/${w.uuid}/toggle`)} aria-label="Turn on or off" />
                            </div>
                            <StatusLine integration={w} />
                            <div className="flex gap-2 items-center">
                                <Input size="sm" readOnly value={w.webhook_url} aria-label="Webhook URL" classNames={{ input: "text-xs" }} />
                                <Button size="sm" isIconOnly variant="flat" onPress={() => copy(w.webhook_url)} aria-label="Copy URL"><Copy size={14} /></Button>
                            </div>
                            <Tabs size="sm" aria-label="How to connect">
                                <Tab key="html" title="HTML form">
                                    <div className="relative min-w-0">
                                        <div className="overflow-x-auto max-w-full rounded-lg"><Code className="block whitespace-pre text-xs p-3 w-max min-w-full">{htmlSnippet(w.webhook_url)}</Code></div>
                                        <Button size="sm" variant="flat" className="mt-2" startContent={<Copy size={14} />} onPress={() => copy(htmlSnippet(w.webhook_url))}>Copy form code</Button>
                                    </div>
                                </Tab>
                                <Tab key="api" title="API / Zapier">
                                    <p className="text-xs text-default-500 mb-2">
                                        Send a POST with JSON or form fields. Field names are matched loosely: name, phone / mobile, email, country, course, message, campaign.
                                        Anything else is saved as extra info.
                                    </p>
                                    <div className="overflow-x-auto max-w-full rounded-lg"><Code className="block whitespace-pre text-xs p-3 w-max min-w-full">{jsonSnippet(w.webhook_url)}</Code></div>
                                </Tab>
                            </Tabs>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} isLoading={busy === `k${w.uuid}`}
                                    onPress={() => call(`k${w.uuid}`, `crm/integrations/${w.uuid}/regenerate_key`)}>
                                    New link (old one stops working)
                                </Button>
                                <Button size="sm" variant="flat" color="danger" startContent={<Trash2 size={14} />} onPress={() => { setToDelete(w); deleteConfirm.onOpen(); }}>
                                    Remove
                                </Button>
                            </div>
                        </div>
                    ))}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input size="sm" placeholder={`Form name, e.g. "Homepage form"`} value={newFormName} onValueChange={setNewFormName} />
                        <Button color="primary" variant="flat" startContent={<Plus size={16} />} isLoading={busy === "new-web"}
                            onPress={async () => {
                                const r = await call("new-web", "crm/integrations/website", { name: newFormName });
                                if (r.success) setNewFormName("");
                            }}>
                            Add website form
                        </Button>
                    </div>
                </CardBody>
            </Card>

            </>
            )}
            {/* indiamart */}
            {isLocked("indiamart") ? <LockedSource title="IndiaMART" /> : (
            <>
            <Card shadow="sm">
                <CardHeader className="flex items-center gap-2 font-semibold">
                    <ShoppingBag size={18} /> IndiaMART
                    {indiamart && <Chip size="sm" className="ml-auto" color={indiamart.status === "active" ? "success" : "default"} variant="flat">{indiamart.status === "active" ? "Connected" : "Off"}</Chip>}
                </CardHeader>
                <CardBody className="gap-3 pt-0">
                    <ol className="text-sm text-default-500 list-decimal ml-5 space-y-1">
                        <li>Log in to IndiaMART seller panel and open <b>Lead Manager</b>.</li>
                        <li>Go to <b>Import / Export Leads → CRM Integration (Pull API v2)</b> and generate your <b>CRM key</b>.</li>
                        <li>Paste the key below. We fetch new enquiries every 10 minutes.</li>
                    </ol>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            size="sm"
                            type="password"
                            placeholder={indiamart?.crm_key_masked ? `Saved key ${indiamart.crm_key_masked} - paste a new one to replace` : "Paste IndiaMART CRM key"}
                            value={crmKey}
                            onValueChange={setCrmKey}
                            autoComplete="off"
                        />
                        <Button color="primary" variant="flat" isLoading={busy === "im"} isDisabled={!crmKey.trim()}
                            onPress={async () => {
                                const r = await call("im", "crm/integrations/indiamart", { crm_key: crmKey.trim() });
                                if (r.success) setCrmKey("");
                            }}>
                            {indiamart ? "Update key" : "Connect"}
                        </Button>
                    </div>
                    {indiamart && (
                        <>
                            <StatusLine integration={indiamart} />
                            {indiamart.last_error && (
                                <div className="text-sm bg-danger-50 text-danger rounded-lg p-2 break-words">Last problem: {indiamart.last_error}</div>
                            )}
                            <div className="text-xs text-default-500">
                                Optional instant delivery: in IndiaMART Push API settings, use this URL so leads arrive within seconds.
                            </div>
                            <div className="flex gap-2 items-center">
                                <Input size="sm" readOnly value={indiamart.webhook_url} aria-label="IndiaMART push URL" classNames={{ input: "text-xs" }} />
                                <Button size="sm" isIconOnly variant="flat" onPress={() => copy(indiamart.webhook_url)} aria-label="Copy URL"><Copy size={14} /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <Button size="sm" variant="flat" startContent={<RefreshCw size={14} />} isLoading={busy === "im-sync"} isDisabled={indiamart.status !== "active"}
                                    onPress={() => call("im-sync", `crm/integrations/${indiamart.uuid}/sync`)}>
                                    Sync now
                                </Button>
                                <Switch size="sm" isSelected={indiamart.status === "active"} isDisabled={busy === indiamart.uuid}
                                    onValueChange={() => call(indiamart.uuid, `crm/integrations/${indiamart.uuid}/toggle`)}>
                                    On
                                </Switch>
                                <Button size="sm" variant="flat" color="danger" startContent={<Trash2 size={14} />} className="ml-auto"
                                    onPress={() => { setToDelete(indiamart); deleteConfirm.onOpen(); }}>
                                    Disconnect
                                </Button>
                            </div>
                        </>
                    )}
                </CardBody>
            </Card>

            </>
            )}
            <SourceBranchCard integrations={integrations} onChanged={load} />

            {/* csv */}
            {isLocked("csv") ? <LockedSource title="CSV / Excel import" /> : (
            <>
            <Card shadow="sm">
                <CardBody className="flex flex-row items-center gap-4">
                    <FileSpreadsheet size={22} />
                    <div className="flex-1">
                        <div className="font-medium">CSV / Excel import</div>
                        <div className="text-sm text-default-500">Bring leads from Facebook exports, Google Sheets, old CRMs...</div>
                    </div>
                    <Button variant="flat" onPress={() => navigate("/crm/leads")}>Open inbox</Button>
                </CardBody>
            </Card>

            </>
            )}
            {/* Meta */}
            {isLocked("facebook") ? <LockedSource title="Facebook & Instagram Lead Ads" /> : (
            <FacebookSourceCard integrations={integrations} configured={metaConfig} busy={busy} call={call} onRemove={(i) => { setToDelete(i); deleteConfirm.onOpen(); }} />
            )}
            {isLocked("instagram") ? <LockedSource title="Instagram DMs" /> : (
            <InstagramSourceCard integrations={integrations} hasFacebook={integrations.some((i) => i.type === "facebook")} busy={busy} call={call} onRemove={(i) => { setToDelete(i); deleteConfirm.onOpen(); }} />
            )}
            {isLocked("whatsapp") ? <LockedSource title="WhatsApp Business" /> : (
            <WhatsappSourceCard integrations={integrations} configured={metaConfig} busy={busy} call={call} onRemove={(i) => { setToDelete(i); deleteConfirm.onOpen(); }} />
            )}
            {(["google", "justdial", "sulekha"] as const).map((t) => isLocked(t)
                ? <LockedSource key={t} title={t === "google" ? "Google Ads lead forms" : t === "justdial" ? "Justdial" : "Sulekha"} />
                : <PushSourceCard key={t} type={t} integrations={integrations} busy={busy} call={call} onRemove={(i) => { setToDelete(i); deleteConfirm.onOpen(); }} />)}

            <CommonConfirmation
                isOpen={deleteConfirm.isOpen}
                onOpenChange={deleteConfirm.onOpenChange}
                title={`Remove "${toDelete?.name}"? Leads already received are kept.`}
                nagativeTitle="Cancel"
                positiveTitle="Remove"
                handleSubmit={async () => {
                    deleteConfirm.onClose();
                    if (toDelete) await call("del", `crm/integrations/${toDelete.uuid}/delete`);
                    setToDelete(null);
                }}
            />
        </div>
    );
};

export default LeadSources;
