import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Select, SelectItem } from "@heroui/react";
import { Building2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

/**
 * Branch helpers for the agency panel.
 *   useBranches()     - the agency's branches (fetched once per page load and shared)
 *   useBranchAccess() - who may pick / move branches
 *   BranchPicker      - "All branches / <branch> / No branch" filter; hidden when the person can't choose or there are no branches
 *   branchQuery(v)    - "&branch=..." for API calls
 */

export interface Branch { id: number; name: string; city?: string | null }

let cache: Branch[] | null = null;
let pending: Promise<Branch[]> | null = null;
const listeners = new Set<(b: Branch[]) => void>();

/** Call after adding / renaming / removing a branch so every picker refreshes. */
export const refreshBranches = () => { cache = null; pending = null; };

export const useBranches = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const [branches, setBranches] = useState<Branch[]>(cache || []);
    useEffect(() => {
        listeners.add(setBranches);
        if (cache) setBranches(cache);
        else {
            pending = pending || commonGetAPICalls("/crm/branches").then(({ success, data }) => {
                cache = success ? (data?.branches || []).map((b: any) => ({ id: b.id, name: b.name, city: b.city })) : [];
                listeners.forEach((fn) => fn(cache as Branch[]));
                return cache as Branch[];
            });
        }
        return () => { listeners.delete(setBranches); };
    }, []);
    return branches;
};

export const useBranchAccess = () => {
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const myBranch = useSelector((state: any) => state.login.branch_id) as number | null;
    return {
        isOwner,
        myBranch,
        /** may filter by branch: owner, accounts, or a manager without a branch (sees the whole agency) */
        canPick: isOwner || teamRole === "accounts" || (teamRole === "branch_manager" && !myBranch),
        /** may move leads / cases to another branch */
        canMove: isOwner || teamRole === "branch_manager",
    };
};

export const branchQuery = (value: string) => (value ? `&branch=${encodeURIComponent(value)}` : "");

export const branchName = (branches: Branch[], id?: number | null) =>
    id ? branches.find((b) => b.id === Number(id))?.name || "Branch" : null;

export const BranchPicker = ({ value, onChange, className = "w-full sm:w-48", size = "sm" }: { value: string; onChange: (v: string) => void; className?: string; size?: "sm" | "md" }) => {
    const branches = useBranches();
    const { canPick } = useBranchAccess();
    if (!canPick || !branches.length) return null;
    return (
        <Select aria-label="Branch" size={size} className={className} startContent={<Building2 size={14} className="text-default-500" />}
            selectedKeys={[value || "all"]} onChange={(e) => onChange(e.target.value === "all" || !e.target.value ? "" : e.target.value)}>
            {[
                <SelectItem key="all">All branches</SelectItem>,
                ...branches.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>),
                <SelectItem key="none">No branch</SelectItem>,
            ]}
        </Select>
    );
};

/** Select to move one lead / case to a branch. */
export const BranchMoveSelect = ({ value, onMove, isDisabled, label }: { value?: number | null; onMove: (branchId: number | null) => void; isDisabled?: boolean; label?: string }) => {
    const branches = useBranches();
    const { canMove } = useBranchAccess();
    if (!branches.length) return null;
    const current = value ? String(value) : "none";
    const wrap = (node: any) => label ? <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-default-600">{label}</span>{node}</div> : node;
    if (!canMove) return wrap(<span className="text-sm py-1.5 flex items-center gap-1"><Building2 size={14} />{branchName(branches, value) || "No branch"}</span>);
    return wrap(
        <Select aria-label="Branch" size="sm" isDisabled={isDisabled} startContent={<Building2 size={14} className="text-default-500" />} selectedKeys={[current]}
            onChange={(e) => { const v = e.target.value; if (v && v !== current && window.confirm(`Move to ${v === "none" ? "no branch" : branchName(branches, Number(v))}?`)) onMove(v === "none" ? null : Number(v)); }}>
            {[...branches.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>), <SelectItem key="none">No branch</SelectItem>]}
        </Select>
    );
};

