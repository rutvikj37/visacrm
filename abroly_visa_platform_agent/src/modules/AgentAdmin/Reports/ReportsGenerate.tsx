import fetchQueriesHook from '@/hooks/fetchQueriesHook';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { ErrorToast, SuccessToast } from '@/utils/Toaster';
import { Button, Spinner } from '@heroui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, BarChart3, TrendingUp, Users, CheckCircle2, Target, Globe, Award, Download, AlertCircle } from 'lucide-react';
import React from 'react'
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from '@/lib/theme';

const ReportsGenerate = () => {

    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils()

    const queryClient = fetchQueriesHook()

    const requestReport = async (reportType: string) => {
        // const response = await commonGetAPICalls('/reports/request', { method: 'POST', body: JSON.stringify({ reportType }) });
        const {data,success,message} = await commonPostAPICall({ reportType }, '/reports/request', true);
        // if (response.success) {
        //     alert(`Report ${reportType} queued with ID: ${response.data.reportId}`);
        // } else {
        //     alert(`Error: ${response.message}`);
        // }
        if(success && success == true){
            return data
        }
        throw new Error(message);
    };

    const handleGenerateReportMutation = useMutation({
        mutationFn: requestReport,
        onSuccess: (data) => {
            SuccessToast(`Report queued with ID: ${data.reportId}`);
            queryClient(['reports']);
        },
        onError: (error) => {
            ErrorToast(`Error: ${error.message}`);
        },
    })

    const { data: reports, isFetching: isReportsLoading } = useQuery({
        queryKey: ['reports'],
        queryFn: async () => (await commonGetAPICalls('/reports/list')).data,
    });
    const reportTypes = [
        { 
            type: 'agent_activity', 
            label: 'Agent Activity Report', 
            icon: Users,
            description: 'Track agent activities and performance'
        },
        { 
            type: 'lead_conversion', 
            label: 'Lead Conversion Report', 
            icon: TrendingUp,
            description: 'Analyze lead conversion rates'
        },
        { 
            type: 'student_engagement', 
            label: 'Student Engagement Report', 
            icon: Target,
            description: 'Monitor student engagement metrics'
        },
        { 
            type: 'step_completion', 
            label: 'Step Completion Report', 
            icon: CheckCircle2,
            description: 'Track application step completions'
        },
        { 
            type: 'question_resolution', 
            label: 'Question Resolution Report', 
            icon: BarChart3,
            description: 'Analyze question resolution times'
        },
        { 
            type: 'lead_source', 
            label: 'Lead Source Effectiveness', 
            icon: Globe,
            description: 'Evaluate lead source performance'
        },
        { 
            type: 'country_intake', 
            label: 'Country & Intake Trends', 
            icon: Globe,
            description: 'View country and intake analytics'
        },
        { 
            type: 'agent_performance', 
            label: 'Agent Performance Summary', 
            icon: Award,
            description: 'Comprehensive agent performance metrics'
        },
    ];

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30 p-4 sm:p-6">
            <style>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes shimmer {
                    0% {
                        background-position: -1000px 0;
                    }
                    100% {
                        background-position: 1000px 0;
                    }
                }
            `}</style>

            <div className="max-w-[1920px] mx-auto space-y-6">
                {/* Premium Header Section */}
                <div className="relative mb-2">
                    <div className="relative py-1">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="relative p-2 bg-primary-50 rounded-xl border border-primary-100">
                                    <BarChart3 className="w-6 h-6 text-foreground" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-1 
                                             tracking-tight leading-tight">
                                    Reports Generator
                                </h1>
                                <p className="text-default-500 text-xs sm:text-sm font-medium">
                                    Generate and download comprehensive analytics reports
                                </p>
                            </div>
                        </div>
                    </div>
                    </div>

                {/* Premium Report Request Section */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-lg blur-md opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                            <div className="relative p-2 rounded-lg shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                                <FileSpreadsheet className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Request Reports</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {reportTypes.map((reportType, index) => {
                            const Icon = reportType.icon;
                            return (
                                <button
                                    key={reportType.type}
                                    onClick={() => handleGenerateReportMutation.mutate(reportType.type)}
                                    disabled={handleGenerateReportMutation.isPending}
                                    className="group relative bg-gradient-to-br from-white via-gray-50/50 to-white rounded-xl p-4 
                                             border border-gray-200/60 shadow-md hover:shadow-xl transition-all duration-300 
                                             hover:-translate-y-1 overflow-hidden text-left"
                                    style={{ animation: `fadeInUp 0.6s ease-out ${index * 50}ms both` }}
                                >
                                    {/* Gradient overlay on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                         style={{ background: `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)` }} />
                                    
                                    <div className="relative z-10">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="relative flex-shrink-0">
                                                <div className="absolute inset-0 rounded-lg blur-md opacity-20" style={{ backgroundColor: PRIMARY_COLOR }} />
                                                <div className="relative p-2 rounded-lg" style={{ background: getPrimaryGradient('to-br') }}>
                                                    <Icon className="w-5 h-5 text-white" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">
                                                    {reportType.label}
                                                </h3>
                                                <p className="text-xs text-gray-600 leading-relaxed">
                                                    {reportType.description}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: BRAND_TEXT }}>
                                            <span>Request Report</span>
                                            <TrendingUp className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Premium Generated Reports Section */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-lg blur-md opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                            <div className="relative p-2 rounded-lg shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                                <FileSpreadsheet className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Generated Reports</h2>
                    </div>
                    
                    {isReportsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="relative w-16 h-16 mx-auto mb-4">
                                    <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}20` }}></div>
                                    <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }}></div>
                                </div>
                                <p className="text-sm font-medium text-gray-600 animate-pulse">Loading reports...</p>
                            </div>
                        </div>
                    ) : !reports || reports.length === 0 ? (
                        <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-600 font-semibold text-base">No reports generated yet</p>
                            <p className="text-gray-500 text-sm mt-1">Request a report to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {reports.map((report: any, index: number) => (
                                <div
                                    key={report.id}
                                    className="group relative bg-gradient-to-br from-white via-gray-50/50 to-white rounded-xl p-4 
                                             border border-gray-200/60 shadow-md hover:shadow-xl transition-all duration-300 
                                             hover:-translate-y-1 overflow-hidden"
                                    style={{ animation: `fadeInUp 0.6s ease-out ${index * 50}ms both` }}
                                >
                                    {/* Gradient overlay on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                         style={{ background: `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)` }} />
                                    
                                    <div className="relative z-10">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="relative flex-shrink-0">
                                                <div className="absolute inset-0 rounded-lg blur-md opacity-20" 
                                                     style={{ backgroundColor: report.filename ? '#10b981' : PRIMARY_COLOR }} />
                                                <div className="relative p-2 rounded-lg"
                                                     style={{ 
                                                       background: report.filename 
                                                         ? 'linear-gradient(to bottom right, #10b981, #059669)' 
                                                         : getPrimaryGradient('to-br')
                                                     }}>
                                                    {report.filename ? (
                                                        <FileSpreadsheet className="w-5 h-5 text-white" />
                                                    ) : (
                                                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold text-gray-900 mb-1 truncate capitalize">
                                                    {report?.reportType?.split('_').join(' ')}
                                                </h3>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(report.createdAt).toLocaleDateString('en-US', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-3 pt-3 border-t border-gray-200/60">
                                            {report.filename ? (
                                                <a
                                                    href={report.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group/link flex items-center gap-2 text-sm font-semibold transition-colors"
                                                    style={{ color: BRAND_TEXT }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR_DARK}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
                                                >
                                                    <Download className="w-4 h-4 group-hover/link:scale-110 transition-transform" />
                                                    <span>Download Report</span>
                                                </a>
                                            ) : (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: BRAND_TEXT }} />
                                                    <span className="font-medium">Generating...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ReportsGenerate