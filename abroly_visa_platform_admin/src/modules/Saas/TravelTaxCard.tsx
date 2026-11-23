import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Switch } from "@nextui-org/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { FormField } from "./saasShared";

/**
 * Travel CRM tax rates used by every travel agency's quotes and invoices.
 * Kept as settings because the TCS rate on overseas packages has changed several times.
 * Quotes and invoices keep the rate they were made with.
 */
const TravelTaxCard = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [form, setForm] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/saas_admin/travel_tax");
            if (success) setForm(data);
        })();
    }, []);
    if (!form) return null;
    const set = (k: string) => (v: any) => setForm({ ...form, [k]: v });
    const save = async () => {
        setSaving(true);
        const { success, data } = await commonPostAPICall(form, "saas_admin/travel_tax", true);
        setSaving(false);
        if (success && data) setForm(data);
    };
    return (
        <Card shadow="sm">
            <CardHeader className="flex flex-col items-start">
                <div className="font-semibold">Travel CRM tax rates</div>
                <div className="text-xs text-default-500">Defaults for new quotes and invoices of travel agencies. Confirm with a CA before changing.</div>
            </CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="GST % - full package value (tour operator)"><Input aria-label="GST full value" type="number" value={String(form.gst_full_value_percent)} onValueChange={set("gst_full_value_percent")} /></FormField>
                <FormField label="SAC - full package value"><Input aria-label="SAC full value" value={form.sac_full_value} onValueChange={set("sac_full_value")} /></FormField>
                <FormField label="GST % - on margin / service charge"><Input aria-label="GST margin" type="number" value={String(form.gst_margin_percent)} onValueChange={set("gst_margin_percent")} /></FormField>
                <FormField label="SAC - margin billing"><Input aria-label="SAC margin" value={form.sac_margin} onValueChange={set("sac_margin")} /></FormField>
                <FormField label="TCS % on overseas tour packages"><Input aria-label="TCS overseas" type="number" value={String(form.tcs_overseas_percent)} onValueChange={set("tcs_overseas_percent")} /></FormField>
                <FormField label="TCS % when the traveller has no PAN"><Input aria-label="TCS no PAN" type="number" value={String(form.tcs_no_pan_percent)} onValueChange={set("tcs_no_pan_percent")} /></FormField>
                <div className="sm:col-span-2 flex items-center gap-3">
                    <Switch aria-label="TCS on amount including GST" isSelected={Boolean(form.tcs_on_gst)} onValueChange={set("tcs_on_gst")} />
                    <span className="text-sm">Work out TCS on the amount including GST</span>
                </div>
                <div className="sm:col-span-2 flex justify-end"><Button color="primary" isLoading={saving} onPress={save}>Save tax rates</Button></div>
            </CardBody>
        </Card>
    );
};

export default TravelTaxCard;
