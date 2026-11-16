import ServiceOrderController, { orderUpload } from "../controller/ServiceOrderController"
import ServiceStoreController from "../controller/ServiceStoreController"
import ActivityLogController from "../controller/ActivityLogController"
import ConversationController from "../controller/ConversationController"
import PortalChatController from "../controller/PortalChatController"
import TaskController from "../controller/TaskController"
import OnboardingController from "../controller/OnboardingController"
import TodayController from "../controller/TodayController"
import AnnouncementController from "../controller/AnnouncementController"
import express, { NextFunction, Request, Response } from "express"
import CrmController from "../controller/CrmController"
import LeadIntegrationController from "../controller/LeadIntegrationController"
import VisaTemplateController from "../controller/VisaTemplateController"
import MetaController from "../controller/MetaController"
import SubscriptionSaasController from "../controller/SubscriptionSaasController"
import NotificationController from "../controller/NotificationController"
import ReportsCrmController from "../controller/ReportsCrmController"
import CaseController from "../controller/CaseController"
import CalendarCrmController from "../controller/CalendarCrmController"
import TeamController from "../controller/TeamController"
import BrandingController from "../controller/BrandingController"
import FeesController from "../controller/FeesController"
import MessagingController from "../controller/MessagingController"
import multer from "multer"
import { validateAgent } from "../../middleware/authMiddleware"
import { uploadLeadFile } from "../../middleware/fileUpload"
import { returnHelper } from "../../helpers/returnHelper"

/** Lead CRM for agencies: /api/v1/crm/... */
const crmRoutes = express.Router()

// file upload errors (wrong type / too big) come back as a normal message
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
    uploadLeadFile.single("file")(req, res, (err: any) => {
        if (err) return returnHelper(res, 200, false, err.message || "Upload failed")
        next()
    })
}

// leads - fixed paths first, then /:uuid
crmRoutes.route("/leads").get(validateAgent, CrmController.listLeads)
crmRoutes.route("/leads").post(validateAgent, CrmController.createLead)
crmRoutes.route("/onboarding").get(validateAgent, OnboardingController.status)
crmRoutes.route("/onboarding/hide").post(validateAgent, OnboardingController.hide)
crmRoutes.route("/sample_data").post(validateAgent, OnboardingController.sampleData)
crmRoutes.route("/monthly_summary").get(validateAgent, OnboardingController.monthlySummary).post(validateAgent, OnboardingController.monthlySummaryAction)
crmRoutes.route("/conversations").get(validateAgent, ConversationController.list)
crmRoutes.route("/conversations/unread").get(validateAgent, ConversationController.unread)
crmRoutes.route("/conversations/:uuid").get(validateAgent, ConversationController.thread)
// In-app student ↔ counsellor chat (WhatsApp/Instagram inbox kept above but unused in UI for now)
crmRoutes.route("/portal_chats").get(validateAgent, PortalChatController.agentList)
crmRoutes.route("/portal_chats/unread").get(validateAgent, PortalChatController.agentUnread)
crmRoutes.route("/portal_chats/:studentId").get(validateAgent, PortalChatController.agentThread)
crmRoutes.route("/portal_chats/:studentId/send").post(validateAgent, PortalChatController.agentSend)

// Internal team tasks (Kanban)
crmRoutes.route("/tasks").get(validateAgent, TaskController.list).post(validateAgent, TaskController.create)
crmRoutes.route("/tasks/counts").get(validateAgent, TaskController.counts)
crmRoutes.route("/tasks/:id").get(validateAgent, TaskController.details)
crmRoutes.route("/tasks/:id/update").post(validateAgent, TaskController.update)
crmRoutes.route("/tasks/:id/status").post(validateAgent, TaskController.setStatus)
crmRoutes.route("/tasks/:id/delete").post(validateAgent, TaskController.remove)
crmRoutes.route("/services").get(validateAgent, ServiceStoreController.list).post(validateAgent, ServiceStoreController.save)
crmRoutes.route("/service_orders").get(validateAgent, ServiceOrderController.list)
crmRoutes.route("/service_orders/:uuid").get(validateAgent, ServiceOrderController.details)
crmRoutes.route("/service_orders/:uuid/update").post(validateAgent, orderUpload, ServiceOrderController.staffUpdate)
crmRoutes.route("/service_orders/:uuid/assign").post(validateAgent, ServiceOrderController.assign)
crmRoutes.route("/services/orders").get(validateAgent, ServiceStoreController.orders)
crmRoutes.route("/services/:uuid/delete").post(validateAgent, ServiceStoreController.remove)
crmRoutes.route("/payment_settings").get(validateAgent, ServiceStoreController.paymentSettings).post(validateAgent, ServiceStoreController.savePaymentSettings)
crmRoutes.route("/today").get(validateAgent, TodayController.today)
crmRoutes.route("/search").get(validateAgent, TodayController.search)
crmRoutes.route("/leads/summary").get(validateAgent, CrmController.summary)
crmRoutes.route("/leads/bulk").post(validateAgent, CrmController.bulkAction)
crmRoutes.route("/leads/restore").post(validateAgent, CrmController.restoreLeads)
crmRoutes.route("/leads/check_duplicate").post(validateAgent, CrmController.checkDuplicate)
crmRoutes.route("/leads/import").post(validateAgent, handleUpload, CrmController.importLeads)
crmRoutes.route("/leads/import/template").get(validateAgent, CrmController.importTemplate)
crmRoutes.route("/leads/:uuid").get(validateAgent, CrmController.leadDetails)
crmRoutes.route("/leads/:uuid/update").post(validateAgent, CrmController.updateLead)
crmRoutes.route("/leads/:uuid/status").post(validateAgent, CrmController.changeStatus)
crmRoutes.route("/leads/:uuid/assign").post(validateAgent, CrmController.assignLead)
crmRoutes.route("/leads/:uuid/branch").post(validateAgent, CrmController.transferLead)
crmRoutes.route("/leads/:uuid/activity").post(validateAgent, CrmController.addActivity)
crmRoutes.route("/leads/:uuid/follow_up").post(validateAgent, CrmController.setFollowUp)
crmRoutes.route("/leads/:uuid/delete").post(validateAgent, CrmController.deleteLead)
crmRoutes.route("/leads/:uuid/convert").post(validateAgent, CrmController.convertLead)
crmRoutes.route("/leads/:uuid/invite").get(validateAgent, CrmController.portalInvite)
crmRoutes.route("/leads/:uuid/invite/email").post(validateAgent, CrmController.sendPortalInvite)
crmRoutes.route("/leads/:uuid/whatsapp").post(validateAgent, MetaController.sendWhatsapp)
crmRoutes.route("/leads/:uuid/instagram").post(validateAgent, MetaController.sendInstagram)

