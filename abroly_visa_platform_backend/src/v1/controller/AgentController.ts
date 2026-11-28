import { audit } from "../../services/audit";
import { newTotpSecret, totpUri, verifyTotp } from "../../helpers/totp";
import { decryptPii, encryptPii } from "../../helpers/crypto";
import { hasModule, labelsFor, modulesFor } from "../../services/modules";
import { businessFocusOf, hideCommissionsOf, hideTravelDocumentsOf, hideUniversitiesOf } from "../../services/businessFocus";
import { publicFileUrl, saveFile, deleteFile, ownerFromRequest, agencyOwner } from "../../helpers/storage";
import { Request, Response } from "express";
import { getAgencyAccess } from "../../services/saas";
import {
    checkAgentResetCode,
    checkLoginCode,
    issueAgentResetCode,
    issueSetupToken,
    loginCodePrompt,
    sendPasscodeResetEmail,
    setAgentPasscode,
    usesLoginCode,
    validatePasscodeShape,
    verifySetupToken,
} from "../../services/agencyLogin";
import { agencyByPortalHost, sharedPanel } from "../../services/panelUrl";
import { agentPhoneWhere } from "../../services/phoneMatch";
import { isLocalDev } from "../../middleware/localOnly";
import Agent from "../../model/Agent";
import { returnHelper } from "../../helpers/returnHelper";
import Jwt from "jsonwebtoken";
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import axios from "axios";
import { RequestWithUser } from "../../utils/types";
import { Op } from "sequelize";
import User from "../../model/User";
import path from 'path';
import fs from 'fs';

dotenv.config()



const CUSTOMERID: string | any = process.env.SMSCUSTOMERID
const EMAIL_ID:string = process.env.SMS_EMAIL_ID
const KEY_SMS:string = process.env.SMS_KEY


const secretTokenForJWT: string | any = process.env.ACCESS_TOKEN_SECRET

// Test numbers configuration
// test numbers work only in local development (ISLOCAL=yes) - on a server they would be a back door
const TEST_NUMBERS_NO_OTP = isLocalDev() ? ["9799999999", "9799999998"] : []; // Bypass OTP completely
const TEST_NUMBERS_OTP_1111 = isLocalDev() ? ["9799999999", "9799999998"] : []; // Accept OTP "1111"
const TEST_NUMBERS_SKIP_GENERATION = [...TEST_NUMBERS_NO_OTP, ...TEST_NUMBERS_OTP_1111]; // Skip OTP generation in loginWithNumber

/** Logging in at <agency address>/agency: only that agency's owner and team may log in there. */
const wrongAgencyMessage = async (user: any, agencyHost: unknown) => {
    if (!agencyHost) return null;
    const agency: any = await agencyByPortalHost(String(agencyHost));
    if (!agency) return null; // shared panel (crm.techxsolutions.io) or unknown address: no restriction
    const u = user.dataValues;
    const userAgency = u.role === "agent" ? u.uuid : u.parent_uuid;
    return userAgency === agency.uuid ? null : `This mobile number is not part of ${agency.app_name || agency.username}. Please log in at your own agency's address.`;
};

/** Token + profile response for a successful agency login (same shape as the OTP flows). */
const agentLoginSuccess = async (res: Response, user: any, opts: { totpPassed?: boolean } = {}) => {
    const u = user.dataValues;
    // owners with two-step login: one more screen for the authenticator code before the session is issued
    if (!opts.totpPassed && u.role === "agent") {
        const fresh: any = await Agent.findByPk(u.id, { attributes: ["totp_enabled"], raw: true });
        if (fresh?.totp_enabled) {
            const totp_token = Jwt.sign({ purpose: "totp", id: u.id, uuid: u.uuid }, secretTokenForJWT, { expiresIn: "10m" });
            return res.status(200).json({ success: true, message: "Enter the 6-digit code from your authenticator app.", data: { must_totp: true, totp_token, name: u.username, phone: u.phone_number, country_code: u.country_code } });
        }
    }
    const accessToken = Jwt.sign({
        user: {
            user: {
                uuid: u.uuid, role: u.role, id: u.id,
                agent_uuid: u.role == "agent" ? u.uuid : u.parent_uuid,
                agent_id: u.role == "agent" ? u.id : u.parent_id,
            },
        },
    }, secretTokenForJWT, { expiresIn: "90d" });
    const isFirstTime = u.is_verified == 0;
    await Agent.update({ is_verified: 1 }, { where: { uuid: u.uuid } });
    return res.status(200).json({
        success: true,
        message: "Login Success",
        data: { token: accessToken, name: u.username, phone: u.phone_number, country_code: u.country_code, isFirstTime },
    });
};

/** Older SMS-OTP paths sign their own token: send owners with two-step login to the code screen first. */
const totpGate = async (res: Response, user: any) => {
    const u = user?.dataValues;
    if (!u || u.role !== "agent") return null;
    const fresh: any = await Agent.findByPk(u.id, { attributes: ["totp_enabled"], raw: true });
    if (!fresh?.totp_enabled) return null;
    const totp_token = Jwt.sign({ purpose: "totp", id: u.id, uuid: u.uuid }, secretTokenForJWT, { expiresIn: "10m" });
    return res.status(200).json({ success: true, message: "Enter the 6-digit code from your authenticator app.", data: { must_totp: true, totp_token, name: u.username, phone: u.phone_number, country_code: u.country_code } });
};

/** Agency owners / team: invite code or personal passcode instead of SMS OTP. */
const tryLoginCode = async (res: Response, user: any, otp: unknown) => {
    const pin = await checkLoginCode(user.dataValues.id, otp);
    if (!pin.applies) return null;
    if (user.dataValues.status !== "active") return returnHelper(res, 200, false, "You're Profile deactivated from admin, please contact admin");
    if (!pin.ok) return returnHelper(res, 200, false, pin.message);
    // team members: same rules as the OTP login - their agency must be active and paid up
    if (user.dataValues.role !== "agent") {
        const parent: any = await Agent.findOne({ where: { id: user.dataValues.parent_id }, attributes: ["expires_at", "status"] });
        if (!parent || parent.dataValues.status !== "active") return returnHelper(res, 200, false, "Your agency account is inactive. Please contact your agency owner.");
        if (!parent.dataValues.expires_at || new Date(parent.dataValues.expires_at) < new Date()) {
            return returnHelper(res, 200, false, "Your agency's subscription has ended. Please ask your agency owner to renew.");
        }
    }
    // first login with invite code: force set personal passcode before issuing a session JWT
    if (!pin.passcodeSet) {
        const u = user.dataValues;
        const setup_token = issueSetupToken({ audience: "agent", id: u.id, uuid: u.uuid });
        return res.status(200).json({
            success: true,
            message: "Set a passcode to finish signing in.",
            data: {
                must_set_passcode: true,
                setup_token,
                name: u.username,
                phone: u.phone_number,
                country_code: u.country_code,
            },
        });
    }
    return agentLoginSuccess(res, user);
};

const findActiveAgentByPhone = async (phone_number: string, country_code: string) =>
    Agent.findOne({ where: agentPhoneWhere(phone_number, country_code, { status: "active" }) });

const findAgentByPhone = async (phone_number: string, country_code: string, extra: Record<string, unknown> = {}) =>
    Agent.findOne({ where: agentPhoneWhere(phone_number, country_code, extra) });

class AgentController {
    /** POST /agent/verify_totp { totp_token, code } - second step of the owner login. */
    async verifyTotpLogin(req: Request, res: Response) {
        try {
            let decoded: any = null;
            try { decoded = Jwt.verify(String(req.body?.totp_token || ""), secretTokenForJWT); } catch { decoded = null; }
            if (decoded?.purpose !== "totp") return returnHelper(res, 200, false, "Your login session expired. Please log in again.");
            const user: any = await Agent.findOne({ where: { id: decoded.id, uuid: decoded.uuid, status: "active" } });
            if (!user?.dataValues.totp_enabled) return returnHelper(res, 200, false, "Please log in again.");
            const secret = decryptPii(user.dataValues.totp_secret_enc);
            if (!secret || !verifyTotp(secret, req.body?.code)) return returnHelper(res, 200, false, "That code is not right. Check the time on your phone and try the newest code.");
            return agentLoginSuccess(res, user, { totpPassed: true });
        } catch (error: any) {
            return returnHelper(res, 200, false, "Could not verify the code. Please try again.");
        }
    }

