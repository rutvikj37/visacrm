import { commonGetAPICalls } from "@/utils/ApiCallUtils";
import { Button, Spinner } from "@nextui-org/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  School,
  User,
  ExternalLink,
  ArrowRight,
  FileCheck,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { countries } from "country-data";
import moment from "moment";
import { PRIMARY_COLOR } from "@/lib/theme";
import { useState } from "react";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import CommonConfirmation from "@/components/CommonConfirmation";

const AcceptedApplications = () => {
  const queryClient = useQueryClient();
  const fetchSuggestions = async () => {
    const { data, success } = await commonGetAPICalls(
      `/leads/user_accepted_leads`
    );
    if (success) return data;
    throw new Error("Failed to fetch suggestions.");
  };

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["accepted_applications"],
    queryFn: fetchSuggestions,
  });

  const navigate = useNavigate();
  const initialLoad = isLoading && !data;

  const isWithdrawn = (status: string) => {
    return status === "withdrawn" || status === "withdrawn_by_student";
  };

  const isVisaCompleted = (status: string) => {
    return status === "visa_completed";
  };

  const isVisaRejected = (status: string) => {
    return status === "visa_rejected";
  };

  const [withdrawConfirm, setWithdrawConfirm] = useState({
    id: "",
    isOpen: false,
  });

  const withdrawApplication = async () => {
    const { success, data, message } = await commonGetAPICalls(
      `/leads/lead_progress/student/widthdraw_application/${withdrawConfirm.id}`
    );
    if (success && success === true) {
      SuccessToast(message);
      setWithdrawConfirm({
        id: "",
        isOpen: false,
      });
      queryClient.invalidateQueries({ queryKey: ["accepted_applications"] });
      return data;
    }
    ErrorToast(message);
    throw new Error(message);
  };

  const withdrawApplicationMutation = useMutation({
    mutationFn: withdrawApplication,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            Accepted Applications
          </h1>
          <p className="text-sm text-default-500">
            Track and manage your accepted visa consultation applications
            {data && data.length > 0 ? ` · ${data.length} total` : ""}
          </p>
        </div>
        {isFetching && !initialLoad && (
          <Spinner size="sm" style={{ color: PRIMARY_COLOR }} />
        )}
      </div>

      {initialLoad ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" style={{ color: PRIMARY_COLOR }} />
            <p className="text-sm text-default-500">Loading your applications...</p>
          </div>
        </div>
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          {data.map((item: any) => {
            const details = JSON.parse(item.selected_suggestion);
            const withdrawn = isWithdrawn(item?.status);
            const visaCompleted = isVisaCompleted(item?.status);
            const visaRejected = isVisaRejected(item?.status);

            return (
              <div
                key={item.id}
                className={`rounded-xl border border-default-200 bg-content1 p-4 sm:p-5 ${
                  withdrawn || visaRejected
                    ? "opacity-80 border-danger-200"
                    : visaCompleted
                    ? "border-success-200"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-default-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <School size={16} className="text-primary shrink-0" />
                      <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">
                        {details.university}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-default-500">
                      <User size={14} />
                      <span>Agent: {item.lead_of.username}</span>
                    </div>
                  </div>
                  {withdrawn && (
                    <Badge variant="destructive" className="shrink-0">
                      Withdrawn
                    </Badge>
                  )}
                  {visaCompleted && (
                    <Badge className="bg-success text-white shrink-0">
                      Visa Completed
                    </Badge>
                  )}
                  {visaRejected && (
                    <Badge variant="destructive" className="shrink-0">
                      Visa Rejected
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-[11px] text-default-500">Location</p>
                    <p className="text-sm text-foreground truncate">
                      {details.state},{" "}
                      {countries[details?.country]?.name || details?.country}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-default-500">Program Level</p>
                    <p className="text-sm text-foreground truncate">
                      {details.programLevel}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-default-500">Intake</p>
                    <p className="text-sm text-foreground">
                      {details.intakeMonth} {details.intakeYear}
                    </p>
                  </div>
                  {details.tuitionFees && (
                    <div className="min-w-0">
                      <p className="text-[11px] text-default-500">Tuition Fees</p>
                      <p className="text-sm text-foreground">{details.tuitionFees}</p>
                    </div>
                  )}
                  {details.fieldOfStudy && (
                    <div className="min-w-0 sm:col-span-2">
                      <p className="text-[11px] text-default-500">Field of Study</p>
                      <p className="text-sm text-foreground">{details.fieldOfStudy}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-default-200">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      onPress={() => {
                        window.open(`/agent_profile/${item?.id}`, "_blank");
                      }}
                      size="sm"
                      variant="bordered"
                      className="w-full sm:w-auto"
                      startContent={<User size={16} />}
                      endContent={<ExternalLink size={14} />}
                    >
                      View Agent Profile
                    </Button>
                    <Button
                      onPress={() => {
                        navigate("/accepted_applications/" + item.id);
                      }}
                      size="sm"
                      variant="solid"
                      className="w-full sm:w-auto text-white"
                      style={{ backgroundColor: PRIMARY_COLOR }}
                      endContent={<ArrowRight size={16} />}
                      isDisabled={withdrawn || visaCompleted || visaRejected}
                    >
                      View Progress
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    className="w-full sm:w-auto"
                    onPress={() => {
                      setWithdrawConfirm({
                        id: item.id,
                        isOpen: true,
                      });
                    }}
                    startContent={<XCircle size={16} />}
                    isDisabled={visaCompleted || visaRejected}
                  >
                    Withdraw Application
                  </Button>
                </div>
                <p className="text-xs text-default-500 text-right mt-2">
                  Last Updated:{" "}
                  {moment(item?.updatedAt).format("DD/MM/YYYY HH:mm")}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-default-200 bg-content1 p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-default-400" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground mb-1">
            No Accepted Applications
          </CardTitle>
          <CardDescription className="text-default-500 max-w-md mx-auto">
            You don't have any accepted applications yet. Once you accept a
            suggestion from an agent, it will appear here.
          </CardDescription>
        </div>
      )}

      <CommonConfirmation
        isOpen={withdrawConfirm.isOpen}
        onOpenChange={() =>
          setWithdrawConfirm({
            id: "",
            isOpen: false,
          })
        }
        title="Are you sure you want to withdraw this application? Once withdrawn, the application will be permanently deleted and will no longer be accessible or appear in your listing."
        handleSubmit={() => withdrawApplicationMutation.mutate()}
        nagativeTitle="No"
        positiveTitle="Yes"
      />
    </div>
  );
};

export default AcceptedApplications;
