import { Request } from "express";
import multer, { Multer } from "multer";

// for upload files
const storagePdfAndImage = multer.memoryStorage();

const uploadVideosAndImage = multer({
    storage: storagePdfAndImage,
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // console.log(file);
        const allowedMimeTypes = new Set([
            "image/png",
            "image/jpg",
            "image/jpeg",
            "application/octet-stream",
            "video/mp4",
            "video/avi",
            "video/mpeg",
            "video/quicktime",
        ]);

        if (allowedMimeTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            console.log(file.mimetype, "file.mimetype");
            cb(new Error("invalid image or video format!"));
        }
    },
});

const uploadImage = multer({
    storage: storagePdfAndImage,
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        console.log(file);
        const allowedMimeTypes = new Set([
            "image/png",
            "image/jpg",
            "image/jpeg",
            "application/octet-stream",
        ]);

        if (allowedMimeTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);
            cb(new Error("invalid image format!"));
        }
    },
});
const uploadMedia = multer({
    storage: storagePdfAndImage,
    limits: {
        fileSize: 50 * 1024 * 1024, // Limit file size to 50MB
    },
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        // console.log(file);
        const allowedMimeTypes = new Set([
            "image/png",
            "image/jpg",
            "image/jpeg",
            "application/octet-stream",
            // pdf
            "application/pdf",
            // videos
            "video/mp4",
            "video/avi",
            "video/mpeg",
            "video/quicktime"
        ]);

        if (allowedMimeTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);
            cb(new Error("invalid image format!"));
        }
    },
});

// CSV / Excel lead import (checked by extension - browsers send many different mime types for CSV)
const uploadLeadFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const name = (file.originalname || "").toLowerCase();
        if (name.endsWith(".csv") || name.endsWith(".xlsx")) {
            cb(null, true);
        } else {
            cb(new Error("Please upload a .csv or .xlsx file"));
        }
    },
});

export { uploadVideosAndImage, uploadImage, uploadMedia, uploadLeadFile }