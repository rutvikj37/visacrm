import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, Progress } from "@heroui/react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, FlaskConical, Rocket, X } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { TUTORIAL_ENABLED, useOnboarding } from "./onboardingStore";

/** Owner's "Get started" card on Today: steps worked out from real data, plus demo leads to try things on. */
const SetupChecklist = ({ onChanged }: { onChanged?: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const { data, reload } = useOnboarding(commonGetAPICalls);
    const [busy, setBusy] = useState("");
    const [folded, setFolded] = useState(false);

    if (!TUTORIAL_ENABLED || !data?.owner || !data.show) return null;
    const allDone = data.done === data.total;
    if (allDone && !data.sample_loaded) return null;

    const post = async (key: string, body: any, url: string) => {
        setBusy(key);
        const { success } = await commonPostAPICall(body, url, true);
        setBusy("");
        if (success) { await reload(); onChanged?.(); }
    };
    const next = data.steps.find((s: any) => !s.done);

    return (
        <Card shadow="sm" className="border border-primary-100">
            <CardBody className="gap-3">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary-50 text-primary shrink-0"><Rocket size={20} /></div>
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold">{allDone ? "You are all set up" : "Get your agency set up"}</div>
                        <div className="text-sm text-default-500">{data.done} of {data.total} done{next ? ` · next: ${next.title.toLowerCase()}` : ""}</div>
                        <Progress aria-label="Setup progress" size="sm" color="primary" className="mt-2 max-w-md" value={(data.done / data.total) * 100} />
                    </div>
                    <Button isIconOnly size="sm" variant="light" aria-label={folded ? "Show steps" : "Hide steps"} onPress={() => setFolded(!folded)}>{folded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</Button>
                    <Button isIconOnly size="sm" variant="light" aria-label="Hide checklist" isLoading={busy === "hide"} onPress={() => post("hide", { hidden: true }, "crm/onboarding/hide")}><X size={16} /></Button>
                </div>

                {!folded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.steps.map((s: any) => (
                            <div key={s.key} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${s.done ? "bg-default-50" : "bg-content1 border border-default-200"}`}>
                                {s.done ? <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" /> : <Circle size={18} className="text-default-300 shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1">
                                    <div className={`text-sm font-medium ${s.done ? "text-default-500 line-through" : ""}`}>{s.title}</div>
                                    {!s.done && <div className="text-xs text-default-500">{s.text}</div>}
                                </div>
                                {!s.done && <Button size="sm" variant="flat" color="primary" className="shrink-0" onPress={() => navigate(s.link)}>{s.action}</Button>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-default-50 px-3 py-2 text-sm">
                    <FlaskConical size={16} className="text-default-500 shrink-0" />
                    <span className="text-default-600 min-w-0 flex-1">
                        {data.sample_loaded ? "Sample leads are in your Lead Inbox (marked \"sample\"). Remove them before you go live." : "Want to look around first? Add 8 sample leads to try the inbox, follow-ups and reports. Nobody is messaged."}
                    </span>
                    {data.sample_loaded
                        ? <Button size="sm" variant="flat" color="danger" isLoading={busy === "sample"} onPress={() => post("sample", { action: "clear" }, "crm/sample_data")}>Remove sample data</Button>
                        : <Button size="sm" variant="flat" color="secondary" isLoading={busy === "sample"} onPress={() => post("sample", { action: "load" }, "crm/sample_data")}>Add sample leads</Button>}
                </div>
            </CardBody>
        </Card>
    );
};

export default SetupChecklist;
