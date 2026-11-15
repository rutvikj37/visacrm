import { Button, Checkbox, Chip, Input, Select, SelectItem, Spinner } from '@nextui-org/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, User, MapPin, ClipboardCheck, IdCard, Search, Check, X, Eye, Download, Copy } from 'lucide-react';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { ErrorToast, SuccessToast } from '@/utils/Toaster';
import { BulkBar, CsvColumn, RowActions, downloadCsv, today, useCrossPageSelection } from '@/components/ListTools';

const STATUS_COLOR: Record<string, "warning" | "success" | "danger"> = { pending: "warning", accept: "success", reject: "danger" }
const STATUS_LABEL: Record<string, string> = { pending: "Pending", accept: "Accepted", reject: "Rejected" }
const SORTS = [
    { key: "newest", label: "Newest first" },
    { key: "oldest", label: "Oldest first" },
    { key: "start", label: "Starts soonest" },
]
const iso = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10) : "")
const CSV: CsvColumn<any>[] = [
    { label: "Campaign", value: (r) => r.campaign_title },
    { label: "Agency", value: (r) => r.banner_of?.username },
    { label: "Agency ID", value: (r) => r.banner_of?.uuid },
    { label: "Target", value: (r) => r.target_type },
    { label: "Position", value: (r) => r.position },
    { label: "From", value: (r) => iso(r.start_date) },
    { label: "To", value: (r) => iso(r.end_date) },
    { label: "Status", value: (r) => STATUS_LABEL[r.status] || r.status },
]

