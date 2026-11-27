// studentsListing
import express from 'express'
import { validateAdmin, validateGeneral, validateUser } from '../../middleware/authMiddleware'
import FeesController from '../controller/FeesController'
import ServiceStoreController from '../controller/ServiceStoreController'
import ServiceOrderController, { orderUpload } from '../controller/ServiceOrderController'
import StudentController from '../controller/StudentController'
import PortalChatController from '../controller/PortalChatController'
import ClientFormController from '../controller/ClientFormController'
import raiseApplicationRoutes from './raiseApplicationRoutes'
import multer from 'multer'
const studentRoutes = express.Router()

const formUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 20, fields: 100 },
}).any()

// student ↔ assigned counsellor in-app chat
studentRoutes.route("/chat").get(validateUser, PortalChatController.studentThread)
studentRoutes.route("/chat/unread").get(validateUser, PortalChatController.studentUnread)
studentRoutes.route("/chat/send").post(validateUser, PortalChatController.studentSend)

// custom forms assigned by the agency
studentRoutes.route("/forms").get(validateUser, ClientFormController.studentList)
studentRoutes.route("/forms/:assignmentId").get(validateUser, ClientFormController.studentDetails)
studentRoutes.route("/forms/:assignmentId/submit").post(validateUser, formUpload, ClientFormController.studentSubmit)

// admin
studentRoutes.route("/list").post(validateAdmin, StudentController.studentsListing)

// student: my fees / invoices
studentRoutes.route("/fees").get(validateUser, FeesController.studentInvoices)
// student: the agency's services store (buy + pay on the agency's Razorpay)
studentRoutes.route("/services").get(validateUser, ServiceStoreController.studentList)
studentRoutes.route("/services/verify").post(validateUser, ServiceStoreController.studentVerify)
studentRoutes.route("/services/:uuid/order").post(validateUser, ServiceStoreController.studentOrder)
studentRoutes.route("/service_orders").get(validateUser, ServiceOrderController.studentList)
studentRoutes.route("/service_orders/:uuid").get(validateUser, ServiceOrderController.studentDetails)
studentRoutes.route("/service_orders/:uuid/reply").post(validateUser, orderUpload, ServiceOrderController.studentReply)

// student add profile 
studentRoutes.route("/update_visa_profile").post(validateGeneral, StudentController.updateBasicDetails)

// student details profile
studentRoutes.route("/get_visa_profile").post(validateGeneral, StudentController.getBasicDetails)

// student profile completion progress
studentRoutes.route("/profile_completion_progress").post(validateGeneral, StudentController.getProfileCompletionProgress)


// student details profile for admin 
const adminStudentProfileRoutes = express.Router()

adminStudentProfileRoutes.route("/getProfile").post(validateAdmin, StudentController.getBasicDetailsAdmin)

studentRoutes.use("/admin", adminStudentProfileRoutes)


studentRoutes.use(raiseApplicationRoutes)

export default studentRoutes