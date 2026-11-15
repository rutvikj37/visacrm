import React from 'react'
import { Avatar, Button, Checkbox, CheckboxGroup, Input, Radio, RadioGroup, Select, SelectItem, Textarea } from "@heroui/react";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useApiCallUtils from '@/hooks/useApiCallUtils';

const AssignEvent = () => {

    const {commonPostAPICall} = useApiCallUtils()
    const { selectedDate } = useParams()
    useEffect(() => {
        findAgents()
    }, [])
    const [agentsListing, setAgentListing] = useState([])
    const eventsDropDownItems = [
        "event",
        "reminder",
        "followup",
        "task"
    ]

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [event_type, setEventType] = useState("event")
    const [assign_type, setAssginType] = useState("sub_agent")
    const [start_time, setStartTime] = useState("")
    const [end_time, setEndTime] = useState("")
    const [assgin_to, setAssignTo] = useState(null)

    const navigate = useNavigate()

    const addEventApiCall = async () => {
        const date = new Date(JSON.parse(selectedDate))
        date.setHours(0, 0, 0, 0)
        const { success } = await commonPostAPICall({
            title,
            description,
            event_type,
            start_time,
            end_time,
            date: date,
            assgin_to: assign_type == "sub_agent" ? assgin_to : undefined
        }, "/calendar/agent/add", true)

        if (success && success == true) {
            setTitle("")
            setDescription("")
            setEventType("event")
            setStartTime("")
            setEndTime("")
            navigate(-1)
        }
    }

    // find all sub agents 
    const findAgents = async () => {

        const { data, success, total } = await commonPostAPICall({}, "/sub_agent/all_list")
        if (success && success == true) {
            setAgentListing(data)
        }
    }
    return (
        <div className='container mx-auto'>
            <div className="p-6 overflow-y-scroll">
                <h2 className="text-2xl font-bold mb-2">Add Event For {new Date(JSON.parse(selectedDate)).toDateString()}</h2>

                <section className='grid grid-cols-1 md:grid-cols-2 gap-2'>
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
                    <section className='col-span-2 sm:col-span-1'>
                        <RadioGroup
                            label="Assign Event To"
                            value={assign_type}
                            onValueChange={(e) => {
                                setAssginType(e)
                            }}
                            orientation='horizontal'
                        >
                            {[{
                                key: "self",
                                value: "Self Assign"
                            }, {
                                key: "sub_agent",
                                value: "Assign to Sub Agent"
                            }].map((item) => <Radio value={item.key}>{item.value}</Radio>)}
                        </RadioGroup>
                    </section>
                    {assign_type == "sub_agent" &&

                        <div className="relative col-span-2">
                            <Select
                                label="Assign to"
                                placeholder="Select a sub-agent"
                                value={assgin_to}
                                onChange={(e) => {
                                    setAssignTo(e.target.value)
                                }}
                                renderValue={() =>
                                    assgin_to && (
                                        <div className="flex items-center gap-2 py-2">
                                            {/* <Avatar size="sm" src={agentsListing.filter((item: any) => item.uuid == assgin_to)[0]?.avatar} /> */}
                                            <div>
                                                <span>{agentsListing.filter((item: any) => item.uuid == assgin_to)[0]?.username}</span>
                                                <span className="text-sm text-gray-500">({agentsListing.filter((item: any) => item.uuid == assgin_to)[0]?.designation})</span>
                                            </div>
                                        </div>
                                    )
                                }
                            >
                                {agentsListing.map(user => (
                                    <SelectItem key={user?.uuid} textValue={user?.username}>
                                        <div className="flex gap-2 items-center">
                                            <Avatar size="sm" src={user?.access_profile} />
                                            <div className="flex flex-col">
                                                <span className="text-sm">{user?.username}</span>
                                                <span className="text-xs text-gray-400">{user?.designation}</span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                    }
                    <Input
                        placeholder="Title"
                        label="Title"
                              labelPlacement="outside-left"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <section className='flex flex-col sm:flex-row gap-2 col-span-2 sm:col-span-1'>
                        <Input
                            value={start_time}
                            onChange={(e) => {
                                setStartTime(e.target.value)
                            }}
                                  labelPlacement="outside-left"
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
                                  labelPlacement="outside-left"
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
        </div>
    )
}

export default AssignEvent