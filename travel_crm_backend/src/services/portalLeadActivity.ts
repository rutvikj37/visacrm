import { Op } from "sequelize";
import CrmLead from "../model/CrmLead";
import CrmLeadActivity from "../model/CrmLeadActivity";
import { logActivity } from "./leadIngestion";

/**
 * Mirror student-portal engagement onto the CRM lead timeline
 * (invite already logs from CrmController.sendPortalInvite).
 */

const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

/** Find the CRM lead linked to a converted student (User.id). */
export const leadForStudent = async (studentId: number) => {
    if (!studentId) return null;
    return CrmLead.findOne({
        where: { converted_student_id: studentId, status: "converted" },
        order: [["converted_at", "DESC"]],
    });
};

/** Find the CRM lead linked to a visa case (AgencyLeads.id). */
export const leadForCase = async (caseId: number) => {
    if (!caseId) return null;
    return CrmLead.findOne({
        where: { converted_case_id: caseId, status: "converted" },
        order: [["converted_at", "DESC"]],
    });
};

/** Log student portal login on the linked CRM lead (at most once per day). */
export const logPortalLogin = async (studentId: number, studentName?: string | null) => {
    try {
        const lead: any = await leadForStudent(studentId);
        if (!lead) return;
        const today = await CrmLeadActivity.findAll({
            where: {
                lead_id: lead.dataValues.id,
                createdAt: { [Op.gte]: startOfToday() },
            },
            attributes: ["type", "meta"],
            limit: 40,
        });
        const already = today.some((row: any) => {
            const meta = row.dataValues?.meta;
            return meta && typeof meta === "object" && meta.kind === "portal_login";
        });
        if (already) return;

        const name = (studentName || "Student").trim() || "Student";
        await logPortalSafe(
            lead.dataValues.id,
            lead.dataValues.agency_uuid,
            `${name} logged in to the student portal`,
            { kind: "portal_login", student_id: studentId },
        );
    } catch (error) {
        console.error("logPortalLogin failed", error);
    }
};

/** Prefer type "portal"; fall back to "updated" if the DB enum is not migrated yet. */
export const logPortalSafe = async (
    leadId: number,
    agencyUuid: string,
    message: string,
    meta: Record<string, any>,
    createdBy: number | null = null,
) => {
    try {
        await logActivity(leadId, agencyUuid, "portal", message, createdBy, meta);
    } catch {
        await logActivity(leadId, agencyUuid, "updated", message, createdBy, meta);
    }
};

/** Log a student document upload on the linked CRM lead. */
export const logPortalDocUpload = async (caseId: number, questionText?: string | null, studentName?: string | null) => {
    try {
        const lead: any = await leadForCase(caseId);
        if (!lead) return;
        const name = (studentName || "Student").trim() || "Student";
        const label = (questionText || "a document").trim().slice(0, 120);
        await logPortalSafe(
            lead.dataValues.id,
            lead.dataValues.agency_uuid,
            `${name} uploaded: ${label}`,
            { kind: "portal_doc_upload", case_id: caseId },
        );
    } catch (error) {
        console.error("logPortalDocUpload failed", error);
    }
};
