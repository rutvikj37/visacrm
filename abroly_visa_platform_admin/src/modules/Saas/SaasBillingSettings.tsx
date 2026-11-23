import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Spinner, Switch, Textarea } from "@nextui-org/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { FormField } from "./saasShared";
import TravelTaxCard from "./TravelTaxCard";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";

/** Platform (seller) details printed on every subscription invoice. */
const SaasBillingSettings = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [form, setForm] = useState<any>(null);
    const [states, setStates] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/saas_admin/billing_settings");
            if (success) {
                const { states: s, ...rest } = data;
                setStates(s || {});
                setForm(rest);
            }
        })();
    }, []);

    if (!form) return <div className="p-10 flex justify-center"><Spinner /></div>;
    const set = (k: string) => (v: any) => setForm({ ...form, [k]: v });
    const save = async () => {
        setSaving(true);
        await commonPostAPICall(form, "/saas_admin/billing_settings", true);
        setSaving(false);
    };
    const gstinState = /^[0-9]{2}/.test(form.gstin || "") ? String(form.gstin).slice(0, 2) : "";

    return (
        <div className="flex flex-col gap-4 p-2 max-w-3xl">
            <div>
                <h1 className="text-2xl font-semibold">Billing settings</h1>
                <p className="text-sm text-default-500">Your company details on the GST invoices agencies get for their subscription. Changes apply to new invoices only.</p>
            </div>
            <Card shadow="sm">
                <CardHeader className="font-semibold">Your company</CardHeader>
                <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Legal name *"><Input aria-label="Legal name" value={form.legal_name} onValueChange={set("legal_name")} /></FormField>
                    <FormField label="GSTIN"><Input aria-label="GSTIN" placeholder="24ABCDE1234F1Z5" value={form.gstin} onValueChange={(v) => set("gstin")(v.toUpperCase())} /></FormField>
                    <FormField label="State (place of business)">
                        <Select aria-label="State" isDisabled={Boolean(gstinState)} selectedKeys={gstinState || form.state_code ? [gstinState || form.state_code] : []} onChange={(e) => set("state_code")(e.target.value)}>
                            {Object.entries(states).map(([code, name]) => <SelectItem key={code}>{`${name} (${code})`}</SelectItem>)}
                        </Select>
                    </FormField>
                    <FormField label="SAC code"><Input aria-label="SAC code" value={form.sac_code} onValueChange={set("sac_code")} description="998315 = IT infrastructure / hosting services" /></FormField>
                    <FormField label="Address" className="sm:col-span-2"><Textarea aria-label="Address" minRows={2} value={form.address} onValueChange={set("address")} /></FormField>
                    <FormField label="Billing email"><Input aria-label="Billing email" value={form.email} onValueChange={set("email")} /></FormField>
                    <FormField label="Phone"><Input aria-label="Phone" value={form.phone} {...phoneInputProps} onValueChange={(v) => set("phone")(toPhoneDigits(v))} /></FormField>
                </CardBody>
            </Card>
            <Card shadow="sm">
                <CardHeader className="font-semibold">Tax and numbering</CardHeader>
                <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="GST %"><Input aria-label="GST %" type="number" value={String(form.gst_percent)} onValueChange={(v) => set("gst_percent")(v)} /></FormField>
                    <FormField label="Invoice prefix"><Input aria-label="Invoice prefix" maxLength={5} value={form.invoice_prefix} onValueChange={(v) => set("invoice_prefix")(v.toUpperCase())} description={`Numbers look like ${form.invoice_prefix || "INV"}/26-27/0001 and restart every April.`} /></FormField>
                    <div className="sm:col-span-2 flex items-start gap-3 rounded-lg bg-default-100 p-3">
                        <Switch aria-label="Plan prices include GST" isSelected={Boolean(form.prices_include_gst)} onValueChange={set("prices_include_gst")} />
                        <div className="text-sm">
                            <div className="font-medium">Plan prices include GST</div>
                            <div className="text-default-500">{form.prices_include_gst ? "Agencies pay the plan price; the invoice shows the GST inside it." : `GST (${form.gst_percent || 0}%) is added on top of the plan price at checkout.`}</div>
                        </div>
                    </div>
                    <FormField label="Note printed on invoices" className="sm:col-span-2"><Textarea aria-label="Invoice note" minRows={2} value={form.terms} onValueChange={set("terms")} /></FormField>
                </CardBody>
            </Card>
            <div className="flex justify-end"><Button color="primary" isLoading={saving} onPress={save}>Save settings</Button></div>
            <TravelTaxCard />
        </div>
    );
};

export default SaasBillingSettings;
