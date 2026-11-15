import e from 'express'
import express from 'express'
import AccommodationsController from '../controller/AccommodationsController'
import { validateAdmin, validateGeneral } from '../../middleware/authMiddleware'

const accommodationsRoutes = express.Router()

accommodationsRoutes.route('/add').post(validateAdmin,AccommodationsController.addAccommodation)
accommodationsRoutes.route('/list').get(validateAdmin,AccommodationsController.listAccommodations)
accommodationsRoutes.route('/delete').post(validateAdmin,AccommodationsController.deleteAccommodation)
accommodationsRoutes.route('/update').post(validateAdmin,AccommodationsController.updateAccommodation)

accommodationsRoutes.route('/list_public').post(AccommodationsController.listAccommodationsPublic)
accommodationsRoutes.route("/request_link/:id").get(validateGeneral,AccommodationsController.requestLink)


export default accommodationsRoutes