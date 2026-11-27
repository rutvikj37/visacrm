import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

/** Owner two-step login (authenticator app): set up, turn on, turn off. */
export const TwoStepCard = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [status, setStatus] = useState<any>(null);
    const [setup, setSetup] = useState<any>(null);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const load = async () => { const { success, data } = await commonGetAPICalls("/crm/security/totp"); if (success) setStatus(data); };
    useEffect(() => { load(); }, []);
    if (!status?.available) return null;
    const run = async (url: string, body: any = {}) => {
        setBusy(true);
        const r = await commonPostAPICall(body, url, true);
        setBusy(false);
        return r;
    };
    return (
        <Card shadow="sm"><CardHeader className="font-semibold gap-2"><ShieldCheck size={18} /> Two-step login {status.enabled ? <span className="text-xs font-normal text-success">On</span> : <span className="text-xs font-normal text-default-500">Off</span>}</CardHeader><CardBody className="gap-3">
            {status.enabled ? (<>
                <p className="text-sm text-default-600">After your passcode we ask for the 6-digit code from your authenticator app. To turn it off, enter the current code.</p>
                <div className="flex gap-2 max-w-sm"><Input aria-label="Current code" placeholder="123456" maxLength={6} value={code} onValueChange={(v) => setCode(v.replace(/\D/g, ""))} /><Button variant="flat" color="danger" isLoading={busy} onPress={async () => { const r = await run("crm/security/totp/disable", { code }); if (r.success) { setCode(""); load(); } }}>Turn off</Button></div>
            </>) : setup ? (<>
                <ol className="text-sm text-default-600 list-decimal pl-5 flex flex-col gap-1">
                    <li>Open Google Authenticator, Microsoft Authenticator or Authy and add an account.</li>
                    <li>Choose “Enter a setup key” and type this key: <code className="font-mono bg-default-100 px-1 rounded select-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code> (time based). On this phone you can also <a className="text-primary underline" href={setup.uri}>open it in the app</a>.</li>
                    <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <div className="flex gap-2 max-w-sm"><Input aria-label="Code from app" placeholder="123456" maxLength={6} value={code} onValueChange={(v) => setCode(v.replace(/\D/g, ""))} /><Button color="primary" isLoading={busy} onPress={async () => { const r = await run("crm/security/totp/enable", { code }); if (r.success) { setSetup(null); setCode(""); load(); } }}>Turn on</Button></div>
            </>) : (<>
                <p className="text-sm text-default-600">Protect the owner account: even with your passcode, nobody can log in without the code on your phone.</p>
                <div><Button color="primary" variant="flat" isLoading={busy} onPress={async () => { const r = await run("crm/security/totp/setup"); if (r.success) setSetup(r.data); }}>Set up two-step login</Button></div>
            </>)}
        </CardBody></Card>
    );
};


export default TwoStepCard;
