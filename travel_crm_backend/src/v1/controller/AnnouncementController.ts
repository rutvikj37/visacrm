import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Agent from "../../model/Agent";
import Announcement from "../../model/Announcement";
import AnnouncementDismissal from "../../model/AnnouncementDismissal";
import SaasPlan from "../../model/SaasPlan";
import { audienceOf, bannersFor, publishAnnouncement } from "../../services/announcements";

/** Platform announcements: admin writes them, agencies see banners and bell notifications. */

class BadInput extends Error { }

const fail = (res: Response, error: any, where: string) => {
    if (error instanceof BadInput) return returnHelper(res, 200, false, error.message);
    console.error(`announcement ${where} failed`, error);
    return returnHelper(res, 500, false, "Something went wrong");
};

const read = async (b: any) => {
    const title = String(b?.title || "").trim().slice(0, 255);
    if (!title) throw new BadInput("Please enter a title");
    const audience = ["all", "trial", "paid", "plans", "agencies"].includes(b?.audience) ? b.audience : "all";
    let planIds: number[] | null = null, agencyUuids: string[] | null = null;
    if (audience === "plans") {
        const plans: any[] = Array.isArray(b?.plan_ids) && b.plan_ids.length ? await SaasPlan.findAll({ where: { uuid: b.plan_ids }, attributes: ["id"], raw: true }) : [];
        if (!plans.length) throw new BadInput("Please choose at least one plan");
        planIds = plans.map((p) => p.id);
    }
    if (audience === "agencies") {
        const list: any[] = Array.isArray(b?.agency_uuids) && b.agency_uuids.length ? await Agent.findAll({ where: { uuid: b.agency_uuids, role: "agent" }, attributes: ["uuid"], raw: true }) : [];
        if (!list.length) throw new BadInput("Please choose at least one agency");
        agencyUuids = list.map((a) => a.uuid);
    }
    const date = (v: any) => {
        if (!v) return null;
        const d = new Date(v);
        if (isNaN(d.getTime())) throw new BadInput("Please enter valid dates");
        return d;
    };
    const link = String(b?.link_url || "").trim();
    if (link && !/^(https?:\/\/|\/)/.test(link)) throw new BadInput("Link must start with https:// or / (a page in the agency panel)");
    const startsAt = date(b?.starts_at), endsAt = date(b?.ends_at);
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadInput("End must be after the start");
    return {
        title,
        body: b?.body ? String(b.body).trim().slice(0, 3000) : null,
        level: ["info", "success", "warning"].includes(b?.level) ? b.level : "info",
        link_url: link ? link.slice(0, 500) : null,
        link_label: link ? (String(b?.link_label || "").trim().slice(0, 60) || "Learn more") : null,
        audience, plan_ids: planIds, agency_uuids: agencyUuids,
        people: b?.people === "owners" ? "owners" : "everyone",
        show_banner: b?.show_banner === undefined ? true : Boolean(b.show_banner),
        send_email: Boolean(b?.send_email),
        starts_at: startsAt, ends_at: endsAt,
    };
};

const present = async (a: any, planUuids: Record<number, string>) => {
    const x = a.toJSON();
    const now = Date.now();
    const state = x.status === "published"
        ? (x.ends_at && new Date(x.ends_at).getTime() <= now ? "ended" : x.starts_at && new Date(x.starts_at).getTime() > now ? "scheduled" : "live")
        : x.status;
    return {
        id: x.uuid, title: x.title, body: x.body, level: x.level, link_url: x.link_url, link_label: x.link_label,
        audience: x.audience, plan_ids: (a.get("plan_ids") || []).map((id: number) => planUuids[id]).filter(Boolean), agency_uuids: a.get("agency_uuids") || [],
        people: x.people, show_banner: Boolean(x.show_banner), send_email: Boolean(x.send_email),
        starts_at: x.starts_at, ends_at: x.ends_at, status: x.status, state, published_at: x.published_at, recipients: x.recipients,
        dismissed: await AnnouncementDismissal.count({ where: { announcement_id: x.id } }),
        createdAt: x.createdAt,
    };
};

