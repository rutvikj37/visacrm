import { branchFilter } from "../../services/branches";
import { Response } from "express";
import { caseScope } from "../../helpers/access";
import { RequestWithUser } from "../../utils/types";
import AgencyLeads from "../../model/AgencyLeads";
import { returnHelper } from "../../helpers/returnHelper";
import RaisedApplications from "../../model/RaisedApplications";
import User from "../../model/User";
import sequelize from "sequelize";
import Subscription from "../../model/Subscription";
import { Op } from "sequelize";
import Agent from "../../model/Agent";
import AgencyLeadsAssignHistory from "../../model/AgencyLeadsAssignHistory";
import StudentBasicDetails from "../../model/StudentBasicDetails";
import AgentService from "../../model/AgentServices";
import { AgentProfile } from "../../model/AgentProfile";
import AgentCountrySpecialization from "../../model/AgentCountrySpecialization";
import LeadsCalendar from "../../model/LeadsCalendar";
import StudentCoins from "../../model/StudentCoins";

class LeadsController {

    async canAddOfflineLead(req: RequestWithUser, res: Response) {
        try {
            const subscriptions = await Subscription.findOne({
                where: {
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "uuid",
                    "can_add_offline_leads",
                    "offline_lead_end_date"
                ],
                order: [["createdAt", "DESC"]]
            });

            return returnHelper(res, 200, true, "Subscriptions Found", subscriptions);
        } catch (error) {
            console.log(error, "ERROR IN canAddOfflineLead")
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getIncomingLeads(req: RequestWithUser, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = (page - 1) * limit;

            const { count, rows: getLeads } = await AgencyLeads.findAndCountAll({
                where: {
                    agent_uuid: req.user.user.agent_uuid,
                    status: ["pending", "suggested"]
                },
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'raised_aplication_id', 'status', "createdAt"]
            });

            const totalPages = Math.ceil(count / limit);

            return returnHelper(res, 200, true, "Leads fetched successfully", {
                leads: getLeads,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: count,
                    itemsPerPage: limit
                }
            });

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }
    async getIncomingLeadsStudents(req: RequestWithUser, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = (page - 1) * limit;

            const status = req.query.status as string;
            // console.log(,"status");

            const selected_intake_year = req.query.selected_intake_year as string;
            const selected_country = req.query.selected_country as string;

            const search = req.query.search as string;


            const whereCondition = {
                status: status?.split(","),
                ...caseScope(req),
                ...branchFilter(req),
                ...((selected_country && selected_country?.trim() !== "") && { selected_country }),
                ...((selected_intake_year && selected_intake_year?.trim() !== "") && { selected_intake_year }),
            };

            const userWhereCondition = search?.trim()
                ? {
                    [Op.or]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('user_of.username')), {
                            [Op.like]: `%${search.toLowerCase()}%`
                        }),
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('user_of.email')), {
                            [Op.like]: `%${search.toLowerCase()}%`
                        }),
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('user_of.phone_number')), {
                            [Op.like]: `%${search.toLowerCase()}%`
                        })
                    ]
                }
                : {};

            const getLeads = await AgencyLeads.findAll({
                where: whereCondition,
                include: [
                    {
                        model: User,
                        as: "user_of",
                        attributes: ["email", "phone_number", "username", "uuid"],
                        required: true,
                        where: userWhereCondition
                    },
                    {
                        model: RaisedApplications,
                        as: "application_of",
                        attributes: ["fieldOfStudy", "intake", "programLevel", "state", "tuitionFees", "universityType", "country"],
                        required: true
                    }
                ],
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'raised_aplication_id', 'status', "assign_id", "selected_suggestion", "createdAt", "selected_intake_year", "selected_country", "lead_type"]
            });

            const count = await AgencyLeads.count({
                where: whereCondition,
            })

            const totalPages = Math.ceil(count / limit);

            return returnHelper(res, 200, true, "Leads fetched successfully", {
                leads: getLeads,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: count,
                    itemsPerPage: limit
                }
            });

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getLeadDetails(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.body

            // the application must have a lead for this agency
            const ownLead = await AgencyLeads.findOne({
                where: { raised_aplication_id: id, agent_uuid: req?.user?.user?.agent_uuid },
                attributes: ["id"]
            })
            if (!ownLead) {
                return returnHelper(res, 200, false, "No details found")
            }

            const details = await RaisedApplications.findOne({
                where: {
                    id: id
                },
                attributes: ["id", "fieldOfStudy", "intake", "otherOption", "programLevel", "range", "state", "tuitionFees", "university", "universityType", "lat", "lng", "country", "status"]
            })

            if (!details) {
                return returnHelper(res, 200, false, "No details found")
            }

            const studentID = await RaisedApplications.findOne({
                where: {
                    id: id
                },
                attributes: ["student_id"]
            })

            // student details
            const findUser = await User.findOne({
                where: {
                    id: studentID?.dataValues?.student_id
                },
                attributes: ["username"]
            })

            const findIncomingLead = await AgencyLeads.findOne({
                where: {
                    raised_aplication_id: id
                },
                attributes: ["suggestions", "id", "status"]
            })

            if (!findIncomingLead) {
                return returnHelper(res, 200, false, "No details found")
            }


            return returnHelper(res, 200, true, "Leads fetched successfully", { details, user: findUser, lead: findIncomingLead })

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async provideSuggestions(req: RequestWithUser, res: Response) {
        try {

            const { id, suggestions } = req.body

            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const findRaisedApplication = await RaisedApplications.findOne({
                where: {
                    id: id
                },
                attributes: ["id", "suggestions"]
            })

            if (!findRaisedApplication) {
                return returnHelper(res, 200, false, "Raised Application Not Found")
            }

            const details = await AgencyLeads.findOne({
                where: {
                    raised_aplication_id: id,
                    agent_uuid: req.user.user.agent_uuid
                },
                attributes: ["id"]
            })

            if (!details) {
                return returnHelper(res, 200, false, "Can Not Provide Suggestions")
            }

            await AgencyLeads.update({
                suggestions: JSON.stringify(suggestions),
                status: "suggested"
            },
                {
                    where: {
                        id: details?.dataValues?.id
                    }
                }
            )

            await RaisedApplications.update({
                // status: "suggested",
                suggestions: Number(findRaisedApplication?.dataValues?.suggestions) + 1
            },
                {
                    where: {
                        id: id
                    }
                }
            )

            return returnHelper(res, 200, true, "Suggestions Providede Successfully")

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getSuggestions(req: RequestWithUser, res: Response) {
        try {

            const { id } = req.query
            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const details = await AgencyLeads.findAll({
                where: {
                    raised_aplication_id: id,
                    status: "suggested",
                },
                attributes: [
                    "agent_uuid",
                    "suggestions",
                    "updatedAt",
                    "id"
                ],
                include: [
                    {
                        model: Agent,
                        as: "lead_of",
                        attributes: ["app_name", "username"]
                    }
                ]
            });

            details.map(item => {
                item.dataValues.lead_of.username = item.dataValues.lead_of.app_name;
            })

            // here find all agents and append tags if subscription include activations 

            // const activeSubscriptions = await Subscription.findAll({
            //     where: {
            //         agent_uuid: details?.map(item => item?.dataValues?.agent_uuid),
            //         pin_end_date: {
            //             [Op.or]: {
            //                 [Op.not]: null,
            //                 [Op.gte]: new Date()
            //             }
            //         },
            //         leads_remaining: {
            //             [Op.gt]: 0
            //         }
            //     },
            //     attributes: ["pin_end_date", "agent_uuid"]
            // })

            // now make an array of agents with those active subscriptions end date of pinning 

            // const agentsWithPinning = {}

            // activeSubscriptions?.map(item => {
            //     agentsWithPinning[item?.dataValues?.agent_uuid] = {
            //         agent_uuid: item?.dataValues?.agent_uuid,
            //         pin_end_date: item?.dataValues?.pin_end_date
            //     }
            // })


            // now find the agents with suggestions and append the pinning end date
            // const finalReturnRecords = []

            // details?.map(item => {
            //     finalReturnRecords.push({
            //         ...item?.dataValues,
            //         // lead_of: {username: item?.dataValues?.lead_of?.username?.length},
            //         lead_of: { username: "******" },
            //         // item?.lead_of : "****",
            //         // is_pinned: agentsWithPinning[item?.dataValues?.agent_uuid]
            //     })
            // })

            return returnHelper(res, 200, true, "Suggestions Providede Successfully", details)

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    // async selectSuggestion(req: RequestWithUser, res: Response) {
    //     try {

    //         const { id, selected_index } = req.body

    //         if (!id || selected_index == undefined) {
    //             return returnHelper(res, 200, false, "Invalid Action")
    //         }

    //         const details = await AgencyLeads.findOne({
    //             where: {
    //                 id: id,
    //                 status: "suggested"
    //             },
    //             attributes: [
    //                 "id", 
    //                 "raised_aplication_id", 
    //                 "agent_uuid",
    //                 "user_id",
    //                 "suggestions",
    //                 "selected_suggestion",
    //                 "selected_country",
    //             ]
    //         })

    //         if (!details) {
    //             return returnHelper(res, 200, false, "Invalid Action")
    //         }

    //         const findAgent = await Agent.findOne({
    //             where: {
    //                 uuid: details?.dataValues?.agent_uuid
    //             },
    //             attributes: ["id", "username"]
    //         })

    //         if (!findAgent) {
    //             returnHelper(res, 200, false, "Invalid Action")
    //         }

    //         // raise application check 
    //         const findRaisedApplication = await RaisedApplications.findOne({
    //             where: {
    //                 id: details?.dataValues?.raised_aplication_id,
    //             },
    //             attributes: ["id", "suggestions"]
    //         })

    //         if (!findRaisedApplication) {
    //             return returnHelper(res, 200, false, "Invalid Action")
    //         }

    //         // here add some machinism to check coin >1 if yes than reduce one else you can not select any option please purchase coins first from user account 
    //         const isAbleToContinue = await User.findOne({
    //             where: {
    //                 id: req?.id
    //             },
    //             attributes: ["coins_balance"]
    //         })

    //         if (isAbleToContinue && isAbleToContinue?.dataValues?.coins_balance < 1) {
    //             return returnHelper(res, 200, false, "You don't have enough coins to select a suggestion")
    //         }

    //         const findSelectedOption = (JSON.parse(details?.dataValues?.suggestions))?.find((item, index) => index === Number(selected_index))

    //         await AgencyLeads.update({
    //             status: "accepted",
    //             selected_suggestion: JSON.stringify(findSelectedOption),
    //             selected_country: findSelectedOption?.country,
    //             selected_intake_year: findSelectedOption?.intakeYear,
    //         },
    //             {
    //                 where: {
    //                     id: details?.dataValues?.id
    //                 }
    //             }
    //         )

    //         // now update the raised application - 1 for suggestions 
    //         await RaisedApplications.update({
    //             suggestions: findRaisedApplication?.dataValues?.suggestions - 1
    //         },
    //             {
    //                 where: {
    //                     id: findRaisedApplication?.dataValues?.id
    //                 }
    //             }
    //         )

    //         // and use coin here now 
    //         await User.update({
    //             coins_balance: +isAbleToContinue?.dataValues?.coins_balance - 1
    //         },
    //             {
    //                 where: {
    //                     id: req?.user?.user?.id
    //                 }
    //             }
    //         )

    //         // add to student coin for history
    //         await StudentCoins.create({
    //             student_id: req?.user?.user?.id,
    //             used_coins: 1,
    //             coin_balance: +isAbleToContinue?.dataValues?.coins_balance - 1,
    //             transection_type: "debit",
    //             comment: "Selected Suggestion of " + findAgent?.dataValues?.username
    //         })

    //         return returnHelper(res, 200, true, "Suggestion Selected Successfully")

    //     }
    //     catch (error: any) {
    //         return returnHelper(res, 500, false, error.message);
    //     }
    // }
    async selectSuggestion(req: RequestWithUser, res: Response) {
        try {
            const { id, selected_indexes } = req.body;

            // Validate input
            if (!id || !Array.isArray(selected_indexes) || selected_indexes.length === 0) {
                return returnHelper(res, 200, false, "Invalid Action");
            }

            // Get original AgencyLeads details
            const details = await AgencyLeads.findOne({
                where: {
                    id: id,
                    status: "suggested"
                },
                attributes: [
                    "id",
                    "raised_aplication_id",
                    "agent_uuid",
                    "user_id",
                    "suggestions",
                    "selected_suggestion",
                    "selected_country",
                ]
            });

            if (!details) {
                return returnHelper(res, 200, false, "Invalid Action");
            }

            const findAgent = await Agent.findOne({
                where: {
                    uuid: details?.dataValues?.agent_uuid
                },
                attributes: ["id", "username"]
            });

            if (!findAgent) {
                return returnHelper(res, 200, false, "Invalid Action");
            }

            const findRaisedApplication = await RaisedApplications.findOne({
                where: {
                    id: details?.dataValues?.raised_aplication_id,
                },
                attributes: ["id", "suggestions"]
            });

            if (!findRaisedApplication) {
                return returnHelper(res, 200, false, "Invalid Action");
            }

            // Check coins balance (multiply by number of selections)
            // const isAbleToContinue = await User.findOne({
            //     where: {
            //         id: req?.id
            //     },
            //     attributes: ["coins_balance"]
            // });

            // if (isAbleToContinue && isAbleToContinue?.dataValues?.coins_balance < selected_indexes.length) {
            //     return returnHelper(res, 200, false, "You don't have enough coins to select suggestions");
            // }

            const parsedSuggestions = JSON.parse(details?.dataValues?.suggestions);
            const selectedOptions = selected_indexes.map(index => parsedSuggestions[index]);


            // Update original AgencyLeads with first selected index
            const firstSelectedOption = selectedOptions[0];
            await AgencyLeads.update({
                status: "visa_progress",
                selected_suggestion: JSON.stringify(firstSelectedOption),
                selected_country: firstSelectedOption?.country,
                selected_intake_year: firstSelectedOption?.intakeYear,
            }, {
                where: {
                    id: details?.dataValues?.id
                }
            });

            // Create new AgencyLeads for remaining selected indexes
            if (selected_indexes.length > 1) {
                const newAgencyLeads = selected_indexes.slice(1).map(index => ({
                    raised_aplication_id: details?.dataValues?.raised_aplication_id,
                    agent_uuid: details?.dataValues?.agent_uuid,
                    user_id: details?.dataValues?.user_id,
                    suggestions: details?.dataValues?.suggestions,
                    selected_suggestion: JSON.stringify(parsedSuggestions[index]),
                    selected_country: parsedSuggestions[index]?.country,
                    selected_intake_year: parsedSuggestions[index]?.intakeYear,
                    status: "visa_progress"
                }));

                await AgencyLeads.bulkCreate(newAgencyLeads);
            }

            // Update RaisedApplications suggestions count
            await RaisedApplications.update({
                suggestions: findRaisedApplication?.dataValues?.suggestions - 1
            }, {
                where: {
                    id: findRaisedApplication?.dataValues?.id
                }
            });

            // Update user's coins
            // const coinsUsed = selected_indexes.length;
            const coinsUsed = 1;

            // await User.update({
            //     coins_balance: +isAbleToContinue?.dataValues?.coins_balance - coinsUsed
            // }, {
            //     where: {
            //         id: req?.user?.user?.id
            //     }
            // });

            // Record coin transaction
            // await StudentCoins.create({
            //     student_id: req?.user?.user?.id,
            //     used_coins: coinsUsed,
            //     coin_balance: +isAbleToContinue?.dataValues?.coins_balance - coinsUsed,
            //     transection_type: "debit",
            //     comment: `Selected ${coinsUsed} Suggestion(s) of ${findAgent?.dataValues?.username}`
            // });

            return returnHelper(res, 200, true, "Suggestions Selected Successfully");

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async getUserAcceptedLeads(req: RequestWithUser, res: Response) {
        try {

            const details = await AgencyLeads.findAll({
                where: {
                    user_id: req?.user?.user?.id,
                    status: [
                        "accepted",
                        "assign_to_agent",
                        "application_progress",
                        "visa_progress",
                        "visa_completed",
                        "visa_rejected",
                        "in_progress",
                        // "withdrawn",
                        // "withdrawn_by_student"
                    ],
                },
                attributes: [
                    "selected_suggestion",
                    "updatedAt",
                    "status",
                    "id"
                ],
                include: [
                    {
                        model: Agent,
                        as: "lead_of",
                        attributes: ["username"]
                    }
                ],
                order: [['updatedAt', 'DESC']]
            });

            return returnHelper(res, 200, true, "Accepted Leads Fetched Successfully", details)

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async userViewAgentProfile(req: RequestWithUser, res: Response) {
        try {

            const { id } = req.params

            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const details = await AgencyLeads.findOne({
                where: {
                    id
                },
                attributes: [
                    "updatedAt",
                    "agent_uuid",
                    "id",
                    "status"
                ],
            });


            if (!details) {
                return returnHelper(res, 200, false, "Invalid Action")
            }


            // here find agent profile 
            const findAgent = await Agent.findOne({
                where: {
                    uuid: details?.dataValues?.agent_uuid
                },
                attributes: [
                    "id",
                    "username",
                    "phone_number",
                    "country_code",
                    "phone",
                    "email",
                    "app_name"
                ]
            })

            if (!findAgent) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            // service profile 
            const agentService = await AgentService.findOne({
                where: { agent_uuid: details?.dataValues?.agent_uuid },
                attributes: [
                    "courseAdvisors",
                    "courseSpecialization",
                    "universityRecommendations",
                    "partneredUniversities",
                    "fieldExpertise",
                    "universityPartners",
                    "universityPartnersList",
                    "visaConsultancy",
                    "visaSpecialization",
                    "visaSuccessRate",
                    "visaSuccessRateDetails",
                    "workVisaHelp",
                    "workVisaExperience",
                    "applicationReview",
                    "applicationTracking",
                    "applicationDeadlines",
                    "documentPreparation",
                    "documentExamples",
                    "scholarshipAssistance",
                    "scholarshipDetails",
                    "budgetPlanning",
                    "budgetDetails",
                    "languagePrep",
                    "languagePrepDetails",
                    "testPrep",
                    "careerConsulting",
                    "careerConsultingDetails",
                    "jobPlacement",
                    "internshipPrograms",
                    "accommodationHelp",
                    "accommodationHelpText",
                    "healthInsuranceOptions",
                    "healthInsuranceOptionsText",
                    "partTimeJobs",
                    "partTimeJobsText",
                    "sopWriting",
                    "sopWritingText",
                    "postGraduationJobs",
                    "flightTicketAssistance",
                ]
            });

            // lead profile 
            const leadProfile = await AgentProfile.findOne({
                where: { agent_uuid: details?.dataValues?.agent_uuid },
                attributes: [
                    "officeStreetAddress",
                    "officeCity",
                    "officeStateProvince",
                    "officeCountry",
                    "officePostalCode",
                    "officeArea",
                    "latitude",
                    "longitude",
                    "aboutUs",
                    "detailedDescription",
                    "website",
                    "socialFacebook",
                    "socialInstagram",
                    "socialLinkedIn",
                    "socialTwitter",
                    "socialYouTube",
                    "socialOther",
                    "contactEmail",
                    "contactPhoneNumber",
                    "contactWhatsApp",
                    "otherCommunicationChannels",
                    "operatingHoursWeekdays",
                    "operatingHoursWeekends",
                    "operatingHoursTimeZone",
                ]

            });

            // country specialization
            const countrySpecialization = await AgentCountrySpecialization.findAll({
                where: {
                    agent_uuid: details?.dataValues?.agent_uuid
                },
                attributes: [
                    "country"
                ]
            })

            let agent = {};
            let agentLead = {}
            // if (details?.dataValues?.status === "pending" || details?.dataValues?.status === "suggested") {
            //     // For every key in item, mask its value if it's a string (adjust the logic if only specific fields should be masked)
            //     const maskedItem = {};
            //     Object.keys(findAgent?.dataValues).forEach(key => {
            //         // Assuming you only want to mask string values. Otherwise, adjust as needed.
            //         maskedItem[key] = typeof findAgent?.dataValues[key] === "string" ? maskString(findAgent?.dataValues[key]) : findAgent?.dataValues[key];
            //     });
            //     agent = maskedItem;

            //     const leadItems = {};
            //     Object.keys(leadProfile?.dataValues).forEach(key => {
            //         // Assuming you only want to mask string values. Otherwise, adjust as needed.
            //         leadItems[key] = typeof leadProfile?.dataValues[key] === "string" ? maskString(leadProfile?.dataValues[key]) : leadProfile?.dataValues[key];
            //     });
            //     agentLead = leadItems;

            // } else {
            agent = findAgent?.dataValues;
            agentLead = leadProfile?.dataValues;
            // }

            agent['id'] = undefined

            return returnHelper(res, 200, true, "Agent Profile Fetched Successfully", {
                agent: agent,
                service: agentService,
                profile: {
                    agent_details: agentLead,
                    countries_specialization: countrySpecialization
                }
            })

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async agentViewStudentProfile(req: RequestWithUser, res: Response) {
        try {

            const { id } = req.params

            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const details = await AgencyLeads.findOne({
                where: {
                    id: id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "user_id",
                    "id",
                    "status"
                ],
            });


            if (!details) {
                return returnHelper(res, 200, false, "Invalid Action")
            }


            // find student 
            const student = await User.findOne({
                where: {
                    id: details?.dataValues?.user_id
                },
                attributes: [
                    "id",
                    "uuid",
                    "username",
                    "email",
                    "phone_number",
                    "country_code",
                    "phone",
                ]
            })

            if (!student) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            // here find user profile
            const findStudentDetails = await StudentBasicDetails.findOne({
                where: {
                    student_uuid: student?.dataValues?.uuid
                },
                attributes: [
                    "study_abroad_intentions",
                    "study_abroad_reasons",
                    "field_of_study",
                    "degree_level",
                    "career_goals",
                    "preferred_job_roles",
                    "course_selection",
                    "program_duration",
                    "test_scores",
                    "test_score_details",
                    "preferred_country",
                    "university_preferences",
                    "scholarship_requirements",
                    "scholarship_preferences",
                    "budget",
                    "academic_performance",
                    "language_proficiency_scores",
                    "work_experience",
                    "work_experience_details",
                    "interested_in_internships",
                    "preferred_internship_roles",
                    "visa_type",
                    "accommodation_needs",
                    "accommodation_preferences",
                    "health_insurance_needs",
                    "extracurricular_interests",
                    "previous_applications",
                    "previous_application_details",
                    "interested_in_part_time_jobs",
                    "interested_in_language_courses",
                    "application_documents",
                ]
            })


            //   return student 
            let returnStudent = {}

            // if (details?.dataValues?.status == "pending" || details?.dataValues?.status == "suggested") {
            //     // For every key in item, mask its value if it's a string (adjust the logic if only specific fields should be masked)
            //     const maskedItem = {};
            //     Object.keys(student?.dataValues).forEach(key => {
            //         // Assuming you only want to mask string values. Otherwise, adjust as needed.
            //         maskedItem[key] = typeof student?.dataValues[key] === "string" ? maskString(student?.dataValues[key]) : student?.dataValues[key];
            //     });
            //     returnStudent = maskedItem;
            // } else {
            //     returnStudent = student?.dataValues;
            // }

            returnStudent = student?.dataValues;



            // console.log(student?.dataValues?.id,"student?.dataValues?.id");


            // find students and agecy leads 
            const studentLead = await AgencyLeads.findAll({
                where: {
                    user_id: student?.dataValues?.id,
                    agent_uuid: req?.user?.user?.agent_uuid
                },
                attributes: [
                    "id",
                    "status",
                    "selected_suggestion",
                    "lead_type",
                    "createdAt"
                ]
            })

            returnStudent['id'] = undefined

            return returnHelper(res, 200, true, "Profile Found", {
                student: returnStudent,
                studentDetails: findStudentDetails,
                applications: studentLead
            })

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    // changeStatus

    async changeLeadStatus(req: RequestWithUser, res: Response) {
        try {

            const { id, status } = req.body

            if (!id || !status) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            if (!["accepted", "assign_to_agent", "application_progress", "visa_progress", "visa_completed", "visa_rejected", "withdrawn"].includes(status)) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const details = await AgencyLeads.findOne({
                where: {
                    id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "id"
                ],
            });

            if (!details) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            await AgencyLeads.update({
                status
            },
                {
                    where: {
                        id: details?.dataValues?.id
                    }
                }
            )

            return returnHelper(res, 200, true, "Status Changed Successfully")

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async agencyLeadDetails(req: RequestWithUser, res: Response) {
        try {

            const { id } = req.params

            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const details = await AgencyLeads.findOne({
                where: {
                    id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "id",
                    "status"
                ],
            });

            if (!details) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            return returnHelper(res, 200, true, "Details Fetched", details)

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }

    async assignLead(req: RequestWithUser, res: Response) {
        try {

            const { id, agent_id } = req.body

            if (!id || !agent_id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const details = await AgencyLeads.findOne({
                where: {
                    id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "id",
                    "assign_id",
                    "status"
                ],
            });

            if (!details) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            await AgencyLeads.update({
                assign_id: agent_id,
                ...((details?.dataValues?.status == "accepted" || details?.dataValues?.status == "suggested") && { status: "assign_to_agent" })
            },
                {
                    where: {
                        id: details?.dataValues?.id
                    }
                }
            )

            // update lead assignemtn 
            await AgencyLeadsAssignHistory.create({
                lead_id: id,
                assign_to: agent_id,
                previous_assign_id: details?.dataValues?.assign_id,
                assign_by: req?.user?.user?.id
            })

            return returnHelper(res, 200, true, "Assigned Successfully")

        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }


    // events 

    // add_event
    async eventCreate(req: RequestWithUser, res: Response) {

        try {

            const {
                description,
                lead_id,
                event_type,
                date,
                time,
                assgin_to
            } = req.body

            if (!lead_id || !time) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            if (!event_type) {
                return returnHelper(res, 200, false, "Please Select Event Type")
            }

            const eventMustBe = ['event', 'reminder', 'followup', 'task']

            if (!eventMustBe.includes(event_type)) {
                return returnHelper(res, 200, false, "Provide Valid event type")
            }

            if (!date) {
                return returnHelper(res, 200, false, "Please Provide event Date")
            }

            const leadDetails = await AgencyLeads.findOne({
                where: {
                    id: lead_id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "id",
                    "status",
                    "user_id"
                ],
            });

            if (!leadDetails) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            // disable all active events 
            await LeadsCalendar.update({
                is_last: 0
            },
                {
                    where: {
                        lead_id,
                        is_last: 1
                    }
                }
            )

            await LeadsCalendar.create({
                lead_id,
                created_by: req?.user?.user?.id,
                event_type,
                assgin_to: assgin_to ? assgin_to : req?.user?.user?.id,
                description,
                date,
                time,
                is_last: 1,
                user_id: leadDetails?.dataValues?.user_id
            })

            // last_follow_up_remark

            await AgencyLeads.update({
                last_follow_up_remark: description
            },
                {
                    where: {
                        id: lead_id
                    }
                }
            )


            return returnHelper(res, 200, true, "Event Added")

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async eventListByInquiry(req: RequestWithUser, res: Response) {

        try {

            const { lead_id } = req.params

            if (!lead_id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const leadDetails = await AgencyLeads.findOne({
                where: {
                    id: lead_id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: [
                    "id",
                    "status",
                    "user_id",
                    "raised_aplication_id"
                ],
            });

            if (!leadDetails) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const student = await User.findOne({
                where: {
                    id: leadDetails?.dataValues?.user_id
                },
                attributes: [
                    "id",
                    "username",
                    "email",
                    "phone_number",
                    "country_code",
                    "phone",
                    "profile_image",
                    "createdAt"
                ]
            })

            // find all active events 
            const allEvents = await LeadsCalendar.findAll(
                {
                    where: {
                        lead_id,
                    },
                    attributes: [
                        "description",
                        "event_type",
                        "date",
                        "time",
                        "is_done",
                        "lead_id",
                        "createdAt",
                    ],
                    order: [
                        ['createdAt', 'DESC']
                    ]
                },

            )

            return returnHelper(res, 200, true, "Event Found", { events: allEvents, student: student })

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    // active events
    async eventListForCalendar(req: RequestWithUser, res: Response) {

        try {

            const { date, event_type } = req.body

            if (!date) {
                return returnHelper(res, 200, false, "Please Select Date")
            }

            // month

            const startDate = new Date(date)

            // months first date
            startDate.setDate(1)

            const endDate = new Date(startDate)

            // end date - month's last date
            endDate.setMonth(startDate.getMonth() + 1)
            endDate.setDate(endDate.getDate() - 1)

            // console.log(startDate.toDateString(), "START DATE");
            // console.log(endDate.toDateString(), "END DATE");

            const whereCondition = {
                ...(req?.user?.user?.role == "agent" ? {
                    created_by: req?.user?.user?.id
                } : {
                    assgin_to: req?.user?.user?.id
                }),
                date: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                },
                ...(event_type && {
                    event_type: {
                        [Op.in]: [...event_type]
                    }
                }),
                is_last: 1
            }

            // disable all active events 
            const allEvents = await LeadsCalendar.findAll({
                where: whereCondition,
                attributes: [
                    "description",
                    "event_type",
                    "date",
                    "time",
                    "is_done",
                    "lead_id"
                ],
                order: [["createdAt", "DESC"]]
            },)

            return returnHelper(res, 200, true, "Event Found", allEvents)

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }


    // check student exist or not
    async checkStudentExist(req: RequestWithUser, res: Response) {
        try {

            const { phone_number, country_code } = req.body

            if (!phone_number || !country_code) {
                return returnHelper(res, 200, false, "Please provide phone number and contry code")
            }

            // only look inside this agency's own students
            const student = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    agency_uuid: req?.user?.user?.agent_uuid
                },
                attributes: [
                    "id",
                    "username",
                    "phone_number",
                    "email",
                    "createdAt"
                ]
            })

            if (!student) {
                return returnHelper(res, 200, false, "Student Not Found")
            }

            return returnHelper(res, 200, true, "Student Found", student)

        } catch (error) {
            console.log("ERROR IN checkStudentExist", error);
            return returnHelper(res, 500, false, error.message)
        }
    }


    async addOfflineInquiry(req: RequestWithUser, res: Response) {
        try {

            const {
                phone_number,
                country_code,
                name,
                email,

                country,
                fieldOfStudy,
                intakeMonth,
                intakeYear,
                otherOption,
                programLevel,
                state,
                tuitionFees,
                university,
                universityType
            } = req.body


            // check the curret package allow the agent to add offline inquiry
            // const susbcription = await Subscription.findOne({
            //     where: {
            //         agent_uuid: req?.user?.user?.agent_uuid,
            //         offline_lead_end_date: {
            //             [Op.gte]: new Date()
            //         },
            //         can_add_offline_leads: 1,
            //     }
            // })

            // if (!susbcription) {
            //     return returnHelper(res, 200, false, "You can not add offline inquiry")
            // }

            // check the student exist or not
            let student = await User.findOne({
                where: {
                    phone_number,
                    country_code,
                    agency_uuid: req?.user?.user?.agent_uuid
                },
                attributes: [
                    "id",
                    "username",
                    "phone_number",
                    "email",
                    "createdAt"
                ]
            })

            if (!student) {
                student = await User.create({
                    username: name,
                    phone_number,
                    email,
                    country_code,
                    agency_uuid: req?.user?.user?.agent_uuid,
                })
            }

            // raise an application
            const raiseApplication = await RaisedApplications.create(
                {
                    country,
                    fieldOfStudy,
                    intake: intakeMonth + " " + intakeYear,
                    otherOption,
                    programLevel,
                    state,
                    tuitionFees,
                    university,
                    universityType: universityType?.toString(),
                    student_id: student?.dataValues?.id,
                    status: "accepted"
                }
            )

            await AgencyLeads.create({
                agent_uuid: req?.user?.user?.agent_uuid,
                raised_aplication_id: raiseApplication?.dataValues?.id,
                status: "accepted",
                user_id: student?.dataValues?.id,
                lead_type: "offline",
                suggestions: JSON.stringify([{
                    country,
                    fieldOfStudy,
                    intakeMonth,
                    intakeYear,
                    otherOption,
                    programLevel,
                    state,
                    tuitionFees,
                    university,
                    universityType
                }]),
                selected_suggestion: JSON.stringify({
                    country,
                    fieldOfStudy,
                    intakeMonth,
                    intakeYear,
                    otherOption,
                    programLevel,
                    state,
                    tuitionFees,
                    university,
                    universityType
                }),
                selected_country: country,
                selected_intake_year: intakeYear
            })

            return returnHelper(res, 200, true, "Offline inquiry added successfully")
        }
        catch (error: any) {
            return returnHelper(res, 500, false, error.message);
        }
    }






}

const maskString = (str) => {
    if (!str) return "";
    return str[0] + "*".repeat(str.length - 1);
};

export default new LeadsController()