import { getTravelTax, saveTravelTax } from "../../services/travel"
import express, { Request, Response } from "express"
import { buildOpenApi } from "../../services/apiDocs"
import SaasAdminController from "../controller/SaasAdminController"
import AnnouncementController from "../controller/AnnouncementController"
import { validateAdmin } from "../../middleware/authMiddleware"

/** Platform admin - plans, agencies, trials, payments: /api/v1/saas_admin/... */
const saasAdminRoutes = express.Router()

saasAdminRoutes.route("/features").get(validateAdmin, SaasAdminController.features)
saasAdminRoutes.route("/plans").get(validateAdmin, SaasAdminController.listPlans)
saasAdminRoutes.route("/plans").post(validateAdmin, SaasAdminController.createPlan)
saasAdminRoutes.route("/plans/:uuid/update").post(validateAdmin, SaasAdminController.updatePlan)
saasAdminRoutes.route("/plans/:uuid/delete").post(validateAdmin, SaasAdminController.deletePlan)

saasAdminRoutes.route("/agencies").get(validateAdmin, SaasAdminController.listAgencies)
saasAdminRoutes.route("/usage").get(validateAdmin, SaasAdminController.usage)
saasAdminRoutes.route("/monitoring").get(validateAdmin, SaasAdminController.monitoring)
// API reference generated from the live routes (admin login only)
saasAdminRoutes.route("/api_docs").get(validateAdmin, (_req: Request, res: Response) => {
    // required here, not at the top: index.ts imports this file
    const v1 = require("./index").default
    res.setHeader("Cache-Control", "private, no-store")
    return res.status(200).json({ success: true, message: "API docs", data: buildOpenApi(v1) })
})
saasAdminRoutes.route("/agencies").post(validateAdmin, SaasAdminController.createAgency)
saasAdminRoutes.route("/agencies/bulk").post(validateAdmin, SaasAdminController.bulkAgencies)
saasAdminRoutes.route("/agencies/:uuid").get(validateAdmin, SaasAdminController.agencyDetails)
saasAdminRoutes.route("/agencies/:uuid/update").post(validateAdmin, SaasAdminController.updateAgency)
saasAdminRoutes.route("/agencies/:uuid/delete").post(validateAdmin, SaasAdminController.deleteAgency)
saasAdminRoutes.route("/agencies/:uuid/trial").post(validateAdmin, SaasAdminController.giveTrial)
saasAdminRoutes.route("/agencies/:uuid/extend").post(validateAdmin, SaasAdminController.extend)
saasAdminRoutes.route("/agencies/:uuid/change_plan").post(validateAdmin, SaasAdminController.changePlan)
saasAdminRoutes.route("/agencies/:uuid/end_access").post(validateAdmin, SaasAdminController.endAccess)
saasAdminRoutes.route("/agencies/:uuid/status").post(validateAdmin, SaasAdminController.setAgencyStatus)
saasAdminRoutes.route("/agencies/:uuid/send_login").post(validateAdmin, SaasAdminController.sendLoginDetails)
saasAdminRoutes.route("/agencies/:uuid/reset_passcode").post(validateAdmin, SaasAdminController.resetPasscode)
saasAdminRoutes.route("/agencies/:uuid/portal").post(validateAdmin, SaasAdminController.updatePortal)
saasAdminRoutes.route("/agencies/:uuid/modules").post(validateAdmin, SaasAdminController.updateModules)
// Travel CRM tax rates (GST defaults, TCS on overseas packages) - kept as settings, never hard-coded
saasAdminRoutes.route("/travel_tax").get(validateAdmin, async (_req: Request, res: Response) => res.json({ success: true, message: "Travel tax", data: await getTravelTax() }))
saasAdminRoutes.route("/travel_tax").post(validateAdmin, async (req: Request, res: Response) => res.json({ success: true, message: "Tax settings saved", data: await saveTravelTax(req.body || {}) }))

saasAdminRoutes.route("/payments").get(validateAdmin, SaasAdminController.listPayments)
saasAdminRoutes.route("/payments/bulk").post(validateAdmin, SaasAdminController.bulkPayments)
saasAdminRoutes.route("/payments/:uuid/invoice").get(validateAdmin, SaasAdminController.invoice)
saasAdminRoutes.route("/payments/:uuid/remind").post(validateAdmin, SaasAdminController.remindFailed)
saasAdminRoutes.route("/payments/:uuid/resolve").post(validateAdmin, SaasAdminController.resolveFailed)

saasAdminRoutes.route("/billing_settings").get(validateAdmin, SaasAdminController.billingSettings)
saasAdminRoutes.route("/billing_settings").post(validateAdmin, SaasAdminController.saveBillingSettings)

saasAdminRoutes.route("/meta_settings").get(validateAdmin, SaasAdminController.metaSettings)
saasAdminRoutes.route("/meta_settings").post(validateAdmin, SaasAdminController.saveMetaSettings)

saasAdminRoutes.route("/coupons").get(validateAdmin, SaasAdminController.listCoupons)
saasAdminRoutes.route("/coupons").post(validateAdmin, SaasAdminController.saveCoupon)
saasAdminRoutes.route("/coupons/:uuid/update").post(validateAdmin, SaasAdminController.saveCoupon)
saasAdminRoutes.route("/coupons/:uuid/delete").post(validateAdmin, SaasAdminController.deleteCoupon)

saasAdminRoutes.route("/announcements").get(validateAdmin, AnnouncementController.list)
saasAdminRoutes.route("/announcements").post(validateAdmin, AnnouncementController.save)
saasAdminRoutes.route("/announcements/preview").post(validateAdmin, AnnouncementController.preview)
saasAdminRoutes.route("/announcements/:uuid/update").post(validateAdmin, AnnouncementController.save)
saasAdminRoutes.route("/announcements/:uuid/end").post(validateAdmin, AnnouncementController.end)
saasAdminRoutes.route("/announcements/:uuid/delete").post(validateAdmin, AnnouncementController.remove)

export default saasAdminRoutes
