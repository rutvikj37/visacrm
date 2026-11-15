import { Request, Response } from "express";
import { RequestWithUser } from "../../utils/types";
import EventBanner from "../../model/EventBanner"; // Ensure you have the EventBanner model
import { returnHelper } from "../../helpers/returnHelper";
import EventBannerImage from "../../model/EventBannerImage";
import path from "path";
import fs from "fs";
import { Op } from "sequelize";
import EventBannerResponses from "../../model/EventBannerResponses";
import AgentEventBanner from "../../model/AgentEventBanner";
import AgentEventBannerImages from "../../model/AgentEventBannerImages";
import AgentEventBannerInterest from "../../model/AgentEventBannerInterest";
import Subscription from "../../model/Subscription";
import Agent from "../../model/Agent";
class EventBannerController {

    async createEventBanner(req: RequestWithUser, res: Response) {
        try {
            const { start_date, end_date, heading, descriptive_text } = req.body;

            // Validate required fields
            if (!start_date || !end_date || !heading || !descriptive_text) {
                return returnHelper(res, 200, false, "All fields are required");
            }

            const images = req.files; // Get images from the request
            if (!images || images.length === 0) {
                return returnHelper(res, 200, false, "At least one image is required");
            }

            const eventBanner = await EventBanner.create({
                start_date,
                end_date,
                heading,
                descriptive_text,
            });

            const eventBannerImages = [];
            for (const image of Object.values(images)) {
                const timestamp = new Date().toISOString(); // Get the current timestamp
                const buffer = image.buffer; // Get the buffer from the image
                const name = `${timestamp}_${image.originalname}`; // Add timestamp to the original name of the image
                fs.writeFileSync(
                    path.join("public/event_images", name),
                    buffer
                );
                eventBannerImages.push({ eventBannerId: eventBanner.dataValues.uuid, imageUrl: name });
            }

            // Assuming you have an EventBannerImage model imported
            await EventBannerImage.bulkCreate(eventBannerImages);

            return returnHelper(res, 200, true, "Event Banner Created");

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async updateEventBanner(req: RequestWithUser, res: Response) {
        try {
            const { start_date, end_date, heading, descriptive_text, uuid } = req.body;

            // Validate required fields
            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide UUID");
            }

            const images = req.files;

            const eventBanner = await EventBanner.findOne({ where: { uuid: uuid } });

            if (!eventBanner) {
                return returnHelper(res, 200, false, "Event Banner not found");
            }

            // Update the event banner
            await EventBanner.update(
                Object.fromEntries(Object.entries({ start_date, end_date, heading, descriptive_text }).filter(([_, v]) => v != null)),
                { where: { uuid: uuid } }
            );

            if (images && Array.isArray(images) && images.length > 0) {
                const eventBannerImages = [];
                for (const image of Object.values(images)) {
                    const timestamp = new Date().toISOString(); // Get the current timestamp
                    const buffer = image.buffer; // Get the buffer from the image
                    const name = `${timestamp}_${image.originalname}`; // Add timestamp to the original name of the image
                    fs.writeFileSync(
                        path.join("public/event_images", name),
                        buffer as any
                    );
                    eventBannerImages.push({ eventBannerId: eventBanner.dataValues.uuid, imageUrl: name });
                }

                // Assuming you have an EventBannerImage model imported
                await EventBannerImage.bulkCreate(eventBannerImages);
            }

            return returnHelper(res, 200, true, "Event Banner Updated");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getEventBannerById(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.params; // Get the id from the request parameters

            // Validate the id
            if (!id) {
                return returnHelper(res, 200, false, "Event Banner ID is required");
            }

            const eventBanner = await EventBanner.findOne({
                where: { uuid: id },
                attributes: ["uuid", "start_date", "end_date", "heading", "descriptive_text"],
                include: [{ model: EventBannerImage, as: 'images', attributes: ["uuid", "imageUrl", "url"] }]
            });

            if (!eventBanner) {
                return returnHelper(res, 200, false, "Event Banner not found");
            }

            return returnHelper(res, 200, true, "Event Banner Found", eventBanner);
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async deleteEventBannerImage(req: RequestWithUser, res: Response) {
        try {
            const { uuid } = req.params; // Get the uuid from the request parameters

            // Validate the uuid
            if (!uuid) {
                return returnHelper(res, 200, false, "Event Banner Image UUID is required");
            }
            const imageRecord = await EventBannerImage.findOne({ where: { uuid } });

            if (!imageRecord) {
                return returnHelper(res, 200, false, "Event Banner Image not found");
            }

            const deletedImage = await EventBannerImage.destroy({
                where: { uuid }
            });

            if (!deletedImage) {
                return returnHelper(res, 200, false, "Event Banner Image not found");
            }

            await EventBannerResponses.destroy({
                where: { event_id: uuid }
            });

            if (imageRecord.dataValues.imageUrl && imageRecord.dataValues.imageUrl !== "") {

                if (fs.existsSync(`./public/event_images/${imageRecord.dataValues.imageUrl}`)) {
                    fs.unlink("./public/event_images/" + imageRecord.dataValues.imageUrl, (err) => {
                        if (err) {
                            console.error("Some issue in deleting file", err);
                        }
                    });
                }
            }

            return returnHelper(res, 200, true, "Event Banner Image deleted successfully");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }


    async deleteEventBanner(req: RequestWithUser, res: Response) {
        try {
            const { uuid } = req.params; // Get the uuid from the request parameters

            // Validate the uuid
            if (!uuid) {
                return returnHelper(res, 400, false, "Event Banner UUID is required");
            }

            const eventBanner = await EventBanner.findOne({ where: { uuid } });

            if (!eventBanner) {
                return returnHelper(res, 404, false, "Event Banner not found");
            }

            const deletedBanner = await EventBanner.destroy({
                where: { uuid }
            });

            if (!deletedBanner) {
                return returnHelper(res, 404, false, "Event Banner not found");
            }

            const findImages = await EventBannerImage.findAll({ where: { eventBannerId: uuid } });
            if (findImages && findImages.length > 0) {
                await EventBannerImage.destroy({
                    where: { eventBannerId: uuid }
                });

                await Promise.all(findImages.map(async (image) => {
                    if (image.dataValues.imageUrl && image.dataValues.imageUrl !== "") {
                        if (fs.existsSync(`./public/event_images/${image.dataValues.imageUrl}`)) {
                            fs.unlink("./public/event_images/" + image.dataValues.imageUrl, (err) => { });
                        }
                    }
                }));
            }

            return returnHelper(res, 200, true, "Event Banner deleted successfully");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }


    async listEventBanners(req: RequestWithUser, res: Response) {
        try {
            const { flag } = req.query; // Get the flag from the request query
            const today = new Date();

            const condition = flag === 'past'
                ? { end_date: { [Op.lt]: today } } // Filter for past event banners
                : flag === 'current'
                    ? { end_date: { [Op.gt]: today } } // Filter for future event banners
                    : {}; // No filter if flag is not recognized

            const eventBanners = await EventBanner.findAll({
                where: condition,
                attributes: ["uuid", "start_date", "end_date", "heading", "descriptive_text", "createdAt"],
                include: [{ model: EventBannerImage, as: 'images', attributes: ["uuid", "imageUrl", "url"] }],
                order: [['createdAt', 'DESC']]
            });
            return returnHelper(res, 200, true, "Event Banners Found", eventBanners);
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }


    async createEventBannerResponse(req: Request, res: Response) {
        try {
            const { name, email, phone_number, event_id } = req.body;

            // Validate input
            if (!name) {
                return returnHelper(res, 200, false, "Name is required");
            }
            if (!email) {
                return returnHelper(res, 200, false, "Email is required");
            }
            if (!phone_number) {
                return returnHelper(res, 200, false, "Phone number is required");
            }
            if (!event_id) {
                return returnHelper(res, 200, false, "Event ID is required");
            }

            const existingResponse = await EventBannerResponses.findOne({
                where: {
                    event_id,
                    [Op.or]: [
                        { email: email },
                        { phone_number: phone_number }
                    ]
                }
            });

            if (existingResponse) {
                return returnHelper(res, 200, false, "Already responded with the same email or phone number for this event.");
            }

            // Create a new response entry
            await EventBannerResponses.create({
                name,
                email,
                phone_number,
                event_id
            });

            return returnHelper(res, 200, true, "Your interest has been recorded successfully, we will contact you soon.");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async listEventBannerResponses(req: RequestWithUser, res: Response) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const { event_id } = req.params;

            const offset = (Number(page) - 1) * Number(limit);
            const eventBannerResponses = await EventBannerResponses.findAndCountAll({
                limit: Number(limit),
                offset: offset,
                where: { event_id },
                order: [['createdAt', 'DESC']],
            });

            const totalPages = Math.ceil(eventBannerResponses.count / Number(limit));

            return returnHelper(res, 200, true, "Event Banner Responses Found", {
                data: eventBannerResponses.rows,
                total: totalPages,
                currentPage: Number(page),
                totalCount: eventBannerResponses.count,
            });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getActiveEvents(req: RequestWithUser, res: Response) {
        try {
            const today = new Date();
            const activeEvents = await EventBanner.findAll({
                where: {
                    end_date: {
                        [Op.gt]: today
                    }
                },
                include: [{ model: EventBannerImage, as: 'images', attributes: ["uuid", "imageUrl", "url"] }],
                order: [['end_date', 'ASC']],
                attributes: ["uuid", "start_date", "end_date", "heading", "descriptive_text", "createdAt"],
            });

            return returnHelper(res, 200, true, "Active Events Found", activeEvents);
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    // agent event banners 
    // ✅ Add Agent Event Banner (with images)
    async createAgentEventBanner(req: RequestWithUser, res: Response) {
        try {
            const { start_date, end_date, heading, descriptive_text } = req.body;

            const eventBanner = await AgentEventBanner.create({
                start_date,
                end_date,
                heading,
                descriptive_text,
                status: 'inactive'
            });

            const eventBannerImages = [];
            for (const image of Object.values(req?.files)) {
                const timestamp = new Date().toISOString(); // Get the current timestamp
                const buffer = image.buffer; // Get the buffer from the image
                const name = `${timestamp}_${image.originalname}`; // Add timestamp to the original name of the image
                fs.writeFileSync(
                    path.join("public/event_images", name),
                    buffer
                );
                eventBannerImages.push({ agent_event_banner_id: eventBanner.dataValues.id, imageUrl: name });
            }

            // Assuming you have an EventBannerImage model imported
            await AgentEventBannerImages.bulkCreate(eventBannerImages);

            res.status(201).json({ success: true, message: "Event banner created successfully!" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // list AgentEventBanner 
    async listAgentEventBanners(req: RequestWithUser, res: Response) {
        try {
            const { flag } = req.query; // Get the flag from the request query
            const today = new Date();

            const condition = flag === 'past'
                ? { end_date: { [Op.lt]: today } } // Filter for past event banners
                : flag === 'current'
                    ? { end_date: { [Op.gt]: today } } // Filter for future event banners
                    : {}; // No filter if flag is not recognized

            const eventBanners = await AgentEventBanner.findAll({
                where: condition,
                attributes: ["id", "start_date", "end_date", "heading", "descriptive_text", "createdAt"],
                include: [{ model: AgentEventBannerImages, as: 'images', attributes: ["id", "imageUrl", "url"] }],
                order: [['createdAt', 'DESC']]
            });
            return returnHelper(res, 200, true, "Event Banners Found", eventBanners);
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    // ✅ Delete Agent Event Banner (including images)
    async deleteAgentEventBanner(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.params;
            const eventBanner = await AgentEventBanner.findByPk(id);
            if (!eventBanner) {
                return res.status(200).json({ success: false, message: "Event banner not found" });
            }

            const images = await AgentEventBannerImages.findAll({ where: { agent_event_banner_id: id } });

            if (images && images.length > 0) {
                await AgentEventBannerImages.destroy({
                    where: { agent_event_banner_id: id }
                });

                await Promise.all(images.map(async (image) => {
                    if (image.dataValues.imageUrl && image.dataValues.imageUrl !== "") {
                        if (fs.existsSync(`./public/event_images/${image.dataValues.imageUrl}`)) {
                            fs.unlink("./public/event_images/" + image.dataValues.imageUrl, (err) => { });
                        }
                    }
                }));
            }

            await eventBanner.destroy();

            res.status(200).json({ success: true, message: "Event banner deleted successfully!" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // ✅ Update Agent Event Banner (with new images)
    async updateAgentEventBanner(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.params;
            const { start_date, end_date, heading, descriptive_text } = req.body;

            const eventBanner = await AgentEventBanner.findByPk(id);
            if (!eventBanner) {
                return res.status(404).json({ success: false, message: "Event banner not found" });
            }

            await eventBanner.update({
                start_date,
                end_date,
                heading,
                descriptive_text
            });

            const eventBannerImages = [];
            for (const image of Object.values(req?.files)) {
                const timestamp = new Date().toISOString(); // Get the current timestamp
                const buffer = image.buffer; // Get the buffer from the image
                const name = `${timestamp}_${image.originalname}`; // Add timestamp to the original name of the image
                fs.writeFileSync(
                    path.join("public/event_images", name),
                    buffer
                );
                eventBannerImages.push({ agent_event_banner_id: eventBanner.dataValues.id, imageUrl: name });
            }

            // Assuming you have an EventBannerImage model imported
            await AgentEventBannerImages.bulkCreate(eventBannerImages);

            res.status(200).json({ success: true, message: "Event banner updated successfully!" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // ✅ Get Active Events
    async getAgentActiveEvent(req: RequestWithUser, res: Response) {
        try {
            const events = await AgentEventBanner.findAll({
                where: { start_date: { [Op.lte]: new Date() }, end_date: { [Op.gte]: new Date() }, },
                include: [{ model: AgentEventBannerImages,as:"images", attributes: ["id", "imageUrl", "url"] }],
            });

            res.status(200).json({ success: true, data: events });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // ✅ Express Interest in an Event
    async expressInterest(req: RequestWithUser, res: Response) {
        try {
            const { bannerId } = req.params;

            
            const existingInterest = await AgentEventBannerInterest.findOne({
                where: { agent_event_banner_id: bannerId, agent_id: req?.user?.user?.agent_id }
            });
            
            if (existingInterest) {
                return res.status(400).json({ success: false, message: "Already interested!" });
            }
            
            // check from subscription if user has enough credits
            // const subscription = await Subscription.findOne({
            //     where: { agent_id: req?.user?.user?.agent_id }
            // });
            // if (!subscription || subscription.dataValues.credits_remaining <= 0) {
            //     return res.status(400).json({ success: false, message: "Insufficient credits!" });
            // }

            // // deduct credits from subscription
            // await subscription.update({ credits_remaining: subscription.dataValues.credits_remaining - 1 });

            await AgentEventBannerInterest.create({
                agent_event_banner_id: bannerId,
                agent_id: req?.id
            });

            res.status(200).json({ success: true, message: "Interest recorded!" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    // ✅ List Interested Agents for an Event
    async listInterestedAgents(req: RequestWithUser, res: Response) {
        try {
            const { bannerId } = req.params;

            const interestedAgents = await AgentEventBannerInterest.findAll({
                where: { agent_event_banner_id: bannerId },
                include: [{ model: Agent, as: 'agent', attributes: ["id", "uuid" ,"username","email","phone_number","country_code","phone"] }],
            });

            res.status(200).json({ success: true, data: interestedAgents });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    async getAgentEventBannerById(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.params; // Get the id from the request parameters

            // Validate the id
            if (!id) {
                return returnHelper(res, 200, false, "Event Banner ID is required");
            }

            const eventBanner = await AgentEventBanner.findOne({
                where: { id: id },
                attributes: ["id", "start_date", "end_date", "heading", "descriptive_text"],
                include: [{ model: AgentEventBannerImages, as: 'images', attributes: ["id", "imageUrl", "url"] }]
            });

            if (!eventBanner) {
                return returnHelper(res, 200, false, "Event Banner not found");
            }

            return returnHelper(res, 200, true, "Event Banner Found", eventBanner);
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async deleteAgentEventBannerImage(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.params; // Get the uuid from the request parameters

            // Validate the uuid
            if (!id) {
                return returnHelper(res, 200, false, "Event Banner Image ID is required");
            }
            const imageRecord = await AgentEventBannerImages.findOne({ where: { id } });

            if (!imageRecord) {
                return returnHelper(res, 200, false, "Event Banner Image not found");
            }

            const deletedImage = await AgentEventBannerImages.destroy({
                where: { id }
            });

            if (!deletedImage) {
                return returnHelper(res, 200, false, "Event Banner Image not found");
            }

            if (imageRecord.dataValues.imageUrl && imageRecord.dataValues.imageUrl !== "") {

                if (fs.existsSync(`./public/event_images/${imageRecord.dataValues.imageUrl}`)) {
                    fs.unlink("./public/event_images/" + imageRecord.dataValues.imageUrl, (err) => {
                        if (err) {
                            console.error("Some issue in deleting file", err);
                        }
                    });
                }
            }

            return returnHelper(res, 200, true, "Event Banner Image deleted successfully");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

}

export default new EventBannerController(); 