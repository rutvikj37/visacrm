import { NextFunction, Request, Response } from "express";

/** True only on a developer machine (ISLOCAL=yes in .env). Never set it on a server. */
export const isLocalDev = () => process.env.ISLOCAL === "yes";

/**
 * Local-testing login routes (*_custom: OTP printed to the console, fixed test OTPs) exist only in
 * local development. On a server they answer 404, so nobody can log in through them.
 */
export const localOnly = (_req: Request, res: Response, next: NextFunction) => {
    if (isLocalDev()) return next();
    return res.status(404).json({ success: false, message: "Not found" });
};
