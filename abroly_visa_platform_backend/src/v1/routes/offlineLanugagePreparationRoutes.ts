import express from 'express'
import { requireAddon } from "../../services/saas"
import OfflineLanguagePreparationController from '../controller/OfflineLanguagePreparationController';
import { validateAdmin, validateAgent, validateUser } from '../../middleware/authMiddleware';

const offlineLanugagePreparationRoutes = express.Router();

offlineLanugagePreparationRoutes.route('/add').post(validateAdmin,OfflineLanguagePreparationController.addUpdateOfflineLanguagePrepADMIN)
offlineLanugagePreparationRoutes.route('/delete').delete(validateAdmin,OfflineLanguagePreparationController.deleteADMIN)
offlineLanugagePreparationRoutes.route('/list_admin').get(validateAdmin,OfflineLanguagePreparationController.listADMIN)
offlineLanugagePreparationRoutes.route('/list').get(OfflineLanguagePreparationController.listPUBLIC)
offlineLanugagePreparationRoutes.route('/toggle').post(validateAdmin,OfflineLanguagePreparationController.toggleStatusADMIN)

offlineLanugagePreparationRoutes.route('/does_accept_offline').get(validateAgent,requireAddon("language_prep"),OfflineLanguagePreparationController.doesAcceptOffline)
offlineLanugagePreparationRoutes.route('/accept_offline').post(validateAgent,requireAddon("language_prep"),OfflineLanguagePreparationController.acceptOfflineLanguagePreps)
offlineLanugagePreparationRoutes.route('/manage_agent_languages').post(validateAgent,requireAddon("language_prep"),OfflineLanguagePreparationController.addAcceptDeclineLanguages)
offlineLanugagePreparationRoutes.route('/selected_languages').get(validateAgent,requireAddon("language_prep"),OfflineLanguagePreparationController.selectedLanguages)

// get results for students
offlineLanugagePreparationRoutes.route('/get_nearby_agents').get(validateUser,OfflineLanguagePreparationController.getOfflineLanguagesAgents)

// interest 
offlineLanugagePreparationRoutes.route('/interested').get(validateUser,OfflineLanguagePreparationController.makeInterest)
offlineLanugagePreparationRoutes.route('/inquiries').get(validateAgent,requireAddon("language_prep"),OfflineLanguagePreparationController.inquiriesList)

export default offlineLanugagePreparationRoutes;