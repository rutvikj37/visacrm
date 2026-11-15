import { Response } from "express";
import { returnHelper } from "../../helpers/returnHelper"
import { RequestWithUser } from "../../utils/types";
import User from "../../model/User";
import StudentCoins from "../../model/StudentCoins";

class CoinController {

    // admin

    async addCoinsOptions(req: RequestWithUser, res: Response) {
        try {



        }
        catch (error) {
            console.log("ERROR IN addCoins-->", error);
            return returnHelper(res, 500, false, "Something Went Wrong")
        }
    }


    // user
    async getCoinsBalance(req: RequestWithUser, res: Response) {
        try {
            const user = await User.findOne({
                where: {
                    id: req?.user?.user?.id
                },
                attributes: ["coins_balance"]
            })

            return returnHelper(res, 200, true, "Coins Balance", user?.dataValues?.coins_balance+"" || "0")

        } catch (error) {
            console.log("ERROR IN getCoins-->", error);
            return returnHelper(res, 500, false, "Something Went Wrong")
        }
    }

    async getCoinSpendHistory(req: RequestWithUser, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = (page - 1) * limit;
    
            const { count, rows: coinHistory } = await StudentCoins.findAndCountAll({
                where: {
                    student_id: req?.id
                },
                order: [['createdAt', 'DESC']],
                attributes:["id", "used_coins", "coin_balance","transection_type","comment","createdAt"],
                limit,
                offset
            });
    
            return returnHelper(res, 200, true, "Coin History", {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                data: coinHistory
            });
    
        } catch (error) {
            console.log("ERROR IN getCoins-->", error);
            return returnHelper(res, 500, false, "Something Went Wrong");
        }
    }
    

}


export default new CoinController()