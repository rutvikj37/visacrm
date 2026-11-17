import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Spinner, Tab, Tabs } from "@heroui/react";
import { ArrowLeft, FileText, History, IndianRupee, Inbox, MessageCircle, UserRound } from "lucide-react";
import EmptyState from "@/components/ui-kit/EmptyState";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { stageLabel } from "./caseShared";

const KINDS = [
    { key: "", label: "Everything" },
    { key: "case", label: "Case" },
    { key: "document", label: "Documents" },
    { key: "payment", label: "Money" },
    { key: "chat", label: "Chat" },
    { key: "lead", label: "Lead" },
];
const ICON: Record<string, any> = { lead: Inbox, case: UserRound, document: FileText, payment: IndianRupee, chat: MessageCircle };
const TONE: Record<string, string> = {
    lead: "bg-default-100 text-default-600", case: "bg-primary-50 text-primary", document: "bg-warning-50 text-warning-700",
    payment: "bg-success-50 text-success-700", chat: "bg-secondary-50 text-secondary",
};
const CASE_RESULT: Record<string, { label: string; color: any }> = {
    visa_completed: { label: "Approved", color: "success" }, visa_rejected: { label: "Rejected", color: "danger" },
    withdrawn: { label: "Withdrawn", color: "default" }, withdrawn_by_student: { label: "Withdrawn", color: "default" },
};

const dayLabel = (d: Date) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: that.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

/** Everything that happened with one student, in one place: lead, case, documents, money and chat. */
const StudentTimeline = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const kind = params.get("kind") || "";
    const { commonGetAPICalls } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const { success, data, message } = await commonGetAPICalls(`/crm/students/${id}/timeline${kind ? `?kind=${kind}` : ""}`);
        if (success) { setData(data); setError(""); } else setError(message || "Could not load the timeline");
    }, [id, kind]);
    useEffect(() => { load(); }, [load]);

    const groups = useMemo(() => {
        const out: { day: string; items: any[] }[] = [];
        for (const item of data?.items || []) {
            const day = dayLabel(new Date(item.at));
            const last = out[out.length - 1];
            if (last && last.day === day) last.items.push(item); else out.push({ day, items: [item] });
        }
        return out;
    }, [data]);

    if (error) return <EmptyState icon={History} title="Timeline not available" text={error} />;
    if (!data) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const total = Object.values(data.counts || {}).reduce((a: number, b: any) => a + Number(b), 0);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
            <Card shadow="sm">
                <CardBody className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-foreground">{data.student.name}</h1>
                            <p className="text-sm text-default-500">{[data.student.phone, data.student.email].filter(Boolean).join(" · ")}</p>
                        </div>
                        <Button size="sm" variant="light" startContent={<ArrowLeft size={14} />} onPress={() => navigate(-1)}>Back</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {data.cases.map((c: any) => {
                            const result = CASE_RESULT[c.status];
                            return (
                                <Chip key={c.id} variant="flat" className="cursor-pointer" color={result?.color || "primary"} onClick={() => navigate(`/leads/progress/${c.id}`)}>
                                    {c.label} · {result ? result.label : stageLabel(c.stage || "documents")}
                                </Chip>
                            );
                        })}
                        {data.lead && <Chip variant="bordered" className="cursor-pointer" onClick={() => navigate(`/crm/leads/${data.lead.uuid}`)}>Original lead</Chip>}
                    </div>
                </CardBody>
            </Card>

            <div className="overflow-x-auto">
                <Tabs selectedKey={kind || "all"} variant="underlined" aria-label="Show"
                    onSelectionChange={(k) => { const p = new URLSearchParams(params); if (k === "all") p.delete("kind"); else p.set("kind", String(k)); setParams(p, { replace: true }); }}>
                    {KINDS.map((k) => <Tab key={k.key || "all"} title={`${k.label}${k.key ? (data.counts?.[k.key] ? ` (${data.counts[k.key]})` : "") : ` (${total})`}`} />)}
                </Tabs>
            </div>

            {!groups.length ? (
                <EmptyState compact icon={History} title="Nothing here yet" text="Activity will show up as the team works on this student." />
            ) : (
                <div className="flex flex-col gap-5">
                    {groups.map((g) => (
                        <section key={g.day}>
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-default-500 mb-2">{g.day}</h2>
                            <ol className="relative border-l border-default-200 ml-3 flex flex-col gap-3">
                                {g.items.map((item: any, i: number) => {
                                    const Icon = ICON[item.kind] || History;
                                    return (
                                        <li key={`${item.at}-${i}`} className="ml-5">
                                            <span className={`absolute -left-3 mt-0.5 h-6 w-6 rounded-full grid place-items-center ring-4 ring-background ${TONE[item.kind]}`}><Icon size={13} /></span>
                                            <button type="button" disabled={!item.link} onClick={() => item.link && navigate(item.link)}
                                                className="w-full text-left rounded-lg px-3 py-2 hover:bg-default-50 disabled:hover:bg-transparent">
                                                <div className="flex flex-wrap items-baseline gap-x-2">
                                                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                                                    <span className="text-xs text-default-400">{new Date(item.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{item.who ? ` · ${item.who}` : ""}</span>
                                                </div>
                                                {item.detail && <p className="text-xs text-default-500 mt-0.5 break-words">{item.detail}</p>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentTimeline;
