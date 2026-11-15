import { LeadList } from '../common_list/LeadList'

const LeadVisaAccepted = () => {
  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Approved visas</h1>
        <p className="text-sm text-default-500">Cases marked visa completed</p>
      </div>
      <LeadList status="visa_completed" canChangeStatus={false} />
    </div>
  )
}

export default LeadVisaAccepted
