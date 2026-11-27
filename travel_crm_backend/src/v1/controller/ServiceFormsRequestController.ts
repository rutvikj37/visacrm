import { Request, Response } from "express";
import { returnHelper } from "../../helpers/returnHelper";
import ServiceFormResponse from "../../model/ServiceFromResponse";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";

class ServiceFormsRequestController {


    async addServiceFormRequest(req: Request, res: Response) {
        try {
            const { name, email, phone, country_of_study_or_travel, coverage_type, data_requirements, start_date_of_insurance, type_of_response,agent_id } = req.body

            if(!type_of_response) return returnHelper(res, 200, false, "Invalid Type of Response")
            if(type_of_response == "health"){
                if(!start_date_of_insurance) return returnHelper(res, 200, false, "Please Provide Start Date of Insurance")
            }

            if(type_of_response == "data"){
                if(!data_requirements) return returnHelper(res, 200, false, "Please Provide Data Requirements")
                if(!coverage_type) return returnHelper(res, 200, false, "Please Provide Coverage Type")
            }

            if(!name) return returnHelper(res, 200, false, "Please Provide Name")
            if(!email) return returnHelper(res, 200, false, "Please Provide Email")
            if(!phone) return returnHelper(res, 200, false, "Please Provide Phone")
            if(!country_of_study_or_travel) return returnHelper(res, 200, false, "Please Provide Country of Study or Travel")

            
            await ServiceFormResponse.create({
                name, 
                email, 
                phone, 
                country_of_study_or_travel, 
                coverage_type, 
                data_requirements, 
                start_date_of_insurance, 
                type_of_response,
                agent_id,
                status: "pending"
            })

            return returnHelper(res, 200, true, "Request Added Successfully")

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async listServiceFormRequests(req: RequestWithUser, res: Response) {
        try {
            const { page = 1, limit = 10, search, status ,type_of_response} = req.body
            const parsedPage = parseInt(page as string)
            const parsedLimit = parseInt(limit as string)
            const offset = (parsedPage - 1) * parsedLimit
            // const orderBy: [string, string] = ["createdAt", "DESC"]
            const whereClause: any = {
                agent_id: req?.user?.user?.agent_id
            }

            if(search) {
                whereClause[Op.or] = [
                    { name: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } },
                    { phone: { [Op.like]: `%${search}%` } },
                    { country_of_study_or_travel: { [Op.like]: `%${search}%` } },
                    { coverage_type: { [Op.like]: `%${search}%` } },
                    { data_requirements: { [Op.like]: `%${search}%` } },
                ]
            }
            if(status) {
                whereClause.status = status
            }
            if(type_of_response ) {
                whereClause.type_of_response = type_of_response
            }


            const { count, rows: serviceFormRequests } = await ServiceFormResponse.findAndCountAll({
                where: whereClause,
                // order: orderBy,
                limit: parsedLimit as number,
                offset: offset
            })
            return returnHelper(res, 200, true, "Requests Found", {
                total: count,
                totalPages: Math.ceil(count / parsedLimit),
                currentPage: parsedPage,
                data: serviceFormRequests
            })
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
    async updateStatusOfRequest(req: Request, res: Response) {
        try {
            const { id, status } = req.body
            if(!id) return returnHelper(res, 200, false, "Please Provide ID")
            if(!status) return returnHelper(res, 200, false, "Please Provide Status")

            await ServiceFormResponse.update({
                status: status as string
            }, {
                where: { id }
            })
            return returnHelper(res, 200, true, "Status Updated Successfully")
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
}

export default new ServiceFormsRequestController();