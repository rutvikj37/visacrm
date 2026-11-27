import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Button, Spinner } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import ReactQuill from 'react-quill'
import { Input } from 'rsuite'
import 'react-quill/dist/quill.snow.css';


const BasicAboutUs = () => {

  const { commonPostAPICall } = useApiCallUtils()

  const [isLoading, setIsLoading] = useState(false)
  const [aboutUs, setAboutUs] = useState("")
  const [detailedDescription, setDetailedDescription] = useState("")
  const [website, setWebsite] = useState("")

  // find brach office address
  useEffect(() => {
    getBasicAboutUs() 
  }, [])

  const getBasicAboutUs = async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setIsLoading(true)
    const { data, success } = await commonPostAPICall({}, "agent_profile/get_about_us")
    if (success && success == true) {

      if (data) {
        setAboutUs(data?.aboutUs ?? "")
        setDetailedDescription(data?.detailedDescription ?? "")
        setWebsite(data?.website ?? "")
      }
    }
    setIsLoading(false)
  }

  const updateBranchAddressApiCall = async () => {

    const { success } = await commonPostAPICall({
      aboutUs,
      detailedDescription,
      website
    }, "agent_profile/update_basic_profile", true)
    if (success && success == true) {
      getBasicAboutUs({ soft: true })
    }

  }


  return (
    <div className="px-2">
      {isLoading == true ? <div className='flex items-center justify-center my-5'><Spinner /></div> :
        <div className="py-4 w-full space-y-4 ">
          <h3 className="text-lg font-semibold">About Your Agency</h3>
          <p className="text-sm text-gray-600">Please provide a brief description or background about your agency.</p>

          {/* (e.g., When your agency was founded, your mission, and key services) */}
          <div className='space-y-1 my-4'>
            <label className='text-tiny'>When your agency was founded, your mission, and key services</label>
            <Input
              placeholder='e.g., When your agency was founded, your mission, and key services'
              onChange={setAboutUs}
              className='w-full'
              as="textarea" rows={5}
              value={aboutUs}
            />
          </div>
          <div className='space-y-1 my-4'>
            <label className='text-tiny'>Please describe the services you offer and your specialization areas in more detail.</label>
            <ReactQuill
              placeholder=''
              value={detailedDescription}
              onChange={(e) => {
                setDetailedDescription(e)
              }}
              className='h-full placeholder:text-tiny'
            />
            <p className='text-tiny'>e.g. We specialize in providing guidance for students applying to universities in the UK, USA, and Canada. Our services include course selection, visa assistance, scholarship advice, and more.</p>
          </div>
          <div className='space-y-1 my-4'>
            <label className='text-tiny'>Do you have a website? Please provide the URL.</label>
            <Input
              placeholder='e.g., www.youragency.com'
              onChange={setWebsite}
              className='w-full'
              value={website}
            />
          </div>
        </div>}

      <p className='text-tiny text-gray-500'>Please Make sure to press update button after doing changes in above mention fields</p>
      <Button variant='shadow' onPress={updateBranchAddressApiCall} color='primary'>Update</Button>
    </div>
  )
}

export default BasicAboutUs