import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Formik } from 'formik'
import * as Yup from 'yup'
import {
  Button,
  Input,
  Textarea,
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
  ArrowLeft,
  Calendar
} from 'lucide-react'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { phoneInputProps, phoneOnChange } from "@/utils/phone";

const BaseUrl = import.meta.env.VITE_API_BASE_URL as string

const editAgentValidation = Yup.object().shape({
  phone_number: Yup.string()
    .matches(/^[0-9]{10}$/, "Please Provide a Valid Phone Number (10 digits)")
    .nullable(),
  country_code: Yup.string()
    .matches(/^\+\d+$/, "Please Provide a Valid Country Code (e.g., +91)")
    .nullable(),
  user_name: Yup.string()
    .min(3, "User Name must be at least 3 characters")
    .nullable(),
  email: Yup.string()
    .email("Please Provide a Valid Email")
    .nullable(),
  primary_color: Yup.string()
    .matches(/^#[0-9A-Fa-f]{6}$/, "Please Provide a Valid Hex Color (e.g., #0f5bd8)")
    .nullable(),
  primary_foreground_color: Yup.string()
    .matches(/^#[0-9A-Fa-f]{6}$/, "Please Provide a Valid Hex Color (e.g., #ffffff)")
    .nullable(),
  dark_primary_color: Yup.string()
    .matches(/^#[0-9A-Fa-f]{6}$/, "Please Provide a Valid Hex Color (e.g., #D8C4B6)")
    .nullable(),
})

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-default-200 bg-content1 p-4 space-y-4">
    <h2 className="text-base font-semibold flex items-center gap-2 text-default-700">
      <Icon className="h-4 w-4" />
      {title}
    </h2>
    {children}
  </section>
)

const EditAgent = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { commonPostAPICallWithFile, commonGetAPICalls } = useApiCallUtils()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)
  const [existingFavicon, setExistingFavicon] = useState<string | null>(null)
  const [existingOgImage, setExistingOgImage] = useState<string | null>(null)
  const [agentData, setAgentData] = useState<any>(null)

  const getImageUrl = (filename: string | null) => {
    if (!filename) return null
    const baseUrlWithoutApi = BaseUrl?.replace(/\/api$/, '') || BaseUrl
    return `${baseUrlWithoutApi}/profiles/${filename}`
  }

  useEffect(() => {
    fetchAgentDetails()
  }, [id])

  const fetchAgentDetails = async () => {
    if (!id) return

    setIsFetching(true)
    try {
      const { data, success } = await commonGetAPICalls(`/agent/get_account_details_by_id?uuid=${id}`)
      
      if (!success || !data) {
        const retryResponse = await commonGetAPICalls(`/agent/get_account_details_by_id?id=${id}`)
        if (retryResponse?.success && retryResponse?.data) {
          setAgentData(retryResponse.data)
          populateForm(retryResponse.data)
        }
      } else {
        setAgentData(data)
        populateForm(data)
      }
    } catch (error) {
      console.error('Error fetching agent details:', error)
    } finally {
      setIsFetching(false)
    }
  }

  const populateForm = (data: any) => {
    if (data?.favicon_url) {
      setExistingFavicon(data.favicon_url)
    }
    if (data?.og_image) {
      setExistingOgImage(data.og_image)
    }
  }

  const handleSubmit = async (values: any) => {
    if (!id) return

    setIsLoading(true)

    try {
      const formData = new FormData()

      formData.append('uuid', id)
      
      Object.keys(values).forEach((key) => {
        if (values[key] !== '' && values[key] !== null && values[key] !== undefined) {
          const backendKey = key === 'user_name' ? 'username' : key
          
          if (key === 'expires_at' && values[key]) {
            const dateValue = new Date(values[key]).toISOString()
            formData.append(backendKey, dateValue)
          } else {
            formData.append(backendKey, values[key])
          }
        }
      })

      if (faviconFile) {
        formData.append('favicon_file', faviconFile)
      } else if (existingFavicon && values.favicon_url !== existingFavicon) {
        formData.append('favicon_url', existingFavicon)
      }

      if (ogImageFile) {
        formData.append('og_image_file', ogImageFile)
      } else if (existingOgImage && values.og_image !== existingOgImage) {
        formData.append('og_image', existingOgImage)
      }

      const { success } = await commonPostAPICallWithFile(
        formData,
        'agent/update_account',
        true
      )

      if (success) {
        navigate('/agents')
      }
    } catch (error) {
      console.error('Error updating agent:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!agentData) {
    return (
      <div className="flex flex-col gap-4 max-w-6xl">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            onPress={() => navigate('/agents')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Agent not found</h1>
            <p className="text-sm text-default-500">The agent you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    )
  }

  const formInitialValues = {
    phone_number: agentData?.phone_number || '',
    country_code: agentData?.country_code || '+91',
    user_name: agentData?.username || agentData?.user_name || '',
    email: agentData?.email || '',
    primary_color: agentData?.primary_color || '#0f5bd8',
    primary_foreground_color: agentData?.primary_foreground_color || '#ffffff',
    dark_primary_color: agentData?.dark_primary_color || '#D8C4B6',
    app_name: agentData?.app_name || '',
    support_number: agentData?.support_number || '',
    support_email: agentData?.support_email || '',
    agency_address: agentData?.agency_address || '',
    certificate_url: agentData?.certificate_url || '',
    favicon_url: agentData?.favicon_url || '',
    meta_description: agentData?.meta_description || '',
    meta_keywords: agentData?.meta_keywords || '',
    og_image: agentData?.og_image || '',
    og_url: agentData?.og_url || '',
    sudomain: agentData?.sudomain || '',
    domain: agentData?.domain || '',
    expires_at: agentData?.expires_at 
      ? new Date(agentData.expires_at).toISOString().split('T')[0] 
      : ''
  }

  return (
    <div className="max-w-6xl flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          isIconOnly
          variant="light"
          onPress={() => navigate('/agents')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit agent</h1>
          <p className="text-sm text-default-500">Update account, branding, support and portal settings.</p>
        </div>
      </div>

      <Formik
        initialValues={formInitialValues}
        validationSchema={editAgentValidation}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit
        }) => (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Section icon={User} title="Basic information">
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
                />
                <Input
                  label="Expires At"
                  name="expires_at"
                  type="date"
                  value={values.expires_at}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Select expiry date"
                  startContent={<Calendar className="h-4 w-4 text-default-400" />}
                />
              </div>
            </Section>

            <Section icon={Palette} title="Branding & colors">
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
            </Section>

            <Section icon={Headphones} title="Support information">
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
            </Section>

            <Section icon={Search} title="SEO & meta">
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
            </Section>

            <Section icon={Globe} title="Domain settings">
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
            </Section>

            <Section icon={ImageIcon} title="File uploads">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Favicon File</label>
                  {existingFavicon && !faviconFile && (
                    <div className="mb-2">
                      <p className="text-xs text-default-500 mb-1">Current favicon:</p>
                      <img
                        src={getImageUrl(existingFavicon) || ''}
                        alt="Current favicon"
                        className="w-12 h-12 object-contain border rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
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
                      <p className="text-sm text-gray-600">New favicon: {faviconFile.name}</p>
                      <img
                        src={URL.createObjectURL(faviconFile)}
                        alt="New favicon preview"
                        className="mt-2 w-16 h-16 object-contain border rounded"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">OG Image File</label>
                  {existingOgImage && !ogImageFile && (
                    <div className="mb-2">
                      <p className="text-xs text-default-500 mb-1">Current OG image:</p>
                      <img
                        src={getImageUrl(existingOgImage) || ''}
                        alt="Current OG image"
                        className="w-24 h-24 object-contain border rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
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
                      <p className="text-sm text-gray-600">New OG image: {ogImageFile.name}</p>
                      <img
                        src={URL.createObjectURL(ogImageFile)}
                        alt="New OG image preview"
                        className="mt-2 w-32 h-32 object-contain border rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Section>

            <div className="flex justify-end gap-3">
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
                {isLoading ? <Spinner size="sm" color="white" /> : 'Update Agent'}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  )
}

export default EditAgent
