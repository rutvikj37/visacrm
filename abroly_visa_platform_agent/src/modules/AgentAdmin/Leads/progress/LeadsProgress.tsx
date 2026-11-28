import CaseToolbar, { StepDueDate } from "@/modules/AgentAdmin/Cases/CaseToolbar"
import UniversityApplications from "@/modules/AgentAdmin/Cases/UniversityApplications"
import CaseCommissions from "@/modules/AgentAdmin/Commissions/CaseCommissions"
import { fmtShortDate, isOverdue, isTravelCase } from "@/modules/AgentAdmin/Cases/caseShared"
import TravelDocuments from "@/modules/AgentAdmin/Cases/TravelDocuments"
import FormField from "@/modules/AgentAdmin/Crm/FormField"
import fetchQueriesHook from "@/hooks/fetchQueriesHook";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Spinner, Textarea } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import FileSaver from "file-saver";
import { ArrowDownToLine, CheckCircle2, Clock, FileText, Plus, XCircle } from 'lucide-react';
import moment from "moment";
import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'

const STATUS_COLOR: Record<string, "warning" | "success" | "danger" | "primary" | "default"> = {
    pending: "warning",
    completed: "success",
    rejected: "danger",
    provided: "primary",
};

/** One step’s questions / updates. */
const StepDetails = ({ step_id, description, leadId }: { step_id: string | number; description?: string; leadId: string | undefined }) => {
    const { commonGetAPICalls, commonPostAPICall, commonPostAPICallWithFile } = useApiCallUtils()
    const fetchQueryClient = fetchQueriesHook()

    const [questionManageModel, setQuestionManage] = useState({
        isOpen: false,
        id: null as null | number,
        isDelete: false,
        question_text: "",
        question_type: "text_input",
        selected_file: null as File | null,
    })

    const [rejectModel, setRejectModel] = useState({
        isOpen: false,
        id: null as null | number,
        reason: ""
    })

    const manageQuestionsMutation = useMutation({
        mutationFn: async () => {
            const formData = new FormData()
            formData.append("question_text", questionManageModel.question_text)
            formData.append("question_type", questionManageModel.question_type)
            formData.append("step_id", String(step_id))
            if (questionManageModel.selected_file != null) {
                formData.append("file", questionManageModel.selected_file)
            }
            const { data, success, message } = await commonPostAPICallWithFile(formData, "/leads/lead_progress/add_question")
            if (success) return data
            throw new Error(message)
        },
        onSuccess: () => {
            fetchQueryClient(["questions", step_id])
            setQuestionManage({
                isOpen: false,
                id: null,
                isDelete: false,
                question_text: "",
                question_type: "text_input",
                selected_file: null,
            })
        }
    })

    const changeStatusMutation = useMutation({
        mutationFn: async () => {
            const { data, success, message } = await commonGetAPICalls("/leads/lead_progress/toggle_step_status/" + step_id)
            if (success) return data
            throw new Error(message)
        },
        onSuccess: () => {
            fetchQueryClient(["questions", step_id])
            fetchQueryClient(["steps", leadId])
        }
    })

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['questions', step_id],
        queryFn: async () => {
            const { success, data, message } = await commonGetAPICalls(`/leads/lead_progress/get_questions/${step_id}`)
            if (success) return data
            throw new Error(message)
        },
        enabled: !!step_id,
    })

    const actionStatusMutation = useMutation({
        mutationFn: async ({ question_id, status, reason }: any) => {
            const { data, success, message } = await commonPostAPICall({ question_id, status, reason }, "/leads/lead_progress/action")
            if (success) return data
            throw new Error(message)
        },
        onSuccess: () => {
            fetchQueryClient(["questions", step_id])
            fetchQueryClient(["steps", leadId])
            setRejectModel({ isOpen: false, id: null, reason: "" })
        }
    })

    const questions = data?.questions || []
    const initialLoad = isLoading && !data

    return (
        <div className="rounded-xl border border-default-200 bg-content1">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-default-100">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground truncate">{data?.step?.step_title || "Step"}</h2>
                    {description ? <p className="text-sm text-default-500 mt-0.5">{description}</p> : null}
                </div>
                <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    startContent={<Plus className="w-4 h-4" />}
                    onPress={() => setQuestionManage((prev) => ({ ...prev, isOpen: true }))}
                >
                    Add question
                </Button>
            </div>

            <div className="px-4 py-3">
                {isError ? (
                    <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-6 text-center text-sm text-danger-700">
                        {error?.message || "Could not load questions"}
                    </div>
                ) : initialLoad ? (
                    <div className="flex items-center justify-center py-10">
                        <Spinner size="sm" />
                    </div>
                ) : questions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <FileText className="w-8 h-8 text-default-300" />
                        <p className="text-sm font-medium text-default-600">No questions yet</p>
                        <p className="text-xs text-default-400">Add a question or status update for the student</p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {questions.map((question: any) => (
                            <li key={question?.id} className="rounded-lg border border-default-200 px-3 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground flex-1 min-w-0">{question?.question_text}</p>
                                    <Chip size="sm" variant="flat" color={STATUS_COLOR[question?.status] || "default"} className="capitalize shrink-0">
                                        {question?.status}
                                    </Chip>
                                </div>

                                {question?.status === 'pending' && (
                                    <p className="text-sm text-default-400 mt-2">Waiting for student response</p>
                                )}

                                {question?.status === 'provided' && (
                                    <div className="mt-2 space-y-2">
                                        {question?.question_type === 'text_input' && (
                                            <p className="text-sm text-default-700">Answer: {question?.question_answer}</p>
                                        )}
                                        {question?.question_type === 'file_selector' && question?.file_path && (
                                            <a href={question.file_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary">
                                                <FileText className="w-4 h-4" /> View document
                                            </a>
                                        )}
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button
                                                size="sm"
                                                color="success"
                                                variant="flat"
                                                startContent={<CheckCircle2 className="w-4 h-4" />}
                                                isLoading={actionStatusMutation.isPending}
                                                onPress={() => actionStatusMutation.mutate({ question_id: question?.id, status: "completed" })}
                                            >
                                                Accept
                                            </Button>
                                            <Button
                                                size="sm"
                                                color="danger"
                                                variant="flat"
                                                startContent={<XCircle className="w-4 h-4" />}
                                                isDisabled={actionStatusMutation.isPending}
                                                onPress={() => setRejectModel({ isOpen: true, id: question?.id, reason: "" })}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {question?.status === 'rejected' && (
                                    <p className="text-sm text-danger mt-2">Rejected: {question?.reason || "No reason provided"}</p>
                                )}

                                {question?.status === 'completed' && question?.question_type !== 'update_status' && (
                                    <div className="mt-2 space-y-1">
                                        {question?.question_type === 'text_input' && (
                                            <p className="text-sm text-default-700">Answer: {question?.question_answer}</p>
                                        )}
                                        {(question?.question_type === 'file_selector' || question?.question_type === 'document_provide') && question?.file_path && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <a href={question.file_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary">
                                                    <FileText className="w-4 h-4" /> View file
                                                </a>
                                                {question?.question_type === 'document_provide' && (
                                                    <Button size="sm" variant="light" isIconOnly aria-label="Download" onPress={() => FileSaver.saveAs(question.file_path)}>
                                                        <ArrowDownToLine className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-2 flex items-center gap-1.5 text-xs text-default-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    {moment(question?.createdAt).format('lll')}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-default-100 bg-default-50/60">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-default-500">Step status</p>
                    <p className="text-sm font-medium text-foreground">
                        {data?.step?.step_status == 0 ? "Incomplete" : "Completed"}
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    isLoading={changeStatusMutation.isPending}
                    onPress={() => changeStatusMutation.mutate()}
                >
                    Mark {data?.step?.step_status == 0 ? "complete" : "incomplete"}
                </Button>
            </div>

            <Modal isOpen={questionManageModel.isOpen} onOpenChange={(open) => !open && setQuestionManage((prev) => ({ ...prev, isOpen: false }))} size="md" scrollBehavior="outside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Add question or update</ModalHeader>
                            <ModalBody className="gap-4">
                                <p className="text-sm text-default-500">Shown on this step for the student to answer or review.</p>
                                <FormField label="Question / update">
                                    <Input
                                        aria-label="Question / update"
                                        placeholder="What do you need from the student?"
                                        value={questionManageModel.question_text}
                                        onValueChange={(v) => setQuestionManage((prev) => ({ ...prev, question_text: v }))}
                                    />
                                </FormField>
                                <RadioGroup
                                    isRequired
                                    label="Type"
                                    value={questionManageModel.question_type}
                                    onValueChange={(e) => setQuestionManage((prev) => ({ ...prev, question_type: e }))}
                                >
                                    <Radio value="text_input">Text answer from student</Radio>
                                    <Radio value="file_selector">Document upload from student</Radio>
                                    <Radio value="update_status">Status update (agency)</Radio>
                                    <Radio value="document_provide">Status update + document (agency)</Radio>
                                </RadioGroup>
                                {questionManageModel.question_type === "document_provide" && (
                                    <div className="space-y-1">
                                        <p className="text-sm text-default-600">Attach file</p>
                                        <input
                                            type="file"
                                            name="file"
                                            onChange={(e) => setQuestionManage((prev) => ({ ...prev, selected_file: e.target.files?.[0] || null }))}
                                        />
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button
                                    color="primary"
                                    isLoading={manageQuestionsMutation.isPending}
                                    isDisabled={!questionManageModel.question_text.trim()}
                                    startContent={<Plus className="w-4 h-4" />}
                                    onPress={() => manageQuestionsMutation.mutate()}
                                >
                                    Add
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={rejectModel.isOpen} onOpenChange={(open) => !open && setRejectModel((prev) => ({ ...prev, isOpen: false }))} size="md" scrollBehavior="outside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Reason for rejection</ModalHeader>
                            <ModalBody className="gap-4">
                                <FormField label="Reason">
                                    <Textarea
                                        aria-label="Reason"
                                        placeholder="Why is this rejected?"
                                        value={rejectModel.reason}
                                        onValueChange={(v) => setRejectModel((prev) => ({ ...prev, reason: v }))}
                                        minRows={2}
                                    />
                                </FormField>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button
                                    color="danger"
                                    isLoading={actionStatusMutation.isPending}
                                    isDisabled={!rejectModel.reason.trim()}
                                    startContent={<XCircle className="w-4 h-4" />}
                                    onPress={() => actionStatusMutation.mutate({
                                        question_id: rejectModel.id,
                                        reason: rejectModel.reason,
                                        status: "rejected",
                                    })}
                                >
                                    Reject
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    )
}

const LeadsProgress = () => {
    const { id } = useParams()
    const [searchParams, setSearchParams] = useSearchParams();
    const queryStep = parseInt(searchParams.get("step") || "0", 10) || 0;
    const [step, setStep] = useState(queryStep);
    // university results can move the case stage: reload the header after a change
    const [caseReload, setCaseReload] = useState(0);
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const teamRole = useSelector((state: any) => state.login.team_role);
    const canBill = isOwner || teamRole === "accounts";
    const [commissionFor, setCommissionFor] = useState<{ app: any; n: number } | null>(null);

    useEffect(() => {
        setStep(queryStep);
    }, [queryStep]);

    const { commonGetAPICalls, commonPostAPICall, commonDeleteAPICall, commonPutAPICall } = useApiCallUtils()
    const fetchQueryClient = fetchQueriesHook()

    const [stepAddModal, setStepAddModal] = useState({
        isOpen: false,
        id: null as null | number,
        isDelete: false,
        step_title: "",
        step_description: ""
    })

    const { data: stepsData, isLoading, isError, error } = useQuery({
        queryKey: ['steps', id],
        queryFn: async () => {
            const { success, data, message } = await commonGetAPICalls(`/leads/lead_progress/get_steps/${id}`)
            if (success) return data
            throw new Error(message)
        },
        enabled: !!id,
    })

    const tabs = Array.isArray(stepsData) ? stepsData : (stepsData?.steps || [])
    const initialLoad = isLoading && !stepsData

    useEffect(() => {
        if (!tabs.length) return;
        if (step > tabs.length - 1) {
            const next = tabs.length - 1;
            setStep(next);
            setSearchParams({ step: String(next) });
        }
    }, [tabs.length, step, setSearchParams]);

    const manageDepartmentMutation = useMutation({
        mutationFn: async () => {
            const { data, success, message } = stepAddModal?.id == null
                ? await commonPostAPICall({ ...stepAddModal, lead_id: id }, "/leads/lead_progress/manage_step")
                : stepAddModal.isDelete == true
                    ? await commonDeleteAPICall({ ...stepAddModal }, "/leads/lead_progress/manage_step")
                    : await commonPutAPICall({ ...stepAddModal }, "/leads/lead_progress/manage_step")
            if (success) return data
            throw new Error(message)
        },
        onSuccess: () => {
            fetchQueryClient(["steps", id])
            setStepAddModal({
                isOpen: false,
                id: null,
                isDelete: false,
                step_title: "",
                step_description: ""
            })
            setSearchParams({ step: String(tabs.length) })
        }
    })

    const onChange = (nextStep: number) => {
        const maxStep = tabs.length > 0 ? tabs.length - 1 : 0;
        const newStep = nextStep < 0 ? 0 : nextStep > maxStep ? maxStep : nextStep;
        setStep(newStep);
        setSearchParams({ step: String(newStep) });
    };

    const activeStep = tabs?.[step]

    // tourist / business visa case? -> itinerary & cover letter instead of universities
    const { data: caseInfo } = useQuery({
        queryKey: ["case_kind", id],
        queryFn: async () => {
            const { success, data } = await commonGetAPICalls(`/crm/cases/${id}`)
            return success ? data : null
        },
        enabled: Boolean(id),
    })
    const travel = isTravelCase(caseInfo)

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            {/* 1. Case header (student, stage, assignment, outcomes) */}
            <CaseToolbar caseId={id!} reloadKey={caseReload} />

            {travel ? (
                /* 2. Tourist / business visa: itinerary, cover letter, funds check */
                <TravelDocuments caseId={id!} />
            ) : (<>
            {/* 2. Universities the student applied to (+ commission for owner / accounts / managers) */}
            <UniversityApplications caseId={id!} onChanged={() => setCaseReload((n) => n + 1)}
                onAddCommission={canBill ? (app) => setCommissionFor({ app, n: Date.now() }) : undefined} />
            <CaseCommissions caseId={id!} addRequest={commissionFor} onChanged={() => setCaseReload((n) => n + 1)} />
            </>)}

            {/* 2. Application steps */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Application steps</h2>
                        <p className="text-xs text-default-500">Select a step to review documents and answers</p>
                    </div>
                    <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<Plus className="w-4 h-4" />}
                        onPress={() => setStepAddModal(prev => ({ ...prev, isOpen: true }))}
                    >
                        Add step
                    </Button>
                </div>

                {isError ? (
                    <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-8 text-center text-sm text-danger-700">
                        {error?.message || "Could not load steps"}
                    </div>
                ) : initialLoad ? (
                    <div className="flex items-center justify-center rounded-xl border border-default-200 bg-content1 py-16">
                        <Spinner size="sm" label="Loading steps…" />
                    </div>
                ) : !tabs || tabs.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-default-300 bg-content1 px-4 py-12 text-center">
                        <FileText className="w-10 h-10 text-default-300" />
                        <p className="text-sm font-medium text-default-700">No steps yet</p>
                        <p className="text-xs text-default-500">Add a step to track documents and answers for this case</p>
                        <Button
                            size="sm"
                            color="primary"
                            className="mt-2"
                            startContent={<Plus className="w-4 h-4" />}
                            onPress={() => setStepAddModal(prev => ({ ...prev, isOpen: true }))}
                        >
                            Add step
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <nav className="rounded-xl border border-default-200 bg-content1 p-2 lg:sticky lg:top-16 lg:self-start" aria-label="Steps">
                            {/* Mobile: horizontal step chips */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
                                {tabs.map((item: any, index: number) => {
                                    const done = Number(item?.step_status) === 1;
                                    const active = step === index;
                                    return (
                                        <button
                                            key={item?.id}
                                            type="button"
                                            onClick={() => onChange(index)}
                                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                                                active
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : done
                                                        ? "border-success-200 bg-success-50 text-success-700"
                                                        : "border-default-200 text-default-600"
                                            }`}
                                        >
                                            {index + 1}. {item?.step_title}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Desktop: vertical step list */}
                            <ol className="hidden lg:flex flex-col gap-1">
                                {tabs.map((item: any, index: number) => {
                                    const done = Number(item?.step_status) === 1;
                                    const active = step === index;
                                    const overdue = isOverdue(item?.due_date) && !done;
                                    return (
                                        <li key={item?.id}>
                                            <button
                                                type="button"
                                                onClick={() => onChange(index)}
                                                className={`w-full text-left rounded-lg px-3 py-2.5 flex gap-3 transition ${
                                                    active ? "bg-primary-50 ring-1 ring-primary/30" : "hover:bg-default-50"
                                                }`}
                                            >
                                                <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold border ${
                                                    done
                                                        ? "bg-success border-success text-success-foreground"
                                                        : active
                                                            ? "border-primary text-primary bg-content1"
                                                            : "border-default-300 text-default-400"
                                                }`}>
                                                    {done ? <CheckCircle2 size={12} /> : index + 1}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className={`block text-sm truncate ${active ? "font-semibold text-foreground" : "text-default-700"}`}>
                                                        {item?.step_title}
                                                    </span>
                                                    {item?.step_description ? (
                                                        <span className="block text-xs truncate text-default-400">{item.step_description}</span>
                                                    ) : null}
                                                    {item?.due_date ? (
                                                        <span className={`block text-xs ${overdue ? "text-danger font-medium" : "text-default-400"}`}>
                                                            Due {fmtShortDate(item.due_date)}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </nav>

                        <div className="lg:col-span-2 space-y-3 min-w-0">
                            <StepDueDate step={activeStep} />
                            {activeStep?.id ? (
                                <StepDetails
                                    step_id={activeStep.id}
                                    description={activeStep.step_description}
                                    leadId={id}
                                />
                            ) : null}
                        </div>
                    </div>
                )}
            </section>

            <Modal isOpen={stepAddModal.isOpen} onOpenChange={(open) => !open && setStepAddModal((prev) => ({ ...prev, isOpen: false }))} size="md" scrollBehavior="outside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Add step</ModalHeader>
                            <ModalBody className="gap-4">
                                <p className="text-sm text-default-500">Give this stage a short title and optional description.</p>
                                <FormField label="Title">
                                    <Input
                                        aria-label="Title"
                                        placeholder="e.g. Documents"
                                        value={stepAddModal.step_title}
                                        onValueChange={(v) => setStepAddModal((prev) => ({ ...prev, step_title: v }))}
                                    />
                                </FormField>
                                <FormField label="Description">
                                    <Input
                                        aria-label="Description"
                                        placeholder="What happens in this step?"
                                        value={stepAddModal.step_description}
                                        onValueChange={(v) => setStepAddModal((prev) => ({ ...prev, step_description: v }))}
                                    />
                                </FormField>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button
                                    color="primary"
                                    isLoading={manageDepartmentMutation.isPending}
                                    isDisabled={!stepAddModal.step_title.trim()}
                                    startContent={<Plus className="w-4 h-4" />}
                                    onPress={() => manageDepartmentMutation.mutate()}
                                >
                                    Add step
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    )
}

export default LeadsProgress
