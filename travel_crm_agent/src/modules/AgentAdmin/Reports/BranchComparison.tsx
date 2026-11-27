import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Spinner } from "@heroui/react";
import { Building2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const Bar = ({ value, max }: { value: number; max: number }) => (
    <div className="h-1.5 rounded-full bg-default-100 mt-1 w-full max-w-[120px]">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
    </div>
);

/** Owner: every branch side by side for the chosen period. Clicking a branch opens its report. */
const BranchComparison = ({ from, to, onOpenBranch }: { from: string; to: string; onOpenBranch: (id: string) => void }) => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        setData(null);
        (async () => {
            const { success, data } = await commonGetAPICalls(`/crm/reports/branches?from=${from}&to=${to}`);
            setData(success ? data : { branches: [], total: {} });
        })();
    }, [from, to]);

    if (!data) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (!data.branches.length) {
        return <Card shadow="sm"><CardBody className="text-center py-10 text-default-500">No branches yet. Add your offices under Team Members → Branches.</CardBody></Card>;
    }
    const max = (k: string) => Math.max(0, ...data.branches.map((b: any) => Number(b[k] || 0)));
    const best = [...data.branches].filter((b: any) => b.id).sort((a: any, b: any) => b.conversion_rate - a.conversion_rate || b.converted - a.converted)[0];
    const t = data.total;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card shadow="sm"><CardBody><div className="text-xs text-default-500">New leads (all branches)</div><div className="text-2xl font-semibold">{t.leads}</div><div className="text-xs text-default-500">{t.conversion_rate}% converted</div></CardBody></Card>
                <Card shadow="sm"><CardBody><div className="text-xs text-default-500">Open cases</div><div className="text-2xl font-semibold">{t.open_cases}</div><div className="text-xs text-default-500">{t.approved} visas approved</div></CardBody></Card>
                <Card shadow="sm"><CardBody><div className="text-xs text-default-500">Collected</div><div className="text-2xl font-semibold">{rupees(t.collected)}</div><div className="text-xs text-default-500">of {rupees(t.invoiced)} invoiced</div></CardBody></Card>
                <Card shadow="sm"><CardBody><div className="text-xs text-default-500">Best conversion</div><div className="text-2xl font-semibold truncate">{best?.name || "-"}</div><div className="text-xs text-default-500">{best ? `${best.conversion_rate}% of leads` : ""}</div></CardBody></Card>
            </div>
            <Card shadow="sm">
                <CardHeader className="font-semibold flex items-center gap-2"><Building2 size={18} /> Branches side by side</CardHeader>
                <CardBody className="pt-0 overflow-x-auto">
                    <table className="w-full text-sm min-w-[980px]">
                        <thead>
                            <tr className="text-left text-xs text-default-500">
                                <th className="py-2 font-medium">Branch</th><th className="font-medium">Team</th><th className="font-medium">New leads</th><th className="font-medium">Converted</th>
                                <th className="font-medium">Open leads</th><th className="font-medium">Overdue follow-ups</th><th className="font-medium">Open cases</th><th className="font-medium">Visas (approved / rejected)</th>
                                <th className="font-medium">Invoiced</th><th className="font-medium">Collected</th><th className="font-medium">Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.branches.map((b: any) => (
                                <tr key={b.id ?? "none"} className="border-t border-default-100 align-top">
                                    <td className="py-2">
                                        <button type="button" className="font-medium text-left hover:text-primary" onClick={() => onOpenBranch(b.id ? String(b.id) : "none")}>{b.name}</button>
                                        {b.city && <div className="text-xs text-default-500">{b.city}</div>}
                                    </td>
                                    <td className="py-2">{b.team}</td>
                                    <td className="py-2">{b.leads}<Bar value={b.leads} max={max("leads")} /></td>
                                    <td className="py-2">{b.converted} <span className="text-xs text-default-500">({b.conversion_rate}%)</span></td>
                                    <td className="py-2">{b.open_leads}{b.unassigned ? <div className="text-xs text-warning-600">{b.unassigned} unassigned</div> : null}</td>
                                    <td className={`py-2 ${b.overdue_follow_ups ? "text-danger-600" : ""}`}>{b.overdue_follow_ups}</td>
                                    <td className="py-2">{b.open_cases}</td>
                                    <td className="py-2">{b.approved} / {b.rejected}{b.approved + b.rejected ? <span className="text-xs text-default-500"> ({b.success_rate}%)</span> : null}</td>
                                    <td className="py-2">{rupees(b.invoiced)}</td>
                                    <td className="py-2">{rupees(b.collected)}<Bar value={b.collected} max={max("collected")} /></td>
                                    <td className={`py-2 ${b.outstanding ? "text-warning-700" : ""}`}>{rupees(b.outstanding)}</td>
                                </tr>
                            ))}
                            <tr className="border-t-2 border-default-200 font-semibold">
                                <td className="py-2">Total</td><td /><td className="py-2">{t.leads}</td><td className="py-2">{t.converted} <span className="text-xs font-normal text-default-500">({t.conversion_rate}%)</span></td>
                                <td className="py-2">{t.open_leads}</td><td /><td className="py-2">{t.open_cases}</td><td className="py-2">{t.approved}</td>
                                <td className="py-2">{rupees(t.invoiced)}</td><td className="py-2">{rupees(t.collected)}</td><td className="py-2">{rupees(t.outstanding)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="text-xs text-default-500 mt-3">New leads and conversions count leads created in the period. Open leads, open cases, overdue follow-ups and amounts due are as of today. Click a branch to open its full report.</p>
                </CardBody>
            </Card>
        </div>
    );
};

export default BranchComparison;
