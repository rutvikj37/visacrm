import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Button, Card, CardBody, CardFooter, Modal, ModalBody, ModalContent, useDisclosure } from '@heroui/react'
import { Calendar } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Carousel, Tooltip } from 'rsuite'

const AgentEventBanners = () => {

    const { commonPostAPICall, commonGetAPICalls } = useApiCallUtils()

    const [eventBanners, setEventBanners] = useState<any[]>([])

    useEffect(() => {
        getEventBanners()
    }, [])

    const getEventBanners = async () => {
        const { success, data } = await commonGetAPICalls('/event-banners/agent/active')
        if (success && success == true) {
            setEventBanners(data)
        }
    }

    const { isOpen, onOpenChange } = useDisclosure()
    const [currentEvent, setCurrentEvent] = useState<any>(null)
    const [showForm, setShowForm] = useState(false)

    const handleSubmit = async (e: any) => {
        e.preventDefault()

        const { success } = await commonPostAPICall({}, "/event-banners/agent/interest/" + currentEvent?.id, true)
        if (success && success == true) {
            setShowForm(false)
            onOpenChange()
        }
    }

    return (
        <div className='container mx-auto my-2'>
            <div className="grid sm:grid-cols-2 gap-4 p-4">
                {eventBanners?.map((item, index) => (
                    <div key={index} className="w-full h-full">
                        <Card key={item?.id} className="shadow" onPress={() => { onOpenChange(); setCurrentEvent(item) }} isPressable>
                            <CardBody className="overflow-visible p-0">
                                {item?.images && item.images.length > 0 && (
                                    <>
                                        <Carousel autoplayInterval={5000} shape='bar' autoplay className="custom-slider aspect-video h-fit w-fit" >
                                            {item.images.map((image, index) => (
                                                <div className="relative">
                                                    <img key={image?.id} src={image?.url} alt={`Event Banner ${index}`} className="w-fit h-auto object-center aspect-video" />
                                                </div>
                                            ))}
                                        </Carousel>
                                    </>
                                )}
                            </CardBody>
                            <CardFooter className='flex justify-between items-center'>
                                <div className="text-start text-tiny">
                                    {item?.heading}
                                </div>
                                <Button variant='solid' color='primary' size='sm' onPress={() => { onOpenChange(); setCurrentEvent(item) }}>Know More</Button>
                            </CardFooter>
                        </Card>
                    </div>
                ))}
                {eventBanners?.length == 0 && <div className="text-center text-lg">No events available</div>}
            </div>

            <Modal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                placement="center"
                scrollBehavior='inside'
                size="3xl"
                onClose={() => {
                    setShowForm(false)

                }}
                backdrop='blur'>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalBody className="overflow-visible p-0">
                                <Card>
                                    <CardBody className="overflow-visible p-0">
                                        {currentEvent?.images && currentEvent?.images?.length > 0 && (
                                            <Carousel autoplayInterval={5000} shape='bar' autoplay className="custom-slider aspect-video h-fit w-fit" >
                                                {currentEvent?.images.map((image, index) => (
                                                    <img key={image?.id} src={image?.url} alt={`Event Banner ${index}`} className="w-fit h-auto object-center aspect-video" />
                                                ))}
                                            </Carousel>
                                        )}
                                    </CardBody>
                                    <CardFooter className="p-4 flex flex-col gap-2 items-start justify-start">
                                        <div className="text-start text-sm flex flex-col gap-2 w-full">
                                            {showForm ? (
                                                <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                                                    <div className='w-full flex justify-end gap-2'>
                                                        <Button variant='shadow' color='primary' type='submit' size='sm'>Submit Your Profile</Button>
                                                        <Button variant='shadow' color='danger' size='sm' onPress={() => setShowForm(false)}>Cancel</Button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <>
                                                    <h2 className="font-bold">{currentEvent?.heading}</h2>
                                                    <hr className='w-full' />
                                                    <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: currentEvent?.descriptive_text }}></p>
                                                    <hr className='w-full' />
                                                    <div className="flex items-center text-gray-500">
                                                        <Calendar className="mr-2" size={16} />
                                                        <p>
                                                            Start Date: {new Date(currentEvent?.start_date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center text-gray-500">
                                                        <Calendar className="mr-2" size={16} />
                                                        <p>
                                                            End Date: {new Date(currentEvent?.end_date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className='w-full flex justify-end gap-2'>
                                                        <Button variant='shadow' color='primary' size='sm' onPress={() => setShowForm(true)}>Interested</Button>
                                                        <Button variant='shadow' color='danger' size='sm' onPress={() => onOpenChange()}>Close</Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardFooter>
                                </Card>
                            </ModalBody>
                        </>)}
                </ModalContent>
            </Modal>

        </div>
    )
}

export default AgentEventBanners