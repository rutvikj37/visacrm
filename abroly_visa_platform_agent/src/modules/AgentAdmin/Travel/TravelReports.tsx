import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, useDisclosure } from "@heroui/react";
import { Download, Target } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast } from "@/utils/Toaster";
import { PageHead, Tile, fmtDate, rupees } from "./travelShared";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SOURCE: Record<string, string> = { manual: "Added by team", website: "Website", portal: "Portal", csv: "Import", indiamart: "IndiaMART", facebook: "Facebook", whatsapp: "WhatsApp", google: "Google", instagram: "Instagram", justdial: "Justdial", sulekha: "Sulekha", other: "Other" };

/** Sales by agent, destination, source and month; targets; profit; supplier dues; Excel exports incl. TCS (RP-02..RP-04). */
const TravelReports = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const token = useSelector((s: any) => s.login.token);
    const now = new Date();
    const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [to, setTo] = useState(iso(now));
    const [d, setD] = useState<any>(null);
    const targetModal = useDisclosure();
    const [targets, setTargets] = useState<Record<number, string>>({});

    const load = useCallback(async () => {
        setD(null);
        const { success, data } = await commonGetAPICalls(`/travel/reports?from=${from}&to=${to}`);
        if (success) setD(data);
    }, [from, to]);
    useEffect(() => { load(); }, [load]);

    const download = async (type: string) => {
        try {
            const r = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/v1/travel/reports/export?type=${type}&from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" });
            if (String(r.headers["content-type"] || "").includes("json")) { const t = JSON.parse(await (r.data as Blob).text()); return ErrorToast(t.message || "Could not export"); }
            const url = URL.createObjectURL(r.data);
            const a = document.createElement("a"); a.href = url; a.download = `travel-${type}-${from}-to-${to}.xlsx`; a.click(); URL.revokeObjectURL(url);
        } catch (e: any) { ErrorToast(e?.response?.status === 403 ? "Your role can not export this report" : "Could not export"); }
    };

    const openTargets = () => {
        setTargets(Object.fromEntries((d?.team || []).map((t: any) => [t.id, String(d.targets.find((x: any) => x.agent_id === t.id)?.amount || "")])));
        targetModal.onOpen();
    };
    const saveTargets = async (close: () => void) => {
        const { success } = await commonPostAPICall({ month: d.month, targets: Object.entries(targets).map(([agent_id, amount]) => ({ agent_id: Number(agent_id), amount: Number(amount) || 0 })) }, "travel/targets", true);
        if (success) { close(); load(); }
    };

    const Group = ({ title, rows, label = (r: any) => r.name, extra }: { title: string; rows: any[]; label?: (r: any) => string; extra?: (r: any) => any }) => (
        <Card shadow="sm"><CardHeader className="font-semibold">{title}</CardHeader><CardBody className="pt-0">
            {!rows?.length ? <p className="text-sm text-default-500">No bookings in this period.</p> : (
                <table className="w-full text-sm"><thead><tr className="text-xs text-default-500 text-left"><th className="py-1">Name</th><th className="py-1 text-right">Bookings</th><th className="py-1 text-right">Sales</th>{rows[0]?.profit !== undefined && <th className="py-1 text-right">Profit</th>}{extra && <th className="py-1 text-right">Target</th>}</tr></thead>
                    <tbody>{rows.map((r) => (
                        <tr key={r.name} className="border-t border-default-100"><td className="py-1.5">{label(r)}</td><td className="py-1.5 text-right">{r.bookings}</td><td className="py-1.5 text-right">{rupees(r.sell)}</td>{r.profit !== undefined && <td className="py-1.5 text-right">{rupees(r.profit)}</td>}{extra && <td className="py-1.5 text-right">{extra(r)}</td>}</tr>
                    ))}</tbody>
                </table>
            )}
        </CardBody></Card>
    );

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <PageHead title="Travel reports" sub="Sales, profit, targets and supplier dues for the dates you choose"
                actions={<div className="flex gap-2 items-end">
                    <Input aria-label="From" type="date" size="sm" value={from} onValueChange={setFrom} />
                    <Input aria-label="To" type="date" size="sm" value={to} onValueChange={setTo} />
                </div>} />
            {!d ? <div className="py-16 grid place-items-center"><Spinner /></div> : (<>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    <Tile label="Travel enquiries" value={d.totals.enquiries} hint={`${d.totals.conversion}% converted`} />
                    <Tile label="Bookings" value={d.totals.bookings} />
                    <Tile label="Sales" value={rupees(d.totals.sell)} hint="Package price before GST and TCS" />
                    {d.totals.profit !== undefined && <Tile label="Profit" value={rupees(d.totals.profit)} tone={d.totals.profit >= 0 ? "success" : "danger"} />}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => download("sales")}>Sales (Excel)</Button>
                    {d.totals.profit !== undefined && <>
                        <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => download("profit")}>Profit per booking</Button>
                        <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => download("supplier_dues")}>Supplier dues</Button>
                        <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={() => download("tcs")}>TCS collected (for CA)</Button>
                    </>}
                    <Button size="sm" variant="light" startContent={<Target size={14} />} onPress={openTargets}>Targets for {d.month}</Button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Group title="By agent" rows={d.by_agent} extra={(r) => (r.target ? `${rupees(r.target)} (${Math.round(r.sell * 100 / r.target)}%)` : "-")} />
                    <Group title="By destination" rows={d.by_destination} />
                    <Group title="By lead source" rows={d.by_source} label={(r) => SOURCE[r.name] || r.name} />
                    <Group title="By month" rows={d.by_month} label={(r) => new Date(`${r.name}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })} />
                </div>
                {d.supplier_dues?.length > 0 && (
                    <Card shadow="sm"><CardHeader className="font-semibold">Owed to suppliers (all open bookings)</CardHeader><CardBody className="pt-0">
                        <table className="w-full text-sm"><thead><tr className="text-xs text-default-500 text-left"><th className="py-1">Supplier</th><th className="py-1 text-right">Services</th><th className="py-1 text-right">Due</th><th className="py-1 text-right">Overdue</th></tr></thead>
                            <tbody>{d.supplier_dues.map((s: any) => <tr key={s.name} className="border-t border-default-100"><td className="py-1.5">{s.name}</td><td className="py-1.5 text-right">{s.services}</td><td className="py-1.5 text-right">{rupees(s.due)}</td><td className={`py-1.5 text-right ${s.overdue ? "text-danger font-medium" : ""}`}>{rupees(s.overdue)}</td></tr>)}</tbody>
                        </table>
                    </CardBody></Card>
                )}
                <Card shadow="sm"><CardHeader className="font-semibold">Bookings in this period</CardHeader><CardBody className="pt-0 overflow-x-auto">
                    {!d.bookings.length ? <p className="text-sm text-default-500">None.</p> : (
                        <table className="w-full text-sm min-w-[720px]"><thead><tr className="text-xs text-default-500 text-left"><th className="py-1">Booking</th><th className="py-1">Booked</th><th className="py-1">Client</th><th className="py-1">Destination</th><th className="py-1">Agent</th><th className="py-1 text-right">Sales</th>{d.bookings[0]?.profit !== undefined && <><th className="py-1 text-right">Cost</th><th className="py-1 text-right">Profit</th></>}</tr></thead>
                            <tbody>{d.bookings.map((b: any) => <tr key={b.booking_no} className="border-t border-default-100"><td className="py-1.5">{b.booking_no}</td><td className="py-1.5">{fmtDate(b.created)}</td><td className="py-1.5">{b.client}</td><td className="py-1.5">{b.destination}</td><td className="py-1.5">{b.agent}</td><td className="py-1.5 text-right">{rupees(b.sell)}</td>{b.profit !== undefined && <><td className="py-1.5 text-right">{rupees(b.cost)}</td><td className="py-1.5 text-right">{rupees(b.profit)}</td></>}</tr>)}</tbody>
                        </table>
                    )}
                </CardBody></Card>
            </>)}
            <Modal isOpen={targetModal.isOpen} onOpenChange={targetModal.onOpenChange}>
                <ModalContent>{(close) => (<>
                    <ModalHeader>Sales targets for {d?.month}</ModalHeader>
                    <ModalBody className="gap-2">
                        <p className="text-xs text-default-500">Package sales (before GST) each person should book this month. Leave empty for no target.</p>
                        {(d?.team || []).map((t: any) => (
                            <div key={t.id} className="grid grid-cols-2 gap-2 items-center"><span className="text-sm">{t.name}</span><Input aria-label={`Target for ${t.name}`} size="sm" type="number" startContent="₹" value={targets[t.id] || ""} onValueChange={(v) => setTargets((x) => ({ ...x, [t.id]: v }))} /></div>
                        ))}
                    </ModalBody>
                    <ModalFooter><Button variant="light" onPress={close}>Cancel</Button><Button color="primary" onPress={() => saveTargets(close)}>Save targets</Button></ModalFooter>
                </>)}</ModalContent>
            </Modal>
        </div>
    );
};

export default TravelReports;
