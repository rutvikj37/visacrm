import { PageSkeleton } from "@/components/ui-kit/Skeletons";
import MonthlySummaryButton from "./MonthlySummaryButton";
import BranchComparison from "./BranchComparison";
import PipelineAnalytics from "./PipelineAnalytics";
import { BranchPicker, useBranches } from "@/modules/AgentAdmin/Branches/branchShared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    Button, Card, CardBody, CardHeader, Tab, Tabs,
} from "@heroui/react";
import { BarChart3 } from "lucide-react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from "chart.js";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { sourceLabel } from "../Crm/crmShared";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// validated categorical slots (blue, orange) - light and dark steps
const SERIES = {
    light: { leads: "#2a78d6", converted: "#eb6834" },
    dark: { leads: "#3987e5", converted: "#d95926" },
};

const RANGES = [
    { key: "7", label: "7 days" },
    { key: "30", label: "30 days" },
    { key: "90", label: "90 days" },
    { key: "365", label: "1 year" },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (k: string) => {
    const d = new Date(k);
    return isNaN(d.getTime()) ? k : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const Tile = ({ label, value, hint }: { label: string; value: any; hint?: string }) => (
    <Card shadow="sm">
        <CardBody className="p-4">
            <div className="text-xs text-default-500">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-default-500 mt-1">{hint}</div>}
        </CardBody>
    </Card>
);

/** Thin horizontal bar used inside tables (one series, value printed in text beside it). */
const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="h-2 rounded-full bg-default-100 w-full min-w-[60px]">
        <div className="h-2 rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
);

type ReportSection = "overview" | "pipeline" | "branches";

const ReportsDashboard = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    // full overview/branch compare: owner + branch managers; pipeline: any agency user (API scopes)
    const canViewFull = isOwner || teamRole === "branch_manager";
    const branches = useBranches();
    const initial = new URLSearchParams(window.location.search);
    const tabParam = initial.get("tab");
    const [section, setSection] = useState<ReportSection>(
        tabParam === "branches" ? "branches" : tabParam === "pipeline" ? "pipeline" : (canViewFull ? "overview" : "pipeline")
    );
    const [branch, setBranch] = useState(initial.get("branch") || "");
    const dark = Boolean(useSelector((state: any) => state.theme?.darkMode));
    const colors = dark ? SERIES.dark : SERIES.light;
    const [range, setRange] = useState("30");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<"chart" | "table">("chart");

    const hasDataRef = useRef(false);
    const load = useCallback(async () => {
        if (!hasDataRef.current) setLoading(true);
        const to = new Date();
        const from = new Date(to.getTime() - (Number(range) - 1) * 24 * 60 * 60 * 1000);
        const { success, data: next } = await commonGetAPICalls(`/crm/reports/overview?from=${ymd(from)}&to=${ymd(to)}${isOwner && branch ? `&branch=${branch}` : ""}`);
        if (success) {
            setData(next);
            hasDataRef.current = true;
        }
        setLoading(false);
    }, [range, branch, isOwner]);
    useEffect(() => { if (canViewFull && section === "overview") load(); }, [load, canViewFull, section]);
    // keep ?tab= in the URL so deep links and help stay accurate
    useEffect(() => {
        const url = new URL(window.location.href);
        if (section === "overview") url.searchParams.delete("tab");
        else url.searchParams.set("tab", section);
        if (branch) url.searchParams.set("branch", branch);
        else url.searchParams.delete("branch");
        window.history.replaceState({}, "", url.pathname + url.search);
    }, [section, branch]);
    const periodTo = ymd(new Date());
    const periodFrom = ymd(new Date(Date.now() - (Number(range) - 1) * 24 * 60 * 60 * 1000));

    const chart = useMemo(() => {
        if (!data) return null;
        const labels = data.trend.map((t: any) => (data.period.weekly ? t.label : fmtDay(t.label)));
        const muted = dark ? "#a1a1aa" : "#71717a";
        const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
        return {
            data: {
                labels,
                datasets: [
                    { label: "New leads", data: data.trend.map((t: any) => t.leads), borderColor: colors.leads, backgroundColor: colors.leads, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0 },
                    { label: "Converted", data: data.trend.map((t: any) => t.converted), borderColor: colors.converted, backgroundColor: colors.converted, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index" as const, intersect: false },
                layout: { padding: { right: 8, top: 4 } },
                plugins: {
                    legend: { position: "top" as const, align: "start" as const, labels: { color: muted, boxWidth: 12, boxHeight: 2, usePointStyle: false } },
                    tooltip: { mode: "index" as const, intersect: false },
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: muted, maxTicksLimit: 8, maxRotation: 0 } },
                    y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, precision: 0, maxTicksLimit: 5 } },
                },
            },
        };
    }, [data, dark]);

    const funnelMax = data?.funnel?.[0]?.value || 0;
    const sourceMax = Math.max(0, ...(data?.sources || []).map((s: any) => s.leads));
    const s = data?.summary;
    const showSectionTabs = canViewFull;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            {/* header + one row of filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2"><BarChart3 size={24} /> Reports</h1>
                    <p className="text-sm text-default-500">
                        {section === "pipeline"
                            ? "Conversion rates by source, counsellor, and branch."
                            : !isOwner && data?.branch ? `How ${data.branch.name} is doing.` : "How your leads, team and visa cases are doing."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {showSectionTabs && (
                        <Tabs size="sm" selectedKey={section} onSelectionChange={(k) => setSection(k as ReportSection)} aria-label="Report">
                            <Tab key="overview" title="Overview" />
                            <Tab key="pipeline" title="Pipeline" />
                            {isOwner && branches.length > 0 && <Tab key="branches" title="Compare branches" />}
                        </Tabs>
                    )}
                    {(section === "overview" || section === "pipeline") && <BranchPicker value={branch} onChange={setBranch} className="w-44" />}
                    {(section === "overview" || section === "pipeline" || section === "branches") && (
                        <Tabs size="sm" selectedKey={range} onSelectionChange={(k) => setRange(String(k))} aria-label="Date range">
                            {RANGES.map((r) => <Tab key={r.key} title={r.label} />)}
                        </Tabs>
                    )}
                    {isOwner && section !== "pipeline" && <MonthlySummaryButton />}
                </div>
            </div>
            {section === "overview" && data?.branch && isOwner && (
                <div className="text-sm rounded-lg bg-primary-50 text-primary-800 px-3 py-2">Showing {data.branch.name} only.</div>
            )}

            {section === "pipeline" ? (
                <PipelineAnalytics embedded range={range} branch={branch} onRangeChange={setRange} onBranchChange={setBranch} />
            ) : section === "branches" ? (
                <BranchComparison from={periodFrom} to={periodTo} onOpenBranch={(id) => { setBranch(id); setSection("overview"); }} />
            ) : !canViewFull ? (
                <PipelineAnalytics embedded range={range} branch={branch} onRangeChange={setRange} onBranchChange={setBranch} />
            ) : !data ? <PageSkeleton /> : (
                <div className={loading ? "opacity-70 transition-opacity flex flex-col gap-4" : "flex flex-col gap-4"}>
                    {/* headline numbers */}
                    <div className={`grid grid-cols-2 ${data.branch ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
                        <Tile label="New leads" value={s.leads} />
                        <Tile label="Converted to visa case" value={s.converted} hint={`${s.conversion_rate}% of leads`} />
                        <Tile label="Visa approved" value={s.visa_approved} hint="from these leads" />
                        {data.branch && (
                            <Tile label="Open leads not assigned" value={s.unassigned_open} hint="waiting for someone in this branch" />
                        )}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        {/* trend */}
                        <Card shadow="sm" className="xl:col-span-2">
                            <CardHeader className="flex items-center justify-between gap-2">
                                <span className="font-semibold">Leads and conversions {data.period.weekly ? "per week" : "per day"}</span>
                                <Tabs size="sm" selectedKey={view} onSelectionChange={(k) => setView(k as any)} aria-label="View">
                                    <Tab key="chart" title="Chart" />
                                    <Tab key="table" title="Table" />
                                </Tabs>
                            </CardHeader>
                            <CardBody className="pt-0">
                                {view === "chart" && chart ? (
                                    <div className="h-[260px]"><Line data={chart.data} options={chart.options} aria-label="New leads and conversions over time" /></div>
                                ) : (
                                    <div className="max-h-[260px] overflow-y-auto text-sm">
                                        <table className="w-full">
                                            <thead className="text-xs text-default-500 sticky top-0 bg-content1"><tr><th className="text-left py-1">Date</th><th className="text-right">New leads</th><th className="text-right">Converted</th></tr></thead>
                                            <tbody>
                                                {data.trend.filter((t: any) => t.leads || t.converted).map((t: any) => (
                                                    <tr key={t.label} className="border-t border-default-100"><td className="py-1">{data.period.weekly ? t.label : fmtDay(t.label)}</td><td className="text-right">{t.leads}</td><td className="text-right">{t.converted}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        {/* funnel */}
                        <Card shadow="sm">
                            <CardHeader className="font-semibold">Funnel</CardHeader>
                            <CardBody className="pt-0 gap-3">
                                {data.funnel.map((f: any, i: number) => (
                                    <div key={f.key}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>{f.label}</span>
                                            <span className="font-medium">{f.value}{i > 0 && funnelMax ? <span className="text-default-500 font-normal"> · {Math.round((f.value / funnelMax) * 100)}%</span> : null}</span>
                                        </div>
                                        <Bar value={f.value} max={funnelMax} color={colors.leads} />
                                    </div>
                                ))}
                            </CardBody>
                        </Card>
                    </div>

                    {/* sources */}
                    <Card shadow="sm">
                        <CardHeader className="font-semibold">Lead sources</CardHeader>
                        <CardBody className="pt-0 overflow-x-auto">
                            <table className="w-full text-sm min-w-[480px]">
                                <thead className="text-xs text-default-500"><tr>
                                    <th className="text-left py-2">Source</th><th className="text-left w-[40%]">Leads</th><th className="text-right">Converted</th>
                                </tr></thead>
                                <tbody>
                                    {data.sources.length === 0 && <tr><td colSpan={3} className="py-4 text-default-500">No leads in this period.</td></tr>}
                                    {data.sources.map((r: any) => (
                                        <tr key={r.source} className="border-t border-default-100">
                                            <td className="py-2">{sourceLabel(r.source)}</td>
                                            <td><div className="flex items-center gap-2"><span className="w-8 text-right">{r.leads}</span><Bar value={r.leads} max={sourceMax} color={colors.leads} /></div></td>
                                            <td className="text-right">{r.converted}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardBody>
                    </Card>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* counsellors */}
                        <Card shadow="sm">
                            <CardHeader className="flex items-center justify-between">
                                <span className="font-semibold">Team</span>
                                {s.unassigned_open > 0 && (
                                    <Button size="sm" variant="light" color="warning" onPress={() => navigate("/crm/leads?assigned_to=unassigned")}>{s.unassigned_open} open lead(s) unassigned</Button>
                                )}
                            </CardHeader>
                            <CardBody className="pt-0 overflow-x-auto">
                                <table className="w-full text-sm min-w-[520px]">
                                    <thead className="text-xs text-default-500"><tr>
                                        <th className="text-left py-2">Person</th><th className="text-right">Leads</th><th className="text-right">Contacted</th>
                                        <th className="text-right">Converted</th><th className="text-right">Rate</th><th className="text-right">Activities</th><th className="text-right">Overdue</th>
                                    </tr></thead>
                                    <tbody>
                                        {data.counsellors.map((c: any) => (
                                            <tr key={c.id} className="border-t border-default-100">
                                                <td className="py-2">{c.name}{c.role === "agent" && <span className="text-xs text-default-500"> (owner)</span>}{!c.active && <span className="text-xs text-default-500"> (inactive)</span>}</td>
                                                <td className="text-right">{c.assigned}</td>
                                                <td className="text-right">{c.contacted}</td>
                                                <td className="text-right font-medium">{c.converted}</td>
                                                <td className="text-right">{c.conversion_rate}%</td>
                                                <td className="text-right">{c.activities}</td>
                                                <td className={`text-right ${c.overdue ? "text-danger font-medium" : ""}`}>{c.overdue}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-xs text-default-500 mt-2">Activities = calls, WhatsApp, emails and notes logged in this period. Overdue = follow-ups past due today.</p>
                            </CardBody>
                        </Card>

                        {/* visa outcomes */}
                        <Card shadow="sm">
                            <CardHeader className="font-semibold">Visa results by country</CardHeader>
                            <CardBody className="pt-0 overflow-x-auto">
                                <table className="w-full text-sm min-w-[460px]">
                                    <thead className="text-xs text-default-500"><tr>
                                        <th className="text-left py-2">Country</th><th className="text-right">In progress</th><th className="text-right">Approved</th>
                                        <th className="text-right">Rejected</th><th className="text-right">Success rate</th>
                                    </tr></thead>
                                    <tbody>
                                        {data.visa.length === 0 && <tr><td colSpan={5} className="py-4 text-default-500">No visa cases yet.</td></tr>}
                                        {data.visa.map((v: any) => (
                                            <tr key={v.country} className="border-t border-default-100">
                                                <td className="py-2">{v.country}</td>
                                                <td className="text-right">{v.in_progress}</td>
                                                <td className="text-right">{v.approved}</td>
                                                <td className="text-right">{v.rejected}</td>
                                                <td className="text-right font-medium">{v.approved + v.rejected ? `${v.success_rate}%` : "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {data.lost_reasons.length > 0 && (
                                    <div className="mt-4">
                                        <div className="text-sm font-semibold mb-2">Why leads were lost</div>
                                        {data.lost_reasons.map((r: any) => (
                                            <div key={r.reason} className="flex justify-between text-sm py-1 border-t border-default-100"><span className="truncate pr-2">{r.reason}</span><span>{r.count}</span></div>
                                        ))}
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsDashboard;
