import express from "express"
import MetaController from "../controller/MetaController"

/** Public Meta endpoints (no login): /api/v1/public/meta/... */
const publicMetaRoutes = express.Router()

publicMetaRoutes.route("/webhook").get(MetaController.webhookVerify)
publicMetaRoutes.route("/webhook").post(MetaController.webhookReceive)
publicMetaRoutes.route("/oauth/callback").get(MetaController.oauthCallback)
// an agency's own WhatsApp webhook link (for agencies using their own Meta app)
publicMetaRoutes.route("/whatsapp/:key").get(MetaController.whatsappWebhookVerify)
publicMetaRoutes.route("/whatsapp/:key").post(MetaController.whatsappWebhookReceive)

export default publicMetaRoutes
