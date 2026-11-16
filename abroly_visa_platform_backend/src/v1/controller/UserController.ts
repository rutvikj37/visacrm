import { Request, Response } from "express";
import { getAgencyUuidFromRequest, studentAgencyScope } from "../../helpers/tenant";
import { RequestWithUser } from "../../utils/types";
import User from "../../model/User";
import { returnHelper } from "../../helpers/returnHelper";
import { logPortalLogin } from "../../services/portalLeadActivity";

import bcrypt from 'bcrypt'
import Jwt from "jsonwebtoken";
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import axios from "axios";
import UserDevices from "../../model/UserDevices";
import Admin from "../../model/Admin";
import {
    LOGIN_CODE_MARKER,
    adminUsesLoginCode,
    checkAdminLoginCode,
    checkStudentLoginCode,
    checkStudentResetCode,
    issueSetupToken,
    issueStudentResetCode,
    loginCodePrompt,
    sendPasscodeResetEmail,
    setStudentPasscode,
    studentUsesLoginCode,
    validatePasscodeShape,
    verifySetupToken,
} from "../../services/agencyLogin";
import { isLocalDev } from "../../middleware/localOnly";
import Agent from "../../model/Agent";
import { sharedPanel } from "../../services/panelUrl";

/** Fire-and-forget: show student portal login on the CRM lead timeline. */
const notePortalLogin = (user: any) => {
    try {
        const id = Number(user?.dataValues?.id || user?.id);
        if (!id) return;
        setImmediate(() => { logPortalLogin(id, user?.dataValues?.username || user?.username); });
    } catch { /* ignore */ }
};

dotenv.config()



const CUSTOMERID: string | any = process.env.SMSCUSTOMERID
const EMAIL_ID: string = process.env.SMS_EMAIL_ID
const KEY_SMS: string = process.env.SMS_KEY



const secretTokenForJWT: string | any = process.env.ACCESS_TOKEN_SECRET

/** Token + profile for a successful student login (same shape as the OTP flows). */
const studentLoginSuccess = async (res: Response, user: any) => {
    const u = user.dataValues;
    const accessToken = Jwt.sign({
        user: { user: { uuid: u.uuid, role: u.user_type, agency_uuid: u.agency_uuid, id: u.id } },
    }, secretTokenForJWT, { expiresIn: "90d" });
    const isFirstTime = u.is_verified == 0;
    await User.update({ is_verified: 1 }, { where: { uuid: u.uuid } });
    notePortalLogin(user);
    return res.status(200).json({
        success: true,
        message: "Login Success",
        data: { token: accessToken, name: u.username, phone: u.phone_number, country_code: u.country_code, isFirstTime },
    });
};

