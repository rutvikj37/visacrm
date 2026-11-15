import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Button, Spinner } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { Input } from 'rsuite'

const BasicOfficeAddress = () => {

    const { commonPostAPICall } = useApiCallUtils()

    const [isLoading, setIsLoading] = useState(false)

    const [officeStreetAddress, setofficeStreetAddress] = useState("")
    const [officeCity, setofficeCity] = useState("")
    const [officeStateProvince, setofficeStateProvince] = useState("")
    const [officeCountry, setofficeCountry] = useState("")
    const [officePostalCode, setofficePostalCode] = useState("")


    // get office address
    useEffect(() => {
        getBasicOfficeAddress()
    }, [])

    const getBasicOfficeAddress = async () => {
        setIsLoading(true)
        const { data, success } = await commonPostAPICall({}, "agent_profile/get_address")
        if (success && success == true) {

            if (data) {
                setofficeStreetAddress(data?.officeStreetAddress)
                setofficeCity(data?.officeCity)
                setofficeStateProvince(data?.officeStateProvince)
                setofficeCountry(data?.officeCountry)
                setofficePostalCode(data?.officePostalCode)
            }
        }
        setIsLoading(false)
    }

    const updateOfficeAddress = async () => {

        const { success } = await commonPostAPICall({
            officeStreetAddress,
            officeCity,
            officeStateProvince,
            officeCountry,
            officePostalCode,
        }, "agent_profile/update_basic_profile", true)
        if (success && success == true) {
            getBasicOfficeAddress()
        }

    }

    return (
        <div>
            {isLoading == true ? <div className='flex items-center justify-center my-5'><Spinner /></div> :
                <div className="p-4 w-fit space-y-2">
                    <h3 className="text-lg font-semibold">Office Address</h3>
                    <p className="text-sm text-gray-600">Please provide What is the primary office address of your agency</p>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className='sm:col-span-4'>
                            <label>Street Address</label>
                            <Input
                                style={{ width: '100%', marginBottom: '1rem' }}
                                onChange={setofficeStreetAddress}
                                value={officeStreetAddress}
                            /></div>
                        <div>
                            <label>City</label>
                            <Input
                                style={{ width: '100%', marginBottom: '1rem' }}
                                onChange={setofficeCity}
                                value={officeCity}
                            /></div>
                        <div>
                            <label>State/Province</label>
                            <Input
                                style={{ width: '100%', marginBottom: '1rem' }}
                                onChange={setofficeStateProvince}
                                value={officeStateProvince}
                            /></div>
                        <div>
                            <label>Country</label>
                            <Input
                                style={{ width: '100%', marginBottom: '1rem' }}
                                onChange={setofficeCountry}
                                value={officeCountry}
                            /></div>
                        <div>
                            <label>Postal Code</label>
                            <Input
                                style={{ width: '100%', marginBottom: '1rem' }}
                                onChange={setofficePostalCode}
                                value={officePostalCode}
                            /></div>
                    </div>

                    <Button variant='shadow' color="primary" onPress={updateOfficeAddress}>Update</Button>

                </div>
            }
        </div>
    )
}

export default BasicOfficeAddress