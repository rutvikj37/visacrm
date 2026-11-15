import express from "express"
import LeadsController from "../controller/LeadsController"
import { validateAgent, validateUser } from "../../middleware/authMiddleware"
import leadProgressRoutes from "./leadProgressRoutes"
import leadCalendarRoutes from "./leadCalendarRoutes"

const leadsRoutes = express.Router()

// can add offline lean
leadsRoutes.route("/can_add_offline_lead").get(validateAgent,LeadsController.canAddOfflineLead)

leadsRoutes.route("/incoming_leads").get(validateAgent,LeadsController.getIncomingLeads)
leadsRoutes.route("/incoming_leads/students").get(validateAgent,LeadsController.getIncomingLeadsStudents)
leadsRoutes.route("/lead_details").post(validateAgent,LeadsController.getLeadDetails)
leadsRoutes.route("/provide_suggestions").post(validateAgent,LeadsController.provideSuggestions)

// user side 
leadsRoutes.route("/get_suggestions").get(validateUser,LeadsController.getSuggestions)
// select Option
leadsRoutes.route("/select_suggestion").post(validateUser,LeadsController.selectSuggestion)
// leads which are accepted by user
leadsRoutes.route("/user_accepted_leads").get(validateUser,LeadsController.getUserAcceptedLeads)

// get one lead 
leadsRoutes.route("/agency_lead_details/:id").get(validateAgent,LeadsController.agencyLeadDetails)

// assign lead to agent
leadsRoutes.route("/assign_lead").post(validateAgent,LeadsController.assignLead)

// change the status of lead 
leadsRoutes.route("/change_status").post(validateAgent,LeadsController.changeLeadStatus)

// get student profile 
leadsRoutes.route("/agent_profile/:id").get(validateUser,LeadsController.userViewAgentProfile)

// get student profile
leadsRoutes.route("/student_profile/:id").get(validateAgent,LeadsController.agentViewStudentProfile)

// check student exist or not 
leadsRoutes.route("/check_student_exist").post(validateAgent,LeadsController.checkStudentExist)

// offline lead add
leadsRoutes.route("/offline_lead_add").post(validateAgent,LeadsController.addOfflineInquiry)

// lead progress
leadsRoutes.use("/lead_progress",leadProgressRoutes)

// lead calendar 
leadsRoutes.use("/lead_calendar",leadCalendarRoutes)


export default leadsRoutes