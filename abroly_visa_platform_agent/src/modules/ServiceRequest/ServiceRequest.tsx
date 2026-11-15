import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Input, Select, SelectItem, getKeyValue, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip } from "@heroui/react"
import { Search, Check, X, MoreVertical, FileText, Calendar, Globe, Mail, Phone, User, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from "react-router-dom"
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT } from '@/lib/theme'

const ServiceRequest = () => {
  const { type } = useParams()
  const { commonPostAPICall } = useApiCallUtils()

  const [serviceRequestData, setServiceRequestData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [updateStatusModal, setUpdateStatusModal] = useState({ isOpen: false, id: null, currentStatus: '' })
  const [newStatus, setNewStatus] = useState('')
  const limit = 10

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch data when dependencies change
  useEffect(() => {
    const findRecords = async () => {
      const soft = serviceRequestData.length > 0
      if (!soft) setIsLoading(true)
      try {
        const { success, data } = await commonPostAPICall({
          page,
          limit,
          search: debouncedSearch || undefined,
          status: status || undefined,
          type_of_response:type || undefined
        }, "/service_form_requests/list")
        
        if (success && success == true && data) {
          setServiceRequestData(data.data || data)
          setTotalPages(data.totalPages || Math.ceil((data.total || 0) / limit))
        }
      } catch (error) {
        console.error('Error fetching service request data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    findRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, status, type])

  const handleUpdateStatus = async () => {
    if (!updateStatusModal.id || !newStatus) return
    
    setUpdatingId(updateStatusModal.id)
    try {
      const { success } = await commonPostAPICall({
        id: updateStatusModal.id,
        status: newStatus
      }, "/service_form_requests/update_status")
      
      if (success) {
        setUpdateStatusModal({ isOpen: false, id: null, currentStatus: '' })
        setNewStatus('')
        // Refresh data
        const { success: refreshSuccess, data } = await commonPostAPICall({
          page,
          limit,
          search: debouncedSearch || undefined,
          status: status || undefined,
          type_of_response: type || undefined
        }, "/service_form_requests/list")
        
        if (refreshSuccess && refreshSuccess == true && data) {
          setServiceRequestData(data.data || data)
          setTotalPages(data.totalPages || Math.ceil((data.total || 0) / limit))
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  const formatStatus = (status: string) => {
    if (!status) return 'N/A'
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  }

  // Determine columns based on type
  const isHealthType = type === 'health'
  const isDataType = type === 'data'
  
  const getTitle = () => {
    if (isHealthType) return 'Health Insurance Requests'
    if (isDataType) return 'Data Processing Requests'
    return 'Service Requests'
  }

  const getSearchPlaceholder = () => {
    if (isHealthType) return 'Search by name, email, phone, country, start date...'
    if (isDataType) return 'Search by name, email, phone, country, coverage type, data requirements...'
    return 'Search by name, email, phone, country...'
  }

  // Define columns based on type
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "country_of_study_or_travel", label: "Country" },
    ...(isHealthType ? [{ key: "start_date_of_insurance", label: "Start Date" }] : []),
    ...(isDataType ? [{ key: "coverage_type", label: "Coverage Type" }] : []),
    ...(isDataType ? [{ key: "data_requirements", label: "Requirements" }] : []),
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Created At" },
    { key: "action", label: "Action" }
  ]

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{getTitle()}</h1>
          <p className="text-sm text-default-500">Incoming requests from the student portal</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end max-w-4xl">
          <Input
            className="w-full sm:col-span-2"
            startContent={<Search className="h-4 w-4 text-default-400" />}
            placeholder={getSearchPlaceholder()}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            isClearable
            onClear={() => setSearch("")}
          />
          <Select
            className="w-full"
            aria-label="Filter by status"
            placeholder="All statuses"
            selectedKeys={status ? [status] : []}
            onSelectionChange={(keys) => {
              const selectedValue = Array.from(keys)[0] as string
              setStatus(selectedValue || '')
            }}
          >
            <SelectItem key="">All</SelectItem>
            <SelectItem key="pending">Pending</SelectItem>
            <SelectItem key="rejected">Rejected</SelectItem>
            <SelectItem key="completed">Completed</SelectItem>
          </Select>
        </div>

        <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
          <div className="p-3 sm:p-4">
            {isLoading && serviceRequestData.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-14">
                <Spinner size="sm" />
                <span className="text-sm text-default-500">Loading…</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table
                    className="w-full"
                    aria-label="Service Request list"
                    classNames={{
                      wrapper: "min-h-[222px]",
                      th: "bg-gray-50/80 backdrop-blur-sm",
                    }}
                  >
                    <TableHeader>
                      {columns.map((column) => (
                        <TableColumn key={column.key}>
                          <div className="flex items-center gap-2">
                            {column.key === "name" && (
                              <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                <User className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                              </div>
                            )}
                            {column.key === "email" && (
                              <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                <Mail className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                              </div>
                            )}
                            {column.key === "phone" && (
                              <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                <Phone className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                              </div>
                            )}
                            {column.key === "country_of_study_or_travel" && (
                              <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                <Globe className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                              </div>
                            )}
                            {column.key === "createdAt" && (
                              <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                                <Calendar className='h-4 w-4' style={{ color: BRAND_TEXT }} />
                              </div>
                            )}
                            <span className="font-bold text-gray-900">{column.label}</span>
                          </div>
                        </TableColumn>
                      ))}
                    </TableHeader>
                    <TableBody 
                      items={serviceRequestData} 
                      emptyContent={
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-600 font-semibold text-base">No service requests found</p>
                          <p className="text-gray-500 text-sm mt-1">New service requests will appear here</p>
                        </div>
                      } 
                      loadingContent={
                        <div className="flex items-center justify-center py-8">
                          <Spinner size="lg" style={{ color: BRAND_TEXT }} />
                        </div>
                      } 
                      isLoading={isLoading && serviceRequestData.length === 0}
                    >
                      {(item: any) => (
                        <TableRow 
                          key={item?.uuid || item?.id}
                          className="group hover:bg-gray-50/80 transition-colors duration-200"
                        >
                          {(columnKey) => {
                            if (columnKey == "createdAt") {
                              return (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">
                                      {new Date(getKeyValue(item, "createdAt")).toLocaleString('en-US', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </TableCell>
                              )
                            } else if (columnKey == "status") {
                              const statusValue = getKeyValue(item, "status")
                              const statusLower = statusValue?.toLowerCase()
                              return (
                                <TableCell>
                                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider border shadow-sm ${
                                    statusLower === 'pending' ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-300' :
                                    statusLower === 'approved' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-300' :
                                    statusLower === 'rejected' ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-300' :
                                    statusLower === 'completed' ? `bg-gradient-to-r from-[${PRIMARY_COLOR}15] to-[${PRIMARY_COLOR_LIGHT}15] text-[${PRIMARY_COLOR}] border-[${PRIMARY_COLOR}30]` :
                                    'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-300'
                                  }`} style={statusLower === 'completed' ? {
                                    background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`,
                                    color: BRAND_TEXT,
                                    borderColor: `${PRIMARY_COLOR}30`
                                  } : {}}>
                                    {formatStatus(statusValue)}
                                  </span>
                                </TableCell>
                              )
                            } else if (columnKey == "action") {
                              const currentStatus = getKeyValue(item, "status")
                              const isPending = currentStatus?.toLowerCase() === 'pending'
                              return (
                                <TableCell>
                                  <Dropdown>
                                    <DropdownTrigger>
                                      <Button 
                                        isIconOnly 
                                        size='sm' 
                                        variant='light'
                                        isDisabled={!isPending || updatingId === item?.id}
                                        className="hover:bg-gray-100 transition-colors"
                                      >
                                        <MoreVertical className='h-4 w-4' />
                                      </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu aria-label="Status actions">
                                      <DropdownItem 
                                        key="completed"
                                        startContent={<CheckCircle2 className='h-4 w-4' style={{ color: BRAND_TEXT }} />}
                                        onPress={() => {
                                          setUpdateStatusModal({ 
                                            isOpen: true, 
                                            id: item?.id, 
                                            currentStatus 
                                          })
                                          setNewStatus('completed')
                                        }}
                                      >
                                        Mark as Completed
                                      </DropdownItem>
                                      <DropdownItem 
                                        key="rejected"
                                        startContent={<XCircle className='h-4 w-4 text-red-500' />}
                                        className="text-danger"
                                        color="danger"
                                        onPress={() => {
                                          setUpdateStatusModal({ 
                                            isOpen: true, 
                                            id: item?.id, 
                                            currentStatus 
                                          })
                                          setNewStatus('rejected')
                                        }}
                                      >
                                        Reject
                                      </DropdownItem>
                                    </DropdownMenu>
                                  </Dropdown>
                                </TableCell>
                              )
                            } else if (columnKey == "data_requirements") {
                              const requirements = getKeyValue(item, "data_requirements")
                              return (
                                <TableCell>
                                  <div className='max-w-xs group-hover:max-w-md transition-all duration-200'>
                                    <div className="p-2 bg-gray-50/50 rounded-lg border border-gray-200/50 group-hover:border-primary/30 transition-colors">
                                      <p className='text-sm text-gray-700 line-clamp-2 group-hover:line-clamp-none transition-all' title={requirements}>
                                        {requirements}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              )
                            } else if (columnKey == "start_date_of_insurance") {
                              const date = getKeyValue(item, "start_date_of_insurance")
                              return (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">
                                      {date ? new Date(date).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                </TableCell>
                              )
                            } else if (columnKey == "email") {
                              return (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <a 
                                      href={`mailto:${getKeyValue(item, columnKey)}`}
                                      className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                                    >
                                      {getKeyValue(item, columnKey)}
                                    </a>
                                  </div>
                                </TableCell>
                              )
                            } else if (columnKey == "phone") {
                              return (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <a 
                                      href={`tel:${getKeyValue(item, columnKey)}`}
                                      className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                                    >
                                      {getKeyValue(item, columnKey)}
                                    </a>
                                  </div>
                                </TableCell>
                              )
                            } else if (columnKey == "name") {
                              return (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">
                                      {getKeyValue(item, columnKey)}
                                    </span>
                                  </div>
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
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-4 border-t border-default-200">
                    <p className="text-sm text-default-500">Page {page} of {totalPages}</p>
                    <Pagination
                      total={totalPages}
                      page={page}
                      onChange={setPage}
                      showControls
                      size="sm"
                      classNames={{ cursor: "bg-primary text-primary-foreground" }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      <Modal 
        isOpen={updateStatusModal.isOpen} 
        onClose={() => setUpdateStatusModal({ isOpen: false, id: null, currentStatus: '' })}
        classNames={{
          base: "border-0",
          backdrop: "bg-black/50",
          header: "border-b border-default-200",
          body: "py-6",
          footer: "border-t border-gray-200"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ 
                    background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`
                  }}>
                    <AlertCircle className="w-5 h-5" style={{ color: BRAND_TEXT }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Confirm Status Update</h3>
                    <p className="text-xs text-gray-500 font-normal">This action cannot be undone</p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-2">
                  <p className='text-sm text-gray-600'>
                    Are you sure you want to change the status from{' '}
                    <span className='font-semibold text-gray-900'>{formatStatus(updateStatusModal.currentStatus)}</span>{' '}
                    to{' '}
                    <span className='font-semibold' style={{ color: BRAND_TEXT }}>
                      {formatStatus(newStatus)}
                    </span>?
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button 
                  variant="light" 
                  onPress={onClose}
                  isDisabled={updatingId !== null}
                  className="border border-gray-300 hover:border-gray-400"
                >
                  Cancel
                </Button>
                <Button 
                  color="primary"
                  onPress={handleUpdateStatus}
                  isLoading={updatingId !== null}
                >
                  {updatingId ? 'Updating...' : 'Update status'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

export default ServiceRequest
