import BackButton from '@/components/BackButton';
import { SuccessToast, ErrorToast } from '@/utils/Toaster';
import { Button, Checkbox, Input, Select, SelectItem } from "@heroui/react";
import { Briefcase, Plus, Edit, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react'
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

const controlProps = {
    variant: "bordered" as const,
    classNames: {
        inputWrapper: "bg-content1 border-default-200 shadow-none",
        trigger: "bg-content1 border-default-200 shadow-none",
        input: "bg-transparent",
    },
};

const Field = ({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) => (
    <div className="flex flex-col gap-1.5 min-w-0">
        <label className="text-sm font-medium text-default-700">
            {label}
            {required ? <span className="text-danger"> *</span> : null}
        </label>
        {children}
    </div>
);

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
                        {isEditMode ? "Update this opening" : "Create an opening for your student portal"}. Add custom fields if your agency needs extra details.
                    </p>
                </div>
            </div>

            <form className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-6 flex flex-col gap-6" onSubmit={handleSubmit}>
                <section className="flex flex-col gap-5">
                    <h2 className="text-sm font-semibold text-default-700">Basics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
                        <Field label="Job type">
                            <Select
                                {...controlProps}
                                aria-label="Job type"
                                selectedKeys={[formData.jobType]}
                                onSelectionChange={(keys) => {
                                    const v = Array.from(keys)[0];
                                    if (v) setField("jobType", String(v));
                                }}
                            >
                                {JOB_TYPES.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
                            </Select>
                        </Field>
                        <Field label="Work permit">
                            <Select
                                {...controlProps}
                                aria-label="Work permit"
                                selectedKeys={[formData.workPermit]}
                                onSelectionChange={(keys) => {
                                    const v = Array.from(keys)[0];
                                    if (v) setField("workPermit", String(v));
                                }}
                            >
                                {WORK_PERMITS.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
                            </Select>
                        </Field>
                        <Field label="Country" required>
                            <ReactFlagsSelect
                                selected={formData.country}
                                searchable
                                onSelect={(c) => setField("country", c)}
                                className="!pb-0 w-full [&_button]:!border [&_button]:!border-default-200 [&_button]:!rounded-xl [&_button]:!bg-content1 [&_button]:!shadow-none"
                            />
                        </Field>
                        <Field label="Job role" required>
                            <Input {...controlProps} aria-label="Job role" placeholder="e.g. Software engineer" value={formData.jobRole} onValueChange={(v) => setField("jobRole", v)} />
                        </Field>
                        <Field label="Salary min (INR / month)" required>
                            <Input {...controlProps} type="number" aria-label="Salary min" placeholder="e.g. 40000" value={String(formData.salaryMin)} onValueChange={(v) => setField("salaryMin", v)} />
                        </Field>
                        <Field label="Salary max (INR / month)" required>
                            <Input {...controlProps} type="number" aria-label="Salary max" placeholder="e.g. 60000" value={String(formData.salaryMax)} onValueChange={(v) => setField("salaryMax", v)} />
                        </Field>
                    </div>
                </section>

                <section className="flex flex-col gap-5">
                    <h2 className="text-sm font-semibold text-default-700">Requirements & benefits</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
                        <Field label="Experience (years)" required>
                            <Input {...controlProps} type="number" aria-label="Experience" placeholder="e.g. 2" value={String(formData.experienceRequired)} onValueChange={(v) => setField("experienceRequired", v)} />
                        </Field>
                        <Field label="Education level" required>
                            <Input {...controlProps} aria-label="Education level" placeholder="e.g. Bachelor's" value={formData.educationLevel} onValueChange={(v) => setField("educationLevel", v)} />
                        </Field>
                        <Field label="Food" required>
                            <Input {...controlProps} aria-label="Food" placeholder="e.g. Provided / Not provided" value={formData.food} onValueChange={(v) => setField("food", v)} />
                        </Field>
                        <Field label="Working hours / month" required>
                            <Input {...controlProps} aria-label="Working hours" placeholder="e.g. 160" value={formData.workHours} onValueChange={(v) => setField("workHours", v)} />
                        </Field>
                        <Field label="Agent charges" required>
                            <Input {...controlProps} aria-label="Agent charges" placeholder="e.g. Nil / 10% of salary" value={formData.agentCharges} onValueChange={(v) => setField("agentCharges", v)} />
                        </Field>
                        <Field label="Skills required">
                            <Input {...controlProps} aria-label="Skills required" placeholder="Communication, Excel…" value={formData.skillsRequired} onValueChange={(v) => setField("skillsRequired", v)} />
                        </Field>
                        <Field label="Application deadline" required>
                            <Input {...controlProps} type="date" aria-label="Application deadline" value={formData.applicationDeadline} onValueChange={(v) => setField("applicationDeadline", v)} />
                        </Field>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-3 rounded-xl border border-default-200 bg-default-50 px-4 py-3">
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
                </section>

                <section className="rounded-xl border border-default-200 p-4 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-medium flex items-center gap-2 text-sm"><Briefcase size={16} /> Custom fields</div>
                            <p className="text-xs text-default-500 mt-0.5">Optional extras for this job (language, shift, city, etc.).</p>
                        </div>
                        <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={addCustomField}>Add field</Button>
                    </div>
                    {!customFields.length && (
                        <p className="text-sm text-default-400 py-2">No custom fields yet.</p>
                    )}
                    {customFields.map((f) => (
                        <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-x-3 gap-y-4 items-end">
                            <Field label="Field name">
                                <Input
                                    {...controlProps}
                                    size="sm"
                                    aria-label="Field name"
                                    placeholder="e.g. Preferred language"
                                    value={f.label}
                                    onValueChange={(v) => updateCustomField(f.id, { label: v })}
                                />
                            </Field>
                            <Field label="Value">
                                <Input
                                    {...controlProps}
                                    size="sm"
                                    aria-label="Field value"
                                    placeholder="e.g. English / Hindi"
                                    value={f.value}
                                    onValueChange={(v) => updateCustomField(f.id, { value: v })}
                                />
                            </Field>
                            <Button isIconOnly size="sm" variant="light" color="danger" className="mb-0.5" aria-label="Remove field" onPress={() => removeCustomField(f.id)}>
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    ))}
                </section>

                <section className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-default-700">Description</label>
                    <div className="rounded-xl border border-default-200 overflow-hidden [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-default-200 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[140px]">
                        <ReactQuill theme="snow" value={formData.description} onChange={(v) => setField("description", v)} />
                    </div>
                </section>

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