/** Students with an invite code or personal passcode log in with it instead of an SMS OTP. */
const tryStudentLoginCode = async (res: Response, user: any, otp: unknown) => {
    const pin = await checkStudentLoginCode(user.dataValues.id, otp);
    if (!pin.applies) return null;
    if (!pin.ok) return returnHelper(res, 200, false, pin.message);
    // first login with invite code: force set personal passcode before issuing a session JWT
    if (!pin.passcodeSet) {
        const u = user.dataValues;
        const setup_token = issueSetupToken({ audience: "student", id: u.id, uuid: u.uuid });
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
    return studentLoginSuccess(res, user);
};

/** Token + profile for a successful platform-admin login (same shape as the OTP flows). */
const adminLoginSuccess = async (res: Response, user: any) => {
    const u = user.dataValues;
    const accessToken = Jwt.sign({
        user: { user: { uuid: u.uuid, role: u.user_type, agency_uuid: u.agency_uuid, id: u.id } },
    }, secretTokenForJWT, { expiresIn: "90d" });
    return res.status(200).json({
        success: true,
        message: "Login Success",
        data: { token: accessToken, name: u.username, phone: u.phone_number, country_code: u.country_code },
    });
};

const tryAdminLoginCode = async (res: Response, user: any, otp: unknown) => {
    const pin = await checkAdminLoginCode(user.dataValues.id, otp);
    if (!pin.applies) return null;
    if (!pin.ok) return returnHelper(res, 200, false, pin.message);
    return adminLoginSuccess(res, user);
};

class UserController {

    async signupUser(req: Request, res: Response) {
        try {

            const { phone_number, country_code, user_name: username, email } = req.body


            // function generateOTP() {
            //     // Generate a random 6-digit number
            //     const otp = Math.floor(100000 + Math.random() * 900000);
            //     return otp;
            // }

            // const createotp = generateOTP()
            // console.log(createotp, "THE OTP");

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
            await User.create({
                email,
                username,
                phone_number,
                country_code,
                agency_uuid: getAgencyUuidFromRequest(req),
                user_type: "user",
                // coins_balance:3
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
                                        return returnHelper(res,200,true,"OTP has been sent successfully.",response?.data?.data?.verificationId)
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
    async signupUserCustom(req: Request, res: Response) {
        try {

            const { phone_number, country_code, user_name: username, email } = req.body


            function generateOTP() {
                // Generate a random 6-digit number
                const otp = Math.floor(1000 + Math.random() * 9000);
                return otp;
            }

            const createotp = generateOTP()
            console.log(createotp, "THE OTP");

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
            await User.create({
                email,
                username,
                // password: encryptedPassword,
                phone_number,
                country_code,
                agency_uuid: getAgencyUuidFromRequest(req),
                user_type: "user",
                otp: otp,
                otp_expire,
                // coins_balance:3

            }).then((created: any) => {

                // // send OTP TO USER

                // axios.get(
                //     `https://cpaas.messagecentral.com/auth/v1/authentication/token?country=IN&customerId=${CUSTOMERID}&email=${EMAIL_ID}&key=${KEY_SMS}&scope=NEW`,).then(async (tokenResponse) => {
                //         // console.log(tokenResponse, "tokenResponse---------------/n")
                //         if (tokenResponse.status == 200 && tokenResponse.data.status == '200') {
                //             axios.post(
                //                 `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=${CUSTOMERID}&flowType=SMS&mobileNumber=${phone_number}`,
                //                 // `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&customerId=${CUSTOMERID}&senderId=UTOMOB&type=SMS&flowType=SMS&mobileNumber=${phone_number}&message=Your OTP is ${createotp}, Please do not share it with anyone`,
                //                 {},
                //                 {
                //                     headers: {
                //                         'authToken': tokenResponse.data.token
                //                     }
                //                 }).then((response) => {
                //                     // console.log(response, "RESPONSE---------\n")
                //                     if (response.status == 200) {
                //                         return res.status(200).json({
                //                             success: true,
                //                             message: "OTP has been sent successfully.",
                //                             verificationId: response.data.data.verificationId
                //                         })
                //                     } else {
                //                         return res.status(200).json({
                //                             success: false,
                //                             message: "Failed to send otp, Please try again after some time"
                //                         })
                //                     }
                //                 })
                //                 .catch((error) => {
                //                     return res.status(200).json({
                //                         success: false,
                //                         message: "Failed to send otp, Please try again after some time"
                //                     })
                //                 })
                //         } else {
                //             return res.status(200).json({
                //                 success: false,
                //                 message: "Failed to send otp, Please try again after some time"
                //             })
                //         }

                //     })

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

    async loginWithNumberCustomLogic(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })

            if (findUser) {

                function generateOTP() {
                    // Generate a random 6-digit number
                    // const otp = Math.floor(100000 + Math.random() * 900000);
                    // generate 4 digit random number
                    const otp = Math.floor(1000 + Math.random() * 9000);
                    return otp;
                }

                const createotp = generateOTP()

                console.log(createotp, "THE OTP");

                const otp = await bcrypt.hash(createotp + "", 10)

                function generateExpiryTime() {
                    // Get the current time
                    const currentTime = new Date();

                    // Add 5 minutes to the current time to get the expiration time
                    const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                    return expiryTime;
                }

                const otp_expire = generateExpiryTime()

                await User.update({
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
                return res.status(200).json({
                    success: false,
                    message: "Phone number not registred YET!"
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

            const findUser = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })

            if (findUser) {

                // function generateOTP() {
                //     // Generate a random 6-digit number
                //     const otp = Math.floor(100000 + Math.random() * 900000);
                //     return otp;
                // }

                // const createotp = generateOTP()

                // console.log(createotp, "THE OTP");

                // const otp = await bcrypt.hash(createotp + "", 10)

                // function generateExpiryTime() {
                //     // Get the current time
                //     const currentTime = new Date();

                //     // Add 5 minutes to the current time to get the expiration time
                //     const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                //     return expiryTime;
                // }

                // const otp_expire = generateExpiryTime()

                // await User.update({
                //     otp,
                //     otp_expire
                // }, {
                //     where: {
                //         uuid: findUser.dataValues.uuid
                //     }
                // })

                if (isLocalDev() && (phone_number == "9799999999" || phone_number == "9799999998")) {
                    return res.status(200).json({
                        success: true,
                        message: "OTP has been sent successfully.",
                        verificationId: "demoid"
                    })
                }


                //  generate token 
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
                                        return returnHelper(res,200,true,"OTP has been sent successfully.",response?.data?.data?.verificationId)
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
                return res.status(200).json({
                    success: false,
                    message: "Phone number not registred YET!"
                })

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async logoutUser(req: RequestWithUser, res: Response) {
        try {

            const { device_uuid } = req.body

            if (!device_uuid) {
                return res.status(200).json({
                    success: true,
                    message: "Logout Success!"
                })
            }

            const findExistDevice = await UserDevices.findOne({
                where: {
                    uuid: device_uuid,
                    user_uuid: req.uuid
                }
            })

            if (!findExistDevice) {
                return res.status(200).json({
                    success: true,
                    message: "Logout Success!"
                })
            }

            await UserDevices.destroy({
                where: {
                    uuid: device_uuid,
                    user_uuid: req.uuid
                }
            })

            return res.status(200).json({
                success: true,
                message: "Logout Success!"
            })


        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
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

            const user = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })

            if (user) {
                // console.log("HERE FIND USER");

                if (isLocalDev() && (phone_number == "9799999999" || phone_number == "9799999998")) {
                    const sendTokenData = {
                        user: {
                            uuid: user.dataValues.uuid,
                            role: user.dataValues.user_type
                        },
                    };

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await User.update({
                        // otp: "",
                        // otp_expire: "",
                        is_verified: 1
                    }, {
                        where: {
                            uuid: user.dataValues.uuid
                        }
                    })

                    // create device 
                    const createDevice = await UserDevices.create({
                        user_uuid: user.dataValues.uuid,
                        device_token,
                        device_id,
                        device_model,
                    })

                    return res.status(200).json({
                        success: true,
                        message: "Login Success",
                        data: {
                            token: accessToken,
                            name: user.dataValues.username,
                            phone: user.dataValues.phone_number,
                            country_code: user.dataValues.country_code,
                            isFirstTime,
                            device_uuid: createDevice.dataValues.uuid
                        }
                    })
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
                                                role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                                                id:user?.dataValues?.id
                                            },
                                        };

                                        const accessToken = Jwt.sign({
                                            user: sendTokenData
                                        }, secretTokenForJWT, { expiresIn: "90d" });
                                        // console.log(user, "FIND USER");

                                        let isFirstTime = false
                                        if (user.dataValues.is_verified == 0) {
                                            isFirstTime = true
                                        }

                                        await User.update({
                                            // otp: "",
                                            // otp_expire: "",
                                            is_verified: 1
                                        }, {
                                            where: {
                                                uuid: user.dataValues.uuid
                                            }
                                        })

                                        // create device 
                                        const createDevice = await UserDevices.create({
                                            user_uuid: user.dataValues.uuid,
                                            device_token,
                                            device_id,
                                            device_model,
                                        })

                                        return res.status(200).json({
                                            success: true,
                                            message: "Login Success",
                                            data: {
                                                token: accessToken,
                                                name: user.dataValues.username,
                                                phone: user.dataValues.phone_number,
                                                country_code: user.dataValues.country_code,
                                                isFirstTime,
                                                device_uuid: createDevice.dataValues.uuid
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

    async validateOTPCUstom(req: Request, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                otp,
                device_token,
                device_id,
                device_model
            } = req.body

            const user = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })

            if (user && (await bcrypt.compare(otp, user.dataValues.otp))) {


                if (new Date() > new Date(user.dataValues.otp_expire)) {
                    return res.status(200).json({
                        success: false,
                        message: "The OTP has expired!"
                    })
                } else {

                    const sendTokenData = {
                        user: {
                            uuid: user.dataValues.uuid,
                            role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                            id:user?.dataValues?.id
                        },
                    };

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await User.update({
                        // otp: "",
                        // otp_expire: "",
                        is_verified: 1
                    }, {
                        where: {
                            uuid: user.dataValues.uuid
                        }
                    })

                    // create device 
                    const createDevice = await UserDevices.create({
                        user_uuid: user.dataValues.uuid,
                        device_token,
                        device_id,
                        device_model,
                    })

                    return res.status(200).json({
                        success: true,
                        message: "Login Success",
                        data: {
                            token: accessToken,
                            name: user.dataValues.username,
                            phone: user.dataValues.phone_number,
                            country_code: user.dataValues.country_code,
                            isFirstTime,
                            device_uuid: createDevice.dataValues.uuid
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

    // admin
    async AdminValidateOTP(req: Request, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                otp,
                verificationId
            } = req.body

            const user = await Admin.findOne({
                where: {
                    phone_number,
                    country_code,
                }
            })

            if (user) {
                const viaCode = await tryAdminLoginCode(res, user, otp)
                if (viaCode) return viaCode
                // console.log("HERE FIND USER");

                axios.get(
                    `https://cpaas.messagecentral.com/auth/v1/authentication/token?country=IN&customerId=${CUSTOMERID}&email=${EMAIL_ID}&key=${KEY_SMS}&scope=NEW`,).then(async (tokenResponse) => {
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
                                                role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                                                id:user?.dataValues?.id
                                            },
                                        };

                                        const accessToken = Jwt.sign({
                                            user: sendTokenData
                                        }, secretTokenForJWT, { expiresIn: "90d" });
                                        // console.log(user, "FIND USER");

                                        let isFirstTime = false
                                        if (user.dataValues.is_verified == 0) {
                                            isFirstTime = true
                                        }

                                        await Admin.update({
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

    async AdminValidateOTPCUstom(req: Request, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                otp,
                device_token,
                device_id,
                device_model
            } = req.body

            const user = await Admin.findOne({
                where: {
                    phone_number,
                    country_code,
                }
            })
            if (user) {
                const viaCode = await tryAdminLoginCode(res, user, otp)
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
                            role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                            id:user?.dataValues?.id
                        },
                    };

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await Admin.update({
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
    // student
    async studentValidateOTP(req: Request, res: Response) {
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

            const user = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })

            if (user) {
                const viaCode = await tryStudentLoginCode(res, user, otp)
                if (viaCode) return viaCode
                // console.log("HERE FIND USER");

                if (isLocalDev() && (phone_number == "9799999999" || phone_number == "9799999998")) {
                    const sendTokenData = {
                        user: {
                            uuid: user.dataValues.uuid,
                            role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                            id:user?.dataValues?.id
                        },
                    };

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await User.update({
                        // otp: "",
                        // otp_expire: "",
                        is_verified: 1
                    }, {
                        where: {
                            uuid: user.dataValues.uuid
                        }
                    })

                    notePortalLogin(user);
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
                                    if (otpResponse.data.responseCode == 200) {
                                        // if otp is validate than only go for further flow
                                        const sendTokenData = {
                                            user: {
                                                uuid: user.dataValues.uuid,
                                                role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                                                id:user?.dataValues?.id
                                            },
                                        };

                                        const accessToken = Jwt.sign({
                                            user: sendTokenData
                                        }, secretTokenForJWT, { expiresIn: "90d" });
                                        // console.log(user, "FIND USER");

                                        let isFirstTime = false
                                        if (user.dataValues.is_verified == 0) {
                                            isFirstTime = true
                                        }

                                        await User.update({
                                            // otp: "",
                                            // otp_expire: "",
                                            is_verified: 1
                                        }, {
                                            where: {
                                                uuid: user.dataValues.uuid
                                            }
                                        })

                                        notePortalLogin(user);
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
                        console.error(error);

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

    async studentValidateOTPCUstom(req: Request, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                otp,
                device_token,
                device_id,
                device_model
            } = req.body

            const user = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })
            if (user) {
                const viaCode = await tryStudentLoginCode(res, user, otp)
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
                            role: user.dataValues.user_type,
                            agency_uuid: user.dataValues.agency_uuid,
                            id:user?.dataValues?.id
                        },
                    };

                    const accessToken = Jwt.sign({
                        user: sendTokenData
                    }, secretTokenForJWT, { expiresIn: "90d" });
                    // console.log(user, "FIND USER");

                    let isFirstTime = false
                    if (user.dataValues.is_verified == 0) {
                        isFirstTime = true
                    }

                    await User.update({
                        // otp: "",
                        // otp_expire: "",
                        is_verified: 1
                    }, {
                        where: {
                            uuid: user.dataValues.uuid
                        }
                    })

                    notePortalLogin(user);
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


    async AdminLoginWithNumberCustomLogic(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await Admin.findOne({
                where: {
                    phone_number,
                    country_code,
                }
            })
            if (findUser && (await adminUsesLoginCode(findUser.dataValues.id))) {
                return returnHelper(res, 200, true, "Enter your 6-digit admin login code.", LOGIN_CODE_MARKER)
            }


            if (findUser) {

                // local login: fixed OTP for the test admin number, random 6 digits otherwise
                const ADMIN_TEST_NUMBERS: Record<string, string> = { "9999999999": "111111" };

                function generateOTP() {
                    return ADMIN_TEST_NUMBERS[phone_number] ?? Math.floor(100000 + Math.random() * 900000);
                }

                const createotp = generateOTP()

                console.log(createotp, "THE OTP");

                const otp = await bcrypt.hash(createotp + "", 10)

                function generateExpiryTime() {
                    // Get the current time
                    const currentTime = new Date();

                    // Add 5 minutes to the current time to get the expiration time
                    const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                    return expiryTime;
                }

                const otp_expire = generateExpiryTime()

                await Admin.update({
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
                return res.status(200).json({
                    success: false,
                    message: "Phone number not registred YET!"
                })

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }
    async adminLoginWithNumber(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await Admin.findOne({
                where: {
                    phone_number,
                    country_code,
                }
            })
            if (findUser && (await adminUsesLoginCode(findUser.dataValues.id))) {
                return returnHelper(res, 200, true, "Enter your 6-digit admin login code.", LOGIN_CODE_MARKER)
            }


            if (findUser) {

                // function generateOTP() {
                //     // Generate a random 6-digit number
                //     const otp = Math.floor(100000 + Math.random() * 900000);
                //     return otp;
                // }

                // const createotp = generateOTP()

                // console.log(createotp, "THE OTP");

                // const otp = await bcrypt.hash(createotp + "", 10)

                // function generateExpiryTime() {
                //     // Get the current time
                //     const currentTime = new Date();

                //     // Add 5 minutes to the current time to get the expiration time
                //     const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                //     return expiryTime;
                // }

                // const otp_expire = generateExpiryTime()

                // await Admin.update({
                //     otp,
                //     otp_expire
                // }, {
                //     where: {
                //         uuid: findUser.dataValues.uuid
                //     }
                // })

                if (isLocalDev() && (phone_number == "9799999999" || phone_number == "9799999998")) {
                    return res.status(200).json({
                        success: true,
                        message: "OTP has been sent successfully.",
                        verificationId: "demoid"
                    })
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
                                        return returnHelper(res,200,true,"OTP has been sent successfully.",response?.data?.data?.verificationId)
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
                return res.status(200).json({
                    success: false,
                    message: "Phone number not registred YET!"
                })

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }
    async studentLoginWithNumber(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })
            if (findUser && (await studentUsesLoginCode(findUser.dataValues.id))) {
                const prompt = await loginCodePrompt("student", findUser.dataValues.id);
                return returnHelper(res, 200, true, prompt.message, prompt.marker);
            }


            if (findUser) {

                if (isLocalDev() && (phone_number == "9799999999" || phone_number == "9799999998")) {
                    return res.status(200).json({
                        success: true,
                        message: "OTP has been sent successfully.",
                        verificationId: "demoid"
                    })
                }

                //  generate token 
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
                                        return returnHelper(res,200,true,"OTP has been sent successfully.",response?.data?.data?.verificationId)
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
                return res.status(200).json({
                    success: false,
                    message: "Phone number not registred YET!"
                })

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async studentLoginCustom(req: Request, res: Response) {
        try {

            const { phone: phone_number, country_code } = req.body

            const findUser = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    ...studentAgencyScope(req),
                }
            })
            if (findUser && (await studentUsesLoginCode(findUser.dataValues.id))) {
                const prompt = await loginCodePrompt("student", findUser.dataValues.id);
                return returnHelper(res, 200, true, prompt.message, prompt.marker);
            }


            if (findUser) {

                function generateOTP() {
                    // Generate a random 6-digit number
                    // const otp = Math.floor(100000 + Math.random() * 900000);
                    // generate 4 digit random number
                    const otp = Math.floor(1000 + Math.random() * 9000);
                    return otp;
                }

                const createotp = generateOTP()

                console.log(createotp, "THE OTP");

                const otp = await bcrypt.hash(createotp + "", 10)

                function generateExpiryTime() {
                    // Get the current time
                    const currentTime = new Date();

                    // Add 5 minutes to the current time to get the expiration time
                    const expiryTime = new Date(currentTime.getTime() + 5 * 60000); // 5 minutes in milliseconds

                    return expiryTime;
                }

                const otp_expire = generateExpiryTime()

                await User.update({
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
                return res.status(200).json({
                    success: false,
                    message: "Phone number not registred YET!"
                })

            }
        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    /** POST /user/student/request_passcode_reset — email a short-lived reset code. */
    async studentRequestPasscodeReset(req: Request, res: Response) {
        try {
            const { phone: phone_number, country_code } = req.body;
            const findUser = await User.findOne({
                where: { phone_number, country_code, ...studentAgencyScope(req) },
            });
            if (!findUser) return returnHelper(res, 200, false, "Phone number not registered.");
            if (!(await studentUsesLoginCode(findUser.dataValues.id))) {
                return returnHelper(res, 200, false, "This account uses SMS login. Use the OTP flow instead.");
            }
            const email = (findUser.dataValues.email || "").trim();
            if (!email) {
                return returnHelper(
                    res,
                    200,
                    false,
                    "No email on this account. Ask your agency to send the portal invite again.",
                );
            }
            const code = await issueStudentResetCode(findUser.dataValues.id);
            let loginUrl: string | null = null;
            let brandName: string | null = null;
            if (findUser.dataValues.agency_uuid) {
                const agency: any = await Agent.findOne({
                    where: { uuid: findUser.dataValues.agency_uuid },
                    attributes: ["app_name", "username", "domain"],
                });
                brandName = agency?.dataValues?.app_name || agency?.dataValues?.username || null;
                const domain = (agency?.dataValues?.domain || "").replace(/\/+$/, "");
                if (domain) loginUrl = domain.startsWith("http") ? `${domain}/login` : `https://${domain}/login`;
            }
            if (!loginUrl) {
                const panel = sharedPanel().replace(/\/+$/, "");
                loginUrl = panel ? panel.replace(/\/agency$/, "") + "/login" : null;
            }
            const sent = await sendPasscodeResetEmail({
                to: email,
                name: findUser.dataValues.username || "there",
                phone: `${country_code || ""} ${phone_number}`.trim(),
                code,
                loginUrl,
                panelLabel: "student portal",
                brandName,
            });
            if (!sent) {
                return returnHelper(res, 200, false, "Could not send the reset email. Ask your agency for help.");
            }
            return returnHelper(res, 200, true, `A reset code was emailed to ${email}. Check your inbox.`, {
                email_hint: email.replace(/(.{2}).+(@.+)/, "$1***$2"),
            });
        } catch (error: any) {
            return returnHelper(res, 200, false, error.message || "Could not request a reset.");
        }
    }

    /** POST /user/student/verify_passcode_reset */
    async studentVerifyPasscodeReset(req: Request, res: Response) {
        try {
            const { phone: phone_number, phone_number: phoneAlt, country_code, code, otp } = req.body;
            const phone = phone_number || phoneAlt;
            const findUser = await User.findOne({
                where: { phone_number: phone, country_code, ...studentAgencyScope(req) },
            });
            if (!findUser) return returnHelper(res, 200, false, "Phone number not registered.");
            const checked = await checkStudentResetCode(findUser.dataValues.id, code || otp);
            if (!checked.ok) return returnHelper(res, 200, false, checked.message);
            const u = findUser.dataValues;
            const setup_token = issueSetupToken({ audience: "student", id: u.id, uuid: u.uuid });
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

    /** POST /user/student/set_passcode — first login or after forgot. */
    async studentSetPasscode(req: Request, res: Response) {
        try {
            const setup = verifySetupToken(req.body?.setup_token, "student");
            if (!setup) return returnHelper(res, 200, false, "Your session to set a passcode expired. Log in again.");
            const shape = validatePasscodeShape(req.body?.passcode ?? req.body?.pin, req.body?.confirm_passcode ?? req.body?.confirm);
            if (!shape.ok) return returnHelper(res, 200, false, shape.message);

            const user = await User.findOne({
                where: { id: setup.id, uuid: setup.uuid, ...studentAgencyScope(req) },
            });
            if (!user) return returnHelper(res, 200, false, "Account not found.");

            await setStudentPasscode(setup.id, shape.pin);
            return studentLoginSuccess(res, user);
        } catch (error: any) {
            return returnHelper(res, 200, false, error.message || "Could not set passcode.");
        }
    }

    async kycTokenType(req: RequestWithUser, res: Response) {

        try {

            const role: string = req.user?.user.role || "guest"
            const roles = ["admin", "user", "agent"]
            if (!roles.includes(role)) {
                return res.status(200).json({
                    success: false,
                    message: "Auth Failed"
                })
            } else {

                const findUser: any = await User.findOne({
                    where: {
                        uuid: req.uuid
                    },
                    attributes: [
                        "uuid",
                        "username",
                        "email",
                        "password",
                        "profile_image",
                        "status",
                        "user_type",
                        "access_profile",
                        "is_verified",
                        "phone_number",
                        "country_code"
                    ]
                })
                return res.status(200).json({
                    success: true,
                    data: {
                        role: role,
                        profile: findUser?.access_profile || "",
                        name: findUser?.dataValues.username,
                        phone: findUser?.dataValues.phone_number,
                        country_code: findUser?.dataValues.country_code,
                        is_firstTime: findUser?.dataValues.is_verified == 1 ? false : true
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
    async kycTokenTypeAdmin(req: RequestWithUser, res: Response) {

        try {

            const role: string = req.user?.user.role || "guest"
            const roles = ["admin"]
            if (!roles.includes(role)) {
                return res.status(200).json({
                    success: false,
                    message: "Auth Failed"
                })
            } else {

                const findUser: any = await Admin.findOne({
                    where: {
                        uuid: req.uuid
                    },
                    attributes: [
                        "uuid",
                        "username",
                        "profile_image",
                        "user_type",
                        "access_profile",
                        "phone_number",
                        "country_code"
                    ]
                })
                return res.status(200).json({
                    success: true,
                    data: {
                        role: "admin",
                        profile: findUser?.access_profile || "",
                        name: findUser?.dataValues.username,
                        phone: findUser?.dataValues.phone_number,
                        country_code: findUser?.dataValues.country_code,
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

}


export default new UserController()