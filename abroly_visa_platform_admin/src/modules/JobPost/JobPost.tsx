import { Button, Card, CardBody, Select, SelectItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tooltip, useDisclosure } from "@nextui-org/react"
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CommonConfirmation from '@/components/CommonConfirmation'
import { Pencil, Trash2 } from 'lucide-react'
import { AlertTriangle, Calendar, Briefcase, FileText } from 'lucide-react';
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { countries } from 'country-data'

const JobPost = () => {

    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils()

    const [jobPosts, setJobPosts] = useState([])
    const [isLoading, setIsLoading] = useState<boolean>(true)

    const [status, setStatus] = useState("pending")

    useEffect(() => {
        findJobPost()
    }, [status])

    const findJobPost = async (opts?: { soft?: boolean }) => {
        if (!opts?.soft && jobPosts.length === 0) setIsLoading(true)
        const { data, success } = await commonGetAPICalls(`/job_post/admin_created_list?status=${status}`)
        if (success && success == true) {
            setJobPosts(data)
        }
        setIsLoading(false)
    }

    const navigate = useNavigate()

    const statusChange = async (id, status) => {
        const { success } = await commonPostAPICall({ id, status }, "/job_post/admin_change_status", true)
        if (success && success == true) {
            findJobPost({ soft: true })
        }
    }

    return (
        (<div className='container mx-auto max-w-sm sm:max-w-full'>
            <div className='space-y-2'>
                <Table
                    aria-label="Job Post Listing"
                    topContent={
                        <section className='flex flex-row justify-between items-center'>
                            <h1>Job Post</h1>
                            <Select
                                onSelectionChange={(status) => setStatus(status.currentKey)}
                                className="max-w-xs" label="Select Status">
                                {[{ key: "all", label: "All" }, { key: "pending", label: "Pending" }, { key: "active", label: "Active" },].map((item) => (
                                    <SelectItem key={item.key}>{item.label}</SelectItem>
                                ))}
                            </Select>
                        </section>
                    }
                >
                    <TableHeader>
                        <TableColumn>Job Type</TableColumn>
                        <TableColumn>Country</TableColumn>
                        <TableColumn>Job Role</TableColumn>
                        <TableColumn>Salary Range</TableColumn>
                        <TableColumn>Experience (Years)</TableColumn>
                        <TableColumn>Create Date</TableColumn>
                        <TableColumn>Agent</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Details</TableColumn>
                        <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody
                        emptyContent={
                            <p>No Rows to display</p>
                        }
                        loadingContent={<Spinner />}
                        // loadingState={isLoading}
                        isLoading={isLoading && jobPosts.length === 0}

                    >
                        {jobPosts?.map((post) => (
                            <TableRow key={post?.id}>
                                <TableCell>{post?.jobType}</TableCell>
                                <TableCell>{countries[post?.country]?.name || post?.country}</TableCell>
                                <TableCell>{post?.jobRole}</TableCell>
                                <TableCell>
                                    {post?.salaryMin} - {post?.salaryMax}
                                </TableCell>
                                <TableCell>{post?.experienceRequired}</TableCell>
                                <TableCell>{new Date(post?.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Button
                                        size='sm'
                                        variant='light'
                                        color="secondary"
                                        onPress={() => {
                                            navigate(`/agents/${post?.agent_uuid}`)
                                        }}
                                    > View Agent Profile</Button>
                                </TableCell>
                                <TableCell>{(post?.status)}</TableCell>
                                <TableCell>
                                    <Button
                                        size='sm'
                                        variant='light'
                                        color="secondary"
                                        onPress={() => {
                                            navigate(`/job_posts/${post?.uuid}`)
                                        }}
                                    > View Details</Button>
                                </TableCell>
                                <TableCell className='flex flex-row gap-2 items-center justify-start'>
                                    <Button
                                        size='sm'
                                        className='p-2'
                                        color='warning'
                                        variant='bordered'
                                        onPress={() => {
                                            statusChange(post?.id, post?.status == "pending" ? "active" : "pending")
                                        }}
                                    >{post?.status == "pending" ? "Active this" : "Make inactive"}</Button>

                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

        </div>)
    );
}

export default JobPost