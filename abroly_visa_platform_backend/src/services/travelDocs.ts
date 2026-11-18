/**
 * Travel documents for tourist / business visa cases, stored as JSON in agency_leads.travel_docs:
 * the trip, a day-by-day itinerary, flights, a cover letter and a funds check. Staff edit it on the
 * case page; when `shared` is on, the client can view and print it in the portal.
 */
const str = (v: any, max = 255) => (v === null || v === undefined ? "" : String(v).replace(/\u0000/g, "").trim().slice(0, max));
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
const list = <T>(v: any, max: number, map: (x: any) => T): T[] => (Array.isArray(v) ? v.slice(0, max).map(map) : []);

export type TravelDocs = ReturnType<typeof sanitizeTravelDocs>;

export const sanitizeTravelDocs = (raw: any) => {
    const d = raw && typeof raw === "object" ? raw : {};
    const t = d.trip || {};
    const c = d.cover_letter || {};
    const f = d.funds || {};
    return {
        trip: {
            purpose: ["tourism", "business", "family", "conference"].includes(t.purpose) ? t.purpose : "tourism",
            destination: str(t.destination),
            from_city: str(t.from_city),
            start_date: date(t.start_date),
            end_date: date(t.end_date),
            travellers: list(t.travellers, 12, (x) => ({ name: str(x?.name), passport_no: str(x?.passport_no, 30), relation: str(x?.relation, 60) })),
            host: str(t.host, 500), // inviting company / event / relative
        },
        itinerary: list(d.itinerary, 60, (x) => ({ date: date(x?.date), city: str(x?.city), plan: str(x?.plan, 1000), stay: str(x?.stay, 300) })),
        flights: list(d.flights, 12, (x) => ({ date: date(x?.date), from: str(x?.from, 120), to: str(x?.to, 120), flight: str(x?.flight, 60) })),
        cover_letter: {
            kind: ["tourist", "business"].includes(c.kind) ? c.kind : "tourist",
            addressed_to: str(c.addressed_to, 300),
            subject: str(c.subject, 300),
            body: str(c.body, 8000),
            signed_by: str(c.signed_by, 300),
        },
        funds: { country_key: str(f.country_key, 40), days: num(f.days), balance: num(f.balance), trip_cost: num(f.trip_cost), sponsor: str(f.sponsor, 200) },
        shared: Boolean(d.shared),
        updated_at: str(d.updated_at, 40),
    };
};

export const readTravelDocs = (raw: any): TravelDocs | null => {
    if (!raw) return null;
    try { return sanitizeTravelDocs(typeof raw === "string" ? JSON.parse(raw) : raw); } catch { return null; }
};
