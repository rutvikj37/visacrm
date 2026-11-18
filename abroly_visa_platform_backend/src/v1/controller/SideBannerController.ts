import { saveFile, ownerFromRequest } from "../../helpers/storage";
import { Response } from "express";
import { returnHelper } from "../../helpers/returnHelper";
import { RequestWithUser } from "../../utils/types";
import SideBanner from "../../model/SideBanner";
import moment from "moment";
import { Op } from "sequelize";
import fs from 'fs'
import path from 'path'
import Subscription from "../../model/Subscription";
import Agent from "../../model/Agent";
import SideBannerResponses from "../../model/SideBannerResponses";

class SideBannerController {

    // get available positions for a date/time window (or a whole month)
    async availableSlot(req: RequestWithUser, res: Response) {
        try {
            const { requestedMonth, start_date: rawStart, end_date: rawEnd, target_type }: any = req.body;

            if (!target_type) {
                return returnHelper(res, 200, false, "Please Select Target");
            }

            let start_date: Date;
            let end_date: Date;
            if (rawStart && rawEnd) {
                start_date = moment(rawStart).toDate();
                end_date = moment(rawEnd).toDate();
                if (!moment(start_date).isValid() || !moment(end_date).isValid()) {
                    return returnHelper(res, 200, false, "Invalid start or end date/time.");
                }
                if (end_date <= start_date) {
                    return returnHelper(res, 200, false, "End must be after start.");
                }
            } else if (requestedMonth) {
                start_date = moment(requestedMonth, "YYYY-MM").startOf("month").toDate();
                end_date = moment(requestedMonth, "YYYY-MM").endOf("month").toDate();
            } else {
                return returnHelper(res, 200, false, "Provide start_date and end_date, or requestedMonth (YYYY-MM).");
            }

            // Positions are no longer enforced — multiple banners can be live and show as a student hero slider.
            const monthSlot = {
                start_date,
                end_date,
                position_1: { isAvailable: true },
                position_2: { isAvailable: true },
            };

            return returnHelper(res, 200, true, "Available Slot", [monthSlot]);
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }


    async assignSlot(req: RequestWithUser, res: Response) {
        const { campaign_title, start_date, end_date, target_type } = req.body;
        // Keep DB column for compat; new campaigns default to "1" (position slots are no longer exclusive).
        const position = req.body.position === "2" ? "2" : "1";

        if (!campaign_title || !start_date || !end_date || !target_type) {
            return returnHelper(res, 200, false, "Please Provide Required Fields")
        }
        if (!req.file) {
            return returnHelper(res, 200, false, "Banner image is required");
        }
        const startAt = moment(start_date);
        const endAt = moment(end_date);
        if (!startAt.isValid() || !endAt.isValid()) {
            return returnHelper(res, 200, false, "Invalid start or end date/time");
        }
        if (!endAt.isAfter(startAt)) {
            return returnHelper(res, 200, false, "End must be after start");
        }

        const image = `${Date.now()}-${Math.floor(
            1000 + Math.random() * 9000
        )}${path.parse(req.file.originalname).ext}`;

        try {
            // Allow multiple overlapping banners for the same target — student UI shows all live ones in a slider.
            const storedImage = await saveFile({ owner: ownerFromRequest(req), folder: "banners", name: image, body: req.file.buffer, contentType: req.file.mimetype });
            const newBanner = await SideBanner.create({
                agent_uuid: req?.uuid,
                campaign_title,
                image: storedImage,
                start_date: startAt.toDate(),
                end_date: endAt.toDate(),
                position,
                target_type: target_type,
                status: "accept",
            });

            return res.status(201).json({
                success: true,
                message: "Campaign created successfully",
                data: newBanner,
            });
        } catch (error) {
            console.error("Error assigning slot:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async listCamp(req: RequestWithUser, res: Response) {
        try {

            let { find_for } = req.params

            if (!find_for) {
                find_for = "current"
            }

            const now = new Date();
            // current = not yet ended (live + scheduled); past = already ended
            let whereCondition = find_for == "current" ? {
                end_date: { [Op.gte]: now },
                agent_uuid: req?.uuid
            } : {
                end_date: { [Op.lt]: now },
                agent_uuid: req?.uuid
            }

            const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25));
            const { count, rows: findAll }: any = await SideBanner.findAndCountAll({
                where: whereCondition,
                order: [["start_date", "ASC"]],
                limit,
                offset: (page - 1) * limit,
            })

            const rows = findAll.map((row: any) => {
                const d = row.toJSON ? row.toJSON() : row.dataValues || row;
                const start = new Date(d.start_date).getTime();
                const end = new Date(d.end_date).getTime();
                const t = now.getTime();
                let schedule_status = "scheduled";
                if (t >= start && t <= end) schedule_status = "live";
                else if (t > end) schedule_status = "ended";
                return { ...d, schedule_status };
            });

            return returnHelper(res, 200, true, "Records Found", {
                items: rows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.max(1, Math.ceil(count / limit)),
                    totalItems: count,
                    itemsPerPage: limit,
                },
            })

        } catch (error) {
            console.error("Error in listCamp:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async canAssign(req: RequestWithUser, res: Response) {
        try {

            const activeSubscription = await Subscription.findOne({
                where: {
                    agent_uuid: req.user?.user?.uuid,
                    achievement_banner: {
                        [Op.gt]: 0
                    },
                    leads_remaining: {
                        [Op.gt]: 0
                    }
                },
                order: [["createdAt", "DESC"]]
            })

            return returnHelper(res, 200, true, "Records Found", {
                can_assign: activeSubscription ? true : false,
                remaining: activeSubscription?.dataValues?.achievement_banner
            })

        } catch (error) {
            console.error("Error in canAssign:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async adminSideList(req: RequestWithUser, res: Response) {
        try {

            let { status, search } = req.body

            if (!status) {
                status = "pending"
            }

            if (status && !["pending", "history"].includes(status)) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            // Define where condition for banner status
            const whereCondition = {
                status: { [Op.in]: status === "pending" ? ["pending"] : ["reject", "accept"] }
            };

            // Define where condition for search
            const whereSearchParams: any = {};
            if (search) {
                whereSearchParams[Op.or] = [
                    { campaign_title: { [Op.like]: `%${search}%` } }, // Search in campaign_title
                    { "$banner_of.uuid$": { [Op.like]: `%${search}%` } }, // Search in Agent username
                    { "$banner_of.username$": { [Op.like]: `%${search}%` } }, // Search in Agent username
                    { "$banner_of.phone_number$": { [Op.like]: `%${search}%` } } // Search in Agent phone_number
                ];
            }

            // Combine status and search conditions
            const finalWhereCondition = {
                ...whereCondition,
                ...whereSearchParams,
            };

            // Fetch records
            const findRecords = await SideBanner.findAll({
                where: finalWhereCondition,
                attributes: [
                    "uuid",
                    "access_image",
                    "campaign_title",
                    "image",
                    "start_date",
                    "end_date",
                    "status",
                    "position",
                    "target_type",
                    "createdAt",
                ],
                include: [
                    {
                        model: Agent,
                        as: "banner_of",
                        attributes: ["uuid", "username", "profile_image", "access_profile", "phone_number"],
                        required: true,
                        paranoid: false
                    }
                ]
            });


            return returnHelper(res, 200, true, "Records Found", findRecords)

        } catch (error) {
            console.error("Error in adminSideList:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async adminAction(req: RequestWithUser, res: Response) {
        try {

            const { uuid, status } = req.body

            if (!uuid || !status) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            if (status && !["accept", "reject"].includes(status)) {
                return returnHelper(res, 200, false, "Provide Valid Action")
            }

            const findSideBanner = await SideBanner.findOne({
                where: {
                    uuid
                }
            })

            if (!findSideBanner) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            if (status == "reject") {
                // find last subscription of that user and +1 to it 
                const findLastSubscription = await Subscription.findOne({
                    where: {
                        agent_uuid: findSideBanner?.dataValues?.agent_uuid
                    },
                    order: [["createdAt", "DESC"]]
                })
                if (findLastSubscription) {
                    await Subscription.update({
                        achievement_banner: Number(findLastSubscription?.dataValues?.achievement_banner) + 1
                    }, {
                        where: {
                            uuid: findLastSubscription?.dataValues?.uuid
                        }
                    })
                }
            }

            await SideBanner.update({
                status: status
            }, {
                where: {
                    uuid
                }
            })

            return returnHelper(res, 200, true, "Status Updated,Action Done!")


        } catch (error) {
            console.error("Error in adminAction:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async studentActiveAchievement(req: RequestWithUser, res: Response) {
        try {

            let { target_type,agent_uuid } = req.params

            if (!target_type || !agent_uuid) {
                return returnHelper(res, 200, false, "Invalid Request")
            }

            // Only banners whose schedule window includes now.
            // target_type "home" / "all" = every live campaign for the agency (student home hero).
            const now = new Date();
            const forHome = ["home", "all"].includes(String(target_type).toLowerCase());
            const where: any = {
                agent_uuid,
                status: "accept",
                start_date: { [Op.lte]: now },
                end_date: { [Op.gte]: now },
            };
            if (!forHome) {
                where.target_type = target_type;
            }

            const records = await SideBanner.findAll({
                where,
                attributes: [
                    "uuid",
                    "image",
                    "campaign_title",
                    "start_date",
                    "end_date",
                    "status",
                    "position",
                    "access_image",
                    "createdAt",
                    "target_type",
                ],
                order: [["createdAt", "ASC"]],
            });

            return returnHelper(res, 200, true, "Achievements Found", records)

        } catch (error) {
            console.error("Error in studentActiveAchievement:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async sideBannerResponseAdd(req: RequestWithUser, res: Response) {
        try {
            // SideBannerResponses

            const {
                name,
                email,
                phone_number,
                banner_id
            } = req.body

            const isSideBannerExist = await SideBanner.findOne({
                where: {
                    uuid: banner_id
                }
            })

            if (!isSideBannerExist) {
                return returnHelper(res, 200, false, "Can not store your response")
            }

            if (!name) {
                return returnHelper(res, 200, false, "Provide Name")
            }
            if (!email) {
                return returnHelper(res, 200, false, "Provide Email")
            }
            if (!phone_number) {
                return returnHelper(res, 200, false, "Provide Phone Number")
            }
            if (!banner_id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const findExist = await SideBannerResponses.findOne({
                where: {
                    phone_number,
                    banner_id
                }
            })

            if (findExist) {
                return returnHelper(res, 200, false, "You've Already Submitted")
            }

            await SideBannerResponses.create({
                name,
                email,
                phone_number,
                banner_id
            })

            // here add +1 in responses 
            await SideBanner.update({
                responses: Number(isSideBannerExist?.dataValues?.responses) + 1
            }, {
                where: {
                    uuid: isSideBannerExist?.dataValues?.uuid
                }
            })

            return returnHelper(res, 200, true, "Thank you for your interest")

        } catch (error) {
            console.error("Error in sideBannerResponseAdd:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async sideBannerResponsesGet(req: RequestWithUser, res: Response) {
        try {

            const { uuid } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Invalid action")
            }

            const findAll = await SideBannerResponses.findAll({
                where: {
                    banner_id: uuid
                }
            })

            return returnHelper(res, 200, true, "Find Responses", findAll)

        } catch (error) {

        }
    }




}

export default new SideBannerController()