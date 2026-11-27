import { Button, Spinner } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { Input } from 'rsuite'
import { usePlacesWidget } from 'react-google-autocomplete'
import useApiCallUtils from '@/hooks/useApiCallUtils'

// set VITE_GOOGLE_PLACES_API_KEY in .env (restrict the key to your domains in Google Cloud)
const placesApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ""

/** Native input + Places widget so the ref is always an HTMLInputElement. */
const AreaPlacesInput = ({
    defaultValue,
    onPlaceSelected,
    onChange,
}: {
    defaultValue: string
    onPlaceSelected: (place: any) => void
    onChange: (value: string) => void
}) => {
    const { ref } = usePlacesWidget({
        apiKey: placesApiKey,
        onPlaceSelected,
        options: { types: ["(regions)"] },
    })

    return (
        <input
            ref={ref as React.LegacyRef<HTMLInputElement>}
            defaultValue={defaultValue}
            onChange={(e) => onChange(e.target.value)}
            className="border border-gray-300 rounded-md p-2 w-full"
            style={{ width: "100%", marginBottom: "1rem" }}
            placeholder="Search area"
        />
    )
}

const BasicOfficeAddress = () => {

    const { commonPostAPICall } = useApiCallUtils()

    const [isLoading, setIsLoading] = useState(false)

    const [officeStreetAddress, setofficeStreetAddress] = useState("")
    const [officeCity, setofficeCity] = useState("")
    const [officeStateProvince, setofficeStateProvince] = useState("")
    const [officeCountry, setofficeCountry] = useState("")
    const [officePostalCode, setofficePostalCode] = useState("")
    const [area, setArea] = useState("")
    const [latitude, setLatitude] = useState(null)
    const [longitude, setLongitude] = useState(null)

    useEffect(() => {
        getBasicOfficeAddress()
    }, [])

    const getBasicOfficeAddress = async (opts?: { soft?: boolean }) => {
        if (!opts?.soft) setIsLoading(true)
        const { data, success } = await commonPostAPICall({}, "agent_profile/get_address")
        if (success && success == true) {
            if (data) {
                setofficeStreetAddress(data?.officeStreetAddress ?? "")
                setofficeCity(data?.officeCity ?? "")
                setofficeStateProvince(data?.officeStateProvince ?? "")
                setofficeCountry(data?.officeCountry ?? "")
                setofficePostalCode(data?.officePostalCode ?? "")
                setArea(data?.officeArea || "")
                setLatitude(data?.latitude || null)
                setLongitude(data?.longitude || null)
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
            officeArea: area,
            latitude,
            longitude,
        }, "agent_profile/update_basic_profile", true)
        if (success && success == true) {
            getBasicOfficeAddress({ soft: true })
        }
    }

    const handlePlaceSelected = (place: any) => {
        if (place) {
            const addressComponents = place.address_components || []
            const getComponent = (types: string[]) => addressComponents.find((component: any) =>
                types.some((type) => component.types.includes(type))
            )?.long_name

            setArea(place?.formatted_address?.split(",")[0] || "")
            setofficeCity(getComponent(["locality"]) || "")
            setofficeStateProvince(getComponent(["administrative_area_level_1"]) || "")
            setofficeCountry(getComponent(["country"]) || "")
            setofficePostalCode(getComponent(["postal_code"]) || "")

            if (place.geometry?.location) {
                setLatitude(place.geometry.location.lat())
                setLongitude(place.geometry.location.lng())
            }
        }
    }

    return (
        <div>
            {isLoading ? <div className='flex items-center justify-center my-5'><Spinner /></div> :
                <div className="p-2 sm:p-4 w-full max-w-3xl space-y-3">
                    <div>
                        <h3 className="text-lg font-semibold">Office Address</h3>
                        <p className="text-sm text-default-500">Please provide the primary office address of your agency</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="sm:col-span-2 lg:col-span-4">
                            <label className="text-sm text-default-600">Street Address</label>
                            <Input
                                className="w-full"
                                style={{ width: '100%' }}
                                onChange={setofficeStreetAddress}
                                value={officeStreetAddress}
                            />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-4">
                            <label className="text-sm text-default-600">Area</label>
                            <AreaPlacesInput
                                defaultValue={area}
                                onPlaceSelected={handlePlaceSelected}
                                onChange={setArea}
                            />
                            <p className="text-tiny mt-1 text-default-500">Choose your area carefully — it is used to match nearby leads.</p>
                        </div>
                        <div>
                            <label className="text-sm text-default-600">City</label>
                            <Input className="w-full" style={{ width: '100%' }} onChange={setofficeCity} value={officeCity} />
                        </div>
                        <div>
                            <label className="text-sm text-default-600">State/Province</label>
                            <Input className="w-full" style={{ width: '100%' }} onChange={setofficeStateProvince} value={officeStateProvince} />
                        </div>
                        <div>
                            <label className="text-sm text-default-600">Country</label>
                            <Input className="w-full" style={{ width: '100%' }} onChange={setofficeCountry} value={officeCountry} />
                        </div>
                        <div>
                            <label className="text-sm text-default-600">Postal Code</label>
                            <Input className="w-full" style={{ width: '100%' }} onChange={setofficePostalCode} value={officePostalCode} />
                        </div>
                    </div>

                    <Button variant="shadow" color="primary" className="w-full sm:w-auto" onPress={updateOfficeAddress}>Update</Button>
                </div>
            }
        </div>
    )
}

export default BasicOfficeAddress
