import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Input, Spinner } from "@nextui-org/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { FormField } from "./saasShared";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

/**
 * Platform Meta app credentials. Once saved (or set via META_* env), agencies can
 * Connect Facebook Pages from Lead Sources and sync Lead Ads into the inbox.
 */
const SaasMetaSettings = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [form, setForm] = useState({ app_id: "", app_secret: "", verify_token: "", login_config_id: "", graph_version: "v21.0" });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const { success, data: d } = await commonGetAPICalls("/saas_admin/meta_settings");
        if (!success || !d) return;
        setData(d);
        setForm({
            app_id: d.app_id || "",
            app_secret: "",
            verify_token: d.verify_token || "",
            login_config_id: d.login_config_id || "",
            graph_version: d.graph_version || "v21.0",
        });
    };

    useEffect(() => { load(); }, []);

    if (!data) return <div className="p-10 flex justify-center"><Spinner /></div>;

    const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const ready = Boolean(data.configured?.facebook);
    const webhookReady = Boolean(data.configured?.webhook);

    const save = async () => {
        setSaving(true);
        const body: any = {
            app_id: form.app_id,
            verify_token: form.verify_token,
            login_config_id: form.login_config_id,
            graph_version: form.graph_version,
        };
        if (form.app_secret.trim()) body.app_secret = form.app_secret.trim();
        const r = await commonPostAPICall(body, "/saas_admin/meta_settings", true);
        setSaving(false);
        if (r.success) {
            setForm((f) => ({ ...f, app_secret: "" }));
            await load();
        }
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            SuccessToast("Copied");
        } catch {
            ErrorToast("Could not copy");
        }
    };

    return (
        <div className="flex flex-col gap-4 p-2 max-w-3xl">
            <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-semibold">Meta / Facebook</h1>
                    <p className="text-sm text-default-500">
                        One Meta app for the whole platform. After this is set, every agency connects its own Pages from Lead Sources and Lead Ads land in their inbox.
                    </p>
                </div>
                <Chip size="sm" color={ready ? "success" : "warning"} variant="flat">{ready ? "Agencies can connect" : "Not ready"}</Chip>
            </div>

            {!data.public_api_url && (
                <Card shadow="sm" className="border border-warning-200 bg-warning-50">
                    <CardBody className="text-sm text-warning-800">
                        <b>PUBLIC_API_URL</b> is missing on the server. Set it in the backend <code>.env</code> (e.g. <code>https://api.yourdomain.com/api</code>) and restart — OAuth and webhooks need it.
                    </CardBody>
                </Card>
            )}

            <Card shadow="sm">
                <CardHeader className="font-semibold">App credentials</CardHeader>
                <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="App ID *">
                        <Input
                            aria-label="App ID"
                            value={form.app_id}
                            onValueChange={set("app_id")}
                            isDisabled={data.env_locked?.app_id}
                            description={data.env_locked?.app_id ? "Locked by META_APP_ID in server .env" : "developers.facebook.com → App settings → Basic"}
                        />
                    </FormField>
                    <FormField label={data.app_secret_saved ? "App secret (saved — leave empty to keep)" : "App secret *"}>
                        <Input
                            aria-label="App secret"
                            type="password"
                            autoComplete="off"
                            value={form.app_secret}
                            onValueChange={set("app_secret")}
                            isDisabled={data.env_locked?.app_secret}
                            description={data.env_locked?.app_secret ? "Locked by META_APP_SECRET in server .env" : (data.app_secret_hint ? `Current: ${data.app_secret_hint}` : undefined)}
                        />
                    </FormField>
                    <FormField label="Webhook verify token *">
                        <Input
                            aria-label="Verify token"
                            value={form.verify_token}
                            onValueChange={set("verify_token")}
                            isDisabled={data.env_locked?.verify_token}
                            description={data.env_locked?.verify_token ? "Locked by META_WEBHOOK_VERIFY_TOKEN" : "Paste the same value in Meta → Webhooks"}
                        />
                    </FormField>
                    <FormField label="Login configuration ID (optional)">
                        <Input
                            aria-label="Login config ID"
                            value={form.login_config_id}
                            onValueChange={set("login_config_id")}
                            isDisabled={data.env_locked?.login_config_id}
                            description="Facebook Login for Business → Configurations"
                        />
                    </FormField>
                    <FormField label="Graph API version">
                        <Input aria-label="Graph version" value={form.graph_version} onValueChange={set("graph_version")} />
                    </FormField>
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardHeader className="flex items-center gap-2 font-semibold">
                    URLs for the Meta app dashboard
                    <Chip size="sm" className="ml-auto" color={webhookReady ? "success" : "default"} variant="flat">{webhookReady ? "Webhook token set" : "Need verify token"}</Chip>
                </CardHeader>
                <CardBody className="gap-3 text-sm">
                    <div>
                        <div className="text-xs font-medium text-default-600 mb-1">OAuth redirect URI</div>
                        <div className="flex gap-2">
                            <Input size="sm" readOnly value={data.oauth_redirect_uri || ""} aria-label="OAuth redirect" classNames={{ input: "text-xs font-mono" }} />
                            <Button size="sm" variant="flat" isDisabled={!data.oauth_redirect_uri} onPress={() => copy(data.oauth_redirect_uri)}>Copy</Button>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-default-600 mb-1">Webhook callback URL</div>
                        <div className="flex gap-2">
                            <Input size="sm" readOnly value={data.webhook_url || ""} aria-label="Webhook URL" classNames={{ input: "text-xs font-mono" }} />
                            <Button size="sm" variant="flat" isDisabled={!data.webhook_url} onPress={() => copy(data.webhook_url)}>Copy</Button>
                        </div>
                    </div>
                    <ol className="list-decimal ml-5 text-default-500 space-y-1">
                        <li>Create a Business-type app at developers.facebook.com and add <b>Facebook Login for Business</b> + <b>Webhooks</b>.</li>
                        <li>Paste the OAuth redirect URI under Valid OAuth Redirect URIs.</li>
                        <li>Webhooks → Page object → paste the callback URL and verify token → subscribe to <b>leadgen</b>.</li>
                        <li>Save here, then test in an agency panel: Lead Sources → Connect Facebook Pages.</li>
                    </ol>
                    <p className="text-xs text-default-400">{data.docs}</p>
                </CardBody>
            </Card>

            <div className="flex justify-end">
                <Button color="primary" isLoading={saving} onPress={save} isDisabled={!form.app_id.trim() && !data.env_locked?.app_id}>
                    Save Meta settings
                </Button>
            </div>
        </div>
    );
};

export default SaasMetaSettings;
