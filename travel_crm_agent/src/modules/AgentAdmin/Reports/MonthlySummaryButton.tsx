import { useEffect, useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger, Switch } from "@heroui/react";
import { Mail } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

/** Owner: the monthly summary email (sent on the 1st) - on/off, and send last month's now. */
const MonthlySummaryButton = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [info, setInfo] = useState<any>(null);
    const [busy, setBusy] = useState("");
    const load = async () => {
        const { success, data } = await commonGetAPICalls("/crm/monthly_summary");
        if (success) setInfo(data);
    };
    useEffect(() => { load(); }, []);
    const act = async (action: string) => {
        setBusy(action);
        await commonPostAPICall({ action }, "crm/monthly_summary", true);
        setBusy("");
        if (action !== "send") load();
    };
    const s = info?.summary;
    return (
        <Popover placement="bottom-end">
            <PopoverTrigger><Button size="sm" variant="flat" startContent={<Mail size={14} />}>Monthly email</Button></PopoverTrigger>
            <PopoverContent className="p-3 w-80 items-stretch gap-3">
                <div>
                    <div className="font-semibold text-sm">Monthly summary email</div>
                    <div className="text-xs text-default-500">On the 1st of every month: last month's leads, conversions, visas and fees collected, in your agency's colours{info?.email ? `, to ${info.email}` : ""}.</div>
                </div>
                {s && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-default-100 p-2"><div className="text-default-500">Leads in {s.month_name}</div><div className="text-base font-semibold">{s.now.leads}</div></div>
                        <div className="rounded-lg bg-default-100 p-2"><div className="text-default-500">Converted</div><div className="text-base font-semibold">{s.now.converted} <span className="text-xs font-normal">({s.now.conversion_rate}%)</span></div></div>
                    </div>
                )}
                <Switch size="sm" isSelected={Boolean(info?.email_on)} isDisabled={!info || Boolean(busy)} onValueChange={(v) => act(v ? "on" : "off")}>Send it every month</Switch>
                <Button size="sm" variant="flat" color="primary" isLoading={busy === "send"} isDisabled={!info?.email} onPress={() => act("send")}>Send last month's summary now</Button>
                {info && !info.email && <div className="text-xs text-warning-700">Add an email address to your profile to get it.</div>}
            </PopoverContent>
        </Popover>
    );
};

export default MonthlySummaryButton;
