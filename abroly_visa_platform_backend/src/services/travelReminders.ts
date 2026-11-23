import { Op } from "sequelize";
import Agent from "../model/Agent";
import { Booking, BookingService, TravelSupplier } from "../model/Travel";
import { activeAgencyUuids, agencyOwnerId, notify } from "./notifications";
import { hasModule } from "./modules";

/**
 * Supplier payment reminders (SP-03): once a day per service, the owner and Accounts hear about supplier
 * payments due in the next 3 days or overdue. Runs from the reminder job (services/scheduler.ts);
 * notify()'s dedupe key keeps it to one notice per service per day.
 */
const istDay = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export const supplierDueReminders = async () => {
    const agencies = await activeAgencyUuids();
    if (!agencies.length) return;
    const day = istDay();
    const soon = new Date(Date.parse(day) + 3 * 864e5).toISOString().slice(0, 10);
    const rows: any[] = await BookingService.findAll({
        where: { agency_uuid: agencies, status: { [Op.ne]: "cancelled" }, supplier_id: { [Op.ne]: null }, supplier_due_date: { [Op.lte]: soon } },
        include: [{ model: TravelSupplier, as: "supplier", attributes: ["name"], required: false }, { model: Booking, as: "booking", attributes: ["uuid", "booking_no", "status"], required: false }],
        limit: 1000,
    });
    const recipientsBy = new Map<string, number[]>();
    for (const r of rows) {
        const x = r.toJSON() as any;
        const due = Number(x.cost) - Number(x.supplier_paid);
        if (due <= 0 || !x.booking || x.booking.status === "cancelled") continue;
        if (!(await hasModule(x.agency_uuid, "suppliers"))) continue;
        let ids = recipientsBy.get(x.agency_uuid);
        if (!ids) {
            const accounts: any[] = await Agent.findAll({ where: { parent_uuid: x.agency_uuid, team_role: "accounts", status: "active" }, attributes: ["id"], raw: true });
            ids = [await agencyOwnerId(x.agency_uuid), ...accounts.map((a) => a.id)].filter(Boolean) as number[];
            recipientsBy.set(x.agency_uuid, ids);
        }
        const overdue = x.supplier_due_date < day;
        await notify({
            agencyUuid: x.agency_uuid,
            recipientIds: ids,
            type: "follow_up_due",
            title: `${overdue ? "Overdue" : "Due soon"}: pay ${x.supplier?.name || "supplier"} Rs ${(due / 100).toLocaleString("en-IN")}`,
            body: `${x.booking.booking_no} · ${x.description} · pay by ${x.supplier_due_date}`,
            link: `/travel/bookings/${x.booking.uuid}`,
            dedupeKey: `supdue:${x.id}:${day}`,
        });
    }
};

/**
 * Automatic client messages for trips (WA-03), using the agency's templates (Messages → When to send):
 *   trip_tomorrow - the day before departure; welcome_back - the day after the trip ends.
 * Each is sent once per booking (booking.messages_sent).
 */
export const tripMessages = async () => {
    const agencies = await activeAgencyUuids();
    if (!agencies.length) return;
    const tomorrow = new Date(Date.parse(istDay()) + 864e5).toISOString().slice(0, 10);
    const yesterday = new Date(Date.parse(istDay()) - 864e5).toISOString().slice(0, 10);
    const { runTrigger } = await import("./messaging");
    const MessageTemplate = (await import("../model/MessageTemplate")).default;
    const User = (await import("../model/User")).default;
    for (const [trigger, field, day] of [["trip_tomorrow", "start_date", tomorrow], ["welcome_back", "end_date", yesterday]] as const) {
        const withTemplate: any[] = await MessageTemplate.findAll({ where: { agency_uuid: agencies, trigger, is_active: 1 }, attributes: ["agency_uuid"], group: ["agency_uuid"], raw: true });
        if (!withTemplate.length) continue;
        const rows: any[] = await Booking.findAll({ where: { agency_uuid: withTemplate.map((t) => t.agency_uuid), status: { [Op.ne]: "cancelled" }, [field]: day }, limit: 500 });
        for (const b of rows) {
            const sent = (b.messages_sent && typeof b.messages_sent === "object" ? b.messages_sent : {}) as Record<string, string>;
            if (sent[trigger]) continue;
            await b.update({ messages_sent: { ...sent, [trigger]: day } });
            const client: any = await User.findByPk(b.dataValues.user_id, { attributes: ["username", "phone_number", "country_code", "email"], raw: true });
            if (!client) continue;
            runTrigger(b.dataValues.agency_uuid, trigger, {
                name: client.username, phoneDigits: client.phone_number ? `${String(client.country_code || "+91").replace(/\D/g, "")}${client.phone_number}` : null, email: client.email, leadId: b.dataValues.crm_lead_id,
            }, { trip: b.dataValues.title, booking_no: b.dataValues.booking_no, start_date: b.dataValues.start_date });
        }
    }
};
