import React, { useEffect, useState } from 'react';
import { Table, Spinner, TableColumn, TableRow, TableCell, TableHeader, TableBody, Pagination, Button } from '@nextui-org/react';
import BackButton from '@/components/BackButton';
import { useParams } from 'react-router-dom';
import useApiCallUtils from '@/hooks/useApiCallUtils';

const AgentEventBannerInquiries = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const { id } = useParams();
    
    const [inquiries, setInquiries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const inquiriesPerPage = 10; 

    const fetchInquiries = async (page = 1) => {
        setIsLoading(true);
        const { data, success } = await commonGetAPICalls(`/event-banners/agent/interest/list/${id}`);
        if (success) {
            setInquiries(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchInquiries();
    }, []);

    return (
        <div className='container mx-auto'>
            <p className='my-4 font-bold flex flex-row items-center gap-2'><BackButton />Agent Event Banner Inquiries</p>
            {isLoading && inquiries.length === 0 ? (
                <div className='flex items-center justify-center py-16'>
                    <Spinner />
                </div>
            ) : (
                <Table aria-label="Inquiries Table">
                    <TableHeader>
                        <TableColumn>Name</TableColumn>
                        <TableColumn>Email</TableColumn>
                        <TableColumn>Number</TableColumn>
                        <TableColumn>Inquiry Date</TableColumn>
                        <TableColumn>Action</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent={<div>No data found</div>}>
                        {inquiries?.map((inquiry) => (
                            <TableRow key={inquiry.id}>
                                <TableCell>{inquiry?.agent?.username}</TableCell>
                                <TableCell>{inquiry?.agent?.email}</TableCell>
                                <TableCell>{inquiry?.agent?.phone}</TableCell>
                                <TableCell>{new Date(inquiry.createdAt).toLocaleString()}</TableCell>
                                <TableCell>
                                    <Button variant='flat' color='secondary' size='sm'
                                    onPress={()=>{
                                        window.open(`/agents/${inquiry?.agent?.uuid}`, '_blank');
                                    }}
                                    >
                                    View Profile
                                    </Button>
                                    </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
};

export default AgentEventBannerInquiries;
