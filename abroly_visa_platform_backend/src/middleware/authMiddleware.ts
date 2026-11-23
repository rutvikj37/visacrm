import { hasModule, moduleForPath, MODULE_DISABLED } from "../services/modules"
import express from 'express'
import { NextFunction, Request, Response } from "express";
import Jwt, { DecodeOptions, JsonWebTokenError, VerifyErrors } from "jsonwebtoken";
import { IUser, RequestWithUser } from '../utils/types';
import { Op } from 'sequelize';
import User from '../model/User';
import Admin from '../model/Admin';
import Agent from '../model/Agent';
import { returnHelper } from '../helpers/returnHelper';


const secretTokenForJWT: string | any = process.env.ACCESS_TOKEN_SECRET

/** A login issued before the account's tokens_valid_after was signed out ("log out all devices" / passcode changed). */
const tokenRevoked = (decoded: any, row: any) => {
    const after = row?.dataValues?.tokens_valid_after
    if (!after || !decoded?.iat) return false
    return Number(decoded.iat) < Math.floor(new Date(after).getTime() / 1000)
}
const SIGNED_OUT = "You were signed out. Please log in again."

const validateUser = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    await commmonValidate(req, res, next, ["user"])
}

const validateAdmin = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    // console.log("ADMIN VALIDATION")
    // await commmonValidate(req, res, next, ["admin"])
    let token;
    let authHeader: string | any = req.headers.authorization || req.headers.Authorization
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Provide token" })
        try {
            const decoded: any = Jwt.verify(token, secretTokenForJWT); // Ensure correct type match
            if (!decoded || !decoded.user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            const user = decoded.user as IUser;

            const findUser = await Admin.findOne({
                where: {
                    id: user.user.id,
                    user_type: "admin"
                },
                attributes: ["uuid", "tokens_valid_after"]
            })
            // console.log(findUser,"THE USER ")
            if (findUser) {
                if(findUser?.dataValues?.uuid !== user.user.uuid){
                    return res.status(401).json({ success: false, message: 'Unauthorized' });
                }
                if (tokenRevoked(decoded, findUser)) return res.status(401).json({ success: false, message: SIGNED_OUT });
                req.user = user;
                req.uuid = user.user.uuid
                req.id = user.user.id
                next()
            }
            else {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

        } catch (error) {
            return res
                .status(401)
                .json({ success: false, message: "Auth Failed" });
        }
    } else {
        return res.status(401).json({
            success: false,
            message: "Please provide token"
        })
    }
}
const validateAdminOrManager = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    // console.log("ADMIN VALIDATION")
    await commmonValidate(req, res, next, ["admin", "manager"])
}

const validateGeneral = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    // console.log("GEN VALIDATIONS")
    await commmonValidate(req, res, next);
}
const validateAgent = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    // console.log("GEN VALIDATIONS")
    await agentValidate(req, res, next, ["agent"]);
}

const commmonValidate = async (req: RequestWithUser, res: Response, next: NextFunction, user_type: string | string[] = "all", activeSubscription: string = "general") => {
    let token;
    let authHeader: string | any = req.headers.authorization || req.headers.Authorization
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        if (!token) return res.status(401).json({ success: false, message: "Provide token" })
        try {
            const decoded: any = Jwt.verify(token, secretTokenForJWT); // Ensure correct type match
            if (!decoded || !decoded.user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            const user = decoded.user as IUser;

            const findUser = await User.findOne({
                where: user_type == "all" ? {
                    id: user.user.id,
                } : {
                    id: user.user.id,
                    user_type: user_type
                },
                attributes: ["uuid", "tokens_valid_after"]
            })
            // console.log(findUser,"THE USER ")
            if (findUser) {
                if(findUser?.dataValues?.uuid !== user.user.uuid){
                    return res.status(401).json({ success: false, message: 'Unauthorized' });
                }
                if (tokenRevoked(decoded, findUser)) return res.status(401).json({ success: false, message: SIGNED_OUT });
                req.user = user;
                req.uuid = user.user.uuid
                req.id = user.user.id
                next()
            }
            else {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }



        } catch (error) {
            console.log(error, "ERRPR");
            return res
                .status(401)
                .json({ success: false, message: "Auth Failed" });
        }
    } else {
        return res.status(401).json({
            success: false,
            message: "Please provide token"
        })
    }
}
/**
 * Agency usage (SaaS admin -> Usage & health): remember when each agency user was last active.
 * At most one write per user every 10 minutes per worker, never blocks the request.
 */
const ACTIVE_WRITE_MS = 10 * 60 * 1000
const lastTouched = new Map<number, number>()
const touchLastActive = (id: number) => {
    if (!id) return
    const now = Date.now()
    if (now - (lastTouched.get(id) || 0) < ACTIVE_WRITE_MS) return
    lastTouched.set(id, now)
    Agent.update({ last_active_at: new Date(now) }, { where: { id }, silent: true } as any).catch(() => { })
}

