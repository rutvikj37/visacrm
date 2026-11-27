import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar, Button, Chip, Spinner } from '@heroui/react'
import { ArrowLeft, Mail, Phone, Award, Calendar, Shield, CheckCircle2, XCircle, Users } from 'lucide-react'
import useApiCallUtils from '@/hooks/useApiCallUtils'

const Meta = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="text-xs text-default-500 mb-0.5">{label}</p>
    <div className="text-sm font-medium text-foreground break-words">{children}</div>
  </div>
)

const SubAgentDetails = () => {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const { commonPostAPICall } = useApiCallUtils()
  const [isLoading, setIsLoading] = useState(true)
  const [details, setDetails] = useState<any>(null)
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (uuid) findAgentDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid])

  const findAgentDetails = async () => {
    setIsLoading(true)
    try {
      const { data, success } = await commonPostAPICall({ uuid }, "/sub_agent/details")
      if (success && success == true) {
        if (data == null) setIsNotFound(true)
        else setDetails(data)
      }
    } catch (error) {
      console.error('Error fetching agent details:', error)
      setIsNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  const fmt = (v?: string) =>
    v
      ? new Date(v).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          isIconOnly
          variant="flat"
          size="sm"
          aria-label="Back"
          onPress={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Team member</h1>
          <p className="text-sm text-default-500">Contact, role and status for this team member</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center gap-2 py-14">
          <Spinner size="sm" />
          <span className="text-sm text-default-500">Loading…</span>
        </div>
      ) : isNotFound ? (
        <div className="rounded-xl border border-dashed border-default-200 bg-content1 text-center py-12 px-4">
          <Users className="w-8 h-8 text-default-400 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Team member not found</p>
          <p className="text-sm text-default-500 mt-1 mb-4">This person may have been removed.</p>
          <Button color="primary" className="w-full sm:w-auto" onPress={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      ) : details ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-5 flex flex-col items-center text-center gap-3">
            <Avatar src={details.access_profile} alt={details.username} className="w-20 h-20" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{details.username}</h2>
              {details.designation ? (
                <p className="text-sm text-default-500 truncate">{details.designation}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Chip
                size="sm"
                variant="flat"
                color={details.is_verified ? 'success' : 'default'}
                startContent={details.is_verified ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              >
                {details.is_verified ? 'Verified' : 'Not verified'}
              </Chip>
              <Chip size="sm" variant="flat" color={details.status === 'active' ? 'success' : 'default'}>
                {details.status === 'active' ? 'Active' : 'Inactive'}
              </Chip>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Meta label="Email">
                  <a href={`mailto:${details.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                    <Mail className="w-3.5 h-3.5 text-default-400 shrink-0" />
                    {details.email || '—'}
                  </a>
                </Meta>
                <Meta label="Phone">
                  <a href={`tel:${details.phone_number}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                    <Phone className="w-3.5 h-3.5 text-default-400 shrink-0" />
                    {details.phone_number || '—'}
                  </a>
                </Meta>
                <Meta label="Designation">
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-default-400 shrink-0" />
                    {details.designation || '—'}
                  </span>
                </Meta>
                <Meta label="Role">
                  <span className="inline-flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-default-400 shrink-0" />
                    {details.role || '—'}
                  </span>
                </Meta>
              </div>
            </div>

            <div className="rounded-xl border border-default-200 bg-content1 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Activity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Meta label="Joined">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-default-400 shrink-0" />
                    {fmt(details.createdAt)}
                  </span>
                </Meta>
                {details.updatedAt ? (
                  <Meta label="Last updated">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-default-400 shrink-0" />
                      {fmt(details.updatedAt)}
                    </span>
                  </Meta>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SubAgentDetails
