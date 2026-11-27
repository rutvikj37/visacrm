import { cleanTravelLeadFields, presentTravelLead } from "../../services/travel";
import { Booking, Quotation } from "../../model/Travel";
import AgencyBranch from "../../model/AgencyBranch";
import { audit } from "../../services/audit";
import { branchFilter, branchOfAgent, isAgencyBranch, pickBranchAssignee } from "../../services/branches";
import { Response } from "express";
import { notifyLater, readRules } from "../../services/notifications";
import { accessOf, canAssignTo, leadScope } from "../../helpers/access";
import { runTrigger } from "../../services/messaging";
import { HOT_SCORE, WARM_SCORE, refreshScore } from "../../services/leadScore";
import { assertSourceAllowed } from "../../services/saas";
import { Op, Sequelize } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import CrmLead, { CRM_LEAD_SOURCES, CRM_LEAD_STATUSES } from "../../model/CrmLead";
import CrmLeadActivity from "../../model/CrmLeadActivity";
import Agent from "../../model/Agent";
import LeadIntegration from "../../model/LeadIntegration";
import {
    ingestLead,
    isAgencyMember,
    logActivity,
    getTeamMembers,
    normalizePhone,
    findDuplicateLead,
    presentDuplicateLead,
    LeadValidationError,
} from "../../services/leadIngestion";
import { checklistSummary, normalizeDocChecklist } from "../../services/docChecklist";
import { importLeadsFromFile, IMPORT_TEMPLATE_CSV } from "../../services/leadImport";
import { buildPortalInvite, convertLeadToCase, ConversionError, sendPortalInviteEmail } from "../../services/leadConversion";
import { logPortalSafe } from "../../services/portalLeadActivity";

/**
 * Lead CRM for agencies.
 *
 * Access rules:
 *  - the agency owner (role "agent") sees and manages every lead of the agency
 *  - team members (sub-agents) see only leads assigned to them
 */

const assigneeAttributes = ["id", "username", "email", "phone_number", "role", "designation", "team_role", "branch_id"];
const EDITABLE_FIELDS = ["name", "email", "city", "interested_country", "interested_course", "visa_type", "intake", "message", "campaign", "tags"];
const MANUAL_ACTIVITY_TYPES = ["note", "call", "email", "whatsapp"];
const CLOSED_STATUSES = ["converted", "lost", "junk"];
const STATUS_LABELS: Record<string, string> = {
    new: "New", contacted: "Contacted", follow_up: "Follow-up", interested: "Interested",
    counselling: "Counselling", converted: "Converted", lost: "Lost", junk: "Junk",
};
const label = (status: string) => STATUS_LABELS[status] || status;

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return {
        agencyUuid: user.agent_uuid as string,
        agencyId: Number(user.agent_id),
        userId: Number(user.id),
        isOwner: user.role === "agent",
        // owner or branch manager: may assign, bulk-edit and import for others
        isManager: accessOf(req).isManager,
    };
};

/** Base where-clause: this agency, limited by the person's role and branch (helpers/access.ts). */
const scopeWhere = (req: RequestWithUser) => leadScope(req);

const findScopedLead = (req: RequestWithUser, uuid: string) =>
    CrmLead.findOne({ where: { ...scopeWhere(req), uuid } });

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

const handleError = (res: Response, error: any, where: string) => {
    if (error instanceof LeadValidationError) return returnHelper(res, 200, false, error.message);
    console.error(`CRM ${where} failed`, error);
    return returnHelper(res, 500, false, "Something went wrong");
};

/**
 * Move a lead to a branch (null = no branch). The person handling it changes too, unless they already
 * belong to the new branch: the next counsellor of that branch gets it, or it waits unassigned for its manager.
 */
const moveLeadToBranch = async (agencyUuid: string, lead: any, branchId: number | null, userId: number) => {
    const l = lead.dataValues;
    const [from, to]: any[] = await Promise.all([
        l.branch_id ? AgencyBranch.findByPk(l.branch_id, { attributes: ["name"] }) : null,
        branchId ? AgencyBranch.findByPk(branchId, { attributes: ["name"] }) : null,
    ]);
    let assignedTo: number | null = l.assigned_to || null;
    if (branchId && (await branchOfAgent(assignedTo)) !== branchId) assignedTo = await pickBranchAssignee(agencyUuid, branchId);
    await CrmLead.update({ branch_id: branchId, assigned_to: assignedTo }, { where: { id: l.id } });
    const toName = to?.dataValues?.name || "no branch";
    const person: any = assignedTo && assignedTo !== l.assigned_to ? await Agent.findByPk(assignedTo, { attributes: ["username"] }) : null;
    await logActivity(l.id, agencyUuid, "assignment",
        `Moved from ${from?.dataValues?.name || "no branch"} to ${toName}${person ? ` - now with ${person.dataValues.username}` : branchId && !assignedTo ? " - waiting to be assigned" : ""}`,
        userId, { branch_from: l.branch_id || null, branch_to: branchId, from: l.assigned_to || null, to: assignedTo });
    if (assignedTo && assignedTo !== l.assigned_to) {
        notifyLater({
            agencyUuid, recipientIds: [assignedTo], type: "lead_assigned", skipUserId: userId,
            title: `Lead moved to your branch: ${l.name || "lead"}`, link: `/crm/leads/${l.uuid}`, email: true,
        });
    }
    return `Lead moved to ${toName}`;
};

class CrmController {
    // GET /crm/leads
    async listLeads(req: RequestWithUser, res: Response) {
        try {
            const { userId } = ctx(req);
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            // the board view loads more leads at once
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), req.query.board === "1" ? 300 : 100);
            const { status, source, assigned_to, search, follow_up, tag, created } = req.query as Record<string, string>;

