import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, Chip, useDisclosure } from "@heroui/react";
import { BadgeDollarSign, Pencil, Plus } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { CommissionFormModal, commissionStatus, fmtDate, money } from "./commissionShared";

/**
 * Commissions of one visa case. Shown to the owner, Accounts and branch managers.
 * `addRequest` opens the form for a university application (from the Universities card).
 */
const CaseCommissions = ({ caseId, addRequest, onChanged }: { caseId: string | number; addRequest?: { app: any; n: number } | null; onChanged?: () => void }) => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [data, setData] = useState<any>(null);
    const [app, setApp] = useState<any>(null);
    const [editing, setEditing] = useState<any>(null);
    const modal = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/crm/commissions?case_id=${caseId}`);
        setData(success ? data : null);
    }, [caseId]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!addRequest) return;
        setEditing(null);
        setApp(addRequest.app);
        modal.onOpen();
    }, [addRequest?.n]);

    if (!data) return null; // no access (counsellors) or still loading
    const list: any[] = data.commissions || [];
    const canManage = Boolean(data.can_manage);

    return (
        <Card shadow="sm">
            <CardBody className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><BadgeDollarSign size={16} /> Commission</h2>
                        <p className="text-xs text-default-500">
                            {(data.totals || []).map((t: any) => `${money(t.expected, t.currency)} expected · ${money(t.received, t.currency)} received`).join(" | ") || "What the university or partner pays you for this student"}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <Button size="sm" variant="light" onPress={() => navigate("/commissions")}>All commissions</Button>
                        {canManage && <Button size="sm" variant="flat" color="primary" startContent={<Plus size={14} />} onPress={() => { setEditing(null); setApp(null); modal.onOpen(); }}>Add</Button>}
                    </div>
                </div>
                {list.length > 0 && (
                    <ul className="flex flex-col divide-y divide-default-100">
                        {list.map((c) => {
                            const st = commissionStatus(c.status);
                            return (
                                <li key={c.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-medium">{c.partner}</span>
                                    <Chip size="sm" variant="flat" color={st.color}>{st.label}</Chip>
                                    {c.overdue && <Chip size="sm" variant="flat" color="danger">Overdue</Chip>}
                                    <span className="text-default-500 text-xs">{c.due_on ? `Expected by ${fmtDate(c.due_on)}` : ""}</span>
                                    <span className="ml-auto font-semibold">{money(c.amount_expected, c.currency)}</span>
                                    {c.amount_received > 0 && <span className="text-xs text-success">({money(c.amount_received, c.currency)} received)</span>}
                                    {canManage && <Button isIconOnly size="sm" variant="light" aria-label="Edit commission" onPress={() => { setEditing(c); setApp(null); modal.onOpen(); }}><Pencil size={14} /></Button>}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardBody>
            <CommissionFormModal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} caseId={caseId} app={app} commission={editing}
                onSaved={() => { load(); onChanged?.(); }} />
        </Card>
    );
};

export default CaseCommissions;