const agentValidate = async (req: RequestWithUser, res: Response, next: NextFunction, user_type: string | string[] = "all", activeSubscription: string = "general") => {
    let token;
    // console.warn(req.headers, "HEADERS")
    let authHeader: string | any = req.headers.authorization || req.headers.Authorization
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        // console.log(token,"TOKEN");

        if (!token) return res.status(401).json({ success: false, message: "Provide token" })
        try {
            const decoded: any = Jwt.verify(token, secretTokenForJWT); // Ensure correct type match
            if (!decoded || !decoded.user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const user = decoded.user as IUser;

            const findUser = await Agent.findOne({
                where: {
                    id: user.user.id,
                    status: "active"
                },
                attributes: ["uuid", "parent_id", "role", "expires_at", "team_role", "branch_id", "tokens_valid_after"]
            })
            if (findUser) {
                
                if(findUser?.dataValues?.uuid !== user.user.uuid){
                    return res.status(401).json({ success: false, message: 'Unauthorized' });
                }
                if (tokenRevoked(decoded, findUser)) return res.status(401).json({ success: false, message: SIGNED_OUT });
                touchLastActive(user.user.id)

                // console.warn(findUser?.dataValues?.expires_at, new Date(), "EXPIRES AT")
                //         console.warn(new Date(findUser?.dataValues?.expires_at) < new Date(), "EXPIRES AT")

               
                // SaaS access: team members follow their agency's subscription
                let agencyExpiresAt = findUser?.dataValues?.expires_at
                if (findUser?.dataValues?.role !== "agent") {

                    const findParentAgent = await Agent.findOne({
                        where: {
                            id: findUser?.dataValues?.parent_id,
                        },
                        attributes: ["uuid", "status", "expires_at"]
                    })

                    if (!findParentAgent) {
                        return returnHelper(res, 401, false, "Profile Not Found")
                    }

                    if (findParentAgent && findParentAgent?.dataValues?.status !== "active") {
                        return returnHelper(res, 401, false, "Your Organization Profile Inactive, Please contact Administrator for futher action")
                    }
                    agencyExpiresAt = findParentAgent?.dataValues?.expires_at
                }

                const subscriptionExpired = !agencyExpiresAt || new Date(agencyExpiresAt) < new Date()
                if (subscriptionExpired) {
                    // the app must still load (kyc) so it can show the "renew" screen;
                    // the owner may also open the subscription / payment endpoints
                    const url = (req.originalUrl || "").split("?")[0]
                    const alwaysAllowed = url.startsWith("/api/v1/agent/kyc")
                    const ownerAllowed = findUser?.dataValues?.role === "agent" && url.startsWith("/api/v1/crm/subscription")
                    if (!alwaysAllowed && !ownerAllowed) {
                        return res.status(402).json({
                            success: false,
                            code: "SUBSCRIPTION_EXPIRED",
                            message: findUser?.dataValues?.role === "agent"
                                ? "Your subscription has ended. Please renew to continue."
                                : "Your agency's subscription has ended. Please ask your agency owner to renew."
                        })
                    }
                    (req as any).subscriptionExpired = true
                }

                // team role and branch (see helpers/access.ts)
                const inner: any = user.user
                if (findUser?.dataValues?.role !== "agent") {
                    const teamRole = findUser?.dataValues?.team_role || "counsellor"
                    const branchId = findUser?.dataValues?.branch_id || null
                    inner.team_role = teamRole
                    inner.branch_id = branchId
                    if (teamRole === "branch_manager" || teamRole === "documents" || teamRole === "operations") {
                        if (branchId) {
                            const members: any[] = await Agent.findAll({
                                where: { parent_id: findUser?.dataValues?.parent_id, branch_id: branchId },
                                attributes: ["id"],
                                raw: true,
                            })
                            inner.visible_member_ids = [...new Set([user.user.id, ...members.map((m) => m.id)])]
                        } else {
                            inner.sees_all = true
                        }
                    }
                    // accounts can look but not change leads and cases
                    if (teamRole === "accounts" && req.method !== "GET") {
                        const url = (req.originalUrl || "").split("?")[0]
                        if (/^\/api\/v1\/(crm\/(leads|cases|universities)|leads|sub_agent)(\/|$)/.test(url)) {
                            return returnHelper(res, 200, false, "Your role (Accounts) can view leads and cases but not change them")
                        }
                    }
                }

                // module switched off for this agency (Super Admin → CRM type / modules)
                const neededModule = moduleForPath(req.originalUrl || "")
                if (neededModule && inner.agent_uuid && !(await hasModule(inner.agent_uuid, neededModule))) {
                    return res.status(403).json({ ...MODULE_DISABLED })
                }

                req.user = user;
                req.uuid = user.user.uuid
                req.id = user.user.id
                next()
            }
            else {
                const inactiveAgent = await Agent.findOne({
                    where: {
                        id: user.user.id,
                        status: "inactive"
                    },
                    attributes: ["uuid"]
                })

                if (inactiveAgent) {
                    return returnHelper(res, 401, false, "Profile Inactive From Admin, Please contact Administrator for this website")
                } else {
                    return res.status(401).json({ success: false, message: 'Unauthorized' });
                }
            }

        } catch (error) {
            return res
                .status(401)
                .json({ success: false, message: "Auth Failed" });
        }
    } else {
        return res.status(401).json({
            success: false,
            message: "Please provide token"
        })
    }
}




export { validateUser, validateAdmin, validateGeneral, validateAdminOrManager, validateAgent }