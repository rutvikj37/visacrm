import BackButton from '@/components/BackButton';
import { SuccessToast } from '@/utils/Toaster';
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { ArrowLeft, Briefcase, Plus, Edit } from 'lucide-react';
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom';

import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import ReactFlagsSelect from 'react-flags-select';
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from '@/lib/theme';
const JobPostAddEdit = () => {
    const { commonPostAPICall } = useApiCallUtils()

    const navigate = useNavigate()

    const { state }: any = useLocation()

    const jobPost = state.jobPost

    // console.log(jobPost,"JOBPOST");


    const [formData, setFormData] = useState({
        jobType: jobPost?.jobType || "Full-time",
        country: jobPost?.country || "",
        jobRole: jobPost?.jobRole || "",
        salaryMin: jobPost?.salaryMin || "",
        salaryMax: jobPost?.salaryMax || "",
        experienceRequired: jobPost?.experienceRequired || "",
        educationLevel: jobPost?.educationLevel || "",
        workPermit: jobPost?.workPermit || "Employment Visa (ECR)",
        overtime: jobPost?.overtime || false,
        accommodation: jobPost?.accommodation || false,
        transportation: jobPost?.transportation || false,
        food: jobPost?.food || "",
        medicalInsurance: jobPost?.medicalInsurance || false,
        workHours: jobPost?.workHours || "",
        agentCharges: jobPost?.agentCharges || "",
        skillsRequired: jobPost?.skillsRequired || "",
        applicationDeadline: jobPost?.applicationDeadline || "",
        description: jobPost?.description || "",
        uuid: jobPost?.uuid || ""
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(formData);
        // here handle submit operation

        const { data, success } = await commonPostAPICall(
            { ...formData },
            formData.uuid !== "" ? "job_post/update" : "/job_post/create")
        if (success && success == true) {
            SuccessToast("Job Post Created")
            navigate(-1)
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value,
        });
    };

    const handleChangeDescription = (e) => {
        setFormData({
            ...formData,
            description: e
        })
    }


    const isEditMode = jobPost?.id;

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
                        <div className="flex items-center gap-3">
                            <BackButton
                                title=""
                            />
                            <div className="flex-1">
                                <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-1 
                                             tracking-tight leading-tight">
                                    {isEditMode ? "Edit Job Post" : "Add Job Post"}
                                </h1>
                                <p className="text-default-500 text-xs sm:text-sm font-medium">
                                    {isEditMode ? "Update job post details" : "Create a new job posting"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                </div>

            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1920px] mx-auto">
                    <form className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg p-6 sm:p-8" onSubmit={handleSubmit} style={{ animation: 'fadeInUp 0.6s ease-out' }}>
                        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-6">
                    <div className="space-y-1">
                        <Select
                        placeholder="Select Job Type"
                            // label="Select Job Type"
                            // placeholder="Select Job Type"
                            labelPlacement="outside"
                            value={formData.jobType}
                            defaultSelectedKeys={["Full-time"]}
                            onChange={handleChange}
                            classNames={{
                                trigger: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                        >
                            {[
                                "Full-time",
                                "Part-time",
                                "Temporary/Contract",
                                "Internship"].map((items) => <SelectItem key={items}>{items}</SelectItem>)}
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Select
                            // label="Select Work Permit"
                            placeholder="Select Work Permit"
                            labelPlacement="outside"
                            value={formData.workPermit}
                            onChange={handleChange}
                            defaultSelectedKeys={["Employment Visa (ECR)"]}
                            classNames={{
                                trigger: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                        >
                            {[
                                "Employment Visa (ECR)",
                                "Employment Visa (ECNR)"].map((items) => <SelectItem key={items}>{items}</SelectItem>)}
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Country</label>
                        <ReactFlagsSelect
                            selected={formData.country}
                            searchable
                            onSelect={(e) => setFormData({ ...formData, country: e })}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="text"
                            name="jobRole"
                            // label="Job Role"
                            placeholder="Enter job role"
                            labelPlacement="outside"
                            value={formData.jobRole}
                            onChange={handleChange}
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="number"
                            name="salaryMin"
                            // label="~Salary Min / Month (INR)"
                            placeholder="Enter minimum salary in INR"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            value={formData.salaryMin}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="number"
                            name="salaryMax"
                            // label="~Salary Max / Month (INR)"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            placeholder="Enter maximum salary in INR"
                            value={formData.salaryMax}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="number"
                            // label="Experience Required (Years)"
                            name="experienceRequired"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            placeholder="Enter years of experience"
                            value={formData.experienceRequired}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            // label="Education Level"
                            type="text"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            name="educationLevel"
                            placeholder="Enter education level"
                            value={formData.educationLevel}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="text"
                            name="food"
                            // label="Food"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            placeholder="Enter food details"
                            value={formData.food}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="text"
                            name="workHours"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            // label="Working Hours / Month"
                            placeholder="Enter working hours per month"
                            value={formData.workHours}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            // label="Agent Charges"
                            type="text"
                            name="agentCharges"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            placeholder="Enter agent charges"
                            value={formData.agentCharges}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="text"
                            // label="Skills Required"
                            name="skillsRequired"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            placeholder="Communication, Problem Solving, etc."
                            value={formData.skillsRequired}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1">
                        <Input
                            type="date"
                            // label="Application Deadline"
                            name="applicationDeadline"
                            labelPlacement="outside"
                            classNames={{
                                inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors",
                                label: "text-sm font-medium text-gray-700 mb-1"
                            }}
                            value={formData.applicationDeadline}
                            onChange={handleChange}
                        />
                    </div>

                </div>

                        <section className='p-4 sm:p-6 bg-gray-50/50 rounded-xl border border-gray-200/50 space-y-3 col-span-full'>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                    <Briefcase className="h-4 w-4" style={{ color: BRAND_TEXT }} />
                                </div>
                                <p className="text-base font-semibold text-gray-800">Description</p>
                            </div>
                            <ReactQuill
                                theme="snow"
                                value={formData.description}
                                onChange={handleChangeDescription}
                                className="bg-white rounded-lg"
                            />
                        </section>

                        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-2 py-4 col-span-full bg-gray-50/50 rounded-xl border border-gray-200/50'>
                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    name="overtime"
                                    checked={formData.overtime}
                                    onChange={handleChange}
                                    className="h-4 w-4 rounded border-gray-300"
                                    style={{ accentColor: PRIMARY_COLOR }}
                                />
                                <label className="ml-2 block text-sm font-medium text-gray-700">Overtime</label>
                            </div>

                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    name="accommodation"
                                    checked={formData.accommodation}
                                    onChange={handleChange}
                                    className="h-4 w-4 rounded border-gray-300"
                                    style={{ accentColor: PRIMARY_COLOR }}
                                />
                                <label className="ml-2 block text-sm font-medium text-gray-700">Accommodation</label>
                            </div>

                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    name="transportation"
                                    checked={formData.transportation}
                                    onChange={handleChange}
                                    className="h-4 w-4 rounded border-gray-300"
                                    style={{ accentColor: PRIMARY_COLOR }}
                                />
                                <label className="ml-2 block text-sm font-medium text-gray-700">Transportation</label>
                            </div>

                            <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    name="medicalInsurance"
                                    checked={formData.medicalInsurance}
                                    onChange={handleChange}
                                    className="h-4 w-4 rounded border-gray-300"
                                    style={{ accentColor: PRIMARY_COLOR }}
                                />
                                <label className="ml-2 block text-sm font-medium text-gray-700">Medical Insurance</label>
                            </div>
                        </div>

                        <div className="col-span-full flex justify-end mt-6">
                            <Button
                                type="submit"
                                className="font-semibold shadow-lg hover:shadow-xl transition-all min-w-[180px]"
                                style={{ 
                                    background: getPrimaryGradient('to-r'),
                                    color: 'white'
                                }}
                            >
                                {isEditMode ? (
                                    <>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Update Job Post
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Job Post
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default JobPostAddEdit