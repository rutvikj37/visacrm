import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Button, Chip, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow,
} from "@nextui-org/react";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const REFRESH_MS = 30_000;

const STATUS_META: Record<string, { label: string; color: "success" | "warning" | "danger" | "default" }> = {
    healthy: { label: "Healthy", color: "success" },
    degraded: { label: "Degraded", color: "warning" },
    down: { label: "Down", color: "danger" },
    ok: { label: "OK", color: "success" },
    error: { label: "Error", color: "danger" },
    unknown: { label: "Unknown", color: "default" },
    critical: { label: "Critical", color: "danger" },
    warning: { label: "Warning", color: "warning" },
};

const fmtTime = (v: any) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
};

const relative = (v: Date | null) => {
    if (!v) return "—";
    const sec = Math.max(0, Math.round((Date.now() - v.getTime()) / 1000));
    if (sec < 5) return "just now";
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s ago`;
};

/** Platform / application monitoring — API probes, live errors, scheduler jobs (not VPS metrics). */
const SaasMonitoring = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [tick, setTick] = useState(0);
    const [filter, setFilter] = useState<"all" | "critical" | "agency" | "student">("all");

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const { success, data: d } = await commonGetAPICalls("/saas_admin/monitoring");
            if (success) {
                setData(d);
                setLastUpdated(new Date());
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        void load(false);
        const id = setInterval(() => void load(true), REFRESH_MS);
        return () => clearInterval(id);
    }, [load]);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const refreshSeconds = data?.refresh_hint_seconds || 30;
    const overall = STATUS_META[data?.overall_status] || STATUS_META.unknown;

    const errors = useMemo(() => {
        const rows = data?.recent_errors || [];
        if (filter === "critical") return rows.filter((r: any) => r.severity === "critical");
        if (filter === "agency") return rows.filter((r: any) => r.source === "agency");
        if (filter === "student") return rows.filter((r: any) => r.source === "student");
        return rows;
    }, [data, filter]);

    // keep relative clock fresh
    void tick;

    if (loading && !data) {
        return <div className="p-10 flex justify-center"><Spinner /></div>;
    }

    const summary = data?.error_summary || {};

    return (
        <div className="flex flex-col gap-5 p-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Monitoring</h1>
                    <p className="text-sm text-default-500">
                        Application health: API probes, live agency/student errors, and scheduler jobs.
                        Not server CPU/RAM/disk.
                    </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1">
                    <div className="flex items-center gap-2">
                        <Chip color={overall.color} variant="flat" startContent={
                            data?.overall_status === "healthy" ? <CheckCircle2 size={14} />
                                : data?.overall_status === "down" ? <XCircle size={14} />
                                    : <AlertTriangle size={14} />
                        }>
                            Platform: {overall.label}
                        </Chip>
                        <Button size="sm" variant="flat" isLoading={refreshing} startContent={<RefreshCw size={14} />} onPress={() => load(true)}>
                            Refresh
                        </Button>
                    </div>
                    <div className="text-xs text-default-500">
                        Last updated {relative(lastUpdated)} · Auto-refresh every {refreshSeconds}s
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Errors (15m)", value: summary.last_15m ?? 0 },
                    { label: "Critical (15m)", value: summary.critical_15m ?? 0 },
                    { label: "Agency (15m)", value: summary.agency_15m ?? 0 },
                    { label: "Student (15m)", value: summary.student_15m ?? 0 },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-default-200 bg-content1 p-3">
                        <div className="text-xs text-default-500">{s.label}</div>
                        <div className="text-xl font-semibold">{s.value}</div>
                    </div>
                ))}
            </div>

            <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Activity size={16} />
                    <h2 className="text-lg font-semibold">API checks</h2>
                </div>
                <Table aria-label="API probes" removeWrapper>
                    <TableHeader>
                        <TableColumn>Check</TableColumn>
                        <TableColumn>Critical</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Latency</TableColumn>
                        <TableColumn>Detail</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No probes">
                        {(data?.probes || []).map((p: any) => {
                            const st = STATUS_META[p.status] || STATUS_META.unknown;
                            return (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>{p.critical ? <Chip size="sm" color="danger" variant="flat">Critical</Chip> : <Chip size="sm" variant="flat">Normal</Chip>}</TableCell>
                                    <TableCell><Chip size="sm" color={st.color} variant="flat">{st.label}</Chip></TableCell>
                                    <TableCell>{p.latency_ms == null ? "—" : `${p.latency_ms} ms`}</TableCell>
                                    <TableCell className="text-default-500 max-w-md truncate">{p.detail || "—"}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </section>

            <section className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h2 className="text-lg font-semibold">Recent errors</h2>
                    <div className="flex flex-wrap gap-1">
                        {([
                            ["all", "All"],
                            ["critical", "Critical"],
                            ["agency", "Agency"],
                            ["student", "Student"],
                        ] as const).map(([k, label]) => (
                            <Button key={k} size="sm" variant={filter === k ? "solid" : "flat"} color={filter === k ? "primary" : "default"} onPress={() => setFilter(k)}>
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
                <Table aria-label="Recent errors" removeWrapper>
                    <TableHeader>
                        <TableColumn>When</TableColumn>
                        <TableColumn>Who</TableColumn>
                        <TableColumn>Path</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Severity</TableColumn>
                        <TableColumn>Message</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No recent API errors">
                        {errors.map((e: any) => {
                            const sev = STATUS_META[e.severity] || STATUS_META.error;
                            const who = e.agency_name
                                ? `${e.agency_name} (${e.source})`
                                : e.source === "student"
                                    ? `Student${e.actor_id ? ` #${e.actor_id}` : ""}`
                                    : e.source;
                            return (
                                <TableRow key={e.id}>
                                    <TableCell className="whitespace-nowrap text-xs">{fmtTime(e.occurred_at)}{e.count > 1 ? ` ×${e.count}` : ""}</TableCell>
                                    <TableCell className="text-sm">{who}</TableCell>
                                    <TableCell className="font-mono text-xs max-w-[220px] truncate">{e.method} {e.path}</TableCell>
                                    <TableCell>{e.status_code}</TableCell>
                                    <TableCell><Chip size="sm" color={sev.color} variant="flat">{sev.label}</Chip></TableCell>
                                    <TableCell className="text-default-500 max-w-md truncate">{e.message || "—"}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="text-xs text-default-400">Showing last {errors.length} matching events · totals: 1h {summary.last_1h ?? 0} · 24h {summary.last_24h ?? 0}</div>
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">Scheduler jobs</h2>
                <Table aria-label="Scheduler heartbeats" removeWrapper>
                    <TableHeader>
                        <TableColumn>Job</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Last OK</TableColumn>
                        <TableColumn>Duration</TableColumn>
                        <TableColumn>Last error</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No scheduler heartbeats yet (jobs write after their next run)">
                        {(data?.scheduler || []).map((j: any) => {
                            const st = STATUS_META[j.status] || STATUS_META.unknown;
                            return (
                                <TableRow key={j.job_name}>
                                    <TableCell className="font-medium">{j.job_name}</TableCell>
                                    <TableCell><Chip size="sm" color={st.color} variant="flat">{st.label}</Chip></TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtTime(j.last_ok_at)}</TableCell>
                                    <TableCell>{j.last_duration_ms == null ? "—" : `${j.last_duration_ms} ms`}</TableCell>
                                    <TableCell className="text-default-500 max-w-md truncate">{j.last_error || "—"}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </section>
        </div>
    );
};

export default SaasMonitoring;
