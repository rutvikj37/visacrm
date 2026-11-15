import { Response } from "express";
import { audit } from "../../services/audit";
import { leadRecipients, notifyLater } from "../../services/notifications";
import { logPortalDocUpload } from "../../services/portalLeadActivity";
import { existingFilePath, privateFilePath } from "../../helpers/privateFiles";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import AgencyLeads from "../../model/AgencyLeads";
import Step from "../../model/Step";
import Question from "../../model/Question";
import fs from "fs";
import path from "path";
import Agent from "../../model/Agent";
import User from "../../model/User";

class LeadProgressController {

    async addStep(req: RequestWithUser, res: Response) {
        try {
            const { lead_id, step_title, step_description } = req.body

            const leadProgress = await AgencyLeads.findOne({
                where: {
                    id: lead_id,
                    agent_uuid: req?.user?.user?.agent_uuid
                }
            }
            )

            if (!leadProgress) {
                return returnHelper(res, 400, false, "Lead Progress not found")
            }

            // new steps go to the end of the list
            const lastOrder: any = await Step.max("step_order", { where: { lead_id } })
            await Step.create({
                lead_id: lead_id,
                agent_id: req?.user?.user?.agent_id,
                student_id: leadProgress?.dataValues?.user_id,
                created_by_id: req?.user?.user?.id,
                step_title: step_title,
                step_description,
                step_order: (Number(lastOrder) || 0) + 1,
                due_date: req.body?.due_date || null,
            })
            audit(req, { entity: "case", entityId: Number(lead_id), branchId: leadProgress?.dataValues?.branch_id, action: "step_added", summary: `Step added: "${String(step_title || "").slice(0, 120)}"` })
            return returnHelper(res, 200, true, "Step added successfully")

        } catch (error: any) {
            console.log("ERROR IN addStep --->", error)
            return returnHelper(res, 500, false, error.message)
        }
    }
    async updateStep(req: RequestWithUser, res: Response) {
        try {
            const { id, step_title, step_description } = req.body

            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const findStep = await Step.findOne({
                where: {
                    id: id,
                    agent_id: req?.user?.user?.agent_id,
                }
            })

            if (!findStep) {
                return returnHelper(res, 200, false, "Step not found")
            }

            const updateParams = {
                ...(step_title && step_title?.trim() !== "" && { step_title }),
                ...(step_description && step_description?.trim() !== "" && { step_description }),
            }

            const createStep = await Step.update(updateParams, {
                where: {
                    id
                }
            })

            audit(req, { entity: "case", entityId: findStep?.dataValues?.lead_id, action: "step_edited", summary: `Step edited: "${String(step_title || findStep?.dataValues?.step_title || "").slice(0, 120)}"` })
            return returnHelper(res, 200, true, "Step Updated successfully")

        } catch (error: any) {
            console.log("ERROR IN updateStep --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    async deleteStep(req: RequestWithUser, res: Response) {
        try {
            const { id } = req.body

            if (!id) {
                return returnHelper(res, 200, false, "Invalid Action")
            }

            const findStep = await Step.findOne({
                where: {
                    id: id,
                    agent_id: req?.user?.user?.agent_id,
                }
            })

            if (!findStep) {
                return returnHelper(res, 200, false, "Step not found")
            }


            const createStep = await Step.destroy({
                where: {
                    id
                }
            })

            audit(req, { entity: "case", entityId: findStep?.dataValues?.lead_id, action: "step_deleted", summary: `Step removed: "${String(findStep?.dataValues?.step_title || "").slice(0, 120)}"` })
            return returnHelper(res, 200, true, "Step Delted successfully")

        } catch (error: any) {
            console.log("ERROR IN deleteStep --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    async addQuestion(req: RequestWithUser, res: Response) {
        try {
            const { step_id, question_text, question_type } = req.body

            if (!step_id || !question_text || !question_type) {
                return returnHelper(res, 200, false, "Invalid Action")
            }
            const findStep = await Step.findOne({
                where: {
                    id: step_id,
                    agent_id: req?.user?.user?.agent_id,
                }
            })

            if (!findStep) {
                return returnHelper(res, 200, false, "Step not found")
            }

            let question_answer = null

            if(question_type == "document_provide"){

                if (!req.file) {
                    return returnHelper(res, 200, false, "No file provided");
                }

                const buffer:any = req.file.buffer;

                const file_name = `${Date.now()}-${Math.floor(
                    1000 + Math.random() * 9000
                )}${path.parse(req.file.originalname).ext}`;

                fs.writeFileSync(
                    privateFilePath("student_docs", file_name),
                    buffer
                );
                // Save the file path relative to your public directory
                question_answer = `${file_name}`;

            }

            await Question.create({
                step_id: step_id,
                student_id: findStep?.dataValues?.student_id,
                agent_id: req?.user?.user?.agent_id,
                created_by_agent_id: req?.user?.user?.id,
                question_text: question_text,
                question_type: question_type,
                question_answer,
                status: (question_type == "update_status" || question_type == "document_provide") ? "completed" : "pending"
            })

            return returnHelper(res, 200, true, "Question added successfully")

        } catch (error: any) {
            console.log("ERROR IN addQuestion --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }


    async provideSteps(req: RequestWithUser, res: Response) {
        try {

            const { lead_id } = req.params

            const findSteps = await Step.findAll({
                where: {
                    lead_id: lead_id,
                    agent_id: req?.user?.user?.agent_id,
                },
                attributes: [
                    "id",
                    "step_title",
                    "step_description",
                    "step_status",
                    "student_id",
                    "due_date",
                    "step_order"
                ],
                order: [["step_order", "ASC"], ["id", "ASC"]]
            })


            const findLead = await AgencyLeads.findOne({
                where: {
                    id: lead_id,
                    agent_uuid: req?.user?.user?.agent_uuid,
                },
                attributes: ["user_id"]
            })

            // the case must belong to this agency
            if (!findLead) {
                return returnHelper(res, 200, false, "Lead not found")
            }


            const findStudent = await User.findOne({
                where: {
                    id: findLead?.dataValues?.user_id,
                },
                attributes: ["username", "email", "phone", "country_code", "phone_number"]
            })


            return returnHelper(res, 200, true, "Steps Found", {steps: findSteps, student: findStudent})

        } catch (error: any) {
            console.log("ERROR IN provideSteps --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    // GET /leads/lead_progress/student/overview - the student's cases with progress and "what we need from you"
    async studentOverview(req: RequestWithUser, res: Response) {
        try {
            const studentId = req?.id
            const cases: any[] = await AgencyLeads.findAll({
                where: { user_id: studentId, status: ["visa_progress", "visa_completed", "visa_rejected"] },
                attributes: ["id", "status", "case_stage", "selected_country", "university", "selected_suggestion", "createdAt"],
                order: [["createdAt", "DESC"]],
            })
            const result = []
            for (const c of cases) {
                const x = c.dataValues
                const steps: any[] = await Step.findAll({
                    where: { lead_id: x.id, student_id: studentId },
                    attributes: ["id", "step_title", "step_status", "due_date", "step_order"],
                    order: [["step_order", "ASC"], ["id", "ASC"]],
                })
                const stepIds = steps.map((s) => s.dataValues.id)
                const questions: any[] = stepIds.length ? await Question.findAll({
                    where: { step_id: stepIds, student_id: String(studentId), question_type: ["text_input", "file_selector"] },
                    attributes: ["id", "step_id", "question_text", "question_type", "status", "reason"],
                    order: [["id", "ASC"]],
                }) : []
                const done = steps.filter((s) => Number(s.dataValues.step_status) === 1).length
                const currentIndex = steps.findIndex((s) => Number(s.dataValues.step_status) !== 1)
                const needed = questions
                    .filter((q) => ["pending", "rejected"].includes(q.dataValues.status))
                    .map((q) => {
                        const step = steps.find((s) => s.dataValues.id === q.dataValues.step_id)
                        return {
                            question_id: q.dataValues.id,
                            step_id: q.dataValues.step_id,
                            step_index: steps.findIndex((s) => s.dataValues.id === q.dataValues.step_id),
                            step_title: step?.dataValues?.step_title,
                            due_date: step?.dataValues?.due_date || null,
                            text: q.dataValues.question_text,
                            type: q.dataValues.question_type,
                            rejected: q.dataValues.status === "rejected",
                            reason: q.dataValues.status === "rejected" ? q.dataValues.reason : null,
                        }
                    })
                let sel: any = {}
                try { sel = JSON.parse(x.selected_suggestion || "{}") || {} } catch { sel = {} }
                result.push({
                    id: x.id,
                    status: x.status,
                    stage: x.case_stage,
                    country: x.selected_country || sel.country || null,
                    university: x.university || sel.university || null,
                    course: sel.fieldOfStudy || null,
                    steps_total: steps.length,
                    steps_done: done,
                    current_step: currentIndex >= 0 ? { number: currentIndex + 1, title: steps[currentIndex].dataValues.step_title, due_date: steps[currentIndex].dataValues.due_date } : null,
                    steps: steps.map((s) => ({ id: s.dataValues.id, title: s.dataValues.step_title, done: Number(s.dataValues.step_status) === 1, due_date: s.dataValues.due_date })),
                    needed,
                    waiting_review: questions.filter((q) => q.dataValues.status === "provided").length,
                })
            }
            return returnHelper(res, 200, true, "Overview", result)
        } catch (error: any) {
            console.log("ERROR IN studentOverview --->", error.message)
            return returnHelper(res, 500, false, "Something went wrong")
        }
    }

    async provideStepsStudents(req: RequestWithUser, res: Response) {
        try {

            const { lead_id } = req.params

            // the case must belong to this student
            const ownCase = await AgencyLeads.findOne({ where: { id: lead_id, user_id: req?.id }, attributes: ["id"] })
            if (!ownCase) {
                return returnHelper(res, 200, false, "Lead not found")
            }

            const findSteps = await Step.findAll({
                where: {
                    lead_id: lead_id,
                    student_id: req?.id,
                },
                attributes: [
                    "id",
                    "step_title",
                    "step_description",
                    "step_status",
                    "due_date"
                ],
                order: [["step_order", "ASC"], ["id", "ASC"]]
            })

            const findLead = await AgencyLeads.findOne({
                where: {
                    id: lead_id,
                    user_id:req?.id
                },
                attributes: ["agent_uuid"]
            })

            if(!findLead){
                return returnHelper(res, 200, false, "Lead not found")
            }

            const findAgent = await Agent.findOne({
                where: {
                    uuid: findLead?.dataValues?.agent_uuid,
                },
                attributes: ["id", "phone_number", "country_code", "phone", "username", "profile_image", "access_profile"]
            })

            return returnHelper(res, 200, true, "Steps Found", { steps: findSteps, agent: findAgent })

        } catch (error: any) {
            console.log("ERROR IN provideSteps --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    async changeStepStatus(req: RequestWithUser, res: Response) {
        try {

            const { id } = req.params

            const findStep = await Step.findOne({
                where: {
                    id,
                    agent_id: req?.user?.user?.agent_id,
                },
                attributes: [
                    "id",
                    "step_title",
                    "step_description",
                    "step_status",
                    "lead_id"
                ]
            })

            if (!findStep) {
                return returnHelper(res, 200, false, "Invalid Action")
            }
            audit(req, { entity: "case", entityId: findStep?.dataValues?.lead_id, action: findStep?.dataValues?.step_status == 0 ? "step_done" : "step_reopened", summary: `${findStep?.dataValues?.step_status == 0 ? "Step done" : "Step reopened"}: "${String(findStep?.dataValues?.step_title || "").slice(0, 120)}"` })

            await Step.update({
                step_status: findStep?.dataValues?.step_status == 0 ? 1 : 0
            }, {
                where: {
                    id
                }
            })

            return returnHelper(res, 200, true, "Status Updated")

        } catch (error: any) {
            console.log("ERROR IN provideSteps --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    async provideQuestions(req: RequestWithUser, res: Response) {
        try {
            const { step_id } = req.params

            const findStep = await Step.findOne({
                where: {
                    id: step_id,
                    agent_id: req?.user?.user?.agent_id,
                },
                attributes: [
                    "id",
                    "step_title",
                    "step_description",
                    "step_status"
                ]
            })

            if (!findStep) {
                return returnHelper(res, 200, false, "Not Found!")
            }

            const findQuestions = await Question.findAll({
                where: {
                    step_id: step_id,
                    agent_id: req?.user?.user?.agent_id,
                },
                attributes: [
                    "id",
                    "question_text",
                    "question_answer",
                    "question_type",
                    "status",
                    "reason",
                    "file_path",
                    "createdAt",
                    "updatedAt",
                ]
            })
            return returnHelper(res, 200, true, "Questions Found", { step: findStep, questions: findQuestions })

        } catch (error: any) {
            console.log("ERROR IN provideQuestions --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    async actionQuestion(req: RequestWithUser, res: Response) {
        try {
            const { question_id, status, reason } = req.body


            if (!["pending", "provided", "rejected", "completed"].includes(status)) {
                return returnHelper(res, 200, false, "Invalid status")
            }

            // only this agency's own documents / questions
            const findQuestions = await Question.findOne({
                where: {
                    id: question_id,
                    agent_id: req?.user?.user?.agent_id,
                },
                attributes: [
                    "id",
                    "step_id",
                    "question_text",
                ]
            })

            if (!findQuestions) {
                return returnHelper(res, 200, false, "Not Found!")
            }
            const reviewStep: any = await Step.findByPk(findQuestions?.dataValues?.step_id, { attributes: ["lead_id"] })
            const reviewLabel: Record<string, string> = { completed: "Accepted", rejected: "Asked again", provided: "Marked received", pending: "Reset" }
            audit(req, { entity: "case", entityId: reviewStep?.dataValues?.lead_id, action: `document_${status}`, summary: `${reviewLabel[status]}: "${String(findQuestions?.dataValues?.question_text || "").slice(0, 120)}"${status === "rejected" && reason ? ` - ${String(reason).slice(0, 150)}` : ""}` })

            await Question.update({
                status,
                reason
            }, {
                where: {
                    id: question_id
                }
            })

            return returnHelper(res, 200, true, "Status Updated")

        } catch (error: any) {
            console.log("ERROR IN provideQuestions --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }
    async provideQuestionsStudent(req: RequestWithUser, res: Response) {
        try {
            const { step_id } = req.params

            const findStep = await Step.findOne({
                where: {
                    id: step_id,
                    student_id: req?.user?.user?.id,
                },
                attributes: [
                    "id",
                    "step_title",
                    "step_description",
                    "step_status"
                ]
            })

            if (!findStep) {
                return returnHelper(res, 200, false, "Not Found!")
            }

            const findQuestions = await Question.findAll({
                where: {
                    step_id: step_id,
                    student_id: req?.user?.user?.id,
                },
                attributes: [
                    "id",
                    "question_text",
                    "question_answer",
                    "question_type",
                    "file_path",
                    "reason",
                    "status",
                    "createdAt",
                    "updatedAt",
                ],
                include: [
                    {
                        model: Agent,
                        as: "created_by",
                        attributes: [
                            "username",
                            "profile_image",
                            "access_profile"
                        ]
                    }
                ]
            })
            return returnHelper(res, 200, true, "Questions Found", { step: findStep, questions: findQuestions })

        } catch (error: any) {
            console.log("ERROR IN provideQuestions --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

    async submitAnswer(req: RequestWithUser, res: Response) {
        try {
            // Get questionId and answer from the request body
            const { questionId, answer } = req.body;

            // Find the question for the logged in student
            const findQuestion = await Question.findOne({
                where: {
                    id: questionId,
                    student_id: req?.user?.user?.id,
                },
                // Also retrieving question_type for conditional logic
                attributes: ['id', 'question_answer', 'question_type', "status", "step_id", "question_text"],
            });

            if (!findQuestion) {
                return returnHelper(res, 200, false, "Question Not Found!");
            }
            let question_answer = null;
            // If the question type is text_input, use the text answer from req.body
            if (findQuestion?.dataValues?.question_type === 'text_input') {
                question_answer = answer;
            }
            // If the question type is file_selector, process the uploaded file
            else if (findQuestion?.dataValues?.question_type === 'file_selector') {

                if (!req.file) {
                    return returnHelper(res, 400, false, "No file provided");
                }

                const buffer:any = req.file.buffer;

                const file_name = `${Date.now()}-${Math.floor(
                    1000 + Math.random() * 9000
                )}${path.parse(req.file.originalname).ext}`;

                fs.writeFileSync(
                    privateFilePath("student_docs", file_name),
                    buffer
                );
                // Save the file path relative to your public directory
                question_answer = `${file_name}`;

                // remove old file 
                if (findQuestion?.dataValues?.status == "rejected") {
                    const oldFile = existingFilePath("student_docs", findQuestion?.dataValues?.question_answer)
                    if (oldFile) {
                        fs.unlinkSync(oldFile)
                    }
                }

            } else {
                return returnHelper(res, 400, false, "Invalid question type");
            }

            await Question.update(
                {
                    question_answer: question_answer,
                    status: "provided",
                },
                {
                    where: {
                        id: questionId,
                    },
                }
            );

            // tell whoever handles the case
            try {
                const step: any = await Step.findByPk(findQuestion?.dataValues?.step_id, { attributes: ["lead_id"] })
                const visaCase: any = step ? await AgencyLeads.findByPk(step.dataValues.lead_id, { attributes: ["id", "agent_uuid", "assign_id"] }) : null
                if (visaCase) {
                    const student: any = await User.findByPk(req?.user?.user?.id, { attributes: ["username"] })
                    const isFile = findQuestion?.dataValues?.question_type !== "text_input"
                    audit(null, { agencyUuid: visaCase.dataValues.agent_uuid, entity: "case", entityId: visaCase.dataValues.id, action: isFile ? "document_uploaded" : "answered", summary: `${isFile ? "Uploaded" : "Answered"}: "${String(findQuestion?.dataValues?.question_text || "").slice(0, 120)}"`, actor: { type: "student", id: Number(req?.user?.user?.id), name: student?.dataValues?.username || "Student" } })
                    notifyLater({
                        agencyUuid: visaCase.dataValues.agent_uuid,
                        recipientIds: await leadRecipients(visaCase.dataValues.agent_uuid, visaCase.dataValues.assign_id),
                        type: "document_uploaded",
                        title: `${student?.dataValues?.username || "A student"} ${isFile ? "uploaded a document" : "answered a question"}`,
                        body: findQuestion?.dataValues?.question_text || null,
                        link: `/leads/progress/${visaCase.dataValues.id}`,
                        dedupeKey: `doc:${findQuestion?.dataValues?.id}:${Date.now()}`,
                    })
                    if (isFile) {
                        setImmediate(() => {
                            logPortalDocUpload(
                                visaCase.dataValues.id,
                                findQuestion?.dataValues?.question_text,
                                student?.dataValues?.username,
                            );
                        });
                    }
                }
            } catch (e) { console.error("upload notification failed", e) }

            return returnHelper(res, 200, true, "Answer Submitted");
        } catch (error) {
            console.error("ERROR IN provideQuestionsStudent --->", error.message);
            return returnHelper(res, 500, false, error.message);
        }
    }

    async withdrawApplication(req: RequestWithUser, res: Response) {
        try {
            const { lead_id } = req.params
            const findLead = await AgencyLeads.findOne({
                where: {
                    id: lead_id,
                    user_id: req?.user?.user?.id,
                },
                attributes: [
                    "id",
                    "user_id",
                    "status",
                    "createdAt",
                    "updatedAt",
                ]
            })

            if(!findLead) {
                return returnHelper(res, 200, false, "Lead Not Found!")
            }

            if(findLead?.dataValues?.status == "withdraw" || findLead?.dataValues?.status == "withdrawn_by_student") {
                return returnHelper(res, 200, true, "Application Already Withdrawen!")
            }

            await AgencyLeads.update({
                status: "withdrawn_by_student"
            }, {
                where: {
                    id: lead_id
                }
            })

            return returnHelper(res, 200, true, "Withdraw Successfully")
        } catch (error: any) {
            console.log("ERROR IN withdrawApplication --->", error.message)
            return returnHelper(res, 500, false, error.message)
        }
    }

}

export default new LeadProgressController()