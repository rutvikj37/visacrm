import { Router } from "express";
import { requireAddon } from "../../services/saas"
import EventBannerController from "../controller/EventBannerController";
import { validateAdmin, validateAgent } from "../../middleware/authMiddleware";
import { uploadMedia } from "../../middleware/fileUpload";

const eventBannerRoutes = Router();

// Admin only route to create event banner
eventBannerRoutes.post("/public-create", validateAdmin,uploadMedia.any(), EventBannerController.createEventBanner);
eventBannerRoutes.post("/public-update", validateAdmin,uploadMedia.any(), EventBannerController.updateEventBanner);
eventBannerRoutes.post("/public-delete-event/:uuid", validateAdmin,EventBannerController.deleteEventBanner);
eventBannerRoutes.get("/public-get/:id", validateAdmin,EventBannerController.getEventBannerById);
eventBannerRoutes.post("/public-delete/:uuid", validateAdmin,EventBannerController.deleteEventBannerImage);
eventBannerRoutes.get("/public-list", validateAdmin,EventBannerController.listEventBanners);
eventBannerRoutes.post("/public-response",EventBannerController.createEventBannerResponse);
eventBannerRoutes.get("/public-response-list/:event_id",validateAdmin, EventBannerController.listEventBannerResponses);
eventBannerRoutes.get("/public-active-events", EventBannerController.getActiveEvents);

const eventBannersAgentRoutes = Router();

// Add agent event banner (with multiple images)
eventBannersAgentRoutes.route('/add').post(validateAdmin,uploadMedia.array('images', 5), EventBannerController.createAgentEventBanner);

// Delete agent banner event (with images)
eventBannersAgentRoutes.route('/delete/:id').post(validateAdmin, EventBannerController.deleteAgentEventBanner);

// delete single event banner image
eventBannersAgentRoutes.route('/delete-image/:id').get(validateAdmin,EventBannerController.deleteAgentEventBannerImage);

// Update agent banner event
eventBannersAgentRoutes.route('/update/:id').put(validateAdmin, uploadMedia.array('images', 5), EventBannerController.updateAgentEventBanner);

// admin side listing
eventBannersAgentRoutes.route('/list').get(validateAdmin, EventBannerController.listAgentEventBanners);

// get agent event banner by id
eventBannersAgentRoutes.route('/get/:id').get(validateAdmin, EventBannerController.getAgentEventBannerById);

// Get active events
eventBannersAgentRoutes.route('/active').get(validateAgent,requireAddon("event_banners"), EventBannerController.getAgentActiveEvent);

// Express interest in an event
eventBannersAgentRoutes.route('/interest/:bannerId').post(validateAgent,requireAddon("event_banners"), EventBannerController.expressInterest);

// List agents interested in an event
eventBannersAgentRoutes.route('/interest/list/:bannerId').get(validateAdmin,EventBannerController.listInterestedAgents);

eventBannerRoutes.use("/agent", eventBannersAgentRoutes);

export default eventBannerRoutes; 