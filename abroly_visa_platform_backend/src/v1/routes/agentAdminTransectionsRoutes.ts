import express, { Request, Response } from 'express';
import AgentAdminTransectionsController from '../controller/AgentAdminTransectionsController';
import { validateAdmin, validateAgent } from '../../middleware/authMiddleware';
import { uploadImage } from '../../middleware/fileUpload';

const agentAdminTransectionsRoutes = express.Router();

agentAdminTransectionsRoutes.route("/createTransection").post(validateAgent,uploadImage.single("file"),AgentAdminTransectionsController.createTransection,(err:any,req:Request,res:Response)=>{
    res.status(200).send({
        success: false,
        message: err.message,
    });
});

agentAdminTransectionsRoutes.route("/admin_list").get(validateAdmin,AgentAdminTransectionsController.admin_list)
agentAdminTransectionsRoutes.route("/list").get(validateAgent,AgentAdminTransectionsController.agentList)

agentAdminTransectionsRoutes.route("/reject_transaction").post(validateAdmin,AgentAdminTransectionsController.declineTransection)
agentAdminTransectionsRoutes.route("/addSubscription/:id").post(validateAdmin,AgentAdminTransectionsController.addSubscription)

export default agentAdminTransectionsRoutes;