// Meta: Facebook / Instagram Lead Ads + WhatsApp
crmRoutes.route("/meta/status").get(validateAgent, MetaController.status)
crmRoutes.route("/meta/facebook/connect_url").post(validateAgent, MetaController.facebookConnectUrl)
crmRoutes.route("/meta/facebook/page").post(validateAgent, MetaController.saveFacebookPage)
crmRoutes.route("/meta/whatsapp").post(validateAgent, MetaController.saveWhatsapp)

// visa process templates (built-in library + agency's own)
crmRoutes.route("/visa_templates").get(validateAgent, VisaTemplateController.list)
crmRoutes.route("/visa_templates").post(validateAgent, VisaTemplateController.create)
crmRoutes.route("/visa_templates/:id").get(validateAgent, VisaTemplateController.details)
crmRoutes.route("/visa_templates/:id/update").post(validateAgent, VisaTemplateController.update)
crmRoutes.route("/visa_templates/:id/delete").post(validateAgent, VisaTemplateController.remove)

// team & settings
crmRoutes.route("/team").get(validateAgent, CrmController.team)
crmRoutes.route("/settings").get(validateAgent, CrmController.getSettings)
crmRoutes.route("/settings").post(validateAgent, CrmController.updateSettings)

// lead sources
crmRoutes.route("/integrations").get(validateAgent, LeadIntegrationController.list)
crmRoutes.route("/integrations/website").post(validateAgent, LeadIntegrationController.createWebsite)
crmRoutes.route("/integrations/indiamart").post(validateAgent, LeadIntegrationController.saveIndiamart)
crmRoutes.route("/integrations/push").post(validateAgent, LeadIntegrationController.createPush)
crmRoutes.route("/integrations/:uuid/branch").post(validateAgent, TeamController.setSourceBranch)
crmRoutes.route("/integrations/:uuid/sync").post(validateAgent, LeadIntegrationController.syncNow)
crmRoutes.route("/integrations/:uuid/toggle").post(validateAgent, LeadIntegrationController.toggle)
crmRoutes.route("/integrations/:uuid/regenerate_key").post(validateAgent, LeadIntegrationController.regenerateKey)
crmRoutes.route("/integrations/:uuid/delete").post(validateAgent, LeadIntegrationController.remove)

// my subscription (stays reachable for the owner after it ends, so they can renew)
crmRoutes.route("/subscription").get(validateAgent, SubscriptionSaasController.mine)
crmRoutes.route("/subscription/razorpay/order").post(validateAgent, SubscriptionSaasController.createOrder)
crmRoutes.route("/announcements").get(validateAgent, AnnouncementController.mine)
crmRoutes.route("/announcements/:uuid/dismiss").post(validateAgent, AnnouncementController.dismiss)
crmRoutes.route("/subscription/quote").post(validateAgent, SubscriptionSaasController.quote)
crmRoutes.route("/subscription/razorpay/failed").post(validateAgent, SubscriptionSaasController.paymentFailed)
crmRoutes.route("/subscription/billing").get(validateAgent, SubscriptionSaasController.billingDetails)
crmRoutes.route("/subscription/billing").post(validateAgent, SubscriptionSaasController.saveBillingDetails)
crmRoutes.route("/subscription/invoices/:uuid").get(validateAgent, SubscriptionSaasController.invoice)
crmRoutes.route("/subscription/razorpay/verify").post(validateAgent, SubscriptionSaasController.verifyPayment)

