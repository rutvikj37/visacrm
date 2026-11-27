import { branchOfAgent, isAgencyBranch, pickBranchAssignee, resolveLeadBranch } from "./branches";
import { filterAutoAssignTeam, readAutoAssignMemberIds } from "./autoAssignMembers";
import { Op } from "sequelize";
import { leadRecipients, notifyLater } from "./notifications";
import { refreshScore } from "./leadScore";
import { runTrigger } from "./messaging";
import CrmLead, { CrmLeadSource, CrmLeadStatus, CRM_LEAD_STATUSES } from "../model/CrmLead";
import CrmLeadActivity, { CrmActivityType } from "../model/CrmLeadActivity";
import LeadIntegration from "../model/LeadIntegration";
import Agent from "../model/Agent";
import { destinationAssignee } from "./travelAccess";
import { travelFromExtra } from "./travel";

/**
 * One place where every lead enters the CRM, whatever the source.
 *
 *   ingestLead() -> clean the data -> skip if already imported (same source id)
 *                -> merge into an existing lead with the same phone/email (re-enquiry)
 *                -> or create a new lead, log it, and auto-assign it
 */

export interface LeadInput {
    name?: string | null;
    phone?: string | null;
    country_code?: string | null;
    email?: string | null;
    city?: string | null;
    interested_country?: string | null;
    interested_course?: string | null;
    visa_type?: string | null;
    intake?: string | null;
    message?: string | null;
    campaign?: string | null;
    source_ref?: string | null;
    extra?: Record<string, any> | null;
    tags?: string[] | null;
    assigned_to?: number | null;
    status?: CrmLeadStatus | null;
    next_follow_up_at?: Date | string | null;
    branch_id?: number | null; // chosen by a person adding the lead (wins over routing)
    travel?: Record<string, any> | null; // travel enquiry fields, already cleaned (services/travel.ts)
}

export interface IngestOptions {
    agencyUuid: string;
    source: CrmLeadSource;
    input: LeadInput;
    integrationId?: number | null;
    createdBy?: number | null;
    // Instagram DMs: the person is known only by their Instagram id (source_ref), no phone / email yet
    allowNoContact?: boolean;
    /** Manual create confirmed "create anyway" — skip phone/email merge into an existing lead */
    allowDuplicate?: boolean;
}

export type DuplicateMatch = "phone" | "email" | "both";

/** Summarise an existing lead for duplicate warnings (no sensitive extras). */
export const presentDuplicateLead = (lead: any) => {
    const d = lead?.dataValues || lead || {};
    return {
        uuid: d.uuid,
        name: d.name || null,
        phone_number: d.phone_number || null,
        country_code: d.country_code || null,
        email: d.email || null,
        status: d.status || null,
        assigned_to: d.assigned_to || null,
    };
};

/**
 * Find an open (non-converted) lead in this agency with the same phone and/or email.
 * Used for soft-warn on manual create/update; integrations still auto-merge via ingestLead.
 */
export const findDuplicateLead = async (
    agencyUuid: string,
    opts: { phoneNormalized?: string | null; email?: string | null; excludeId?: number | null },
): Promise<{ lead: any; match: DuplicateMatch } | null> => {
    const phone = opts.phoneNormalized || null;
    const email = opts.email ? String(opts.email).trim().toLowerCase() : null;
    if (!phone && !email) return null;

    const or: any[] = [];
    if (phone) or.push({ phone_normalized: phone });
    if (email) or.push({ email });

    const where: any = {
        agency_uuid: agencyUuid,
        status: { [Op.ne]: "converted" },
        [Op.or]: or,
    };
    if (opts.excludeId) where.id = { [Op.ne]: opts.excludeId };

    const lead: any = await CrmLead.findOne({
        where,
        attributes: ["id", "uuid", "name", "phone_number", "country_code", "phone_normalized", "email", "status", "assigned_to"],
        order: [["createdAt", "DESC"]],
    });
    if (!lead) return null;

    const d = lead.dataValues;
    const phoneHit = Boolean(phone && d.phone_normalized === phone);
    const emailHit = Boolean(email && d.email === email);
    const match: DuplicateMatch = phoneHit && emailHit ? "both" : phoneHit ? "phone" : "email";
    return { lead, match };
};

