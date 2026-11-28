import BackButton from '@/components/BackButton'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Chip, Image, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const TARGET_LABELS: Record<string, string> = {
    health_ins: "Health Insurance",
    sim_card: "International Sim Card",
    language: "Language Preparation",
    career: "Jobs (Career section)",
    visa_consultation: "Visa and Consultation",
}

const fmt = (v?: string | null) => {
    if (!v) return "—"
    return new Date(v).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

const Responses = () => {
    const { commonPostAPICall } = useApiCallUtils()
    const { uuid } = useParams()
    const [loading, setIsLoading] = useState(false)
    const [banner, setBanner] = useState<any>(null)
    const [applicants, setApplicantsData] = useState<any[]>([])

    useEffect(() => {
        findResponses()
    }, [])

    const findResponses = async () => {
        setIsLoading(true)
        const { success, data } = await commonPostAPICall({ uuid: uuid }, "/side_banner/get_responses")
        if (success && success == true) {
            // New shape: { banner, responses }; keep array fallback for older API
            if (data && !Array.isArray(data) && (data.banner || data.responses)) {
                setBanner(data.banner || null)
                setApplicantsData(Array.isArray(data.responses) ? data.responses : [])
            } else {
                setBanner(null)
                setApplicantsData(Array.isArray(data) ? data : [])
            }
        }
        setIsLoading(false)
    }

    const target = banner?.target_type
        ? (TARGET_LABELS[banner.target_type] || banner.target_type)
        : null

    return (
        <div className='container mx-auto max-w-screen flex flex-col gap-4 p-1 sm:p-2'>
            <BackButton title="Banner details" />

            {loading && !banner ? (
                <div className="flex justify-center py-10"><Spinner label="Loading banner…" /></div>
            ) : banner ? (
                <div className="rounded-xl border border-default-200 bg-content1 p-4 flex flex-col sm:flex-row gap-4">
                    {banner.access_image && (
                        <Image
                            src={banner.access_image}
                            alt={banner.campaign_title || "Banner"}
                            className="w-full sm:w-56 h-36 object-cover rounded-lg"
                        />
                    )}
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-foreground truncate">
                            {banner.campaign_title || "Untitled banner"}
                        </h2>
                        <div className="flex flex-wrap gap-2 text-sm text-default-600">
                            <span>Start: {fmt(banner.start_date)}</span>
                            <span className="text-default-300">·</span>
                            <span>End: {fmt(banner.end_date)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {target && <Chip size="sm" variant="flat">{target}</Chip>}
                            {banner.status && (
                                <Chip size="sm" variant="flat" color={banner.status === "accept" ? "success" : "default"}>
                                    {banner.status}
                                </Chip>
                            )}
                            <span className="text-sm text-default-500">
                                {Number(banner.responses || applicants.length || 0)} responses
                            </span>
                        </div>
                    </div>
                </div>
            ) : null}

            <Table
                aria-label="Banner interest responses"
                style={{ height: "auto", minWidth: "100%" }}
                topContent={<p className="text-sm font-medium text-default-700">Interest responses</p>}
            >
                <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Email</TableColumn>
                    <TableColumn>Phone</TableColumn>
                    <TableColumn>Submit At</TableColumn>
                </TableHeader>
                <TableBody
                    emptyContent={<p>No responses yet</p>}
                    loadingContent={<Spinner />}
                    isLoading={loading}
                >
                    {applicants.map((applicant) => (
                        <TableRow key={applicant?.uuid || applicant?.id}>
                            <TableCell>{applicant?.name}</TableCell>
                            <TableCell>{applicant?.email}</TableCell>
                            <TableCell>{applicant?.phone_number}</TableCell>
                            <TableCell>{fmt(applicant?.createdAt)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export default Responses
