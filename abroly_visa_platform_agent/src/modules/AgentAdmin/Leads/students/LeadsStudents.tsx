import { Button } from "@heroui/react";
import { LeadList } from "../common_list/LeadList";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

const LeadsStudents = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Students</h1>
          <p className="text-sm text-default-500">Accepted students ready for the next stage</p>
        </div>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<Plus className="w-4 h-4" />}
          onPress={() => navigate("/crm/leads")}
        >
          Add student
        </Button>
      </div>
      <LeadList status="accepted" />
    </div>
  );
};

export default LeadsStudents;
