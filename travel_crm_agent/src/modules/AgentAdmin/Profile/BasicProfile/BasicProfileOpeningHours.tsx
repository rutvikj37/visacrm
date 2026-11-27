import React, { useEffect, useState } from "react";
import { Input, InputGroup, Form, SelectPicker, Notification, useToaster } from "rsuite";
import { Clock } from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import { commonPostAPICall } from "@/utils/ApiCallUtils";
const BasicProfileOpeningHours = () => {
    const [isLoading, setIsLoading] = useState(false)

    const [operatingHoursWeekdays, setOperatingHoursWeekdays] = useState("");
    const [operatingHoursWeekends, setOperatingHoursWeekends] = useState("");
    const [operatingHoursTimeZone, setOperatingHoursTimeZone] = useState("");

    const toaster = useToaster();

    // Example timezone options, you can add more or fetch them dynamically if needed
    const timeZoneOptions = [
        { label: "IST", value: "IST" },
        { label: "UTC", value: "UTC" },
        { label: "GMT", value: "GMT" },
        { label: "EST (Eastern Standard Time)", value: "EST" },
        { label: "CST (Central Standard Time)", value: "CST" },
        { label: "PST (Pacific Standard Time)", value: "PST" },
    ];

    useEffect(() => {
        getBasicContact()
    }, [])

    const getBasicContact = async (opts?: { soft?: boolean }) => {
        if (!opts?.soft) setIsLoading(true)
        const { data, success } = await commonPostAPICall({}, "agent_profile/get_operating_hours")
        if (success && success == true) {

            if (data) {
                setOperatingHoursWeekdays(data?.operatingHoursWeekdays ?? "")
                setOperatingHoursWeekends(data?.operatingHoursWeekends ?? "")
                setOperatingHoursTimeZone(data?.operatingHoursTimeZone ?? "")
            }
        }
        setIsLoading(false)
    }
    const handleSubmit = async () => {

        const { success } = await commonPostAPICall({
            operatingHoursWeekdays,
            operatingHoursWeekends,
            operatingHoursTimeZone,
        }, "agent_profile/update_basic_profile", true)
        if (success && success == true) {
            getBasicContact({ soft: true })
        }
    };

    return (
        <div className="container mx-auto p-6 ">
            {isLoading == true ? <div className='flex items-center justify-center my-5'><Spinner /></div> :
                <Form layout="vertical">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Operating Hours for Weekdays */}
                        <InputGroup inside>
                            <InputGroup.Addon>
                                <Clock className="text-blue-500" />
                            </InputGroup.Addon>
                            <Input
                                placeholder="Weekday Hours (e.g., 9:00 AM - 5:00 PM)"
                                value={operatingHoursWeekdays}
                                onChange={(value) => setOperatingHoursWeekdays(value)}
                            />
                        </InputGroup>

                        {/* Operating Hours for Weekends */}
                        <InputGroup inside>
                            <InputGroup.Addon>
                                <Clock className="text-green-500" />
                            </InputGroup.Addon>
                            <Input
                                placeholder="Weekend Hours (e.g., 10:00 AM - 4:00 PM)"
                                value={operatingHoursWeekends}
                                onChange={(value) => setOperatingHoursWeekends(value)}
                            />
                        </InputGroup>

                        {/* Time Zone Selection */}
                        <InputGroup inside>
                            <SelectPicker
                                placeholder="Select Time Zone"
                                data={timeZoneOptions}
                                value={operatingHoursTimeZone}
                                onChange={setOperatingHoursTimeZone}
                                style={{ width: "100%" }}
                            />
                        </InputGroup>
                    </div>

                    <Button variant="shadow" color="primary" className="mt-6" onPress={handleSubmit} >
                        Update
                    </Button>
                </Form>
            }
        </div>
    );

}

export default BasicProfileOpeningHours