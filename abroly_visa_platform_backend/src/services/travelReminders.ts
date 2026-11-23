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
