import { Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { AgentProfile } from "../../model/AgentProfile";
import Agent from "../../model/Agent";
import Subscription from "../../model/Subscription";
import RaisedApplications from "../../model/RaisedApplications";
import User from "../../model/User";
import { ingestLead, LeadValidationError } from "../../services/leadIngestion";
import AgentCountrySpecialization from "../../model/AgentCountrySpecialization";
const { Op, Sequelize } = require("sequelize");

const radiusInKm = 15;
const earthRadiusInKm = 6371;
class RaiseApplicationController {
  async raiseApplication(req: RequestWithUser, res: Response) {
    try {
      const {
        country,
        fieldOfStudy,
        intake,
        otherOption,
        programLevel,
        range,
        state,
        tuitionFees,
        university,
        universityType,
        // latitude,
        // longitude,
        // agency_id: agentUUID,
        agency_id: agentUUID,
      } = req.body;
      const user = req.uuid;
      if (!user) {
        return returnHelper(res, 400, false, "User not found");
      }

      

    //   if (!country ||
    //       !fieldOfStudy ||
    //       !intake ||
    //       !otherOption ||
    //       !programLevel ||
    //       !state ||
    //       !tuitionFees ||
    //       !university ||
    //       !universityType ||
    //       !latitude ||
    //       !longitude ||
    //       !agentUUID) {
    //       return returnHelper(res, 200, false, "Please provide all fields")
    //   }

      const agentProfiles = await Agent.findOne({
        where: {
          uuid: agentUUID,
        //   status: "active",
        },
      });

      if (!agentProfiles) {

        return returnHelper(res, 200, false, "No Agents Profile found");
      } else {
        if(agentProfiles?.dataValues?.status !== "active"){
          return returnHelper(res, 200, false, "Agent Profile Inactive, You can not raise application for this agent");
        }

        // raise application
        const raiseApplication = await RaisedApplications.create({
          country,
          fieldOfStudy,
          intake,
          otherOption,
          programLevel,
          range: 10,
          state,
          tuitionFees,
          university,
          universityType: universityType?.toString(),
          // lat: latitude,
          // lng: longitude,
          student_id: req?.user?.user?.id,
          status: "pending",
        });

        if (raiseApplication) {
          // SaaS: the request goes to the agency's Lead Inbox (not the old marketplace lead list)
          const student: any = await User.findOne({
            where: { id: req?.user?.user?.id },
            attributes: ["id", "username", "email", "phone_number", "country_code"],
          });
          try {
            await ingestLead({
              agencyUuid: agentUUID,
              source: "portal",
              input: {
                name: student?.dataValues?.username || null,
                phone: student?.dataValues?.phone_number || null,
                country_code: student?.dataValues?.country_code || null,
                email: student?.dataValues?.email || null,
                interested_country: country || null,
                interested_course: fieldOfStudy || null,
                intake: intake || null,
                message: "Visa consultation request from the student portal",
                campaign: "Visa consultation",
                source_ref: `raised_application:${raiseApplication?.dataValues?.id}`,
                extra: {
                  program_level: programLevel || null,
                  university: university || null,
                  university_type: universityType ? String(universityType) : null,
                  state: state || null,
                  tuition_fees: tuitionFees || null,
                  other: otherOption || null,
                  student_id: student?.dataValues?.id || null,
                },
              },
            });
          } catch (error) {
            if (!(error instanceof LeadValidationError)) throw error;
          }

          return returnHelper(
            res,
            200,
            true,
            "Application raised successfully, you will be contacted soon"
          );
        } else {
          return returnHelper(res, 200, false, "Something went wrong");
        }
      }
    } catch (error) {
      console.log(error, "ERROR IN RAISE APPLICATION");

      return returnHelper(res, 500, false, "Something went wrong");
    }
  }

  async previousRaisedApplications(req: RequestWithUser, res: Response) {
    try {
      const findAllList = await RaisedApplications.findAll({
        where: {
          student_id: req?.user?.user?.id,
        },
        order: [["createdAt", "DESC"]],
      });

      return returnHelper(
        res,
        200,
        true,
        "Find Previous Raised Applications",
        findAllList
      );
    } catch (error) {
      console.log(error, "ERROR IN previousRaisedApplications");

      return returnHelper(res, 500, false, "Something went wrong");
    }
  }
}

export default new RaiseApplicationController();
