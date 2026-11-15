import { Button, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tooltip, useDisclosure, Chip } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CommonConfirmation from '@/components/CommonConfirmation'
import { Pencil, Trash2, Briefcase, Plus, Globe, DollarSign, Clock, Calendar, Users, Eye, CheckCircle2, XCircle } from 'lucide-react'
import { AlertTriangle } from 'lucide-react';
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { countries } from "country-data"
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from '@/lib/theme'

const JobPost = () => {

    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils()

    const [jobPosts, setJobPosts] = useState([])
    const [isLoading, setIsLoading] = useState<boolean>(true)


    const { status } = useParams()
    const navigate = useNavigate()

    const [canPost, setCanPost] = useState(false)
    const [canPostLoading, setCanPostLoading] = useState(true)

    const statusMustBe = ["active", "inactive"]

    useEffect(() => {
        if (!statusMustBe.includes(status)) {
            navigate("/job_post/find/active")
        }
        findJobPost()

    }, [status, navigate])

    const findJobPost = async () => {
        const soft = jobPosts.length > 0
        if (!soft) setIsLoading(true)
        const { data, success } = await commonGetAPICalls(`/job_post/created_list/${status}`)
        if (success && success == true) {
            setJobPosts(data)
        }
        setIsLoading(false)
    }

    // delete
    const { isOpen: isDeleteCnfOpen, onOpenChange: onDeleteCnfOpenChange } = useDisclosure();

    const [deleteUUID, setDeleteUUID] = useState("")
    const deletJobPost = async () => {
        const { success } = await commonPostAPICall({ uuid: deleteUUID }, "job_post/delete", true)
        if (success && success == true) {
            findJobPost()
            onDeleteCnfOpenChange()
            setDeleteUUID("")
        }
    }


    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Job posts</h1>
                        <p className="text-sm text-default-500">
                            {status === 'active' ? 'Active openings on your portal' : 'Inactive openings'}
                        </p>
                    </div>
                    {status == "active" && (
                        <Button
                            color="primary"
                            className="w-full sm:w-auto"
                            startContent={<Plus className="w-4 h-4" />}
                            onPress={() => navigate("/job_post/edit", { state: {} })}
                        >
                            Add job post
                        </Button>
                    )}
                </div>

                <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
                    <div className="p-3 sm:p-4">
                        {isLoading && jobPosts.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 py-14">
                                <Spinner size="sm" />
                                <span className="text-sm text-default-500">Loading…</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table
                                    aria-label="Job Post Listing"
                                    removeWrapper
                                    classNames={{
                                        table: "min-w-[760px]",
                                        th: "bg-default-100/80 text-default-600 text-xs font-semibold uppercase tracking-wide",
                                        td: "py-3 align-middle",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn>Job type</TableColumn>
                                        <TableColumn>Country</TableColumn>
                                        <TableColumn>Role</TableColumn>
                                        <TableColumn>Salary</TableColumn>
                                        <TableColumn>Experience</TableColumn>
                                        <TableColumn>Created</TableColumn>
                                        <TableColumn>Applications</TableColumn>
                                        <TableColumn>Status</TableColumn>
                                        <TableColumn>Details</TableColumn>
                                        <TableColumn>Actions</TableColumn>
                                    </TableHeader>
                                    <TableBody
                                        emptyContent={
                                            <div className="text-center py-10">
                                                <Briefcase className="w-8 h-8 text-default-400 mx-auto mb-3" />
                                                <p className="font-semibold text-foreground">No job posts yet</p>
                                                <p className="text-sm text-default-500 mt-1">Add an opening to show on your portal</p>
                                            </div>
                                        }
                                        isLoading={isLoading}
                                        loadingContent={<Spinner size="sm" />}
                                    >
                                        {jobPosts.map((post, index) => (
                                            <TableRow 
                                                key={post?.id}
                                                className="group hover:bg-gray-50/80 transition-colors duration-200"
                                            >
                                                <TableCell>
                                                    <span className="text-sm font-medium text-gray-700">{post?.jobType}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {countries[post?.country]?.name || post?.country}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-medium text-gray-700">{post?.jobRole}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <DollarSign className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {post?.salaryMin} - {post?.salaryMax}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {post?.experienceRequired} years
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {new Date(post?.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className='flex flex-col sm:flex-row items-start sm:items-center gap-2'>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm font-medium text-gray-700">
                                                                {post?.applicant_count || 0}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            size='sm'
                                                            variant='flat'
                                                            className="text-xs font-semibold"
                                                            style={{ 
                                                                background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`,
                                                                color: BRAND_TEXT,
                                                                borderColor: `${PRIMARY_COLOR}30`
                                                            }}
                                                            onPress={() => {
                                                                navigate(`/job_post/applicants/${post?.uuid}`)
                                                            }}
                                                        >
                                                            View All
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider border shadow-sm ${
                                                        post?.status?.toLowerCase() === 'active' 
                                                            ? `bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-300`
                                                            : `bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-300`
                                                    }`}>
                                                        {post?.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size='sm'
                                                        variant='light'
                                                        className="text-xs font-semibold"
                                                        style={{ color: BRAND_TEXT }}
                                                        onPress={() => {
                                                            navigate(`/job_posts/${post?.uuid}`)
                                                        }}
                                                    >
                                                        <Eye className="w-4 h-4 mr-1" />
                                                        View Details
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className='flex flex-row gap-2 items-center justify-start'>
                                                        <Tooltip content="Edit">
                                                            <Button
                                                                size='sm'
                                                                className='p-2'
                                                                variant='light'
                                                                style={{ color: BRAND_TEXT }}
                                                                onPress={() => {
                                                                    navigate("/job_post/edit", {
                                                                        state: { jobPost: post }
                                                                    })
                                                                }}
                                                                isIconOnly
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                        </Tooltip>
                                                        <Tooltip content="Delete">
                                                            <Button
                                                                size='sm'
                                                                variant='light'
                                                                onPress={() => {
                                                                    setDeleteUUID(post?.uuid)
                                                                    onDeleteCnfOpenChange()
                                                                }}
                                                                isIconOnly
                                                                className='p-2 text-red-500 hover:text-red-700'
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </div>

            <CommonConfirmation
                isOpen={isDeleteCnfOpen}
                onOpenChange={onDeleteCnfOpenChange}
                title={"Are you sure want to delete ?"}
                handleSubmit={() => {
                    deletJobPost()
                }}
                nagativeTitle={"No"}
                positiveTitle={"Yes"}
            />
        </div>
    );
}




export default JobPost