class AnnouncementController {
    // ---------------------------------------------------------------- admin

    // GET /saas_admin/announcements
    async list(req: RequestWithUser, res: Response) {
        try {
            const [rows, plans] = await Promise.all([
                Announcement.findAll({ order: [["createdAt", "DESC"]], limit: 100 }),
                SaasPlan.findAll({ attributes: ["id", "uuid"], raw: true }),
            ]);
            const planUuids = Object.fromEntries((plans as any[]).map((p) => [p.id, p.uuid]));
            return returnHelper(res, 200, true, "Announcements", await Promise.all(rows.map((r) => present(r, planUuids))));
        } catch (error) {
            return fail(res, error, "list");
        }
    }

    // POST /saas_admin/announcements/preview  { audience, plan_ids, agency_uuids, people }  - how many people get it
    async preview(req: RequestWithUser, res: Response) {
        try {
            const data = await read({ title: "x", ...req.body });
            const { agencies, people } = await audienceOf(data);
            return returnHelper(res, 200, true, "Audience", { agencies, people: people.length });
        } catch (error) {
            return fail(res, error, "preview");
        }
    }

    // POST /saas_admin/announcements  { ..., publish }  and  /saas_admin/announcements/:uuid/update
    async save(req: RequestWithUser, res: Response) {
        try {
            const data = await read(req.body || {});
            let row: any;
            if (req.params.uuid) {
                row = await Announcement.findOne({ where: { uuid: req.params.uuid } });
                if (!row) return returnHelper(res, 200, false, "Announcement not found");
                await row.update(data);
            } else {
                row = await Announcement.create({ ...data, status: "draft", created_by_admin: req.id || null });
            }
            if (req.body?.publish && row.dataValues.status === "draft") {
                const n = await publishAnnouncement(row);
                return returnHelper(res, 200, true, n ? `Published to ${n} ${n === 1 ? "person" : "people"}` : "Published (no agency matches this audience right now)");
            }
            return returnHelper(res, 200, true, row.dataValues.status === "draft" ? "Draft saved" : "Announcement updated");
        } catch (error) {
            return fail(res, error, "save");
        }
    }

    // POST /saas_admin/announcements/:uuid/end  - hide banners now
    async end(req: RequestWithUser, res: Response) {
        try {
            const [n] = await Announcement.update({ ends_at: new Date(), status: "ended" }, { where: { uuid: req.params.uuid, status: { [Op.ne]: "draft" } } });
            return returnHelper(res, 200, Boolean(n), n ? "Announcement ended - banners are hidden" : "Announcement not found");
        } catch (error) {
            return fail(res, error, "end");
        }
    }

    // POST /saas_admin/announcements/:uuid/delete
    async remove(req: RequestWithUser, res: Response) {
        try {
            const n = await Announcement.destroy({ where: { uuid: req.params.uuid } });
            return returnHelper(res, 200, Boolean(n), n ? "Announcement deleted" : "Announcement not found");
        } catch (error) {
            return fail(res, error, "remove");
        }
    }

    // ---------------------------------------------------------------- agency

    // GET /crm/announcements  - banners for me
    async mine(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            return returnHelper(res, 200, true, "Announcements", await bannersFor(Number(user.id), user.agent_uuid, user.role === "agent"));
        } catch (error) {
            return fail(res, error, "mine");
        }
    }

    // POST /crm/announcements/:uuid/dismiss
    async dismiss(req: RequestWithUser, res: Response) {
        try {
            const row: any = await Announcement.findOne({ where: { uuid: req.params.uuid }, attributes: ["id"] });
            if (!row) return returnHelper(res, 200, false, "Announcement not found");
            await AnnouncementDismissal.findOrCreate({ where: { announcement_id: row.dataValues.id, agent_id: Number((req.user?.user as any)?.id) } });
            return returnHelper(res, 200, true, "Dismissed");
        } catch (error) {
            return fail(res, error, "dismiss");
        }
    }
}

export default new AnnouncementController();
