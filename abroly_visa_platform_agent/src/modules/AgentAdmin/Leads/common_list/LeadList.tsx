import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select as HSelect,
  SelectItem as HSelectItem,
  Spinner,
} from "@heroui/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { debounce } from "lodash";
import ReactFlagsSelect from "react-flags-select";
import {
  Ban,
  Calendar,
  CheckCircle2,
  Clock4,
  Search,
  TrendingUp,
  User,
  X,
  XCircle,
} from "lucide-react";
import LeadCalendarPopup from "../calendar/LeadCalendarPopup";
import { countries } from "country-data";
import CommonConfirmation from "@/components/CommonConfirmation";
import fetchQueriesHook from "@/hooks/fetchQueriesHook";

import { appPath } from "@/utils/appBase";
const IntakeYears = Array.from(
  { length: 13 },
  (_, i) => new Date().getFullYear() + 2 - i
);

const STATUS_CHIP: Record<string, "success" | "warning" | "danger" | "primary" | "secondary" | "default"> = {
  accepted: "success",
  assign_to_agent: "primary",
  application_progress: "secondary",
  visa_progress: "warning",
  visa_completed: "success",
  visa_rejected: "danger",
  withdrawn: "default",
  withdrawn_by_student: "default",
};

const parseApp = (lead: any) => {
  try {
    return JSON.parse(lead?.selected_suggestion || "{}");
  } catch {
    return {};
  }
};

const Meta = ({ label, value }: { label: string; value?: string }) => (
  <div className="min-w-0">
    <p className="text-[11px] text-default-500">{label}</p>
    <p className="text-sm text-foreground truncate">{value || "—"}</p>
  </div>
);

