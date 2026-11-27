import express from 'express'
import { validateAdmin, validateAgent } from '../../middleware/authMiddleware'
import AgentProfileController from '../controller/AgentProfileController'

const agentProfileRoutes = express.Router()


// ----------- basic profile related routes ------------
// update basic profile related routes
agentProfileRoutes.route("/update_basic_profile").post(validateAgent, AgentProfileController.updateAgentDetails)

// branch office related routes
agentProfileRoutes.route("/get_branch_office_address").post(validateAgent, AgentProfileController.getBranchOfficeAddress)
agentProfileRoutes.route("/update_branch_office_address").post(validateAgent, AgentProfileController.updateBranchOfficeAddress)

// basic address
agentProfileRoutes.route("/get_address").post(validateAgent, AgentProfileController.getAgentOfficeAddress)
agentProfileRoutes.route("/get_about_us").post(validateAgent, AgentProfileController.getAgentAboutUs)

// contact profile
agentProfileRoutes.route("/get_contact_profile").post(validateAgent, AgentProfileController.getAgentContactProfile)

// operating hours
agentProfileRoutes.route("/get_operating_hours").post(validateAgent, AgentProfileController.getAgentOperatingHours)


//  ----------- servoice profile related routes ------------
// create agent service profile 
agentProfileRoutes.route("/update_service_profile").post(validateAgent, AgentProfileController.updateAgentServiceDetails)

// get service profile 
agentProfileRoutes.route("/get_service_profile").post(validateAgent, AgentProfileController.getAgentServiceProfile)

// add country for specialization
agentProfileRoutes.route("/add_specialization_country").post(validateAgent, AgentProfileController.addSpecializationCountry)
agentProfileRoutes.route("/delete_specialization_country").post(validateAgent, AgentProfileController.removeSpecializationCountry)

// get specialization country
agentProfileRoutes.route("/get_specialization_country").post(validateAgent, AgentProfileController.getSpecializationCountry)


// admin view profile

const adminAgentProfileRoutes = express.Router()

adminAgentProfileRoutes.route("/get_basic_profile").post(validateAdmin, AgentProfileController.getAgentBasicProfileAdmin)

agentProfileRoutes.use("/admin", adminAgentProfileRoutes)
export default agentProfileRoutes