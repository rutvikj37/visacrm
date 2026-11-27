import express from 'express'
import { requireAddon } from "../../services/saas"
import { validateAdmin, validateAgent, validateUser } from '../../middleware/authMiddleware'
import SideBannerController from '../controller/SideBannerController'
import { uploadImage } from '../../middleware/fileUpload'

const sideBannerRoutes = express.Router()

// get avalible slots
sideBannerRoutes.route("/get_avalible_slots").post(validateAgent,requireAddon("side_banner"), SideBannerController.availableSlot)
// assign slot
sideBannerRoutes.route("/assign_slots").post(validateAgent,requireAddon("side_banner"), uploadImage.single("image"), SideBannerController.assignSlot)

// list added campains 
sideBannerRoutes.route("/list/:find_for").get(validateAgent,requireAddon("side_banner"), SideBannerController.listCamp)

// details from campains 
sideBannerRoutes.route("/can_assign_slot").get(validateAgent,requireAddon("side_banner"), SideBannerController.canAssign)

// get response of active side banner event
sideBannerRoutes.route("/get_responses").post(validateAgent,requireAddon("side_banner"), SideBannerController.sideBannerResponsesGet)

// admin routes 
const adminRoutes = express.Router()

adminRoutes.route("/list").post(validateAdmin, SideBannerController.adminSideList)
adminRoutes.route("/action").post(validateAdmin, SideBannerController.adminAction)
// get response of active side banner event
adminRoutes.route("/get_responses").post(validateAdmin, SideBannerController.sideBannerResponsesGet)


sideBannerRoutes.use("/admin", adminRoutes)


// student 

const studentRoutes = express.Router()

studentRoutes.route("/achievement/:target_type/:agent_uuid").get(validateUser, SideBannerController.studentActiveAchievement)
studentRoutes.route("/add_interest").post(SideBannerController.sideBannerResponseAdd)

sideBannerRoutes.use("/student", studentRoutes)

export default sideBannerRoutes