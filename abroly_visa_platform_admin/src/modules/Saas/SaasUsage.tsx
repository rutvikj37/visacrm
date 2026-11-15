import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Chip, Input, Select, SelectItem, Spinner, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, Tooltip,
} from "@nextui-org/react";
import { Activity, AlertTriangle, HeartPulse, Moon, Search, TrendingDown, TrendingUp } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { fmtDate } from "./saasShared";

export const HEALTH_META: Record<string, { label: string; color: "success" | "warning" | "danger" }> = {
    healthy: { label: "Healthy", color: "success" },
    at_risk: { label: "At risk", color: "warning" },
    inactive: { label: "Inactive", color: "danger" },
};

export const idleLabel = (days: number | null) =>
    days === null ? "Never" : days < 1 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;

export const Trend = ({ pct }: { pct: number | null }) => {
    if (pct === null || pct === undefined) return null;
    const up = pct >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs ${up ? "text-success-600" : "text-danger-600"}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : ""}{pct}%
        </span>
    );
};

const Stat = ({ icon: Icon, label, value, tone, active, onPress }: any) => (
    <button
        type="button"
        onClick={onPress}
        className={`text-left rounded-xl border bg-content1 p-3 flex flex-row items-center gap-3 transition-colors ${active ? "border-primary" : "border-default-200 hover:border-default-400"}`}
    >
        <div className={`p-2 rounded-lg ${tone}`}><Icon size={16} /></div>
        <div><div className="text-xs text-default-500">{label}</div><div className="text-xl font-semibold">{value}</div></div>
    </button>
);

