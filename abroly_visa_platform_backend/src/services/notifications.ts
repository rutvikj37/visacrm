import { Op } from "sequelize";
import Notification from "../model/Notification";
import Agent from "../model/Agent";
import { agencyPanelLink } from "./panelUrl";
import CrmLead from "../model/CrmLead";
import Step from "../model/Step";
import AgencyLeads from "../model/AgencyLeads";
import { agencyBrand, sendMail } from "./mailer";

/**
 * Notifications for agency users: in-app (bell) + optional email.
 * Every call is fire-and-forget: a failing notification never breaks the action that caused it.
 */

type NotifyType =
    | "new_lead" | "lead_assigned" | "whatsapp_message" | "follow_up_due" | "daily_digest" | "document_uploaded"
    | "case_assigned" | "trial_ending" | "plan_ending" | "plan_expired" | "payment_received" | "import_done"
    | "payment_failed" | "announcement" | "mention";

export interface NotifyInput {
    agencyUuid: string;
    recipientIds: (number | null | undefined)[];
    type: NotifyType;
    title: string;
    body?: string | null;
    link?: string | null;
    dedupeKey?: string | null; // same key + same person = only once
    email?: boolean;
    meta?: Record<string, any> | null;
    skipUserId?: number | null; // don't notify the person who did the action
}


export const agencyOwnerId = async (agencyUuid: string): Promise<number | null> => {
    const owner: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id"] });
    return owner ? owner.dataValues.id : null;
};

/** Who should hear about a lead: its assignee, otherwise the agency owner. */
export const leadRecipients = async (agencyUuid: string, assignedTo?: number | null) =>
    assignedTo ? [assignedTo] : [await agencyOwnerId(agencyUuid)];

export const notify = async (input: NotifyInput) => {
    try {
        const ids = [...new Set(input.recipientIds.filter((id): id is number => Boolean(id)))].filter((id) => id !== input.skipUserId);
        if (!ids.length) return;
        const people: any[] = await Agent.findAll({
            where: { id: ids, status: "active" },
            attributes: ["id", "email", "notify_email", "uuid", "parent_uuid", "role"],
        });
        for (const person of people) {
            // only people of this agency
            const p = person.dataValues;
            if (p.uuid !== input.agencyUuid && p.parent_uuid !== input.agencyUuid) continue;
            let row: any;
            try {
                row = await Notification.create({
                    agency_uuid: input.agencyUuid,
                    recipient_id: p.id,
                    type: input.type,
                    title: input.title.slice(0, 255),
                    body: input.body ? input.body.slice(0, 2000) : null,
                    link: input.link || null,
                    dedupe_key: input.dedupeKey || null,
                    meta: input.meta || null,
                });
            } catch (error: any) {
                if (error?.name === "SequelizeUniqueConstraintError") continue; // already sent
                // older DBs may lack newer enum values (e.g. "mention") — retry with a safe type
                if (input.type === "mention" && /Data truncated|enum/i.test(String(error?.message || ""))) {
                    try {
                        row = await Notification.create({
                            agency_uuid: input.agencyUuid,
                            recipient_id: p.id,
                            type: "lead_assigned",
                            title: input.title.slice(0, 255),
                            body: input.body ? input.body.slice(0, 2000) : null,
                            link: input.link || null,
                            dedupe_key: input.dedupeKey || null,
                            meta: { ...(input.meta || {}), kind: "mention" },
                        });
                    } catch (retryErr: any) {
                        if (retryErr?.name === "SequelizeUniqueConstraintError") continue;
                        throw retryErr;
                    }
                } else {
                    throw error;
                }
            }
            if (input.email && p.email && Number(p.notify_email) !== 0) {
                const url = input.link ? await agencyPanelLink(input.agencyUuid, input.link) : null;
                const sent = await sendMail(p.email, input.title, input.body || "", url ? { label: "Open in CRM", url } : null, await agencyBrand(input.agencyUuid));
                if (sent) await Notification.update({ emailed_at: new Date() }, { where: { id: row.dataValues.id } });
            }
        }
    } catch (error) {
        console.error("notify failed", error);
    }
};

/** Run without waiting (used inside request handlers). */
export const notifyLater = (input: NotifyInput) => { setImmediate(() => { notify(input); }); };

// ---------------------------------------------------------------- scheduled reminders

const CLOSED = ["converted", "lost", "junk"];
const istNow = () => new Date(Date.now() + (5 * 60 + 30) * 60 * 1000); // dates/hours in IST
const istDay = () => istNow().toISOString().slice(0, 10);

export const activeAgencyUuids = async () => {
    const rows: any[] = await Agent.findAll({
        where: { role: "agent", status: "active", expires_at: { [Op.gt]: new Date() } },
        attributes: ["uuid"],
        raw: true,
    });
    return rows.map((r) => r.uuid);
};

