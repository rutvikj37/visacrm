import express, { Request, Response } from "express"
import LeadProgressController from "../controller/LeadProgressController"
import { validateAgent, validateUser } from "../../middleware/authMiddleware"
import { uploadMedia } from "../../middleware/fileUpload"
import { returnHelper } from "../../helpers/returnHelper"

const leadProgressRoutes = express.Router()


leadProgressRoutes.route("/manage_step")
    .post(validateAgent,LeadProgressController.addStep)
    .put(validateAgent,LeadProgressController.updateStep)
    .delete(validateAgent,LeadProgressController.deleteStep)

leadProgressRoutes.route("/toggle_step_status/:id").get(validateAgent,LeadProgressController.changeStepStatus)
leadProgressRoutes.route("/add_question").post(validateAgent,uploadMedia.single("file"),LeadProgressController.addQuestion,
(err:any,req:Request,res:Response)=>{
    return returnHelper(res,200,false,err.message)
})
leadProgressRoutes.route("/get_steps/:lead_id").get(validateAgent,LeadProgressController.provideSteps)
leadProgressRoutes.route("/get_questions/:step_id").get(validateAgent,LeadProgressController.provideQuestions)
leadProgressRoutes.route("/action").post(validateAgent,LeadProgressController.actionQuestion)

const studentLeadProgressRoutes = express.Router()
studentLeadProgressRoutes.route("/overview").get(validateUser,LeadProgressController.studentOverview)
studentLeadProgressRoutes.route("/get_steps/:lead_id").get(validateUser,LeadProgressController.provideStepsStudents)
studentLeadProgressRoutes.route("/get_questions/:step_id").get(validateUser,LeadProgressController.provideQuestionsStudent)
studentLeadProgressRoutes.route("/submit_answer").post(validateUser,uploadMedia.single("file"),LeadProgressController.submitAnswer,
(err:any,req:Request,res:Response)=>{
    return returnHelper(res,200,false,err.message)
})
studentLeadProgressRoutes.route("/widthdraw_application/:lead_id").get(validateUser,LeadProgressController.withdrawApplication)

leadProgressRoutes.use("/student",studentLeadProgressRoutes)

export default leadProgressRoutes