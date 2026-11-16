import React, { useMemo, useState } from "react";
import { Input, Button, Chip, Select, SelectItem } from "@heroui/react";
import axios from "axios";
import { getAuthToken } from "@/utils/localstorage";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Image as ImageIcon, Upload } from "lucide-react";

const TARGETS = [
  { label: "Health Insurance", value: "health_ins" },
  { label: "International SIM Card", value: "sim_card" },
  { label: "Jobs (Career section)", value: "career" },
  { label: "Visa and Consultation", value: "visa_consultation" },
];

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

/** Local datetime-local value from a Date. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Create a banner campaign with schedule + one creative; shows on student portal while live. */
const AddSideBanner = () => {
  const navigate = useNavigate();

  const defaults = useMemo(() => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 0, 0);
    return { start: toLocalInput(start), end: toLocalInput(end) };
  }, []);

  const [target, setTarget] = useState(TARGETS[0].value);
  const [startAt, setStartAt] = useState(defaults.start);
  const [endAt, setEndAt] = useState(defaults.end);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setImage(null);
      setPreview(null);
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !image || !startAt || !endAt) {
      ErrorToast("Title, banner image and schedule are required");
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      ErrorToast("End must be after start");
      return;
    }

    setSaving(true);
    const body = new FormData();
    body.append("campaign_title", title.trim());
    body.append("target_type", target);
    body.append("start_date", new Date(startAt).toISOString());
    body.append("end_date", new Date(endAt).toISOString());
    body.append("position", "1");
    body.append("image", image);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/v1/side_banner/assign_slots`,
        body,
        { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${getAuthToken()}` } },
      );
      if (response.data.success) {
        SuccessToast("Campaign created — it will show on the student portal during the schedule");
        navigate("/side_banner/current");
      } else {
        ErrorToast(response.data.message || "Could not create campaign");
      }
    } catch (err: any) {
      ErrorToast(err?.response?.data?.message || "Could not create campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-2xl">
      <div className="flex items-start gap-3">
        <Button isIconOnly size="sm" variant="flat" aria-label="Back" onPress={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Create banner campaign</h1>
          <p className="text-sm text-default-500">
            Upload one creative and set when it should show. Students see active banners in the page hero (slider if several).
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-5 flex flex-col gap-5">
        <Field label="Where it shows" required>
          <Select
            {...controlProps}
            aria-label="Where it shows"
            selectedKeys={[target]}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0];
              if (v) setTarget(String(v));
            }}
          >
            {TARGETS.map((t) => (
              <SelectItem key={t.value}>{t.label}</SelectItem>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
          <Field label="Start" required>
            <Input
              {...controlProps}
              type="datetime-local"
              aria-label="Start"
              value={startAt}
              onValueChange={setStartAt}
            />
          </Field>
          <Field label="End" required>
            <Input
              {...controlProps}
              type="datetime-local"
              aria-label="End"
              value={endAt}
              onValueChange={setEndAt}
            />
          </Field>
        </div>

        <Field label="Campaign title" required>
          <Input
            {...controlProps}
            aria-label="Campaign title"
            placeholder="e.g. Summer health insurance offer"
            value={title}
            onValueChange={setTitle}
          />
        </Field>

        <Field label="Banner creative" required>
          <p className="text-xs text-default-500 -mt-0.5 mb-0.5">
            One image per campaign (JPG, PNG or WEBP). Multiple live campaigns for the same page appear as a hero slider.
          </p>
          <input id="banner-image" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={onImage} />
          <label
            htmlFor="banner-image"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-default-300 bg-default-50 px-4 py-8 cursor-pointer hover:bg-default-100"
          >
            {preview ? (
              <>
                <img src={preview} alt="" className="max-h-56 w-full object-contain rounded-md" />
                <span className="text-xs text-default-500">Click to change image</span>
              </>
            ) : (
              <>
                <Upload size={28} className="text-default-400" />
                <span className="text-sm font-medium text-default-700">Upload banner image</span>
                <span className="text-xs text-default-500">JPG, PNG or WEBP</span>
              </>
            )}
          </label>
          {image && (
            <div className="flex items-center gap-2 text-xs text-default-500">
              <ImageIcon size={14} />
              <span className="truncate">{image.name}</span>
              <Chip size="sm" variant="flat">{(image.size / 1024 / 1024).toFixed(2)} MB</Chip>
            </div>
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-default-100">
          <Button variant="flat" onPress={() => navigate(-1)}>Cancel</Button>
          <Button
            type="submit"
            color="primary"
            isLoading={saving}
            isDisabled={!title.trim() || !image}
            startContent={!saving ? <CheckCircle size={16} /> : undefined}
          >
            Create campaign
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddSideBanner;
