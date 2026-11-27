import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Chip, Input } from "@heroui/react";
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Store, Unplug } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { PageSkeleton } from "@/components/ui-kit/Skeletons";

/** Owner: connect the agency's own Razorpay account for student payments (services store and fee payment links). */
const PaymentSettings = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [keyId, setKeyId] = useState("");
    const [secret, setSecret] = useState("");
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState("");

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/payment_settings");
        if (success) { setData(data); setKeyId(data.razorpay_key_id || ""); setSecret(""); }
    }, []);
    useEffect(() => { load(); }, [load]);
    if (!data) return <PageSkeleton />;

    const save = async () => {
        setBusy("save");
        const { success } = await commonPostAPICall({ razorpay_key_id: keyId.trim(), razorpay_key_secret: secret.trim() || undefined }, "crm/payment_settings", true);
        setBusy("");
        if (success) load();
    };
    const disconnect = async () => {
        if (!window.confirm("Disconnect Razorpay? Students won't be able to pay online until you connect it again.")) return;
        setBusy("remove");
        const { success } = await commonPostAPICall({ remove: true }, "crm/payment_settings", true);
        setBusy("");
        if (success) load();
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-3xl">
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Payments</h1>
                <p className="text-sm text-default-500">Connect Razorpay so student payments go straight to your bank — the CRM never holds funds</p>
            </div>

            <Card shadow="sm">
                <CardHeader className="flex items-center gap-3">
                    <KeyRound size={18} className="text-default-500 shrink-0" />
                    <div className="min-w-0 flex-1"><div className="font-semibold">Razorpay</div><div className="text-xs text-default-500">Used by the services store and fee payment links</div></div>
                    {data.connected
                        ? <Chip color="success" variant="flat" startContent={<CheckCircle2 size={14} />}>Connected · {data.mode === "live" ? "Live" : "Test mode"}</Chip>
                        : <Chip color="warning" variant="flat">Not connected</Chip>}
                </CardHeader>
                <CardBody className="gap-4 pt-0">
                    {data.mode === "test" && <div className="rounded-lg bg-warning-50 text-warning-800 text-sm px-3 py-2">Test keys are connected: payments are not real. Switch to your live keys (rzp_live_...) before students pay.</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-default-600">Key ID</span>
                            <Input aria-label="Razorpay Key ID" placeholder="rzp_live_XXXXXXXXXXXX" value={keyId} onValueChange={setKeyId} isDisabled={!data.can_edit} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-default-600">Key Secret</span>
                            <Input aria-label="Razorpay Key Secret" type={show ? "text" : "password"} placeholder={data.razorpay_secret_masked ? `Saved (${data.razorpay_secret_masked}) - leave empty to keep` : "Paste your Key Secret"}
                                value={secret} onValueChange={setSecret} isDisabled={!data.can_edit}
                                endContent={<button type="button" aria-label={show ? "Hide" : "Show"} className="text-default-400" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
                        </div>
                    </div>
                    {data.can_edit ? (
                        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                            <Button color="primary" className="w-full sm:w-auto" isLoading={busy === "save"} isDisabled={!keyId.trim()} startContent={<ShieldCheck size={16} />} onPress={save}>{data.connected ? "Check & save" : "Check & connect"}</Button>
                            {data.connected && <Button variant="flat" color="danger" className="w-full sm:w-auto" isLoading={busy === "remove"} startContent={<Unplug size={16} />} onPress={disconnect}>Disconnect</Button>}
                        </div>
                    ) : <div className="text-sm text-default-500">Only the agency owner can change these keys.</div>}
                    <div className="text-xs text-default-500 flex items-start gap-1.5"><ShieldCheck size={14} className="shrink-0 mt-0.5" />The keys are checked with Razorpay before saving and stored encrypted. The secret is never shown again.</div>
                </CardBody>
            </Card>

            <Card shadow="sm">
                <CardHeader className="font-semibold">Where to find your keys</CardHeader>
                <CardBody className="pt-0 text-sm text-default-700">
                    <ol className="list-decimal pl-5 flex flex-col gap-1.5">
                        <li>Sign in to the <a className="text-primary inline-flex items-center gap-0.5" href="https://dashboard.razorpay.com/app/website-app-settings/api-keys" target="_blank" rel="noopener">Razorpay Dashboard <ExternalLink size={12} /></a> (create a free account if you don't have one).</li>
                        <li>Open <b>Account & Settings → API Keys</b> and choose <b>Generate Key</b>.</li>
                        <li>Copy the <b>Key ID</b> and <b>Key Secret</b> and paste them above.</li>
                        <li>Use test keys first to try a payment, then switch to live keys once Razorpay has activated your account.</li>
                    </ol>
                </CardBody>
            </Card>

            <Card shadow="sm" className="bg-default-50">
                <CardBody className="flex flex-row flex-wrap items-center gap-3">
                    <Store size={20} className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1 text-sm"><div className="font-medium">Next: add your services</div><div className="text-default-500">Coaching, SOP writing, visa file charges ... with prices students can pay online.</div></div>
                    <Button size="sm" variant="flat" color="primary" className="w-full sm:w-auto" onPress={() => navigate("/services")}>Open Services store</Button>
                    <Button size="sm" variant="light" className="w-full sm:w-auto" onPress={() => navigate("/fees")}>Client fees</Button>
                </CardBody>
            </Card>
        </div>
    );
};

export default PaymentSettings;
