import express from "express"
import userRoutes from "./userRoutes"
import visaTypeRoutes from "./visaTypeRoutes"

import staticRoutes from "./staticRoutes"
import contactUsRoutes from "./contactUsRoutes"
import faqRoutes from "./faqRoutes"
import testimonialsRoutes from "./testimonialsRoutes"
import contentWritingRoutes from "./contentWritingRoutes"
import simCardsRoutes from "./simCardsRoutes"
import contentWritinResponseRoutes from "./contentWritinResponseRoutes"
import languagePrepRoutes from "./languagePrepRoutes"
import healthInsurRoutes from "./healthInsurRoutes"
import quizRoutes from "./quizRoutes"
import agentRoutes from "./agentRoutes"
import studentRoutes from "./studentRoutes"
import jobPostRoutes from "./jobPostRoutes"
import subscriptionRoutes from "./subscriptionRoutes"
import packageRoutes from "./packageRoutes"
import subAgentRoutes from "./subAgentRoutes"
import calendarRoutes from "./calendarRoutes"
import serviceInfoRoutes from "./serviceInfoRoutes"
import agentProfileRoutes from "./agentProfileRoutes"
import sideBannerRoutes from "./sideBannerRoutes"
import eventBannerRoutes from "./eventBannerRoutes"
import accommodationsRoutes from "./accommodationsRoutes"
import leadsRoutes from "./leadsRoutes"
import coinRoutes from "./coinRoutes"
import offlineLanugagePreparationRoutes from "./offlineLanugagePreparationRoutes"
import agentAdminTransectionsRoutes from "./agentAdminTransectionsRoutes"
import statisticsRoutes from "./statisticsRoutes"
import reportRoutes from "./reportRoutes"
import serviceFormRequestRoutes from "./serviceFormRequestRoutes"
import layoutRoutes from "./layoutRoutes"
import crmRoutes from "./crmRoutes"
import publicLeadRoutes from "./publicLeadRoutes"
import publicMetaRoutes from "./publicMetaRoutes"
import saasAdminRoutes from "./saasAdminRoutes"
import SubscriptionSaasController from "../controller/SubscriptionSaasController"
import CalendarCrmController from "../controller/CalendarCrmController"



const v1_routes = express.Router()

v1_routes.use("/user", userRoutes)
v1_routes.use("/visa_type", visaTypeRoutes)
v1_routes.use("/static", staticRoutes)
v1_routes.use("/contact_us", contactUsRoutes)
v1_routes.use("/faq", faqRoutes)
v1_routes.use("/testimonials", testimonialsRoutes)
v1_routes.use("/content_writing", contentWritingRoutes)
v1_routes.use("/sim", simCardsRoutes)
v1_routes.use("/health_in", healthInsurRoutes)
v1_routes.use("/content_writing_response", contentWritinResponseRoutes)
v1_routes.use("/language_prep", languagePrepRoutes)
v1_routes.use("/offline-language-prep", offlineLanugagePreparationRoutes)
v1_routes.use("/quiz", quizRoutes)

// subscription & packages
v1_routes.use("/subscription", subscriptionRoutes)
v1_routes.use("/packages", packageRoutes)


// side banner
v1_routes.use("/side_banner", sideBannerRoutes)


// agent
v1_routes.use("/agent", agentRoutes)
v1_routes.use("/agent_profile", agentProfileRoutes)
v1_routes.use("/job_post", jobPostRoutes)

// sub agent
v1_routes.use("/sub_agent", subAgentRoutes)

// student
v1_routes.use("/student", studentRoutes)

// calendar
v1_routes.use("/calendar", calendarRoutes)

// service information pages
v1_routes.use("/service_info",serviceInfoRoutes)

v1_routes.use('/event-banners', eventBannerRoutes)

// accommodations
v1_routes.use("/accommodation", accommodationsRoutes)

// leads for agennt
v1_routes.use("/leads", leadsRoutes)

// coins route
v1_routes.use("/coins", coinRoutes)

// agent admin transections
v1_routes.use("/agent_admin_transections", agentAdminTransectionsRoutes)

// agent statistics
v1_routes.use("/statistics", statisticsRoutes)

// reports 
v1_routes.use("/reports", reportRoutes)

// Service MVP
v1_routes.use("/service_form_requests", serviceFormRequestRoutes)

// layout
v1_routes.use("/layout", layoutRoutes)

// lead CRM (SaaS)
v1_routes.use("/crm", crmRoutes)
v1_routes.use("/public/leads", publicLeadRoutes)
v1_routes.use("/public/meta", publicMetaRoutes)

// SaaS billing
v1_routes.use("/saas_admin", saasAdminRoutes)
v1_routes.get("/public/saas/plans", SubscriptionSaasController.publicPlans)
v1_routes.post("/public/razorpay/webhook", SubscriptionSaasController.webhook)

// calendar feed for Google / Apple / Outlook
v1_routes.get("/public/calendar/:token", CalendarCrmController.feed)
export default v1_routes