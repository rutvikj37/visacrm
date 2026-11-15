import BackButton from '@/components/BackButton'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Avatar, Select, SelectItem, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const JobPostApplicants = () => {
    const { commonPostAPICall } = useApiCallUtils()
    // applicants
    const { id } = useParams()
    const [loading, setIsLoading] = useState(false)
    const [applicants, setApplicantsData] = useState([])

    useEffect(() => {
        findJobPostApplicants()
    }, [])

    const findJobPostApplicants = async () => {
        setIsLoading(true)
        const { success, data } = await commonPostAPICall({ uuid: id }, "/job_post/applicants")
        if (success && success == true) {
            setApplicantsData(data)
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
        <div className='container mx-auto'>
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
                                {/* {applicant?.status} */}
                                <Select
                                    placeholder="Status"
                                    size='sm'
                                    value={applicant?.status}
                                    defaultSelectedKeys={[applicant?.status]}
                                    onChange={(e) => {
                                        // console.log(e.target.value);
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
        </div>
    )
}

export default JobPostApplicants