import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Button, Select, SelectItem, Spinner } from "@heroui/react";
import { Building2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const ROLE_HELP: Record<string, string> = {
    counsellor: "Sees and works the leads and visa cases assigned to them.",
    branch_manager: "Sees all leads and cases of their branch and can assign them. Without a branch: the whole agency.",
    documents: "Works on visa cases of their branch (documents, steps). Leads only if assigned.",
    accounts: "Can view all leads and cases but not change them.",
};

/** Owner screen: branch offices, and each team member's role and branch. */
const RolesAndBranches = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const navigate = useNavigate();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const [members, setMembers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const hasLoaded = useRef(false);

    const load = useCallback(async () => {
        if (!hasLoaded.current) setLoading(true);
        const [m, b] = await Promise.all([commonGetAPICalls("/crm/team/members"), commonGetAPICalls("/crm/branches")]);
        if (m.success) setMembers(m.data || []);
        if (b.success) {
            setBranches(b.data?.branches || []);
            setRoles(b.data?.roles || []);
        }
        hasLoaded.current = true;
        setLoading(false);
    }, []);
    useEffect(() => { if (isOwner) load(); }, [load, isOwner]);

    if (!isOwner) {
        return (
            <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Roles & branches</h1>
                    <p className="text-sm text-default-500">Only the agency owner can manage roles and branches.</p>
                </div>
            </div>
        );
    }

    const setRole = async (uuid: string, body: object) => {
        setBusy(uuid);
        const { success } = await commonPostAPICall(body, `crm/team/${uuid}/role`, true);
        setBusy(null);
        if (success) load();
    };

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Roles & branches</h1>
                <p className="text-sm text-default-500">Decide what each team member can see. Add people under Team first.</p>
            </div>

            {loading ? (
                <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center gap-2 py-14">
                    <Spinner size="sm" />
                    <span className="text-sm text-default-500">Loading…</span>
                </div>
            ) : (
                <>
                    <div className="rounded-xl border border-default-200 bg-content1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <Building2 size={20} className="text-default-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="font-medium">Branches</div>
                            <div className="text-sm text-default-500">{branches.length ? branches.map((b) => b.name).join(", ") : "No branches yet. Add one if you have more than one office."}</div>
                        </div>
                        <Button color="primary" variant="flat" className="w-full sm:w-auto" onPress={() => navigate("/branches")}>{branches.length ? "Manage branches" : "Add a branch"}</Button>
                    </div>

                    <div className="rounded-xl border border-default-200 bg-content1 p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-foreground">Team members</h2>
                        {members.length === 0 && <span className="text-sm text-default-500">No team members yet.</span>}
                        {members.map((m) => (
                            <div key={m.uuid} className="grid grid-cols-1 md:grid-cols-[1fr_220px_220px] gap-2 items-center border-t border-default-100 pt-3 first:border-0 first:pt-0">
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{m.username}{m.status !== "active" && <span className="text-xs text-default-500"> (inactive)</span>}</div>
                                    <div className="text-xs text-default-500 truncate">{[m.designation, m.phone_number, m.email].filter(Boolean).join(" · ")}</div>
                                </div>
                                <Select size="sm" aria-label="Role" isDisabled={busy === m.uuid} selectedKeys={[m.team_role || "counsellor"]}
                                    onChange={(e) => e.target.value && setRole(m.uuid, { team_role: e.target.value })}>
                                    {roles.map((r: any) => <SelectItem key={r.key}>{r.label}</SelectItem>)}
                                </Select>
                                <Select size="sm" aria-label="Branch" isDisabled={busy === m.uuid} selectedKeys={[m.branch_id ? String(m.branch_id) : "none"]}
                                    onChange={(e) => e.target.value && setRole(m.uuid, { branch_id: e.target.value === "none" ? null : Number(e.target.value) })}>
                                    {[<SelectItem key="none">No branch</SelectItem>, ...branches.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>)]}
                                </Select>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-default-200 bg-content1 p-4 space-y-2 text-sm">
                        <h2 className="text-sm font-semibold text-foreground">What each role can do</h2>
                        {roles.map((r: any) => <div key={r.key}><span className="font-medium">{r.label}:</span> <span className="text-default-600">{ROLE_HELP[r.key]}</span></div>)}
                    </div>
                </>
            )}
        </div>
    );
};

export default RolesAndBranches;
