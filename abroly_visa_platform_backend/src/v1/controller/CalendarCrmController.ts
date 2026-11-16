import { accessOf } from "../../helpers/access";
import { branchFilterValue } from "../../services/branches";
import crypto from "crypto";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import CrmLead from "../../model/CrmLead";
import AgencyLeads from "../../model/AgencyLeads";
import Step from "../../model/Step";
import User from "../../model/User";
import Agent from "../../model/Agent";
import LeadsCalendar from "../../model/LeadsCalendar";
import { agencyPanelBase } from "../../services/panelUrl";

/**
 * One calendar for everything with a date:
 *   lead follow-ups, visa case step due dates, and events / tasks added on cases.
 * Owners see the whole agency, team members their own items.
 * Also served as an .ics feed so it can be subscribed to from Google / Apple / Outlook calendars.
 */

export interface CalendarEvent {
    id: string;
    type: "follow_up" | "step_due" | "event";
    title: string;
    note?: string | null;
    start: Date;
    all_day: boolean;
    link: string;
    done?: boolean;
    assignee_id?: number | null;
}

const CLOSED = ["converted", "lost", "junk"];

/**
 * branch: undefined = no branch limit; a number / null = only that branch (owner picked it, or it is a
 * branch manager's own branch - then isOwner is passed as true so they see everyone's items in it).
 */
const collectEvents = async (agencyUuid: string, userId: number, isOwner: boolean, from: Date, to: Date, branch?: number | null): Promise<CalendarEvent[]> => {
    const events: CalendarEvent[] = [];
    const bf = branch !== undefined ? { branch_id: branch } : {};

    const leads: any[] = await CrmLead.findAll({
        where: {
            agency_uuid: agencyUuid, status: { [Op.notIn]: CLOSED }, next_follow_up_at: { [Op.between]: [from, to] },
            ...(!isOwner && { assigned_to: userId }), ...bf,
        },
        attributes: ["uuid", "name", "phone_number", "next_follow_up_at", "follow_up_note", "assigned_to"],
        limit: 2000,
    });
    for (const l of leads) {
        const x = l.dataValues;
        events.push({ id: `fu-${x.uuid}`, type: "follow_up", title: `Follow up: ${x.name || x.phone_number || "lead"}`, note: x.follow_up_note, start: new Date(x.next_follow_up_at), all_day: false, link: `/crm/leads/${x.uuid}`, assignee_id: x.assigned_to });
    }

    const cases: any[] = await AgencyLeads.findAll({
        where: { agent_uuid: agencyUuid, status: "visa_progress", ...(!isOwner && { assign_id: userId }), ...bf },
        attributes: ["id", "user_id", "assign_id", "selected_country"],
        include: [{ model: User, as: "user_of", attributes: ["username"] }],
        limit: 2000,
    });
    const caseBy = new Map(cases.map((c) => [c.dataValues.id, c]));
    if (cases.length) {
        const steps: any[] = await Step.findAll({
            where: { lead_id: [...caseBy.keys()], step_status: 0, due_date: { [Op.between]: [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)] } },
            attributes: ["id", "lead_id", "step_title", "due_date"],
        });
        for (const s of steps) {
            const c: any = caseBy.get(s.dataValues.lead_id);
            const student = c?.toJSON()?.user_of?.username || "student";
            events.push({ id: `step-${s.dataValues.id}`, type: "step_due", title: `${s.dataValues.step_title} - ${student}`, note: c?.dataValues?.selected_country || null, start: new Date(`${s.dataValues.due_date}T00:00:00`), all_day: true, link: `/leads/progress/${s.dataValues.lead_id}`, assignee_id: c?.dataValues?.assign_id });
        }
    }

    // events / reminders / tasks added on cases with the older calendar
    const memberIds = isOwner
        ? (await Agent.findAll({
            where: branch !== undefined ? { parent_uuid: agencyUuid, branch_id: branch } : { [Op.or]: [{ uuid: agencyUuid }, { parent_uuid: agencyUuid }] },
            attributes: ["id"], raw: true,
        }) as any[]).map((m) => m.id).concat(branch !== undefined ? [userId] : [])
        : [userId];
    const old: any[] = await LeadsCalendar.findAll({
        where: { date: { [Op.between]: [from, to] }, [Op.or]: [{ created_by: memberIds }, { assgin_to: memberIds }] },
        limit: 2000,
    });
    for (const e of old) {
        const x = e.dataValues;
        const day = new Date(x.date).toISOString().slice(0, 10);
        const start = x.time ? new Date(`${day}T${x.time}`) : new Date(`${day}T00:00:00`);
        events.push({ id: `ev-${x.id}`, type: "event", title: `${String(x.event_type || "event").replace(/^./, (ch: string) => ch.toUpperCase())}: ${String(x.description || "").slice(0, 80) || "Case event"}`, note: null, start: isNaN(start.getTime()) ? new Date(x.date) : start, all_day: !x.time, link: x.lead_id ? `/leads/progress/${x.lead_id}` : "/leads/calendar", done: Number(x.is_done) === 1, assignee_id: x.assgin_to });
    }

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
};

