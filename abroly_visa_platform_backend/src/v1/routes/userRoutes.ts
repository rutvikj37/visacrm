import { loginRateLimit } from "../../middleware/loginRateLimit"
import { localOnly } from "../../middleware/localOnly"
import express from 'express'
import UserController from '../controller/UserController'
import { validateAdmin, validateAdminOrManager, validateGeneral } from '../../middleware/authMiddleware'
import { loginWithNumberValidation, otpValidation, sinupWithNumberValidation } from '../validations/userValidations'
import validationBodyMw from '../../middleware/validateBody'
import { signOutEverywhere } from '../../services/agencyLogin'
import { numberExistMw } from '../../middleware/validateExistMiddleware'

const userRoutes = express.Router()


// admim Login
const adminRoutes = express.Router()

adminRoutes.route("/validate_otp").post(loginRateLimit("admin"), validationBodyMw(otpValidation), UserController.AdminValidateOTP)
adminRoutes.route("/validate_otp_custom").post(localOnly, UserController.AdminValidateOTPCUstom)
adminRoutes.route("/login_with_number").post(loginRateLimit("admin"), validationBodyMw(loginWithNumberValidation), UserController.adminLoginWithNumber)
adminRoutes.route("/login_with_number_custom").post(localOnly, validationBodyMw(loginWithNumberValidation), UserController.AdminLoginWithNumberCustomLogic)
adminRoutes.route("/kyc").post(validateAdmin, UserController.kycTokenTypeAdmin)

userRoutes.use("/admin",adminRoutes)


const studentRoutes = express.Router()

// No self sign-up: students are added by their agency (lead -> student portal invite) and get a login code by email.
const noStudentSignup = (_req: any, res: any) =>
    res.status(200).json({ success: false, message: "Sign up is not available. Your agency will add you and email your login code." });
studentRoutes.route("/signup").post(noStudentSignup)
studentRoutes.route("/signup_custom").post(noStudentSignup)
studentRoutes.route("/login_with_number").post(loginRateLimit("student"), validationBodyMw(loginWithNumberValidation), UserController.studentLoginWithNumber)
studentRoutes.route("/login_with_number_custom").post(localOnly, validationBodyMw(loginWithNumberValidation), UserController.studentLoginCustom)
studentRoutes.route("/validate_otp").post(loginRateLimit("student"), validationBodyMw(otpValidation), UserController.studentValidateOTP)
studentRoutes.route("/validate_otp_custom").post(localOnly, UserController.studentValidateOTPCUstom)
studentRoutes.route("/request_passcode_reset").post(loginRateLimit("student"), validationBodyMw(loginWithNumberValidation), UserController.studentRequestPasscodeReset)
studentRoutes.route("/verify_passcode_reset").post(loginRateLimit("student"), UserController.studentVerifyPasscodeReset)
studentRoutes.route("/set_passcode").post(loginRateLimit("student"), UserController.studentSetPasscode)
// "Log out all devices" for a student
studentRoutes.route("/logout_all").post(validateGeneral, async (req: any, res) => {
    await signOutEverywhere("student", Number(req.user?.user?.id))
    return res.status(200).json({ success: true, message: "Signed out on all devices." })
})

userRoutes.use("/student",studentRoutes)

// know your customer 
userRoutes.route("/kyc").post(validateGeneral, UserController.kycTokenType)


export default userRoutes