import express from 'express'
import { validateUser } from '../../middleware/authMiddleware'
import CoinController from '../controller/CoinController'

const coinRoutes = express.Router()

// admin



// student 
const studentRoutes = express.Router()
studentRoutes.route("/get_coins_balance").get(validateUser,CoinController.getCoinsBalance)
studentRoutes.route("/history").get(validateUser,CoinController.getCoinSpendHistory)

coinRoutes.use("/student",studentRoutes)
export default coinRoutes