import { Response } from "express";
import { privateFilePath } from "../../helpers/privateFiles";
import { RequestWithUser } from "../../utils/types";
import AgentTransectionsToAdmin from "../../model/AgentTransectionsToAdmin";
import { returnHelper } from "../../helpers/returnHelper";
import Package from "../../model/Packages";
import Agent from "../../model/Agent";
import Subscription from "../../model/Subscription";
import moment from "moment";
import path from "path";
import fs from "fs";
import { Op } from "sequelize";

class AgentAdminTransectionsController {

    async createTransection(req: RequestWithUser, res: Response) {
        try {
            const { plan_id, transection_id, transaction_type, amount, transection_date } = req.body;

            if (!plan_id || !transection_id || !transaction_type || !amount || !req?.file || !transection_date) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const count = await AgentTransectionsToAdmin.count({
                where: {
                    agent_id: req?.id,
                    createdAt: {
                        $gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
                    }
                }
            })

            if (count >= 3) {
                return res.status(400).json({ message: 'You have already submitted 3 transactions in last 24 hours, please try again after 24 hours' }); ``
            }

            // save file to uploads folder
            const file_name = (path.parse(req?.file?.originalname).name)?.replaceAll(" ", "_").toLowerCase() + `${Date.now()}-${Math.floor(
                1000 + Math.random() * 9000
            )}${path.parse(req?.file?.originalname).ext}`;

            const transaction = await AgentTransectionsToAdmin.create({
                agent_id: req?.id,
                plan_id,
                transection_date,
                transection_id,
                transaction_type,
                amount,
                payment_proof: file_name,
                status: 'pending'
            }).then(() => {
                fs.writeFileSync(
                    privateFilePath("subscription_proof", file_name),
                    req.file!.buffer
                );
            })

            return returnHelper(res, 200, true, "transaction created successfully");
        } catch (error) {
            return returnHelper(res, 500, false, "internal server error", error);
        }
    }

    async admin_list(req: RequestWithUser, res: Response) {
        try {
            const { page = 1, limit = 10 } = req.query;
            let search = req.query.search as string;
            let status = req.query.status as string;
            let transaction_date = req.query.transaction_date as string;
    
            if (search) {
                search = search.trim();
            }
    
            // Validate transaction_date if provided
            let isValidDate = false;
            if (transaction_date) {
                transaction_date = transaction_date.trim();
                // Check if the date is in valid format (you can adjust the format as needed)
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD format
                isValidDate = dateRegex.test(transaction_date) && !isNaN(new Date(transaction_date).getTime());
                
                if (!isValidDate) {
                    return returnHelper(res, 400, false, "Invalid date format. Please use YYYY-MM-DD", null);
                }
            }
    
            const whereCondition = {
                ...(search && search.trim() !== "" && {
                    [Op.or]: [
                        {
                            "transection_id": {
                                [Op.like]: `%${search}%`
                            }
                        },
                        {
                            "transaction_type": {
                                [Op.like]: `%${search}%`
                            }
                        },
                    ]
                }),
                ...(status && status.trim() !== "" && { status }),
                ...(isValidDate && {
                    transection_date: {
                        [Op.eq]: transaction_date
                    }
                })
            };
    
            const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
            const transactions = await AgentTransectionsToAdmin.findAndCountAll({
                where: whereCondition,
                include: [
                    {
                        model: Agent,
                        as: "agent",
                        attributes: ["uuid", "id", "username", "email", "phone_number", "country_code", "phone"]
                    },
                    {
                        model: Package,
                        as: "package",
                        attributes: ["id", "name"]
                    }
                ],
                attributes: [
                    "id",
                    "transection_id",
                    "transaction_type",
                    "transection_date",
                    "amount",
                    "status",
                    "reason",
                    "payment_proof",
                    "access_file",
                    "createdAt",
                ],
                limit: parseInt(limit as string),
                offset: offset,
                order: [['createdAt', 'DESC']]
            });
            return returnHelper(res, 200, true, "transactions found", transactions);
        } catch (error) {
            return returnHelper(res, 500, false, "internal server error", error);
        }
    }

    async agentList(req: RequestWithUser, res: Response) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const parsedPage = parseInt(page as string);
            const parsedLimit = parseInt(limit as string);
            const offset = (parsedPage - 1) * parsedLimit;

            // Fetch transactions with pagination
            const transactions = await AgentTransectionsToAdmin.findAll({
                where: {
                    agent_id: req?.id,
                },
                attributes: [
                    "id",
                    "transection_id",
                    "transaction_type",
                    "transection_date",
                    "amount",
                    "status",
                    "reason",
                    "payment_proof",
                    "access_file",
                    "createdAt",
                ],
                limit: parsedLimit,
                offset: offset,
                order: [['createdAt', 'DESC']]
            });