/** A follow-up is due in the next 15 minutes (or just became due): tell the person once. */
export const followUpReminders = async () => {
    const agencies = await activeAgencyUuids();
    if (!agencies.length) return;
    const leads: any[] = await CrmLead.findAll({
        where: {
            agency_uuid: agencies,
            status: { [Op.notIn]: CLOSED },
            follow_up_notified_at: null,
            next_follow_up_at: { [Op.between]: [new Date(Date.now() - 24 * 60 * 60 * 1000), new Date(Date.now() + 15 * 60 * 1000)] },
        },
        limit: 500,
    });
    for (const lead of leads) {
        const l = lead.dataValues;
        await CrmLead.update({ follow_up_notified_at: new Date() }, { where: { id: l.id } });
        await notify({
            agencyUuid: l.agency_uuid,
            recipientIds: await leadRecipients(l.agency_uuid, l.assigned_to),
            type: "follow_up_due",
            title: `Follow up with ${l.name || "a lead"}`,
            body: l.follow_up_note || `Scheduled for ${new Date(l.next_follow_up_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
            link: `/crm/leads/${l.uuid}`,
            dedupeKey: `fu:${l.id}:${new Date(l.next_follow_up_at).getTime()}`,
        });
    }
};

/** Once a day after 9:00 IST: "your day" summary to every person with work waiting (in-app + email). */
export const dailyDigest = async () => {
    if (istNow().getUTCHours() < 9) return;
    const day = istDay();
    const agencies = await activeAgencyUuids();
    const endOfDay = new Date(`${day}T23:59:59+05:30`);
    const startOfDay = new Date(`${day}T00:00:00+05:30`);
    for (const agencyUuid of agencies) {
        const ownerId = await agencyOwnerId(agencyUuid);
        const open = { agency_uuid: agencyUuid, status: { [Op.notIn]: CLOSED } };
        const due: any[] = await CrmLead.findAll({
            where: { ...open, next_follow_up_at: { [Op.lte]: endOfDay } },
            attributes: ["assigned_to", "next_follow_up_at"],
            raw: true,
        });
        const unassigned = await CrmLead.count({ where: { ...open, assigned_to: null, status: "new" } });
        const perPerson = new Map<number, { today: number; overdue: number }>();
        for (const row of due) {
            const who = row.assigned_to || ownerId;
            if (!who) continue;
            const entry = perPerson.get(who) || { today: 0, overdue: 0 };
            if (new Date(row.next_follow_up_at) < startOfDay) entry.overdue++; else entry.today++;
            perPerson.set(who, entry);
        }
        if (ownerId && unassigned && !perPerson.has(ownerId)) perPerson.set(ownerId, { today: 0, overdue: 0 });
        for (const [who, counts] of perPerson) {
            const parts = [
                counts.today ? `${counts.today} follow-up(s) due today` : null,
                counts.overdue ? `${counts.overdue} overdue` : null,
                who === ownerId && unassigned ? `${unassigned} new lead(s) not assigned yet` : null,
            ].filter(Boolean);
            if (!parts.length) continue;
            await notify({
                agencyUuid,
                recipientIds: [who],
                type: "daily_digest",
                title: "Your day in the CRM",
                body: parts.join(" · "),
                link: counts.overdue ? "/crm/leads?follow_up=overdue" : "/crm/leads?follow_up=today",
                dedupeKey: `digest:${day}`,
                email: true,
            });
        }
    }
};

/** Trial / plan ending in 7, 3 or 1 day(s), or ended: tell the owner (in-app + email). */
export const subscriptionReminders = async () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const agencies: any[] = await Agent.findAll({
        where: { role: "agent", status: "active", expires_at: { [Op.between]: [new Date(now - DAY), new Date(now + 7 * DAY + DAY)] } },
        attributes: ["id", "uuid", "expires_at", "saas_kind"],
    });
    for (const agency of agencies) {
        const a = agency.dataValues;
        const ends = new Date(a.expires_at);
        const daysLeft = Math.ceil((ends.getTime() - now) / DAY);
        const endKey = ends.toISOString().slice(0, 10);
        const trial = a.saas_kind === "trial";
        if (daysLeft <= 0) {
            await notify({
                agencyUuid: a.uuid, recipientIds: [a.id], type: "plan_expired",
                title: trial ? "Your free trial has ended" : "Your plan has ended",
                body: "Your leads and visa cases are safe. Renew to continue using the CRM.",
                link: "/subscription", dedupeKey: `expired:${endKey}`, email: true,
            });
            continue;
        }
        const bucket = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : daysLeft <= 7 ? 7 : null;
        if (!bucket) continue;
        await notify({
            agencyUuid: a.uuid, recipientIds: [a.id], type: trial ? "trial_ending" : "plan_ending",
            title: trial ? `Your free trial ends in ${daysLeft} day(s)` : `Your plan ends in ${daysLeft} day(s)`,
            body: `Access ends on ${ends.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}. Choose a plan to keep your leads flowing.`,
            link: "/subscription", dedupeKey: `ending:${endKey}:${bucket}`, email: true,
        });
    }
};

/** Visa case steps due today or overdue (not done): tell whoever handles the case, once per due date. */
export const stepDueReminders = async () => {
    const day = istDay();
    const steps: any[] = await Step.findAll({
        where: { step_status: 0, due_notified_at: null, due_date: { [Op.lte]: day } },
        attributes: ["id", "lead_id", "step_title", "due_date"],
        limit: 500,
    });
    for (const step of steps) {
        const s = step.dataValues;
        await Step.update({ due_notified_at: new Date() }, { where: { id: s.id } });
        const visaCase: any = await AgencyLeads.findByPk(s.lead_id, { attributes: ["id", "agent_uuid", "assign_id", "status"] });
        if (!visaCase || visaCase.dataValues.status !== "visa_progress") continue;
        const overdue = String(s.due_date) < day;
        await notify({
            agencyUuid: visaCase.dataValues.agent_uuid,
            recipientIds: await leadRecipients(visaCase.dataValues.agent_uuid, visaCase.dataValues.assign_id),
            type: "follow_up_due",
            title: `${overdue ? "Overdue" : "Due today"}: ${s.step_title}`,
            body: `Visa case #${s.lead_id}`,
            link: `/leads/progress/${s.lead_id}`,
            dedupeKey: `step:${s.id}:${s.due_date}`,
        });
    }
};

