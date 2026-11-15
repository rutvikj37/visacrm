import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Formik } from 'formik'
import * as Yup from 'yup'
import {
  Button,
  Input,
  Textarea,
  Card,
  CardBody,
  Divider,
  Spinner
} from '@nextui-org/react'
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Palette, 
  Headphones, 
  Search,
  Image as ImageIcon,
  ArrowLeft
} from 'lucide-react'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { phoneInputProps, phoneOnChange } from "@/utils/phone";

// Validation schema
const createAgentValidation = Yup.object().shape({
  phone_number: Yup.string()
    .required("Please Provide Phone Number")
    .matches(/^[0-9]{10}$/, "Please Provide a Valid Phone Number (10 digits)"),
  country_code: Yup.string()
    .required("Please Provide Country Code")
    .matches(/^\+\d+$/, "Please Provide a Valid Country Code (e.g., +91)"),
  user_name: Yup.string()
    .required("Please Provide User Name")
    .min(3, "User Name must be at least 3 characters"),
  email: Yup.string()
    .required("Please Provide Email")
    .email("Please Provide a Valid Email"),
  primary_color: Yup.string()
    .matches(/^#[0-9A-Fa-f]{6}$/, "Please Provide a Valid Hex Color (e.g., #0f5bd8)"),
  primary_foreground_color: Yup.string()
    .matches(/^#[0-9A-Fa-f]{6}$/, "Please Provide a Valid Hex Color (e.g., #ffffff)"),
  dark_primary_color: Yup.string()
    .matches(/^#[0-9A-Fa-f]{6}$/, "Please Provide a Valid Hex Color (e.g., #D8C4B6)"),
})

const CreateAgent = () => {
  const navigate = useNavigate()
  const { commonPostAPICallWithFile } = useApiCallUtils()
  const [isLoading, setIsLoading] = useState(false)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)

  const initialValues = {
    phone_number: '',
    country_code: '+91',
    user_name: '',
    email: '',
    primary_color: '#0f5bd8',
    primary_foreground_color: '#ffffff',
    dark_primary_color: '#D8C4B6',
    app_name: '',
    support_number: '',
    support_email: '',
    agency_address: '',
    certificate_url: '',
    favicon_url: '',
    meta_description: '',
    meta_keywords: '',
    og_image: '',
    og_url: '',
    sudomain: '',
    domain: ''
  }

  const handleSubmit = async (values: any) => {
    setIsLoading(true)

    try {
      // Create FormData for file upload
      const formData = new FormData()

      // Append all form fields
      Object.keys(values).forEach((key) => {
        if (values[key] !== '' && values[key] !== null && values[key] !== undefined) {
          formData.append(key, values[key])
        }
      })

      // Append files if selected
      if (faviconFile) {
        formData.append('favicon_file', faviconFile)
      }
      if (ogImageFile) {
        formData.append('og_image_file', ogImageFile)
      }

      const { success } = await commonPostAPICallWithFile(
        formData,
        'agent/create_account',
        true
      )

      if (success) {
        navigate('/agents')
      }
    } catch (error) {
      console.error('Error creating agent:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button
          isIconOnly
          variant="light"
          onPress={() => navigate('/agents')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Create Agent Account</h1>
      </div>

      <Formik
        initialValues={initialValues}
        validationSchema={createAgentValidation}
        onSubmit={handleSubmit}
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit
        }) => (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </h2>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="User Name"
                    name="user_name"
                    value={values.user_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter user name"
                    isInvalid={!!(errors.user_name && touched.user_name)}
                    errorMessage={errors.user_name as string}
                    startContent={<User className="h-4 w-4 text-default-400" />}
                    isRequired
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter email address"
                    isInvalid={!!(errors.email && touched.email)}
                    errorMessage={errors.email as string}
                    startContent={<Mail className="h-4 w-4 text-default-400" />}
                    isRequired
                  />
                  <Input
                    label="Country Code"
                    name="country_code"
                    value={values.country_code}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="+91"
                    isInvalid={!!(errors.country_code && touched.country_code)}
                    errorMessage={errors.country_code as string}
                    startContent={<Globe className="h-4 w-4 text-default-400" />}
                    isRequired
                  />
                  <Input
                    label="Phone Number"
                    name="phone_number"
                    type="tel"
                    {...phoneInputProps}
                    value={values.phone_number}
                    onChange={phoneOnChange(handleChange)}
                    onBlur={handleBlur}
                    placeholder="10-digit phone number"
                    isInvalid={!!(errors.phone_number && touched.phone_number)}
                    errorMessage={errors.phone_number as string}
                    startContent={<Phone className="h-4 w-4 text-default-400" />}
                    isRequired
                  />
                </div>
              </CardBody>
            </Card>

            {/* Branding Section */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Branding & Colors
                </h2>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="App Name"
                    name="app_name"
                    value={values.app_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter app name"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      label="Primary Color"
                      name="primary_color"
                      type="color"
                      value={values.primary_color}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      isInvalid={!!(errors.primary_color && touched.primary_color)}
                      errorMessage={errors.primary_color as string}
                      className="flex-1"
                    />
                    <Input
                      value={values.primary_color}
                      readOnly
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      label="Primary Foreground Color"
                      name="primary_foreground_color"
                      type="color"
                      value={values.primary_foreground_color}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      isInvalid={!!(errors.primary_foreground_color && touched.primary_foreground_color)}
                      errorMessage={errors.primary_foreground_color as string}
                      className="flex-1"
                    />
                    <Input
                      value={values.primary_foreground_color}
                      readOnly
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      label="Dark Primary Color"
                      name="dark_primary_color"
                      type="color"
                      value={values.dark_primary_color}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      isInvalid={!!(errors.dark_primary_color && touched.dark_primary_color)}
                      errorMessage={errors.dark_primary_color as string}
                      className="flex-1"
                    />
                    <Input
                      value={values.dark_primary_color}
                      readOnly
                      className="w-24"
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Support Information Section */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Headphones className="h-5 w-5" />
                  Support Information
                </h2>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Support Number"
                    name="support_number"
                    type="tel"
                    {...phoneInputProps}
                    value={values.support_number}
                    onChange={phoneOnChange(handleChange)}
                    onBlur={handleBlur}
                    placeholder="Enter support phone number"
                    startContent={<Phone className="h-4 w-4 text-default-400" />}
                  />
                  <Input
                    label="Support Email"
                    name="support_email"
                    type="email"
                    value={values.support_email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter support email"
                    startContent={<Mail className="h-4 w-4 text-default-400" />}
                  />
                  <Textarea
                    label="Agency Address"
                    name="agency_address"
                    value={values.agency_address}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter agency address"
                    className="md:col-span-2"
                    minRows={2}
                  />
                </div>
              </CardBody>
            </Card>

            {/* SEO & Meta Information Section */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  SEO & Meta Information
                </h2>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Certificate URL"
                    name="certificate_url"
                    value={values.certificate_url}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter certificate URL"
                    startContent={<Globe className="h-4 w-4 text-default-400" />}
                  />
                  <Input
                    label="OG URL"
                    name="og_url"
                    value={values.og_url}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter OG URL"
                    startContent={<Globe className="h-4 w-4 text-default-400" />}
                  />
                  <Textarea
                    label="Meta Description"
                    name="meta_description"
                    value={values.meta_description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter meta description"
                    className="md:col-span-2"
                    minRows={2}
                  />
                  <Input
                    label="Meta Keywords"
                    name="meta_keywords"
                    value={values.meta_keywords}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter meta keywords (comma separated)"
                    className="md:col-span-2"
                  />
                </div>
              </CardBody>
            </Card>

            {/* Domain Settings Section */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Domain Settings
                </h2>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Subdomain"
                    name="sudomain"
                    value={values.sudomain}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter subdomain"
                  />
                  <Input
                    label="Domain"
                    name="domain"
                    value={values.domain}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter domain"
                  />
                </div>
              </CardBody>
            </Card>

            {/* File Uploads Section */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  File Uploads
                </h2>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Favicon File</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setFaviconFile(file)
                        }
                      }}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-white
                        hover:file:bg-primary/90
                        cursor-pointer"
                    />
                    {faviconFile && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Selected: {faviconFile.name}</p>
                        <img
                          src={URL.createObjectURL(faviconFile)}
                          alt="Favicon preview"
                          className="mt-2 w-16 h-16 object-contain border rounded"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">OG Image File</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setOgImageFile(file)
                        }
                      }}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-white
                        hover:file:bg-primary/90
                        cursor-pointer"
                    />
                    {ogImageFile && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Selected: {ogImageFile.name}</p>
                        <img
                          src={URL.createObjectURL(ogImageFile)}
                          alt="OG Image preview"
                          className="mt-2 w-32 h-32 object-contain border rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                variant="light"
                onPress={() => navigate('/agents')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={isLoading}
                className="min-w-32"
              >
                {isLoading ? <Spinner size="sm" color="white" /> : 'Create Agent'}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  )
}

export default CreateAgent
