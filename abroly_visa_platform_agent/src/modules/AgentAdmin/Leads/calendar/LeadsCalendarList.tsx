import { useState } from "react";
import fetchQueriesHook from "@/hooks/fetchQueriesHook";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Yup from "yup";
import { Formik } from "formik";
import { Button, Chip, Input, Spinner, Tab, Tabs, Textarea } from "@heroui/react";
import { Calendar, Clock, Plus, User } from "lucide-react";

import { appPath } from "@/utils/appBase";
const eventTypes = ["reminder", "followup", "task"];

const TYPE_COLOR: Record<string, "warning" | "primary" | "success" | "default"> = {
  reminder: "warning",
  followup: "primary",
  task: "success",
};

const validationSchema = Yup.object({
  description: Yup.string().required("Description is required"),
  event_type: Yup.string().oneOf(eventTypes, "Invalid event type").required("Required"),
  date: Yup.date().required("Date is required"),
  time: Yup.string().required("Time is required"),
});

/** Schedule popup for one lead: list events + add follow-up / reminder / task. */
const LeadsCalendarList = ({ lead_id }: { lead_id: number | string | null }) => {
  const { commonPostAPICall, commonGetAPICalls } = useApiCallUtils();
  const queryClient = fetchQueriesHook();
  const [activeTab, setActiveTab] = useState<"events" | "add">("events");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["lead_calender_events", lead_id],
    queryFn: async () => {
      const { data, success, message } = await commonGetAPICalls(`/leads/lead_calendar/event_list/${lead_id}`);
      if (success) return data;
      throw new Error(message);
    },
    enabled: lead_id != null,
  });

  const addEventMutation = useMutation({
    mutationFn: async ({ description, event_type, date, time }: any) => {
      const { data, success, message } = await commonPostAPICall(
        { description, lead_id, event_type, date, time },
        "/leads/lead_calendar/add_event"
      );
      if (success) return data;
      throw new Error(message);
    },
    onSuccess: () => {
      queryClient(["lead_calender_events", lead_id]);
      setActiveTab("events");
    },
  });

  const student = data?.student;
  const events = data?.events || [];
  const initialLoad = isLoading && !data;

  return (
    <div className="flex flex-col gap-4">
      {/* Student summary */}
      <div className="rounded-xl border border-default-200 bg-content1 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary grid place-items-center font-semibold">
            {(student?.username || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{student?.username || "Student"}</p>
            <p className="text-xs text-default-500 truncate">
              {[student?.email, student?.phone || `${student?.country_code || ""}${student?.phone_number || ""}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            size="sm"
            variant="flat"
            startContent={<User className="w-3.5 h-3.5" />}
            onPress={() => window.open(appPath(`/leads/student_profile/${lead_id}`), "_blank")}
          >
            Profile
          </Button>
          <Button
            size="sm"
            color="primary"
            variant="flat"
            onPress={() => window.open(appPath(`/leads/progress/${lead_id}`), "_blank")}
          >
            Open case
          </Button>
        </div>
      </div>

      <Tabs
        size="sm"
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as "events" | "add")}
        aria-label="Schedule tabs"
      >
        <Tab key="events" title={`Events${events.length ? ` (${events.length})` : ""}`} />
        <Tab key="add" title="Add event" />
      </Tabs>

      {isError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-3 text-sm text-danger-700">
          {(error as Error)?.message || "Could not load events"}
        </div>
      )}

      {activeTab === "events" && (
        <div>
          {initialLoad ? (
            <div className="flex justify-center py-10"><Spinner size="sm" /></div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-default-300 px-4 py-10 text-center">
              <p className="text-sm font-medium text-default-700">No events yet</p>
              <p className="text-xs text-default-500 mt-1 mb-3">Schedule a follow-up, reminder, or task</p>
              <Button size="sm" color="primary" variant="flat" startContent={<Plus className="w-4 h-4" />} onPress={() => setActiveTab("add")}>
                Add event
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
              {events.map((event: any, index: number) => {
                const eventDate = new Date(event.date);
                const isToday = new Date().toDateString() === eventDate.toDateString();
                const isPast = eventDate < new Date() && !isToday;
                return (
                  <li
                    key={event.id || index}
                    className={`rounded-lg border border-default-200 px-3 py-3 ${isPast ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Chip size="sm" variant="flat" color={TYPE_COLOR[event.event_type] || "default"} className="capitalize">
                        {event.event_type}
                      </Chip>
                      {isToday && <Chip size="sm" color="primary" variant="flat">Today</Chip>}
                      {isPast && <Chip size="sm" variant="flat">Past</Chip>}
                    </div>
                    <p className="text-sm font-medium text-foreground">{event.description}</p>
                    <p className="text-xs text-default-500 mt-1 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {eventDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {event.time}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === "add" && (
        <Formik
          initialValues={{
            description: "",
            event_type: "reminder",
            date: new Date(),
            time: "",
          }}
          validationSchema={validationSchema}
          onSubmit={(values, { resetForm }) => {
            addEventMutation.mutate({
              description: values.description,
              event_type: values.event_type,
              date: values.date,
              time: values.time,
            });
            resetForm();
          }}
        >
          {({ values, setFieldValue, errors, touched, handleSubmit }) => (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">Description</label>
                <Textarea
                  aria-label="Description"
                  minRows={3}
                  placeholder="What should you follow up on?"
                  value={values.description}
                  onValueChange={(v) => setFieldValue("description", v)}
                />
                {errors.description && touched.description && (
                  <p className="text-danger text-xs mt-1">{String(errors.description)}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={values.event_type === type ? "solid" : "flat"}
                      color={values.event_type === type ? "primary" : "default"}
                      className="capitalize"
                      onPress={() => setFieldValue("event_type", type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">Date</label>
                  <Input
                    type="date"
                    aria-label="Date"
                    value={new Date(values.date).toISOString().split("T")[0]}
                    onChange={(e) => setFieldValue("date", e.target.value)}
                  />
                  {errors.date && touched.date && <p className="text-danger text-xs mt-1">Required</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">Time</label>
                  <Input
                    type="time"
                    aria-label="Time"
                    value={values.time}
                    onChange={(e) => setFieldValue("time", e.target.value)}
                  />
                  {errors.time && touched.time && <p className="text-danger text-xs mt-1">{String(errors.time)}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-default-100">
                <Button type="button" variant="light" onPress={() => setActiveTab("events")}>Cancel</Button>
                <Button type="submit" color="primary" isLoading={addEventMutation.isPending} startContent={<Plus className="w-4 h-4" />}>
                  Save event
                </Button>
              </div>
            </form>
          )}
        </Formik>
      )}
    </div>
  );
};

export default LeadsCalendarList;
