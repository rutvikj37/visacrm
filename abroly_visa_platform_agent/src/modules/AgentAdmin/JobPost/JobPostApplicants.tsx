import BackButton from '@/components/BackButton'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Avatar, Pagination, Select, SelectItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const PAGE_SIZE = 25

const JobPostApplicants = () => {
    const { commonPostAPICall } = useApiCallUtils()
    const { id } = useParams()
    const [loading, setIsLoading] = useState(false)
    const [applicants, setApplicantsData] = useState([])
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    useEffect(() => {
        findJobPostApplicants()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, page])

    const findJobPostApplicants = async () => {
        setIsLoading(true)
        const { success, data, total } = await commonPostAPICall({
            uuid: id,
            offset: (page - 1) * PAGE_SIZE,
            limit: PAGE_SIZE,
        }, "/job_post/applicants")
        if (success && success == true) {
            setApplicantsData(data || [])
            setTotalPages(Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE)))
        }
        setIsLoading(false)
    }

    const changeStatus = async (uuid: string, status: string) => {
        const { success } = await commonPostAPICall({ uuid, status }, "/job_post/change_status", true)
        if (success && success == true) {
            findJobPostApplicants()
        }
    }

    return (
        <div className='container mx-auto flex flex-col gap-4 p-1 sm:p-2'>
            <Table
                aria-label="Job Post Listing"
                style={{
                    height: "auto",
                    minWidth: "100%",
                }}
                topContent={
                    <BackButton
                        title={"Applicants"}
                    />
                }
            >
                <TableHeader>
                    <TableColumn>Profile</TableColumn>
                    <TableColumn>Email</TableColumn>
                    <TableColumn>Phone</TableColumn>
                    <TableColumn>Created At</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Change Status</TableColumn>
                </TableHeader>
                <TableBody
                    emptyContent={
                        <p>No Rows to display</p>
                    }
                    loadingContent={<Spinner />}
                    isLoading={loading}
                >
                    {applicants.map((applicant) => (
                        <TableRow key={applicant?.uuid}>
                            <TableCell>
                                <Avatar
                                    src={applicant?.access_profile}
                                    showFallback
                                    size='sm'
                                />
                            </TableCell>
                            <TableCell>{applicant?.email}</TableCell>
                            <TableCell>{applicant?.phone_number}</TableCell>
                            <TableCell>{applicant?.createdAt}</TableCell>
                            <TableCell>{applicant?.status}</TableCell>
                            <TableCell className="min-w-8" >
                                <Select
                                    placeholder="Status"
                                    size='sm'
                                    value={applicant?.status}
                                    defaultSelectedKeys={[applicant?.status]}
                                    onChange={(e) => {
                                        changeStatus(applicant?.item_uuid, e.target.value)
                                    }}
                                >
                                    {["pending", "accept", "reject"].map((items) => <SelectItem key={items}>{items}</SelectItem>)}
                                </Select>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {totalPages > 1 && (
                <div className="flex justify-center">
                    <Pagination total={totalPages} page={page} onChange={setPage} showControls />
                </div>
            )}
        </div>
    )
}

export default JobPostApplicants
