import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Button, Card, CardBody, Tab, Tabs, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tooltip, getKeyValue, Spinner, Chip } from "@heroui/react"
import { Calendar, Target, TrendingUp, Plus, Eye } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { RiAdvertisementLine } from 'react-icons/ri'
import { useNavigate, useParams } from 'react-router-dom'
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from '@/lib/theme'

const SideBanner = () => {

   const { commonGetAPICalls } = useApiCallUtils()

  const { find_for } = useParams()
  const navigate = useNavigate()

  const [sideBannerData, setSideBannerData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!["current", "past"].includes(find_for)) {
      navigate("/side_banner/current", { replace: true })
    } else {
      findRecords()
    }
  }, [find_for])

  const findRecords = async () => {
    const soft = sideBannerData.length > 0
    if (!soft) setIsLoading(true)
    const { success, data } = await commonGetAPICalls(`/side_banner/list/${find_for}`)
    if (success && success == true) {
      setSideBannerData(data)
    }
    setIsLoading(false)
  }

  const targets = {
    // "sop": "Statement of Purpose (SOP)",
    // "motivation": "Motivational letter",
    // "cover": "Cover letter",
    "health_ins": "Health Insurance",
    "sim_card": "Internation Sim Card",
    "language": "Language Preparation",
    "career": "Jobs (Career section)",
    // "visa_cons": "Visa and Consultation",
    "visa_consultation": "Visa and Consultation",
  }

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Portal banners</h1>
                  <p className="text-sm text-default-500">
                    Promotions shown to students in your student portal. The home page shows every live banner; service pages show banners targeted to them.
                  </p>
                </div>
              {find_for == "current" && (
                <Button
                  color="primary"
                  className="w-full sm:w-auto"
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={() => navigate("/add_side_banner")}
                >
                  Add banner
                </Button>
              )}
              </div>

        <Tabs aria-label="Banner campaigns" variant="underlined" selectedKey={find_for === "past" ? "past" : "current"}
          onSelectionChange={(k) => navigate(`/side_banner/${k}`)}>
          <Tab key="current" title="Live & upcoming" />
          <Tab key="past" title="Past" />
        </Tabs>

        <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
          <div className="p-3 sm:p-4">
            {isLoading && sideBannerData.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-14">
                <Spinner size="sm" />
                <span className="text-sm text-default-500">Loading…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table
                  className="w-full"
                  aria-label="Side Banner Campaigns table"
                  classNames={{
                    wrapper: "min-h-[222px]",
                    th: "bg-gray-50/80 backdrop-blur-sm",
                  }}
                >
                  <TableHeader>
                    <TableColumn key="campaign_title">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                          <Target className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                        </div>
                        <span className="font-bold text-gray-900">Title</span>
                      </div>
                    </TableColumn>
                    <TableColumn key="start_date">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                          <Calendar className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                        </div>
                        <span className="font-bold text-gray-900">Start Date</span>
                      </div>
                    </TableColumn>
                    <TableColumn key="end_date">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                          <Calendar className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                        </div>
                        <span className="font-bold text-gray-900">End Date</span>
                      </div>
                    </TableColumn>
                    <TableColumn key="responses">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                          <TrendingUp className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                        </div>
                        <span className="font-bold text-gray-900">Responses</span>
                      </div>
                    </TableColumn>
                    <TableColumn key="status">
                      <span className="font-bold text-gray-900">Status</span>
                    </TableColumn>
                    <TableColumn key="target_type">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                          <Target className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                        </div>
                        <span className="font-bold text-gray-900">Target</span>
                      </div>
                    </TableColumn>
                    <TableColumn key="action">
                      <span className="font-bold text-gray-900">Action</span>
                    </TableColumn>
                  </TableHeader>
                  <TableBody 
                    items={sideBannerData} 
                    emptyContent={
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <RiAdvertisementLine className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-semibold text-base">No campaigns found</p>
                        <p className="text-gray-500 text-sm mt-1">
                          {find_for == "current" ? "Create your first banner campaign to get started" : "No past campaigns available"}
                        </p>
                      </div>
                    }
                    loadingContent={
                      <div className="flex items-center justify-center py-8">
                        <Spinner size="lg" style={{ color: BRAND_TEXT }} />
                      </div>
                    }
                    isLoading={isLoading}
                  >
                    {(item: any) => {
                      const index = sideBannerData.findIndex((i: any) => (i?.key || i?.uuid) === (item?.key || item?.uuid));
                      return (
                      <TableRow 
                        key={item?.key || item?.uuid}
                        className="group hover:bg-gray-50/80 transition-colors duration-200 cursor-pointer"
                        onClick={(e) => {
                          navigate(`/responses_side_banner/${getKeyValue(item, "uuid")}`)
                        }}
                      >
                        {(columnKey) => {
                          if (columnKey == "createdAt") {
                            return (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-700">
                                    {new Date(getKeyValue(item, "createdAt")).toLocaleString()}
                                  </span>
                                </div>
                              </TableCell>
                            )
                          } else if (columnKey == "target_type") {
                            return (
                              <TableCell>
                                <Chip
                                  variant="flat"
                                  size="sm"
                                  className="font-semibold"
                                  style={{ 
                                    background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`,
                                    color: BRAND_TEXT
                                  }}
                                >
                                  {targets[getKeyValue(item, "target_type")] || getKeyValue(item, "target_type")}
                                </Chip>
                              </TableCell>
                            )
                          } else if (columnKey == "start_date" || columnKey == "end_date") {
                            return (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-700">
                                    {new Date(getKeyValue(item, columnKey)).toLocaleString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </TableCell>
                            )
                          } else if (columnKey == "status") {
                            const schedule = String(item?.schedule_status || "").toLowerCase()
                            const label = schedule === "live" ? "Live" : schedule === "scheduled" ? "Scheduled" : schedule === "ended" ? "Ended" : (getKeyValue(item, columnKey) || "N/A")
                            const live = schedule === "live"
                            return (
                              <TableCell>
                                <Chip
                                  variant="flat"
                                  size="sm"
                                  color={live ? "success" : schedule === "scheduled" ? "warning" : "default"}
                                  className="font-bold"
                                >
                                  {label}
                                </Chip>
                              </TableCell>
                            )
                          } else if (columnKey == "responses") {
                            return (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-700">
                                    {getKeyValue(item, columnKey) || 0}
                                  </span>
                                </div>
                              </TableCell>
                            )
                          } else if (columnKey == "action") {
                            return (
                              <TableCell>
                                <Tooltip content="View Responses">
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      style={{ color: BRAND_TEXT }}
                                      onPress={() => {
                                        navigate(`/responses_side_banner/${getKeyValue(item, "uuid")}`)
                                      }}
                                     
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                </Tooltip>
                              </TableCell>
                            )
                          } else {
                            return (
                              <TableCell>
                                <span className="text-sm font-medium text-gray-700">
                                  {getKeyValue(item, columnKey)}
                                </span>
                              </TableCell>
                            )
                          }
                        }}
                      </TableRow>
                      );
                    }}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

export default SideBanner