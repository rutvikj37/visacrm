import { Response } from "express"
import { assertTeamLimit, getAgencyAccess } from "../../services/saas";
import Agent from "../../model/Agent"
import { RequestWithUser } from "../../utils/types"
import { returnHelper } from "../../helpers/returnHelper"
import { Op } from "sequelize"
import Subscription from "../../model/Subscription"
import { sendLoginEmail, setLoginCode } from "../../services/agencyLogin"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

class SubAgentController {

    async canAddSubAgents(req: RequestWithUser, res: Response) {
        try {

            // SaaS plan decides the team size (null limit = unlimited)
            const access = await getAgencyAccess(req.user?.user?.agent_uuid || req.user?.user?.uuid)
            const limit = access?.plan ? access.plan.max_team_members : null

            return res.status(200).json({
                success: true,
                message: 'Records Found',
                data: { limit, used: access?.team_count || 0, unlimited: limit === null }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    /**
     * POST /sub_agent/add { phone_number, user_name, email, designation }
     * Creates a team member and emails them a fixed 6-digit login code (mobile number + code to log in).
     * If the email can't be sent, the code is returned once so the owner can share it.
     */
    async addSubAgent(req: RequestWithUser, res: Response) {
        try {
            const b = req.body || {};
            const username = String(b.user_name || "").trim().slice(0, 255);
            const phone = String(b.phone_number || "").replace(/\D/g, "");
            const countryCode = String(b.country_code || "+91").trim();
            const email = String(b.email || "").trim().toLowerCase().slice(0, 255);
            const designation = b.designation ? String(b.designation).trim().slice(0, 255) : null;

            if (!username) return returnHelper(res, 200, false, "Please enter the member's name")
            if (phone.length !== 10) return returnHelper(res, 200, false, "Please enter a valid 10-digit mobile number")
            if (!email) return returnHelper(res, 200, false, "Please enter the member's email - their login details are sent there")
            if (!EMAIL_RE.test(email)) return returnHelper(res, 200, false, "Please enter a valid email address")

            // SaaS plan: team member limit
            try {
                await assertTeamLimit(req.user?.user?.agent_uuid || req.user?.user?.uuid)
            } catch (e: any) {
                return returnHelper(res, 200, false, e.message)
            }

            const created: any = await Agent.create({
                email,
                username,
                phone_number: phone,
                designation,
                country_code: countryCode,
                role: "sub-agent",
                parent_uuid: req.user?.user?.uuid,
                parent_id: req.user?.user?.id
            })

            const owner: any = await Agent.findOne({ where: { id: req.user?.user?.id }, attributes: ["username", "app_name"] })
            const code = await setLoginCode(created.dataValues.id)
            const sent = await sendLoginEmail({
                to: email, ownerName: username, phone: `${countryCode} ${phone}`, code,
                agencyName: owner?.dataValues?.app_name || null, invitedBy: owner?.dataValues?.username || "Your agency owner",
            })
            return returnHelper(res, 200, true,
                sent ? `${username} added. Login details were emailed to ${email}.` : `${username} added, but the email could not be sent - share the login code yourself.`,
                { id: created.dataValues.uuid, email_sent: sent, ...(sent ? {} : { login_code: code, phone: `${countryCode} ${phone}` }) })
        } catch (error: any) {
            console.error("addSubAgent failed", error)
            return returnHelper(res, 200, false, "Could not add the team member. Please try again.")
        }
    }

    /** POST /sub_agent/send_login { uuid }  - new login code by email for one of this agency's team members */
    async sendLoginDetails(req: RequestWithUser, res: Response) {
        try {
            const member: any = await Agent.findOne({
                where: { uuid: req.body?.uuid, parent_uuid: req.user?.user?.uuid, role: { [Op.ne]: "agent" } },
                attributes: ["id", "username", "email", "phone_number", "country_code"],
            })
            if (!member) return returnHelper(res, 200, false, "Team member not found")
            const m = member.dataValues
            if (!m.email || !EMAIL_RE.test(m.email)) return returnHelper(res, 200, false, "Add a valid email for this member first (Edit), then send the code.")
            const owner: any = await Agent.findOne({ where: { id: req.user?.user?.id }, attributes: ["username", "app_name"] })
            const code = await setLoginCode(m.id)
            const phone = `${m.country_code || ""} ${m.phone_number || ""}`.trim()
            const sent = await sendLoginEmail({
                to: m.email, ownerName: m.username, phone, code, reset: true,
                agencyName: owner?.dataValues?.app_name || null, invitedBy: owner?.dataValues?.username || "Your agency owner",
            })
            return returnHelper(res, 200, true,
                sent ? `New login code emailed to ${m.email}. Their old code no longer works.` : "New login code created, but the email could not be sent - share it yourself.",
                { email_sent: sent, ...(sent ? {} : { login_code: code, phone }) })
        } catch (error: any) {
            console.error("sub_agent sendLoginDetails failed", error)
            return returnHelper(res, 200, false, "Could not send the login code. Please try again.")
        }
    }

    async agentUpdate(req: RequestWithUser, res: Response) {
        try {

            const { user_name: username, email, uuid, designation } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide All Params")
            }
            const updateParams = {
                ...(username && { username }),
                ...(email && { email }),
                ...(designation && { designation }),
            }
            // only this agency's own team members
            await Agent.update(updateParams, {
                where: {
                    uuid,
                    parent_uuid: req.user?.user?.uuid
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

    async deleteSubAgent(req: RequestWithUser, res: Response) {
        try {

            const { uuid } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide All Params")
            }

            const findSubAgent = await Agent.findOne({
                where: {
                    uuid: uuid,
                    parent_uuid: req.user?.user?.uuid
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

    async toggleSubAgent(req: RequestWithUser, res: Response) {
        try {

            const { uuid, action } = req.body

            if (!uuid) {
                return returnHelper(res, 200, false, "Please Provide All Params")
            }

            const findSubAgent = await Agent.findOne({
                where: {
                    uuid: uuid,
                    parent_uuid: req.user?.user?.uuid
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
                message: "Sub Agent Deleted",
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }

    async listSubAgent(req: RequestWithUser, res: Response) {
        try {

            const { search, offset } = req.body

            const searchCondition = search
                ? {
                    [Op.or]: [
                        { phone_number: { [Op.like]: `%${search}%` } },  // search by phone number
                        { username: { [Op.like]: `%${search}%` } },      // search by username
                        { email: { [Op.like]: `%${search}%` } },         // search by email
                    ],
                    parent_uuid: req.user?.user?.uuid,
                    role: "sub-agent"
                }
                : {
                    parent_uuid: req.user?.user?.uuid,
                    role: "sub-agent"
                };

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
                    "designation",
                    "team_role",
                    "branch_id",
                    "status",
                    "is_verified",
                    "profile_image",
                    "access_profile",
                    "createdAt",
                ],
                offset: offset,
                limit: 10,
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

    async allListSubAgent(req: RequestWithUser, res: Response) {
        try {

            const searchCondition = {
                parent_uuid: req.user?.user?.uuid,
                role: "sub-agent",
                status: "active"
            };

            const findAllAgents = await Agent.findAll({
                where: searchCondition,
                attributes: [
                    "uuid",
                    "username",
                    "designation",
                    "profile_image",
                    "access_profile",
                    "createdAt",
                ],
                order: [["createdAt", "DESC"]]
            })

            return res.status(200).json({
                success: true,
                message: "Records Found",
                data: findAllAgents,
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }
    async allListDropDownSubAgent(req: RequestWithUser, res: Response) {
        try {

            const searchCondition = {
                parent_id: req.user?.user?.agent_id,
                role: "sub-agent",
                status: "active"
            };

            const findAllAgents = await Agent.findAll({
                where: searchCondition,
                attributes: [
                    "id",
                    "uuid",
                    "username",
                    "designation",
                ],
                order: [["createdAt", "DESC"]]
            })

            return res.status(200).json({
                success: true,
                message: "Records Found",
                data: findAllAgents,
            })

        } catch (error: any) {
            return res.status(200).json({
                success: false,
                message: error.message
            })
        }
    }




}


export default new SubAgentController()