/** Shared visa-case list used by /leads/visa and sibling status pages. */
export const LeadList = ({ status, canChangeStatus = true }: { status: string; canChangeStatus?: boolean }) => {
  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
  const fetchQueryClient = fetchQueriesHook();
  const { role_type } = useSelector((state: any) => state.login);

  const [page, setPage] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedIntakeYear, setSelectedIntakeYear] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const updateSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400),
    []
  );

  useEffect(() => {
    updateSearch(search);
  }, [search, updateSearch]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const getIncomingLeads = async () => {
    const q = new URLSearchParams({
      page: String(page),
      status,
      selected_intake_year: selectedIntakeYear,
      selected_country: selectedCountry,
      search: debouncedSearch,
    });
    const { success, data } = await commonGetAPICalls(`/leads/incoming_leads/students?${q.toString()}`);
    if (success) return data;
    throw new Error("Failed to fetch leads");
  };

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["incomingLeads_students", page, status, selectedIntakeYear, selectedCountry, debouncedSearch],
    queryFn: getIncomingLeads,
  });

  const { data: subAgents } = useQuery({
    queryKey: ["sub_agents_list"],
    queryFn: async () => {
      const { success, data } = await commonGetAPICalls(`/sub_agent/sub_agents_drop_down`);
      if (success) return data;
      throw new Error("Failed to fetch agents");
    },
    enabled: role_type === "agent",
    staleTime: 100 * 60 * 1000,
  });

  const assingAgentMutation = useMutation({
    mutationFn: async ({ lead_id, agent_id }: { lead_id: number; agent_id: any }) => {
      const { success, data, message } = await commonPostAPICall({ id: lead_id, agent_id }, `/leads/assign_lead`, true);
      if (success) return data;
      throw new Error(message);
    },
    onSuccess: () => fetchQueryClient(["incomingLeads_students"]),
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ lead_id, status: next }: { lead_id: number; status: string }) => {
      const { success, data, message } = await commonPostAPICall({ id: lead_id, status: next }, `/leads/change_status`, true);
      if (success) return data;
      throw new Error(message);
    },
    onSuccess: () => fetchQueryClient(["incomingLeads_students"]),
  });

  const [confirm, setConfirm] = useState({ isOpen: false, id: null as null | number, title: "", status: "" });
  const [calendarLeadId, setCalendarLeadId] = useState<number | null>(null);

  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedIntakeYear("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const hasFilters = Boolean(search || selectedCountry || selectedIntakeYear);
  const leads = data?.leads || [];
  const pagination = data?.pagination;
  const initialLoad = isLoading && !data;

  return (
    <div className="flex flex-col gap-4 max-w-full">
      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <Input
            aria-label="Search"
            placeholder="Search name, email, phone…"
            value={search}
            onValueChange={setSearch}
            isClearable
            onClear={() => setSearch("")}
            startContent={<Search className="w-4 h-4 text-default-400" />}
          />
          <HSelect
            aria-label="Intake year"
            placeholder="Intake year"
            selectedKeys={selectedIntakeYear ? [selectedIntakeYear] : []}
            onChange={(e) => {
              setSelectedIntakeYear(e.target.value);
              setPage(1);
            }}
          >
            {IntakeYears.map((year) => (
              <HSelectItem key={String(year)}>{String(year)}</HSelectItem>
            ))}
          </HSelect>
          <div className="[&_.ReactFlagsSelect-module_flagsSelect__2pfa2]:w-full">
            <ReactFlagsSelect
              selected={selectedCountry}
              searchable
              onSelect={(code) => {
                setSelectedCountry(code);
                setPage(1);
              }}
              className="!w-full"
            />
          </div>
          <div className="flex gap-2">
            {hasFilters && (
              <Button variant="flat" size="md" className="flex-1" startContent={<X className="w-4 h-4" />} onPress={clearFilters}>
                Clear
              </Button>
            )}
            {isFetching && !initialLoad ? <Spinner size="sm" className="self-center" /> : null}
          </div>
        </div>
      </div>

      {/* List */}
      {isError ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-8 text-center text-sm text-danger-700">
          {(error as Error)?.message || "Could not load cases"}
        </div>
      ) : initialLoad ? (
        <div className="flex items-center justify-center rounded-xl border border-default-200 bg-content1 py-16">
          <Spinner size="sm" label="Loading cases…" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-300 bg-content1 px-4 py-12 text-center">
          <p className="text-sm font-medium text-default-700">No cases found</p>
          <p className="text-xs text-default-500 mt-1">
            {hasFilters ? "Try clearing filters" : "Nothing in this status yet"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leads.map((lead: any) => {
            const app = parseApp(lead);
            const location = [app?.state, countries[app?.country]?.name].filter(Boolean).join(", ");
            return (
              <Card key={lead.id} shadow="sm" className="border border-default-200">
                <CardBody className="gap-4 p-4">
                  <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground truncate">
                              {lead?.user_of?.username || `Case #${lead?.id}`}
                            </h3>
                            <Chip size="sm" variant="flat" color={STATUS_CHIP[lead.status] || "default"} className="capitalize">
                              {String(lead.status || "").replace(/_/g, " ")}
                            </Chip>
                            {lead?.lead_type ? (
                              <Chip size="sm" variant="bordered" className="capitalize">{lead.lead_type}</Chip>
                            ) : null}
                          </div>
                          <p className="text-xs text-default-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {lead.createdAt
                              ? new Date(lead.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
                              : "—"}
                            <span className="text-default-300">·</span>
                            #{lead?.id}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-default-50 px-3 py-2.5">
                        <Meta label="Email" value={lead?.user_of?.email} />
                        <Meta label="Phone" value={lead?.user_of?.phone_number} />
                        <div className="flex items-end">
                          <Button
                            size="sm"
                            variant="light"
                            className="px-0 h-7 min-w-0"
                            startContent={<User className="w-3.5 h-3.5" />}
                            onPress={() => window.open(appPath(`/leads/student_profile/${lead?.id}`), "_blank")}
                          >
                            Profile
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <Meta label="Program" value={app?.course_program_name || app?.programLevel} />
                        <Meta label="Field" value={app?.fieldOfStudy} />
                        <Meta label="Intake" value={app?.intake} />
                        <Meta label="Location" value={location || undefined} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="lg:w-52 shrink-0 flex flex-col gap-2 lg:border-l lg:border-default-100 lg:pl-4">
                      {role_type === "agent" && subAgents?.length > 0 && (
                        <HSelect
                          aria-label="Assign agent"
                          size="sm"
                          placeholder="Assign agent"
                          selectedKeys={lead.assign_id ? [String(lead.assign_id)] : []}
                          onChange={(e) => {
                            if (e.target.value) {
                              assingAgentMutation.mutate({ lead_id: lead.id, agent_id: e.target.value });
                            }
                          }}
                        >
                          {subAgents.map((agent: any) => (
                            <HSelectItem key={String(agent.id)} textValue={`${agent.username} (${agent.designation})`}>
                              {agent.username} ({agent.designation})
                            </HSelectItem>
                          ))}
                        </HSelect>
                      )}

                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<TrendingUp className="w-4 h-4" />}
                        onPress={() => window.open(appPath(`/leads/progress/${lead?.id}`), "_blank")}
                      >
                        Open case
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Clock4 className="w-4 h-4" />}
                        onPress={() => setCalendarLeadId(lead?.id)}
                      >
                        Schedule
                      </Button>

                      {canChangeStatus ? (
                        <>
                          <div className="h-px bg-default-200 my-1" />
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            startContent={<CheckCircle2 className="w-4 h-4" />}
                            onPress={() =>
                              setConfirm({ isOpen: true, id: lead.id, title: "mark visa completed", status: "visa_completed" })
                            }
                          >
                            Visa approved
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            startContent={<XCircle className="w-4 h-4" />}
                            onPress={() =>
                              setConfirm({ isOpen: true, id: lead.id, title: "mark visa rejected", status: "visa_rejected" })
                            }
                          >
                            Visa rejected
                          </Button>
                          {!["withdrawn", "withdrawn_by_student"].includes(lead.status) && (
                            <Button
                              size="sm"
                              variant="light"
                              startContent={<Ban className="w-4 h-4" />}
                              onPress={() =>
                                setConfirm({ isOpen: true, id: lead.id, title: "withdraw", status: "withdrawn" })
                              }
                            >
                              Withdraw
                            </Button>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-default-400">Status locked on this list</p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}

          {pagination?.totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination
                page={page}
                total={pagination.totalPages}
                onChange={setPage}
                showControls
                size="sm"
              />
            </div>
          )}
        </div>
      )}

      <LeadCalendarPopup
        isOpen={calendarLeadId != null}
        setIsOpen={(open: boolean) => {
          if (!open) setCalendarLeadId(null);
        }}
        lead_id={calendarLeadId}
      />

      <CommonConfirmation
        isOpen={confirm.isOpen}
        onOpenChange={() => setConfirm({ isOpen: false, id: null, title: "", status: "" })}
        title={`Are you sure you want to ${confirm.title} this case? This cannot be undone.`}
        handleSubmit={() => {
          if (confirm.id != null) {
            changeStatusMutation.mutate({ lead_id: confirm.id, status: confirm.status });
          }
          setConfirm({ isOpen: false, id: null, title: "", status: "" });
        }}
        nagativeTitle="No"
        positiveTitle="Yes"
      />
    </div>
  );
};
