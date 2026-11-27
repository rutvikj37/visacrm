import { saveFile, deleteFile, ownerFromRequest } from "../../helpers/storage";
import { Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { AgentProfile, BranchOffice, Certification, Language } from "../../model/AgentProfile";
import { returnHelper } from "../../helpers/returnHelper";
import fs from 'fs'
import path from 'path'
import Agent from "../../model/Agent";
import AgentService from "../../model/AgentServices";
import AgentCountrySpecialization from "../../model/AgentCountrySpecialization";
import OfflineLanguagesAgents from "../../model/OfflineLanguagesAgents";

class AgentProfileController {

    async getAgentOfficeAddress(req: RequestWithUser, res: Response) {

        try {
            const agentUuid = req.user?.user?.uuid;

            // Check if the agent profile already exists
            let agentProfile = await AgentProfile.findOne({
                where: { agent_uuid: agentUuid },
                attributes: [
                    "officeStreetAddress",
                    "officeCity",
                    "officeStateProvince",
                    "officeCountry",
                    "officePostalCode",
                    "officeArea",
                    "latitude",
                    "longitude",
                ]
            });

            return returnHelper(res, 200, true, "Profile Found", agentProfile)
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async getAgentAboutUs(req: RequestWithUser, res: Response) {

        try {
            const agentUuid = req.user?.user?.uuid;

            // Check if the agent profile already exists
            let agentProfile = await AgentProfile.findOne({
                where: { agent_uuid: agentUuid },
                attributes: [
                    "aboutUs",
                    "detailedDescription",
                    "website",
                ]
            });

            return returnHelper(res, 200, true, "Profile Found", agentProfile)
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
    async getAgentContactProfile(req: RequestWithUser, res: Response) {

        try {
            const agentUuid = req.user?.user?.uuid;

            // Check if the agent profile already exists
            let agentProfile = await AgentProfile.findOne({
                where: { agent_uuid: agentUuid },
                attributes: [
                    "socialFacebook",
                    "socialInstagram",
                    "socialLinkedIn",
                    "socialTwitter",
                    "socialYouTube",
                    "socialOther",
                    "contactEmail",
                    "contactPhoneNumber",
                    "contactWhatsApp",
                ]
            });

            return returnHelper(res, 200, true, "Profile Found", agentProfile)
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
    async getAgentOperatingHours(req: RequestWithUser, res: Response) {

        try {
            const agentUuid = req.user?.user?.uuid;

            // Check if the agent profile already exists
            let agentProfile = await AgentProfile.findOne({
                where: { agent_uuid: agentUuid },
                attributes: [
                    "operatingHoursWeekdays",
                    "operatingHoursWeekends",
                    "operatingHoursTimeZone",
                ]
            });

            return returnHelper(res, 200, true, "Profile Found", agentProfile)
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
    async updateAgentDetails(req: RequestWithUser, res: Response) {
        const {
            officeStreetAddress,
            officeCity,
            officeStateProvince,
            officeCountry,
            officePostalCode,
            aboutUs,
            detailedDescription,
            website,
            socialFacebook,
            socialInstagram,
            socialLinkedIn,
            socialTwitter,
            socialYouTube,
            socialOther,
            contactEmail,
            contactPhoneNumber,
            contactWhatsApp,
            otherCommunicationChannels,
            operatingHoursWeekdays,
            operatingHoursWeekends,
            operatingHoursTimeZone,
            latitude,
            longitude,
            officeArea
        } = req.body;

        try {
            const agentUuid = req.user?.user?.uuid;

            // Check if the agent profile already exists
            let agentProfile = await AgentProfile.findOne({ where: { agent_uuid: agentUuid } });

            if (!agentProfile) {
                // Create a new Agent Profile
                agentProfile = await AgentProfile.create({
                    agent_uuid: agentUuid,
                    officeStreetAddress,
                    officeCity,
                    officeStateProvince,
                    officeCountry,
                    officePostalCode,
                    aboutUs,
                    detailedDescription,
                    website,
                    socialFacebook,
                    socialInstagram,
                    socialLinkedIn,
                    socialTwitter,
                    socialYouTube,
                    socialOther,
                    contactEmail,
                    contactPhoneNumber,
                    contactWhatsApp,
                    otherCommunicationChannels,
                    operatingHoursWeekdays,
                    operatingHoursWeekends,
                    operatingHoursTimeZone,
                    latitude,
                    longitude,
                    officeArea
                });
            } else {
                // Update existing Agent Profile
                const updateParams = {
                    ...(officeStreetAddress !== undefined && { officeStreetAddress }),
                    ...(officeCity !== undefined && { officeCity }),
                    ...(officeStateProvince !== undefined && { officeStateProvince }),
                    ...(officeCountry !== undefined && { officeCountry }),
                    ...(officePostalCode !== undefined && { officePostalCode }),
                    ...(aboutUs !== undefined && { aboutUs }),
                    ...(detailedDescription !== undefined && { detailedDescription }),
                    ...(website !== undefined && { website }),
                    ...(socialFacebook !== undefined && { socialFacebook }),
                    ...(socialInstagram !== undefined && { socialInstagram }),
                    ...(socialLinkedIn !== undefined && { socialLinkedIn }),
                    ...(socialTwitter !== undefined && { socialTwitter }),
                    ...(socialYouTube !== undefined && { socialYouTube }),
                    ...(socialOther !== undefined && { socialOther }),
                    ...(contactEmail !== undefined && { contactEmail }),
                    ...(contactPhoneNumber !== undefined && { contactPhoneNumber }),
                    ...(contactWhatsApp !== undefined && { contactWhatsApp }),
                    ...(otherCommunicationChannels !== undefined && { otherCommunicationChannels }),
                    ...(operatingHoursWeekdays !== undefined && { operatingHoursWeekdays }),
                    ...(operatingHoursWeekends !== undefined && { operatingHoursWeekends }),
                    ...(operatingHoursTimeZone !== undefined && { operatingHoursTimeZone }),
                    ...(latitude !== undefined && { latitude }),
                    ...(longitude !== undefined && { longitude }),
                    ...(officeArea !== undefined && { officeArea }),
                };
                await agentProfile.update(updateParams);
            }
            return returnHelper(res, 200, true, "Profile Updated Successfully")
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
    async updateAgentServiceDetails(req: RequestWithUser, res: Response) {
        try {
            const {
                courseAdvisors,
                courseSpecialization,
                universityRecommendations,
                partneredUniversities,
                fieldExpertise,
                universityPartners,
                // universityPartnersList, - partneredUniversitiesList is list of universites here - duplicated instance
                visaConsultancy,
                visaSpecialization,
                visaSuccessRate,
                visaSuccessRateDetails,
                workVisaHelp,
                workVisaExperience,
                applicationReview,
                applicationTracking,
                applicationDeadlines,
                documentPreparation,
                documentExamples,
                scholarshipAssistance,
                scholarshipDetails,
                budgetPlanning,
                budgetDetails,
                languagePrep,
                languagePrepDetails,
                testPrep,
                careerConsulting,
                careerConsultingDetails,
                jobPlacement,
                internshipPrograms,
                accommodationHelp,
                accommodationHelpText,
                healthInsuranceOptions,
                healthInsuranceOptionsText,
                partTimeJobs,
                partTimeJobsText,
                sopWriting,
                sopWritingText,
                postGraduationJobs,
                flightTicketAssistance,
            } = req.body;


            // Check if the record exists
            const agentService = await AgentService.findOne({ where: { agent_uuid: req.user?.user?.uuid } });

            const createParams = {
                ...(courseAdvisors !== undefined && { courseAdvisors }),
                ...(courseSpecialization !== undefined && { courseSpecialization }),
                ...(universityRecommendations !== undefined && { universityRecommendations }),
                ...(partneredUniversities !== undefined && { partneredUniversities }),
                ...(fieldExpertise !== undefined && { fieldExpertise }),
               
                // NA - mention Above
                // ...(universityPartners !== undefined && { universityPartners }),
                
                ...(visaConsultancy !== undefined && { visaConsultancy }),
                ...(visaSpecialization !== undefined && { visaSpecialization }),
                ...(visaSuccessRate !== undefined && { visaSuccessRate }),
                ...(visaSuccessRateDetails !== undefined && { visaSuccessRateDetails }),
                
                // Added 
                ...(workVisaHelp !== undefined && { workVisaHelp }),
                ...(workVisaExperience !== undefined && { workVisaExperience }),
                
                ...(applicationReview !== undefined && { applicationReview }),
                ...(applicationTracking !== undefined && { applicationTracking }),
                ...(applicationDeadlines !== undefined && { applicationDeadlines }),
                ...(documentPreparation !== undefined && { documentPreparation }),
                ...(documentExamples !== undefined && { documentExamples }),
                ...(scholarshipAssistance !== undefined && { scholarshipAssistance }),
                ...(scholarshipDetails !== undefined && { scholarshipDetails }),
                ...(budgetPlanning !== undefined && { budgetPlanning }),
                ...(budgetDetails !== undefined && { budgetDetails }),

                // Added
                ...(languagePrep !== undefined && { languagePrep }),
                ...(languagePrepDetails !== undefined && { languagePrepDetails }),
                ...(testPrep !== undefined && { testPrep }),

                ...(careerConsulting !== undefined && { careerConsulting }),
                ...(careerConsultingDetails !== undefined && { careerConsultingDetails }),
                ...(jobPlacement !== undefined && { jobPlacement }),
                ...(internshipPrograms !== undefined && { internshipPrograms }),

                // Added
                ...(accommodationHelp !== undefined && { accommodationHelp }),
                ...(accommodationHelpText !== undefined && { accommodationHelpText }),
                ...(healthInsuranceOptions !== undefined && { healthInsuranceOptions }),
                ...(healthInsuranceOptionsText !== undefined && { healthInsuranceOptionsText }),

                ...(partTimeJobs !== undefined && { partTimeJobs }),
                ...(partTimeJobsText !== undefined && { partTimeJobsText }),
                ...(sopWriting !== undefined && { sopWriting }),
                ...(sopWritingText !== undefined && { sopWritingText }),

                // Added
                ...(postGraduationJobs !== undefined && { postGraduationJobs }),

                ...(flightTicketAssistance !== undefined && { flightTicketAssistance }),
                agent_uuid: req.user?.user?.uuid
            }

            if (!agentService) {
                // return returnHelper(res, 404, false, "Agent Service not found");
                await AgentService.create(createParams);
            } else {
                await AgentService.update(createParams, { where: { agent_uuid: req.user?.user?.uuid } });
            }

            if (languagePrep !== 1) {
                await OfflineLanguagesAgents.destroy({ where: { agent_id: req?.id } });
            }

            return returnHelper(res, 200, true, "Agent Service Profile Updated Successfully");

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async getAgentServiceProfile(req: RequestWithUser, res: Response) {
        try {
            const agentService = await AgentService.findOne({ where: { agent_uuid: req.user?.user?.uuid } });
            return returnHelper(res, 200, true, "Agent Service Profile Found", agentService);
        } catch (error) {
            return returnHelper(res, 500, false, error)
        }
    }

    async addSpecializationCountry(req: RequestWithUser, res: Response) {
        try {
            const { country } = req.body

            if (!country) {
                return returnHelper(res, 200, false, "Please Select Any Country First")
            }


            const isExist = await AgentCountrySpecialization.findOne({
                where: {
                    agent_uuid: req.user?.user?.uuid,
                    country
                }
            })

            if (isExist) {
                return returnHelper(res, 200, true, "Country Already Exist For Your Account")
            }

            await AgentCountrySpecialization.create({
                agent_uuid: req.user?.user?.uuid,
                country
            })

            return returnHelper(res, 200, true, "Country Added Successfully")

        } catch (error) {
            return returnHelper(res, 500, false, error)
        }
    }
    async removeSpecializationCountry(req: RequestWithUser, res: Response) {
        try {
            const { country } = req.body

            if (!country) {
                return returnHelper(res, 200, false, "Please Select Any Country First")
            }


            const isExist = await AgentCountrySpecialization.findOne({
                where: {
                    agent_uuid: req.user?.user?.uuid,
                    country
                }
            })

            if (!isExist) {
                return returnHelper(res, 200, false, "Country Not Exist For Your Account")
            }

            await AgentCountrySpecialization.destroy({
                where: {
                    agent_uuid: req.user?.user?.uuid,
                    country
                }
            })

            return returnHelper(res, 200, true, "Country Removed Successfully")

        } catch (error) {
            return returnHelper(res, 500, false, error)
        }
    }

    async getSpecializationCountry(req: RequestWithUser, res: Response) {
        try {
            const agentSpecializationCountry = await AgentCountrySpecialization.findAll({ where: { agent_uuid: req.user?.user?.uuid }, attributes: ["country"] });
            return returnHelper(res, 200, true, "Countries Found", agentSpecializationCountry);
        } catch (error) {
            return returnHelper(res, 500, false, error)
        }
    }

    async addCertificate(req: RequestWithUser, res: Response) {
        try {

            const {
                certificationName,
                accreditationBody
            } = req.body

            if (!req.file) {
                return returnHelper(res, 200, false, "Please Select Image")
            }

            const name = `${Date.now()}-${Math.floor(
                1000 + Math.random() * 9000
            )}${path.parse(req.file.originalname).ext}`;

            // type
            const imageTypes = [
                "image/png",
                "image/jpg",
                "image/jpeg",
                "application/octet-stream"
            ]
            const pdfType = [
                "application/pdf"
            ]

            let type = "other";
            if (imageTypes.includes(req?.file?.mimetype)) {
                type = "image";
            } else if (pdfType.includes(req?.file?.mimetype)) {
                type = "pdf";
            }

            const stored = await saveFile({ owner: ownerFromRequest(req), folder: "certificates", name, body: req.file.buffer, contentType: req.file.mimetype });

            // create certificate
            await Certification.create({
                name: stored,
                type,
                certificationName,
                accreditationBody,
                agent_uuid: req.user?.user?.uuid
            })

            return returnHelper(res, 200, true, "Certificate Added")

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }
    async deleteCertificate(req: RequestWithUser, res: Response) {
        try {

            const { uuid } = req.body

            const findCertificate = await Certification.findOne({
                where: {
                    uuid,
                    agent_uuid: req.user?.user?.uuid
                }
            })

            if (!findCertificate) {
                return returnHelper(res, 200, false, "Can't Delete")
            }

            // delete file too 

            if (findCertificate.dataValues.name && findCertificate.dataValues.name !== "") {

                await deleteFile("certificates", findCertificate.dataValues.name);
            }

            await Certification.destroy({
                where: {
                    uuid
                }
            })

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async addLanguages(req: RequestWithUser, res: Response) {
        try {

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async deleteLanguage(req: RequestWithUser, res: Response) {
        try {
            const { uuid } = req.body

            const findLanguage = await Language.findOne({
                where: {
                    uuid,
                    agent_uuid: req.user?.user?.uuid
                }
            })

            if (!findLanguage) {
                return returnHelper(res, 200, false, "Can't Delete")
            }

            await Language.destroy({
                where: {
                    uuid
                }
            })

        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    async getBranchOfficeAddress(req: RequestWithUser, res: Response) {
        try {

            // delete all old branch officies
            const findAddress = await BranchOffice.findAll({
                where: {
                    agent_uuid: req.user?.user?.uuid
                }
            })

            return returnHelper(res, 200, true, "Address Found", findAddress)


        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }


    async updateBranchOfficeAddress(req: RequestWithUser, res: Response) {
        try {

            const { branchOffices } = req.body

            // delete all old branch officies
            await BranchOffice.destroy({
                where: {
                    agent_uuid: req.user?.user?.uuid
                }
            })

            if (branchOffices && branchOffices.length) {
                await Promise.all(branchOffices.map(async (item: {
                    streetAddress: string,
                    city: string,
                    stateProvince: string,
                    country: string,
                    postalCode: string,
                }) => {
                    await BranchOffice.create({
                        agent_uuid: req.user?.user?.uuid,
                        streetAddress: item?.streetAddress,
                        city: item?.city,
                        stateProvince: item?.stateProvince,
                        country: item?.country,
                        postalCode: item?.postalCode,
                    })
                }))
            }

            return returnHelper(res, 200, true, "Address Updated")


        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

    // admin 
    async getAgentBasicProfileAdmin(req: RequestWithUser, res: Response) {

        try {
            const { agentUuid } = req.body

            // Check if the agent profile already exists
            let agentProfile = await AgentProfile.findOne({
                where: { agent_uuid: agentUuid },
            });

            // branch office address

            let branchOfficeAddress = await BranchOffice.findAll({
                where: {
                    agent_uuid: agentUuid
                }
            })

            // agent profile
            let agentInfo = await Agent.findOne({
                where: {
                    uuid: agentUuid
                },
                attributes: [
                    "access_profile",
                    "country_code",
                    "createdAt",
                    "email",
                    "is_verified",
                    "phone",
                    "phone_number",
                    "profile_image",
                    "status",
                    "updatedAt",
                    "username",
                ]
            })

            return returnHelper(res, 200, true, "Profile Found", { basic_profile: agentProfile, branch_office_address: branchOfficeAddress, information: agentInfo })
        } catch (error: any) {
            return returnHelper(res, 500, false, error.message)
        }
    }

}


export default new AgentProfileController()