    /** GET /crm/security/totp - is two-step login on for me (owner)? */
    async totpStatus(req: RequestWithUser, res: Response) {
        const u: any = await Agent.findByPk((req.user?.user as any)?.id, { attributes: ["role", "totp_enabled"], raw: true });
        return returnHelper(res, 200, true, "Two-step login", { enabled: Boolean(u?.totp_enabled), available: u?.role === "agent" });
    }

    /** POST /crm/security/totp/setup - new secret to scan; not active until /enable confirms a code. */
    async totpSetup(req: RequestWithUser, res: Response) {
        const u: any = await Agent.findByPk((req.user?.user as any)?.id, { attributes: ["id", "role", "totp_enabled", "phone_number", "email", "app_name"] });
        if (!u || u.dataValues.role !== "agent") return returnHelper(res, 200, false, "Two-step login is for the agency owner");
        if (u.dataValues.totp_enabled) return returnHelper(res, 200, false, "Two-step login is already on. Turn it off first to set up a new phone.");
        const secret = newTotpSecret();
        await Agent.update({ totp_secret_enc: encryptPii(secret) }, { where: { id: u.dataValues.id } });
        return returnHelper(res, 200, true, "Scan this in your authenticator app", { secret, uri: totpUri(secret, u.dataValues.email || u.dataValues.phone_number || "owner") });
    }

    /** POST /crm/security/totp/enable { code } */
    async totpEnable(req: RequestWithUser, res: Response) {
        const u: any = await Agent.findByPk((req.user?.user as any)?.id, { attributes: ["id", "role", "totp_secret_enc", "parent_uuid", "uuid"] });
        if (!u || u.dataValues.role !== "agent") return returnHelper(res, 200, false, "Two-step login is for the agency owner");
        const secret = decryptPii(u.dataValues.totp_secret_enc);
        if (!secret) return returnHelper(res, 200, false, "Start the setup again");
        if (!verifyTotp(secret, req.body?.code)) return returnHelper(res, 200, false, "That code is not right. Try the newest code from the app.");
        await Agent.update({ totp_enabled: true }, { where: { id: u.dataValues.id } });
        audit(req as any, { entity: "settings", action: "totp_on", summary: "Owner turned on two-step login" });
        return returnHelper(res, 200, true, "Two-step login is on");
    }

    /** POST /crm/security/totp/disable { code } */
    async totpDisable(req: RequestWithUser, res: Response) {
        const u: any = await Agent.findByPk((req.user?.user as any)?.id, { attributes: ["id", "role", "totp_secret_enc", "totp_enabled"] });
        if (!u?.dataValues.totp_enabled) return returnHelper(res, 200, false, "Two-step login is not on");
        const secret = decryptPii(u.dataValues.totp_secret_enc);
        if (!secret || !verifyTotp(secret, req.body?.code)) return returnHelper(res, 200, false, "Enter the current code from your authenticator app to turn it off");
        await Agent.update({ totp_enabled: false, totp_secret_enc: null }, { where: { id: u.dataValues.id } });
        audit(req as any, { entity: "settings", action: "totp_off", summary: "Owner turned off two-step login" });
        return returnHelper(res, 200, true, "Two-step login is off");
    }

    async validateOTP(req: Request, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                otp,
                device_token,
                device_id,
                device_model,
                verificationId
            } = req.body

            const user = await findAgentByPhone(phone_number, country_code)

            if (user) {
                const wrongAgency = await wrongAgencyMessage(user, req.body?.agency_host)
                if (wrongAgency) return returnHelper(res, 200, false, wrongAgency)
                const viaCode = await tryLoginCode(res, user, otp)
                if (viaCode) return viaCode
                // console.log("HERE FIND USER");

                if (TEST_NUMBERS_NO_OTP.includes(phone_number)) {
                    const sendTokenData = {
                        user: {
                            uuid: user?.dataValues?.uuid,
                            role: user?.dataValues?.role,
                            id:user?.dataValues?.id,
                            agent_uuid: user?.dataValues?.role == "agent" ? user?.dataValues?.uuid :  user?.dataValues?.parent_uuid,
                            agent_id:user?.dataValues?.role =="agent" ? user?.dataValues?.id :  user?.dataValues?.parent_id
                        },
                    };

                    { const gate = await totpGate(res, user); if (gate) return gate; }

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await Agent.update({
                        // otp: "",
                        // otp_expire: "",
                        is_verified: 1
                    }, {
                        where: {
                            uuid: user.dataValues.uuid
                        }
                    })

                    return res.status(200).json({
                        success: true,
                        message: "Login Success",
                        data: {
                            token: accessToken,
                            name: user.dataValues.username,
                            phone: user.dataValues.phone_number,
                            country_code: user.dataValues.country_code,
                            isFirstTime
                        }
                    })
                }

                // Test numbers that accept OTP "1111"
                if (TEST_NUMBERS_OTP_1111.includes(phone_number)) {
                    if (otp == "1111") {
                        const sendTokenData = {
                            user: {
                                uuid: user?.dataValues?.uuid,
                                role: user?.dataValues?.role,
                                id:user?.dataValues?.id,
                                agent_uuid: user?.dataValues?.role == "agent" ? user?.dataValues?.uuid :  user?.dataValues?.parent_uuid,
                                agent_id:user?.dataValues?.role =="agent" ? user?.dataValues?.id :  user?.dataValues?.parent_id
                            },
                        };

                        { const gate = await totpGate(res, user); if (gate) return gate; }

                        const accessToken = Jwt.sign({
                            user: sendTokenData
                        }, secretTokenForJWT, { expiresIn: "90d" });

                        let isFirstTime = false
                        if (user.dataValues.is_verified == 0) {
                            isFirstTime = true
                        }

                        await Agent.update({
                            is_verified: 1
                        }, {
                            where: {
                                uuid: user.dataValues.uuid
                            }
                        })

                        return res.status(200).json({
                            success: true,
                            message: "Login Success",
                            data: {
                                token: accessToken,
                                name: user.dataValues.username,
                                phone: user.dataValues.phone_number,
                                country_code: user.dataValues.country_code,
                                isFirstTime
                            }
                        })
                    } else {
                        return res.status(200).json({
                            success: false,
                            message: "Invalid OTP!"
                        })
                    }
                }

                axios.get(
                    `https://cpaas.messagecentral.com/auth/v1/authentication/token?country=IN&customerId=${CUSTOMERID}&email=${EMAIL_ID}&key=${KEY_SMS}&scope=NEW`,).then(async (tokenResponse) => {
                        // console.log(tokenResponse, "tokenResponse---------------/n")
                        if (tokenResponse.status == 200 && tokenResponse.data.status == '200') {

                            await axios.get(
                                `https://cpaas.messagecentral.com/verification/v3/validateOtp?countryCode=91&mobileNumber=${phone_number}&verificationId=${verificationId}&customerId=${CUSTOMERID}&code=${otp}`, {
                                headers: {
                                    'authToken': tokenResponse.data.token
                                }
                            }
                            )
                                .then(async (otpResponse) => {

                                    // console.log(otpResponse, "THE VALIDATE RESPONSE")
                                    if (otpResponse.data.responseCode == 200) {

                                        // if otp is validate than only go for further flow

                                        const sendTokenData = {
                                            user: {
                                                uuid: user.dataValues.uuid,
                                                role: user.dataValues.role,
                                                id:user?.dataValues?.id,
                                                agent_uuid: user?.dataValues?.role =="agent" ? user?.dataValues?.uuid :  user?.dataValues?.parent_uuid,
                                                agent_id:user?.dataValues?.role == "agent" ? user?.dataValues?.id :  user?.dataValues?.parent_id
                                            },
                                        };

                                        { const gate = await totpGate(res, user); if (gate) return gate; }

                                        const accessToken = Jwt.sign({
                                            user: sendTokenData
                                        }, secretTokenForJWT, { expiresIn: "90d" });
                                        // console.log(user, "FIND USER");

                                        let isFirstTime = false
                                        if (user.dataValues.is_verified == 0) {
                                            isFirstTime = true
                                        }

                                        await Agent.update({
                                            // otp: "",
                                            // otp_expire: "",
                                            is_verified: 1
                                        }, {
                                            where: {
                                                uuid: user.dataValues.uuid
                                            }
                                        })

                                        return res.status(200).json({
                                            success: true,
                                            message: "Login Success",
                                            data: {
                                                token: accessToken,
                                                name: user.dataValues.username,
                                                phone: user.dataValues.phone_number,
                                                country_code: user.dataValues.country_code,
                                            }
                                        })

                                    }
                                    else if (otpResponse.data.responseCode == 702) {
                                        return res.status(200).json({
                                            success: false,
                                            message: "Invalid OTP!"
                                        })
                                    } else {
                                        return res.status(200).json({
                                            success: false,
                                            message: "OTP verification failed!"
                                        })
                                    }

                                })
                        }
                    }).catch((error: any) => {
                        console.error(error.message);

                        return res.status(200).json({
                            success: false,
                            message: "Failed to verify OTP!"
                        })
                    })

            } else {
                return res.status(401).json({
                    success: false,
                    message: "Invalid Request!"
                })
            }

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async validateOTPCustom(req: Request, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                otp,
                device_token,
                device_id,
                device_model
            } = req.body

