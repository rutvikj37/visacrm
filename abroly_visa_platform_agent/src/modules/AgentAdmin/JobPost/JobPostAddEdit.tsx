import BackButton from '@/components/BackButton';
import { SuccessToast, ErrorToast } from '@/utils/Toaster';
import { Button, Checkbox, Input, Select, SelectItem } from "@heroui/react";
import { Briefcase, Plus, Edit, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import ReactFlagsSelect from 'react-flags-select';

const JOB_TYPES = ["Full-time", "Part-time", "Temporary/Contract", "Internship"];
const WORK_PERMITS = ["Employment Visa (ECR)", "Employment Visa (ECNR)"];

type CustomField = { id: string; label: string; value: string };

const toDateInput = (v: any) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyForm = {
    jobType: "Full-time",
    country: "",
    jobRole: "",
    salaryMin: "",
    salaryMax: "",
    experienceRequired: "",
    educationLevel: "",
    workPermit: "Employment Visa (ECR)",
    overtime: false,
    accommodation: false,
    transportation: false,
    food: "",
    medicalInsurance: false,
    workHours: "",
    agentCharges: "",
    skillsRequired: "",
    applicationDeadline: "",
    description: "",
    uuid: "",
};

/** Create or edit a job post, including agency-defined custom fields. */
const JobPostAddEdit = () => {
    const { commonPostAPICall } = useApiCallUtils();
    const navigate = useNavigate();
    const { state }: any = useLocation();
    const [params] = useSearchParams();
    const seed = state?.jobPost;
    const uuidFromQuery = params.get("uuid") || "";

    const [formData, setFormData] = useState({ ...emptyForm });
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    const hydrate = (jobPost: any) => {
        if (!jobPost) return;
        setFormData({
            jobType: jobPost.jobType || "Full-time",
            country: jobPost.country || "",
            jobRole: jobPost.jobRole || "",
            salaryMin: jobPost.salaryMin ?? "",
            salaryMax: jobPost.salaryMax ?? "",
            experienceRequired: jobPost.experienceRequired ?? "",
            educationLevel: jobPost.educationLevel || "",
            workPermit: jobPost.workPermit || "Employment Visa (ECR)",
            overtime: !!jobPost.overtime,
            accommodation: !!jobPost.accommodation,
            transportation: !!jobPost.transportation,
            food: jobPost.food || "",
            medicalInsurance: !!jobPost.medicalInsurance,
            workHours: jobPost.workHours || "",
            agentCharges: jobPost.agentCharges || "",
            skillsRequired: jobPost.skillsRequired || "",
            applicationDeadline: toDateInput(jobPost.applicationDeadline),
            description: jobPost.description || "",
            uuid: jobPost.uuid || "",
        });
        const fields = Array.isArray(jobPost.custom_fields) ? jobPost.custom_fields : [];
        setCustomFields(fields.map((f: any, i: number) => ({
            id: String(f.id || `cf_${i}`),
            label: String(f.label || ""),
            value: String(f.value ?? ""),
        })));
    };

    useEffect(() => {
        if (seed?.uuid) {
            hydrate(seed);
            return;
        }
        const uuid = uuidFromQuery;
        if (!uuid) return;
        (async () => {
            setLoading(true);
            const { success, data } = await commonPostAPICall({ uuid }, "job_post/details", false);
            setLoading(false);
            if (success && data) hydrate(data);
            else ErrorToast("Could not load job post");
        })();
    }, []);

    const isEditMode = !!formData.uuid;

    const setField = (name: string, value: any) => setFormData((prev) => ({ ...prev, [name]: value }));

    const addCustomField = () => {
        setCustomFields((prev) => [...prev, { id: `cf_${Date.now()}_${prev.length}`, label: "", value: "" }]);
    };
    const updateCustomField = (id: string, patch: Partial<CustomField>) => {
        setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    };
    const removeCustomField = (id: string) => {
        setCustomFields((prev) => prev.filter((f) => f.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.country || !formData.jobRole) {
            ErrorToast("Country and job role are required");
            return;
        }
        setSaving(true);
        const payload = {
            ...formData,
            salaryMin: Number(formData.salaryMin),
            salaryMax: Number(formData.salaryMax),
            experienceRequired: Number(formData.experienceRequired),
            custom_fields: customFields.filter((f) => f.label.trim()),
        };
        const { success } = await commonPostAPICall(
            payload,
            isEditMode ? "job_post/update" : "job_post/create",
            true,
        );
        setSaving(false);
        if (success) {
            SuccessToast(isEditMode ? "Job post updated" : "Job post created");
            navigate("/job_post/find/active");
        }
    };

    const fieldClass = useMemo(() => ({
        inputWrapper: "border-default-300",
        label: "text-sm font-medium text-default-700",
    }), []);

    if (loading) {
        return <div className="p-8 text-sm text-default-500">Loading job post…</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <div className="flex items-start gap-3">
                <BackButton title="" />
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold">{isEditMode ? "Edit job post" : "Add job post"}</h1>
                    <p className="text-sm text-default-500">
                        {isEditMode ? "Update this opening" : "Create an opening for your student portal"} — add custom fields your agency needs.
                    </p>
                </div>
            </div>

            <form className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-6 flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                        label="Job type"
                        selectedKeys={[formData.jobType]}
                        onSelectionChange={(keys) => {
                            const v = Array.from(keys)[0];
                            if (v) setField("jobType", String(v));
                        }}
                    >
                        {JOB_TYPES.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
                    </Select>
                    <Select
                        label="Work permit"
                        selectedKeys={[formData.workPermit]}
                        onSelectionChange={(keys) => {
                            const v = Array.from(keys)[0];
                            if (v) setField("workPermit", String(v));
                        }}
                    >
                        {WORK_PERMITS.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
                    </Select>
                    <div>
                        <label className="block text-sm font-medium text-default-700 mb-1">Country</label>
                        <ReactFlagsSelect
                            selected={formData.country}
                            searchable
                            onSelect={(c) => setField("country", c)}
                        />
                    </div>
                    <Input label="Job role" value={formData.jobRole} onValueChange={(v) => setField("jobRole", v)} isRequired classNames={fieldClass} />
                    <Input type="number" label="Salary min (INR / month)" value={String(formData.salaryMin)} onValueChange={(v) => setField("salaryMin", v)} isRequired classNames={fieldClass} />
                    <Input type="number" label="Salary max (INR / month)" value={String(formData.salaryMax)} onValueChange={(v) => setField("salaryMax", v)} isRequired classNames={fieldClass} />
                    <Input type="number" label="Experience (years)" value={String(formData.experienceRequired)} onValueChange={(v) => setField("experienceRequired", v)} isRequired classNames={fieldClass} />
                    <Input label="Education level" value={formData.educationLevel} onValueChange={(v) => setField("educationLevel", v)} isRequired classNames={fieldClass} />
                    <Input label="Food" value={formData.food} onValueChange={(v) => setField("food", v)} isRequired classNames={fieldClass} />
                    <Input label="Working hours / month" value={formData.workHours} onValueChange={(v) => setField("workHours", v)} isRequired classNames={fieldClass} />
                    <Input label="Agent charges" value={formData.agentCharges} onValueChange={(v) => setField("agentCharges", v)} isRequired classNames={fieldClass} />
                    <Input label="Skills required" value={formData.skillsRequired} onValueChange={(v) => setField("skillsRequired", v)} placeholder="Communication, Excel…" classNames={fieldClass} />
                    <Input type="date" label="Application deadline" value={formData.applicationDeadline} onValueChange={(v) => setField("applicationDeadline", v)} isRequired classNames={fieldClass} />
                </div>

                <div className="flex flex-wrap gap-4 rounded-lg border border-default-200 bg-default-50 p-3">
                    {([
                        ["overtime", "Overtime"],
                        ["accommodation", "Accommodation"],
                        ["transportation", "Transportation"],
                        ["medicalInsurance", "Medical insurance"],
                    ] as const).map(([key, label]) => (
                        <Checkbox key={key} isSelected={!!formData[key]} onValueChange={(v) => setField(key, v)}>
                            {label}
                        </Checkbox>
                    ))}
                </div>

                <div className="rounded-lg border border-default-200 p-3 sm:p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <div className="font-medium flex items-center gap-2"><Briefcase size={16} /> Custom fields</div>
                            <p className="text-xs text-default-500">Add any extra details your agency needs for this job (e.g. language, shift, city).</p>
                        </div>
                        <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={addCustomField}>Add field</Button>
                    </div>
                    {!customFields.length && (
                        <p className="text-sm text-default-400">No custom fields yet.</p>
                    )}
                    {customFields.map((f) => (
                        <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                            <Input
                                size="sm"
                                label="Field name"
                                placeholder="e.g. Preferred language"
                                value={f.label}
                                onValueChange={(v) => updateCustomField(f.id, { label: v })}
                            />
                            <Input
                                size="sm"
                                label="Value"
                                placeholder="e.g. English / Hindi"
                                value={f.value}
                                onValueChange={(v) => updateCustomField(f.id, { value: v })}
                            />
                            <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Remove field" onPress={() => removeCustomField(f.id)}>
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Description</span>
                    <ReactQuill theme="snow" value={formData.description} onChange={(v) => setField("description", v)} className="bg-content1 rounded-lg" />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-default-100">
                    <Button variant="flat" onPress={() => navigate(-1)}>Cancel</Button>
                    <Button type="submit" color="primary" isLoading={saving} startContent={!saving && (isEditMode ? <Edit size={16} /> : <Plus size={16} />)}>
                        {isEditMode ? "Update job post" : "Create job post"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default JobPostAddEdit;
