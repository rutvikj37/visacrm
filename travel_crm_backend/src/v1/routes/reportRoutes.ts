import { Router } from "express";
import { validateAgent } from "../../middleware/authMiddleware";
import ReportController from "../controller/ReportController";

const reportRoutes = Router();

reportRoutes.route("/request").post(validateAgent, ReportController.requestReport);
reportRoutes.route("/list").get(validateAgent, ReportController.getReports);

export default reportRoutes;