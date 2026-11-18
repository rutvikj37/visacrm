import { Response } from "express";
import { returnHelper } from "../../helpers/returnHelper";
import OfflineLanguagesMaster from "../../model/OfflineLanguagesMaster";
import { RequestWithUser } from "../../utils/types";
import OfflineLanguagesAgents from "../../model/OfflineLanguagesAgents";
import { literal, Op, QueryTypes } from "sequelize";
import AgentService from "../../model/AgentServices";
import OfflineLanguageInquiries from "../../model/OfflineLanguageInquiries";
import Agent from "../../model/Agent";
import sequelize from "../../config/dbconfig";
import { AgentProfile } from "../../model/AgentProfile";
import User from "../../model/User";
import moment from "moment";

const EARTH_RADIUS_KM = 6371;

class OfflineLanguagePreparationController {
  async addUpdateOfflineLanguagePrepADMIN(req: RequestWithUser, res: Response) {
    try {
      const { title, is_active } = req.body;
      if (!title) {
        return returnHelper(res, 200, false, "Please Provide Required Fields");
      }
      const isExist = await OfflineLanguagesMaster.findOne({
        where: {
          title,
        },
      });
      if (isExist) {
        await OfflineLanguagesMaster.update(
          {
            title,
            is_active,
          },
          {
            where: {
              uuid: isExist.dataValues.uuid,
            },
          }
        );
      } else {
        await OfflineLanguagesMaster.create({
          title,
          is_active,
        });
      }
      return returnHelper(
        res,
        200,
        true,
        "Offline Language Preparation Added Successfully"
      );
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async listADMIN(req: RequestWithUser, res: Response) {
    try {
      const offlineLanguagePreparation = await OfflineLanguagesMaster.findAll({
        attributes: ["uuid", "title", "is_active", "createdAt"],
      });
      return res.status(200).json({
        success: true,
        message: "Offline Language Preparation Found",
        data: offlineLanguagePreparation,
      });
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async listPUBLIC(req: RequestWithUser, res: Response) {
    try {
      const offlineLanguagePreparation = await OfflineLanguagesMaster.findAll({
        attributes: ["id", "title", "createdAt"],
        where: {
          is_active: 1,
        },
      });
      return res.status(200).json({
        success: true,
        message: "Offline Language Preparation Found",
        data: offlineLanguagePreparation,
      });
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async toggleStatusADMIN(req: RequestWithUser, res: Response) {
    try {
      const { uuid } = req.body;
      if (!uuid) {
        return returnHelper(res, 200, false, "Please Provide Required Fields");
      }
      const isExist = await OfflineLanguagesMaster.findOne({
        where: {
          uuid,
        },
      });
      if (isExist) {
        await OfflineLanguagesMaster.update(
          {
            is_active: isExist.dataValues.is_active == 1 ? 0 : 1,
          },
          {
            where: {
              uuid: isExist.dataValues.uuid,
            },
          }
        );
      }
      return returnHelper(res, 200, true, "Status Updated Successfully");
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async deleteADMIN(req: RequestWithUser, res: Response) {
    try {
      const { uuid } = req.body;
      if (!uuid) {
        return returnHelper(res, 200, false, "Please Provide Required Fields");
      }
      const isExist = await OfflineLanguagesMaster.findOne({
        where: {
          uuid,
        },
      });
      if (isExist) {
        await OfflineLanguagesMaster.destroy({
          where: {
            uuid: isExist.dataValues.uuid,
          },
        });
        await OfflineLanguagesAgents.destroy({
          where: {
            language_id: isExist.dataValues.id,
          },
        });
      }
      return returnHelper(res, 200, true, "Deleted Successfully");
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async addAcceptDeclineLanguages(req: RequestWithUser, res: Response) {
    try {
      const { select_language_id, deselect_langauge_id } = req.body;

      // if select_language
      if (select_language_id) {
        const isExist = await OfflineLanguagesAgents.findOne({
          where: {
            agent_id: req?.id,
            language_id: select_language_id,
            deletedAt: {
              [Op.eq]: null,
            },
          },
          paranoid: false,
        });

        if (isExist) {
          await OfflineLanguagesAgents.restore({
            where: {
              agent_id: req?.id,
              language_id: select_language_id,
            },
            paranoid: false,
          } as any);
        } else {
          await OfflineLanguagesAgents.create({
            agent_id: req?.id,
            language_id: select_language_id,
          });
        }
      }

      // if deselect_langauge
      if (deselect_langauge_id) {
        // paranid added than recover it

        await OfflineLanguagesAgents.destroy({
          where: {
            agent_id: req?.id,
            language_id: deselect_langauge_id,
          },
        });
      }

      return returnHelper(res, 200, true, "Updated Successfully");
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async selectedLanguages(req: RequestWithUser, res: Response) {
    try {
      // if select_language

      const allSelceted = await OfflineLanguagesAgents.findAll({
        where: {
          agent_id: req?.id,
        },
      });

      const languages =
        allSelceted?.map((item: any) => {
          return item.dataValues.language_id;
        }).length > 0
          ? allSelceted?.map((item: any) => {
              return item.dataValues.language_id;
            })
          : [];

      return returnHelper(res, 200, true, "Updated Successfully", languages);
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async doesAcceptOffline(req: RequestWithUser, res: Response) {
    try {
      //

      const isExist = await AgentService.findOne({
        where: {
          // languagePrep:1,
          agent_uuid: req.user?.user?.uuid,
        },
      });

      return returnHelper(
        res,
        200,
        true,
        "Offline Language Preparation Found",
        {
          is_accept_offline: isExist?.dataValues?.languagePrep
            ? isExist?.dataValues?.languagePrep
            : false,
        }
      );
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async acceptOfflineLanguagePreps(req: RequestWithUser, res: Response) {
    try {

      const isExist = await AgentService.findOne({
        where: {
          // languagePrep:1,
          agent_uuid: req.user?.user?.uuid,
        },
      });

      if (isExist) {
        await AgentService.update(
          {
            languagePrep: true,
          },
          {
            where: {
              id: isExist?.dataValues?.id,
            },
          }
        );
      } else {
        await AgentService.create({
          agent_uuid: req.user?.user?.uuid,
          languagePrep: true,
        });
      }

      return returnHelper(
        res,
        200,
        true,
        "Offline Language Preparation Accepted Successfully"
      );
    } catch (error: any) {
      console.log(error, "ERROR IN acceptOfflineLanguagePreps");

      return returnHelper(res, 500, false, error.message);
    }
  }

  async makeInterest(req: RequestWithUser, res: Response) {
    try {
      const { agent_id } = req.query;
      const isExist = await OfflineLanguageInquiries.count({
        where: {
          agent_id: agent_id,
          user_id: req?.id,
        },
      });

      if (isExist > 0) {
        return returnHelper(res, 200, true, "Already Intrested");
        8;
      }

      await OfflineLanguageInquiries.create({
        agent_id: agent_id,
        user_id: req?.id,
      });

      return returnHelper(res, 200, true, "Intrested Added Successfully");
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }

  async inquiriesList(req: RequestWithUser, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const whereCondition: any = { agent_id: req?.id };
      console.log(req?.id, "req?.id");

      let start: Date;
      let end: Date;

      if (startDate && endDate) {
        // Custom date range provided
        start = moment(startDate as string)
          .startOf("day")
          .toDate(); // Sets time to 00:00:00
        end = moment(endDate as string)
          .endOf("day")
          .toDate(); // Sets time to 23:59:59

        // Validation
        if (
          !moment(startDate as string).isValid() ||
          !moment(endDate as string).isValid()
        ) {
          return returnHelper(res, 200, false, "Invalid date format");
        }
        if (moment(start).isAfter(end)) {
          return returnHelper(
            res,
            200,
            false,
            "Start date must be before end date"
          );
        }

        whereCondition.createdAt = {
          [Op.between]: [start, end],
        };
      } else {
        // Default: last 30 days
        const now = moment();
        end = now.endOf("day").toDate(); // Current date at 23:59:59
        start = now.subtract(30, "days").startOf("day").toDate(); // 30 days ago at 00:00:00
        whereCondition.createdAt = {
          [Op.between]: [start, end],
        };
      }

      const inquiries = await OfflineLanguageInquiries.findAll({
        where: whereCondition,
        include: [
          {
            model: User,
            as: "student",
            attributes: [
              "id",
              "username",
              "email",
              "phone_number",
              "country_code",
              "phone",
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      return returnHelper(res, 200, true, "Inquiries List", inquiries);
    } catch (error: any) {
      return returnHelper(res, 500, false, error.message);
    }
  }
  // async getOfflineLanguagesAgents(req: RequestWithUser, res: Response) {
  //     try {
  //         const latitude = Number(req.query.latitude);
  //         const longitude = Number(req.query.longitude);
  //         const radiusInKm = Number(req.query.radiusInKm);
  //         const selectedLanguageId = req.query.selected_language_id;

  //         if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInKm)) {
  //             return returnHelper(res, 400, false, "Invalid geographic parameters");
  //         }

  //         const distanceExpr = literal(`
  //         (${EARTH_RADIUS_KM} * ACOS(
  //           COS(RADIANS(${latitude})) *
  //           COS(RADIANS(latitude)) *
  //           COS(RADIANS(longitude) - RADIANS(${longitude})) +
  //           SIN(RADIANS(${latitude})) *
  //           SIN(RADIANS(latitude))
  //         ))
  //       `);

  //         // Single query with subqueries for filtering
  //         const agents = await Agent.findAll({
  //             attributes: [
  //                 "id",
  //                 "uuid",
  //                 "name",
  //                 [distanceExpr, "distance"], // Add distance to output
  //             ],
  //             where: {
  //                 uuid: {
  //                     [Op.in]: literal(`
  //               (SELECT agent_uuid FROM agent_profiles
  //                WHERE ${distanceExpr} <= ${radiusInKm}
  //                AND agent_uuid IN (
  //                  SELECT agent_uuid FROM subscription
  //                  WHERE leads_remaining > 0
  //                ))
  //             `),
  //                 },
  //                 status: "active",
  //                 role: "agent",
  //             },
  //             include: [{
  //                 model: OfflineLanguagesAgents,
  //                 as: "languages",
  //                 attributes: ["language_id"],
  //                 where: selectedLanguageId
  //                     ? {
  //                         language_id: {
  //                             [Op.in]: Array.isArray(selectedLanguageId)
  //                                 ? selectedLanguageId.map(Number)
  //                                 : [Number(selectedLanguageId)],
  //                         },
  //                     }
  //                     : undefined,
  //                 required: !!selectedLanguageId,
  //             }],
  //             order: [[literal("distance"), "ASC"]],
  //         });

  //         if (!agents.length) {
  //             return returnHelper(res, 200, false, "No agents found within specified radius");
  //         }

  //         const formattedAgents = agents.map(agent => ({
  //             id: agent?.dataValues?.id,
  //             uuid: agent?.dataValues?.uuid,
  //             name: agent?.dataValues?.name,
  //             languages: (agent as any).languages?.map((lang: any) => lang.language_id) || [],
  //             distance: (agent as any).getDataValue("distance"), // Include distance if needed
  //         }));

  //         return returnHelper(res, 200, true, "Agents fetched successfully", {
  //             agents: formattedAgents,
  //         });
  //     } catch (err: any) {
  //         console.error("Error fetching offline language agents:", err);
  //         return returnHelper(res, 500, false, "Internal server error");
  //     }
  // }
  async getOfflineLanguagesAgents(req: RequestWithUser, res: Response) {
    try {
      // const latitude = Number(req.query.latitude);
      // const longitude = Number(req.query.longitude);
      // const radiusInKm = Number(req.query.radiusInKm);
      const selectedLanguageId = req.query.selected_language_id as string;
      const finalSelectedLanguage =
        selectedLanguageId?.split(",")?.map(function (item) {
          return Number(item);
        }).length > 0
          ? selectedLanguageId?.split(",")?.map(function (item) {
              return Number(item);
            })
          : [];
      const agent_uuid = req.query.agent_uuid as string;
      // console.log(finalSelectedLanguage,"finalSelectedLanguage");

      // if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInKm)) {
      //     return returnHelper(res, 200, false, "Invalid geographic parameters");
      // }

      // Get all agents within radius and have active subscription with leads
      // const validAgentUUIDs = await sequelize.query(
      //     `
      //    SELECT DISTINCT ap.agent_uuid
      //     FROM agent_profiles ap
      //     JOIN (
      //         SELECT s.agent_uuid, s.leads_remaining
      //         FROM subscription s
      //         WHERE s.createdAt = (
      //             SELECT MAX(s2.createdAt)
      //             FROM subscription s2
      //             WHERE s2.agent_uuid = s.agent_uuid
      //         )
      //     ) latest_sub ON ap.agent_uuid = latest_sub.agent_uuid
      //     WHERE latest_sub.leads_remaining > 0
      //     AND (6371 * ACOS(
      //         COS(RADIANS(:latitude)) * COS(RADIANS(ap.latitude)) *
      //         COS(RADIANS(ap.longitude) - RADIANS(:longitude)) +
      //         SIN(RADIANS(:latitude)) * SIN(RADIANS(ap.latitude))
      //     )) <= :radiusInKm
      //     `,
      //     {
      //         // replacements: { latitude, longitude, radiusInKm },
      //         type: QueryTypes.SELECT,
      //     }
      // );

      // Extract UUIDs from the result
      // const agentUUIDs = validAgentUUIDs.map((row: any) => row.agent_uuid);

      // if (!agentUUIDs.length) {
      //     return returnHelper(res, 200, false, "No agents found within specified radius");
      // }

      // existing OfflineLanguageInquiries intrested done by user
      const existingInquiries = await OfflineLanguageInquiries.findAll({
        where: {
          user_id: req?.id,
        //   agent_id: agent_uuid,
        },
        attributes: ["agent_id"],
      });

      const notIncludeAgentsIds = existingInquiries.map(
        (inquiry: any) => inquiry?.dataValues?.agent_id
      );
      // console.log(notIncludeAgentsIds,"notIncludeAgentsIds");

      // Fetch agents with filtered UUIDs and optional language filter
      const agents = await Agent.findAll({
        attributes: ["id", "uuid", "username"],
        where: {
          [Op.and]: {
            //     uuid: { [Op.in]: agentUUIDs },
            uuid: agent_uuid,
            id: { [Op.notIn]: notIncludeAgentsIds },
          },

          status: "active",
          role: "agent",
        },
        include: [
          {
            model: OfflineLanguagesAgents,
            as: "languages",
            attributes: ["language_id"],
            where:
              finalSelectedLanguage.length > 0
                ? {
                    language_id: {
                      [Op.in]: finalSelectedLanguage,
                    },
                  }
                : undefined,
            required: finalSelectedLanguage.length > 0,
          },
          {
            model: AgentProfile, // Join with AgentProfile
            as: "profile", // Use the alias from the association
            attributes: ["latitude", "longitude"], // Ensure these fields are available
            required: true, // Ensure only agents with profiles are returned
          },
        ],
        // order: [[literal("distance"), "ASC"]],
      });

      if (!agents.length) {
        return returnHelper(
          res,
          200,
          false,
          "No agents found with the selected language"
        );
      }

      // Formatting the response
      const formattedAgents = agents.map((agent) => ({
        id: agent?.dataValues?.id,
        uuid: agent?.dataValues?.uuid,
        name: agent?.dataValues?.username,
        languages:
          (agent as any).languages?.map((lang: any) => lang.language_id) || [],
        // distance: (agent as any).getDataValue("distance"),
      }));

      return returnHelper(res, 200, true, "Agents fetched successfully", {
        agents: formattedAgents,
      });
    } catch (err: any) {
      console.error("Error fetching offline language agents:", err);
      return returnHelper(res, 500, false, "Internal server error");
    }
  }
}

export default new OfflineLanguagePreparationController();
