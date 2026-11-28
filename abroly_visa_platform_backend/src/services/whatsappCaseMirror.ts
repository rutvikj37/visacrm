import crypto from "crypto";
import path from "path";
import CrmLead from "../model/CrmLead";
import CrmLeadFile from "../model/CrmLeadFile";
import AgencyLeads from "../model/AgencyLeads";
import Step from "../model/Step";
import Question from "../model/Question";
import Agent from "../model/Agent";
import { agencyOwner, readStoredFile, saveFile } from "../helpers/storage";
import { whatsappUploadsStepNameOf } from "./businessFocus";

export const WHATSAPP_INBOX_STEP_MARKER = "__whatsapp_inbox__";
export const WHATSAPP_INBOX_STEP_TITLE = "WhatsApp uploads";

const agencyMainId = async (agencyUuid: string) => {
    const row: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id"] });
    return row?.dataValues?.id ? Number(row.dataValues.id) : null;
};

const convertedCaseForLead = async (leadId: number) => {
    const lead: any = await CrmLead.findByPk(leadId, {
        attributes: ["id", "status", "converted_case_id", "converted_student_id", "agency_uuid"],
    });
    if (!lead || lead.dataValues.status !== "converted" || !lead.dataValues.converted_case_id) return null;
    return {
        caseId: Number(lead.dataValues.converted_case_id),
        studentId: Number(lead.dataValues.converted_student_id),
        agencyUuid: String(lead.dataValues.agency_uuid),
    };
};

const defaultInboxTitle = async (agencyUuid: string) => {
    const ag: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["ui_prefs"], raw: true });
    return whatsappUploadsStepNameOf(ag?.ui_prefs, WHATSAPP_INBOX_STEP_TITLE);
};

const ensureWhatsappInboxStep = async (caseId: number, agencyId: number, studentId: number, agencyUuid: string) => {
    const existing: any = await Step.findOne({
        where: { lead_id: caseId, agent_id: agencyId, step_description: WHATSAPP_INBOX_STEP_MARKER },
    });
    if (existing) return existing;

    const lastOrder: any = await Step.max("step_order", { where: { lead_id: caseId } });
    const stepTitle = await defaultInboxTitle(agencyUuid);
    return Step.create({
        lead_id: caseId,
        agent_id: agencyId,
        student_id: studentId,
        created_by_id: agencyId,
        step_title: stepTitle,
        step_description: WHATSAPP_INBOX_STEP_MARKER,
        step_order: (Number(lastOrder) || 0) + 1,
        step_status: 0,
    });
};

/** Copy one CRM lead file into the visa case under an uncategorized “WhatsApp uploads” step. */
export const mirrorLeadFileToConvertedCase = async (opts: {
    leadFileId: number;
    leadId: number;
    agencyUuid: string;
    storage_name: string;
    original_name: string | null;
    mime?: string | null;
    body?: Buffer;
}) => {
    const ctx = await convertedCaseForLead(opts.leadId);
    if (!ctx) return null;

    const fileRow: any = await CrmLeadFile.findByPk(opts.leadFileId, { attributes: ["id", "case_question_id"] });
    if (fileRow?.dataValues?.case_question_id) return null;

    const agencyId = await agencyMainId(opts.agencyUuid);
    if (!agencyId) return null;

    const caseRow: any = await AgencyLeads.findByPk(ctx.caseId, { attributes: ["id", "user_id", "agent_uuid", "status"] });
    if (!caseRow || caseRow.dataValues.agent_uuid !== opts.agencyUuid) return null;

    const studentId = ctx.studentId || Number(caseRow.dataValues.user_id);
    const step: any = await ensureWhatsappInboxStep(ctx.caseId, agencyId, studentId, opts.agencyUuid);

    let buffer = opts.body;
    if (!buffer) {
        try {
            buffer = await readStoredFile("lead_files", opts.storage_name);
        } catch (error) {
            console.error("whatsappCaseMirror: could not read lead file", opts.storage_name, error);
            return null;
        }
    }

    const base = opts.original_name || opts.storage_name.split("/").pop() || "file";
    const ext = path.extname(base) || ".bin";
    const docName = `wa_case_${crypto.randomUUID().slice(0, 8)}${ext}`;
    const question_answer = await saveFile({
        owner: agencyOwner(opts.agencyUuid),
        folder: "student_docs",
        name: docName,
        body: buffer,
        contentType: opts.mime || undefined,
    });

    const label = (opts.original_name || "WhatsApp file").slice(0, 200);
    const question: any = await Question.create({
        step_id: step.dataValues.id,
        student_id: String(studentId),
        agent_id: String(agencyId),
        created_by_agent_id: String(agencyId),
        question_text: `WhatsApp: ${label}`,
        question_type: "document_provide",
        question_answer,
        status: "provided",
    });

    await CrmLeadFile.update(
        { case_id: ctx.caseId, case_question_id: question.dataValues.id },
        { where: { id: opts.leadFileId } },
    );

    return { caseId: ctx.caseId, stepId: step.dataValues.id, questionId: question.dataValues.id };
};

/** After convert (or for backfill), mirror any lead files not yet on the case. */
export const mirrorAllLeadFilesToCase = async (leadId: number) => {
    const rows: any[] = await CrmLeadFile.findAll({
        where: { lead_id: leadId, case_question_id: null },
        order: [["createdAt", "ASC"]],
    });
    for (const row of rows) {
        const d = row.dataValues;
        try {
            await mirrorLeadFileToConvertedCase({
                leadFileId: d.id,
                leadId,
                agencyUuid: d.agency_uuid,
                storage_name: d.storage_name,
                original_name: d.original_name,
                mime: d.mime,
            });
        } catch (error) {
            console.error("whatsappCaseMirror: mirror failed for lead file", d.id, error);
        }
    }
};