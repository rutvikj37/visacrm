import { LeadList } from '../common_list/LeadList'

const LeadVisaRejected = () => {
  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Rejected visas</h1>
        <p className="text-sm text-default-500">Cases marked visa rejected</p>
      </div>
      <LeadList status="visa_rejected" canChangeStatus={false} />
    </div>
  )
}

export default LeadVisaRejected
