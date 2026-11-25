import { useMemo, useState } from "react";
import { Button, Checkbox, CheckboxGroup, Input, Radio, RadioGroup, Spinner, Textarea } from "@nextui-org/react";
import axios from "axios";
import { ErrorToast } from "@/utils/Toaster";

export type FormFieldDef = {
    id: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    help?: string;
};

type Props = {
    form: {
        name: string;
        description?: string;
        fields: FormFieldDef[];
        settings?: { thank_you_message?: string; collect_contact?: boolean };
        agency?: { name?: string; primary_color?: string };
    };
    /** POST path after /v1/ e.g. public/forms/TOKEN or student/forms/ASSIGNMENT/submit */
    submitUrl: string;
    /** Bearer token for portal submits; omit for public */
    authToken?: string | null;
    onDone?: (message: string) => void;
};

const FormFill = ({ form, submitUrl, authToken, onDone }: Props) => {
    const [values, setValues] = useState<Record<string, any>>({});
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [contact, setContact] = useState({ name: "", email: "", phone: "" });
    const [saving, setSaving] = useState(false);
    const [doneMsg, setDoneMsg] = useState<string | null>(null);
    const brand = form.agency?.primary_color || "#0f5bd8";

    const collectContact = form.settings?.collect_contact !== false;
    const hasBuiltInContact = useMemo(
        () => (form.fields || []).some((f) => f.type === "email" || f.type === "phone" || /name/i.test(f.label)),
        [form.fields],
    );

    const setVal = (id: string, v: any) => setValues((prev) => ({ ...prev, [id]: v }));

    const submit = async () => {
        for (const f of form.fields || []) {
            const v = values[f.id];
            const file = files[f.id];
            if (!f.required) continue;
            if (f.type === "file") {
                if (!file) return ErrorToast(`Please upload: ${f.label}`);
            } else if (f.type === "multi_choice") {
                if (!Array.isArray(v) || !v.length) return ErrorToast(`Please fill: ${f.label}`);
            } else if (v == null || String(v).trim() === "") {
                return ErrorToast(`Please fill: ${f.label}`);
            }
        }
        if (collectContact && !hasBuiltInContact) {
            if (!contact.email.trim() && !contact.phone.trim()) {
                return ErrorToast("Please enter your email or phone");
            }
        }

        setSaving(true);
        try {
            const fd = new FormData();
            const answers: Record<string, any> = { ...values };
            for (const [id, file] of Object.entries(files)) {
                if (file) fd.append(`file_${id}`, file);
            }
            fd.append("answers", JSON.stringify(answers));
            if (contact.name) fd.append("contact_name", contact.name);
            if (contact.email) fd.append("contact_email", contact.email);
            if (contact.phone) fd.append("contact_phone", contact.phone);

            const base = import.meta.env.VITE_API_BASE_URL as string;
            const headers: Record<string, string> = {};
            if (authToken) headers.Authorization = `Bearer ${authToken}`;

            const res = await axios.post(`${base}/v1/${submitUrl}`, fd, { headers });
            if (res?.data?.success) {
                const msg = res.data?.data?.thank_you_message || form.settings?.thank_you_message || "Thank you!";
                setDoneMsg(msg);
                onDone?.(msg);
            } else {
                ErrorToast(res?.data?.message || "Could not submit");
            }
        } catch (e: any) {
            ErrorToast(e?.response?.data?.message || e?.message || "Could not submit");
        }
        setSaving(false);
    };

    if (doneMsg) {
        return (
            <div className="rounded-2xl border border-default-200 bg-content1 p-6 text-center">
                <div className="text-lg font-semibold mb-2">Submitted</div>
                <p className="text-default-600 whitespace-pre-wrap">{doneMsg}</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-default-200 bg-content1 p-4 sm:p-6 flex flex-col gap-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: brand }}>{form.name}</h1>
                {form.agency?.name && <div className="text-sm text-default-500 mt-1">{form.agency.name}</div>}
                {form.description && <p className="text-sm text-default-600 mt-2 whitespace-pre-wrap">{form.description}</p>}
            </div>

            {collectContact && !hasBuiltInContact && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="Your name" value={contact.name} onValueChange={(v) => setContact({ ...contact, name: v })} />
                    <Input label="Email" type="email" value={contact.email} onValueChange={(v) => setContact({ ...contact, email: v })} />
                    <Input label="Phone" value={contact.phone} onValueChange={(v) => setContact({ ...contact, phone: v })} />
                </div>
            )}

            {(form.fields || []).map((f) => (
                <div key={f.id} className="flex flex-col gap-1">
                    <div className="text-sm font-medium">
                        {f.label}{f.required ? " *" : ""}
                    </div>
                    {f.help && <div className="text-xs text-default-500">{f.help}</div>}
                    {f.type === "long_text" && (
                        <Textarea minRows={3} value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)} />
                    )}
                    {f.type === "short_text" && (
                        <Input value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)} />
                    )}
                    {f.type === "email" && (
                        <Input type="email" value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)} />
                    )}
                    {f.type === "phone" && (
                        <Input type="tel" value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)} />
                    )}
                    {f.type === "number" && (
                        <Input type="number" value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)} />
                    )}
                    {f.type === "date" && (
                        <Input type="date" value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)} />
                    )}
                    {f.type === "yes_no" && (
                        <RadioGroup orientation="horizontal" value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)}>
                            <Radio value="Yes">Yes</Radio>
                            <Radio value="No">No</Radio>
                        </RadioGroup>
                    )}
                    {f.type === "single_choice" && (
                        <RadioGroup value={values[f.id] || ""} onValueChange={(v) => setVal(f.id, v)}>
                            {(f.options || []).map((o) => <Radio key={o} value={o}>{o}</Radio>)}
                        </RadioGroup>
                    )}
                    {f.type === "multi_choice" && (
                        <CheckboxGroup value={values[f.id] || []} onValueChange={(v) => setVal(f.id, v)}>
                            {(f.options || []).map((o) => <Checkbox key={o} value={o}>{o}</Checkbox>)}
                        </CheckboxGroup>
                    )}
                    {f.type === "file" && (
                        <input
                            type="file"
                            className="text-sm"
                            onChange={(e) => setFiles((prev) => ({ ...prev, [f.id]: e.target.files?.[0] || null }))}
                        />
                    )}
                </div>
            ))}

            <Button color="primary" className="self-start" style={{ background: brand }} isLoading={saving} onPress={submit}>
                Submit
            </Button>
        </div>
    );
};

export const FormFillLoading = () => (
    <div className="flex justify-center p-10"><Spinner /></div>
);

export default FormFill;
