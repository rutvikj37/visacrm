import useApiCallUtils from '@/hooks/useApiCallUtils'
import { useQuery } from '@tanstack/react-query'
import React from 'react'

const ChangeLeadStatusComponet = ({ id }) => {
  const { commonGetAPICalls } = useApiCallUtils()
  // fetch lead 

  const fetchLeadDetails = async () => {
    const { data, success, message } = await commonGetAPICalls("/leads/agency_lead_details/" + id)
    if (success && success == true) {
      return data
    }
    throw new Error(message)
  }

  const { data: leadDetails } = useQuery({
    queryKey: ['lead_status_details', id],
    queryFn: fetchLeadDetails
  })

  return (
    <div>{id}{JSON.stringify(leadDetails)}</div>
  )
}

export default ChangeLeadStatusComponet