// ---- .ics feed token: "<agentId>.<hmac>" - no login needed, can not be guessed, shows only that person's calendar
const feedSecret = () => `${process.env.ACCESS_TOKEN_SECRET || ""}:calendar-feed`;
const feedToken = (agentId: number) => `${agentId}.${crypto.createHmac("sha256", feedSecret()).update(String(agentId)).digest("hex").slice(0, 32)}`;
const readFeedToken = (token: string) => {
    const [id, sig] = String(token || "").split(".");
    const agentId = Number(id);
    if (!agentId || !sig) return null;
    const expected = feedToken(agentId).split(".")[1];
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? agentId : null;
};

const icsEscape = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDay = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

class CalendarCrmController {
    // GET /crm/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
    async events(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            const from = new Date(String(req.query.from || ""));
            const to = new Date(String(req.query.to || ""));
            if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from || to.getTime() - from.getTime() > 100 * 86400000) {
                return returnHelper(res, 200, false, "Please choose a valid date range");
            }
            to.setHours(23, 59, 59, 999);
            // owner: everything, or one branch with ?branch=; a branch manager: their branch; others: their own items
            const a = accessOf(req);
            const picked = branchFilterValue(req);
            const managesBranch = !a.isOwner && a.teamRole === "branch_manager" && Boolean(a.branchId);
            const events = await collectEvents(user.agent_uuid, Number(user.id), a.isOwner || managesBranch, from, to, managesBranch ? a.branchId : a.isOwner ? picked : undefined);
            const base = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
            return returnHelper(res, 200, true, "Calendar", {
                events,
                feed_url: base ? `${base}/v1/public/calendar/${feedToken(Number(user.id))}.ics` : null,
            });
        } catch (error) {
            console.error("calendar failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /public/calendar/:token.ics  - subscribe from Google Calendar ("From URL"), Apple or Outlook
    async feed(req: Request, res: Response) {
        try {
            const agentId = readFeedToken(String(req.params.token || "").replace(/\.ics$/, ""));
            if (!agentId) return res.status(404).send("Not found");
            const person: any = await Agent.findOne({ where: { id: agentId, status: "active" }, attributes: ["id", "uuid", "parent_uuid", "role"] });
            if (!person) return res.status(404).send("Not found");
            const isOwner = person.dataValues.role === "agent";
            const agencyUuid = isOwner ? person.dataValues.uuid : person.dataValues.parent_uuid;
            const events = await collectEvents(agencyUuid, agentId, isOwner, new Date(Date.now() - 14 * 86400000), new Date(Date.now() + 90 * 86400000));
            const panel = await agencyPanelBase(agencyUuid);
            const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TechX CRM//Calendar//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Visa CRM"];
            for (const e of events) {
                lines.push("BEGIN:VEVENT", `UID:${e.id}@visa-crm`, `DTSTAMP:${icsStamp(new Date())}`);
                if (e.all_day) {
                    const next = new Date(e.start.getTime() + 86400000);
                    lines.push(`DTSTART;VALUE=DATE:${icsDay(e.start)}`, `DTEND;VALUE=DATE:${icsDay(next)}`);
                } else {
                    lines.push(`DTSTART:${icsStamp(e.start)}`, `DTEND:${icsStamp(new Date(e.start.getTime() + 30 * 60000))}`);
                }
                lines.push(`SUMMARY:${icsEscape(e.title)}`);
                const desc = [e.note, panel ? `${panel}${e.link}` : null].filter(Boolean).join("\n");
                if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
                lines.push("END:VEVENT");
            }
            lines.push("END:VCALENDAR");
            res.setHeader("Content-Type", "text/calendar; charset=utf-8");
            res.setHeader("Cache-Control", "private, max-age=300");
            return res.status(200).send(lines.join("\r\n"));
        } catch (error) {
            console.error("calendar feed failed", error);
            return res.status(500).send("Error");
        }
    }
}

export default new CalendarCrmController();
