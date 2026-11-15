import { LeadList } from '../common_list/LeadList'

const LeadsWithdrawn = () => {
  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Withdrawn</h1>
        <p className="text-sm text-default-500">Cases withdrawn by agency or student</p>
      </div>
      <LeadList status="withdrawn,withdrawn_by_student" />
    </div>
  )
}

export default LeadsWithdrawn
