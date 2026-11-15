import { Request, Response } from "express";
import { privateFilePath } from "../../helpers/privateFiles";
import ExcelJS from "exceljs";
import * as asyncQueue from "async"; // Rename async to asyncQueue
import path from "path";
import fs from "fs";
import { Op } from "sequelize";
import GeneratedReport from "../../model/GeneratedReport";
import AgencyLeads from "../../model/AgencyLeads";
import User from "../../model/User";
import Step from "../../model/Step";
import Question from "../../model/Question";
import sequelize from "sequelize";
import LeadsCalendar from "../../model/LeadsCalendar";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { countries } from 'country-data'

class ReportController {// Process one report at a time
    async requestReport(req: RequestWithUser, res: Response) {
        const reportType = req.body.reportType || req.params.reportType;
        const agentId = req?.user?.user?.id;
        const agentUuid = req?.user?.user?.agent_uuid;

        if (!reportType || !agentId || !agentUuid) {
            return returnHelper(res, 400, false, "Missing required fields");
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const reportCount = await GeneratedReport.count({
            where: {
                agentId,
                reportType,
                createdAt: { [Op.between]: [startOfDay, endOfDay] },
            },
        });

        if (reportCount >= 3) {
            return returnHelper(res, 429, false, `Daily limit of 3 ${reportType} reports reached`);
        }

        const report = await GeneratedReport.create({
            reportType,
            agentId,
            filename: null,
        });

        // Call external queue function instead of this.reportQueue.push
        processReportQueue(report?.dataValues?.id, reportType, agentUuid, agentId);

        return returnHelper(res, 200, true, "Report generation queued", { reportId: report?.dataValues?.id });
    }

    async getReports(req: RequestWithUser, res: Response) {
        const agentId = req?.user?.user?.id;
        const reports = await GeneratedReport.findAll({
            where: { agentId },
            order: [["createdAt", "DESC"]],
        });
        return returnHelper(res, 200, true, "DATA", reports);
    }
}


// async function generateReport(reportId: number, reportType: string, agentUuid: string, agentId: number) {
//     console.log(`Starting generateReport for reportId: ${reportId}, type: ${reportType}`);

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet(`${reportType} Report`);
//     let data: any[] = [];

//     // Example data fetch (shortened for clarity, use your full switch block)
//     data = await getAgentActivityData(agentUuid, agentId);
//     worksheet.columns = [
//         { header: "Lead ID", key: "leadId" },
//         // ... (other columns)
//     ];

//     console.log(`Data fetched for reportId: ${reportId}, rows: ${data.length}`);
//     worksheet.addRows(data);
//     console.log(`Rows added to worksheet for reportId: ${reportId}`);

//     const filename = `${reportType}_${reportId}_${Date.now()}.xlsx`;
//     const filePath = path.join(process.cwd(), "public/reports", filename);

//     console.log(`Attempting to save file to: ${filePath}`);
//     fs.mkdirSync(path.dirname(filePath), { recursive: true });
//     console.log(`Directory ensured: ${path.dirname(filePath)}`);
//     await workbook.xlsx.writeFile(filePath);
//     console.log(`File written successfully: ${filePath}`);

//     if (fs.existsSync(filePath)) {
//         console.log(`File confirmed on disk: ${filePath}`);
//     } else {
//         console.error(`File not found after write: ${filePath}`);
//         throw new Error(`File not created: ${filePath}`);
//     }

//     await GeneratedReport.update({ filename }, { where: { id: reportId } });
//     console.log(`Updated GeneratedReport with filename: ${filename} for reportId: ${reportId}`);
// }

async function generateReport(reportId: number, reportType: string, agentUuid: string, agentId: number) {
    console.log(`Starting generateReport for reportId: ${reportId}, type: ${reportType}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${reportType} Report`);
    let data: any[] = [];

    switch (reportType) {
        case "agent_activity":
            data = await getAgentActivityData(agentUuid, agentId);
            worksheet.columns = [
                { header: "Lead ID", key: "leadId" },
                { header: "Lead Status", key: "leadStatus" },
                { header: "Lead Type", key: "leadType" },
                { header: "Selected Country", key: "selectedCountry" },
                { header: "Intake Year", key: "intakeYear" },
                { header: "Created At", key: "createdAt" },
                { header: "Student Name", key: "studentName" },
                { header: "Student Email", key: "studentEmail" },
                { header: "Student Phone", key: "studentPhone" },
                { header: "Step Title", key: "stepTitle" },
                { header: "Step Status", key: "stepStatus" },
                { header: "Question Count", key: "questionCount" },
                { header: "Pending Questions", key: "pendingQuestions" },
                { header: "Question Types", key: "questionTypes" },
            ];
            break;

        case "lead_conversion":
            data = await getLeadConversionData(agentUuid);
            worksheet.columns = [
                { header: "Lead Type", key: "leadType" },
                { header: "Selected Country", key: "selectedCountry" },
                { header: "Intake Year", key: "intakeYear" },
                { header: "Total Leads", key: "totalLeads" },
                { header: "Converted Leads", key: "convertedLeads" },
                { header: "Conversion Rate (%)", key: "conversionRate" },
                { header: "Average Days to Conversion", key: "avgDaysToConversion" },
                { header: "Student Count", key: "studentCount" },
            ];
            break;

        case "student_engagement":
            data = await getStudentEngagementData(agentUuid);
            worksheet.columns = [
                { header: "Student Name", key: "studentName" },
                { header: "Student Email", key: "studentEmail" },
                { header: "Student Phone", key: "studentPhone" },
                { header: "Lead ID", key: "leadId" },
                { header: "Lead Status", key: "leadStatus" },
                { header: "Last Follow-Up Date", key: "lastFollowUpDate" },
                { header: "Total Questions Asked", key: "totalQuestions" },
                { header: "Pending Questions", key: "pendingQuestions" },
                { header: "Step Completion Rate (%)", key: "stepCompletionRate" },
            ];
            break;

        case "step_completion":
            data = await getStepCompletionData(agentId);
            worksheet.columns = [
                { header: "Step Title", key: "stepTitle" },
                { header: "Total Instances", key: "totalInstances" },
                { header: "Completed Instances", key: "completedInstances" },
                { header: "Completion Rate (%)", key: "completionRate" },
                { header: "Average Question Count", key: "avgQuestionCount" },
                { header: "Pending Question Count", key: "pendingQuestions" },
                { header: "Average Time to Complete (days)", key: "avgTimeToComplete" },
            ];
            break;

        case "question_resolution":
            data = await getQuestionResolutionData(agentUuid, agentId);
            worksheet.columns = [
                { header: "Question ID", key: "questionId" },
                { header: "Question Type", key: "questionType" },
                { header: "Status", key: "status" },
                { header: "Step Title", key: "stepTitle" },
                { header: "Lead ID", key: "leadId" },
                { header: "Student Name", key: "studentName" },
                { header: "Created At", key: "createdAt" },
                { header: "Resolved At", key: "resolvedAt" },
                { header: "Resolution Time (days)", key: "resolutionTime" },
            ];
            break;

        case "lead_source":
            data = await getLeadSourceData(agentUuid);
            worksheet.columns = [
                { header: "Lead Type", key: "leadType" },
                { header: "Total Leads", key: "totalLeads" },
                { header: "Converted Leads", key: "convertedLeads" },
                { header: "Conversion Rate (%)", key: "conversionRate" },
                { header: "Average Questions per Lead", key: "avgQuestionsPerLead" },
                { header: "Average Steps Completed per Lead", key: "avgStepsCompleted" },
                { header: "Student Count", key: "studentCount" },
                { header: "Average Follow-Up Count", key: "avgFollowUpCount" },
            ];
            break;

        case "country_intake":
            data = await getCountryIntakeData(agentUuid);
            worksheet.columns = [
                { header: "Selected Country", key: "selectedCountry" },
                { header: "Intake Year", key: "intakeYear" },
                { header: "Total Leads", key: "totalLeads" },
                { header: "Converted Leads", key: "convertedLeads" },
                { header: "Conversion Rate (%)", key: "conversionRate" },
                { header: "Student Count", key: "studentCount" },
                { header: "Total Questions", key: "totalQuestions" },
                { header: "Pending Questions", key: "pendingQuestions" },
                { header: "Average Step Completion Rate (%)", key: "avgStepCompletionRate" },
            ];
            break;

        case "agent_performance":
            data = await getAgentPerformanceData(agentUuid, agentId);
            worksheet.columns = [
                { header: "Agent ID", key: "agentId" },
                { header: "Total Leads", key: "totalLeads" },
                { header: "Converted Leads", key: "convertedLeads" },
                { header: "Conversion Rate (%)", key: "conversionRate" },
                { header: "Total Students", key: "totalStudents" },
                { header: "Active Students", key: "activeStudents" },
                { header: "Total Steps", key: "totalSteps" },
                { header: "Completed Steps", key: "completedSteps" },
                { header: "Step Completion Rate (%)", key: "stepCompletionRate" },
                { header: "Total Questions", key: "totalQuestions" },
                { header: "Resolved Questions", key: "resolvedQuestions" },
                { header: "Resolution Rate (%)", key: "resolutionRate" },
                { header: "Average Time to Visa Completion (days)", key: "avgTimeToVisaCompletion" },
            ];
            break;

        default:
            console.error(`Unknown report type: ${reportType}`);
            throw new Error(`Unsupported report type: ${reportType}`);
    }

    console.log(`Data fetched for reportId: ${reportId}, rows: ${data.length}`);
    worksheet.addRows(data);
    console.log(`Rows added to worksheet for reportId: ${reportId}`);

    const filename = `${reportType}_${reportId}_${Date.now()}.xlsx`;
    const filePath = privateFilePath("reports", filename);

    console.log(`Attempting to save file to: ${filePath}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    console.log(`Directory ensured: ${path.dirname(filePath)}`);
    await workbook.xlsx.writeFile(filePath);
    console.log(`File written successfully: ${filePath}`);

    if (fs.existsSync(filePath)) {
        console.log(`File confirmed on disk: ${filePath}`);
    } else {
        console.error(`File not found after write: ${filePath}`);
        throw new Error(`File not created: ${filePath}`);
    }

    await GeneratedReport.update({ filename }, { where: { id: reportId } });
    console.log(`Updated GeneratedReport with filename: ${filename} for reportId: ${reportId}`);
}

const queue = asyncQueue.queue((task: { reportId: number; reportType: string; agentUuid: string; agentId: number }, callback) => {
    console.log(`Queue processing task for reportId: ${task.reportId}`);
    generateReport(task.reportId, task.reportType, task.agentUuid, task.agentId)
        .then(() => {
            console.log(`Task completed successfully for reportId: ${task.reportId}`);
            callback();
        })
        .catch((err) => {
            console.error(`Task failed for reportId: ${task.reportId}:`, err);
            callback(err);
        });
}, 1);

queue.drain(() => {
    console.log("Queue drained: All report generation tasks completed.");
});

function processReportQueue(reportId: number, reportType: string, agentUuid: string, agentId: number) {
    console.log(`Adding task to queue for reportId: ${reportId}, type: ${reportType}`);
    queue.push({ reportId, reportType, agentUuid, agentId });
}




// process functions
async function getAgentActivityData(agentUuid: string, agentId: number) {
    const leads = await AgencyLeads.findAll({
        where: { agent_uuid: agentUuid },
        attributes: ["id", "status", "lead_type", "selected_country", "selected_intake_year", "createdAt"],
        include: [{ model: User, as: "user_of", attributes: ["username", "email", "phone", "country_code", "phone_number"] }],
    });

    const steps = await Step.findAll({
        where: { agent_id: agentId },
        include: [{ model: Question, as: "questions", attributes: [] }],
        attributes: [
            "id",
            "step_title",
            "step_status",
            [sequelize.fn("COUNT", sequelize.col("questions.id")), "question_count"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN questions.status = 'pending' THEN 1 ELSE 0 END")), "pending_questions"],
            [sequelize.fn("GROUP_CONCAT", sequelize.col("questions.question_type")), "question_types"],
        ],
        group: ["Step.id", "Step.step_title", "Step.step_status"],
    });

    return leads.flatMap((lead) =>
        steps.map((step) => ({
            leadId: lead?.dataValues?.id,
            leadStatus: lead?.dataValues?.status,
            leadType: lead?.dataValues?.lead_type,
            selectedCountry: lead?.dataValues?.selected_country,
            intakeYear: lead?.dataValues?.selected_intake_year,
            createdAt: new Date(lead?.dataValues?.createdAt).toLocaleDateString(),
            studentName: lead?.dataValues?.user_of?.username || "Unknown",
            studentEmail: lead?.dataValues?.user_of?.email || "N/A",
            studentPhone: lead?.dataValues?.user_of?.phone || "N/A",
            stepTitle: step?.dataValues?.step_title,
            stepStatus: step?.dataValues?.step_status === 1 ? "Completed" : "Pending",
            questionCount: step.getDataValue("question_count") || 0,
            pendingQuestions: step.getDataValue("pending_questions") || 0,
            questionTypes: step.getDataValue("question_types") || "",
        }))
    );
}
async function getLeadConversionData(agentUuid: string) {
    const leads = await AgencyLeads.findAll({
        where: { agent_uuid: agentUuid },
        attributes: [
            "lead_type",
            "selected_country",
            "selected_intake_year",
            [sequelize.fn("COUNT", sequelize.col("id")), "total_leads"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
            [sequelize.fn("AVG", sequelize.literal("CASE WHEN status = 'visa_completed' THEN DATEDIFF(updatedAt, createdAt) END")), "avg_days_to_conversion"],
            [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("user_id"))), "student_count"],
        ],
        group: ["lead_type", "selected_country", "selected_intake_year"],
    });

    return leads.map((lead) => ({
        leadType: lead?.dataValues?.lead_type,
        selectedCountry: countries[lead?.dataValues?.selected_country]?.name || lead?.dataValues?.selected_country,
        intakeYear: lead?.dataValues?.selected_intake_year,
        totalLeads: lead.getDataValue("total_leads"),
        convertedLeads: lead.getDataValue("converted_leads"),
        conversionRate: ((lead.getDataValue("converted_leads") / lead.getDataValue("total_leads")) * 100).toFixed(2),
        avgDaysToConversion: lead.getDataValue("avg_days_to_conversion") ? Number(lead.getDataValue("avg_days_to_conversion")).toFixed(0) : 0,
        studentCount: lead.getDataValue("student_count"),
    }));
}

async function getStudentEngagementData(agentUuid: string) {
    console.log(`Fetching student engagement data for agentUuid: ${agentUuid}`);

    const leads = await AgencyLeads.findAll({
        where: { agent_uuid: agentUuid },
        attributes: ["id", "status", "updatedAt", "user_id", "last_follow_up_remark"],
        include: [
            { model: User, as: "user_of", attributes: ["username", "email", "phone", "country_code", "phone_number"] },
            { model: LeadsCalendar, as: "follow_ups", attributes: [["date", "last_follow_up_date"]], required: false }, // Optional include
        ],
    });

    const steps = await Step.findAll({
        where: { agent_id: agentUuid }, // Assuming agent_id is a string like agentUuid; adjust to agentId if integer
        attributes: [
            "id",
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN step_status = 1 THEN 1 ELSE 0 END")), "completed_steps"],
            [sequelize.fn("COUNT", sequelize.col("id")), "total_steps"],
        ],
        group: ["id"],
    });

    const questions = await Question.findAll({
        include: [
            { model: Step, as: "step", attributes: ["lead_id"] }, // Join with Step to get lead_id
        ],
        attributes: [
            [sequelize.col("step.lead_id"), "lead_id"], // Use Step's lead_id
            [sequelize.fn("COUNT", sequelize.col("Question.id")), "total_questions"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN Question.status = 'pending' THEN 1 ELSE 0 END")), "pending_questions"],
        ],
        group: ["step.lead_id"], // Group by Step's lead_id
    });

    return leads.map((lead) => {
        const totalSteps = steps.reduce((sum, s) => sum + s.getDataValue("total_steps"), 0);
        const completedSteps = steps.reduce((sum, s) => sum + s.getDataValue("completed_steps"), 0);
        const questionData: any = questions.find((q) => q.getDataValue("lead_id") === lead?.dataValues?.id) || { total_questions: 0, pending_questions: 0 };

        return {
            studentName: lead?.dataValues?.user_of?.username || "Unknown",
            studentEmail: lead?.dataValues?.user_of?.email || "N/A",
            studentPhone: lead?.dataValues?.user_of?.phone || "N/A",
            leadId: lead?.dataValues?.id,
            leadStatus: lead?.dataValues?.status,
            lastFollowUpDate: lead?.dataValues?.follow_ups?.length
                ? new Date(lead?.dataValues?.follow_ups[0].last_follow_up_date).toLocaleDateString()
                : lead?.dataValues?.last_follow_up_remark
                    ? lead?.dataValues?.last_follow_up_remark // Use remark as fallback if no follow-ups
                    : new Date(lead?.dataValues?.updatedAt).toLocaleDateString(),
            totalQuestions: questionData.total_questions || 0,
            pendingQuestions: questionData.pending_questions || 0,
            stepCompletionRate: totalSteps ? ((completedSteps / totalSteps) * 100).toFixed(2) : 0,
        };
    });
}

async function getStepCompletionData(agentId: number) {
    const steps = await Step.findAll({
        where: { agent_id: agentId },
        include: [{ model: Question, as: "questions", attributes: [] }],
        attributes: [
            "step_title",
            [sequelize.fn("COUNT", sequelize.col("Step.id")), "total_instances"], // Use Step.id to avoid ambiguity
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN Step.step_status = 1 THEN 1 ELSE 0 END")), "completed_instances"],
            [sequelize.fn("AVG", sequelize.literal("CASE WHEN Step.step_status = 1 THEN DATEDIFF(Step.updatedAt, Step.createdAt) END")), "avg_time_to_complete"],
            [sequelize.fn("AVG", sequelize.col("questions.id")), "avg_question_count"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN questions.status = 'pending' THEN 1 ELSE 0 END")), "pending_questions"],
        ],
        group: ["Step.step_title"], // Group only by step_title
    });

    return steps.map((step) => ({
        stepTitle: step?.dataValues?.step_title,
        totalInstances: step?.dataValues?.total_instances,
        completedInstances: step?.dataValues?.completed_instances,
        completionRate: ((step?.dataValues?.completed_instances / step?.dataValues?.total_instances) * 100).toFixed(2),
        avgQuestionCount: step?.dataValues?.avg_question_count || 0,
        pendingQuestions: step?.dataValues?.pending_questions || 0,
        avgTimeToComplete: step?.dataValues?.avg_time_to_complete ? Number(step?.dataValues?.avg_time_to_complete).toFixed(0) : 0,
    }));
}

// async function getQuestionResolutionData(agentUuid: string, agentId: number) {
//     console.log(`Fetching question resolution data for agentUuid: ${agentUuid}, agentId: ${agentId}`);

//     const questions = await Question.findAll({
//       include: [
//         {
//           model: Step,
//           as: "questions",
//           where: { agent_id: agentId },
//           attributes: ["step_title", "lead_id"],
//           include: [
//             {
//               model: AgencyLeads,
//               as: "lead",
//               where: { agent_uuid: agentUuid },
//               attributes: ["id"],
//               include: [
//                 { model: User, as: "user_of", attributes: ["username"] },
//               ],
//             },
//           ],
//         },
//       ],
//       attributes: ["id", "question_type", "status", "createdAt", "updatedAt"],
//     });

//     return questions.map((q) => {
//       const created = new Date(q?.dataValues?.createdAt);
//       const resolved = q?.dataValues?.status === "resolved" ? new Date(q?.dataValues?.updatedAt) : null;
//       const resolutionTime = resolved ? (resolved.getTime() - created.getTime()) / (1000 * 3600 * 24) : null;

//       return {
//         questionId: q?.dataValues?.id,
//         questionType: q?.dataValues?.question_type,
//         status: q?.dataValues?.status,
//         stepTitle: q?.dataValues?.questions?.step_title || "N/A",
//         leadId: q?.dataValues?.questions?.lead?.id || "N/A",
//         studentName: q?.dataValues?.questions?.lead?.user_of?.username || "Unknown",
//         createdAt: created.toLocaleDateString(),
//         resolvedAt: resolved ? resolved.toLocaleDateString() : "N/A",
//         resolutionTime: resolutionTime ? resolutionTime.toFixed(0) : "N/A",
//       };
//     });
//   }
async function getQuestionResolutionData(agentUuid: string, agentId: number) {
    console.log(`Fetching question resolution data for agentUuid: ${agentUuid}, agentId: ${agentId}`);

    const questions = await Question.findAll({
        include: [
            {
                model: Step,
                as: "step", // Correct alias from Question.belongsTo(Step, { as: "step" })
                where: { agent_id: agentId },
                attributes: ["step_title", "lead_id"],
                include: [
                    {
                        model: AgencyLeads,
                        as: "lead", // Step.belongsTo(AgencyLeads, { as: "lead" })
                        where: { agent_uuid: agentUuid },
                        attributes: ["id"],
                        include: [
                            { model: User, as: "user_of", attributes: ["username"] }, // AgencyLeads.belongsTo(User, { as: "user_of" })
                        ],
                    },
                ],
            },
        ],
        attributes: ["id", "question_type", "status", "createdAt", "updatedAt"],
    });

    return questions.map((q) => {
        const created = new Date(q?.dataValues?.createdAt);
        const resolved = q.dataValues?.status === "completed" ? new Date(q.dataValues?.updatedAt) : null; // Use "completed" from ENUM
        const resolutionTime = resolved ? (resolved.getTime() - created.getTime()) / (1000 * 3600 * 24) : null;

        return {
            questionId: q.dataValues?.id,
            questionType: q.dataValues?.question_type,
            status: q.dataValues?.status,
            stepTitle: q.dataValues?.step?.step_title || "N/A",
            leadId: q.dataValues?.step?.lead?.id || "N/A",
            studentName: q.dataValues?.step?.lead?.user_of?.username || "Unknown",
            createdAt: created.toLocaleDateString(),
            resolvedAt: resolved ? resolved.toLocaleDateString() : "N/A",
            resolutionTime: resolutionTime ? resolutionTime.toFixed(0) : "N/A",
        };
    });
}

// async function getLeadSourceData(agentUuid: string) {
//     const leads = await AgencyLeads.findAll({
//         where: { agent_uuid: agentUuid },
//         include: [
//             { model: Question, as: "questions", attributes: [] },
//             { model: Step, as: "steps", attributes: [] },
//             { model: LeadsCalendar, as: "follow_ups", attributes: [] },
//         ],
//         attributes: [
//             "lead_type",
//             [sequelize.fn("COUNT", sequelize.col("AgencyLeads.id")), "total_leads"],
//             [sequelize.fn("SUM", sequelize.literal("CASE WHEN AgencyLeads.status = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
//             [sequelize.fn("AVG", sequelize.col("questions.id")), "avg_questions_per_lead"],
//             [sequelize.fn("AVG", sequelize.literal("CASE WHEN steps.step_status = 1 THEN 1 ELSE 0 END")), "avg_steps_completed"],
//             [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("AgencyLeads.user_id"))), "student_count"],
//             [sequelize.fn("COUNT", sequelize.col("follow_ups.id")), "total_follow_ups"],
//         ],
//         group: ["AgencyLeads.lead_type"],
//     });

//     return leads.map((lead) => ({
//         leadType: lead?.dataValues?.lead_type,
//         totalLeads: lead.getDataValue("total_leads"),
//         convertedLeads: lead.getDataValue("converted_leads"),
//         conversionRate: ((lead.getDataValue("converted_leads") / lead.getDataValue("total_leads")) * 100).toFixed(2),
//         avgQuestionsPerLead: lead.getDataValue("avg_questions_per_lead") || 0,
//         avgStepsCompleted: lead.getDataValue("avg_steps_completed") || 0,
//         studentCount: lead.getDataValue("student_count"),
//         avgFollowUpCount: lead.getDataValue("total_follow_ups") / lead.getDataValue("total_leads") || 0,
//     }));
// }
async function getLeadSourceData(agentUuid: string) {
    const leads = await AgencyLeads.findAll({
        where: { agent_uuid: agentUuid },
        include: [
            {
                model: Step,
                as: "steps", // AgencyLeads.hasMany(Step, { as: "steps" })
                include: [
                    { model: Question, as: "questions", attributes: [] }, // Step.hasMany(Question, { as: "questions" })
                ],
                attributes: [],
            },
            { model: LeadsCalendar, as: "follow_ups", attributes: [] }, // AgencyLeads.hasMany(LeadsCalendar, { as: "follow_ups" })
            { model: User, as: "user_of", attributes: [] }, // AgencyLeads.belongsTo(User, { as: "user_of" })
        ],
        attributes: [
            "lead_type",
            [sequelize.fn("COUNT", sequelize.col("AgencyLeads.id")), "total_leads"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN AgencyLeads.status = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
            [sequelize.fn("COUNT", sequelize.col("steps->questions.id")), "total_questions"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN steps.step_status = 1 THEN 1 ELSE 0 END")), "completed_steps"],
            [sequelize.fn("COUNT", sequelize.col("steps.id")), "total_steps"],
            [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("AgencyLeads.user_id"))), "student_count"],
            [sequelize.fn("COUNT", sequelize.col("follow_ups.id")), "total_follow_ups"],
        ],
        group: ["AgencyLeads.lead_type"],
    });

    return leads.map((lead) => {
        const totalLeads = Number(lead.getDataValue("total_leads"));
        const totalSteps = Number(lead.getDataValue("total_steps"));
        return {
            leadType: lead?.dataValues?.lead_type,
            totalLeads,
            convertedLeads: Number(lead.getDataValue("converted_leads")),
            conversionRate: totalLeads ? ((lead.getDataValue("converted_leads") / totalLeads) * 100).toFixed(2) : 0,
            avgQuestionsPerLead: totalLeads ? (lead.getDataValue("total_questions") / totalLeads).toFixed(2) : 0,
            avgStepsCompleted: totalSteps ? (lead.getDataValue("completed_steps") / totalSteps).toFixed(2) : 0,
            studentCount: Number(lead.getDataValue("student_count")),
            avgFollowUpCount: totalLeads ? (lead.getDataValue("total_follow_ups") / totalLeads).toFixed(2) : 0,
        };
    });
}

// async function getCountryIntakeData(agentUuid: string) {
//     const leads = await AgencyLeads.findAll({
//         where: { agent_uuid: agentUuid },
//         include: [
//             { model: Question, as: "questions", attributes: [] },
//             { model: Step, as: "steps", attributes: [] },
//         ],
//         attributes: [
//             "selected_country",
//             "selected_intake_year",
//             [sequelize.fn("COUNT", sequelize.col("AgencyLeads.id")), "total_leads"],
//             [sequelize.fn("SUM", sequelize.literal("CASE WHEN AgencyLeads.status = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
//             [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("AgencyLeads.user_id"))), "student_count"],
//             [sequelize.fn("COUNT", sequelize.col("questions.id")), "total_questions"],
//             [sequelize.fn("SUM", sequelize.literal("CASE WHEN questions.status = 'pending' THEN 1 ELSE 0 END")), "pending_questions"],
//             [sequelize.fn("AVG", sequelize.literal("CASE WHEN steps.step_status = 1 THEN 1 ELSE 0 END")), "avg_step_completion_rate"],
//         ],
//         group: ["AgencyLeads.selected_country", "AgencyLeads.selected_intake_year"],
//     });

//     return leads.map((lead) => ({
//         selectedCountry: lead?.dataValues?.selected_country,
//         intakeYear: lead?.dataValues?.selected_intake_year,
//         totalLeads: lead.getDataValue("total_leads"),
//         convertedLeads: lead.getDataValue("converted_leads"),
//         conversionRate: ((lead.getDataValue("converted_leads") / lead.getDataValue("total_leads")) * 100).toFixed(2),
//         studentCount: lead.getDataValue("student_count"),
//         totalQuestions: lead.getDataValue("total_questions") || 0,
//         pendingQuestions: lead.getDataValue("pending_questions") || 0,
//         avgStepCompletionRate: lead.getDataValue("avg_step_completion_rate") ? (lead.getDataValue("avg_step_completion_rate") * 100).toFixed(2) : 0,
//     }));
// }
async function getCountryIntakeData(agentUuid: string) {
    console.log(`Fetching country intake data for agentUuid: ${agentUuid}`);

    // Step 1: Fetch AgencyLeads with basic aggregations
    const leads = await AgencyLeads.findAll({
        where: { agent_uuid: agentUuid },
        include: [
            {
                model: Step,
                as: "steps",
                attributes: [],
            },
            { model: User, as: "user_of", attributes: [] },
        ],
        attributes: [
            "selected_country",
            "selected_intake_year",
            [sequelize.fn("COUNT", sequelize.col("AgencyLeads.id")), "total_leads"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN `AgencyLeads`.`status` = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
            [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("AgencyLeads.user_id"))), "student_count"],
            [sequelize.fn("COUNT", sequelize.col("steps.id")), "total_steps"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN `steps`.`step_status` = 1 THEN 1 ELSE 0 END")), "completed_steps"],
        ],
        group: ["AgencyLeads.selected_country", "AgencyLeads.selected_intake_year"],
    });

    // Step 2: Fetch Questions with pending count grouped by country and intake year
    const questions = await Question.findAll({
        include: [
            {
                model: Step,
                as: "step",
                include: [
                    {
                        model: AgencyLeads,
                        as: "lead",
                        where: { agent_uuid: agentUuid },
                        attributes: ["selected_country", "selected_intake_year"],
                    },
                ],
                attributes: [],
            },
        ],
        attributes: [
            [sequelize.col("step->lead.selected_country"), "selected_country"],
            [sequelize.col("step->lead.selected_intake_year"), "selected_intake_year"],
            [sequelize.fn("COUNT", sequelize.col("Question.id")), "total_questions"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN `Question`.`status` = 'pending' THEN 1 ELSE 0 END")), "pending_questions"],
        ],
        group: ["step->lead.selected_country", "step->lead.selected_intake_year"],
    });

    // Step 3: Merge the results
    const leadMap = new Map<string, any>(
        leads.map((lead) => [
            `${lead?.dataValues?.selected_country || "N/A"}-${lead?.dataValues?.selected_intake_year || "N/A"}`,
            {
                selectedCountry: countries[lead?.dataValues?.selected_country]?.name || "N/A",
                intakeYear: lead?.dataValues?.selected_intake_year || "N/A",
                totalLeads: Number(lead.getDataValue("total_leads")),
                convertedLeads: Number(lead.getDataValue("converted_leads")),
                studentCount: Number(lead.getDataValue("student_count")),
                totalSteps: Number(lead.getDataValue("total_steps")),
                completedSteps: Number(lead.getDataValue("completed_steps")),
                totalQuestions: 0, // Default, to be updated
                pendingQuestions: 0, // Default, to be updated
            },
        ])
    );

    questions.forEach((question) => {
        const key = `${question.getDataValue("selected_country") || "N/A"}-${question.getDataValue("selected_intake_year") || "N/A"}`;
        if (leadMap.has(key)) {
            const leadData = leadMap.get(key);
            leadData.totalQuestions = Number(question.getDataValue("total_questions")) || 0;
            leadData.pendingQuestions = Number(question.getDataValue("pending_questions")) || 0;
        } else {
            leadMap.set(key, {
                selectedCountry: question.getDataValue("selected_country") || "N/A",
                intakeYear: question.getDataValue("selected_intake_year") || "N/A",
                totalLeads: 0,
                convertedLeads: 0,
                studentCount: 0,
                totalSteps: 0,
                completedSteps: 0,
                totalQuestions: Number(question.getDataValue("total_questions")) || 0,
                pendingQuestions: Number(question.getDataValue("pending_questions")) || 0,
            });
        }
    });

    return Array.from(leadMap.values()).map((data) => ({
        selectedCountry: data.selectedCountry,
        intakeYear: data.intakeYear,
        totalLeads: data.totalLeads,
        convertedLeads: data.convertedLeads,
        conversionRate: data.totalLeads ? ((data.convertedLeads / data.totalLeads) * 100).toFixed(2) : 0,
        studentCount: data.studentCount,
        totalQuestions: data.totalQuestions,
        pendingQuestions: data.pendingQuestions,
        avgStepCompletionRate: data.totalSteps ? ((data.completedSteps / data.totalSteps) * 100).toFixed(2) : 0,
    }));
}

// async function getAgentPerformanceData(agentUuid: string, agentId: number) {
//     const leads = await AgencyLeads.findAll({
//         where: { agent_uuid: agentUuid },
//         attributes: [
//             [sequelize.fn("COUNT", sequelize.col("id")), "total_leads"],
//             [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
//             [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("user_id"))), "total_students"],
//             [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.literal("CASE WHEN status IN ('pending', 'in_progress') THEN user_id END"))), "active_students"],
//             [sequelize.fn("AVG", sequelize.literal("CASE WHEN status = 'visa_completed' THEN DATEDIFF(updatedAt, createdAt) END")), "avg_time_to_visa_completion"],
//         ],
//     });

//     const steps = await Step.findAll({
//         where: { agent_id: agentId },
//         attributes: [
//             [sequelize.fn("COUNT", sequelize.col("id")), "total_steps"],
//             [sequelize.fn("SUM", sequelize.literal("CASE WHEN step_status = 1 THEN 1 ELSE 0 END")), "completed_steps"],
//         ],
//     });

//     const questions = await Question.findAll({
//         include: [{ model: Step, as: "step", where: { agent_id: agentId } }],
//         attributes: [
//             [sequelize.fn("COUNT", sequelize.col("id")), "total_questions"],
//             [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'resolved' THEN 1 ELSE 0 END")), "resolved_questions"],
//         ],
//     });

//     const leadData = leads[0];
//     const stepData = steps[0];
//     const questionData = questions[0];

//     return [{
//         agentId,
//         totalLeads: leadData.getDataValue("total_leads") || 0,
//         convertedLeads: leadData.getDataValue("converted_leads") || 0,
//         conversionRate: leadData.getDataValue("total_leads") ? ((leadData.getDataValue("converted_leads") / leadData.getDataValue("total_leads")) * 100).toFixed(2) : 0,
//         totalStudents: leadData.getDataValue("total_students") || 0,
//         activeStudents: leadData.getDataValue("active_students") || 0,
//         totalSteps: stepData.getDataValue("total_steps") || 0,
//         completedSteps: stepData.getDataValue("completed_steps") || 0,
//         stepCompletionRate: stepData.getDataValue("total_steps") ? ((stepData.getDataValue("completed_steps") / stepData.getDataValue("total_steps")) * 100).toFixed(2) : 0,
//         totalQuestions: questionData.getDataValue("total_questions") || 0,
//         resolvedQuestions: questionData.getDataValue("resolved_questions") || 0,
//         resolutionRate: questionData.getDataValue("total_questions") ? ((questionData.getDataValue("resolved_questions") / questionData.getDataValue("total_questions")) * 100).toFixed(2) : 0,
//         avgTimeToVisaCompletion: leadData.getDataValue("avg_time_to_visa_completion") ? Number(leadData.getDataValue("avg_time_to_visa_completion")).toFixed(0) : 0,
//     }];
// }
async function getAgentPerformanceData(agentUuid: string, agentId: number) {
    const leads = await AgencyLeads.findAll({
        where: { agent_uuid: agentUuid },
        attributes: [
            [sequelize.fn("COUNT", sequelize.col("id")), "total_leads"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'visa_completed' THEN 1 ELSE 0 END")), "converted_leads"],
            [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("user_id"))), "total_students"],
            [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.literal("CASE WHEN status IN ('pending', 'application_progress', 'visa_progress') THEN user_id END"))), "active_students"],
            [sequelize.fn("AVG", sequelize.literal("CASE WHEN status = 'visa_completed' THEN DATEDIFF(updatedAt, createdAt) END")), "avg_time_to_visa_completion"],
        ],
    });

    const steps = await Step.findAll({
        where: { agent_id: agentId },
        attributes: [
            [sequelize.fn("COUNT", sequelize.col("id")), "total_steps"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN step_status = 1 THEN 1 ELSE 0 END")), "completed_steps"],
        ],
    });

    const questions = await Question.findAll({
        where: { agent_id: agentId.toString() }, // Convert agentId to string to match Question.agent_id
        attributes: [
            [sequelize.fn("COUNT", sequelize.col("id")), "total_questions"],
            [sequelize.fn("SUM", sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), "resolved_questions"], // Use "completed" from ENUM
        ],
    });

    const leadData: any = leads[0] || {};
    const stepData: any = steps[0] || {};
    const questionData: any = questions[0] || {};

    return [{
        agentId,
        totalLeads: Number(leadData?.dataValues?.total_leads) || 0,
        convertedLeads: Number(leadData?.dataValues?.converted_leads) || 0,
        conversionRate: leadData?.dataValues?.total_leads ? ((leadData?.dataValues?.converted_leads / leadData?.dataValues?.total_leads) * 100).toFixed(2) : 0,
        totalStudents: Number(leadData?.dataValues?.total_students) || 0,
        activeStudents: Number(leadData?.dataValues?.active_students) || 0,
        totalSteps: Number(stepData?.dataValues?.total_steps) || 0,
        completedSteps: Number(stepData?.dataValues?.completed_steps) || 0,
        stepCompletionRate: stepData?.dataValues?.total_steps ? ((stepData?.dataValues?.completed_steps / stepData?.dataValues?.total_steps) * 100).toFixed(2) : 0,
        totalQuestions: Number(questionData?.dataValues?.total_questions) || 0,
        resolvedQuestions: Number(questionData?.dataValues?.resolved_questions) || 0,
        resolutionRate: questionData?.dataValues?.total_questions ? ((questionData?.dataValues?.resolved_questions / questionData?.dataValues?.total_questions) * 100).toFixed(2) : 0,
        avgTimeToVisaCompletion: leadData?.dataValues?.avg_time_to_visa_completion ? Number(leadData?.dataValues?.avg_time_to_visa_completion).toFixed(0) : 0,
    }];
}

export default new ReportController();