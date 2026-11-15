import { LeadList } from '../common_list/LeadList'

/** Visa cases currently in progress. */
const LeadsVisa = () => {
  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Visa cases in progress</h1>
        <p className="text-sm text-default-500">Students whose visa process is under way</p>
      </div>
      <LeadList status="visa_progress" />
    </div>
  )
}

export default LeadsVisa