/** Which agencies use the CRM and which may cancel. */
const SaasUsage = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [health, setHealth] = useState("all");
    const [sort, setSort] = useState("score");
    const [search, setSearch] = useState("");

    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls(`/saas_admin/usage?sort=${sort}`);
            if (success) setData(data);
        })();
    }, [sort]);

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (data?.agencies || []).filter((r: any) =>
            (health === "all" || r.health === health) &&
            (!q || [r.name, r.owner_name, r.phone].some((v: any) => String(v || "").toLowerCase().includes(q))));
    }, [data, health, search]);

    if (!data) return <div className="py-10 flex justify-center"><Spinner /></div>;
    const s = data.summary;

    return (
        <div className="flex flex-col gap-4 max-w-full">
            <div>
                <h1 className="text-2xl font-semibold">Usage & health</h1>
                <p className="text-sm text-default-500">How much each agency uses the CRM in the last 30 days. Reach out to agencies at risk before their plan ends.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Stat icon={HeartPulse} label="Healthy" value={s.healthy} tone="bg-success-50 text-success-600" active={health === "healthy"} onPress={() => setHealth(health === "healthy" ? "all" : "healthy")} />
                <Stat icon={AlertTriangle} label="At risk" value={s.at_risk} tone="bg-warning-50 text-warning-600" active={health === "at_risk"} onPress={() => setHealth(health === "at_risk" ? "all" : "at_risk")} />
                <Stat icon={Moon} label="Inactive" value={s.inactive} tone="bg-danger-50 text-danger-600" active={health === "inactive"} onPress={() => setHealth(health === "inactive" ? "all" : "inactive")} />
                <Stat icon={Activity} label="Active today" value={`${s.active_today} / ${s.total}`} tone="bg-primary-50 text-primary" onPress={() => setHealth("all")} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Tabs aria-label="Health" size="sm" selectedKey={health} onSelectionChange={(k) => setHealth(String(k))}>
                    <Tab key="all" title={`All (${s.total})`} />
                    <Tab key="at_risk" title="At risk" />
                    <Tab key="inactive" title="Inactive" />
                    <Tab key="healthy" title="Healthy" />
                </Tabs>
                <Input aria-label="Search" size="sm" className="w-full sm:w-64" placeholder="Search agency, owner, phone" startContent={<Search size={14} />} value={search} onValueChange={setSearch} />
                <Select aria-label="Sort" size="sm" className="w-full sm:w-52 sm:ml-auto" selectedKeys={[sort]} onChange={(e) => e.target.value && setSort(e.target.value)}>
                    <SelectItem key="score">Weakest first</SelectItem>
                    <SelectItem key="idle">Longest idle first</SelectItem>
                    <SelectItem key="leads">Most leads first</SelectItem>
                    <SelectItem key="name">Name</SelectItem>
                </Select>
            </div>

            {/* phones: cards */}
            <div className="md:hidden flex flex-col gap-2">
                {!rows.length ? <div className="text-center text-sm text-default-500 py-8">No agencies here</div> : rows.map((r: any) => (
                    <button key={r.id} type="button" onClick={() => navigate(`/saas/agencies/${r.id}`)} className="text-left rounded-xl border border-default-200 bg-content1 p-3 flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold truncate">{r.name}</div>
                                <div className="text-xs text-default-500 truncate">{[r.owner_name, r.phone].filter(Boolean).join(" · ")}</div>
                            </div>
                            <Chip size="sm" variant="flat" color={HEALTH_META[r.health].color} className="shrink-0">{HEALTH_META[r.health].label} · {r.score}</Chip>
                        </div>
                        {r.reasons[0] && <div className="text-xs text-warning-700">{r.reasons[0]}</div>}
                        <div className="text-xs text-default-600 flex flex-wrap gap-x-3">
                            <span className={r.days_idle === null || r.days_idle >= 7 ? "text-danger-600" : ""}>Active {idleLabel(r.days_idle).toLowerCase()}</span>
                            <span>Leads {r.leads_30d}</span>
                            <span>Work {r.actions_30d}</span>
                            <span>Sources {r.sources}</span>
                            {r.plan && <span>{r.plan}</span>}
                        </div>
                    </button>
                ))}
            </div>

            <div className="max-md:hidden rounded-xl border border-default-200 bg-content1 overflow-x-auto">
                <Table aria-label="Agency usage" removeWrapper className="min-w-[1000px]" onRowAction={(key) => navigate(`/saas/agencies/${key}`)}>
                    <TableHeader>
                        <TableColumn>AGENCY</TableColumn><TableColumn>HEALTH</TableColumn><TableColumn>LAST ACTIVE</TableColumn><TableColumn>TEAM ACTIVE (7D)</TableColumn>
                        <TableColumn>LEADS (30D)</TableColumn><TableColumn>WORK ON LEADS (30D)</TableColumn><TableColumn>CASES (30D)</TableColumn><TableColumn>SOURCES</TableColumn><TableColumn>PLAN</TableColumn>
                    </TableHeader>
                    <TableBody items={rows} emptyContent="No agencies here">
                        {(r: any) => (
                            <TableRow key={r.id} className="cursor-pointer">
                                <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-default-500">{[r.owner_name, r.phone].filter(Boolean).join(" · ")}</div></TableCell>
                                <TableCell>
                                    <Tooltip isDisabled={!r.reasons.length} content={<ul className="text-xs py-1 list-disc pl-4">{r.reasons.map((x: string) => <li key={x}>{x}</li>)}</ul>}>
                                        <div className="flex flex-col items-start gap-1">
                                            <Chip size="sm" variant="flat" color={HEALTH_META[r.health].color}>{HEALTH_META[r.health].label} · {r.score}</Chip>
                                            {r.reasons[0] && <span className="text-xs text-default-500 max-w-[200px] truncate">{r.reasons[0]}</span>}
                                        </div>
                                    </Tooltip>
                                </TableCell>
                                <TableCell className={r.days_idle === null || r.days_idle >= 7 ? "text-danger-600" : ""}>{idleLabel(r.days_idle)}</TableCell>
                                <TableCell>{r.team_total ? `${r.team_active_7d} / ${r.team_total}` : <span className="text-default-400">No team</span>}</TableCell>
                                <TableCell><span className="font-medium">{r.leads_30d}</span> <Trend pct={r.lead_trend_pct} /></TableCell>
                                <TableCell>{r.actions_30d}</TableCell>
                                <TableCell>{r.cases_30d}{r.open_cases ? <span className="text-xs text-default-500"> · {r.open_cases} open</span> : null}</TableCell>
                                <TableCell>{r.sources ? <span className="text-sm">{r.sources}</span> : <span className="text-danger-600 text-sm">None</span>}</TableCell>
                                <TableCell className="text-sm">{r.plan || "-"}<div className={`text-xs ${r.ends_in_days !== null && r.ends_in_days <= 7 ? "text-danger-600" : "text-default-500"}`}>{r.expires_at ? `ends ${fmtDate(r.expires_at)}` : ""}</div></TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-default-500">Score: recent activity 40, work on leads 30, new leads 20, a connected lead source 10. 60+ healthy, 30-59 at risk.</p>
        </div>
    );
};

export default SaasUsage;