            const user = await findAgentByPhone(phone_number, country_code)

            if (user) {
                const wrongAgency = await wrongAgencyMessage(user, req.body?.agency_host)
                if (wrongAgency) return returnHelper(res, 200, false, wrongAgency)
                const viaCode = await tryLoginCode(res, user, otp)
                if (viaCode) return viaCode
            }

            if (user && user.dataValues.otp && (await bcrypt.compare(String(otp), user.dataValues.otp))) {


                if (new Date() > new Date(user.dataValues.otp_expire)) {
                    return res.status(200).json({
                        success: false,
                        message: "The OTP has expired!"
                    })
                } else {

                    const sendTokenData = {
                        user: {
                            uuid: user.dataValues.uuid,
                            role: user.dataValues.role,
                            id:user?.dataValues?.id,
                            agent_uuid: user?.dataValues?.role == "agent" ? user?.dataValues?.uuid :  user?.dataValues?.parent_uuid,
                            agent_id:user?.dataValues?.role =="agent" ? user?.dataValues?.id :  user?.dataValues?.parent_id
                        },
                    };

                    { const gate = await totpGate(res, user); if (gate) return gate; }

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await Agent.update({
                        // otp: "",
                        // otp_expire: "",
                        is_verified: 1
                    }, {
                        where: {
                            uuid: user?.dataValues?.uuid
                        }
                    })

                    return res.status(200).json({
                        success: true,
                        message: "Login Success",
                        data: {
                            token: accessToken,
                            name: user?.dataValues?.username,
                            phone: user?.dataValues?.phone_number,
                            country_code: user?.dataValues?.country_code,
                        }
                    })
                }
            } else {
                return res.status(200).json({
                    success: false,
                    message: "invalid OTP!"
                })
            }

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }
    async loginWithNumber(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await findActiveAgentByPhone(phone_number, country_code)

            if (findUser) {
                const wrongAgency = await wrongAgencyMessage(findUser, req.body?.agency_host)
                if (wrongAgency) return returnHelper(res, 200, false, wrongAgency)

                // Find User is agent 
                // SaaS: an agency owner can always log in (an expired account only sees the renew screen);
                // team members can not log in while their agency's subscription has ended
                if (findUser.dataValues.role !== "agent") {
                    const parentAgency: any = await Agent.findOne({ where: { id: findUser.dataValues.parent_id }, attributes: ["expires_at", "status"] })
                    if (!parentAgency || parentAgency.dataValues.status !== "active") {
                        return returnHelper(res, 200, false, "Your agency account is inactive. Please contact your agency owner.")
                    }
                    if (!parentAgency.dataValues.expires_at || new Date(parentAgency.dataValues.expires_at) < new Date()) {
                        return returnHelper(res, 200, false, "Your agency's subscription has ended. Please ask your agency owner to renew.")
                    }
                }

                if (await usesLoginCode(findUser.dataValues.id)) {
                    const prompt = await loginCodePrompt("agent", findUser.dataValues.id);
                    return returnHelper(res, 200, true, prompt.message, prompt.marker);
                }

                if (TEST_NUMBERS_SKIP_GENERATION.includes(phone_number)) {
                    // return res.status(200).json({
                    //     success: true,
                    //     message: "OTP has been sent successfully.",
                    //    1
                    // })
                    return returnHelper(res,200,true,"OTP has been sent successfully.", "DEMOID123")
                }

                //  generate token 
                axios.get(
                    `https://cpaas.messagecentral.com/auth/v1/authentication/token?country=IN&customerId=${CUSTOMERID}&email=${EMAIL_ID}&key=${KEY_SMS}&scope=NEW`,).then(async (tokenResponse) => {
                        // console.log(tokenResponse, "tokenResponse---------------/n")
                        if (tokenResponse.status == 200 && tokenResponse.data.status == '200') {
                            axios.post(
                                `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=${CUSTOMERID}&flowType=SMS&mobileNumber=${phone_number}`,
                                {},
                                {
                                    headers: {
                                        'authToken': tokenResponse.data.token
                                    }
                                }).then((response) => {
                                    // console.log(response, "RESPONSE---------\n")
                                    if (response.status == 200) {
                                        // return res.status(200).json({
                                        //     success: true,
                                        //     message: "OTP has been sent successfully.",
                                        //     verificationId: response.data.data.verificationId
                                        // })
                                        return returnHelper(res,200,true, "OTP has been sent successfully.", response?.data?.data?.verificationId)
                                    } else {
                                        return res.status(200).json({
                                            success: false,
                                            message: "Failed to send otp, Please try again after some time"
                                        })
                                    }
                                })
                                .catch((error) => {
                                    return res.status(200).json({
                                        success: false,
                                        message: "Failed to send otp, Please try again after some time"
                                    })
                                })
                        } else {
                            return res.status(200).json({
                                success: false,
                                message: "Failed to send otp, Please try again after some time"
                            })
                        }

                    })
            }
            else {

                const isInActiveAgent = await findAgentByPhone(phone_number, country_code, { status: "inactive" })

                if(isInActiveAgent){
                    return returnHelper(res,200,false,"You're Profile deactivated from admin, please contact admin")
                }else{
                    return res.status(200).json({
                        success: false,
                        message: "Phone number not registered YET!"
                    })
                }

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }
    async loginWithNumberCustom(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await findActiveAgentByPhone(phone_number, country_code)


            if (findUser) {
                const wrongAgency = await wrongAgencyMessage(findUser, req.body?.agency_host)
                if (wrongAgency) return returnHelper(res, 200, false, wrongAgency)

                // SaaS: an agency owner can always log in (an expired account only sees the renew screen);
                // team members can not log in while their agency's subscription has ended
                if (findUser.dataValues.role !== "agent") {
                    const parentAgency: any = await Agent.findOne({ where: { id: findUser.dataValues.parent_id }, attributes: ["expires_at", "status"] })
                    if (!parentAgency || parentAgency.dataValues.status !== "active") {
                        return returnHelper(res, 200, false, "Your agency account is inactive. Please contact your agency owner.")
                    }
                    if (!parentAgency.dataValues.expires_at || new Date(parentAgency.dataValues.expires_at) < new Date()) {
                        return returnHelper(res, 200, false, "Your agency's subscription has ended. Please ask your agency owner to renew.")
                    }
                }
                if (await usesLoginCode(findUser.dataValues.id)) {
                    const prompt = await loginCodePrompt("agent", findUser.dataValues.id);
                    return returnHelper(res, 200, true, prompt.message, prompt.marker);
                }

                function generateOTP() {
                    const otp = Math.floor(1000 + Math.random() * 9000);
                    return otp;
                }

                const createotp = generateOTP()


                const otp = await bcrypt.hash(createotp + "", 10)

                function generateExpiryTime() {
                    // Get the current time
                    const currentTime = new Date();

                    // Add 5 minutes to the current time to get the expiration time
                    const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                    return expiryTime;
                }

                const otp_expire = generateExpiryTime()

                await Agent.update({
                    otp,
                    otp_expire
                }, {
                    where: {
                        uuid: findUser.dataValues.uuid
                    }
                })
                // otp: otp,
                // otp_expire
                return res.status(200).json({
                    success: true,
                    message: "OTP has been sent successfully.",

                })
            }
            else {

                // find if status is inactive
                const isInActiveAgent = await findAgentByPhone(phone_number, country_code, { status: "inactive" })

                if(isInActiveAgent){
                    return returnHelper(res,200,false,"You're Profile deactivated from admin, please contact admin")
                }else{
                    return res.status(200).json({
                        success: false,
                        message: "Phone number not registered YET!"
                    })
                }

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    /** POST /agent/request_passcode_reset — email a short-lived reset code (not an SMS OTP). */
    async requestPasscodeReset(req: Request, res: Response) {
        try {
            const { phone: phone_number, country_code } = req.body;
            const findUser = await findActiveAgentByPhone(phone_number, country_code);
            if (!findUser) return returnHelper(res, 200, false, "Phone number not registered.");
            const wrongAgency = await wrongAgencyMessage(findUser, req.body?.agency_host);
            if (wrongAgency) return returnHelper(res, 200, false, wrongAgency);
            if (!(await usesLoginCode(findUser.dataValues.id))) {
                return returnHelper(res, 200, false, "This account uses SMS login. Use the OTP flow instead.");
            }
            const email = (findUser.dataValues.email || "").trim();
            if (!email) {
                return returnHelper(
                    res,
                    200,
                    false,
                    "No email on this account. Ask your agency admin to send a new login code, or add an email first.",
                );
            }
            const code = await issueAgentResetCode(findUser.dataValues.id);
            const panel = sharedPanel().replace(/\/+$/, "");
            const sent = await sendPasscodeResetEmail({
                to: email,
                name: findUser.dataValues.username || "there",
                phone: `${country_code || ""} ${phone_number}`.trim(),
                code,
                loginUrl: panel ? `${panel}/login` : null,
                panelLabel: "agency panel",
            });
            if (!sent) {
                return returnHelper(res, 200, false, "Could not send the reset email. Try again or ask an admin for help.");
            }
            return returnHelper(res, 200, true, `A reset code was emailed to ${email}. Check your inbox.`, {
                email_hint: email.replace(/(.{2}).+(@.+)/, "$1***$2"),
            });
        } catch (error: any) {
            return returnHelper(res, 200, false, error.message || "Could not request a reset.");
        }
    }

    /** POST /agent/verify_passcode_reset — verify emailed reset code → setup_token for set_passcode. */
    async verifyPasscodeReset(req: Request, res: Response) {
        try {
            const { phone: phone_number, phone_number: phoneAlt, country_code, code, otp } = req.body;
            const phone = phone_number || phoneAlt;
            const findUser = await findActiveAgentByPhone(phone, country_code);
            if (!findUser) return returnHelper(res, 200, false, "Phone number not registered.");
            const wrongAgency = await wrongAgencyMessage(findUser, req.body?.agency_host);
            if (wrongAgency) return returnHelper(res, 200, false, wrongAgency);
            const checked = await checkAgentResetCode(findUser.dataValues.id, code || otp);
            if (!checked.ok) return returnHelper(res, 200, false, checked.message);
            const u = findUser.dataValues;
            const setup_token = issueSetupToken({ audience: "agent", id: u.id, uuid: u.uuid });
            return returnHelper(res, 200, true, "Reset code verified. Set your new passcode.", {
                must_set_passcode: true,
                setup_token,
                name: u.username,
                phone: u.phone_number,
                country_code: u.country_code,
            });
        } catch (error: any) {
            return returnHelper(res, 200, false, error.message || "Could not verify the reset code.");
        }
    }

    /** POST /agent/set_passcode — first login or after forgot; requires setup_token (not a session JWT). */
    /**
     * POST /agent/change_passcode { current_passcode, passcode, confirm_passcode } (signed in)
     * Owner or team member picks a new passcode from inside the panel. Every device is signed out
     * afterwards (this one too), so they log in again with the new passcode.
     */
    async changePasscode(req: RequestWithUser, res: Response) {
        try {
            const id = Number((req.user?.user as any)?.id);
            if (!id) return returnHelper(res, 200, false, "Please log in again.");
            const current = await checkLoginCode(id, req.body?.current_passcode);
            if (!current.applies) return returnHelper(res, 200, false, "This account has no passcode yet. Log out and sign in with your login code.");
            if (!current.ok) return returnHelper(res, 200, false, "Current passcode is wrong.");
            const shape = validatePasscodeShape(req.body?.passcode, req.body?.confirm_passcode);
            if (!shape.ok) return returnHelper(res, 200, false, shape.message);
            if (String(req.body?.current_passcode ?? "").replace(/\D/g, "") === shape.pin) {
                return returnHelper(res, 200, false, "Choose a passcode different from the current one.");
            }
            await setAgentPasscode(id, shape.pin);
            return returnHelper(res, 200, true, "Passcode changed. Log in again with your new passcode.");
        } catch (error: any) {
            return returnHelper(res, 200, false, error.message || "Could not change the passcode.");
        }
    }

    async setPasscode(req: Request, res: Response) {
        try {
            const setup = verifySetupToken(req.body?.setup_token, "agent");
            if (!setup) return returnHelper(res, 200, false, "Your session to set a passcode expired. Log in again.");
            const shape = validatePasscodeShape(req.body?.passcode ?? req.body?.pin, req.body?.confirm_passcode ?? req.body?.confirm);
            if (!shape.ok) return returnHelper(res, 200, false, shape.message);

            const user = await Agent.findOne({ where: { id: setup.id, uuid: setup.uuid, status: "active" } });
            if (!user) return returnHelper(res, 200, false, "Account not found.");
            const wrongAgency = await wrongAgencyMessage(user, req.body?.agency_host);
            if (wrongAgency) return returnHelper(res, 200, false, wrongAgency);

            await setAgentPasscode(setup.id, shape.pin);
            return agentLoginSuccess(res, user);
        } catch (error: any) {
            return returnHelper(res, 200, false, error.message || "Could not set passcode.");
        }
    }

    async signup(req: Request, res: Response) {
        try {

            const { phone_number, country_code, user_name: username, email } = req.body


            // function generateOTP() {
            //     // Generate a random 6-digit number
            //     const otp = Math.floor(100000 + Math.random() * 900000);
            //     return otp;
            // }

            // const createotp = generateOTP()
            // const otp = await bcrypt.hash(createotp + "", 10)


            // function generateExpiryTime() {
            //     // Get the current time
            //     const currentTime = new Date();

            //     // Add 5 minutes to the current time to get the expiration time
            //     const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

            //     return expiryTime;
            // }

            // const otp_expire = generateExpiryTime()


            // const encryptedPassword = await bcrypt.hash(password, 10)
            await Agent.create({
                email,
                username,
                phone_number,
                country_code,
                user_type: "user",
                // otp: otp,
                // otp_expire

            }).then((created: any) => {

                // send OTP TO USER

                axios.get(
                    `https://cpaas.messagecentral.com/auth/v1/authentication/token?country=IN&customerId=${CUSTOMERID}&email=${EMAIL_ID}&key=${KEY_SMS}&scope=NEW`,).then(async (tokenResponse) => {
                        // console.log(tokenResponse, "tokenResponse---------------/n")
                        if (tokenResponse.status == 200 && tokenResponse.data.status == '200') {
                            axios.post(
                                `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=${CUSTOMERID}&flowType=SMS&mobileNumber=${phone_number}`,
                                // `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=${CUSTOMERID}&senderId=UTOMOB&type=SMS&flowType=SMS&mobileNumber=${phone_number}&message=Your OTP is ${createotp}, Please do not share it with anyone`,
                                {},
                                {
                                    headers: {
                                        'authToken': tokenResponse.data.token
                                    }
                                }).then((response) => {
                                    // console.log(response, "RESPONSE---------\n")
                                    if (response.status == 200) {
                                        // return res.status(200).json({
                                        //     success: true,
                                        //     message: "OTP has been sent successfully.",
                                        //     verificationId: response.data.data.verificationId
                                        // })
                                        return returnHelper(res,200,true, "OTP has been sent successfully.", response?.data?.data?.verificationId)
                                    } else {
                                        return res.status(200).json({
                                            success: false,
                                            message: "Failed to send otp, Please try again after some time"
                                        })
                                    }
                                })
                                .catch((error) => {
                                    return res.status(200).json({
                                        success: false,
                                        message: "Failed to send otp, Please try again after some time"
                                    })
                                })
                        } else {
                            return res.status(200).json({
                                success: false,
                                message: "Failed to send otp, Please try again after some time"
                            })
                        }

                    })


            }).catch(e => {
                // console.log(e)
                return res.status(200).json({
                    success: false,
                    message: e.message
                })
            })


        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async createAccount(req: RequestWithUser, res: Response) {
        try {

            const { 
                phone_number, 
                country_code, 
                user_name: username, 
                email,
                primary_color,
                primary_foreground_color,
                dark_primary_color,
                app_name,
                support_number,
                support_email,
                agency_address,
                certificate_url,
                favicon_url,
                meta_description,
                meta_keywords,
                og_image,
                og_url,
                sudomain,
                domain
            } = req.body

            // Validations
            if (!phone_number) {
                return returnHelper(res, 200, false, "Please Provide Phone Number")
            }

            if (!country_code) {
                return returnHelper(res, 200, false, "Please Provide Country Code")
            }

            if (!username) {
                return returnHelper(res, 200, false, "Please Provide User Name")
            }

            if (!email) {
                return returnHelper(res, 200, false, "Please Provide Email")
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return returnHelper(res, 200, false, "Please Provide a Valid Email")
            }

            // Validate phone number format (10 digits)
            if (!/^[0-9]{10}$/.test(phone_number)) {
                return returnHelper(res, 200, false, "Please Provide a Valid Phone Number (10 digits)")
            }

            // Validate country code format
            if (!/^\+\d+$/.test(country_code)) {
                return returnHelper(res, 200, false, "Please Provide a Valid Country Code (e.g., +91)")
            }

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };

            // Prepare create records
            const createRecords: any = {
                email,
                username,
                phone_number,
                country_code,
                user_type: "user",
                primary_color: primary_color || process.env.VITE_PRIMARY_COLOR || "#0f5bd8",
                primary_foreground_color: primary_foreground_color || process.env.VITE_PRIMARY_FOREGROUND_COLOR || "#ffffff",
                dark_primary_color: dark_primary_color || process.env.VITE_DARK_PRIMARY_COLOR || "#D8C4B6",
                app_name: app_name || process.env.VITE_APP_NAME || "TechxSolutions",
                support_number: support_number || process.env.VITE_SUPPORT_NUMBER || "8848484848",
                support_email: support_email || process.env.VITE_SUPPORT_EMAIL || "techxSolutions@gmail.com",
                agency_address: agency_address || process.env.VITE_AGENCY_ADDRESS || "Ahmedabad, GJ, IN",
                certificate_url: certificate_url || process.env.VITE_CERTIFICATE_URL || "",
                favicon_url: favicon_url || process.env.VITE_FAVICON_URL || "/logo.png",
                meta_description: meta_description || process.env.VITE_META_DESCRIPTION || "",
                meta_keywords: meta_keywords || process.env.VITE_META_KEYWORDS || "",
                og_image: og_image || process.env.VITE_OG_IMAGE || "/logo.png",
                og_url: og_url || process.env.VITE_OG_URL || process.env.FRONTEND_URL || "",
                sudomain,
                domain
            }

            // Handle favicon_file upload
            if (files && files['favicon_file'] && files['favicon_file'][0]) {
                const faviconFile = files['favicon_file'][0];
                const faviconFileName = `${Date.now()}-${Math.floor(
                    1000 + Math.random() * 9000
                )}${path.parse(faviconFile.originalname).ext}`;

                createRecords.favicon_url = await saveFile({ owner: ownerFromRequest(req), folder: "profiles", name: faviconFileName, body: faviconFile.buffer, contentType: faviconFile.mimetype });
            }

            // Handle og_image_file upload
            if (files && files['og_image_file'] && files['og_image_file'][0]) {
                const ogImageFile = files['og_image_file'][0];
                const ogImageFileName = `${Date.now()}-${Math.floor(
                    1000 + Math.random() * 9000
                )}${path.parse(ogImageFile.originalname).ext}`;

                createRecords.og_image = await saveFile({ owner: ownerFromRequest(req), folder: "profiles", name: ogImageFileName, body: ogImageFile.buffer, contentType: ogImageFile.mimetype });
            }

            await Agent.create(createRecords)
            return returnHelper(res,200,true,"Account created successfully")

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    // async getAccountDetails(req: RequestWithUser, res: Response) {
    //     try {
    //         // Extract domain and subdomain from query parameters
    //         let domain = req.query.domain as string;
    //         let subdomain = req.query.sudomain as string || req.query.subdomain as string;

    //         // If not in query params, try to extract from request hostname
    //         if (!domain || !subdomain) {
    //             const hostname = req.hostname || req.get('host') || '';
                
    //             // Parse hostname to extract domain and subdomain
    //             // Example: subdomain.domain.com -> subdomain: subdomain, domain: domain.com
    //             const hostParts = hostname.split('.');
                
    //             if (hostParts.length >= 2) {
    //                 // If hostname has multiple parts, assume first part is subdomain
    //                 if (!subdomain && hostParts.length > 2) {
    //                     subdomain = hostParts[0];
    //                 }
    //                 if (!domain) {
    //                     // Domain is everything after subdomain (e.g., domain.com)
    //                     domain = hostParts.slice(hostParts.length - 2).join('.');
    //                 }
    //             }
    //         }

    //         // Validate that we have at least domain or subdomain
    //         if (!domain && !subdomain) {
    //             // return returnHelper(res, 200, false, "Please provide domain or subdomain")
    //             domain = "google.com"
    //             subdomain =  "google"
    //         }

    //         // Build where condition
    //         const whereCondition: any = {};
            
    //         if (domain) {
    //             whereCondition.domain = domain;
    //         }
            
    //         if (subdomain) {
    //             whereCondition.sudomain = subdomain;
    //         }

    //         console.log(whereCondition, "WHERE CONDITION");

    //         const account = await Agent.findOne({
    //             where: whereCondition,
    //             attributes: [
    //                 "id",
    //                 "uuid",
    //                 "phone_number",
    //                 "country_code",
    //                 "username",
    //                 "email",
    //                 "primary_color",
    //                 "primary_foreground_color",
    //                 "dark_primary_color",
    //                 "app_name",
    //                 "support_number",
    //                 "support_email",
    //                 "agency_address",
    //                 "certificate_url",
    //                 "favicon_url",
    //                 "meta_description",
    //                 "meta_keywords",
    //                 "og_image",
    //                 "og_url",
    //                 "sudomain",
    //                 "domain",
    //                 "status",
    //                 "createdAt",
    //                 "updatedAt"
    //             ]
    //         });

    //         if (!account) {
    //             return returnHelper(res, 200, false, "Account not found")
    //         }

    //         // Format the response with full URLs for images
    //         const accountData: any = account.toJSON();
            
    //         // Add full URLs for favicon and og_image if they exist
    //         if (accountData.favicon_url) {
    //             accountData.favicon_url_full = accountData.favicon_url.startsWith('http') 
    //                 ? accountData.favicon_url 
    //                 : `${process.env.LOCAL_PATH || ''}public/profiles/${accountData.favicon_url}`;
    //         }

    //         if (accountData.og_image) {
    //             accountData.og_image_full = accountData.og_image.startsWith('http') 
    //                 ? accountData.og_image 
    //                 : `${process.env.LOCAL_PATH || ''}public/profiles/${accountData.og_image}`;
    //         }

    //         return returnHelper(res, 200, true, "Account details retrieved successfully", accountData)

    //     } catch (error: any) {
    //         return res.status(200).json({
    //             success: false,
    //             message: error.message
    //         })
    //     }
    // }
    async getAccountDetails(req: RequestWithUser, res: Response) {
        try {
            // Extract domain and subdomain from query parameters
            // Accept both 'subdomain' and 'sudomain' for flexibility
            let domain = process.env.IS_LOCAL_USE == "true" ? "universe.in" : (req.query.domain) as string;
            let sudomain = process.env.IS_LOCAL_USE == "true" ? "techxuniverse" : (req.query.sudomain || req.query.subdomain) as string;
    
            console.log("Query params - domain:", domain, "sudomain:", sudomain);
    
            // If not in query params, try to extract from request hostname
            if (!domain || !sudomain) {
                // Check X-Forwarded-Host first (Nginx proxy), then Host header, then hostname
                const hostname = req.get('x-forwarded-host') || req.get('host') || req.hostname || '';
                
                console.log("Hostname from request:", hostname);
                
                // Remove port if present (e.g., localhost:4001 -> localhost)
                const hostnameWithoutPort = hostname.split(':')[0];
                
                // Parse hostname to extract domain and subdomain
                // Example: admin.techxuniverse.com -> sudomain: admin, domain: techxuniverse.com
                const hostParts = hostnameWithoutPort.split('.');
                
                console.log("Host parts:", hostParts);
                
                if (hostParts.length >= 2) {
                    // If hostname has 3+ parts (e.g., admin.techxuniverse.com)
                    if (hostParts.length >= 3) {
                        if (!sudomain) {
                            sudomain = hostParts[0]; // 'admin'
                        }
                        if (!domain) {
                            // Domain is the last two parts (e.g., techxuniverse.com)
                            domain = hostParts.slice(-2).join('.');
                        }
                    } 
                    // If hostname has exactly 2 parts (e.g., techxuniverse.com)
                    else if (hostParts.length === 2) {
                        if (!domain) {
                            domain = hostnameWithoutPort; // techxuniverse.com
                        }
                        // No sudomain in this case (main domain)
                    }
                }
            }
    
            console.log("Final - domain:", domain, "sudomain:", sudomain);
    
            // Validate that we have at least domain or sudomain
            if (!domain && !sudomain) {
                return returnHelper(res, 200, false, "Please provide domain or subdomain")
            }

            // Platform hosts are not agency tenants (admin/crm/api/student marketing host)
            const RESERVED = new Set(["admin", "crm", "api", "www", "student"]);
            if (sudomain && RESERVED.has(String(sudomain).toLowerCase())) {
                return returnHelper(res, 200, false, "This is the platform host, not an agency portal")
            }
    
            // Build where condition
            const whereCondition: any = {};
            
            if (domain) {
                whereCondition.domain = domain;
            }
            
            if (sudomain) {
                whereCondition.sudomain = sudomain;
            } else {
                // custom apex domain: agency stored with empty/null subdomain
                whereCondition.sudomain = { [Op.or]: [null, ""] };
            }
    
            console.log("WHERE CONDITION:", whereCondition);
    
            const account = await Agent.findOne({
                where: whereCondition,
                attributes: [
                    "id",
                    "uuid",
                    "phone_number",
                    "country_code",
                    "username",
                    "email",
                    "primary_color",
                    "primary_foreground_color",
                    "dark_primary_color",
                    "app_name",
                    "support_number",
                    "support_email",
                    "agency_address",
                    "certificate_url",
                    "favicon_url",
                    "meta_description",
                    "meta_keywords",
                    "og_image",
                    "og_url",
                    "sudomain",
                    "domain",
                    "status",
                    "ui_prefs",
                    "createdAt",
                    "updatedAt"
                ]
            });
    
            if (!account) {
                return returnHelper(res, 200, false, "Account not found")
            }
    
            // Format the response with full URLs for images
            const accountData: any = account.toJSON();
            // SaaS: which optional modules the student portal may show (null = all, agency has no plan)
            const portalAccess = await getAgencyAccess(accountData.uuid);
            accountData.addons = portalAccess?.plan ? portalAccess.plan.features.addons : null;
            // what the agency mainly does (student / tourist & business visas) - portal wording and stages
            accountData.business_focus = businessFocusOf(accountData.ui_prefs);
            // "Client portal" module off (platform admin -> agency -> modules): no portal at /, the address opens the agency panel
            accountData.portal_enabled = await hasModule(accountData.uuid, "customer_portal");
            delete accountData.ui_prefs;
            
            // Add full URLs for favicon and og_image if they exist
            if (accountData.favicon_url) {
                accountData.favicon_url_full = accountData.favicon_url.startsWith('http') 
                    ? accountData.favicon_url 
                    : publicFileUrl("profiles", accountData.favicon_url);
            }
    
            if (accountData.og_image) {
                accountData.og_image_full = accountData.og_image.startsWith('http') 
                    ? accountData.og_image 
                    : publicFileUrl("profiles", accountData.og_image);
            }
    
            return returnHelper(res, 200, true, "Account details retrieved successfully", accountData)
    
        } catch (error: any) {
            console.error("Error in getAccountDetails:", error);
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async getAccountDetailsDev(req: RequestWithUser, res: Response) {
        try {
            // Extract domain and subdomain from query parameters
            // Accept both 'subdomain' and 'sudomain' for flexibility
            let domain = "techxuniverse.com" //process.env.IS_LOCAL_USE == "true" ? "universe.in" : (req.query.domain) as string;
            let sudomain = "student" //process.env.IS_LOCAL_USE == "true" ? "techxuniverse" : (req.query.sudomain || req.query.subdomain) as string;
    
            console.log("Query params - domain:", domain, "sudomain:", sudomain);
    
            // // If not in query params, try to extract from request hostname
            // if (!domain || !sudomain) {
            //     // Check X-Forwarded-Host first (Nginx proxy), then Host header, then hostname
            //     const hostname = req.get('x-forwarded-host') || req.get('host') || req.hostname || '';
                
            //     console.log("Hostname from request:", hostname);
                
            //     // Remove port if present (e.g., localhost:4001 -> localhost)
            //     const hostnameWithoutPort = hostname.split(':')[0];
                
            //     // Parse hostname to extract domain and subdomain
            //     // Example: admin.techxuniverse.com -> sudomain: admin, domain: techxuniverse.com
            //     const hostParts = hostnameWithoutPort.split('.');
                
            //     console.log("Host parts:", hostParts);
                
            //     if (hostParts.length >= 2) {
            //         // If hostname has 3+ parts (e.g., admin.techxuniverse.com)
            //         if (hostParts.length >= 3) {
            //             if (!sudomain) {
            //                 sudomain = hostParts[0]; // 'admin'
            //             }
            //             if (!domain) {
            //                 // Domain is the last two parts (e.g., techxuniverse.com)
            //                 domain = hostParts.slice(-2).join('.');
            //             }
            //         } 
            //         // If hostname has exactly 2 parts (e.g., techxuniverse.com)
            //         else if (hostParts.length === 2) {
            //             if (!domain) {
            //                 domain = hostnameWithoutPort; // techxuniverse.com
            //             }
            //             // No sudomain in this case (main domain)
            //         }
            //     }
            // }
    
            // console.log("Final - domain:", domain, "sudomain:", sudomain);
    
            // Validate that we have at least domain or sudomain
            // if (!domain && !sudomain) {
            //     return returnHelper(res, 200, false, "Please provide domain or subdomain")
            // }
    
            // Build where condition
            const whereCondition: any = {};
            
            if (domain) {
                whereCondition.domain = domain;
            }
            
            if (sudomain) {
                whereCondition.sudomain = sudomain;
            }
    
            console.log("WHERE CONDITION:", whereCondition);
    
            const account = await Agent.findOne({
                where: whereCondition,
                attributes: [
                    "id",
                    "uuid",
                    "phone_number",
                    "country_code",
                    "username",
                    "email",
                    "primary_color",
                    "primary_foreground_color",
                    "dark_primary_color",
                    "app_name",
                    "support_number",
                    "support_email",
                    "agency_address",
                    "certificate_url",
                    "favicon_url",
                    "meta_description",
                    "meta_keywords",
                    "og_image",
                    "og_url",
                    "sudomain",
                    "domain",
                    "status",
                    "createdAt",
                    "updatedAt"
                ]
            });
    
            if (!account) {
                return returnHelper(res, 200, false, "Account not found")
            }
    
            // Format the response with full URLs for images
            const accountData: any = account.toJSON();
            // SaaS: which optional modules the student portal may show (null = all, agency has no plan)
            const portalAccess = await getAgencyAccess(accountData.uuid);
            accountData.addons = portalAccess?.plan ? portalAccess.plan.features.addons : null;
            
            // Add full URLs for favicon and og_image if they exist
            if (accountData.favicon_url) {
                accountData.favicon_url_full = accountData.favicon_url.startsWith('http') 
                    ? accountData.favicon_url 
                    : publicFileUrl("profiles", accountData.favicon_url);
            }
    
            if (accountData.og_image) {
                accountData.og_image_full = accountData.og_image.startsWith('http') 
                    ? accountData.og_image 
                    : publicFileUrl("profiles", accountData.og_image);
            }
    
            return returnHelper(res, 200, true, "Account details retrieved successfully", accountData)
    
        } catch (error: any) {
            console.error("Error in getAccountDetails:", error);
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async updateAccount(req: RequestWithUser, res: Response) {
        try {

            const { 
                id,
                uuid,
                phone_number, 
                country_code, 
                user_name: username, 
                email,
                primary_color,
                primary_foreground_color,
                dark_primary_color,
                app_name,
                support_number,
                support_email,
                agency_address,
                certificate_url,
                favicon_url,
                meta_description,
                meta_keywords,
                og_image,
                og_url,
                sudomain,
                domain,
                expires_at
            } = req.body

            // Validate identifier
            if (!id && !uuid) {
                return returnHelper(res, 200, false, "Please Provide ID or UUID")
            }

            // Find existing account
            const whereCondition: any = id ? { id } : { uuid };
            const existingAccount = await Agent.findOne({ where: whereCondition });

            if (!existingAccount) {
                return returnHelper(res, 200, false, "Account not found")
            }

            // Validations (only if provided)
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return returnHelper(res, 200, false, "Please Provide a Valid Email")
                }
            }

            if (phone_number && !/^[0-9]{10}$/.test(phone_number)) {
                return returnHelper(res, 200, false, "Please Provide a Valid Phone Number (10 digits)")
            }

            if (country_code && !/^\+\d+$/.test(country_code)) {
                return returnHelper(res, 200, false, "Please Provide a Valid Country Code (e.g., +91)")
            }

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };

            // Prepare update records - only include provided fields
            const updateRecords: any = {};

            if (phone_number !== undefined) updateRecords.phone_number = phone_number;
            if (country_code !== undefined) updateRecords.country_code = country_code;
            if (username !== undefined) updateRecords.username = username;
            if (email !== undefined) updateRecords.email = email;
            if (primary_color !== undefined) updateRecords.primary_color = primary_color;
            if (primary_foreground_color !== undefined) updateRecords.primary_foreground_color = primary_foreground_color;
            if (dark_primary_color !== undefined) updateRecords.dark_primary_color = dark_primary_color;
            if (app_name !== undefined) updateRecords.app_name = app_name;
            if (support_number !== undefined) updateRecords.support_number = support_number;
            if (support_email !== undefined) updateRecords.support_email = support_email;
            if (agency_address !== undefined) updateRecords.agency_address = agency_address;
            if (certificate_url !== undefined) updateRecords.certificate_url = certificate_url;
            if (meta_description !== undefined) updateRecords.meta_description = meta_description;
            if (meta_keywords !== undefined) updateRecords.meta_keywords = meta_keywords;
            if (og_url !== undefined) updateRecords.og_url = og_url;
            if (sudomain !== undefined) updateRecords.sudomain = sudomain;
            if (domain !== undefined) updateRecords.domain = domain;
            if (expires_at !== undefined) updateRecords.expires_at = expires_at;

            // Handle favicon_file upload
            if (files && files['favicon_file'] && files['favicon_file'][0]) {
                const faviconFile = files['favicon_file'][0];
                const faviconFileName = `${Date.now()}-${Math.floor(
                    1000 + Math.random() * 9000
                )}${path.parse(faviconFile.originalname).ext}`;

                const oldfavicon = existingAccount.dataValues.favicon_url;
                updateRecords.favicon_url = await saveFile({ owner: agencyOwner(existingAccount.dataValues.uuid), folder: "profiles", name: faviconFileName, body: faviconFile.buffer, contentType: faviconFile.mimetype });
                if (oldfavicon) await deleteFile("profiles", oldfavicon);
            } else if (favicon_url !== undefined) {
                updateRecords.favicon_url = favicon_url;
            }

            // Handle og_image_file upload
            if (files && files['og_image_file'] && files['og_image_file'][0]) {
                const ogImageFile = files['og_image_file'][0];
                const ogImageFileName = `${Date.now()}-${Math.floor(
                    1000 + Math.random() * 9000
                )}${path.parse(ogImageFile.originalname).ext}`;

                const oldogImage = existingAccount.dataValues.og_image;
                updateRecords.og_image = await saveFile({ owner: agencyOwner(existingAccount.dataValues.uuid), folder: "profiles", name: ogImageFileName, body: ogImageFile.buffer, contentType: ogImageFile.mimetype });
                if (oldogImage) await deleteFile("profiles", oldogImage);
            } else if (og_image !== undefined) {
                updateRecords.og_image = og_image;
            }

            await Agent.update(updateRecords, {
                where: whereCondition
            });

            return returnHelper(res, 200, true, "Account updated successfully")

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async getAccountDetailsById(req: RequestWithUser, res: Response) {
        try {
            const { id, uuid } = req.query;

            // Validate identifier
            if (!id && !uuid) {
                return returnHelper(res, 200, false, "Please provide ID or UUID")
            }

            // Build where condition
            const whereCondition: any = id ? { id } : { uuid };

            const account = await Agent.findOne({
                where: whereCondition,
                attributes: [
                    "id",
                    "uuid",
                    "phone_number",
                    "country_code",
                    "username",
                    "email",
                    "primary_color",
                    "primary_foreground_color",
                    "dark_primary_color",
                    "app_name",
                    "support_number",
                    "support_email",
                    "agency_address",
                    "certificate_url",
                    "favicon_url",
                    "meta_description",
                    "meta_keywords",
                    "og_image",
                    "og_url",
                    "sudomain",
                    "domain",
                    "status",
                    "role",
                    "createdAt",
                    "updatedAt"
                ]
            });

            if (!account) {
                return returnHelper(res, 200, false, "Account not found")
            }

            // Format the response with full URLs for images
            const accountData: any = account.toJSON();
            // SaaS: which optional modules the student portal may show (null = all, agency has no plan)
            const portalAccess = await getAgencyAccess(accountData.uuid);
            accountData.addons = portalAccess?.plan ? portalAccess.plan.features.addons : null;
            
            // Add full URLs for favicon and og_image if they exist
            if (accountData.favicon_url) {
                accountData.favicon_url_full = accountData.favicon_url.startsWith('http') 
                    ? accountData.favicon_url 
                    : publicFileUrl("profiles", accountData.favicon_url);
            }

            if (accountData.og_image) {
                accountData.og_image_full = accountData.og_image.startsWith('http') 
                    ? accountData.og_image 
                    : publicFileUrl("profiles", accountData.og_image);
            }

            return returnHelper(res, 200, true, "Account details retrieved successfully", accountData)

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async signupCustom(req: Request, res: Response) {
        try {

            const { phone_number, country_code, user_name: username, email } = req.body


            function generateOTP() {
                // Generate a random 6-digit number
                const otp = Math.floor(1000 + Math.random() * 9000);
                return otp;
            }

            const createotp = generateOTP()

            const otp = await bcrypt.hash(createotp + "", 10)


            function generateExpiryTime() {
                // Get the current time
                const currentTime = new Date();

                // Add 5 minutes to the current time to get the expiration time
                const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                return expiryTime;
            }

            const otp_expire = generateExpiryTime()



            // const encryptedPassword = await bcrypt.hash(password, 10)
            await Agent.create({
                email,
                username,
                // password: encryptedPassword,
                phone_number,
                country_code,
                user_type: "user",
                otp: otp,
                otp_expire

            }).then((created: any) => {

                return res.status(200).json({
                    success: true,
                    message: "OTP has been sent successfully.",
                    verificationId: ""
                })

            }).catch(e => {
                // console.log(e)
                return res.status(200).json({
                    success: false,
                    message: e.message
                })
            })


        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async kycTokenType(req: RequestWithUser, res: Response) {

        try {

            const role: string = req.user?.user.role || "guest"
            console.log(role, "ROLE");

            const roles = ["agent", "sub-agent", "tour-agent"]
            if (!roles.includes(role)) {
                return res.status(401).json({
                    success: false,
                    message: "Auth Failed"
                })
            } else {

                const findUser: any = await Agent.findOne({
                    where: {
                        uuid: req.uuid
                    },
                    attributes: [
                        "uuid",
                        "username",
                        "email",
                        "profile_image",
                        "status",
                        "designation",
                        "role",
                        "access_profile",
                        "is_verified",
                        "phone_number",
                        "country_code",
                        "team_role",
                        "branch_id"
                    ]
                })
                return res.status(200).json({
                    success: true,
                    data: {
                        role: role,
                        team_role: role === "agent" ? "owner" : (findUser?.dataValues.team_role || "counsellor"),
                        branch_id: role === "agent" ? null : (findUser?.dataValues.branch_id || null),
                        profile: findUser?.access_profile || "",
                        name: findUser?.dataValues.username,
                        designation: findUser?.dataValues.designation,
                        phone: findUser?.dataValues.phone_number,
                        country_code: findUser?.dataValues.country_code,
                        is_firstTime: findUser?.dataValues.is_verified == 1 ? false : true,
                        // SaaS: plan, trial / paid, days left, features - drives banners and locked modules
                        subscription: await getAgencyAccess((req.user?.user as any)?.agent_uuid),
                        // Travel CRM: product type, enabled modules and the words that go with them
                        ...(await (async () => {
                            const m = await modulesFor((req.user?.user as any)?.agent_uuid);
                            return { crm_type: m.crmType, modules: m.enabled, labels: labelsFor(m.crmType), lead_stages: null };
                        })()),
                        // agency colour (Branding settings) - the agency panel uses the same colour as the student portal
                        // agency look for the panel header: colour, name and logo (Branding settings)
                        ...(await (async () => {
                            const ag: any = await Agent.findOne({ where: { uuid: (req.user?.user as any)?.agent_uuid, role: "agent" }, attributes: ["primary_color", "app_name", "username", "favicon_url", "ui_prefs"], raw: true });
                            const logo = ag?.favicon_url ? (String(ag.favicon_url).startsWith("http") ? ag.favicon_url : publicFileUrl("profiles", ag.favicon_url)) : null;
                            return {
                                brand_color: ag?.primary_color || null,
                                agency_name: ag?.app_name || ag?.username || null,
                                agency_logo: logo,
                                business_focus: businessFocusOf(ag?.ui_prefs),
                                hide_travel_documents: hideTravelDocumentsOf(ag?.ui_prefs),
                                hide_commissions: hideCommissionsOf(ag?.ui_prefs),
                                hide_universities: hideUniversitiesOf(ag?.ui_prefs),
                            };
                        })())
                    }
                })
            }

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }

    }


    async agentListing(req: RequestWithUser, res: Response) {
        try {

            const { search, offset } = req.body

            const searchCondition = search
                ? {
                    [Op.or]: [
                        { phone_number: { [Op.like]: `%${search}%` } },  // search by phone number
                        { username: { [Op.like]: `%${search}%` } },      // search by username
                        { email: { [Op.like]: `%${search}%` } },         // search by email
                    ],
                    role: "agent"
                }
                : {role: "agent"};

            const total = await Agent.count({
                where: searchCondition
            })
            const findAllAgents = await Agent.findAll({
                where: searchCondition,
                attributes: [
                    "uuid",
                    "phone_number",
                    "username",
                    "email",
                    "role",
                    "status",
                    "is_verified",
                    "profile_image",
                    "access_profile",
                    "createdAt",
                    "expires_at",
                    "primary_color",
                    "primary_foreground_color",
                    "app_name",
                    "support_number",
                    "support_email",
                    "agency_address",
                    "certificate_url",
                    "favicon_url",
                    "meta_description",
                    "meta_keywords",
                    "og_image",
                    "og_url",
                    "sudomain",
                    "domain",
                ],
                offset: offset,
                limit: 5,
                order: [["createdAt", "DESC"]]
            })

            return res.status(200).json({
                success: true,
                message: "Records Found",
                data: findAllAgents,
                total
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async agentCreate(req: Request, res: Response) {
        try {

            const { phone_number, country_code, user_name: username, email } = req.body

            await Agent.create({
                email,
                username,
                phone_number,
                country_code,
                user_type: "agent",
            }).then((created: any) => {
                return res.status(200).json({
                    success: true,
                    message: "Agent Created",
                })
            }).catch(e => {
                // console.log(e)
                return res.status(200).json({
                    success: false,
                    message: e.message
                })
            })


        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async agentUpdate(req: Request, res: Response) {
        try {

            const { user_name: username, email, uuid } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide All Params")
            }
            const updateParams = {
                ...(username && { username }),
                ...(email && { email }),
            }
            await Agent.update(updateParams, {
                where: {
                    uuid
                }
            })
            return res.status(200).json({
                success: true,
                message: "Agent Updated",
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async deleteAgent(req: RequestWithUser, res: Response) {
        try {

            const { uuid } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide All Params")
            }

            const findSubAgent = await Agent.findOne({
                where: {
                    uuid: uuid,
                }
            })

            if (!findSubAgent) {
                return returnHelper(res, 200, false, "Provide Valid Sub Agent To Delete")
            }

            await Agent.destroy({
                where: {
                    uuid: findSubAgent.dataValues.uuid
                }
            })

            return res.status(200).json({
                success: true,
                message: "Sub Agent Deleted",
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async toggleAgent(req: RequestWithUser, res: Response) {
        try {

            const { uuid, action } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide All Params")
            }

            const findSubAgent = await Agent.findOne({
                where: {
                    uuid: uuid,
                }
            })

            if (!findSubAgent) {
                return returnHelper(res, 200, false, "Provide Valid Sub Agent To Delete")
            }

            await Agent.update({ status: action }, {
                where: {
                    uuid: findSubAgent.dataValues.uuid
                }
            })

            return res.status(200).json({
                success: true,
                message: "Status Updated",
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }
}

export default new AgentController()