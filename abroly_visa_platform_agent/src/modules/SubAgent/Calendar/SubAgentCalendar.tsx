import { useEffect, useState } from 'react';

import Calendar from 'rsuite/Calendar';

// (Optional) Import component styles. If you are using Less, import the `index.less` file. 
import 'rsuite/Calendar/styles/index.css';
import { Button, Checkbox, CheckboxGroup, Input, Radio, RadioGroup, Select, SelectItem, Textarea, useDisclosure } from "@heroui/react";

import { DrawerContent, Drawer } from '@/components/ui/drawer';
import { Trash } from 'lucide-react';
import CommonConfirmation from '@/components/CommonConfirmation';
import useApiCallUtils from '@/hooks/useApiCallUtils';


const SubAgentCalendar = () => {

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
        const { data, success } = await commonPostAPICall({ date: selectedDate, event_type: selected }, "/calendar/sub_agent/list")
        if (success && success == true) {
            setCalEvents(data)
        }
    }

    // add events 
    const [isAddOpen, setIsAddOpen] = useState(false)

    const eventsDropDownItems = [
        "event",
        "reminder",
        "followup",
        "task"
    ]

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [event_type, setEventType] = useState("event")
    const [start_time, setStartTime] = useState("")
    const [end_time, setEndTime] = useState("")

    const addEventApiCall = async () => {
        const date = new Date(selectedDate)
        date.setHours(0, 0, 0, 0)
        const { success } = await commonPostAPICall({
            title,
            description,
            event_type,
            start_time,
            end_time,
            date: date
        }, "/calendar/sub_agent/add")

        if (success && success == true) {
            fetchEvents()
            setIsAddOpen(false)
            setTitle("")
            setDescription("")
            setEventType("event")
            setStartTime("")
            setEndTime("")
        }
    }

    const eventTypeColors = {
        event: "bg-blue-50 ",
        reminder: "bg-yellow-50 ",
        followup: "bg-green-50 ",
        task: "bg-red-50",
    };

    const markDone = async (uuid: string, status: string) => {
        const { success } = await commonPostAPICall({
            uuid,
            status
        }, "/calendar/sub_agent/action", true)

        if (success && success == true) {
            fetchEvents()
        }
    }

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
                            setIsAddOpen(true)
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
                            className={`flex items-start p-3 rounded-lg ${eventTypeColors[el.event_type] || "bg-gray-200 text-gray-800"}`}
                        >
                            <div className="">
                                <Checkbox
                                    type="checkbox"
                                    className="cursor-pointer self-center"
                                    isSelected={el?.is_done == 1 ? true : false}
                                    onValueChange={(e) => {
                                        markDone(el?.uuid, e == true ? "done" : "undone")
                                    }}
                                />
                                
                            </div>
                            <div>
                            
                            </div>
                            {/* Event Content */}
                            <div className="flex-1">
                                <p className="text-xs text-gray-600 font-medium">
                                    {el?.start_time} - {el?.end_time}
                                </p>
                                <p className="text-sm font-bold mb-1">{el?.title}</p>
                                <p className="text-xs text-gray-700">{el?.description}</p>
                            </div>
                            {el?.assgin_to == el.assign_by && <div >
                                    <Button
                                        onPress={() => {
                                            setDeleteUUId(el?.uuid)
                                            onDeleteCnfOpenChange()
                                        }}
                                        variant='light' color='danger' isIconOnly size='sm' ><Trash className='p-1' /></Button>
                                </div>}

                            {/* Event Status Checkbox */}

                        </div>
                    );
                })}
            </div>

            <Drawer open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DrawerContent >
                    <div className="p-6 overflow-y-scroll">
                        <h2 className="text-2xl font-bold mb-2">Add Event For {new Date(selectedDate).toDateString()}</h2>

                        <section className='grid grid-cols-1 md:grid-cols-2 gap-2'>

                            <Input
                                placeholder="Title"
                                label="Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />

                            <section className='flex flex-col sm:flex-row gap-2 col-span-2 sm:col-span-1'>
                                <Input
                                    value={start_time}
                                    onChange={(e) => {
                                        setStartTime(e.target.value)
                                    }}
                                    type='time'
                                    label="Start Time"
                                    step="60"
                                    inputMode='text'
                                />
                                <Input
                                    value={end_time}
                                    onChange={(e) => {
                                        setEndTime(e.target.value)
                                    }}
                                    type='time'
                                    label="End Time"
                                    step="60"
                                    inputMode='text'
                                />
                            </section>

                            <Textarea
                                label='description'
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value)
                                }}
                                className='col-span-2'
                            />
                            <RadioGroup
                                label="Select Event Type"
                                value={event_type}
                                onValueChange={(e) => {
                                    setEventType(e)
                                }}
                                orientation='horizontal'
                            >
                                {eventsDropDownItems.map((item) => <Radio value={item}>{item}</Radio>)}
                            </RadioGroup>
                            <section></section>

                        </section>

                        <Button
                            color='primary'
                            className='my-2'
                            onPress={addEventApiCall}
                        >
                            Add Event
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>

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

export default SubAgentCalendar;