// notifications (bell)
crmRoutes.route("/notifications").get(validateAgent, NotificationController.list)
crmRoutes.route("/notifications/unread_count").get(validateAgent, NotificationController.unreadCount)
crmRoutes.route("/notifications/read").post(validateAgent, NotificationController.markRead)
crmRoutes.route("/notifications/settings").get(validateAgent, NotificationController.getSettings)
crmRoutes.route("/notifications/settings").post(validateAgent, NotificationController.updateSettings)

// reports (owner / branch manager; pipeline also for counsellors on their own leads)
crmRoutes.route("/reports/overview").get(validateAgent, ReportsCrmController.overview)
crmRoutes.route("/reports/branches").get(validateAgent, ReportsCrmController.branches)
crmRoutes.route("/reports/pipeline").get(validateAgent, ReportsCrmController.pipeline)
crmRoutes.route("/reports/spend").get(validateAgent, ReportsCrmController.getSpend)
crmRoutes.route("/reports/spend").post(validateAgent, ReportsCrmController.saveSpend)

// visa cases: board, stage, outcome, assignment, step due dates, more applications
crmRoutes.route("/cases").get(validateAgent, CaseController.board)
crmRoutes.route("/cases/steps/:stepId/due").post(validateAgent, CaseController.setStepDue)
crmRoutes.route("/cases/:id").get(validateAgent, CaseController.details)
crmRoutes.route("/cases/:id/history").get(validateAgent, CaseController.history)
crmRoutes.route("/activity_log").get(validateAgent, ActivityLogController.list)
crmRoutes.route("/cases/:id/stage").post(validateAgent, CaseController.setStage)
crmRoutes.route("/cases/:id/outcome").post(validateAgent, CaseController.setOutcome)
crmRoutes.route("/cases/:id/assign").post(validateAgent, CaseController.assign)
crmRoutes.route("/cases/:id/branch").post(validateAgent, CaseController.transfer)
crmRoutes.route("/cases/:id/add_application").post(validateAgent, CaseController.addApplication)

// one calendar: follow-ups, case due dates, fees, tasks, events
crmRoutes.route("/calendar").get(validateAgent, CalendarCrmController.events)
crmRoutes.route("/calendar/events").post(validateAgent, CalendarCrmController.createEvent)

// branches and team roles
crmRoutes.route("/branches").get(validateAgent, TeamController.branches)
crmRoutes.route("/branches").post(validateAgent, TeamController.saveBranch)
crmRoutes.route("/branches/:id/delete").post(validateAgent, TeamController.deleteBranch)
crmRoutes.route("/team/members").get(validateAgent, TeamController.members)
crmRoutes.route("/team/:uuid/role").post(validateAgent, TeamController.setRole)

// agency branding (student portal look)
const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } }).single("logo")
const handleLogo = (req: Request, res: Response, next: NextFunction) => {
    logoUpload(req, res, (err: any) => {
        if (err) return returnHelper(res, 200, false, "Logo upload failed - please use an image under 2 MB")
        next()
    })
}
crmRoutes.route("/branding").get(validateAgent, BrandingController.get)
crmRoutes.route("/branding").post(validateAgent, handleLogo, BrandingController.save)

// client fees: invoices, payments, dues, payment links
crmRoutes.route("/fees/settings").get(validateAgent, FeesController.getSettings)
crmRoutes.route("/fees/settings").post(validateAgent, FeesController.saveSettings)
crmRoutes.route("/fees/students").get(validateAgent, FeesController.students)
crmRoutes.route("/fees/invoices").get(validateAgent, FeesController.list)
crmRoutes.route("/fees/invoices").post(validateAgent, FeesController.create)
crmRoutes.route("/fees/invoices/:uuid").get(validateAgent, FeesController.details)
crmRoutes.route("/fees/invoices/:uuid/payments").post(validateAgent, FeesController.addPayment)
crmRoutes.route("/fees/invoices/:uuid/cancel").post(validateAgent, FeesController.cancel)
crmRoutes.route("/fees/invoices/:uuid/payment_link").post(validateAgent, FeesController.createLink)
crmRoutes.route("/fees/invoices/:uuid/check_link").post(validateAgent, FeesController.checkLink)

// messages to leads and students: templates, automations, broadcasts
crmRoutes.route("/messages/templates").get(validateAgent, MessagingController.list)
crmRoutes.route("/messages/templates").post(validateAgent, MessagingController.save)
crmRoutes.route("/messages/templates/:id/delete").post(validateAgent, MessagingController.remove)
crmRoutes.route("/messages/audience").post(validateAgent, MessagingController.audience)
crmRoutes.route("/messages/broadcast").post(validateAgent, MessagingController.broadcast)
crmRoutes.route("/messages/preview").post(validateAgent, MessagingController.preview)

export default crmRoutes