export interface IngestResult {
    lead: any;
    created: boolean;
    duplicate: boolean;
}

export class LeadValidationError extends Error { }

const DEFAULT_COUNTRY_CODE = "91";
const MAX_TEXT = 255;

const clean = (value: any, max = MAX_TEXT): string | null => {
    if (value === undefined || value === null) return null;
    const str = String(value).replace(/\s+/g, " ").trim();
    if (!str) return null;
    return str.slice(0, max);
};

/**
 * Normalise a phone number.
 * Accepts "+91 98765 43210", "09876543210", "919876543210", "+91-9876543210", or ("9876543210", "+91").
 */
export const normalizePhone = (rawPhone?: string | null, rawCountryCode?: string | null) => {
    if (!rawPhone) return null;
    const phoneStr = String(rawPhone).trim();
    let digits = phoneStr.replace(/\D/g, "");
    if (!digits) return null;

    let cc = rawCountryCode ? String(rawCountryCode).replace(/\D/g, "") : "";
    const hadPlus = phoneStr.startsWith("+") || phoneStr.startsWith("00");
    if (phoneStr.startsWith("00")) digits = digits.slice(2);

    let national = digits;
    if (cc) {
        if (digits.startsWith(cc) && digits.length > 10) national = digits.slice(cc.length);
    } else if (hadPlus) {
        // "+<cc><number>" - assume a 10 digit national number, which fits India and most of our markets
        if (digits.length > 10) {
            cc = digits.slice(0, digits.length - 10);
            national = digits.slice(-10);
        }
    } else if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
        cc = DEFAULT_COUNTRY_CODE;
        national = digits.slice(2);
    }
    national = national.replace(/^0+/, "");
    if (!cc) cc = DEFAULT_COUNTRY_CODE;

    if (national.length < 6 || national.length > 14) return null;

    return {
        country_code: `+${cc}`,
        phone_number: national,
        normalized: `${cc}${national}`,
    };
};

const normalizeEmail = (email?: string | null): string | null => {
    const value = clean(email);
    if (!value) return null;
    const lower = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower) ? lower : null;
};

export const logActivity = async (
    leadId: number,
    agencyUuid: string,
    type: CrmActivityType,
    message: string | null,
    createdBy: number | null = null,
    meta: Record<string, any> | null = null,
) => {
    await CrmLeadActivity.create({ lead_id: leadId, agency_uuid: agencyUuid, type, message, created_by: createdBy, meta });
    await CrmLead.update({ last_activity_at: new Date() }, { where: { id: leadId } });
    await refreshScore(leadId);
};

/** Active team members of an agency (the agency owner is not part of the rotation). */
export const getTeamMembers = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id"] });
    if (!agency) return [];
    return Agent.findAll({
        where: { parent_id: agency.dataValues.id, status: "active" },
        attributes: ["id", "username", "email", "phone_number", "role", "designation", "team_role", "branch_id"],
        order: [["id", "ASC"]],
    });
};

/** Check that an Agent id belongs to this agency (owner or team member). */
export const isAgencyMember = async (agencyUuid: string, agentId: number): Promise<boolean> => {
    if (!agentId) return false;
    const agent: any = await Agent.findOne({ where: { id: agentId }, attributes: ["id", "uuid", "parent_uuid", "role"] });
    if (!agent) return false;
    return agent.dataValues.uuid === agencyUuid || agent.dataValues.parent_uuid === agencyUuid;
};

const autoAssignOn = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["crm_auto_assign"] });
    return Number(agency?.dataValues?.crm_auto_assign) === 1;
};

