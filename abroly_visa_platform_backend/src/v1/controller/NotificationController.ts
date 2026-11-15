import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Notification from "../../model/Notification";
import Agent from "../../model/Agent";
import { mailEnabled } from "../../services/mailer";

/** The bell in the agency panel: my notifications, unread count, mark read, email on/off. */
const me = (req: RequestWithUser) => Number((req.user?.user as any)?.id);

class NotificationController {
    // GET /crm/notifications?page=&unread=1
    async list(req: RequestWithUser, res: Response) {
        try {
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const limit = 20;
            const where: any = { recipient_id: me(req) };
            if (req.query.unread === "1") where.read_at = null;
            const { count, rows } = await Notification.findAndCountAll({
                where, order: [["createdAt", "DESC"], ["id", "DESC"]], limit, offset: (page - 1) * limit,
                attributes: ["uuid", "type", "title", "body", "link", "read_at", "createdAt"],
            });
            const unread = await Notification.count({ where: { recipient_id: me(req), read_at: null } });
            return returnHelper(res, 200, true, "Notifications", { notifications: rows, unread, totalPages: Math.ceil(count / limit) });
        } catch (error) {
            console.error("list notifications failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/notifications/unread_count
    async unreadCount(req: RequestWithUser, res: Response) {
        try {
            const unread = await Notification.count({ where: { recipient_id: me(req), read_at: null } });
            return returnHelper(res, 200, true, "Unread", { unread });
        } catch (error) {
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/notifications/read { ids?: uuid[], all?: true }
    async markRead(req: RequestWithUser, res: Response) {
        try {
            const where: any = { recipient_id: me(req), read_at: null };
            if (!req.body?.all) {
                const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 200) : [];
                if (!ids.length) return returnHelper(res, 200, false, "Nothing to mark");
                where.uuid = { [Op.in]: ids };
            }
            await Notification.update({ read_at: new Date() }, { where });
            return returnHelper(res, 200, true, "Marked as read");
        } catch (error) {
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/notifications/settings
    async getSettings(req: RequestWithUser, res: Response) {
        const user: any = await Agent.findByPk(me(req), { attributes: ["notify_email", "email"] });
        return returnHelper(res, 200, true, "Settings", {
            email: Number(user?.dataValues?.notify_email) !== 0,
            has_email: Boolean(user?.dataValues?.email),
            email_available: mailEnabled(),
        });
    }

    // POST /crm/notifications/settings { email: boolean }
    async updateSettings(req: RequestWithUser, res: Response) {
        await Agent.update({ notify_email: req.body?.email ? 1 : 0 }, { where: { id: me(req) } });
        return returnHelper(res, 200, true, req.body?.email ? "Email notifications on" : "Email notifications off");
    }
}

export default new NotificationController();
