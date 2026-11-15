import { Accordion, AccordionItem, Button, Input, Select, SelectItem, Textarea } from "@heroui/react"
import React, { useState } from 'react'
import { BiBadge } from 'react-icons/bi'
import { FaPlayCircle } from 'react-icons/fa'

import FaqSection from '../../components/FaqSection';
import Testimonials from '../../components/Testimonials';
import { Md12Mp } from 'react-icons/md';
import ContentWritingList from '../../components/ContentWritingList';
import { useNavigate } from 'react-router-dom';
import HomePageFlags from '../../components/HomePageFlags';
import { useDispatch } from 'react-redux';
import { TbReceiptRupee } from 'react-icons/tb';
import * as Yup from 'yup'
import { ErrorMessage, Form, Formik } from 'formik';
import { SuccessToast } from '../../utils/Toaster';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { phoneInputProps, phoneOnChange } from "@/utils/phone";

const PrivateIntroPage = () => {

    const { commonPostAPICall } = useApiCallUtils()

    const navigate = useNavigate()

    const dispatch = useDispatch()


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

    return (
        <div className='text-dark_primary dark:text-white'>

            <div className="container mx-auto p-6 sm:p-6 lg:p-8" >
                <div className="grid lg:grid-cols-7 lg:gap-x-8 xl:gap-x-12 lg:items-center">
                    <div className="lg:col-span-3">
                        <h1 className="tracking-* text-3xl font-bold lg:text-3xl">TechX CRM - Destination, One Click</h1>
                        <p className="my-3 text-lg ">Find all visa-related solutions, tailored for students and travelers. From application guidance to expert advice, TechX CRM simplifies your journey abroad.</p>

                        <Button
                            as={"a"}
                            href='#services'
                            variant='flat'
                            color='primary'
                        >
                            Getting Started
                        </Button>

                    </div>

                    <div className="lg:col-span-4 mt-10 lg:mt-0 hidden sm:block">
                        {/* <img className="w-full h-[50vh] object-cover rounded-xl" src="https://images.pexels.com/photos/4645982/pexels-photo-4645982.jpeg" alt="Hero Image" /> */}
                        <video className="w-full h-[50vh] object-cover rounded-xl" src='https://videos.pexels.com/video-files/7431747/7431747-uhd_2732_1440_30fps.mp4' autoPlay loop muted />
                    </div>
                </div>
            </div>

            {/* services */}

            <section className='container mx-auto my-36' id='services' >
                <h1 className='text-3xl text-center my-5'>Everything you need for academics in one place</h1>


            </section>

            {/* flags */}
            <HomePageFlags />

            {/* why choose TechX CRM */}

            <div className="container p-10 my-36 mx-auto">
                <div className="grid md:grid-cols-2 gap-12">
                    <div className="lg:w-3/4">
                        <h2 className="text-3xl lg:text-3xl dark:text-white">
                            Why Choose TechX CRM?
                        </h2>
                        <p className="mt-3 dark:text-neutral-400">
                            TechX CRM offers personalized visa solutions with expert guidance at every step. We simplify the process, ensuring a smooth and hassle-free journey for students and travelers alike.
                        </p>
                    </div>

                    <div className="space-y-6 lg:space-y-10">
                        <div className="flex gap-x-5 sm:gap-x-8">
                            <span className="shrink-0 inline-flex justify-center items-center size-[46px] rounded-full border border-primary bg-white text-gray-800 shadow-sm mx-auto dark:bg-neutral-900 dark:text-neutral-200">
                                <svg className="shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                            </span>
                            <div className="grow">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-neutral-200">
                                    Industry-leading documentation
                                </h3>
                                <p className="mt-1 text-gray-600 dark:text-neutral-400">
                                    Our documentation and extensive Client libraries contain everything a business needs to build a custom integration in a fraction of the time.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-x-5 sm:gap-x-8">
                            <span className="shrink-0 inline-flex justify-center items-center size-[46px] rounded-full border border-primary bg-white shadow-sm mx-auto dark:bg-neutral-900">
                                <svg className="shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></svg>
                            </span>
                            <div className="grow">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-neutral-200">
                                    Developer community support
                                </h3>
                                <p className="mt-1 text-gray-600 dark:text-neutral-400">
                                    We actively contribute to open-source projects—giving back to the community through development, patches, and sponsorships.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-x-5 sm:gap-x-8">
                            <span className="shrink-0 inline-flex justify-center items-center size-[46px] rounded-full border border-primary bg-white shadow-sm mx-auto dark:bg-neutral-900">
                                <svg className="shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                            </span>
                            <div className="grow">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-neutral-200">
                                    Simple and affordable
                                </h3>
                                <p className="mt-1 text-gray-600 dark:text-neutral-400">
                                    From boarding passes to movie tickets, there's pretty much nothing you can't store with Preline.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <section className='container mx-auto max-w-3xl my-24 space-y-2 flex flex-col items-center p-5' id='form_of_contact'>
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

                            {/* <label htmlFor="content_requirement">Content Requirement</label>
            <Field name="content_requirement" as="select" label="Content Requirement">
              <option value="" label="Select an option" />
              <option value="sop" label="SOP" />
              <option value="motivation_letter" label="Motivation Letter" />
              <option value="cover_letter" label="Cover Letter" />
            </Field> */}
                            {/* <ErrorMessage name="content_requirement" component="div" className="error" /> */}
                            <Select
                                label="Content Requirement"
                                name='content_requirement'
                                placeholder="Select an Option"
                                isInvalid={errors.content_requirement && touched.content_requirement}
                                errorMessage={errors.content_requirement && touched.content_requirement && errors.content_requirement}
                                onChange={handleChange("content_requirement")}
                                value={values.content_requirement}
                            // onChange={(e) => {
                            //     setFormOptions({
                            //         ...formOptions,
                            //         content_requirement: e.target.value
                            //     })
                            // }}
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


                            <Button isLoading={isSubmit} type="submit" variant='flat' color='primary'>
                                <TbReceiptRupee /> Pay Now And Submit
                            </Button>
                        </Form>
                    )}
                </Formik>
            </section>

            <Testimonials />

            <FaqSection />

        </div>
    )

}

export default PrivateIntroPage