/** Round-robin assignment to team members, when the agency switched it on. */
const pickAutoAssignee = async (agencyUuid: string): Promise<number | null> => {
    const agency: any = await Agent.findOne({
        where: { uuid: agencyUuid, role: "agent" },
        attributes: ["id", "crm_auto_assign", "crm_auto_assign_member_ids", "crm_last_assigned_id"],
    });
    if (!agency || Number(agency.dataValues.crm_auto_assign) !== 1) return null;

    // only people who work leads take part in the rotation
    const allEligible: any[] = await Agent.findAll({
        where: { parent_id: agency.dataValues.id, status: "active", team_role: ["counsellor", "branch_manager"] },
        attributes: ["id"],
        order: [["id", "ASC"]],
    });
    const team = filterAutoAssignTeam(allEligible, readAutoAssignMemberIds(agency.dataValues.crm_auto_assign_member_ids));
    if (!team.length) return null;

    const lastId = Number(agency.dataValues.crm_last_assigned_id) || 0;
    const next = team.find((member) => member.dataValues.id > lastId) || team[0];
    await Agent.update({ crm_last_assigned_id: next.dataValues.id }, { where: { id: agency.dataValues.id } });
    return next.dataValues.id;
};

export const ingestLead = async ({
    agencyUuid, source, input, integrationId = null, createdBy = null, allowNoContact = false, allowDuplicate = false,
}: IngestOptions): Promise<IngestResult> => {
    if (!agencyUuid) throw new LeadValidationError("Agency is required");

    const phone = normalizePhone(input.phone, input.country_code);
    const email = normalizeEmail(input.email);
    const sourceRef = clean(input.source_ref);
    if (!phone && !email && !(allowNoContact && sourceRef)) {
        throw new LeadValidationError("A valid phone number or email is required");
    }

    const data = {
        name: clean(input.name),
        city: clean(input.city),
        interested_country: clean(input.interested_country),
        interested_course: clean(input.interested_course),
        visa_type: clean(input.visa_type),
        intake: clean(input.intake),
        message: clean(input.message, 5000),
        campaign: clean(input.campaign),
        ...travelFromExtra(input.extra),
        ...(input.travel || {}),
    };

    // 1. Same record from the same source already imported -> nothing to do (makes syncs safe to repeat)
    if (sourceRef) {
        const existing = await CrmLead.findOne({ where: { agency_uuid: agencyUuid, source, source_ref: sourceRef } });
        if (existing) return { lead: existing, created: false, duplicate: true };
    }

    // 2. Same person already in the CRM -> treat as a re-enquiry (unless create-anyway was confirmed)
    const duplicateWhere: any[] = [];
    if (phone) duplicateWhere.push({ phone_normalized: phone.normalized });
    if (email) duplicateWhere.push({ email });
    // a converted lead is closed business: a new enquiry from the same person opens a fresh lead
    const duplicate: any = !allowDuplicate && duplicateWhere.length ? await CrmLead.findOne({
        where: { agency_uuid: agencyUuid, status: { [Op.ne]: "converted" }, [Op.or]: duplicateWhere },
        order: [["createdAt", "DESC"]],
    }) : null;

    if (duplicate) {
        const updates: Record<string, any> = {
            enquiry_count: (Number(duplicate.dataValues.enquiry_count) || 1) + 1,
            last_activity_at: new Date(),
        };
        // fill in anything we did not know before
        for (const [key, value] of Object.entries(data)) {
            if (value && !duplicate.dataValues[key]) updates[key] = value;
        }
        if (!duplicate.dataValues.email && email) updates.email = email;
        if (!duplicate.dataValues.phone_normalized && phone) {
            updates.phone_normalized = phone.normalized;
            updates.phone_number = phone.phone_number;
            updates.country_code = phone.country_code;
        }
        // a lost / junk lead that asks again is worth another look
        if (["lost", "junk"].includes(duplicate.dataValues.status)) updates.status = "new";

        await CrmLead.update(updates, { where: { id: duplicate.dataValues.id } });
        await logActivity(
            duplicate.dataValues.id,
            agencyUuid,
            "re_enquiry",
            data.message ? `New enquiry via ${source}: ${data.message}` : `New enquiry via ${source}`,
            createdBy,
            { source, source_ref: sourceRef, integration_id: integrationId, extra: input.extra || null },
        );
        if (integrationId) await bumpIntegration(integrationId);

        const fresh = await CrmLead.findByPk(duplicate.dataValues.id);
        return { lead: fresh, created: false, duplicate: true };
    }

    // 3. New lead: which branch, then who (see services/branches.ts)
    let branchId = input.branch_id && (await isAgencyBranch(agencyUuid, Number(input.branch_id)))
        ? Number(input.branch_id)
        : await resolveLeadBranch(agencyUuid, { integrationId, city: data.city });
    let assignedTo: number | null = null;
    let assignedHow = "";
    if (input.assigned_to && (await isAgencyMember(agencyUuid, Number(input.assigned_to)))) {
        assignedTo = Number(input.assigned_to);
        assignedHow = "Assigned on creation";
    } else if ((data as any).destinations && (assignedTo = await destinationAssignee(agencyUuid, (data as any).destinations)) && (await isAgencyMember(agencyUuid, assignedTo))) {
        // travel enquiry: the agency's destination rule wins (e.g. Dubai → Priya)
        assignedHow = "Auto-assigned (destination rule)";
    } else if (await autoAssignOn(agencyUuid)) {
        assignedTo = null;
        // rotate inside the lead's branch when it has counsellors, else across the whole agency
        assignedTo = branchId ? await pickBranchAssignee(agencyUuid, branchId) : null;
        assignedHow = assignedTo ? "Auto-assigned (round robin in branch)" : "Auto-assigned (round robin)";
        if (!assignedTo) assignedTo = await pickAutoAssignee(agencyUuid);
    }
    if (!branchId && assignedTo) branchId = await branchOfAgent(assignedTo);

    const status = input.status && (CRM_LEAD_STATUSES as readonly string[]).includes(input.status) && input.status !== "converted"
        ? input.status
        : "new";

    const followUp = input.next_follow_up_at ? new Date(input.next_follow_up_at) : null;

    const lead: any = await CrmLead.create({
        agency_uuid: agencyUuid,
        ...data,
        email,
        country_code: phone?.country_code || null,
        phone_number: phone?.phone_number || null,
        phone_normalized: phone?.normalized || null,
        source,
        source_ref: sourceRef,
        integration_id: integrationId,
        extra: input.extra || null,
        tags: Array.isArray(input.tags) ? input.tags.map((t) => clean(t, 40)).filter(Boolean) : null,
        status,
        assigned_to: assignedTo,
        branch_id: branchId,
        next_follow_up_at: followUp && !isNaN(followUp.getTime()) ? followUp : null,
        last_activity_at: new Date(),
        created_by: createdBy,
    });

    await CrmLeadActivity.create({
        lead_id: lead.dataValues.id,
        agency_uuid: agencyUuid,
        type: "created",
        message: `Lead received via ${source}`,
        created_by: createdBy,
        meta: { source, source_ref: sourceRef, integration_id: integrationId },
    });
    if (assignedTo) {
        await CrmLeadActivity.create({
            lead_id: lead.dataValues.id,
            agency_uuid: agencyUuid,
            type: "assignment",
            message: assignedHow || "Assigned",
            created_by: createdBy,
            meta: { assigned_to: assignedTo },
        });
    }
    if (integrationId) await bumpIntegration(integrationId);
    await refreshScore(lead.dataValues.id);

    // tell the assignee (or the owner) - CSV imports send one summary instead
    if (source !== "csv") {
        const where = [data.interested_country, data.interested_course].filter(Boolean).join(" · ");
        notifyLater({
            agencyUuid,
            recipientIds: await leadRecipients(agencyUuid, assignedTo),
            type: "new_lead",
            title: `New lead: ${data.name || phone?.phone_number || email || "unknown"}`,
            body: [`via ${source}`, where, data.message ? data.message.slice(0, 160) : null].filter(Boolean).join(" - "),
            link: `/crm/leads/${lead.dataValues.uuid}`,
            skipUserId: createdBy,
        });
    }

    // welcome message to the lead, if the agency set one up (not for bulk imports)
    if (source !== "csv") {
        runTrigger(agencyUuid, "lead_created", { name: data.name, phoneDigits: phone?.normalized || null, email, leadId: lead.dataValues.id }, { country: data.interested_country || "" });
    }

    return { lead, created: true, duplicate: false };
};

const bumpIntegration = async (integrationId: number) => {
    const integration: any = await LeadIntegration.findByPk(integrationId, { attributes: ["id", "leads_received"] });
    if (!integration) return;
    await LeadIntegration.update(
        { leads_received: (Number(integration.dataValues.leads_received) || 0) + 1, last_lead_at: new Date() },
        { where: { id: integrationId } },
    );
};
