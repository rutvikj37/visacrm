import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardFooter, Spinner, useDisclosure, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Pagination } from '@nextui-org/react';
import { Edit, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Carousel } from 'rsuite';
import 'rsuite/Carousel/styles/index.css';

import BackButton from '@/components/BackButton';
import CommonConfirmation from '@/components/CommonConfirmation';
import useApiCallUtils from '@/hooks/useApiCallUtils';

const AgentEventBanners = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const navigate = useNavigate();

    const [filterValue, setFilterValue] = useState("current");
    const [eventBannerData, setEventBannerData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(()=>{
        fetchEventBanners()
    },[filterValue])

    const fetchEventBanners = async () => {
        const soft = eventBannerData.length > 0;
        if (!soft) setIsLoading(true);
        const { data, success } = await commonGetAPICalls(`/event-banners/agent/list?flag=${filterValue}`);
        if (success) {
            setEventBannerData(data || []);
        }
        setIsLoading(false);
    };


    // Handle Delete
    const { isOpen: isDeleteCnfOpen, onOpenChange: onDeleteCnfOpenChange } = useDisclosure();
    const [deleteUUID, setDeleteUUID] = useState("");

    const deleteEventBanner = async () => {
        const { success } = await commonPostAPICall({}, `event-banners/agent/delete/${deleteUUID}`, true);
        if (success) {
            fetchEventBanners();
            onDeleteCnfOpenChange();
            setDeleteUUID("");
        }
    };

    return (
        <div className='container mx-auto'>
            <div className='flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between mb-4'>
                <BackButton />
                <h1 className='flex-grow'>Agent Event Banners</h1>
                <select
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="border rounded p-2"
                >
                    <option value="current">Active</option>
                    <option value="past">Past</option>
                </select>
                <Button color='primary' onPress={() => navigate("/agent_event_banners_create")}>+ Add</Button>
            </div>

            {isLoading && eventBannerData.length === 0 ? (
                <div className='flex items-center justify-center h-48'>
                    <Spinner />
                </div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-4">
                    {eventBannerData?.length === 0 ? (
                        <p>No records to display.</p>
                    ) : (
                        eventBannerData?.map((item) => (
                            <Card key={item.id} className="shadow">
                                <CardBody className="p-0">
                                    {item.images?.length > 0 && (
                                        <Carousel autoplay className="custom-slider aspect-video h-fit w-fit">
                                            {item.images.map((image) => (
                                                <img key={image.id} src={image.url} alt="Event Banner" className="w-full h-auto object-cover" />
                                            ))}
                                        </Carousel>
                                    )}
                                </CardBody>
                                <CardFooter className="p-4 flex flex-col items-start gap-1">
                                    <h2 className="font-bold">{item.heading}</h2>
                                    <p className="text-sm">Start: {new Date(item.start_date).toDateString()}</p>
                                    <p className="text-sm">End: {new Date(item.end_date).toDateString()}</p>
                                    <p className="text-sm">Created At: {new Date(item.createdAt).toLocaleString()}</p>
                                    <div className='flex gap-2 mt-2'>
                                        <Button onPress={() => navigate(`/agent_event_banners_inquiries/${item.id}`)}>Inquiries</Button>
                                        <Button variant='flat' color='primary' size='sm' onPress={() => navigate(`/agent_event_banners_create/${item.id}`)} startContent={<Edit />} >Edit</Button>
                                        <Button variant='flat' color='danger' size='sm' onPress={() => { setDeleteUUID(item.id); onDeleteCnfOpenChange(); }} startContent={<Trash />} >Delete</Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </div>
            )}
            
            <CommonConfirmation isOpen={isDeleteCnfOpen} onOpenChange={onDeleteCnfOpenChange} title="Are you sure you want to delete?" handleSubmit={deleteEventBanner} nagativeTitle="No" positiveTitle="Yes" />
        </div>
    );
};

export default AgentEventBanners;
