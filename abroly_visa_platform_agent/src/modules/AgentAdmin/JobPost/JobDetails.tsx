import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DollarSign, Clock, GraduationCap, Briefcase, CheckCircle, XCircle, Info, Calendar, FileText, Banknote, AlertTriangle, Globe, MapPin, Shield, Utensils, Heart, Building2 } from 'lucide-react';

import { Button, Card, CardBody, Spinner } from '@heroui/react';
import BackButton from '@/components/BackButton';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { countries } from 'country-data';
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from '@/lib/theme';


const JobDetails = () => {
    const { commonPostAPICall } = useApiCallUtils()

    const { uuid } = useParams()
    const [isLoading, setIsLoading] = useState(true)
    const [details, setDetails] = useState<any>(null)

    const [isNotFound, setIsNotFound] = useState(false)

    useEffect(() => {
        window.scrollTo(0, 0)
        findCareer()
    }, [])

    const findCareer = async () => {
        setIsLoading(true)
        const { data, success } = await commonPostAPICall({ uuid }, "/job_post/details")
        if (success && success == true) {
            if (data == null) {
                setIsNotFound(true)
            }
            setDetails(data)
        }
        setIsLoading(false)
    }


    // apply
    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30">
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

            {/* Premium Header Section */}
            <div className="relative mb-2">
                <div className="relative py-1">
                    <div className="max-w-[1920px] mx-auto">
                        <BackButton
                            title={"Job Details"}
                        />
                    </div>
                </div>
                </div>

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1920px] mx-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <div className="relative w-16 h-16 mx-auto mb-4">
                                    <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}20` }}></div>
                                    <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }}></div>
                                </div>
                                <p className="text-sm font-medium text-gray-600 animate-pulse">Loading job details...</p>
                            </div>
                        </div>
                    ) : isNotFound == true ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-600 font-semibold text-lg">Job Post Not Found</p>
                            <p className="text-gray-500 text-sm mt-1">The job post you're looking for doesn't exist</p>
                        </div>
                    ) : (
                        <section className="flex flex-col lg:flex-row gap-6" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                            {/* Job Details Section */}
                            <div className="flex-grow bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
                                <div className="p-6 sm:p-8">
                                    {/* Main Job Header */}
                                    <div className="mb-6">
                                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                                            {details?.jobRole}
                                        </h1>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                                <MapPin className="h-4 w-4" style={{ color: BRAND_TEXT }} />
                                            </div>
                                            <span className="text-base text-gray-600">
                                                {countries[details?.country]?.name || details?.country}
                                            </span>
                                        </div>
                                        <p className="text-base text-gray-500 leading-relaxed">
                                            A comprehensive job opportunity as a {details?.jobRole} in {countries[details?.country]?.name || details?.country}. Explore the details below to find out if this position aligns with your skills and experience.
                                        </p>
                                    </div>

                                    {/* Job Overview */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-lg" style={{ background: getPrimaryGradient('to-r') }}>
                                                <Briefcase className="h-5 w-5 text-white" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-gray-800">Job Overview</h2>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-6">
                                            Here's a snapshot of the role. Get insights into the salary range, required experience, work hours, and more.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-center p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <div className="p-2 rounded-lg bg-green-100 mr-3">
                                                    <Banknote className="h-5 w-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Salary Range</p>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.salaryMin} - {details?.salaryMax} /Month</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <div className="p-2 rounded-lg bg-blue-100 mr-3">
                                                    <Clock className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Work Hours</p>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.workHours} hrs /Month</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <div className="p-2 rounded-lg bg-purple-100 mr-3">
                                                    <GraduationCap className="h-5 w-5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Experience Required</p>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.experienceRequired} years</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <div className="p-2 rounded-lg bg-yellow-100 mr-3">
                                                    <Briefcase className="h-5 w-5 text-yellow-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Education Level</p>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.educationLevel}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional Job Info */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-lg" style={{ background: getPrimaryGradient('to-r') }}>
                                                <Shield className="h-5 w-5 text-white" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-gray-800">Additional Benefits</h2>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-6">
                                            Discover the additional perks offered by this job, including overtime, accommodation, transportation, and more.
                                        </p>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <p className="text-sm text-gray-600 mb-1">Work Permit</p>
                                                <p className="text-base font-semibold text-gray-800">{details?.workPermit}</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className={`p-3 rounded-lg border ${details?.overtime ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {details?.overtime ? (
                                                            <CheckCircle className="text-green-500 h-5 w-5" />
                                                        ) : (
                                                            <XCircle className="text-red-500 h-5 w-5" />
                                                        )}
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {details?.overtime ? "Overtime" : "No Overtime"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-lg border ${details?.accommodation ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {details?.accommodation ? (
                                                            <CheckCircle className="text-green-500 h-5 w-5" />
                                                        ) : (
                                                            <XCircle className="text-red-500 h-5 w-5" />
                                                        )}
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {details?.accommodation ? "Accommodation" : "No Accommodation"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`p-3 rounded-lg border ${details?.transportation ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {details?.transportation ? (
                                                            <CheckCircle className="text-green-500 h-5 w-5" />
                                                        ) : (
                                                            <XCircle className="text-red-500 h-5 w-5" />
                                                        )}
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {details?.transportation ? "Transportation" : "No Transportation"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Utensils className="h-4 w-4 text-gray-400" />
                                                        <p className="text-xs text-gray-500">Food</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.food}</p>
                                                </div>
                                                <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Heart className="h-4 w-4 text-gray-400" />
                                                        <p className="text-xs text-gray-500">Medical Insurance</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.medicalInsurance ? "Yes" : "No"}</p>
                                                </div>
                                                <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <DollarSign className="h-4 w-4 text-gray-400" />
                                                        <p className="text-xs text-gray-500">Agent Charges</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.agentCharges}</p>
                                                </div>
                                                <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <FileText className="h-4 w-4 text-gray-400" />
                                                        <p className="text-xs text-gray-500">Skills Required</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">{details?.skillsRequired}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deadlines and Important Dates */}
                                    <div className="border-t border-gray-200 pt-6 mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-lg" style={{ background: getPrimaryGradient('to-r') }}>
                                                <Calendar className="h-5 w-5 text-white" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-gray-800">Important Dates</h2>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Keep track of the application deadline and when the job was posted. Make sure to apply before the deadline!
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <p className="text-xs text-gray-500 mb-1">Application Deadline</p>
                                                <p className="text-sm font-semibold text-gray-700">{new Date(details?.applicationDeadline).toLocaleDateString()}</p>
                                            </div>
                                            <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                <p className="text-xs text-gray-500 mb-1">Posted On</p>
                                                <p className="text-sm font-semibold text-gray-700">{new Date(details?.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {Array.isArray(details?.custom_fields) && details.custom_fields.length > 0 && (
                                        <div className="border-t border-gray-200 pt-6 mb-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 rounded-lg" style={{ background: getPrimaryGradient('to-r') }}>
                                                    <Info className="h-5 w-5 text-white" />
                                                </div>
                                                <h2 className="text-2xl font-bold text-gray-800">Additional details</h2>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {details.custom_fields.map((f: any) => (
                                                    <div key={f.id || f.label} className="p-3 bg-gray-50/50 rounded-lg border border-gray-200/50">
                                                        <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                                                        <p className="text-sm font-semibold text-gray-700 whitespace-pre-wrap">{f.value || "—"}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Job Description */}
                                    <div className="border-t border-gray-200 pt-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-lg" style={{ background: getPrimaryGradient('to-r') }}>
                                                <FileText className="h-5 w-5 text-white" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-gray-800">Job Description</h2>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Read the detailed description of the responsibilities, expectations, and requirements for this role.
                                        </p>
                                        <div className="p-4 bg-gray-50/50 rounded-lg border border-gray-200/50 text-gray-700 text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: details?.description }} />
                                    </div>
                                </div>
                            </div>

                            {/* Application Section */}
                            <div className="w-full lg:w-1/2">
                                <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/60 shadow-lg">
                                    <CardBody className="p-6 sm:p-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-lg" style={{ background: getPrimaryGradient('to-r') }}>
                                                <Briefcase className="h-5 w-5 text-white" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-gray-800">Apply for this Job</h2>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Ready to take the next step? Apply now and get in touch with the employer.
                                        </p>
                                        {details?.deletedAt !== null && (
                                            <Card className='my-2 border-red-200 bg-red-50'>
                                                <CardBody>
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                                        <p className="text-red-600 font-medium text-sm">
                                                            This job post is deleted by agent
                                                        </p>
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        )}
                                    </CardBody>
                                </Card>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    )
}

export default JobDetails