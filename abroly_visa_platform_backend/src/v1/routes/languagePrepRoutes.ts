import express from 'express'
import { requireAddon } from "../../services/saas"
import { validateAdmin, validateUser,validateAgent } from '../../middleware/authMiddleware'
import LanguagePrepController from '../controller/LanguagePrepController'
import { uploadMedia } from '../../middleware/fileUpload'

const languagePrepRoutes = express.Router()


// add LanguagePrepController
languagePrepRoutes.route("/add").post(validateAgent,requireAddon("language_prep"), uploadMedia.single("file"), LanguagePrepController.addLanguage)
languagePrepRoutes.route("/edit").post(validateAgent,requireAddon("language_prep"), uploadMedia.single("file"), LanguagePrepController.editLanguage)
languagePrepRoutes.route("/delete").post(validateAgent,requireAddon("language_prep"), uploadMedia.single("file"), LanguagePrepController.deleteLanguage)
languagePrepRoutes.route("/toggle").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.toggleLanguage)
languagePrepRoutes.route("/list").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.listLanguages)
languagePrepRoutes.route("/details_basic").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.detailsBasic)


const chapterRoutes = express.Router()

languagePrepRoutes.use("/chapters", chapterRoutes)

chapterRoutes.route("/add").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.addChapter)
chapterRoutes.route("/update").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.updateChapter)
chapterRoutes.route("/list").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.getChapters)
chapterRoutes.route("/get").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.getChapter)
chapterRoutes.route("/delete").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.deleteChapter)

// sub chapters 
const subChapters = express.Router()

languagePrepRoutes.use("/sub_chapters", subChapters)

subChapters.route("/list").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.listSubChapters)
subChapters.route("/get").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.getSubChapter)
subChapters.route("/delete").post(validateAgent,requireAddon("language_prep"), LanguagePrepController.deleteSubChapter)
subChapters.route("/add").post(validateAgent,requireAddon("language_prep"), uploadMedia.single("file"), LanguagePrepController.addSubChapter)
subChapters.route("/update").post(validateAgent,requireAddon("language_prep"), uploadMedia.single("file"), LanguagePrepController.editSubChapter)

const publicRoutes = express.Router()
languagePrepRoutes.use("/public", publicRoutes)
publicRoutes.route("/list/:angecy_id").get(LanguagePrepController.publicListLangaugePreps)
publicRoutes.route("/details").post(LanguagePrepController.publicDetailsLangaugePreps)


const studentRoutes = express.Router()
studentRoutes.route("/purchase").post(validateUser, LanguagePrepController.purchaseLevel)
studentRoutes.route("/purchase_check").post(validateUser, LanguagePrepController.purchaseLevelCheck)
studentRoutes.route("/purchase_list").get(validateUser, LanguagePrepController.purchaseList)
studentRoutes.route("/purchase_course_details").post(validateUser, LanguagePrepController.purchaseCourseDetails)
studentRoutes.route("/purchase_sub_point_details").post(validateUser, LanguagePrepController.purchaseCourseSubPointDetails)
studentRoutes.route("/progress_check").post(validateUser, LanguagePrepController.getCourseProgress)
studentRoutes.route("/progress_update").post(validateUser, LanguagePrepController.updateCourseProgress)
studentRoutes.route("/certificate_details").post(LanguagePrepController.CertificateDetails)

languagePrepRoutes.use("/student", studentRoutes)


const adminDetails = express.Router()

adminDetails.route("/enrolled_students").post(validateAgent,requireAddon("language_prep"),LanguagePrepController.getEnrolledList)

languagePrepRoutes.use("/admin",adminDetails)

export default languagePrepRoutes