import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, CardBody, Chip, Input, Pagination, Spinner } from "@heroui/react";
import { ArrowLeft, Cake, MessageCircle, Search, Users } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import EmptyState from "@/components/ui-kit/EmptyState";
import { CardListSkeleton } from "@/components/ui-kit/Skeletons";
import { PageHead, fmtDate, rupees } from "./travelShared";
import { ClientProfileCard } from "./BookingExtras";

const soon = (d?: string | null) => {
    if (!d) return false;
    const now = new Date();
    const next = new Date(now.getFullYear(), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
    if (next < new Date(now.toDateString())) next.setFullYear(now.getFullYear() + 1);
    return (next.getTime() - now.getTime()) / 864e5 <= 30;
};

/** Contacts / travellers directory: every client with trips, spend, family and dates, for repeat business. */
export const Clients = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [d, setD] = useState<any>(null);
    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls(`/travel/clients?page=${page}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`);
        setD(success ? data : { clients: [], total: 0 });
    }, [page, search]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <PageHead title="Travellers" sub="Every client who has travelled with you, their family, trips and dates" />
            <Input aria-label="Search" className="sm:max-w-sm" placeholder="Search name, phone or email" startContent={<Search size={16} />} value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} isClearable onClear={() => setSearch("")} />
            {!d ? <CardListSkeleton /> : !d.clients.length ? (
                <EmptyState icon={Users} title={search ? "No one matches" : "No travellers yet"} text="Clients appear here after their first booking, or when you save family members on a booking." />
            ) : (<>
                <div className="flex flex-col gap-2">
                    {d.clients.map((c: any) => (
                        <Card key={c.id} isPressable shadow="sm" onPress={() => navigate(`/travel/clients/${c.id}`)}>
                            <CardBody className="flex-row items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate flex items-center gap-2">{c.name}{(soon(c.birthday) || soon(c.anniversary)) && <Chip size="sm" variant="flat" color="secondary" startContent={<Cake size={12} />}>{soon(c.birthday) ? "Birthday soon" : "Anniversary soon"}</Chip>}</div>
                                    <div className="text-xs text-default-500 truncate">{[c.phone, c.email, c.family ? `${c.family} family member${c.family > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")}</div>
                                    <div className="text-xs text-default-500 truncate">{c.next_trip ? `Next: ${c.next_trip.destination || "trip"} on ${fmtDate(c.next_trip.date)}` : c.last_trip ? `Last trip: ${c.last_trip.destination || "trip"}, ${fmtDate(c.last_trip.date)}` : "No trips yet"}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-semibold">{rupees(c.spend)}</div>
                                    <div className="text-xs text-default-500">{c.trips} trip{c.trips === 1 ? "" : "s"}</div>
                                </div>
                                {c.phone_digits && <Button as="a" href={`https://wa.me/${c.phone_digits}`} target="_blank" rel="noopener" isIconOnly size="sm" variant="flat" color="success" aria-label="WhatsApp" onClick={(e: any) => e.stopPropagation()}><MessageCircle size={14} /></Button>}
                            </CardBody>
                        </Card>
                    ))}
                </div>
                {d.total > 50 && <Pagination className="self-center" total={Math.ceil(d.total / 50)} page={page} onChange={setPage} />}
            </>)}
        </div>
    );
};

/** One traveller: profile, preferences, family and all trips. */
export const ClientPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [d, setD] = useState<any>(null);
    const load = async () => { const { success, data } = await commonGetAPICalls(`/travel/clients/${id}`); if (success) setD(data); };
    useEffect(() => { load(); }, [id]);
    if (!d) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <div className="flex items-center gap-2">
                <Button isIconOnly variant="light" aria-label="Back" onPress={() => navigate("/travel/clients")}><ArrowLeft size={18} /></Button>
                <div><h1 className="text-xl font-semibold">{d.client.name}</h1><div className="text-xs text-default-500">{[d.client.phone, d.client.email].filter(Boolean).join(" · ")}</div></div>
            </div>
            <Card shadow="sm"><CardBody className="gap-2">
                <div className="font-semibold">Trips</div>
                {!d.trips.length ? <p className="text-sm text-default-500">No bookings yet.</p> : d.trips.map((t: any) => (
                    <button key={t.id} type="button" onClick={() => navigate(`/travel/bookings/${t.id}`)} className="text-left rounded-lg hover:bg-default-50 px-1 py-1.5 flex items-center gap-3">
                        <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{t.title}</div><div className="text-xs text-default-500">{t.booking_no} · {fmtDate(t.start_date)} · {t.status}</div></div>
                        <div className="text-sm font-medium">{rupees(t.value)}</div>
                    </button>
                ))}
            </CardBody></Card>
            <ClientProfileCard clientId={Number(id)} bookingId="" onChanged={load} />
        </div>
    );
};
