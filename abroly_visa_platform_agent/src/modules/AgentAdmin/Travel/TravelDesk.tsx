import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { CalendarDays, FileText, Map, Plane, Plus, Truck } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import useModules from "@/hooks/useModules";
import EmptyState from "@/components/ui-kit/EmptyState";
import { BOOKING_STATUS, PageHead, Tile, fmtRange, rupees } from "./travelShared";

/** Travel desk: this month's numbers, upcoming departures and shortcuts (RP-01). */
const TravelDesk = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const { has } = useModules();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        (async () => {
            const { success, data } = await commonGetAPICalls("/travel/summary");
            if (success) setData(data);
        })();
    }, []);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead
                title="Travel desk"
                sub="Enquiries, quotes, departures and money for your trips"
                actions={<>
                    {has("itinerary") && <Button variant="flat" startContent={<Map size={16} />} onPress={() => navigate("/travel/itineraries?new=1")}>New itinerary</Button>}
                    <Button color="primary" startContent={<Plus size={16} />} onPress={() => navigate("/crm/leads?new=travel")}>New enquiry</Button>
                </>}
            />
            {!data ? <div className="py-16 grid place-items-center"><Spinner /></div> : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                        <Tile label="Travel enquiries this month" value={data.enquiries_this_month} />
                        <Tile label="Open quotes" value={data.open_quotes} hint="Draft or sent" />
                        <Tile label="Bookings this month" value={data.bookings_this_month} hint={data.revenue_this_month !== undefined ? `${rupees(data.revenue_this_month)} sold` : undefined} />
                        {data.profit_this_month !== undefined
                            ? <Tile label="Profit this month" value={rupees(data.profit_this_month)} tone={data.profit_this_month >= 0 ? "success" : "danger"} hint="Selling price minus supplier cost" />
                            : <Tile label="Upcoming departures" value={data.upcoming?.length || 0} hint="Next 30 days" />}
                    </div>
                    {data.supplier_due !== undefined && has("suppliers") && (
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <Tile label="Owed to suppliers" value={rupees(data.supplier_due)} />
                            <Tile label="Supplier payments overdue" value={rupees(data.supplier_overdue)} tone={data.supplier_overdue > 0 ? "danger" : undefined} />
                        </div>
                    )}
                    <Card shadow="sm">
                        <CardBody className="gap-2">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold flex items-center gap-2"><Plane size={18} /> Departures in the next 30 days</div>
                                {has("bookings") && <Button size="sm" variant="light" onPress={() => navigate("/travel/bookings")}>All bookings</Button>}
                            </div>
                            {!data.upcoming?.length ? (
                                <EmptyState compact icon={CalendarDays} title="No departures coming up" text="Confirmed bookings starting in the next 30 days show here." />
                            ) : (
                                <div className="flex flex-col divide-y divide-default-100">
                                    {data.upcoming.map((b: any) => (
                                        <button key={b.id} type="button" onClick={() => navigate(`/travel/bookings/${b.id}`)} className="text-left py-2.5 flex items-center gap-3 hover:bg-default-50 rounded-lg px-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium truncate">{b.title}</div>
                                                <div className="text-xs text-default-500 truncate">{b.booking_no} · {b.client?.name} · {fmtRange(b.start_date, b.end_date)}</div>
                                            </div>
                                            <Chip size="sm" variant="flat" color={BOOKING_STATUS[b.status]?.color}>{BOOKING_STATUS[b.status]?.label}</Chip>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardBody>
                    </Card>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {has("itinerary") && <Button variant="flat" startContent={<FileText size={16} />} onPress={() => navigate("/travel/quotes")}>Quotes</Button>}
                        {has("itinerary") && <Button variant="flat" startContent={<Map size={16} />} onPress={() => navigate("/travel/packages")}>Packages</Button>}
                        {has("suppliers") && <Button variant="flat" startContent={<Truck size={16} />} onPress={() => navigate("/travel/suppliers")}>Suppliers</Button>}
                        {has("bookings") && <Button variant="flat" startContent={<CalendarDays size={16} />} onPress={() => navigate("/travel/bookings?view=calendar")}>Operations calendar</Button>}
                    </div>
                </>
            )}
        </div>
    );
};

export default TravelDesk;