            // Fetch total record count
            const totalRecords = await AgentTransectionsToAdmin.count({
                where: {
                    agent_id: req?.id,
                }
            });

            // Calculate total pages
            const totalPages = Math.ceil(totalRecords / parsedLimit);

            return returnHelper(res, 200, true, "Transactions found", {
                records: transactions,
                totalRecords,
                totalPages,
                totalCount: transactions.length, // Count of transactions returned in this page
            });
        } catch (error) {
            return returnHelper(res, 500, false, "Internal server error", error);
        }
    }


    // assign plan
    async addSubscription(req: RequestWithUser, res: Response) {
        try {

            const { agent_id, package_id } = req.body;

            const { id } = req?.params

            if (!agent_id || !package_id) {
                return returnHelper(res, 200, false, "All fields are required")
            }

            const findTransection = await AgentTransectionsToAdmin.findOne({
                where: {
                    id,
                }
            })
            if (!findTransection) {
                return returnHelper(res, 200, false, "Transection Not Found")
            }

            const findPackage = await Package.findOne({
                where: {
                    id: package_id
                },
                attributes: [
                    "uuid",
                    "leadLimit",
                    "teamLimit",
                    "jobPostLimit",
                    "job_post_days",
                    "achievement_banner",
                    "pin_days",
                    "can_add_offline_lead"
                ]
            })

            if (!findPackage) {
                return returnHelper(res, 200, false, "Package Not Found")
            }

            const findAgent = await Agent.findOne({
                where: {
                    id: agent_id
                },
                attributes: ["uuid"]
            })

            if (!findAgent) {
                return returnHelper(res, 200, false, "Agent Not Found")
            }

            const subAgentCount = await Agent.count({
                where: {
                    parent_id: agent_id,
                    role: "sub-agent"
                }
            });

            if (subAgentCount > findPackage?.dataValues?.teamLimit) {
                const excessCount = subAgentCount - findPackage?.dataValues?.teamLimit;
                return returnHelper(res, 200, false, `Existing sub-agents (${subAgentCount}) are more than the current package limit. Please delete ${excessCount} sub-agents.`);
            }

            // start date and end date 
            const startDate = new Date()

            const endDate = new Date()

            const pin_end_date = new Date()

            endDate.setDate(startDate.getDate() + +findPackage?.dataValues?.job_post_days)
            pin_end_date.setDate(pin_end_date.getDate() + +findPackage?.dataValues?.pin_days)

            const subscription = await Subscription.create({
                agent_uuid: findAgent?.dataValues?.uuid,
                package_uuid: findPackage?.dataValues?.uuid,
                leads_remaining: findPackage?.dataValues?.leadLimit,
                team_member_limit: findPackage?.dataValues?.team_member_limit,
                job_post_limit: findPackage?.dataValues?.jobPostLimit,
                achievement_banner: findPackage?.dataValues?.achievement_banner,
                job_post_start_date: startDate,
                job_post_end_date: endDate,
                subscription_start_date: new Date(),
                pin_end_date: findPackage?.dataValues?.pin_days !== 0 ? pin_end_date : new Date(),
                can_add_offline_leads: findPackage?.dataValues?.can_add_offline_lead,
                offline_lead_end_date: findPackage?.dataValues?.can_add_offline_lead == 1 ? moment().add(1, 'year').format('MM/DD/YYYY') : null
            });

            await AgentTransectionsToAdmin.update({
                status: "accepted"
            }, {
                where: {
                    id: id
                }
            })

            return returnHelper(res, 200, true, "New Subscription Assigned", subscription);

        }
        catch (error) {
            return returnHelper(res, 500, false, "internal server error", error);
        }
    }


    // decline plan

    async declineTransection(req: RequestWithUser, res: Response) {
        try {

            const { reason ,id} = req.body

            if (!id || !reason) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const transaction = await AgentTransectionsToAdmin.findOne({
                where: {
                    id,
                }
            });
            if (!transaction) {
                return res.status(400).json({ message: 'Transaction not found' });
            }
            await AgentTransectionsToAdmin.update({
                status: 'rejected',
                reason
            }, {
                where: {
                    id,
                }
            });
            return returnHelper(res, 200, true, "transaction deleted successfully");
        } catch (error) {
            return returnHelper(res, 500, false, "internal server error", error);
        }
    }




}

export default new AgentAdminTransectionsController();