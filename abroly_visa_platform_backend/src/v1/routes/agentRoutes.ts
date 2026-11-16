import { localOnly } from "../../middleware/localOnly"
import express from 'express';
import AgentController from '../controller/AgentController';
import validationBodyMw from '../../middleware/validateBody';
import { loginWithNumberValidation, otpValidation, sinupWithNumberValidation } from '../validations/userValidations';
import { AgentNumberExistMw, numberExistMw } from '../../middleware/validateExistMiddleware';
import { validateAdmin, validateAgent } from '../../middleware/authMiddleware';
import { uploadImage } from '../../middleware/fileUpload';

const agentRoutes = express.Router();

agentRoutes.route("/validate_otp").post(validationBodyMw(otpValidation), AgentController.validateOTP)
agentRoutes.route("/validate_otp_custom").post(localOnly, AgentController.validateOTPCustom)
agentRoutes.route("/login_with_number").post(validationBodyMw(loginWithNumberValidation), AgentController.loginWithNumber)
agentRoutes.route("/login_with_number_custom").post(localOnly, validationBodyMw(loginWithNumberValidation), AgentController.loginWithNumberCustom)
agentRoutes.route("/request_passcode_reset").post(validationBodyMw(loginWithNumberValidation), AgentController.requestPasscodeReset)
agentRoutes.route("/verify_passcode_reset").post(AgentController.verifyPasscodeReset)
agentRoutes.route("/set_passcode").post(AgentController.setPasscode)
// agentRoutes.route("/signup").post(validationBodyMw(sinupWithNumberValidation), AgentNumberExistMw, AgentController.signup)
// agentRoutes.route("/signup_custom").post(validationBodyMw(sinupWithNumberValidation), AgentNumberExistMw, AgentController.signupCustom)


agentRoutes.route("/kyc").post(validateAgent, AgentController.kycTokenType)

// agent listing in admin 
agentRoutes.route("/create_account").post(
    validateAdmin,
    uploadImage.fields([
        // { name: 'certificate_file', maxCount: 1 },
        { name: 'favicon_file', maxCount: 1 },
        { name: 'og_image_file', maxCount: 1 }
    ]),
    AgentController.createAccount
)
agentRoutes.route("/update_account").post(
    validateAdmin,
    uploadImage.fields([
        // { name: 'certificate_file', maxCount: 1 },
        { name: 'favicon_file', maxCount: 1 },
        { name: 'og_image_file', maxCount: 1 }
    ]),
    AgentController.updateAccount
)
agentRoutes.route("/get_account_details_by_id").get(validateAdmin, AgentController.getAccountDetailsById)

agentRoutes.route("/list_agents").post(validateAdmin, AgentController.agentListing)
agentRoutes.route("/create").post(validateAdmin,validationBodyMw(sinupWithNumberValidation), AgentNumberExistMw, AgentController.agentCreate)
agentRoutes.route("/update").post(validateAdmin,AgentController.agentUpdate)
agentRoutes.route("/toggle").post(validateAdmin,AgentController.toggleAgent)

// Public 
agentRoutes.route("/get_agency").get(AgentController.getAccountDetails)
agentRoutes.route("/get_agency_dev").get(AgentController.getAccountDetailsDev)

export default agentRoutes;
