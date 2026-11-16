import React, { useEffect, useMemo, useState } from "react";
import { Input, Button, Spinner, Chip, Select, SelectItem } from "@heroui/react";
import axios from "axios";
import { getAuthToken } from "@/utils/localstorage";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Image as ImageIcon, Upload } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const TARGETS = [
  { label: "Health Insurance", value: "health_ins" },
  { label: "International SIM Card", value: "sim_card" },
  { label: "Jobs (Career section)", value: "career" },
  { label: "Visa and Consultation", value: "visa_consultation" },
];

/** Local datetime-local value from a Date. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Create a side-banner campaign with start/end date-time; shows on student portal only while live. */
const AddSideBanner = () => {
  const { commonPostAPICall } = useApiCallUtils();
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
  const [position, setPosition] = useState<"1" | "2" | "">("");
  const [availability, setAvailability] = useState<{ position_1: boolean; position_2: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checkAvailability = async () => {
    if (!startAt || !endAt) return;
    if (new Date(endAt) <= new Date(startAt)) {
      ErrorToast("End must be after start");
      setAvailability(null);
      setPosition("");
      return;
    }
    setChecking(true);
    const { success, data, message } = await commonPostAPICall(
      { target_type: target, start_date: new Date(startAt).toISOString(), end_date: new Date(endAt).toISOString() },
      "side_banner/get_avalible_slots",
      false,
    );
    setChecking(false);
    if (!success || !data?.[0]) {
      ErrorToast(message || "Could not check availability");
      setAvailability(null);
      setPosition("");
      return;
    }
    const slot = data[0];
    const next = {
      position_1: !!slot.position_1?.isAvailable,
      position_2: !!slot.position_2?.isAvailable,
    };
    setAvailability(next);
    if (next.position_1) setPosition("1");
    else if (next.position_2) setPosition("2");
    else setPosition("");
  };

  useEffect(() => {
    const t = setTimeout(checkAvailability, 250);
    return () => clearTimeout(t);
  }, [target, startAt, endAt]);

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
    if (!title.trim() || !image || !position || !startAt || !endAt) {
      ErrorToast("Title, image, schedule and an available position are required");
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
    body.append("position", position);
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
          <p className="text-sm text-default-500">Set when it should show — students only see it between start and end.</p>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-5 flex flex-col gap-4">
        <Select
          label="Where it shows"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="datetime-local"
            label="Start"
            value={startAt}
            onValueChange={setStartAt}
            isRequired
          />
          <Input
            type="datetime-local"
            label="End"
            value={endAt}
            onValueChange={setEndAt}
            isRequired
          />
        </div>

        <div className="rounded-lg border border-default-200 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Position for this time window</span>
            {checking && <Spinner size="sm" />}
          </div>
          {!availability ? (
            <p className="text-xs text-default-500">Checking availability…</p>
          ) : !availability.position_1 && !availability.position_2 ? (
            <p className="text-sm text-danger">Both positions are taken for this schedule. Change the times or target.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(["1", "2"] as const).map((p) => {
                const free = availability[`position_${p}` as "position_1" | "position_2"];
                return (
                  <Button
                    key={p}
                    size="sm"
                    variant={position === p ? "solid" : "flat"}
                    color={position === p ? "primary" : "default"}
                    isDisabled={!free}
                    onPress={() => setPosition(p)}
                  >
                    Position {p} {free ? "· free" : "· taken"}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <Input
          label="Campaign title"
          placeholder="e.g. Summer health insurance offer"
          value={title}
          onValueChange={setTitle}
          isRequired
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Banner image</span>
          <input id="banner-image" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={onImage} />
          <label
            htmlFor="banner-image"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-default-300 bg-default-50 px-4 py-6 cursor-pointer hover:bg-default-100"
          >
            {preview ? (
              <>
                <img src={preview} alt="" className="max-h-48 w-full object-contain rounded-md" />
                <span className="text-xs text-default-500">Click to change</span>
              </>
            ) : (
              <>
                <Upload size={22} className="text-default-400" />
                <span className="text-sm">Upload JPG, PNG or WEBP</span>
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
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-default-100">
          <Button variant="flat" onPress={() => navigate(-1)}>Cancel</Button>
          <Button
            type="submit"
            color="primary"
            isLoading={saving}
            isDisabled={!title.trim() || !image || !position || checking}
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
