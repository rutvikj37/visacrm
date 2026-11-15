import { useEffect, useState } from 'react';

import Calendar from 'rsuite/Calendar';

// (Optional) Import component styles. If you are using Less, import the `index.less` file. 
import 'rsuite/Calendar/styles/index.css';
import { Avatar, Button, Checkbox, CheckboxGroup, Input, Radio, RadioGroup, Select, SelectItem, Textarea, useDisclosure } from "@heroui/react";
import { useNavigate } from 'react-router-dom';
import { Delete, Icon, Trash, User } from 'lucide-react';
import CommonConfirmation from '@/components/CommonConfirmation';
import useApiCallUtils from '@/hooks/useApiCallUtils';


const AgentCalendar = () => {
    const {commonPostAPICall} = useApiCallUtils()

    const today = new Date()

    const [selectedDate, setSelectedDate] = useState(today)
    const [selectedMonth, setSelectedMonth] = useState(today)
    const [selected, setSelected] = useState([
        "event",
        "reminder",
        "followup",
        "task"
    ]);

    // use effect to fetch
    useEffect(() => {
        fetchEvents()
    }, [selectedMonth, selected])

    // calendar fetch
    const [calEvents, setCalEvents] = useState([])
    const fetchEvents = async () => {
        const { data, success } = await commonPostAPICall({ date: selectedDate, event_type: selected }, "/calendar/agent/list")
        if (success && success == true) {
            setCalEvents(data)
        }
    }

    const eventTypeColors = {
        event: "bg-blue-50 ",
        reminder: "bg-yellow-50 ",
        followup: "bg-green-50 ",
        task: "bg-red-50",
    };

    const navigate = useNavigate()

    const [deleteUUID, setDeleteUUId] = useState("")
    const { isOpen: isDeleteCnfOpen, onOpenChange: onDeleteCnfOpenChange } = useDisclosure();

    const deleteEvent = async () => {
        const { success } = await commonPostAPICall({ uuid: deleteUUID }, "/calendar/agent/delete")
        if (success && success == true) {
            onDeleteCnfOpenChange()
            setDeleteUUId("")
            fetchEvents()
        }
    }

    return (
        <div>
            <section className='flex flex-col items-start gap-2'>
                <section className='mt-5 mx-5'>
                    <CheckboxGroup
                        orientation='horizontal'
                        className='space-x-2'
                        color="primary"
                        value={selected}
                        onValueChange={setSelected}
                    >
                        <Checkbox className={`ml-2 rounded-lg ${eventTypeColors["event"]}`} value="event">Event</Checkbox>
                        <Checkbox className={`ml-2 rounded-lg ${eventTypeColors["reminder"]}`} value="reminder">Reminder</Checkbox>
                        <Checkbox className={`ml-2 rounded-lg ${eventTypeColors["followup"]}`} value="followup">Followup</Checkbox>
                        <Checkbox className={`ml-2 rounded-lg ${eventTypeColors["task"]}`} value="task">Task</Checkbox>
                    </CheckboxGroup>
                </section>
                <section className='w-full flex items-center justify-end'>
                    <Button
                        onPress={() => {
                            navigate(`/calendar/add/${JSON.stringify(selectedDate)}`)
                        }}
                        variant='flat'
                        color='warning'
                    > + Add Event</Button>
                </section>

                <Calendar
                    bordered
                    compact
                    // monthDropdownProps={}
                    value={selectedDate}
                    renderCell={(e) => {
                        const filterRecords = calEvents?.filter((item) => {
                            const itemDate = new Date(item?.date)
                            const thisDate = new Date(e)
                            if (itemDate.toISOString() == thisDate.toISOString()) {
                                return item
                            }
                        })
                        if (filterRecords?.length) {
                            return (
                                filterRecords.sort((a, b) => b.start_time - a.start_time).map((el) => <p className="my-1 text-[10px] text-wrap font-semibold truncate">
                                    {el?.title}
                                </p>)
                            );
                        } else {
                            return null
                        }
                    }}
                    onChange={(e) => {
                        setSelectedDate(e)
                    }}
                    onMonthChange={(e) => {
                        setSelectedMonth(e)
                    }}
                    className=''
                />
            </section>

            {/* render selected date's all events */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 container mx-auto p-2">
                {[...calEvents?.filter((item) => {
                    const itemStartTime = new Date(selectedDate);
                    const itemEndTime = new Date(selectedDate);
                    itemStartTime.setHours(0, 0, 0, 0); // Start of the day
                    itemEndTime.setHours(23, 59, 59, 999); // End of the day

                    // Parse the event's date and strip time components
                    const thisDate = new Date(item.date);

                    // Return true if thisDate falls within the start and end time range
                    return thisDate.getTime() >= itemStartTime.getTime() && thisDate.getTime() <= itemEndTime.getTime();
                })].sort((a, b) => b?.start_time - a?.start_time).map((el) => {
                    return (
                        <div
                            key={el?.uuid}
                            className={`flex items-start p-3 rounded-lg shadow-lg ${eventTypeColors[el.event_type] || "bg-gray-200 text-gray-800"}`}
                        >
                            <div className="flex items-center mr-3">
                                {/* <Checkbox
                                    type="checkbox"
                                    className="cursor-pointer"
                                    isSelected={el?.is_done == 1}
                                /> */}

                            </div>
                            {/* Event Content */}
                            <div className="flex flex-col rounded-lg w-full">
                                <div className="flex flex-row items-center justify-start gap-2 mb-3">
                                    <Avatar
                                        src={el?.to_assign?.access_profile}
                                        showFallback
                                        className="mr-2" // Add margin to the right
                                    />
                                    <div className='flex-grow'>
                                        <p className="text-xs text-gray-600 font-medium">
                                            {el?.to_assign?.username}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {el?.to_assign?.designation}
                                        </p>
                                    </div>

                                    <div>
                                        <Button
                                            onPress={() => {
                                                setDeleteUUId(el?.uuid)
                                                onDeleteCnfOpenChange()
                                            }}
                                            variant='flat' color='danger' isIconOnly size='sm' ><Trash className='p-1' /></Button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">
                                    {el?.start_time} - {el?.end_time}
                                </p>
                                <p className='text-tiny '>{el?.is_done == 1 && "Mark as done by sub agent"}</p>
                                <p className="text-sm font-bold mb-1 text-gray-800">{el?.title}</p>
                                <p className="text-xs text-gray-700">{el?.description}</p>

                            </div>
                        </div>
                    );
                })}
            </div>

            <CommonConfirmation
                isOpen={isDeleteCnfOpen}
                onOpenChange={onDeleteCnfOpenChange}
                title={"Are you sure want to delete ?"}
                handleSubmit={() => {
                    deleteEvent()
                }}
                nagativeTitle={"No"}
                positiveTitle={"Yes"}
            />

        </div>
    );
};

export default AgentCalendar;
