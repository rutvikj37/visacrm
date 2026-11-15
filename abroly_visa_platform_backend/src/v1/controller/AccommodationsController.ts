import { Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Accommodations from "../../model/Accommodations";

class AccommodationsController {

    async addAccommodation(req: RequestWithUser, res: Response) {
        try {
            const { company_name, short_description, link, is_destination_confirmed, has_specific_move_in_date, knows_accommodation_duration, has_fixed_budget, prefers_private_room, wants_fully_furnished, needs_utilities_included, prefers_near_university_or_work, requires_accessibility_features, wants_shared_kitchen_or_meal_plan, needs_additional_facilities, has_documents_ready, wants_student_reviews, wants_flexible_cancellation, interested_in_verified_listings,images } = req.body;

            await Accommodations.create({
                company_name,
                short_description,
                link,
                images: images ? JSON.stringify(images) : JSON.stringify([]),
                is_destination_confirmed,
                has_specific_move_in_date,
                knows_accommodation_duration,
                has_fixed_budget,
                prefers_private_room,
                wants_fully_furnished,
                needs_utilities_included,
                prefers_near_university_or_work,
                requires_accessibility_features,
                wants_shared_kitchen_or_meal_plan,
                needs_additional_facilities,
                has_documents_ready,
                wants_student_reviews,
                wants_flexible_cancellation,
                interested_in_verified_listings
            });

            return returnHelper(res, 200, true, "Accommodation Created");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async updateAccommodation(req: RequestWithUser, res: Response) {
        try {
            const { company_name, short_description, link, images, is_destination_confirmed, has_specific_move_in_date, knows_accommodation_duration, has_fixed_budget, prefers_private_room, wants_fully_furnished, needs_utilities_included, prefers_near_university_or_work, requires_accessibility_features, wants_shared_kitchen_or_meal_plan, needs_additional_facilities, has_documents_ready, wants_student_reviews, wants_flexible_cancellation, interested_in_verified_listings, id } = req.body;

            if (!id) {
                return returnHelper(res, 200, false, "Please Provide Required params");
            }

            const updateOptions = {
                ...(company_name && { company_name }),
                ...(short_description && { short_description }),
                ...(link && { link }),
                ...(images && { images: images ? JSON.stringify(images) : JSON.stringify([]), }),
                ...(is_destination_confirmed !== undefined && { is_destination_confirmed }),
                ...(has_specific_move_in_date !== undefined && { has_specific_move_in_date }),
                ...(knows_accommodation_duration !== undefined && { knows_accommodation_duration }),
                ...(has_fixed_budget !== undefined && { has_fixed_budget }),
                ...(prefers_private_room !== undefined && { prefers_private_room }),
                ...(wants_fully_furnished !== undefined && { wants_fully_furnished }),
                ...(needs_utilities_included !== undefined && { needs_utilities_included }),
                ...(prefers_near_university_or_work !== undefined && { prefers_near_university_or_work }),
                ...(requires_accessibility_features !== undefined && { requires_accessibility_features }),
                ...(wants_shared_kitchen_or_meal_plan !== undefined && { wants_shared_kitchen_or_meal_plan }),
                ...(needs_additional_facilities !== undefined && { needs_additional_facilities }),
                ...(has_documents_ready !== undefined && { has_documents_ready }),
                ...(wants_student_reviews !== undefined && { wants_student_reviews }),
                ...(wants_flexible_cancellation !== undefined && { wants_flexible_cancellation }),
                ...(interested_in_verified_listings !== undefined && { interested_in_verified_listings })
            };

            await Accommodations.update(updateOptions, {
                where: {
                    id
                }
            });

            return returnHelper(res, 200, true, "Accommodation Updated");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async deleteAccommodation(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.body;

            if (!id) {
                return returnHelper(res, 200, false, "Please Provide Required params");
            }

            await Accommodations.destroy({
                where: {
                    id
                }
            });

            return returnHelper(res, 200, true, "Accommodation Deleted");
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async listAccommodations(req: RequestWithUser, res: Response) {
        try {
            const accommodations = await Accommodations.findAll({});
            return res.status(200).json({
                success: true,
                data: accommodations
            });
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async listAccommodationsPublic(req: RequestWithUser, res: Response) {
        try {
            const { page = 1, limit = 10, ...filters } = req.body;
            const offset = (page - 1) * limit;
    
            const whereOptions = {
                ...(filters.is_destination_confirmed !== undefined && { is_destination_confirmed: filters.is_destination_confirmed }),
                ...(filters.has_specific_move_in_date !== undefined && { has_specific_move_in_date: filters.has_specific_move_in_date }),
                ...(filters.knows_accommodation_duration !== undefined && { knows_accommodation_duration: filters.knows_accommodation_duration }),
                ...(filters.has_fixed_budget !== undefined && { has_fixed_budget: filters.has_fixed_budget }),
                ...(filters.prefers_private_room !== undefined && { prefers_private_room: filters.prefers_private_room }),
                ...(filters.wants_fully_furnished !== undefined && { wants_fully_furnished: filters.wants_fully_furnished }),
                ...(filters.needs_utilities_included !== undefined && { needs_utilities_included: filters.needs_utilities_included }),
                ...(filters.prefers_near_university_or_work !== undefined && { prefers_near_university_or_work: filters.prefers_near_university_or_work }),
                ...(filters.requires_accessibility_features !== undefined && { requires_accessibility_features: filters.requires_accessibility_features }),
                ...(filters.wants_shared_kitchen_or_meal_plan !== undefined && { wants_shared_kitchen_or_meal_plan: filters.wants_shared_kitchen_or_meal_plan }),
                ...(filters.needs_additional_facilities !== undefined && { needs_additional_facilities: filters.needs_additional_facilities }),
                ...(filters.has_documents_ready !== undefined && { has_documents_ready: filters.has_documents_ready }),
                ...(filters.wants_student_reviews !== undefined && { wants_student_reviews: filters.wants_student_reviews }),
                ...(filters.wants_flexible_cancellation !== undefined && { wants_flexible_cancellation: filters.wants_flexible_cancellation }),
                ...(filters.interested_in_verified_listings !== undefined && { interested_in_verified_listings: filters.interested_in_verified_listings })
            };
    
            const { count, rows: accommodations } = await Accommodations.findAndCountAll({
                where: whereOptions,
                attributes: [
                    "id",
                    "company_name",
                    "short_description", 
                    "images",
                    "is_destination_confirmed",
                    "has_specific_move_in_date",
                    "knows_accommodation_duration",
                    "has_fixed_budget",
                    "prefers_private_room",
                    "wants_fully_furnished",
                    "needs_utilities_included",
                    "prefers_near_university_or_work",
                    "requires_accessibility_features",
                    "wants_shared_kitchen_or_meal_plan",
                    "needs_additional_facilities",
                    "has_documents_ready",
                    "wants_student_reviews",
                    "wants_flexible_cancellation",
                    "interested_in_verified_listings"
                ],
                limit,
                offset
            });
    
            return returnHelper(res, 200, true, "Records Found", {
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                data:accommodations
            });
    
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }
    

    async requestLink(req:RequestWithUser,res:Response){
        try {  

            const {id} = req.params

            const findLink = await Accommodations.findOne({
                where: {
                    id
                },
                attributes:["link","clicks"]
            });

            if(!findLink){
                return returnHelper(res,200,false,"Accommodation Not Found")
            }

            await Accommodations.update({
                clicks: +findLink?.dataValues?.clicks + 1
            },{
                where:{
                    id
                }
            })

            return returnHelper(res,200,true,"Accommodation Link",findLink)

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        
        }}




}

export default new AccommodationsController();
