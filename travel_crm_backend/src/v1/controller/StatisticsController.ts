import { Response } from "express";
import { returnHelper } from "../../helpers/returnHelper";
import AgencyLeads from "../../model/AgencyLeads";
import { RequestWithUser } from "../../utils/types";
import sequelize from "sequelize";
import User from "../../model/User";
import RaisedApplications from "../../model/RaisedApplications";
import Step from "../../model/Step";
import Question from "../../model/Question";
import LeadsCalendar from "../../model/LeadsCalendar";
import { Op } from "sequelize";

class StatisticsController {
    // 1. Lead Overview Widgets
    async getTotalLeads(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const total = await AgencyLeads.count({ where: { agent_uuid: agentUuid } });
            return returnHelper(res, 200, true, "Find", { total });
        } catch (error) {
            console.log(error, "ERROR IN getTotalLeads");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getLeadStatusBreakdown(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const breakdown = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid ,status: ["pending","suggested","visa_progress","visa_completed","visa_rejected","withdrawn","withdrawn_by_student"]},
                attributes: ["status", [sequelize.fn("COUNT", sequelize.col("status")), "count"]],
                group: "status",
            });
            return returnHelper(res, 200, true, "find", breakdown);
        } catch (error) {
            console.log(error, "ERROR IN getLeadStatusBreakdown");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getLeadTypeDistribution(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const distribution = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                attributes: ["lead_type", [sequelize.fn("COUNT", sequelize.col("lead_type")), "count"]],
                group: "lead_type",
            });
            return returnHelper(res, 200, true, "find", distribution);
        } catch (error) {
            console.log(error, "ERROR IN getLeadTypeDistribution");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getLeadsByCountry(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const countries = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                attributes: ["selected_country", [sequelize.fn("COUNT", sequelize.col("selected_country")), "count"]],
                group: "selected_country",
                order: [["count", "DESC"]],
                limit: 5,
            });
            return returnHelper(res, 200, true, "find", countries);
        } catch (error) {
            console.log(error, "ERROR IN getLeadsByCountry");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getRecentLeads(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const leads = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                limit: 5,
                order: [["createdAt", "DESC"]],
                include: [{ model: User, as: "user_of" }],
            });
            return returnHelper(res, 200, true, "Find", leads);
        } catch (error) {
            console.log(error, "ERROR IN getRecentLeads");
            return returnHelper(res, 500, false, error.message);
        }
    }

    // 2. Application Progress Widgets
    async getTotalRaisedApplications(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const total = await AgencyLeads.count({
                where: { agent_uuid: agentUuid },
                include: [{ model: RaisedApplications, as: "application_of" }],
            });
            return returnHelper(res, 200, true, "FIND", { total });
        } catch (error) {
            console.log(error, "ERROR IN getTotalRaisedApplications");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getApplicationStatusBreakdown(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const breakdown = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                include: [{ model: RaisedApplications, as: "application_of" }],
                attributes: [[sequelize.col("application_of.status"), "status"], [sequelize.fn("COUNT", sequelize.col("application_of.status")), "count"]],
                group: "application_of.status",
            });
            return returnHelper(res, 200, true, "FIND", breakdown);
        } catch (error) {
            console.log(error, "ERROR IN getApplicationStatusBreakdown");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getTopUniversitiesApplied(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const universities = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                include: [{ model: RaisedApplications, as: "application_of" }],
                attributes: [[sequelize.col("application_of.university"), "university"], [sequelize.fn("COUNT", sequelize.col("application_of.university")), "count"]],
                group: "application_of.university",
                order: [["count", "DESC"]],
                limit: 5,
            });
            return returnHelper(res, 200, true, "FIND", universities);
        } catch (error) {
            console.log(error, "ERROR IN getTopUniversitiesApplied");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getIntakeYearDistribution(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const distribution = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                attributes: ["selected_intake_year", [sequelize.fn("COUNT", sequelize.col("selected_intake_year")), "count"]],
                group: "selected_intake_year",
            });
            return returnHelper(res, 200, true, "FIND", distribution);
        } catch (error) {
            console.log(error, "ERROR IN getIntakeYearDistribution");
            return returnHelper(res, 500, false, error.message);
        }
    }

    // 3. Steps and Questions Widgets
    async getStepsCompletionRate(req: RequestWithUser, res: Response) {
        try {
            const agentId = req?.user?.user?.id; // Assuming agent ID is also nested here
            const completed = await Step.count({ where: { agent_id: agentId, step_status: 1 } });
            const total = await Step.count({ where: { agent_id: agentId } });
            const rate = total > 0 ? (completed / total) * 100 : 0;
            return returnHelper(res, 200, true, "find", { rate });
        } catch (error) {
            console.log(error, "ERROR IN getStepsCompletionRate");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getPendingQuestions(req: RequestWithUser, res: Response) {
        try {
            const agentId = req?.user?.user?.id;
            const total = await Question.count({ where: { agent_id: agentId, status: "pending" } });
            return returnHelper(res, 200, true, "find", { total });
        } catch (error) {
            console.log(error, "ERROR IN getPendingQuestions");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getQuestionTypeBreakdown(req: RequestWithUser, res: Response) {
        try {
            const agentId = req?.user?.user?.id;
            const breakdown = await Question.findAll({
                where: { agent_id: agentId },
                attributes: ["question_type", [sequelize.fn("COUNT", sequelize.col("question_type")), "count"]],
                group: "question_type",
            });
            return returnHelper(res, 200, true, "find", breakdown);
        } catch (error) {
            console.log(error, "ERROR IN getQuestionTypeBreakdown");
            return returnHelper(res, 500, false, error.message);
        }
    }

    // 4. Student Engagement Widgets
    async getActiveStudents(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const total = await AgencyLeads.count({
                where: { agent_uuid: agentUuid },
                distinct: true,
                col: "user_id",
            });
            return returnHelper(res, 200, true, "find", { total });
        } catch (error) {
            console.log(error, "ERROR IN getActiveStudents");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getLastFollowUpActivity(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const activities = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid, last_follow_up_remark: { [Op.ne]: null } },
                limit: 5,
                order: [["updatedAt", "DESC"]],
                include: [{ model: User, as: "user_of" }],
                attributes: ["last_follow_up_remark", "updatedAt", "user_id"],
            });
            return returnHelper(res, 200, true, "find", activities);
        } catch (error) {
            console.log(error, "ERROR IN getLastFollowUpActivity");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getStudentsByLeadStatus(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const breakdown = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                attributes: ["status", [sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("user_id"))), "count"]],
                group: "status",
            });
            return returnHelper(res, 200, true, "find", breakdown);
        } catch (error) {
            console.log(error, "ERROR IN getStudentsByLeadStatus");
            return returnHelper(res, 500, false, error.message);
        }
    }

    // 5. Calendar and Time-Based Widgets
    async getUpcomingFollowUps(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const agentLeads = await AgencyLeads.findAll({ where: { agent_uuid: agentUuid }, attributes: ["user_id"] });
            const userIds = agentLeads.map((lead) => lead?.dataValues?.user_id);
            const followUps = await LeadsCalendar.findAll({
                where: { user_id: { [Op.in]: userIds } },
                attributes:["description","date","event_type"],
                order: [["date", "ASC"]],
                limit: 5,
                include: [{ model: User, as: "student",attributes:["username","email","phone_number","country_code","phone"] }],
            });
            return returnHelper(res, 200, true, "find", followUps);
        } catch (error) {
            console.log(error, "ERROR IN getUpcomingFollowUps");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getLeadsCreatedOverTime(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const leads = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid },
                attributes: [
                    [sequelize.fn("DATE_FORMAT", sequelize.col("createdAt"), "%Y-%m-01"), "month"], // Use DATE_FORMAT for MySQL/MariaDB
                    [sequelize.fn("COUNT", sequelize.col("id")), "count"],
                ],
                group: ["month"], // Group by formatted month
                order: [[sequelize.literal("month"), "ASC"]], // Order by month
            });
            return returnHelper(res, 200, true, "find", leads);
        } catch (error) {
            console.log(error, "ERROR IN getLeadsCreatedOverTime");
            return returnHelper(res, 500, false, error.message);
        }
    }

    // 6. Performance Metrics Widgets
    async getVisaSuccessRate(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const completed = await AgencyLeads.count({ where: { agent_uuid: agentUuid, status: "visa_completed" } });
            const total = await AgencyLeads.count({ where: { agent_uuid: agentUuid } });
            const rate = total > 0 ? (completed / total) * 100 : 0;
            return returnHelper(res, 200, true, "find", { rate });
        } catch (error) {
            console.log(error, "ERROR IN getVisaSuccessRate");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getAverageTimeToVisaCompletion(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const leads = await AgencyLeads.findAll({
                where: { agent_uuid: agentUuid, status: "visa_completed" },
                attributes: ["createdAt", "updatedAt"],
            });

            if (!leads || leads.length === 0) {
                return returnHelper(res, 200, true, "FIND", { avgDays: 0 });
            }

            const totalDays = leads.reduce((sum, lead) => {
                const created = new Date(lead?.dataValues?.createdAt);
                const updated = new Date(lead?.dataValues?.updatedAt);
                const diffTime = updated.getTime() - created.getTime();
                const diffDays = diffTime / (1000 * 3600 * 24);
                return sum + diffDays;
            }, 0);

            const avgDays = totalDays / leads.length;
            return returnHelper(res, 200, true, "FOUND", { avgDays });
        } catch (error) {
            console.log(error, "ERROR IN getAverageTimeToVisaCompletion");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getInProgressVisaLeads(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const inProgressVisaLeads = await AgencyLeads.count({
                where: { agent_uuid: agentUuid ,status: "visa_progress"},
                // include: [{ model: RaisedApplications, as: "application_of", where: { status: "accepted", suggestions: { [Op.gt]: 0 } } }],
            });
            // const totalSuggested = await AgencyLeads.count({
            //     where: { agent_uuid: agentUuid },
            //     // include: [{ model: RaisedApplications, as: "application_of", where: { suggestions: { [Op.gt]: 0 } } }],
            // });
            // const rate = totalSuggested > 0 ? (accepted / totalSuggested) * 100 : 0;
            return returnHelper(res, 200, true, "find", { inProgressVisaLeads });
        } catch (error) {
            console.log(error, "ERROR IN getInProgressVisaLeads");
            return returnHelper(res, 500, false, error.message);
        }
    }

    // 7. Miscellaneous Widgets
    async getWithdrawnLeads(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const total = await AgencyLeads.count({
                where: { agent_uuid: agentUuid, status: ["withdrawn", "withdrawn_by_student"] },
            });
            return returnHelper(res, 200, true, "find", { total });
        } catch (error) {
            console.log(error, "ERROR IN getWithdrawnLeads");
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getRejectedApplications(req: RequestWithUser, res: Response) {
        try {
            const agentUuid = req?.user?.user?.agent_uuid;
            const total = await AgencyLeads.count({
                where: { agent_uuid: agentUuid, status: "visa_rejected" },
                // include: [{ model: RaisedApplications, as: "application_of", where: { status: "rejected" } }],
            });
            return returnHelper(res, 200, true, "find", { total });
        } catch (error) {
            console.log(error, "ERROR IN getRejectedApplications");
            return returnHelper(res, 500, false, error.message);
        }
    }
}

export default new StatisticsController()