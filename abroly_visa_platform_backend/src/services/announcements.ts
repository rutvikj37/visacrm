import { Op } from "sequelize";
import Agent from "../model/Agent";
import Announcement from "../model/Announcement";
import AnnouncementDismissal from "../model/AnnouncementDismissal";
import { notify } from "./notifications";

/** Platform announcements to agencies: who gets them, publishing (bell + email) and banners. */

const live = () => {
    const now = new Date();
    return {
        status: "published",
        [Op.and]: [
            { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: now } }] },
            { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: now } }] },
        ],
    };
};

/** Does this agency belong to the announcement's audience? */
export const matchesAgency = (a: any, agency: { uuid: string; saas_plan_id: number | null; saas_kind: string | null }) => {
    const x = a.dataValues || a;
    const plans: number[] = (typeof a.get === "function" ? a.get("plan_ids") : x.plan_ids) || [];
    const agencies: string[] = (typeof a.get === "function" ? a.get("agency_uuids") : x.agency_uuids) || [];
    switch (x.audience) {
        case "trial": return agency.saas_kind === "trial";
        case "paid": return agency.saas_kind === "paid" || agency.saas_kind === "complimentary";
        case "plans": return plans.map(Number).includes(Number(agency.saas_plan_id));
        case "agencies": return agencies.includes(agency.uuid);
        default: return true;
    }
};

/** Agency users who should get it (active agencies with access only). */
export const audienceOf = async (announcement: any) => {
    const agencies: any[] = await Agent.findAll({
        where: { role: "agent", status: "active", expires_at: { [Op.gt]: new Date() } },
        attributes: ["id", "uuid", "saas_plan_id", "saas_kind"],
        raw: true,
    });
    const matched = agencies.filter((a) => matchesAgency(announcement, a));
    const people: { id: number; agencyUuid: string }[] = matched.map((a) => ({ id: a.id, agencyUuid: a.uuid }));
    if ((announcement.dataValues || announcement).people === "everyone" && matched.length) {
        const team: any[] = await Agent.findAll({ where: { parent_id: matched.map((a) => a.id), status: "active" }, attributes: ["id", "parent_uuid"], raw: true });
        team.forEach((t) => people.push({ id: t.id, agencyUuid: t.parent_uuid }));
    }
    return { agencies: matched.length, people };
};

/** Bell notification (+ email) to everyone in the audience. Runs in the background. */
export const publishAnnouncement = async (announcement: any) => {
    const a = announcement.dataValues || announcement;
    const { people } = await audienceOf(announcement);
    await Announcement.update({ status: "published", published_at: new Date(), recipients: people.length }, { where: { id: a.id } });
    setImmediate(async () => {
        for (const p of people) {
            await notify({
                agencyUuid: p.agencyUuid, recipientIds: [p.id], type: "announcement",
                title: a.title, body: a.body || null, link: a.link_url && String(a.link_url).startsWith("/") ? a.link_url : null,
                email: Boolean(a.send_email), dedupeKey: `ann:${a.id}`,
            });
        }
    });
    return people.length;
};

/** Banners for one agency user right now. */
export const bannersFor = async (userId: number, agencyUuid: string, isOwner: boolean) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["uuid", "saas_plan_id", "saas_kind"], raw: true });
    if (!agency) return [];
    const rows: any[] = await Announcement.findAll({ where: { ...live(), show_banner: true }, order: [["published_at", "DESC"]], limit: 20 });
    const dismissed = new Set(
        (await AnnouncementDismissal.findAll({ where: { agent_id: userId, announcement_id: rows.map((r) => r.dataValues.id) }, attributes: ["announcement_id"], raw: true }) as any[])
            .map((d) => d.announcement_id),
    );
    return rows
        .filter((r) => !dismissed.has(r.dataValues.id) && (isOwner || r.dataValues.people === "everyone") && matchesAgency(r, agency))
        .slice(0, 3)
        .map((r) => {
            const x = r.toJSON();
            return { id: x.uuid, title: x.title, body: x.body, level: x.level, link_url: x.link_url, link_label: x.link_label, published_at: x.published_at };
        });
};
