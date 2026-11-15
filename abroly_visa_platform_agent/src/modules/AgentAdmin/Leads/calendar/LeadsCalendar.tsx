import { useState } from 'react';
import Calendar from 'rsuite/Calendar';
import 'rsuite/Calendar/styles/index.css';
import { Checkbox, CheckboxGroup, Spinner, useDisclosure } from "@heroui/react";
import { AlertCircle, Calendar as CalendarIcon, Clock } from 'lucide-react';
import CommonConfirmation from '@/components/CommonConfirmation';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { useQuery } from '@tanstack/react-query';
import fetchQueriesHook from '@/hooks/fetchQueriesHook';
import LeadCalendarPopup from './LeadCalendarPopup';

const EVENT_TYPES = [
  { key: "reminder", label: "Reminder", color: "warning" as const },
  { key: "followup", label: "Follow-up", color: "primary" as const },
  { key: "task", label: "Task", color: "success" as const },
];

const typeStyles: Record<string, string> = {
  reminder: "bg-warning-100 text-warning-800 border-warning-200",
  followup: "bg-primary-100 text-primary-800 border-primary-200",
  task: "bg-success-100 text-success-800 border-success-200",
};

/** Lead follow-ups / reminders / tasks on a month calendar. */
const LeadsCalendar = () => {
  const { commonPostAPICall } = useApiCallUtils();
  const queryClient = fetchQueriesHook();
  const today = new Date();

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today);
  const [selected, setSelected] = useState(["reminder", "followup", "task"]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [deleteUUID, setDeleteUUId] = useState("");
  const { isOpen: isDeleteCnfOpen, onOpenChange: onDeleteCnfOpenChange } = useDisclosure();

  const { data: calEvents, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["calEvents", selectedMonth, selected],
    queryFn: async () => {
      const { data, success, message } = await commonPostAPICall(
        { date: selectedDate, event_type: selected },
        "/leads/lead_calendar/event_list"
      );
      if (success) return data;
      throw new Error(message);
    },
  });

  const deleteEvent = async () => {
    const { success } = await commonPostAPICall({ uuid: deleteUUID }, "/calendar/agent/delete");
    if (success) {
      onDeleteCnfOpenChange();
      setDeleteUUId("");
      queryClient(["calEvents"]);
    }
  };

  const initialLoad = isLoading && !calEvents;

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-default-500" /> Lead calendar
          </h1>
          <p className="text-sm text-default-500">Reminders, follow-ups and tasks for visa leads</p>
        </div>
        {isFetching && !initialLoad ? <Spinner size="sm" /> : null}
      </div>

      <CheckboxGroup
        aria-label="Event types"
        orientation="horizontal"
        className="flex flex-wrap gap-3"
        color="primary"
        value={selected}
        onValueChange={setSelected}
      >
        {EVENT_TYPES.map((t) => (
          <Checkbox key={t.key} value={t.key}>{t.label}</Checkbox>
        ))}
      </CheckboxGroup>

      {isError ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-8 text-center text-sm text-danger-700">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          {(error as Error)?.message || "Failed to load calendar events"}
        </div>
      ) : initialLoad ? (
        <div className="flex items-center justify-center rounded-xl border border-default-200 bg-content1 py-16">
          <Spinner size="sm" label="Loading calendar…" />
        </div>
      ) : (
        <div className="rounded-xl border border-default-200 bg-content1 p-3 sm:p-4 overflow-x-auto">
          <Calendar
            bordered
            value={selectedDate}
            renderCell={(date) => {
              const filterRecords = (calEvents || []).filter((item: any) => {
                const itemDate = new Date(item?.date);
                itemDate.setHours(0, 0, 0, 0);
                const currentDate = new Date(date);
                currentDate.setHours(0, 0, 0, 0);
                return itemDate.toISOString() === currentDate.toISOString();
              });
              if (!filterRecords.length) return null;
              return (
                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                  {filterRecords.map((event: any) => (
                    <button
                      key={event?.id}
                      type="button"
                      className={`text-left text-[11px] px-1.5 py-1 rounded border truncate ${typeStyles[event.event_type] || "bg-default-100 text-default-700 border-default-200"}`}
                      onClick={() => {
                        setIsCalendarOpen(true);
                        setSelectedLead(event?.lead_id);
                      }}
                      title={event?.description}
                    >
                      <span className="font-medium truncate block">{event?.description || "Untitled"}</span>
                      {event?.time ? (
                        <span className="opacity-70 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(event?.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              );
            }}
            onChange={setSelectedDate}
            onMonthChange={setSelectedMonth}
          />
        </div>
      )}

      <CommonConfirmation
        isOpen={isDeleteCnfOpen}
        onOpenChange={onDeleteCnfOpenChange}
        title="Are you sure you want to delete this event?"
        handleSubmit={deleteEvent}
        nagativeTitle="No"
        positiveTitle="Yes"
      />

      <LeadCalendarPopup
        isOpen={isCalendarOpen}
        setIsOpen={(open: boolean) => { if (!open) setIsCalendarOpen(false); }}
        lead_id={selectedLead}
      />
    </div>
  );
};

export default LeadsCalendar;
