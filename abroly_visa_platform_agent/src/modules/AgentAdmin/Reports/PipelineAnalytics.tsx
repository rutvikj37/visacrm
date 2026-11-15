import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Card, CardBody, CardHeader, Spinner, Tab, Tabs } from "@heroui/react";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { sourceLabel } from "../Crm/crmShared";
import { BranchPicker, useBranchAccess } from "@/modules/AgentAdmin/Branches/branchShared";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const RANGES = [
    { key: "7", label: "7 days" },
    { key: "30", label: "30 days" },
    { key: "90", label: "90 days" },
    { key: "365", label: "1 year" },
];

const SERIES = {
    light: { leads: "#2a78d6", rate: "#eb6834", muted: "#71717a", grid: "rgba(0,0,0,0.06)" },
    dark: { leads: "#3987e5", rate: "#d95926", muted: "#a1a1aa", grid: "rgba(255,255,255,0.06)" },
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const Tile = ({ label, value, hint }: { label: string; value: any; hint?: string }) => (
    <Card shadow="sm">
        <CardBody className="p-4">
            <div className="text-xs text-default-500">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-default-500 mt-1">{hint}</div>}
        </CardBody>
    </Card>
);

const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="h-2 rounded-full bg-default-100 w-full min-w-[60px]">
        <div className="h-2 rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
);

const EmptyRow = ({ cols, message }: { cols: number; message: string }) => (
    <tr><td colSpan={cols} className="py-6 text-center text-default-500">{message}</td></tr>
);

type PipelineAnalyticsProps = {
    /** When embedded in ReportsDashboard, parent owns date/branch filters */
    embedded?: boolean;
    range?: string;
    branch?: string;
    onRangeChange?: (v: string) => void;
    onBranchChange?: (v: string) => void;
};

/**
 * Pipeline conversion analytics: rates by source, counsellor, and branch.
 * Conversion rate = converted ÷ total leads created in the period.
 */
