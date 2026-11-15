import { LeadList } from '../common_list/LeadList'

const LeadsApplications = () => {
  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Applications</h1>
        <p className="text-sm text-default-500">Cases in application progress</p>
      </div>
      <LeadList status="assign_to_agent,application_progress" />
    </div>
  )
}

export default LeadsApplications
