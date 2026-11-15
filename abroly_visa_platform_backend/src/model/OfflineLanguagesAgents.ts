import { DataType, DataTypes, ModelDefined, Optional, TinyIntegerDataType } from "sequelize";
import sequelize from "../config/dbconfig";

const OfflineLanguagesAgents = sequelize.define(
  'OfflineLanguagesAgents',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    language_id: {
      type: DataTypes.INTEGER,
    },
    agent_id: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: 'offline_languages_agents',
    paranoid: true,
    timestamps: true,
  }
)


export default OfflineLanguagesAgents


/**
now based on this
i want to apply a filter for selected language ids from student
where student can select multiple languages or select null languages
when student select null languages then it should not show any language
but if student select any language then it should show only the languages that are selected by student
now i dont want to dispaly languages, i want to display agent profiles 
where i want to display the list of agents and their provided languages in list
this must follow the pagination here 
and filters of languages - here selected_language_id should pass and based on that selection should be done


apart from that there is other filter too it will be like this 

     const nerabyAgents = await AgentProfile.findAll({
            attributes: [
                "agent_uuid",
                [
                    Sequelize.literal(`
                            (${earthRadiusInKm} * ACOS(
                                COS(RADIANS(${latitude})) *
                                COS(RADIANS(latitude)) *
                                COS(RADIANS(longitude) - RADIANS(${longitude})) +
                                SIN(RADIANS(${latitude})) *
                                SIN(RADIANS(latitude))
                            ))
                        `),
                    'distance'
                ]
            ],
            where: Sequelize.literal(`
                    (${earthRadiusInKm} * ACOS(
                        COS(RADIANS(${latitude})) *
                        COS(RADIANS(latitude)) *
                        COS(RADIANS(longitude) - RADIANS(${longitude})) +
                        SIN(RADIANS(${latitude})) *
                        SIN(RADIANS(latitude))
                    )) <= ${radiusInKm}
                `),
            // logging: console.log, // Print SQL query
        });

        // console.log(nerabyAgents, "nerabyAgents")


        if (nerabyAgents && nerabyAgents.length > 0) {
            const agentUuids = nerabyAgents.map((agent) => agent?.dataValues?.agent_uuid);

            // filter with active subscription 
            const activeSubscriptions = await Subscription.findAll({
                where: {
                    agent_uuid: {
                        [Op.in]: agentUuids,
                    },
                    leads_remaining: {
                        [Op.gt]: 0
                    }
                },
                attributes: ["agent_uuid"],
            });


            if (activeSubscriptions?.length == 0) {
                return returnHelper(res, 200, false, "No Agents Profile found")
            }


            // filter with active agent
            const filterdAgentUUIDS = activeSubscriptions.map((subscription) => subscription?.dataValues?.agent_uuid);

            const agentProfiles = await Agent.findAll({
                where: {
                    uuid: {
                        [Op.in]: filterdAgentUUIDS,
                    },
                    status: "active",
                },
            });


            if (agentProfiles?.length == 0) {
                return returnHelper(res, 200, false, "No Agents Profile found")
            } else {

                const agentIds = agentProfiles.map((agent) => agent?.dataValues?.id);


                and based on those agentIds result should be shown 

                now please optimize this query and make it more efficient to provide records based on pagination 
                and latlng related query i can not make it every timn when i hit for pagination

                please create a function that does all this above mention stuff 

                it should be like this

                async getOfflineLanguagesAgents(req: Request, res: Response) {
                try{
                  ... rest of the code
                  }
                catch(err){
                retun returnHelper(res, 500, false, err.message)
                }
                }
 */