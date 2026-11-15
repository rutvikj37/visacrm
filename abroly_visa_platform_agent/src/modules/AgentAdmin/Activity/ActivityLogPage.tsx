import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Card, CardBody, Input, Pagination, Select, SelectItem } from "@heroui/react";
import { History, Search } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { BranchPicker, branchQuery } from "@/modules/AgentAdmin/Branches/branchShared";
import { ListSkeleton } from "@/components/ui-kit/Skeletons";
import HistoryList, { HistoryEntry } from "./HistoryList";

const ENTITIES = [
    { key: "", label: "Everything" }, { key: "case", label: "Visa cases" }, { key: "invoice", label: "Invoices & payments" },
    { key: "lead", label: "Leads (delete, bulk, import)" }, { key: "team", label: "Team" },
];
const linkFor = (e: HistoryEntry) => (e.entity === "case" && e.entity_id ? `/leads/progress/${e.entity_id}` : null);

/** Owner / branch manager: everything that changed in the agency, newest first. */
const ActivityLogPage = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const isOwner = useSelector((s: any) => s.login.role_type) === "agent";
    const [data, setData] = useState<any>(null);
    const [entity, setEntity] = useState("");
    const [actor, setActor] = useState("");
    const [q, setQ] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [branch, setBranch] = useState("");
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        const qs = new URLSearchParams({ page: String(page), ...(entity && { entity }), ...(actor && { actor }), ...(q && { q }), ...(from && { from }), ...(to && { to }) });
        const { success, data, message } = await commonGetAPICalls(`/crm/activity_log?${qs}${branchQuery(branch)}`);
        setData(success ? data : { entries: [], total: 0, pages: 0, people: [], error: message });
    }, [entity, actor, q, from, to, branch, page]);
    useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load]);
    useEffect(() => { setPage(1); }, [entity, actor, q, from, to, branch]);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-4xl">
            <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2"><History size={24} /> Activity log</h1>
                <p className="text-sm text-default-500">Who changed what: case stages and results, steps, documents, invoices and payments, deleted or bulk-edited leads and team roles.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <Input className="col-span-2" size="sm" aria-label="Search" placeholder="Search, e.g. a student or invoice number" startContent={<Search size={14} />} value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
                <Select size="sm" aria-label="What" selectedKeys={[entity]} onChange={(e) => setEntity(e.target.value)}>
                    {ENTITIES.map((x) => <SelectItem key={x.key}>{x.label}</SelectItem>)}
                </Select>
                <Select size="sm" aria-label="Who" placeholder="Anyone" selectedKeys={actor ? [actor] : []} onChange={(e) => setActor(e.target.value)}>
                    {(data?.people || []).map((p: any) => <SelectItem key={String(p.actor_id)}>{p.actor_name}</SelectItem>)}
                </Select>
                <Input size="sm" type="date" aria-label="From" value={from} onValueChange={setFrom} />
                <Input size="sm" type="date" aria-label="To" value={to} onValueChange={setTo} />
            </div>
            {isOwner && <div className="-mt-2"><BranchPicker value={branch} onChange={setBranch} /></div>}
            <Card shadow="sm">
                <CardBody>
                    {!data ? <ListSkeleton /> : data.error ? <div className="text-sm text-default-500">{data.error}</div> : (
                        <HistoryList entries={data.entries} empty="Nothing matches these filters."
                            extra={(e) => linkFor(e) ? <> · <button type="button" className="text-primary" onClick={() => navigate(linkFor(e)!)}>Open case</button></> : null} />
                    )}
                </CardBody>
            </Card>
            {data?.pages > 1 && <Pagination className="self-center" total={data.pages} page={page} onChange={setPage} />}
            {data?.total ? <p className="text-xs text-default-500 -mt-2">{data.total} entries. Conversations and calls stay on each lead's own timeline.</p> : null}
        </div>
    );
};

export default ActivityLogPage;