            const where: any = { ...scopeWhere(req), ...branchFilter(req) };
            if (status === "open") where.status = { [Op.notIn]: CLOSED_STATUSES };
            else if (status && (CRM_LEAD_STATUSES as readonly string[]).includes(status)) where.status = status;
            if (source && (CRM_LEAD_SOURCES as readonly string[]).includes(source)) where.source = source;
            const temperature = String(req.query.temperature || "");
            if (temperature === "hot") where.score = { [Op.gte]: HOT_SCORE };
            else if (temperature === "warm") where.score = { [Op.gte]: WARM_SCORE, [Op.lt]: HOT_SCORE };
            else if (temperature === "cold") where.score = { [Op.lt]: WARM_SCORE };

            if (assigned_to === "me") where.assigned_to = userId;
            else if (ctx(req).isManager && assigned_to) {
                if (assigned_to === "unassigned") where.assigned_to = null;
                else if (!isNaN(Number(assigned_to))) where.assigned_to = Number(assigned_to);
            }

            if (follow_up === "today") where.next_follow_up_at = { [Op.between]: [startOfToday(), endOfToday()] };
            else if (follow_up === "overdue") where.next_follow_up_at = { [Op.lt]: startOfToday() };
            else if (follow_up === "upcoming") where.next_follow_up_at = { [Op.gt]: endOfToday() };
            if (follow_up && !where.status) where.status = { [Op.notIn]: CLOSED_STATUSES };
            if (created === "today") where.createdAt = { [Op.between]: [startOfToday(), endOfToday()] };

            if (search && search.trim()) {
                const term = `%${search.trim().slice(0, 100)}%`;
                const digits = search.replace(/\D/g, "");
                where[Op.or] = [
                    { name: { [Op.like]: term } },
                    { email: { [Op.like]: term } },
                    { interested_country: { [Op.like]: term } },
                    { interested_course: { [Op.like]: term } },
                    ...(digits.length >= 4 ? [{ phone_normalized: { [Op.like]: `%${digits}%` } }] : []),
                ];
            }
            if (tag && tag.trim()) {
                // compare on the raw text of the JSON column (works on MySQL and MariaDB)
                const safeTag = tag.trim().slice(0, 40).replace(/["%_\\]/g, "");
                where[Op.and] = [
                    ...(where[Op.and] || []),
                    Sequelize.where(Sequelize.cast(Sequelize.col("CrmLead.tags"), "CHAR"), { [Op.like]: `%"${safeTag}"%` }),
                ];
            }

            const order: any = req.query.sort === "score"
                ? [["score", "DESC"], ["last_activity_at", "DESC"]]
                : follow_up
                ? [["next_follow_up_at", "ASC"]]
                : [["last_activity_at", "DESC"], ["createdAt", "DESC"]];

            const { count, rows } = await CrmLead.findAndCountAll({
                where,
                limit,
                offset: (page - 1) * limit,
                order,
                include: [{ model: Agent, as: "assignee", attributes: assigneeAttributes, required: false }],
            });

            // travel leads: trip value (set deal value, else latest open quote, else budget) for cards and the board
            const travelIds = rows.filter((r: any) => r.dataValues.business_line === "travel").map((r: any) => r.dataValues.id);
            const quoteRows: any[] = travelIds.length ? await Quotation.findAll({ where: { crm_lead_id: travelIds, status: { [Op.in]: ["draft", "sent", "accepted"] } }, attributes: ["crm_lead_id", "sell_total"], order: [["updatedAt", "DESC"]], raw: true }) : [];
            const quoteOf = new Map<number, number>();
            for (const q of quoteRows) if (!quoteOf.has(q.crm_lead_id)) quoteOf.set(q.crm_lead_id, Number(q.sell_total));
            const leads = rows.map((r: any) => {
                const j = r.toJSON();
                if (j.business_line !== "travel") return j;
                const paise = j.deal_value != null ? Number(j.deal_value) : quoteOf.get(j.id) ?? (j.budget != null ? Number(j.budget) : null);
                return { ...j, trip_value: paise == null ? null : Math.round(paise) / 100 };
            });

            return returnHelper(res, 200, true, "Leads fetched", {
                leads,
                pagination: { currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count, itemsPerPage: limit },
            });
        } catch (error) {
            return handleError(res, error, "listLeads");
        }
    }

    // GET /crm/leads/summary
    async summary(req: RequestWithUser, res: Response) {
        try {
            const where = { ...scopeWhere(req), ...branchFilter(req) };
            const [byStatus, bySource, today, overdue, newToday] = await Promise.all([
                CrmLead.count({ where, group: ["status"] }) as any,
                CrmLead.count({ where, group: ["source"] }) as any,
                CrmLead.count({ where: { ...where, status: { [Op.notIn]: CLOSED_STATUSES }, next_follow_up_at: { [Op.between]: [startOfToday(), endOfToday()] } } }),
                CrmLead.count({ where: { ...where, status: { [Op.notIn]: CLOSED_STATUSES }, next_follow_up_at: { [Op.lt]: startOfToday() } } }),
                CrmLead.count({ where: { ...where, createdAt: { [Op.gte]: startOfToday() } } }),
            ]);
            const toMap = (rows: any[], key: string) =>
                rows.reduce((acc: Record<string, number>, row: any) => ({ ...acc, [row[key]]: Number(row.count) }), {});
            const statusMap = toMap(byStatus, "status");
            const total = Object.values(statusMap).reduce((a: number, b: number) => a + b, 0);
            return returnHelper(res, 200, true, "Summary fetched", {
                total,
                by_status: statusMap,
                by_source: toMap(bySource, "source"),
                follow_ups_today: today,
                follow_ups_overdue: overdue,
                new_today: newToday,
            });
        } catch (error) {
            return handleError(res, error, "summary");
        }
    }

