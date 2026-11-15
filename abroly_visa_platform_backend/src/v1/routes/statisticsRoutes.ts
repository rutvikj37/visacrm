import expres from 'express'
import { validateAgent } from '../../middleware/authMiddleware';
import StatisticsController from '../controller/StatisticsController';

const statisticsRoutes = expres.Router()

// 1. Lead Overview Widgets
statisticsRoutes.route("/total_leads").get(validateAgent, StatisticsController.getTotalLeads);
statisticsRoutes.route("/lead_status_breakdown").get(validateAgent, StatisticsController.getLeadStatusBreakdown);
statisticsRoutes.route("/lead_type_distribution").get(validateAgent, StatisticsController.getLeadTypeDistribution);
statisticsRoutes.route("/leads_by_country").get(validateAgent, StatisticsController.getLeadsByCountry);
statisticsRoutes.route("/recent_leads").get(validateAgent, StatisticsController.getRecentLeads);

// 2. Application Progress Widgets
statisticsRoutes.route("/total_raised_applications").get(validateAgent, StatisticsController.getTotalRaisedApplications);
statisticsRoutes.route("/application_status_breakdown").get(validateAgent, StatisticsController.getApplicationStatusBreakdown);
statisticsRoutes.route("/top_universities_applied").get(validateAgent, StatisticsController.getTopUniversitiesApplied);
statisticsRoutes.route("/intake_year_distribution").get(validateAgent, StatisticsController.getIntakeYearDistribution);

// 3. Steps and Questions Widgets
statisticsRoutes.route("/steps_completion_rate").get(validateAgent, StatisticsController.getStepsCompletionRate);
statisticsRoutes.route("/pending_questions").get(validateAgent, StatisticsController.getPendingQuestions);
statisticsRoutes.route("/question_type_breakdown").get(validateAgent, StatisticsController.getQuestionTypeBreakdown);
// 4. Student Engagement Widgets
statisticsRoutes.route("/active_students").get(validateAgent, StatisticsController.getActiveStudents);
statisticsRoutes.route("/last_follow_up_activity").get(validateAgent, StatisticsController.getLastFollowUpActivity);
statisticsRoutes.route("/students_by_lead_status").get(validateAgent, StatisticsController.getStudentsByLeadStatus);

// 5. Calendar and Time-Based Widgets
statisticsRoutes.route("/upcoming_follow_ups").get(validateAgent, StatisticsController.getUpcomingFollowUps);
statisticsRoutes.route("/leads_created_over_time").get(validateAgent, StatisticsController.getLeadsCreatedOverTime);

// 6. Performance Metrics Widgets
statisticsRoutes.route("/visa_success_rate").get(validateAgent, StatisticsController.getVisaSuccessRate);
statisticsRoutes.route("/average_time_to_visa_completion").get(validateAgent, StatisticsController.getAverageTimeToVisaCompletion);
statisticsRoutes.route("/visa_in_progress_leads").get(validateAgent, StatisticsController.getInProgressVisaLeads);

// 7. Miscellaneous Widgets
statisticsRoutes.route("/withdrawn_leads").get(validateAgent, StatisticsController.getWithdrawnLeads);
statisticsRoutes.route("/rejected_applications").get(validateAgent, StatisticsController.getRejectedApplications);

export default statisticsRoutes