import express from 'express'
import ContactUsController from '../controller/ContactUsController'
import { validateAgent } from '../../middleware/authMiddleware'

const contactUsRoutes = express.Router()

contactUsRoutes.route("/add").post(ContactUsController.addContactUs)
contactUsRoutes.route("/list").get(validateAgent,ContactUsController.listContactUs)

export default contactUsRoutes