    // POST /crm/leads/check_duplicate  { phone_number?, country_code?, email?, exclude_uuid? }
    async checkDuplicate(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const body = req.body || {};
            const phone = body.phone_number || body.phone ? normalizePhone(body.phone_number || body.phone, body.country_code) : null;
            const email = body.email ? String(body.email).trim().toLowerCase() : null;
            let excludeId: number | null = null;
            if (body.exclude_uuid) {
                const existing: any = await CrmLead.findOne({ where: { ...scopeWhere(req), uuid: String(body.exclude_uuid) }, attributes: ["id"] });
                excludeId = existing?.dataValues?.id || null;
            }
            const hit = await findDuplicateLead(agencyUuid, {
                phoneNormalized: phone?.normalized || null,
                email,
                excludeId,
            });
            if (!hit) return returnHelper(res, 200, true, "No duplicate", { duplicate: false });
            return returnHelper(res, 200, true, "Possible duplicate found", {
                duplicate: true,
                match: hit.match,
                existing: presentDuplicateLead(hit.lead),
            });
        } catch (error) {
            return handleError(res, error, "checkDuplicate");
        }
    }

    // POST /crm/leads
    // Manual create: soft-warn on phone/email match unless merge | confirm_duplicate.
    // Integrations / imports still auto-merge via ingestLead.
    async createLead(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            const body = req.body || {};
            const input = {
                name: body.name,
                phone: body.phone_number || body.phone,
                country_code: body.country_code,
                email: body.email,
                city: body.city,
                interested_country: body.interested_country,
                interested_course: body.interested_course,
                visa_type: body.visa_type,
                intake: body.intake,
                message: body.message,
                campaign: body.campaign,
                tags: Array.isArray(body.tags) ? body.tags : null,
                // team members always own what they add
                assigned_to: isOwner ? (body.assigned_to ? Number(body.assigned_to) : null) : userId,
                status: body.status,
                next_follow_up_at: body.next_follow_up_at,
                // the owner may pick a branch; a team member's lead goes to their own branch
                branch_id: isOwner ? (body.branch_id ? Number(body.branch_id) : null) : accessOf(req).branchId,
                travel: cleanTravelLeadFields(body),
            };
            const source = (CRM_LEAD_SOURCES as readonly string[]).includes(body.source) ? body.source : "manual";
            const merge = body.merge === true || body.merge === "1";
            const confirmDuplicate = body.confirm_duplicate === true || body.confirm_duplicate === "1";

            if (source === "manual" && !merge && !confirmDuplicate) {
                const phone = normalizePhone(input.phone, input.country_code);
                const email = input.email ? String(input.email).trim().toLowerCase() : null;
                const hit = await findDuplicateLead(agencyUuid, {
                    phoneNormalized: phone?.normalized || null,
                    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
                });
                if (hit) {
                    const what = hit.match === "both" ? "phone and email" : hit.match;
                    return returnHelper(res, 200, true, `A lead with this ${what} already exists`, {
                        needs_confirm: true,
                        match: hit.match,
                        existing: presentDuplicateLead(hit.lead),
                        merge_hint: "Merge adds this as a new enquiry on the existing lead instead of creating a second record.",
                    });
                }
            }

            const result = await ingestLead({
                agencyUuid, source, input, createdBy: userId,
                allowDuplicate: confirmDuplicate && !merge,
            });
            const message = result.created
                ? "Lead added successfully"
                : "This person is already in your leads - we added this as a new enquiry on the existing lead";
            return returnHelper(res, 200, true, message, { lead: result.lead, duplicate: result.duplicate });
        } catch (error) {
            return handleError(res, error, "createLead");
        }
    }

    // GET /crm/leads/:uuid
    async leadDetails(req: RequestWithUser, res: Response) {
        try {
            const lead: any = await CrmLead.findOne({
                where: { ...scopeWhere(req), uuid: req.params.uuid },
                include: [{ model: Agent, as: "assignee", attributes: assigneeAttributes, required: false }],
            });
            if (!lead) return returnHelper(res, 200, false, "Lead not found");

            const activities = await CrmLeadActivity.findAll({
                where: { lead_id: lead.dataValues.id },
                include: [{ model: Agent, as: "author", attributes: ["id", "username"], required: false }],
                order: [["createdAt", "DESC"], ["id", "DESC"]],
                limit: 200,
            });
            const whatsapp = await LeadIntegration.count({ where: { agency_uuid: ctx(req).agencyUuid, type: "whatsapp", status: "active" } });
            return returnHelper(res, 200, true, "Lead fetched", {
                lead,
                activities,
                whatsapp_enabled: whatsapp > 0,
                doc_checklist: checklistSummary(lead.dataValues.doc_checklist),
                travel: {
                    ...presentTravelLead(lead.toJSON()),
                    booking_id: lead.dataValues.converted_booking_id
                        ? ((await Booking.findOne({ where: { id: lead.dataValues.converted_booking_id, agency_uuid: ctx(req).agencyUuid }, attributes: ["uuid"], raw: true })) as any)?.uuid || null
                        : null,
                },
            });
        } catch (error) {
            return handleError(res, error, "leadDetails");
        }
    }

    // POST /crm/leads/:uuid/update
    async updateLead(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");

            const body = req.body || {};
            const confirmDuplicate = body.confirm_duplicate === true || body.confirm_duplicate === "1";
            const updates: Record<string, any> = {};
            for (const field of EDITABLE_FIELDS) {
                if (body[field] === undefined) continue;
                if (field === "tags") {
                    updates.tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim().slice(0, 40)).filter(Boolean) : null;
                } else {
                    const value = body[field] === null ? null : String(body[field]).trim();
                    updates[field] = value ? value.slice(0, field === "message" ? 5000 : 255) : null;
                }
            }
            if (body.doc_checklist !== undefined) {
                updates.doc_checklist = normalizeDocChecklist(body.doc_checklist);
            }
            Object.assign(updates, cleanTravelLeadFields(body));
            if (updates.email) {
                updates.email = updates.email.toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) return returnHelper(res, 200, false, "Please enter a valid email");
            }
            let phoneNormalized: string | null = null;
            if (body.phone_number !== undefined) {
                const phone = normalizePhone(body.phone_number, body.country_code);
                if (!phone) return returnHelper(res, 200, false, "Please enter a valid phone number");
                phoneNormalized = phone.normalized;
                Object.assign(updates, { phone_number: phone.phone_number, country_code: phone.country_code, phone_normalized: phone.normalized });
            }
            // Soft-warn only when contact details are newly clashing (not on every unrelated save)
            const phoneChanged = Boolean(phoneNormalized && phoneNormalized !== lead.dataValues.phone_normalized);
            const emailChanged = Boolean(updates.email !== undefined && updates.email !== (lead.dataValues.email || null));
            if ((phoneChanged || emailChanged) && !confirmDuplicate) {
                const hit = await findDuplicateLead(agencyUuid, {
                    phoneNormalized: phoneChanged ? phoneNormalized : null,
                    email: emailChanged ? updates.email : null,
                    excludeId: lead.dataValues.id,
                });
                if (hit) {
                    const what = hit.match === "both" ? "phone and email" : hit.match;
                    return returnHelper(res, 200, true, `Another lead already has this ${what}`, {
                        needs_confirm: true,
                        match: hit.match,
                        existing: presentDuplicateLead(hit.lead),
                        merge_hint: "Open the existing lead instead of overwriting contact details, or confirm to save anyway.",
                    });
                }
            }
            if (!updates.email && !updates.phone_normalized && !lead.dataValues.phone_normalized && body.email !== undefined && !body.email) {
                return returnHelper(res, 200, false, "A lead needs a phone number or email");
            }
            if (!Object.keys(updates).length) return returnHelper(res, 200, false, "Nothing to update");

            await CrmLead.update(updates, { where: { id: lead.dataValues.id } });
            await logActivity(lead.dataValues.id, agencyUuid, "updated", "Lead details updated", userId, { fields: Object.keys(updates) });
            return returnHelper(res, 200, true, "Lead updated", {
                doc_checklist: updates.doc_checklist !== undefined ? checklistSummary(updates.doc_checklist) : undefined,
            });
        } catch (error) {
            return handleError(res, error, "updateLead");
        }
    }

    // POST /crm/leads/:uuid/status
    async changeStatus(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const { status, lost_reason, note } = req.body || {};
            if (!(CRM_LEAD_STATUSES as readonly string[]).includes(status)) return returnHelper(res, 200, false, "Invalid status");
            if (status === "converted") {
                return returnHelper(res, 200, false, "Use 'Convert to visa case' to convert a lead");
            }
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            if (lead.dataValues.status === "converted") return returnHelper(res, 200, false, "This lead is already converted");
            if (lead.dataValues.status === status) return returnHelper(res, 200, false, "Lead already has this status");
            if (status === "lost" && !lost_reason) return returnHelper(res, 200, false, "Please give a reason for losing this lead");

            await CrmLead.update(
                {
                    status,
                    lost_reason: status === "lost" ? String(lost_reason).slice(0, 2000) : null,
                    // closed leads do not need a reminder
                    ...(CLOSED_STATUSES.includes(status) && { next_follow_up_at: null, follow_up_note: null }),
                },
                { where: { id: lead.dataValues.id } },
            );
            const text = [`Status changed from ${label(lead.dataValues.status)} to ${label(status)}`, status === "lost" ? `Reason: ${lost_reason}` : null, note || null]
                .filter(Boolean).join(". ");
            await logActivity(lead.dataValues.id, agencyUuid, "status_change", text, userId, { from: lead.dataValues.status, to: status });
            return returnHelper(res, 200, true, "Status updated");
        } catch (error) {
            return handleError(res, error, "changeStatus");
        }
    }

    // POST /crm/leads/:uuid/assign  (agency owner only)
    async assignLead(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isManager } = ctx(req);
            if (!isManager) return returnHelper(res, 200, false, "Only the owner or a branch manager can assign leads");
            const agentId = req.body?.agent_id ? Number(req.body.agent_id) : null;
            if (agentId && (!(await isAgencyMember(agencyUuid, agentId)) || !canAssignTo(req, agentId))) return returnHelper(res, 200, false, "Team member not found");

            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            if ((lead.dataValues.assigned_to || null) === agentId) return returnHelper(res, 200, false, "Already assigned to this person");

            // work follows the person: assigning to someone of another branch moves the lead there
            const newBranch = await branchOfAgent(agentId);
            const moves = Boolean(newBranch && newBranch !== lead.dataValues.branch_id);
            await CrmLead.update({ assigned_to: agentId, ...(moves && { branch_id: newBranch }) }, { where: { id: lead.dataValues.id } });
            if (agentId) {
                notifyLater({
                    agencyUuid, recipientIds: [agentId], type: "lead_assigned", skipUserId: userId,
                    title: `Lead assigned to you: ${lead.dataValues.name || lead.dataValues.phone_number || "lead"}`,
                    body: [lead.dataValues.interested_country, lead.dataValues.interested_course].filter(Boolean).join(" · ") || null,
                    link: `/crm/leads/${lead.dataValues.uuid}`, email: true,
                });
            }
            const assignee: any = agentId ? await Agent.findByPk(agentId, { attributes: ["username"] }) : null;
            await logActivity(
                lead.dataValues.id, agencyUuid, "assignment",
                agentId ? `Assigned to ${assignee?.dataValues?.username || "team member"}` : "Unassigned",
                userId, { from: lead.dataValues.assigned_to, to: agentId },
            );
            return returnHelper(res, 200, true, agentId ? "Lead assigned" : "Lead unassigned");
        } catch (error) {
            return handleError(res, error, "assignLead");
        }
    }

    // POST /crm/leads/:uuid/branch { branch_id | null }  - move a lead to another branch (owner, or the manager of its branch)
    async transferLead(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isManager } = ctx(req);
            if (!isManager) return returnHelper(res, 200, false, "Only the owner or a branch manager can move leads");
            const branchId = req.body?.branch_id ? Number(req.body.branch_id) : null;
            if (branchId && !(await isAgencyBranch(agencyUuid, branchId))) return returnHelper(res, 200, false, "Branch not found");
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            if ((lead.dataValues.branch_id || null) === branchId) return returnHelper(res, 200, false, "The lead is already in this branch");
            const result = await moveLeadToBranch(agencyUuid, lead, branchId, userId);
            return returnHelper(res, 200, true, result);
        } catch (error) {
            return handleError(res, error, "transferLead");
        }
    }

    // POST /crm/leads/:uuid/activity  { type: note|call|email|whatsapp, message, outcome?, mention_ids?: number[] }
    async addActivity(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const { type = "note", message, outcome, mention_ids } = req.body || {};
            if (!MANUAL_ACTIVITY_TYPES.includes(type)) return returnHelper(res, 200, false, "Invalid activity type");
            if (!message || !String(message).trim()) return returnHelper(res, 200, false, "Please write a note");

            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");

            const text = String(message).trim().slice(0, 5000);
            // @mentions: ids from the picker, plus any @username still in the text
            const team = await getTeamMembers(agencyUuid);
            const owner: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "username"] });
            const people: { id: number; username: string }[] = [
                ...(owner ? [{ id: owner.dataValues.id, username: String(owner.dataValues.username || "").trim() }] : []),
                ...team.map((m: any) => ({ id: m.dataValues.id, username: String(m.dataValues.username || "").trim() })),
            ].filter((p) => p.id && p.username);
            const byId = new Map(people.map((p) => [p.id, p]));
            const byName = new Map(people.map((p) => [p.username.toLowerCase(), p]));
            const mentioned = new Map<number, { id: number; username: string }>();
            for (const raw of Array.isArray(mention_ids) ? mention_ids : []) {
                const id = Number(raw);
                if (byId.has(id)) mentioned.set(id, byId.get(id)!);
            }
            for (const match of text.matchAll(/@([A-Za-z0-9._\- ]{1,40})/g)) {
                const key = String(match[1] || "").trim().toLowerCase();
                const hit = byName.get(key);
                if (hit) mentioned.set(hit.id, hit);
            }
            const mentionList = [...mentioned.values()].filter((p) => p.id !== userId);
            const meta: Record<string, any> = {};
            if (outcome) meta.outcome = String(outcome).slice(0, 100);
            if (mentionList.length) meta.mentions = mentionList.map((p) => ({ id: p.id, username: p.username }));

            await logActivity(lead.dataValues.id, agencyUuid, type, text, userId, Object.keys(meta).length ? meta : null);

            if (mentionList.length) {
                const author: any = await Agent.findByPk(userId, { attributes: ["username"] });
                const who = author?.dataValues?.username || "A teammate";
                const leadName = lead.dataValues.name || "a lead";
                notifyLater({
                    agencyUuid,
                    recipientIds: mentionList.map((p) => p.id),
                    type: "mention",
                    title: `${who} mentioned you on ${leadName}`,
                    body: text.slice(0, 280),
                    link: `/crm/leads/${lead.dataValues.uuid}`,
                    skipUserId: userId,
                    email: true,
                });
            }

            // first touch moves a new lead to "contacted"
            if (lead.dataValues.status === "new" && type !== "note") {
                await CrmLead.update({ status: "contacted" }, { where: { id: lead.dataValues.id } });
                await logActivity(lead.dataValues.id, agencyUuid, "status_change", "Status changed from New to Contacted", userId, { from: "new", to: "contacted" });
            }
            return returnHelper(res, 200, true, "Activity added");
        } catch (error) {
            return handleError(res, error, "addActivity");
        }
    }

    // POST /crm/leads/:uuid/follow_up  { date, note }  or  { done: true, note? }
    // Still one next_follow_up_at on the lead; step N is derived from completed follow-ups + activities.
    async setFollowUp(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId } = ctx(req);
            const { date, note, done } = req.body || {};
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");

            const doneCount = await CrmLeadActivity.count({
                where: { lead_id: lead.dataValues.id, type: "follow_up_done" },
            });
            // Open schedule (or the one being completed) is always doneCount + 1.
            const step = doneCount + 1;

            if (done) {
                if (!lead.dataValues.next_follow_up_at) return returnHelper(res, 200, false, "No follow-up scheduled");
                const at = lead.dataValues.next_follow_up_at
                    ? new Date(lead.dataValues.next_follow_up_at).toISOString()
                    : null;
                await CrmLead.update({ next_follow_up_at: null, follow_up_note: null }, { where: { id: lead.dataValues.id } });
                await logActivity(lead.dataValues.id, agencyUuid, "follow_up_done",
                    note ? `Follow-up done: ${String(note).slice(0, 2000)}` : "Follow-up done", userId,
                    { step, at });
                return returnHelper(res, 200, true, "Follow-up marked as done");
            }

            const when = new Date(date);
            if (!date || isNaN(when.getTime())) return returnHelper(res, 200, false, "Please pick a follow-up date and time");
            if (CLOSED_STATUSES.includes(lead.dataValues.status)) return returnHelper(res, 200, false, "This lead is closed");

            await CrmLead.update(
                {
                    next_follow_up_at: when,
                    follow_up_note: note ? String(note).slice(0, 2000) : null,
                    follow_up_notified_at: null,
                    ...(["new", "contacted"].includes(lead.dataValues.status) && { status: "follow_up" }),
                },
                { where: { id: lead.dataValues.id } },
            );
            await logActivity(lead.dataValues.id, agencyUuid, "follow_up",
                note ? String(note).slice(0, 2000) : null, userId, { at: when.toISOString(), step });
            return returnHelper(res, 200, true, "Follow-up scheduled");
        } catch (error) {
            return handleError(res, error, "setFollowUp");
        }
    }

    // POST /crm/leads/:uuid/delete  (agency owner only)
    async deleteLead(req: RequestWithUser, res: Response) {
        try {
            if (!ctx(req).isOwner) return returnHelper(res, 200, false, "Only the agency owner can delete leads");
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            if (lead.dataValues.status === "converted") return returnHelper(res, 200, false, "A converted lead can not be deleted");
            await CrmLead.destroy({ where: { id: lead.dataValues.id } });
            audit(req, { entity: "lead", entityId: lead.dataValues.id, branchId: lead.dataValues.branch_id, action: "deleted", summary: `Lead deleted: ${lead.dataValues.name || lead.dataValues.phone_number || "unnamed"}` });
            return returnHelper(res, 200, true, "Lead deleted");
        } catch (error) {
            return handleError(res, error, "deleteLead");
        }
    }

    // POST /crm/leads/restore { uuids: [] }  - "Undo" after deleting (owner; leads are soft-deleted)
    async restoreLeads(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can restore leads");
            const uuids: string[] = Array.isArray(req.body?.uuids) ? req.body.uuids.slice(0, 500).map(String) : [];
            if (!uuids.length) return returnHelper(res, 200, false, "Nothing to restore");
            // only leads deleted in the last hour can be undone this way
            const where: any = { agency_uuid: agencyUuid, uuid: uuids, deletedAt: { [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) } };
            const rows: any[] = await CrmLead.findAll({ where, paranoid: false, attributes: ["id"] });
            if (!rows.length) return returnHelper(res, 200, false, "These leads can no longer be restored");
            await CrmLead.restore({ where: { id: rows.map((r) => r.dataValues.id) } });
            await CrmLeadActivity.bulkCreate(rows.map((r) => ({ lead_id: r.dataValues.id, agency_uuid: agencyUuid, type: "updated", message: "Lead restored (undo delete)", created_by: userId })));
            audit(req, { entity: "lead", action: "restored", summary: `Restored ${rows.length} deleted lead(s)` });
            return returnHelper(res, 200, true, `${rows.length} lead(s) restored`);
        } catch (error) {
            return handleError(res, error, "restoreLeads");
        }
    }

    // POST /crm/leads/bulk  { uuids: [], action: "assign" | "status" | "branch" | "tag_add" | "tag_remove" | "delete", value }
    async bulkAction(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            const { uuids, action, value } = req.body || {};
            if (!Array.isArray(uuids) || !uuids.length || uuids.length > 500) return returnHelper(res, 200, false, "Select between 1 and 500 leads");
            if (!accessOf(req).isManager) return returnHelper(res, 200, false, "Only the owner or a branch manager can use bulk actions");
            if (action === "delete" && !isOwner) return returnHelper(res, 200, false, "Only the agency owner can delete leads");

            const needTags = action === "tag_add" || action === "tag_remove";
            const leads: any[] = await CrmLead.findAll({
                where: { ...scopeWhere(req), uuid: uuids, status: { [Op.ne]: "converted" } },
                attributes: needTags
                    ? ["id", "uuid", "name", "status", "assigned_to", "branch_id", "tags"]
                    : ["id", "uuid", "name", "status", "assigned_to", "branch_id"],
            });
            if (!leads.length) return returnHelper(res, 200, false, "No leads found");
            const ids = leads.map((l) => l.dataValues.id);

            if (action === "assign") {
                const agentId = value ? Number(value) : null;
                if (agentId && (!(await isAgencyMember(agencyUuid, agentId)) || !canAssignTo(req, agentId))) return returnHelper(res, 200, false, "Team member not found");
                const newBranch = await branchOfAgent(agentId);
                await CrmLead.update({ assigned_to: agentId, last_activity_at: new Date(), ...(newBranch && { branch_id: newBranch }) }, { where: { id: ids } });
                if (agentId) {
                    notifyLater({
                        agencyUuid, recipientIds: [agentId], type: "lead_assigned", skipUserId: userId,
                        title: `${ids.length} lead(s) assigned to you`, link: "/crm/leads", email: true,
                    });
                }
                await CrmLeadActivity.bulkCreate(ids.map((id) => ({
                    lead_id: id, agency_uuid: agencyUuid, type: "assignment",
                    message: agentId ? "Assigned (bulk)" : "Unassigned (bulk)", created_by: userId, meta: { to: agentId },
                })));
            } else if (action === "status") {
                if (!(CRM_LEAD_STATUSES as readonly string[]).includes(value) || ["converted", "lost"].includes(value)) {
                    return returnHelper(res, 200, false, "This status can not be set in bulk");
                }
                await CrmLead.update(
                    { status: value, last_activity_at: new Date(), ...(CLOSED_STATUSES.includes(value) && { next_follow_up_at: null }) },
                    { where: { id: ids } },
                );
                for (const id of ids) await refreshScore(id);
                await CrmLeadActivity.bulkCreate(leads.map((l) => ({
                    lead_id: l.dataValues.id, agency_uuid: agencyUuid, type: "status_change",
                    message: `Status changed from ${label(l.dataValues.status)} to ${label(value)} (bulk)`, created_by: userId,
                    meta: { from: l.dataValues.status, to: value },
                })));
            } else if (action === "branch") {
                if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can move leads between branches");
                const branchId = value ? Number(value) : null;
                if (branchId && !(await isAgencyBranch(agencyUuid, branchId))) return returnHelper(res, 200, false, "Branch not found");
                for (const l of leads) await moveLeadToBranch(agencyUuid, l, branchId, userId);
            } else if (action === "tag_add" || action === "tag_remove") {
                const raw = Array.isArray(value) ? value : String(value || "").split(",");
                const tags = [...new Set(raw.map((t: any) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 10);
                if (!tags.length) return returnHelper(res, 200, false, "Enter at least one tag");
                const now = new Date();
                for (const l of leads) {
                    const current: string[] = Array.isArray(l.dataValues.tags) ? l.dataValues.tags.map(String) : [];
                    const next = action === "tag_add"
                        ? [...new Set([...current, ...tags])].slice(0, 20)
                        : current.filter((t) => !tags.includes(t));
                    await CrmLead.update({ tags: next.length ? next : null, last_activity_at: now }, { where: { id: l.dataValues.id } });
                }
                await CrmLeadActivity.bulkCreate(ids.map((id) => ({
                    lead_id: id, agency_uuid: agencyUuid, type: "updated",
                    message: action === "tag_add" ? `Tags added (bulk): ${tags.join(", ")}` : `Tags removed (bulk): ${tags.join(", ")}`,
                    created_by: userId, meta: { tags, action },
                })));
            } else if (action === "delete") {
                await CrmLead.destroy({ where: { id: ids } });
            } else {
                return returnHelper(res, 200, false, "Invalid action");
            }
            const names = leads.slice(0, 5).map((l) => l.dataValues.name || "unnamed").join(", ") + (leads.length > 5 ? ` and ${leads.length - 5} more` : "");
            const verb: Record<string, string> = {
                assign: "Reassigned", status: "Status changed", delete: "Deleted", branch: "Moved to another branch",
                tag_add: "Tagged", tag_remove: "Untagged",
            };
            const valueLabel = action === "tag_add" || action === "tag_remove"
                ? (Array.isArray(value) ? value.join(", ") : String(value || ""))
                : value;
            audit(req, { entity: "lead", action: `bulk_${action}`, summary: `${verb[action] || "Updated"} ${ids.length} lead(s)${valueLabel && action !== "delete" ? ` (${String(valueLabel).slice(0, 40)})` : ""}: ${names}`, meta: { ids: ids.slice(0, 500), value: value ?? null } });
            return returnHelper(res, 200, true, `${ids.length} lead(s) updated`);
        } catch (error) {
            return handleError(res, error, "bulkAction");
        }
    }

    // POST /crm/leads/import  (multipart: file, optional assigned_to, tags)
    async importLeads(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            try { await assertSourceAllowed(ctx(req).agencyUuid, "csv"); } catch (e: any) { return returnHelper(res, 200, false, e.message); }
            const file = (req as any).file as Express.Multer.File | undefined;
            if (!file) return returnHelper(res, 200, false, "Please choose a .csv or .xlsx file");

            let assignedTo: number | null = isOwner ? null : userId;
            if (isOwner && req.body?.assigned_to) {
                const id = Number(req.body.assigned_to);
                if (!(await isAgencyMember(agencyUuid, id))) return returnHelper(res, 200, false, "Team member not found");
                assignedTo = id;
            }
            const tags = req.body?.tags ? String(req.body.tags).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10) : null;

            const summary = await importLeadsFromFile(file.buffer, file.originalname, agencyUuid, userId, { assigned_to: assignedTo, tags });
            if (assignedTo && assignedTo !== userId && summary.created) {
                notifyLater({
                    agencyUuid, recipientIds: [assignedTo], type: "lead_assigned",
                    title: `${summary.created} new lead(s) assigned to you`, body: `Imported from ${file.originalname}`,
                    link: "/crm/leads?status=new",
                });
            }
            audit(req, { entity: "lead", action: "imported", summary: `Imported ${summary.created} new lead(s) from ${file.originalname} (${summary.duplicates} duplicates, ${summary.failed} failed)` });
            return returnHelper(res, 200, true,
                `Imported ${summary.created} new lead(s), ${summary.duplicates} duplicate(s) merged, ${summary.failed} failed`, summary);
        } catch (error) {
            return handleError(res, error, "importLeads");
        }
    }

    // GET /crm/leads/import/template
    async importTemplate(req: RequestWithUser, res: Response) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="leads-import-template.csv"');
        return res.status(200).send(IMPORT_TEMPLATE_CSV);
    }

    // POST /crm/leads/:uuid/convert  { country, intake?, visa_type?, course?, template_id?, assigned_to?, checklist_ack? }
    async convertLead(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, agencyId, userId, isOwner } = ctx(req);
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");

            const body = req.body || {};
            const checklist = checklistSummary(lead.dataValues.doc_checklist);
            const checklistAck = body.checklist_ack === true || body.checklist_ack === "1";
            // Agency owners convert via the case-setup stepper (no doc gate). Team still soft-warns.
            if (!isOwner && !checklist.complete && !checklistAck) {
                return returnHelper(res, 200, true, "Some documents are still missing — confirm to convert anyway", {
                    needs_checklist_ack: true,
                    doc_checklist: checklist,
                });
            }

            const template = null; // visa process templates are not part of the Travel CRM

            // owners pick who handles the case; a team member keeps the case they convert
            let assignTo: number | null = isOwner ? null : userId;
            if (isOwner) {
                const wanted = body.assigned_to ? Number(body.assigned_to) : lead.dataValues.assigned_to;
                if (wanted && (await isAgencyMember(agencyUuid, Number(wanted)))) assignTo = Number(wanted);
            }

            const result = await convertLeadToCase({
                agencyUuid,
                agencyId,
                userId,
                lead,
                country: body.country || lead.dataValues.interested_country,
                intake: body.intake ?? lead.dataValues.intake,
                visaType: body.visa_type,
                course: body.course,
                university: body.university,
                assignTo,
                branchId: lead.dataValues.branch_id || (await branchOfAgent(assignTo)),
                template,
            });
            if (!isOwner && !checklist.complete && checklistAck) {
                await logActivity(
                    lead.dataValues.id, agencyUuid, "note",
                    `Converted with incomplete docs: ${checklist.missing.map((m) => m.label).join(", ")}`,
                    userId, { missing_docs: checklist.missing.map((m) => m.key), checklist_ack: true },
                );
            }
            if (assignTo && assignTo !== userId) {
                notifyLater({
                    agencyUuid, recipientIds: [assignTo], type: "case_assigned",
                    title: `New visa case for you: ${lead.dataValues.name || "student"}`,
                    body: `${body.country || lead.dataValues.interested_country || ""}${template ? ` · ${template.name}` : ""}`,
                    link: `/leads/progress/${result.caseId}`, email: true,
                });
            }
            runTrigger(agencyUuid, "lead_converted", { name: lead.dataValues.name, phoneDigits: lead.dataValues.phone_normalized, email: lead.dataValues.email, leadId: lead.dataValues.id }, { country: body.country || lead.dataValues.interested_country || "" });
            const fresh: any = await CrmLead.findByPk(lead.dataValues.id);
            const country = body.country || fresh.dataValues.interested_country;
            // student credentials email goes out on convert to visa case (not when the CRM lead is created)
            let inviteEmail: { sent: boolean; reason?: string } | null = null;
            if (fresh.dataValues.email) {
                const mail = await sendPortalInviteEmail(agencyUuid, fresh, country);
                inviteEmail = { sent: mail.sent, reason: mail.reason };
                if (mail.sent) {
                    await logPortalSafe(
                        fresh.dataValues.id, agencyUuid,
                        `Portal invite emailed to ${mail.invite.email} on convert`,
                        { kind: "portal_invite", auto: true, to: mail.invite.email, portal_url: mail.invite.portal_url },
                        userId,
                    );
                }
            }
            const invite = await buildPortalInvite(agencyUuid, fresh, country);
            const msg = inviteEmail?.sent
                ? "Lead converted to a visa case. Student portal login was emailed."
                : "Lead converted to a visa case";
            return returnHelper(res, 200, true, msg, { ...result, invite, invite_email: inviteEmail });
        } catch (error) {
            if (error instanceof ConversionError) return returnHelper(res, 200, false, error.message);
            return handleError(res, error, "convertLead");
        }
    }

    // GET /crm/leads/:uuid/invite  - portal invite message for a converted lead
    async portalInvite(req: RequestWithUser, res: Response) {
        try {
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            if (lead.dataValues.status !== "converted") return returnHelper(res, 200, false, "Convert the lead first");
            const invite = await buildPortalInvite(ctx(req).agencyUuid, lead);
            return returnHelper(res, 200, true, "Invite ready", invite);
        } catch (error) {
            return handleError(res, error, "portalInvite");
        }
    }

    // POST /crm/leads/:uuid/invite/email  - send portal invite via Resend / platform mailer
    async sendPortalInvite(req: RequestWithUser, res: Response) {
        try {
            const lead: any = await findScopedLead(req, req.params.uuid);
            if (!lead) return returnHelper(res, 200, false, "Lead not found");
            if (lead.dataValues.status !== "converted") return returnHelper(res, 200, false, "Convert the lead first");
            const { agencyUuid, userId } = ctx(req);
            const result = await sendPortalInviteEmail(agencyUuid, lead);
            if (!result.sent) {
                return returnHelper(res, 200, false, result.reason || "Could not send the invite email", {
                    email_sent: false,
                    invite: result.invite,
                });
            }
            await logPortalSafe(
                lead.dataValues.id,
                agencyUuid,
                `Portal invite emailed to ${result.invite.email}`,
                { kind: "portal_invite", to: result.invite.email, portal_url: result.invite.portal_url },
                userId,
            );
            return returnHelper(res, 200, true, `Portal invite emailed to ${result.invite.email}`, {
                email_sent: true,
                invite: result.invite,
            });
        } catch (error) {
            return handleError(res, error, "sendPortalInvite");
        }
    }

    // GET /crm/team  - people a lead can be assigned to
    async team(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const owner = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: assigneeAttributes });
            const members = await getTeamMembers(agencyUuid);
            // a branch manager is only offered the people of their branch
            const a = accessOf(req);
            const all: any[] = [owner, ...members].filter(Boolean);
            const visible = a.isOwner || a.seesAll ? all : all.filter((m: any) => a.memberIds.includes(m.dataValues.id));
            return returnHelper(res, 200, true, "Team fetched", visible);
        } catch (error) {
            return handleError(res, error, "team");
        }
    }

    // GET /crm/settings
    async getSettings(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({
                where: { uuid: ctx(req).agencyUuid, role: "agent" },
                attributes: ["crm_auto_assign", "crm_auto_assign_member_ids", "crm_rules"],
            });
            let autoAssignMemberIds: number[] = [];
            try {
                const raw = agency?.dataValues?.crm_auto_assign_member_ids;
                const parsed = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
                if (Array.isArray(parsed)) {
                    autoAssignMemberIds = parsed.map((v: any) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0);
                }
            } catch { /* keep [] */ }
            return returnHelper(res, 200, true, "Settings fetched", {
                auto_assign: Number(agency?.dataValues?.crm_auto_assign) === 1,
                auto_assign_member_ids: autoAssignMemberIds,
                rules: readRules(agency?.dataValues?.crm_rules),
            });
        } catch (error) {
            return handleError(res, error, "getSettings");
        }
    }

    // POST /crm/settings  { auto_assign?: boolean, auto_assign_member_ids?: number[], rules?: { new_lead_hours, stale_days } }
    async updateSettings(req: RequestWithUser, res: Response) {
        try {
            if (!ctx(req).isOwner) return returnHelper(res, 200, false, "Only the agency owner can change settings");
            const { agencyUuid } = ctx(req);
            const updates: Record<string, any> = {};
            if (req.body?.auto_assign !== undefined) updates.crm_auto_assign = req.body.auto_assign ? 1 : 0;
            if (req.body?.auto_assign_member_ids !== undefined) {
                const raw = Array.isArray(req.body.auto_assign_member_ids) ? req.body.auto_assign_member_ids : [];
                const requested = [...new Set(raw.map((v: any) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0))];
                if (!requested.length) {
                    updates.crm_auto_assign_member_ids = null; // empty = all eligible counsellors / branch managers
                } else {
                    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id"] });
                    if (!agency) return returnHelper(res, 200, false, "Agency not found");
                    const eligible: any[] = await Agent.findAll({
                        where: {
                            parent_id: agency.dataValues.id,
                            status: "active",
                            team_role: ["counsellor", "branch_manager"],
                            id: requested,
                        },
                        attributes: ["id"],
                    });
                    const validIds = eligible.map((m) => m.dataValues.id);
                    if (validIds.length !== requested.length) {
                        return returnHelper(res, 200, false, "Only active counsellors and branch managers can be selected for auto-assign");
                    }
                    updates.crm_auto_assign_member_ids = JSON.stringify(validIds);
                }
            }
            if (req.body?.rules !== undefined) {
                const num = (v: any, max: number) => {
                    if (v === null || v === undefined || v === "") return null;
                    const n = Math.round(Number(v));
                    return Number.isFinite(n) && n >= 1 && n <= max ? n : null;
                };
                updates.crm_rules = JSON.stringify({ new_lead_hours: num(req.body.rules?.new_lead_hours, 72), stale_days: num(req.body.rules?.stale_days, 60) });
            }
            if (!Object.keys(updates).length) return returnHelper(res, 200, false, "Nothing to save");
            await Agent.update(updates, { where: { uuid: agencyUuid, role: "agent" } });
            return returnHelper(res, 200, true, "Settings saved");
        } catch (error) {
            return handleError(res, error, "updateSettings");
        }
    }
}

export default new CrmController();