export const readRules = (raw: any): { new_lead_hours: number | null; stale_days: number | null } => {
    try {
        const r = raw ? JSON.parse(raw) : {};
        return { new_lead_hours: r?.new_lead_hours || null, stale_days: r?.stale_days || null };
    } catch {
        return { new_lead_hours: null, stale_days: null };
    }
};

/**
 * Follow-up rules each agency can switch on:
 *  - a new lead nobody contacted within N hours
 *  - an open lead with no activity for N days (and no follow-up planned)
 * The assignee (or owner) gets a reminder; the owner is also told about uncontacted new leads.
 */
export const ruleReminders = async () => {
    const agencies: any[] = await Agent.findAll({
        where: { role: "agent", status: "active", expires_at: { [Op.gt]: new Date() }, crm_rules: { [Op.ne]: null } },
        attributes: ["id", "uuid", "crm_rules"],
    });
    for (const agency of agencies) {
        const rules = readRules(agency.dataValues.crm_rules);
        const agencyUuid = agency.dataValues.uuid;
        if (rules.new_lead_hours) {
            const leads: any[] = await CrmLead.findAll({
                where: { agency_uuid: agencyUuid, status: "new", createdAt: { [Op.lt]: new Date(Date.now() - rules.new_lead_hours * 3600 * 1000), [Op.gt]: new Date(Date.now() - 14 * 86400000) } },
                attributes: ["id", "uuid", "name", "phone_number", "assigned_to"],
                limit: 200,
            });
            for (const lead of leads) {
                const l = lead.dataValues;
                await notify({
                    agencyUuid,
                    recipientIds: [l.assigned_to, agency.dataValues.id],
                    type: "follow_up_due",
                    title: `Not contacted yet: ${l.name || l.phone_number || "new lead"}`,
                    body: `This lead has been waiting for more than ${rules.new_lead_hours} hour(s).`,
                    link: `/crm/leads/${l.uuid}`,
                    dedupeKey: `rule-new:${l.id}`,
                });
            }
        }
        if (rules.stale_days) {
            const leads: any[] = await CrmLead.findAll({
                where: {
                    agency_uuid: agencyUuid,
                    status: { [Op.notIn]: ["new", ...CLOSED] },
                    last_activity_at: { [Op.lt]: new Date(Date.now() - rules.stale_days * 86400000) },
                    [Op.or]: [{ next_follow_up_at: null }, { next_follow_up_at: { [Op.lt]: new Date() } }],
                },
                attributes: ["id", "uuid", "name", "phone_number", "assigned_to", "last_activity_at"],
                limit: 200,
            });
            for (const lead of leads) {
                const l = lead.dataValues;
                await notify({
                    agencyUuid,
                    recipientIds: await leadRecipients(agencyUuid, l.assigned_to),
                    type: "follow_up_due",
                    title: `No activity for ${rules.stale_days} days: ${l.name || l.phone_number || "lead"}`,
                    body: "Follow up, or mark the lead as lost.",
                    link: `/crm/leads/${l.uuid}`,
                    // again only after new activity went quiet
                    dedupeKey: `rule-stale:${l.id}:${new Date(l.last_activity_at).getTime()}`,
                });
            }
        }
    }
};
