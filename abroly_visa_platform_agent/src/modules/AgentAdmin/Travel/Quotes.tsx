import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardBody, Chip, Tab, Tabs } from "@heroui/react";
import { FileText } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { PageHead, QUOTE_STATUS, fmtDate, rupees } from "./travelShared";

/** All quotes with their status. New quotes start from a lead or an itinerary. */
const Quotes = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { commonGetAPICalls } = useApiCallUtils();
    const status = params.get("status") || "";
    const [rows, setRows] = useState<any[] | null>(null);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/travel/quotes${status ? `?status=${status}` : ""}`);
        setRows(success ? data : []);
    }, [status]);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <PageHead title="Quotes" sub="Priced trips with options, GST and TCS. Start one from a lead or an itinerary." />
            <div className="overflow-x-auto">
                <Tabs selectedKey={status || "all"} onSelectionChange={(k) => setParams(k === "all" ? {} : { status: String(k) }, { replace: true })} variant="underlined" aria-label="Quote status">
                    <Tab key="all" title="All" /><Tab key="draft" title="Draft" /><Tab key="sent" title="Sent" /><Tab key="accepted" title="Booked" /><Tab key="rejected" title="Lost" />
                </Tabs>
            </div>
            {rows === null ? <CardListSkeleton /> : !rows.length ? (
                <EmptyState icon={FileText} title="No quotes here" text="Open a travel lead or an itinerary and choose “Price this trip” to make a quote." />
            ) : (
                <div className="flex flex-col gap-2">
                    {rows.map((q) => (
                        <Card key={q.id} isPressable shadow="sm" onPress={() => navigate(`/travel/quotes/${q.id}`)}>
                            <CardBody className="flex-row items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate">{q.title}</div>
                                    <div className="text-xs text-default-500 truncate">{q.number} v{q.version} · {q.lead?.name || "No lead"} · {fmtDate(q.createdAt)}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-semibold">{rupees(q.sell_total)}</div>
                                    <Chip size="sm" variant="flat" color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Quotes;
