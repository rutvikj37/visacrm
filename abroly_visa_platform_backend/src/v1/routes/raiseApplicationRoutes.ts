import express from "express"
import { validateUser } from "../../middleware/authMiddleware"
import RaiseApplicationController from "../controller/RaiseApplicationController"

const raiseApplicationRoutes = express.Router()

raiseApplicationRoutes.route("/raise_application").post(validateUser,RaiseApplicationController.raiseApplication)
raiseApplicationRoutes.route("/prvious_raised_applications").get(validateUser,RaiseApplicationController.previousRaisedApplications)


export default raiseApplicationRoutes