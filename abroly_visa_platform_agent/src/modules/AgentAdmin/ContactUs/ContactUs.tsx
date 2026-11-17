import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, getKeyValue } from "@heroui/react"
import { Mail, Phone, MessageCircle } from 'lucide-react'
import React, { useEffect, useState, useCallback } from 'react'

const ContactUs = () => {
  const { commonGetAPICalls } = useApiCallUtils()
  const [contactUsData, setContactUsData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const limit = 10

  const findRecords = useCallback(async () => {
    setIsLoading((loading) => (contactUsData.length === 0 ? true : loading))
    try {
      const { success, data, total: totalCount } = await commonGetAPICalls(`/contact_us/list?page=${page}&limit=${limit}`)
      if (success && success == true && data) {
        setContactUsData(data)
        setTotal(totalCount)
        setTotalPages(Math.ceil(totalCount / limit))
      }
    } catch (error) {
      console.error('Error fetching contact us data:', error)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    findRecords()
  }, [findRecords])

  const fmt = (v: string) =>
    new Date(v).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Contact form messages</h1>
          <p className="text-sm text-default-500">Messages from your website contact form. Each one also becomes a lead in your Lead Inbox (source "Portal") - work on them there.</p>
        </div>
        {total > 0 && <p className="text-sm text-default-500"><span className="font-semibold text-foreground">{total}</span> total</p>}
      </div>

      <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
        <div className="p-3 sm:p-4">
          {isLoading && contactUsData.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-14">
              <Spinner size="sm" />
              <span className="text-sm text-default-500">Loading…</span>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {contactUsData.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageCircle className="w-8 h-8 text-default-400 mx-auto mb-3" />
                    <p className="font-semibold text-foreground">No contact requests yet</p>
                    <p className="text-sm text-default-500 mt-1">New inquiries will show up here</p>
                  </div>
                ) : (
                  contactUsData.map((item: any) => (
                    <div key={item?.uuid || item?.id} className="rounded-xl border border-default-200 p-3 space-y-2">
                      <p className="font-semibold text-foreground truncate">{getKeyValue(item, "name")}</p>
                      <div className="text-sm space-y-1">
                        <a href={`mailto:${getKeyValue(item, "email")}`} className="flex items-center gap-1.5 text-default-600 truncate">
                          <Mail className="w-3.5 h-3.5 shrink-0" />{getKeyValue(item, "email")}
                        </a>
                        <a href={`tel:${getKeyValue(item, "number")}`} className="flex items-center gap-1.5 text-default-600">
                          <Phone className="w-3.5 h-3.5 shrink-0" />{getKeyValue(item, "number")}
                        </a>
                      </div>
                      <p className="text-sm text-default-700 whitespace-pre-wrap break-words">{getKeyValue(item, "message")}</p>
                      <p className="text-xs text-default-400">{fmt(getKeyValue(item, "createdAt"))}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table
                  aria-label="Contact requests"
                  removeWrapper
                  classNames={{
                    table: "min-w-[720px]",
                    th: "bg-default-100/80 text-default-600 text-xs font-semibold uppercase tracking-wide",
                    td: "py-3 align-top",
                  }}
                >
                  <TableHeader>
                    <TableColumn key="name">Name</TableColumn>
                    <TableColumn key="email">Email</TableColumn>
                    <TableColumn key="number">Phone</TableColumn>
                    <TableColumn key="message">Message</TableColumn>
                    <TableColumn key="createdAt">Received</TableColumn>
                  </TableHeader>
                  <TableBody
                    items={contactUsData}
                    emptyContent={
                      <div className="text-center py-10">
                        <MessageCircle className="w-8 h-8 text-default-400 mx-auto mb-3" />
                        <p className="font-semibold text-foreground">No contact requests yet</p>
                        <p className="text-sm text-default-500 mt-1">New inquiries will show up here</p>
                      </div>
                    }
                    isLoading={isLoading}
                    loadingContent={<Spinner size="sm" />}
                  >
                    {(item: any) => (
                      <TableRow key={item?.uuid || item?.id} className="border-b border-default-100 last:border-b-0">
                        {(columnKey) => {
                          if (columnKey === "createdAt") {
                            return <TableCell><span className="text-sm text-default-600 whitespace-nowrap">{fmt(getKeyValue(item, "createdAt"))}</span></TableCell>
                          }
                          if (columnKey === "message") {
                            return (
                              <TableCell>
                                <p className="text-sm text-default-700 max-w-sm line-clamp-3" title={getKeyValue(item, "message")}>
                                  {getKeyValue(item, "message")}
                                </p>
                              </TableCell>
                            )
                          }
                          if (columnKey === "email") {
                            return (
                              <TableCell>
                                <a href={`mailto:${getKeyValue(item, columnKey)}`} className="text-sm text-foreground hover:text-primary">
                                  {getKeyValue(item, columnKey)}
                                </a>
                              </TableCell>
                            )
                          }
                          if (columnKey === "number") {
                            return (
                              <TableCell>
                                <a href={`tel:${getKeyValue(item, columnKey)}`} className="text-sm text-foreground hover:text-primary">
                                  {getKeyValue(item, columnKey)}
                                </a>
                              </TableCell>
                            )
                          }
                          return <TableCell><span className="text-sm font-medium">{getKeyValue(item, columnKey)}</span></TableCell>
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
    </div>
  )
}

export default ContactUs
