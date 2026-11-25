import express from "express";
import multer from "multer";
import ClientFormController from "../controller/ClientFormController";

/** Public custom forms (no login): /api/v1/public/forms/... */
const publicFormsRoutes = express.Router();

const formUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 20, fields: 100 },
}).any();

publicFormsRoutes.route("/:token").get(ClientFormController.publicGet);
publicFormsRoutes.route("/:token").post(formUpload, ClientFormController.publicSubmit);

export default publicFormsRoutes;
