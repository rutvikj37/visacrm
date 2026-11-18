import { Button, Image, Input, Radio, RadioGroup, Select, SelectItem, Spinner, Textarea, useDisclosure } from '@nextui-org/react';
import axios from 'axios';
import { ArrowLeft, Edit, FileText, ImageIcon, Plus, Trash, Shield, Wifi, BookOpen, Briefcase, Home, MapPin, FileText as FileTextIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react'
import ReactQuill from 'react-quill';
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import 'react-quill/dist/quill.bubble.css';
import * as Yup from 'yup'
import { SuccessToast } from '@/utils/Toaster';
import { Form, Formik } from 'formik';
import { TbReceiptRupee } from 'react-icons/tb';
import HealthInsurance from '../HealthInsurance/HealthInsurance';
import SimCardListing from '../SimcardListing/SimCardListing';
import LanguagePrep from '../LanguagePrep/LanguagePrep';
import { getAuthToken } from '@/utils/localstorage';
import CommonConfirmation from '@/components/CommonConfirmation';
import AchievementBanner from '../AchievementBanner/AchievementBanner';
import Career from '../Career/Career';
import Accommodation from '../Accommodation/Accommodation';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { PRIMARY_COLOR } from '@/lib/theme';
import { phoneInputProps, phoneOnChange } from "@/utils/phone";


const ServiceInfo = () => {

    const { commonPostAPICall, commonPostPublicAPICall } = useApiCallUtils()

    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const { service } = useParams()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [service])

    const contentWritingServices = [
        "sop", "motivation", "cover"
    ]

    const [blocks, setBlocks] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        listBlocks()
    }, [service])

    // list
    const listBlocks = async () => {
        setIsLoading(true)
        const { success, data } = await commonPostPublicAPICall({ content_of: service }, "service_info/list")
        if (success && success == true) {
            setBlocks(data)
        }
        setIsLoading(false)
    }

    const navigate = useNavigate()

    // for content writing
    const [formOptions, setFormOptions] = useState({
        name: "",
        number: "",
        email: "",
        content_requirement: "",
        message: ""
    })

    // for submit content wrting 
    const validationSchema = Yup.object({
        name: Yup.string().required('Please Provide Name'),
        number: Yup.string().required('Please Provide Number for contact you'),
        email: Yup.string().email('Invalid email address').required('Please Provide Email'),
        content_requirement: Yup.string().required('Content Requirement must be selected'),
        message: Yup.string().required('Please Provide Message, that will help us to know about your requirement'),
    });

    const [isSubmit, setIsSubmit] = useState(false)

    // handle submit content writing 
    const handleSubmitContentWriting = async (values: any) => {
        setIsSubmit(true)
        const { success, data } = await commonPostAPICall({ ...values }, "/content_writing_response/submit_form")
        if (success && success == true) {
            SuccessToast("Submitted For Review, Please wait for redirection to get more Information")
            navigate("/content_writing_history")
        }
        setIsSubmit(false)


    }

    // Get service info for banner
    const getServiceInfo = () => {
        const serviceMap: any = {
            'sop': { title: 'Statement of Purpose', subtitle: 'Professional SOP writing services for your study abroad journey', icon: FileTextIcon, image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&w=1500&q=80' },
            'motivation': { title: 'Motivation Letter', subtitle: 'Craft compelling motivation letters that showcase your passion', icon: FileTextIcon, image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&w=1500&q=80' },
            'cover': { title: 'Cover Letter', subtitle: 'Professional cover letters to make your application stand out', icon: FileTextIcon, image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&w=1500&q=80' },
            'health_ins': { title: 'Health Insurance', subtitle: 'Comprehensive health insurance plans for students studying abroad', icon: Shield, image: 'https://images.unsplash.com/photo-1584466977773-e625c37cdd50?auto=format&w=1500&q=80' },
            'sim_card': { title: 'International E-SIM', subtitle: 'Stay connected with international e-SIM cards for your travels', icon: Wifi, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&w=1500&q=80' },
            'language': { title: 'Language Preparation', subtitle: 'Prepare for language proficiency tests with expert guidance', icon: BookOpen, image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&w=1500&q=80' },
            'career': { title: 'Career Services', subtitle: 'Find job opportunities and advance your career abroad', icon: Briefcase, image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&w=1500&q=80' },
            'accommodation': { title: 'Accommodation', subtitle: 'Find safe and comfortable housing near your institution', icon: Home, image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&w=1500&q=80' },
            'visa_consultation': { title: 'Visa Consultation', subtitle: 'Expert visa guidance and documentation support', icon: MapPin, image: 'https://images.pexels.com/photos/7009468/pexels-photo-7009468.jpeg' },
        };
        return serviceMap[service || ''] || { title: 'Service Information', subtitle: 'Get detailed information about our services', icon: FileTextIcon, image: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&w=1500&q=80' };
    }

    const serviceInfo = getServiceInfo();

    // Career / health / sim embed their own hero banners; others get one here.
    const showPageHeroBanner = !["career", "health_ins", "sim_card"].includes(String(service || ""));

    return (
        <div className="flex flex-col gap-4 w-full">
            {showPageHeroBanner && <AchievementBanner target_type={service} />}

            <div className="flex items-start gap-3">
                <Button
                    variant="light"
                    onPress={() => navigate(-1)}
                    isIconOnly
                    className="shrink-0"
                    style={{ color: PRIMARY_COLOR }}
                >
                    <ArrowLeft className="h-4" style={{ color: PRIMARY_COLOR }} />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                        {serviceInfo.title}
                    </h1>
                    <p className="text-sm text-default-500">{serviceInfo.subtitle}</p>
                </div>
            </div>

            <div>


            {!getAuthToken() &&
                <div>
                    <div className="">
                        {isLoading == true && <section className='flex items-center justify-center'>
                            <Spinner /></section>}
                        {blocks
                            .sort((a, b) => a.order - b.order) // Sort blocks by order
                            .map((block) => (
                                <div
                                    key={block.uuid}
                                    className="px-4 rounded-lg flex items-start gap-4"
                                >

                                    <div className="flex-1">

                                        {/* Conditional Rendering for Text or Image */}
                                        {block?.section_type === "text" && (
                                            <div>
                                                <ReactQuill
                                                    theme="bubble"
                                                    value={block?.description}
                                                    readOnly
                                                />
                                            </div>
                                        )}

                                        {block.section_type === "image" && (
                                            <div>
                                                {block?.access_file ? (
                                                    <Image
                                                        src={block?.access_file}
                                                        alt="Block Image"
                                                        className='w-full md:w-2/3 mx-auto'
                                                    />
                                                ) : (
                                                    <p className="text-gray-500 italic">No image available</p>
                                                )}
                                            </div>
                                        )}
                                    </div>


                                </div>
                            ))}
                    </div>

                </div>
            }



            {contentWritingServices.includes(service) && getAuthToken() &&
                <section className='grid grid-cols-12'>
                    <section className='container max-w-3xl my-24 space-y-2 flex flex-col items-center mx-auto col-span-12' id='form_of_contact'>
                        <h1 className='text-center text-3xl my-5'>Contact us for more details</h1>
                        <Formik
                            initialValues={{
                                name: '',
                                number: '',
                                email: '',
                                content_requirement: formOptions.content_requirement,
                                message: '',
                            }}

                            validationSchema={validationSchema}
                            onSubmit={(values) => {
                                // console.log(values); // Submit logic here
                                handleSubmitContentWriting(values)
                            }}

                        >
                            {({ values, handleChange, handleSubmit, errors, touched }) => (
                                <Form onSubmit={handleSubmit}
                                    className=' w-full flex flex-col gap-2 items-center'
                                >

                                    <Input name="name" label="Name"
                                        isInvalid={errors.name && touched.name}
                                        errorMessage={errors.name && touched.name && errors.name}
                                        onChange={handleChange("name")}
                                        value={values.name}
                                    />
                                    {/* <ErrorMessage name="name" component="div" className="error" /> */}



                                    <Input name="number" label="Number"
                                        isInvalid={errors.number && touched.number}
                                        errorMessage={errors.number && touched.number && errors.number}
                                        type="tel"
                                {...phoneInputProps}
                                onChange={phoneOnChange(handleChange("number"))}
                                        value={values.number}
                                    />
                                    {/* <ErrorMessage name="number" component="div" className="error" /> */}



                                    <Input name="email" label="Email"
                                        isInvalid={errors.email && touched.email}
                                        errorMessage={errors.email && touched.email && errors.email}
                                        onChange={handleChange("email")}
                                        value={values.email}
                                    />
                                    {/* <ErrorMessage name="email" component="div" className="error" /> */}
                                    {/* <ErrorMessage name="content_requirement" component="div" className="error" /> */}
                                    <Select
                                        label="Content Requirement"
                                        name='content_requirement'
                                        placeholder="Select an Option"
                                        isInvalid={errors.content_requirement && touched.content_requirement}
                                        errorMessage={errors.content_requirement && touched.content_requirement && errors.content_requirement}
                                        onChange={handleChange("content_requirement")}
                                        value={values.content_requirement}
                                    >
                                        {["sop", "motivation_letter", "cover_letter"].map((item) => (
                                            <SelectItem key={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                    </Select>

                                    <Textarea
                                        name="message"
                                        label="Message"
                                        isInvalid={errors.message && touched.message}
                                        errorMessage={errors.message && touched.message && errors.message}
                                        onChange={handleChange("message")}
                                        value={values.message}

                                    />
                                    {/* <ErrorMessage name="message" component="div" className="error" /> */}
                                    <Button isLoading={isSubmit} type="submit" variant='flat' className="text-white" style={{ backgroundColor: PRIMARY_COLOR }}>
                                        <TbReceiptRupee /> Pay Now And Submit
                                    </Button>
                                </Form>
                            )}
                        </Formik>
                    </section>
                </section>
            }
            {!contentWritingServices.includes(service) && service == "career" && getAuthToken() && (
                <div className="w-full">
                    <Career />
                </div>
            )}
            {/* Students no longer raise new applications from the portal — counsellor starts cases. */}
            {!contentWritingServices.includes(service) && service == "visa_consultation" && getAuthToken() && (
                <Navigate to="/my_progress" replace />
            )}

            {getAuthToken() == null && <section className='flex my-4 items-center justify-center'><Button
                onPress={onOpenChange}
                className="text-white"
                style={{ backgroundColor: PRIMARY_COLOR }}
            >Explore More</Button></section>}


            <CommonConfirmation
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                title={"You Need to login first to know more, do you want to login now ?"}
                handleSubmit={() => {
                    navigate("/login")

                }}
                nagativeTitle={"No"}
                positiveTitle={"Yes"}
            />
            </div>
        </div>
    )
}

export default ServiceInfo