const SideBannerAchievements = () => {
    const { commonPostAPICall } = useApiCallUtils()
    const { status } = useParams()
    const navigate = useNavigate()

    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [records, setRecords] = useState<any[]>([])
    const [target, setTarget] = useState("")
    const [position, setPosition] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [sort, setSort] = useState("newest")
    const [busy, setBusy] = useState<string | null>(null)

    const findRecords = async (opts?: { soft?: boolean }) => {
        if (!opts?.soft && records.length === 0) setIsLoading(true)
        const { success, data } = await commonPostAPICall({ status, search }, `/side_banner/admin/list`)
        if (success) setRecords(Array.isArray(data) ? data : [])
        setIsLoading(false)
    }

    useEffect(() => {
        if (!["pending", "history"].includes(status || "")) {
            navigate("/side_banner_achievements/pending", { replace: true })
            return
        }
        setStatusFilter("")
        sel.clear()
        findRecords()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    const searchBootstrapped = useRef(false)
    useEffect(() => {
        if (!searchBootstrapped.current) {
            searchBootstrapped.current = true
            return
        }
        const timeout = setTimeout(() => findRecords({ soft: true }), 500)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    const targets = useMemo(() => [...new Set(records.map((r) => r.target_type).filter(Boolean))].sort(), [records])
    const shown = useMemo(() => {
        const list = records.filter((r) =>
            (!target || r.target_type === target) &&
            (!position || String(r.position) === position) &&
            (!statusFilter || r.status === statusFilter))
        const time = (v?: string) => (v ? new Date(v).getTime() : 0)
        return [...list].sort((a, b) =>
            sort === "oldest" ? time(a.createdAt) - time(b.createdAt)
                : sort === "start" ? time(a.start_date) - time(b.start_date)
                    : time(b.createdAt) - time(a.createdAt))
    }, [records, target, position, statusFilter, sort])

    const sel = useCrossPageSelection(shown, (r: any) => r.uuid)
    const filtersOn = Boolean(search || target || position || statusFilter)
    const clearFilters = () => { setSearch(""); setTarget(""); setPosition(""); setStatusFilter("") }

    const actionApiCall = async (uuid: string, action: "accept" | "reject") => {
        setBusy(`${uuid}:${action}`)
        const { success } = await commonPostAPICall({ uuid, status: action }, "/side_banner/admin/action", true)
        setBusy(null)
        if (success) findRecords({ soft: true })
    }

    // Rejecting gives the agency its banner credit back, so never reject one that's already rejected,
    // and only accept pending ones (accepting a rejected one would keep the refunded credit).
    const bulk = async (action: "accept" | "reject") => {
        const todo = sel.selectedRows.filter((r: any) => (action === "accept" ? r.status === "pending" : r.status !== "reject"))
        const skipped = sel.selectedRows.length - todo.length
        if (!todo.length) return ErrorToast(action === "accept" ? "Only pending banners can be accepted" : "All selected banners are already rejected")
        if (action === "reject" && !window.confirm(`Reject ${todo.length} banner(s)? Each agency gets its banner credit back.`)) return
        setBusy(`bulk:${action}`)
        let ok = 0
        for (const r of todo) {
            const { success } = await commonPostAPICall({ uuid: r.uuid, status: action }, "/side_banner/admin/action")
            if (success) ok++
        }
        setBusy(null)
        const failed = todo.length - ok
        const msg = `${ok} banner(s) ${action === "accept" ? "accepted" : "rejected"}${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}`
        if (ok) SuccessToast(msg); else ErrorToast(msg)
        sel.clear()
        findRecords({ soft: true })
    }

    const count = sel.ids.length
    const allShownSelected = shown.length > 0 && shown.every((r) => sel.selected.has(r.uuid))

    return (
        <div className='flex flex-col gap-4 max-w-full'>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{status === "history" ? "Achievement history" : "Achievement requests"}</h1>
                    <p className="text-sm text-default-500">{status === "history" ? "Banners you've accepted or rejected." : "Banners agencies submitted for approval."}</p>
                </div>
                <Button variant="flat" startContent={<Download size={16} />} onPress={() => shown.length ? downloadCsv(`achievements-${status}-${today()}`, CSV, shown) : ErrorToast("Nothing to export")}>Export</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <Input
                    aria-label="Search"
                    size="sm"
                    startContent={<Search size={16} className='text-default-400' />}
                    placeholder='Search campaign, agency name or ID'
                    value={search}
                    onValueChange={setSearch}
                    isClearable
                    onClear={() => setSearch("")}
                />
                <Select aria-label="Target" size="sm" placeholder="All targets" selectedKeys={target ? [target] : []} onChange={(e) => setTarget(e.target.value)}>
                    {targets.map((t) => <SelectItem key={t}>{String(t).toUpperCase()}</SelectItem>)}
                </Select>
                <Select aria-label="Position" size="sm" placeholder="All positions" selectedKeys={position ? [position] : []} onChange={(e) => setPosition(e.target.value)}>
                    <SelectItem key="1">Position 1</SelectItem>
                    <SelectItem key="2">Position 2</SelectItem>
                </Select>
                {status === "history" ? (
                    <Select aria-label="Status" size="sm" placeholder="Accepted & rejected" selectedKeys={statusFilter ? [statusFilter] : []} onChange={(e) => setStatusFilter(e.target.value)}>
                        <SelectItem key="accept">Accepted</SelectItem>
                        <SelectItem key="reject">Rejected</SelectItem>
                    </Select>
                ) : <span className="hidden xl:block" />}
                <Select aria-label="Sort" size="sm" selectedKeys={[sort]} onChange={(e) => setSort(e.target.value || "newest")}>
                    {SORTS.map((s) => <SelectItem key={s.key}>{`Sort: ${s.label.toLowerCase()}`}</SelectItem>)}
                </Select>
                {filtersOn ? <Button size="sm" variant="light" onPress={clearFilters}>Clear filters</Button> : <span className="hidden xl:block" />}
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
                <Checkbox
                    isSelected={allShownSelected}
                    isIndeterminate={count > 0 && !allShownSelected}
                    isDisabled={!shown.length}
                    onValueChange={(v) => (v ? sel.addAll(shown) : sel.clear())}
                >
                    Select all{shown.length ? ` (${shown.length})` : ""}
                </Checkbox>
                <span className="text-default-500">{shown.length} of {records.length} shown</span>
            </div>

            <BulkBar count={count} onClear={sel.clear}>
                <Button size="sm" variant="flat" color="success" startContent={<Check size={14} />} isLoading={busy === "bulk:accept"} onPress={() => bulk("accept")}>Accept</Button>
                <Button size="sm" variant="flat" color="danger" startContent={<X size={14} />} isLoading={busy === "bulk:reject"} onPress={() => bulk("reject")}>Reject</Button>
                <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => downloadCsv(`achievements-selected-${today()}`, CSV, sel.selectedRows)}>Export</Button>
            </BulkBar>

            {isLoading && records.length === 0 ? (
                <div className="flex justify-center my-5"><Spinner /></div>
            ) : !shown.length ? (
                <p className="text-center text-sm text-default-500 py-10">{filtersOn ? "No banners match these filters" : status === "history" ? "No accepted or rejected banners yet" : "No pending requests"}</p>
            ) : (
                <section className='grid lg:grid-cols-2 gap-3'>
                    {shown.map((record: any) => {
                        const picked = sel.selected.has(record.uuid)
                        return (
                            <div key={record.uuid} className={`bg-content1 rounded-xl border overflow-hidden ${picked ? "border-primary" : "border-default-200"}`}>
                                <div className="relative w-full h-44 bg-default-50">
                                    <img src={record?.access_image} alt={record?.campaign_title} className="w-full h-full object-scale-down" />
                                    <div className="absolute top-2 left-2 rounded-md bg-content1/90 p-1">
                                        <Checkbox aria-label={`Select ${record?.campaign_title}`} isSelected={picked} onValueChange={() => sel.toggle(record)} />
                                    </div>
                                    <div className="absolute bottom-2 left-2 bg-default-800/80 text-white text-xs px-2 py-0.5 rounded">Pos {record?.position}</div>
                                    <div className="absolute top-2 right-2 rounded-md bg-content1/90">
                                        <RowActions label={`Actions for ${record?.campaign_title}`} actions={[
                                            { key: "responses", label: "View responses", icon: <Eye size={16} />, onPress: () => navigate(`/side_banner_responses/${record.uuid}`) },
                                            { key: "accept", label: "Accept", icon: <Check size={16} />, onPress: () => actionApiCall(record.uuid, "accept"), hidden: record.status !== "pending" },
                                            { key: "copy", label: "Copy agency ID", icon: <Copy size={16} />, onPress: () => navigator.clipboard.writeText(record?.banner_of?.uuid || "").then(() => SuccessToast("Agency ID copied")), hidden: !record?.banner_of?.uuid },
                                            { key: "reject", label: "Reject", icon: <X size={16} />, danger: true, onPress: () => actionApiCall(record.uuid, "reject"), hidden: record.status === "reject" },
                                        ]} />
                                    </div>
                                </div>

                                <div className="p-3 flex flex-col gap-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <h2 className="text-base font-semibold">{record?.campaign_title}</h2>
                                        <Chip size="sm" variant="flat" color={STATUS_COLOR[record?.status] || "default"}>{STATUS_LABEL[record?.status] || record?.status}</Chip>
                                    </div>
                                    <p className="text-sm text-default-600 flex items-center gap-2"><User size={14} /> {record?.banner_of?.username}</p>
                                    <p className="text-sm text-default-600 flex items-center gap-2"><IdCard size={14} /> <span className="truncate">{record?.banner_of?.uuid}</span></p>
                                    <p className="text-sm text-default-600 flex items-center gap-2"><Calendar size={14} /> {new Date(record?.start_date).toDateString()} – {new Date(record?.end_date).toDateString()}</p>
                                    <p className="text-sm text-default-600 flex items-center gap-2"><MapPin size={14} /> Target: {String(record?.target_type || "").toUpperCase()}</p>
                                    <p className="text-sm text-default-600 flex items-center gap-2"><ClipboardCheck size={14} /> Requested {record?.createdAt ? new Date(record.createdAt).toDateString() : "-"}</p>
                                </div>
                            </div>
                        )
                    })}
                </section>
            )}
        </div>
    )
}

export default SideBannerAchievements
