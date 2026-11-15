import { Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import ContactUs from "../../model/ContactUs";
import Agent from "../../model/Agent";
import { ingestLead, LeadValidationError } from "../../services/leadIngestion";

class ContactUsController {

    async addContactUs(req: RequestWithUser, res: Response) {
        try {

            const {
                name,
                number,
                email,
                message,
                agent_id
            } = req.body

            if(!name) return returnHelper(res,200,false,"Please Provide Name")
            if(!number) return returnHelper(res,200,false,"Please Provide number")
            if(!email) return returnHelper(res,200,false,"Please Provide email")
            if(!message) return returnHelper(res,200,false,"Please Provide message")
            if(!agent_id) return returnHelper(res,200,false,"You cant send inquiry")

            await ContactUs.create({
                name,
                number,
                email,
                message,
                agent_id
            })

            // SaaS: also put the enquiry in the agency's Lead Inbox
            const agency: any = await Agent.findOne({ where: { id: agent_id, role: "agent" }, attributes: ["uuid"] })
            if (agency) {
                try {
                    await ingestLead({
                        agencyUuid: agency.dataValues.uuid,
                        source: "portal",
                        input: {
                            name: String(name).slice(0, 255),
                            phone: String(number),
                            email: String(email),
                            message: String(message).slice(0, 5000),
                            campaign: "Contact form",
                        },
                    })
                } catch (error) {
                    if (!(error instanceof LeadValidationError)) console.error("contact form -> lead failed", error)
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Thank You!'
            })

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async listContactUs(req:RequestWithUser,res:Response){
        try {
            const { page = 1, limit = 10 } = req.query
            const parsedPage = parseInt(page as string)
            const parsedLimit = parseInt(limit as string)
            const offset = (parsedPage - 1) * parsedLimit

            const whereClause: any = {
                agent_id: req?.user?.user?.id
            }

            const { count, rows: contactUsRecords } = await ContactUs.findAndCountAll({
                where: whereClause,
                order: [["createdAt", "DESC"]],
                limit: parsedLimit,
                offset: offset
            })

            return res.status(200).json({
                success: true,
                message: 'Records Found',
                total: count,
                totalPages: Math.ceil(count / parsedLimit),
                currentPage: parsedPage,
                data: contactUsRecords
            })
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

}

export default new ContactUsController()