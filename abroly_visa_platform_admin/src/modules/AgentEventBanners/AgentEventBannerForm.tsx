import { useState, useEffect } from 'react';
import { DatePicker, Form } from 'rsuite';
import { Button, Input } from '@nextui-org/react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthToken } from '@/utils/localstorage';
import { Trash } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { SuccessToast } from '@/utils/Toaster';


const AgentEventBannerForm = () => {
    const [formData, setFormData] = useState<any>({
        start_date: '',
        end_date: '',
        heading: '',
        descriptive_text: '',
        images: []
    });

    const [newImages, setNewImages] = useState([]);

    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { id } = useParams();

    useEffect(() => {
        if (id) {
            fetchEventBanner();
        }
    }, [id]);

    const fetchEventBanner = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/v1/event-banners/agent/get/${id}`, {
                headers: { Authorization: `Bearer ${getAuthToken()}` }
            });
            if (response.data.success) {
                setFormData(response.data.data);
            } else {
                setError('Failed to fetch event banner details.');
            }
        } catch (error) {
            setError('An error occurred while fetching event banner details.');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleFileChange = (e) => {
        setNewImages([...newImages, ...e.target.files]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { start_date, end_date, heading, descriptive_text, images } = formData;
        if (!start_date || !end_date || !heading || !descriptive_text || newImages.length === 0) {
            setError('All fields are required, and at least one image must be uploaded.');
            return;
        }

        const formDataToSend = new FormData();
        formDataToSend.append('start_date', start_date);
        formDataToSend.append('end_date', end_date);
        formDataToSend.append('heading', heading);
        formDataToSend.append('descriptive_text', descriptive_text);

        if (newImages && newImages.length > 0) {
            newImages?.forEach((image) => {
                formDataToSend.append('images', image);
            });
        }

        try {
            let response = id ? await axios.put(`${import.meta.env.VITE_API_BASE_URL}/v1/event-banners/agent/update/${id}`, formDataToSend, {
                headers: {
                    Authorization: `Bearer ${getAuthToken()}`,
                    'Content-Type': 'multipart/form-data',
                },
            }) : await axios.post(`${import.meta.env.VITE_API_BASE_URL}/v1/event-banners/agent/add`, formDataToSend, {
                headers: {
                    Authorization: `Bearer ${getAuthToken()}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                navigate('/agent_event_banners');
            } else {
                setError(response.data.message);
            }
        } catch (error) {
            setError('An error occurred while saving the event banner.');
        }
    };  

    const {commonGetAPICalls} = useApiCallUtils()

    const deleteImage = async(imageId)=>{
        const {data,success} = await commonGetAPICalls("/event-banners/agent/delete-image/"+imageId)
        if(success && success == true){
            SuccessToast("Deleted")
            fetchEventBanner()
        }
    }

    return (
        <div className="p-4">
            <h1 className="text-xl font-bold">{id ? 'Edit' : 'Create'} Agent Event Banner</h1>
            {error && <p className="text-red-500">{error}</p>}
            <form onSubmit={handleSubmit} className='flex flex-col gap-2'>
                <div>
                    <label>Start Date</label>
                    <DatePicker  
                    name="start_date" 
                    value={new Date(formData.start_date)} 
                    onChange={(date)=>{
                        setFormData({ ...formData, start_date: date });
                    }} />
                </div>
                <div>
                    <label>End Date</label>
                    <DatePicker name="end_date" value={new Date(formData.end_date)} onChange={(date)=>{
                        setFormData({ ...formData, end_date: date });
                    }} />
                </div>
                <div>
                    <label>Heading</label>
                    <Input name="heading" value={formData.heading} onChange={handleChange} />
                </div>
                <div>
                    <label>Descriptive Text</label>
                    <ReactQuill value={formData.descriptive_text} onChange={(value) => handleChange({ target: { name: 'descriptive_text', value } })} />
                </div>
                <div className='flex flex-row gap-2 items-center justify-start my-2'>
                    <label>Upload Images</label>
                    <input type="file" onChange={handleFileChange} multiple />
                </div>

                {formData?.images?.length > 0 && (
                    <div>
                        <h2>Uploaded Images</h2>
                        <ul className='flex flex-col gap-2'>
                            {formData?.images?.map((image, index) => (
                                <li key={index} className="flex items-center justify-between">
                                    <img src={(image?.url)} alt={image.name} className="h-40 object-cover mr-2" />
                                    <span>{image?.imageUrl}</span>
                                    <Button
                                        color="danger"
                                        size="sm"
                                        onPress={() => {
                                            deleteImage(image?.id);
                                        }}
                                    >
                                        <Trash className="w-4 h-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                 {newImages && newImages.length > 0 && (
                    <div>
                        <h2>Uploaded Images</h2>
                        <ul className='flex flex-col gap-2'>
                            {newImages?.map((image, index) => (
                                <li key={index} className="flex items-center justify-between">
                                    {/* display image that selected locally by user */}
                                    <img src={URL.createObjectURL(image)} alt={image?.name} className="h-40 object-cover mr-2" />
                                    <span>{image?.name}</span>
                                    <Button
                                        color="danger"
                                        size="sm"
                                        onPress={() => {
                                            setNewImages(newImages.filter((_, i) => i !== index));
                                        }}>
                                        <Trash className="w-4 h-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}


                <Button type="submit" className='w-fit' variant='shadow' color='primary'>{id ? 'Update' : 'Create'} Banner</Button>
            </form>
        </div>
    );
};

export default AgentEventBannerForm;
