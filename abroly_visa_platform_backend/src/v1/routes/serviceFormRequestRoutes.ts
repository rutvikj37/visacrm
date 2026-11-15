import express from 'express';
import { requireAddon } from "../../services/saas"
import ServiceFormsRequestController from '../controller/ServiceFormsRequestController';
import { validateAgent } from '../../middleware/authMiddleware';

const serviceFormRequestRoutes = express.Router();

// Add request 
serviceFormRequestRoutes.route("/add").post(ServiceFormsRequestController.addServiceFormRequest)
// Get request 
serviceFormRequestRoutes.route("/list").post(validateAgent,requireAddon("service_requests"),ServiceFormsRequestController.listServiceFormRequests)
// Update Status of request 
serviceFormRequestRoutes.route("/update_status").post(validateAgent,requireAddon("service_requests"),ServiceFormsRequestController.updateStatusOfRequest)

export default serviceFormRequestRoutes;