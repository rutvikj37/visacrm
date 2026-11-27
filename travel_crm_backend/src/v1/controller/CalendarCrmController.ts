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
import AgencyTask from "../../model/AgencyTask";
import ClientInvoice from "../../model/ClientInvoice";
import { agencyPanelBase } from "../../services/panelUrl";
import { toRupees } from "./FeesController";

/**
 * One calendar for everything with a date:
 *   lead follow-ups, visa case step due dates, fee instalments, agency tasks, and events.
 * Owners see the whole agency, team members their own items.
 * Also served as an .ics feed so it can be subscribed to from Google / Apple / Outlook calendars.
 */

export type CalendarEventType = "follow_up" | "step_due" | "event" | "fee_due" | "task";

export interface CalendarEvent {
    id: string;
    type: CalendarEventType;
    title: string;
    note?: string | null;
    start: Date;
    all_day: boolean;
    link: string;
    done?: boolean;
    assignee_id?: number | null;
    assignee_name?: string | null;
    phone_normalized?: string | null;
    lead_uuid?: string | null;
}

const CLOSED = ["converted", "lost", "junk"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const loadAssigneeNames = async (ids: Array<number | null | undefined>) => {
    const unique = [...new Set(ids.filter((id): id is number => Number.isFinite(Number(id)) && Number(id) > 0).map(Number))];
    if (!unique.length) return new Map<number, string>();
    const rows: any[] = await Agent.findAll({ where: { id: unique }, attributes: ["id", "username"], raw: true });
    return new Map(rows.map((r) => [Number(r.id), r.username || "Team member"]));
};

/** Unpaid instalments (or balance due) whose due_date falls in [from, to]. */
const unpaidDuesInRange = (inv: any, fromKey: string, toKey: string) => {
    const x = inv.toJSON ? inv.toJSON() : inv;
    const total = Number(x.total || 0);
    const paid = Number(x.amount_paid || 0);
    const balance = Math.max(0, total - paid);
    if (balance <= 0 || x.status === "cancelled" || x.status === "paid") return [] as { label: string; amount: number; due_date: string }[];

    const out: { label: string; amount: number; due_date: string }[] = [];
    if (Array.isArray(x.installments) && x.installments.length) {
        let remaining = paid;
        for (const i of x.installments) {
            const amt = Number(i.amount || 0);
            if (remaining >= amt) { remaining -= amt; continue; }
            const dueAmt = amt - remaining;
            remaining = 0;
            const due = String(i.due_date || "").slice(0, 10);
            if (due && due >= fromKey && due <= toKey) {
                out.push({ label: i.label || "Instalment", amount: toRupees(dueAmt), due_date: due });
            }
        }
    } else {
        const due = String(x.due_date || "").slice(0, 10);
        if (due && due >= fromKey && due <= toKey) {
            out.push({ label: "Balance", amount: toRupees(balance), due_date: due });
        }
    }
    return out;
};

/**
 * branch: undefined = no branch limit; a number / null = only that branch (owner picked it, or it is a
 * branch manager's own branch - then isOwner is passed as true so they see everyone's items in it).
 * mineOnly: when true, keep only items assigned to userId (team "My day" filter for owners/managers).
 */
const collectEvents = async (
    agencyUuid: string,
    userId: number,
    isOwner: boolean,
    from: Date,
    to: Date,
    branch?: number | null,
    mineOnly = false,
): Promise<CalendarEvent[]> => {
    const events: CalendarEvent[] = [];
    const bf = branch !== undefined ? { branch_id: branch } : {};
    const fromKey = ymd(from);
    const toKey = ymd(to);
    const onlyMine = mineOnly || !isOwner;

    const leads: any[] = await CrmLead.findAll({
        where: {
            agency_uuid: agencyUuid, status: { [Op.notIn]: CLOSED }, next_follow_up_at: { [Op.between]: [from, to] },
            ...(onlyMine && { assigned_to: userId }), ...bf,
        },
        attributes: ["uuid", "name", "phone_number", "phone_normalized", "country_code", "next_follow_up_at", "follow_up_note", "assigned_to"],
        limit: 2000,
    });
    for (const l of leads) {
        const x = l.dataValues;
        events.push({
            id: `fu-${x.uuid}`,
            type: "follow_up",
            title: `Follow up: ${x.name || x.phone_number || "lead"}`,
            note: x.follow_up_note,
            start: new Date(x.next_follow_up_at),
            all_day: false,
            link: `/crm/leads/${x.uuid}`,
            assignee_id: x.assigned_to,
            phone_normalized: x.phone_normalized || null,
            lead_uuid: x.uuid,
        });
    }

    const cases: any[] = await AgencyLeads.findAll({
        where: { agent_uuid: agencyUuid, status: "visa_progress", ...(onlyMine && { assign_id: userId }), ...bf },
        attributes: ["id", "user_id", "assign_id", "selected_country"],
        include: [{ model: User, as: "user_of", attributes: ["username"] }],
        limit: 2000,
    });
    const caseBy = new Map(cases.map((c) => [c.dataValues.id, c]));
    if (cases.length) {
        const steps: any[] = await Step.findAll({
            where: { lead_id: [...caseBy.keys()], step_status: 0, due_date: { [Op.between]: [fromKey, toKey] } },
            attributes: ["id", "lead_id", "step_title", "due_date"],
        });
        for (const s of steps) {
            const c: any = caseBy.get(s.dataValues.lead_id);
            const student = c?.toJSON()?.user_of?.username || "student";
            events.push({
                id: `step-${s.dataValues.id}`,
                type: "step_due",
                title: `${s.dataValues.step_title} - ${student}`,
                note: c?.dataValues?.selected_country || null,
                start: new Date(`${s.dataValues.due_date}T00:00:00`),
                all_day: true,
                link: `/leads/progress/${s.dataValues.lead_id}`,
                assignee_id: c?.dataValues?.assign_id,
            });
        }
    }

    // events / reminders / tasks added on cases with the older calendar
    const memberIds = isOwner
        ? (await Agent.findAll({
            where: branch !== undefined ? { parent_uuid: agencyUuid, branch_id: branch } : { [Op.or]: [{ uuid: agencyUuid }, { parent_uuid: agencyUuid }] },
            attributes: ["id"], raw: true,
        }) as any[]).map((m) => m.id).concat(branch !== undefined ? [userId] : [])
        : [userId];
    const eventMemberIds = onlyMine ? [userId] : memberIds;
    const old: any[] = await LeadsCalendar.findAll({
        where: { date: { [Op.between]: [from, to] }, [Op.or]: [{ created_by: eventMemberIds }, { assgin_to: eventMemberIds }] },
        limit: 2000,
    });
    for (const e of old) {
        const x = e.dataValues;
        const day = new Date(x.date).toISOString().slice(0, 10);
        const start = x.time ? new Date(`${day}T${x.time}`) : new Date(`${day}T00:00:00`);
        events.push({
            id: `ev-${x.id}`,
            type: "event",
            title: `${String(x.event_type || "event").replace(/^./, (ch: string) => ch.toUpperCase())}: ${String(x.description || "").slice(0, 80) || "Case event"}`,
            note: null,
            start: isNaN(start.getTime()) ? new Date(x.date) : start,
            all_day: !x.time,
            link: x.lead_id ? `/leads/progress/${x.lead_id}` : "/crm/calendar",
            done: Number(x.is_done) === 1,
            assignee_id: x.assgin_to,
        });
    }

    // agency tasks with a due date
    const taskWhere: any = {
        agency_uuid: agencyUuid,
        status: { [Op.ne]: "done" },
        due_at: { [Op.between]: [from, to] },
    };
    if (onlyMine) {
        taskWhere[Op.or] = [{ assignee_id: userId }, { created_by: userId }];
    } else if (branch !== undefined) {
        const inBranch: any[] = await Agent.findAll({
            where: {
                [Op.or]: [{ uuid: agencyUuid }, { parent_uuid: agencyUuid }],
                ...(branch === null ? { branch_id: null } : { branch_id: branch }),
            },
            attributes: ["id"],
            raw: true,
        });
        const ids = inBranch.map((r) => Number(r.id)).filter(Boolean);
        taskWhere.assignee_id = { [Op.in]: ids.length ? ids : [0] };
    }
    const tasks: any[] = await AgencyTask.findAll({
        where: taskWhere,
        attributes: ["id", "title", "description", "due_at", "assignee_id", "status"],
        limit: 2000,
    });
    for (const t of tasks) {
        const x = t.dataValues;
        events.push({
            id: `task-${x.id}`,
            type: "task",
            title: x.title || "Task",
            note: x.description ? String(x.description).slice(0, 120) : null,
            start: new Date(x.due_at),
            all_day: false,
            link: `/crm/tasks?task=${x.id}`,
            assignee_id: x.assignee_id,
            done: x.status === "done",
        });
    }

    // fee instalment dues (invoices for this agency / scoped cases)
    const invoiceWhere: any = {
        agency_uuid: agencyUuid,
        status: { [Op.in]: ["unpaid", "partial"] },
        ...(branch !== undefined ? { branch_id: branch } : {}),
    };
    if (!isOwner) {
        const myCases: any[] = await AgencyLeads.findAll({
            where: { agent_uuid: agencyUuid, assign_id: userId },
            attributes: ["id"],
            raw: true,
            limit: 3000,
        });
        invoiceWhere.case_id = { [Op.in]: myCases.map((c) => c.id).concat([-1]) };
    }
    const invoices: any[] = await ClientInvoice.findAll({
        where: invoiceWhere,
        include: [{ model: User, as: "student", attributes: ["id", "username", "phone_number", "country_code"] }],
        limit: 1000,
    });
    for (const inv of invoices) {
        const presented = inv.toJSON ? inv.toJSON() : inv;
        const studentName = presented.student?.username || "Student";
        const dues = unpaidDuesInRange(inv, fromKey, toKey);
        for (let i = 0; i < dues.length; i++) {
            const d = dues[i];
            const rupees = Math.round(Number(d.amount || 0)).toLocaleString("en-IN");
            events.push({
                id: `fee-${presented.uuid || presented.id}-${d.due_date}-${i}`,
                type: "fee_due",
                title: `Fee: ${studentName} · ₹${rupees}`,
                note: [d.label, presented.number].filter(Boolean).join(" · ") || null,
                start: new Date(`${d.due_date}T00:00:00`),
                all_day: true,
                link: `/fees/${presented.uuid}`,
                assignee_id: null,
            });
        }
    }

    const names = await loadAssigneeNames(events.map((e) => e.assignee_id));
    for (const e of events) {
        e.assignee_name = e.assignee_id ? (names.get(Number(e.assignee_id)) || null) : null;
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
    // GET /crm/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&mine=1
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
            const seesTeam = a.isOwner || managesBranch;
            const mineOnly = String(req.query.mine || "") === "1" || String(req.query.view || "") === "mine";
            const events = await collectEvents(
                user.agent_uuid,
                Number(user.id),
                a.isOwner || managesBranch,
                from,
                to,
                managesBranch ? a.branchId : a.isOwner ? picked : undefined,
                mineOnly && seesTeam,
            );
            const base = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
            return returnHelper(res, 200, true, "Calendar", {
                events,
                feed_url: base ? `${base}/v1/public/calendar/${feedToken(Number(user.id))}.ics` : null,
                can_filter_assignee: seesTeam,
                viewer_id: Number(user.id),
            });
        } catch (error) {
            console.error("calendar failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/calendar/events  { description, date, time?, event_type? }
    async createEvent(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            const description = String(req.body?.description || "").trim().slice(0, 2000);
            const event_type = String(req.body?.event_type || "event");
            const allowed = ["event", "reminder", "followup", "task"];
            if (!description) return returnHelper(res, 200, false, "Please add a short description");
            if (!allowed.includes(event_type)) return returnHelper(res, 200, false, "Invalid event type");

            const dateRaw = req.body?.date;
            const day = dateRaw ? new Date(String(dateRaw)) : null;
            if (!day || isNaN(day.getTime())) return returnHelper(res, 200, false, "Please pick a date");
            day.setHours(12, 0, 0, 0);

            let time: string | null = null;
            if (req.body?.time) {
                const t = String(req.body.time).trim();
                if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return returnHelper(res, 200, false, "Please use a valid time");
                time = t.length === 5 ? `${t}:00` : t;
            }

            const row: any = await LeadsCalendar.create({
                created_by: Number(user.id),
                assgin_to: Number(user.id),
                description,
                event_type,
                date: day,
                time,
                is_last: 1,
                is_done: 0,
                lead_id: null,
                user_id: null,
            });

            const dayKey = ymd(day);
            const start = time ? new Date(`${dayKey}T${time}`) : new Date(`${dayKey}T00:00:00`);
            return returnHelper(res, 200, true, "Event added", {
                event: {
                    id: `ev-${row.dataValues.id}`,
                    type: "event",
                    title: `${event_type.replace(/^./, (ch: string) => ch.toUpperCase())}: ${description.slice(0, 80)}`,
                    note: null,
                    start,
                    all_day: !time,
                    link: "/crm/calendar",
                    done: false,
                    assignee_id: Number(user.id),
                    assignee_name: user.username || null,
                },
            });
        } catch (error) {
            console.error("calendar create failed", error);
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
            // Personal ICS feed: always that person's items (mineOnly when owner, automatic for members)
            const events = await collectEvents(
                agencyUuid,
                agentId,
                isOwner,
                new Date(Date.now() - 14 * 86400000),
                new Date(Date.now() + 90 * 86400000),
                undefined,
                true,
            );
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
