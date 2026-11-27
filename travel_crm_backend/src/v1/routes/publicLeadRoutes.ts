import express from "express"
import multer from "multer"
import PublicLeadController from "../controller/PublicLeadController"

/** Public lead webhooks (no login): /api/v1/public/leads/... */
const publicLeadRoutes = express.Router()

// accept JSON, url-encoded and multipart (text fields only) form posts
const formFields = multer({ limits: { fields: 60, fieldSize: 10 * 1024, files: 0 } }).none()

publicLeadRoutes.route("/website/:key").post(formFields, PublicLeadController.website)
publicLeadRoutes.route("/indiamart/:key").post(PublicLeadController.indiamart)
publicLeadRoutes.route("/google/:key").post(PublicLeadController.google)
publicLeadRoutes.route("/justdial/:key").get(PublicLeadController.justdial).post(formFields, PublicLeadController.justdial)
publicLeadRoutes.route("/sulekha/:key").get(PublicLeadController.sulekha).post(formFields, PublicLeadController.sulekha)

export default publicLeadRoutes
