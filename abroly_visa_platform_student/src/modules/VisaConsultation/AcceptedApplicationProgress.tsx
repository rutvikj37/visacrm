import DocumentPicker from "@/components/DocumentPicker";
import CommonConfirmation from "@/components/CommonConfirmation";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import fetchQueriesHook from "@/hooks/fetchQueriesHook";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { Avatar, Button, Input, Radio, RadioGroup, Spinner, Tab, Tabs } from "@nextui-org/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FileSaver from "file-saver";
import { ArrowDownToLine, CircleCheck, Phone, User, FileText, MessageSquare, Upload, CheckCircle2, XCircle, AlertCircle, Clock, HelpCircle } from 'lucide-react';
import moment from "moment";
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Steps } from "rsuite";
import { PRIMARY_COLOR, PRIMARY_COLOR_50, PRIMARY_COLOR_200 } from '@/lib/theme';

const AcceptedApplicationProgress = () => {
    const { id } = useParams()
    const { commonGetAPICalls, commonPostAPICallWithFile } = useApiCallUtils()

    const [searchParams, setSearchParams] = useSearchParams();
    const queryStep = parseInt(searchParams.get("step")) || 0;

    const [step, setStep] = useState(queryStep);

    useEffect(() => {
        setStep(queryStep);
    }, [queryStep]);


    const onChange = (nextStep) => {
        const maxSteps = tabs?.steps?.length ? tabs?.steps?.length - 1 : 3;
        const newStep = nextStep < 0 ? 0 : nextStep > maxSteps ? maxSteps : nextStep;
        setStep(newStep);
        setSearchParams({ step: newStep });
    };

    const fetchQueryClient = fetchQueriesHook()

    const queryClient = useQueryClient();

    const StepDetails = ({ step_id, description }) => {

        // Function to fetch questions for the given step
        const fetchQuestions = async () => {
            const { success, data, message } = await commonGetAPICalls(
                `/leads/lead_progress/student/get_questions/${step_id}`
            );
            if (success && success === true) {
                return data;
            }
            throw new Error(message);
        };

        const { data, isFetching, isError, error } = useQuery({
            queryKey: ['questions', step_id],
            queryFn: fetchQuestions,
        });

        // submit answer 
        const submitAnswerAPI = async ({ questionId, answer, file }) => {
            // For file uploads, you might need to use FormData.
            const formData = new FormData();
            formData.append('questionId', questionId);
            if (file) {
                formData.append('file', file);
            } else {
                formData.append('answer', answer);
            }
            const response = await commonPostAPICallWithFile(formData, `/leads/lead_progress/student/submit_answer`);
            if (response.success) {
                return response;
            }
            throw new Error(response.message);
        };

        // useMutation hook to submit an answer for a specific question
        const mutation = useMutation({
            mutationFn: submitAnswerAPI,
            onSuccess: () => {
                // Invalidate and refetch
                queryClient.invalidateQueries({ queryKey: ['questions', step_id] });
            },
        });

        // Local state to keep track of individual answers
        const [answers, setAnswers] = useState({});

        // Handle input changes for text-based answers
        const handleTextChange = (questionId, value) => {
            setAnswers(prev => ({
                ...prev,
                [questionId]: { ...prev[questionId], answer: value },
            }));
        };

        // Handle file changes for file_selector questions
        const handleFileChange = (questionId, file) => {
            setAnswers(prev => ({
                ...prev,
                [questionId]: { ...prev[questionId], file },
            }));
        };

        // Submit answer for a specific question using mutation
        const handleSubmitAnswer = (questionId) => {
            const answerData = answers[questionId] || {};
            mutation.mutate({
                questionId,
                answer: answerData.answer,
                file: answerData.file,
            });
        };

        return (
            <Card className="rounded-xl border border-default-200 bg-content1 shadow-none">
                <CardHeader className="pb-4 border-b border-default-200">
                    <div className="flex items-center gap-3">
                        <div 
                            className="p-2 rounded-lg"
                            style={{ 
                                backgroundColor: `${PRIMARY_COLOR_50}80`,
                                border: `1.5px solid ${PRIMARY_COLOR_200}`
                            }}
                        >
                            <FileText size={20} style={{ color: PRIMARY_COLOR }} />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                                {data?.step?.step_title || "Step Details"}
                            </CardTitle>
                            {description && (
                                <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                                    {description}
                                </CardDescription>
                            )}
                        </div>
                        {data?.step && (
                            <Badge
                                variant={data?.step?.step_status === 1 ? "default" : "secondary"}
                                className={data?.step?.step_status === 1 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}
                            >
                                {data?.step?.step_status === 0 ? "Incomplete" : data?.step?.step_status === 1 ? "Completed" : "Unknown"}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {isError ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                            <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
                            <p className="text-red-600 dark:text-red-400">{error?.message}</p>
                        </div>
                    ) : isFetching && !data ? (
                        <div className="flex items-center justify-center w-full py-12">
                            <div className="flex flex-col items-center gap-4">
                                <Spinner size="lg" style={{ color: PRIMARY_COLOR }} />
                                <p className="text-gray-600 dark:text-gray-400">Loading questions...</p>
                            </div>
                        </div>
                    ) : data?.questions?.length === 0 ? (
                        <Card className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <CardContent className="p-8 text-center">
                                <HelpCircle size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">No Questions Created Yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {data?.questions?.map((question) => (
                                <Card
                                    key={question?.id}
                                    className={`border ${
                                        question?.status === 'rejected'
                                            ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20'
                                            : question?.status === 'completed'
                                            ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                                    }`}
                                >
                                    <CardContent className="p-6">
                                        {/* Question Header */}
                                        <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex items-start gap-3 flex-1">
                                                <Avatar
                                                    showFallback
                                                    src={question?.created_by?.profile_image}
                                                    size="sm"
                                                    className="w-10 h-10 border-2 border-gray-200 dark:border-gray-700"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {question?.created_by?.username || "Unknown"}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Clock size={12} className="text-gray-500 dark:text-gray-400" />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {question?.createdAt ? moment(question?.createdAt).format('MMM DD, YYYY h:mm A') : "N/A"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge
                                                variant={
                                                    question?.status === 'completed' || question?.status === 'provided'
                                                        ? "default"
                                                        : question?.status === 'rejected'
                                                        ? "destructive"
                                                        : "secondary"
                                                }
                                                className={`
                                                    capitalize
                                                    ${question?.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                                                    ${question?.status === 'completed' || question?.status === 'provided' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                                    ${question?.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                                                `}
                                            >
                                                {question?.status}
                                            </Badge>
                                    </div>

                                        {/* Question Text */}
                                        <div className="mb-4">
                                            <div className="flex items-start gap-2 mb-2">
                                                <MessageSquare size={18} style={{ color: PRIMARY_COLOR }} className="mt-0.5 flex-shrink-0" />
                                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                        {question?.question_text || ""}
                                                </h3>
                                            </div>
                                        </div>

                                    {/* For pending questions, provide an individual answer form */}
                                    {(question?.status === 'pending' || question?.status === 'rejected') && (
                                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            {question?.question_type === 'text_input' && (
                                                    <div className="space-y-3">
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            Your Answer
                                                        </label>
                                                        <Input
                                                        type="text"
                                                        placeholder="Enter your answer"
                                                        value={answers[question?.id]?.answer || ''}
                                                        onChange={(e) =>
                                                            handleTextChange(question?.id, e.target.value)
                                                        }
                                                            className="w-full"
                                                    />
                                                    <Button
                                                        onPress={() => handleSubmitAnswer(question?.id)}
                                                        size="sm"
                                                        style={{ backgroundColor: PRIMARY_COLOR, color: 'white' }}
                                                        isDisabled={mutation.isPending || !answers[question?.id]?.answer}
                                                        isLoading={mutation.isPending}
                                                    >
                                                            Submit Answer
                                                    </Button>
                                                    </div>
                                            )}

                                            {question?.question_type === 'file_selector' && (
                                                    <div className="space-y-3">
                                                        <DocumentPicker
                                                            value={answers[question?.id]?.file || null}
                                                            onChange={(file) => handleFileChange(question?.id, file)}
                                                        />
                                                    <Button
                                                        onPress={() => handleSubmitAnswer(question?.id)}
                                                            size="sm"
                                                        style={{ backgroundColor: PRIMARY_COLOR, color: 'white' }}
                                                            isDisabled={mutation.isPending || !answers[question?.id]?.file}
                                                            isLoading={mutation.isPending}
                                                            startContent={<Upload size={16} />}
                                                    >
                                                        Submit File
                                                    </Button>
                                                    </div>
                                            )}
                                        </div>
                                    )}

                                    {/* For completed questions, display answer details */}
                                    {(question?.status === 'completed' || question?.status === 'provided') && (
                                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            {question?.question_type === 'text_input' && (
                                                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                                            Your Answer
                                                        </p>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                            {question?.question_answer || "N/A"}
                                                        </p>
                                                    </div>
                                            )}
                                            {(question?.question_type === 'file_selector' || question?.question_type === 'document_provide') && (
                                                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                                            Submitted File
                                                        </p>
                                                        <div className="flex items-center gap-3">
                                                            <FileText size={18} style={{ color: PRIMARY_COLOR }} />
                                                    <a
                                                        href={question?.file_path || "#"}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                                className="text-sm font-medium hover:underline"
                                                                style={{ color: PRIMARY_COLOR }}
                                                    >
                                                        View File
                                                    </a>
                                                    <Button
                                                        size="sm"
                                                                variant="flat"
                                                        style={{ backgroundColor: PRIMARY_COLOR_50, color: PRIMARY_COLOR }}
                                                                isIconOnly
                                                        onPress={() => {
                                                            if (question?.file_path) {
                                                                FileSaver.saveAs(question?.file_path);
                                                            }
                                                        }}
                                                            >
                                                                <ArrowDownToLine size={16} />
                                                            </Button>
                                                        </div>
                                                </div>
                                            )}
                                            {question?.question_type === 'update_status' && (
                                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                                        <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
                                                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                                            Status Updated
                                                        </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Display rejection reason if rejected */}
                                        {question?.status === 'rejected' && question?.reason && (
                                            <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
                                                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                                                    <XCircle size={18} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">
                                                            Rejection Reason
                                                        </p>
                                                        <p className="text-sm text-red-700 dark:text-red-300">
                                                            {question?.reason || "No reason provided"}
                                            </p>
                                        </div>
                                        </div>
                                    </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };


    // fetch steps 

    const { data: tabs, isFetching, isLoading, isError, error } = useQuery({
        queryKey: ['steps', id],
        queryFn: () => fetchSteps()
    })
    const initialLoad = isLoading && !tabs

    const fetchSteps = async (): Promise<any> => {
        const { success, data, message } = await commonGetAPICalls(`/leads/lead_progress/student/get_steps/${id}`)
        if (success && success === true) {
            return data
        }
        throw new Error(message)
    }

    const navigate = useNavigate()

    // withdraw application
    const [isOpen, setIsOpen] = useState(false)

    const withdrawApplication = async () => {
        const { success, data, message } = await commonGetAPICalls(`/leads/lead_progress/student/widthdraw_application/${id}`)
        if (success && success === true) {
            SuccessToast(message)
            return data
        }
        ErrorToast(message)
        throw new Error(message)
    }

    const withdrawApplicationMutation = useMutation({
        mutationFn: withdrawApplication,
        onSuccess: () => {
            navigate(-1)
        }
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                        Application Progress
                    </h1>
                    <p className="text-sm text-default-500">
                        Track your application progress and respond to agent questions
                        {tabs?.steps?.length > 0 ? ` · ${tabs.steps.length} steps` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isFetching && !initialLoad && (
                        <Spinner size="sm" style={{ color: PRIMARY_COLOR }} />
                    )}
                    <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        className="w-full sm:w-auto"
                        onPress={() => setIsOpen(true)}
                    >
                        Withdraw Application
                    </Button>
                </div>
            </div>

            {tabs?.agent && (
                <div className="rounded-xl border border-default-200 bg-content1 p-4">
                    <div className="flex items-center gap-3">
                        <Avatar
                            showFallback
                            src={tabs?.agent?.profile_image || tabs?.agent?.access_profile}
                            size="lg"
                            className="w-12 h-12 border border-default-200"
                        />
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <User size={16} className="text-primary shrink-0" />
                                <p className="text-sm font-semibold text-foreground truncate">
                                    {tabs?.agent?.username || "Unknown Agent"}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-default-500">
                                <Phone size={14} />
                                <span>{tabs?.agent?.phone || tabs?.agent?.phone_number || "N/A"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isError ? (
                <div className="rounded-xl border border-danger-200 bg-content1 p-8 text-center">
                    <AlertCircle size={40} className="mx-auto text-danger mb-3" />
                    <p className="text-lg font-semibold text-foreground mb-1">Error Loading Progress</p>
                    <p className="text-sm text-danger">
                        {error?.message || "An error occurred while loading the application progress"}
                    </p>
                </div>
            ) : initialLoad ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <Spinner size="lg" style={{ color: PRIMARY_COLOR }} />
                        <p className="text-sm text-default-500">Loading application progress...</p>
                    </div>
                </div>
            ) : tabs?.steps?.length === 0 ? (
                <div className="rounded-xl border border-default-200 bg-content1 p-10 text-center">
                    <CircleCheck size={40} className="mx-auto text-default-400 mb-3" />
                    <p className="text-lg font-semibold text-foreground mb-1">No Steps Created Yet</p>
                    <p className="text-sm text-default-500">
                        You'll hear from the agent soon. Steps will appear here once they are created.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-1">
                        <div className="rounded-xl border border-default-200 bg-content1 sticky top-6">
                            <div className="px-4 py-3 border-b border-default-200">
                                <p className="text-sm font-semibold text-foreground">Steps</p>
                            </div>
                            <div className="p-4">
                                <Steps current={step} vertical>
                                    {tabs?.steps?.map((item: any, index: number) => (
                                        <Steps.Item
                                            onClick={() => { onChange(index) }}
                                            title={item?.step_title || ""}
                                            description={item?.step_description || ""}
                                            key={item?.id}
                                            className={`cursor-pointer transition-colors ${
                                                step === index
                                                    ? "font-bold"
                                                    : "text-default-500"
                                            }`}
                                            style={step === index ? { color: PRIMARY_COLOR } : undefined}
                                            status={`${item?.step_status === 1 ? "finish" : "wait"}`}
                                        />
                                    ))}
                                </Steps>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        {tabs?.steps?.[step] && (
                            <StepDetails
                                step_id={tabs?.steps?.[step]?.id}
                                description={tabs?.steps?.[step]?.step_description}
                            />
                        )}
                    </div>
                </div>
            )}

            <CommonConfirmation
                isOpen={isOpen}
                onOpenChange={() => setIsOpen(false)}
                title='Are you sure you want to withdraw application?'
                handleSubmit={() => withdrawApplicationMutation.mutate()}
                nagativeTitle='No'
                positiveTitle='Yes'
            />
        </div>
    )
}

export default AcceptedApplicationProgress