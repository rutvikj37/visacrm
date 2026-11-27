import express from "express"
import { validateAgent } from "../../middleware/authMiddleware"
import LeadsController from "../controller/LeadsController"

const leadCalendarRoutes = express.Router()

// add event 
leadCalendarRoutes.route("/add_event").post(validateAgent,LeadsController.eventCreate)
leadCalendarRoutes.route("/event_list").post(validateAgent,LeadsController.eventListForCalendar)
leadCalendarRoutes.route("/event_list/:lead_id").get(validateAgent,LeadsController.eventListByInquiry)

export default leadCalendarRoutes