const PipelineAnalytics = ({
    embedded = false,
    range: rangeProp,
    branch: branchProp,
    onRangeChange,
    onBranchChange,
}: PipelineAnalyticsProps) => {
    const { commonGetAPICalls } = useApiCallUtils();
    const { canPick: canPickBranch } = useBranchAccess();
    const dark = Boolean(useSelector((state: any) => state.theme?.darkMode));
    const colors = dark ? SERIES.dark : SERIES.light;

    const [localRange, setLocalRange] = useState("30");
    const [localBranch, setLocalBranch] = useState("");
    const range = rangeProp ?? localRange;
    const branch = branchProp ?? localBranch;
    const setRange = onRangeChange ?? setLocalRange;
    const setBranch = onBranchChange ?? setLocalBranch;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasDataRef = useRef(false);

    const load = useCallback(async () => {
        if (!hasDataRef.current) setLoading(true);
        setError(null);
        const to = new Date();
        const from = new Date(to.getTime() - (Number(range) - 1) * 24 * 60 * 60 * 1000);
        const q = `/crm/reports/pipeline?from=${ymd(from)}&to=${ymd(to)}${canPickBranch && branch ? `&branch=${branch}` : ""}`;
        const { success, data: next, message } = await commonGetAPICalls(q);
        if (success) {
            setData(next);
            hasDataRef.current = true;
        } else {
            setError(message || "Could not load pipeline analytics");
            if (!hasDataRef.current) setData(null);
        }
        setLoading(false);
    }, [range, branch, canPickBranch]);

    useEffect(() => { load(); }, [load]);

    const rateChart = useMemo(() => {
        if (!data?.by_source?.length) return null;
        const rows = data.by_source.slice(0, 10);
        return {
            data: {
                labels: rows.map((r: any) => sourceLabel(r.source)),
                datasets: [
                    {
                        label: "Conversion rate %",
                        data: rows.map((r: any) => r.conversion_rate),
                        backgroundColor: colors.rate,
                        borderRadius: 4,
                        maxBarThickness: 36,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y" as const,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: (ctx: any) => {
                                const r = rows[ctx.dataIndex];
                                return r ? `${r.converted} of ${r.leads} leads` : "";
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: colors.grid },
                        border: { display: false },
                        ticks: { color: colors.muted, callback: (v: any) => `${v}%` },
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: colors.muted },
                    },
                },
            },
        };
    }, [data, colors]);

    const counsellorChart = useMemo(() => {
        const rows = (data?.by_counsellor || []).filter((c: any) => c.id != null).slice(0, 10);
        if (!rows.length) return null;
        return {
            data: {
                labels: rows.map((r: any) => r.name),
                datasets: [
                    {
                        label: "Conversion rate %",
                        data: rows.map((r: any) => r.conversion_rate),
                        backgroundColor: colors.leads,
                        borderRadius: 4,
                        maxBarThickness: 36,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y" as const,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: (ctx: any) => {
                                const r = rows[ctx.dataIndex];
                                return r ? `${r.converted} of ${r.leads} leads` : "";
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: colors.grid },
                        border: { display: false },
                        ticks: { color: colors.muted, callback: (v: any) => `${v}%` },
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: colors.muted },
                    },
                },
            },
        };
    }, [data, colors]);

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-default-500">
                <Spinner />
                <span className="text-sm">Loading pipeline…</span>
            </div>
        );
    }

    if (error && !data) {
        return <Card shadow="sm"><CardBody className="py-10 text-center text-default-500">{error}</CardBody></Card>;
    }

    if (!data) return null;

    const s = data.summary;
    const funnelMax = data.funnel?.[0]?.value || 0;
    const sourceMax = Math.max(0, ...(data.by_source || []).map((r: any) => r.leads));
    const showBranches = Array.isArray(data.by_branch) && data.scope === "agency";
    const isSoftLoading = loading && Boolean(data);

    return (
        <div className={`flex flex-col gap-4 ${isSoftLoading ? "opacity-70 transition-opacity" : ""}`}>
            {!embedded && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">Pipeline analytics</h2>
                        <p className="text-sm text-default-500">
                            {data.scope === "mine"
                                ? "Your conversion rates for leads assigned to you."
                                : "Conversion rates by source, counsellor, and branch — not just counts."}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canPickBranch && <BranchPicker value={branch} onChange={setBranch} className="w-44" />}
                        <Tabs size="sm" selectedKey={range} onSelectionChange={(k) => setRange(String(k))} aria-label="Date range">
                            {RANGES.map((r) => <Tab key={r.key} title={r.label} />)}
                        </Tabs>
                    </div>
                </div>
            )}

            {data.branch && (
                <div className="text-sm rounded-lg bg-primary-50 text-primary-800 px-3 py-2">
                    Showing {data.branch.name} only.
                </div>
            )}

            <p className="text-xs text-default-500 -mt-1">
                {data.definition || "Conversion rate = converted ÷ total leads created in this period."}
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Tile label="Leads" value={s.leads} hint="created in period" />
                <Tile label="Converted" value={s.converted} hint={`${s.conversion_rate}% conversion rate`} />
                <Tile label="Still open" value={s.open} />
                <Tile label="Lost" value={s.lost} hint={s.leads ? `${s.lost_rate}% of leads` : undefined} />
                <Tile label="Visa approved" value={s.visa_approved} hint="from these conversions" />
            </div>

            {s.leads === 0 ? (
                <Card shadow="sm">
                    <CardBody className="py-12 text-center text-default-500">
                        No leads in this period. Try a wider date range{canPickBranch && branch ? " or another branch" : ""}.
                    </CardBody>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <Card shadow="sm" className="xl:col-span-1">
                            <CardHeader className="font-semibold">Funnel</CardHeader>
                            <CardBody className="pt-0 gap-3">
                                {data.funnel.map((f: any, i: number) => (
                                    <div key={f.key}>
                                        <div className="flex justify-between text-sm mb-1 gap-2">
                                            <span>{f.label}</span>
                                            <span className="font-medium whitespace-nowrap">
                                                {f.value}
                                                {i > 0 && (
                                                    <span className="text-default-500 font-normal">
                                                        {" "}· {f.rate_of_total}% of leads
                                                        {f.rate_of_previous != null && i > 0 ? ` · ${f.rate_of_previous}% of prior` : ""}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <MiniBar value={f.value} max={funnelMax} color={colors.leads} />
                                    </div>
                                ))}
                            </CardBody>
                        </Card>

                        <Card shadow="sm" className="xl:col-span-1">
                            <CardHeader className="font-semibold">Conversion by source</CardHeader>
                            <CardBody className="pt-0">
                                {rateChart ? (
                                    <div className="h-[280px]"><Bar data={rateChart.data} options={rateChart.options} aria-label="Conversion rate by source" /></div>
                                ) : (
                                    <p className="text-sm text-default-500 py-8 text-center">No source data yet.</p>
                                )}
                            </CardBody>
                        </Card>

                        <Card shadow="sm" className="xl:col-span-1">
                            <CardHeader className="font-semibold">Conversion by counsellor</CardHeader>
                            <CardBody className="pt-0">
                                {counsellorChart ? (
                                    <div className="h-[280px]"><Bar data={counsellorChart.data} options={counsellorChart.options} aria-label="Conversion rate by counsellor" /></div>
                                ) : (
                                    <p className="text-sm text-default-500 py-8 text-center">
                                        {data.scope === "mine" ? "No assigned leads in this period." : "No counsellor assignments in this period."}
                                    </p>
                                )}
                            </CardBody>
                        </Card>
                    </div>

                    <Card shadow="sm">
                        <CardHeader className="font-semibold">By source</CardHeader>
                        <CardBody className="pt-0 overflow-x-auto">
                            <table className="w-full text-sm min-w-[560px]">
                                <thead className="text-xs text-default-500">
                                    <tr>
                                        <th className="text-left py-2">Source</th>
                                        <th className="text-left w-[28%]">Leads</th>
                                        <th className="text-right">Converted</th>
                                        <th className="text-right">Open</th>
                                        <th className="text-right">Lost</th>
                                        <th className="text-right">Conversion rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!data.by_source.length && <EmptyRow cols={6} message="No leads by source in this period." />}
                                    {data.by_source.map((r: any) => (
                                        <tr key={r.source} className="border-t border-default-100">
                                            <td className="py-2">{sourceLabel(r.source)}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 text-right">{r.leads}</span>
                                                    <MiniBar value={r.leads} max={sourceMax} color={colors.leads} />
                                                </div>
                                            </td>
                                            <td className="text-right">{r.converted}</td>
                                            <td className="text-right">{r.open}</td>
                                            <td className="text-right">{r.lost}</td>
                                            <td className="text-right font-medium">{r.conversion_rate}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardBody>
                    </Card>

                    <div className={`grid grid-cols-1 ${showBranches ? "xl:grid-cols-2" : ""} gap-4`}>
                        <Card shadow="sm">
                            <CardHeader className="font-semibold">By counsellor</CardHeader>
                            <CardBody className="pt-0 overflow-x-auto">
                                <table className="w-full text-sm min-w-[480px]">
                                    <thead className="text-xs text-default-500">
                                        <tr>
                                            <th className="text-left py-2">Person</th>
                                            <th className="text-right">Leads</th>
                                            <th className="text-right">Converted</th>
                                            <th className="text-right">Open</th>
                                            <th className="text-right">Lost</th>
                                            <th className="text-right">Conversion rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!data.by_counsellor.length && <EmptyRow cols={6} message="No assignees in this period." />}
                                        {data.by_counsellor.map((c: any) => (
                                            <tr key={c.id ?? "unassigned"} className="border-t border-default-100">
                                                <td className="py-2">
                                                    {c.name}
                                                    {c.role === "agent" && <span className="text-xs text-default-500"> (owner)</span>}
                                                    {c.active === false && <span className="text-xs text-default-500"> (inactive)</span>}
                                                </td>
                                                <td className="text-right">{c.leads}</td>
                                                <td className="text-right font-medium">{c.converted}</td>
                                                <td className="text-right">{c.open}</td>
                                                <td className="text-right">{c.lost}</td>
                                                <td className="text-right font-medium">{c.conversion_rate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-xs text-default-500 mt-2">Sorted by conversion rate. Rate = converted ÷ leads assigned (created in period).</p>
                            </CardBody>
                        </Card>

                        {showBranches && (
                            <Card shadow="sm">
                                <CardHeader className="font-semibold">By branch</CardHeader>
                                <CardBody className="pt-0 overflow-x-auto">
                                    <table className="w-full text-sm min-w-[480px]">
                                        <thead className="text-xs text-default-500">
                                            <tr>
                                                <th className="text-left py-2">Branch</th>
                                                <th className="text-right">Leads</th>
                                                <th className="text-right">Converted</th>
                                                <th className="text-right">Open</th>
                                                <th className="text-right">Lost</th>
                                                <th className="text-right">Conversion rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {!data.by_branch.length && <EmptyRow cols={6} message="No branch-tagged leads in this period." />}
                                            {data.by_branch.map((b: any) => (
                                                <tr key={b.id ?? "none"} className="border-t border-default-100">
                                                    <td className="py-2">
                                                        {b.name}
                                                        {b.city && <div className="text-xs text-default-500">{b.city}</div>}
                                                    </td>
                                                    <td className="text-right">{b.leads}</td>
                                                    <td className="text-right font-medium">{b.converted}</td>
                                                    <td className="text-right">{b.open}</td>
                                                    <td className="text-right">{b.lost}</td>
                                                    <td className="text-right font-medium">{b.conversion_rate}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="text-xs text-default-500 mt-2">Sorted by conversion rate. Pick a branch above to drill into its funnel.</p>
                                </CardBody>
                            </Card>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default PipelineAnalytics;
