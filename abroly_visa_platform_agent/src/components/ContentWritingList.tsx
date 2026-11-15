import { Button } from "@heroui/react"
import React, { useEffect, useState } from 'react' 
import { getFromLocal } from '../utils/localstorage'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import useApiCallUtils from '@/hooks/useApiCallUtils'

const ContentWritingList = ({onOpenChange=()=>{},setFormOptions={},formOptions={}}:any) => {

    const {commonPublicGetApiCalls} = useApiCallUtils()

    const [contentWritingServiceList, setContentWritingServiceList] = useState([])


    const tokenData = getFromLocal("token")

    const token = useSelector((state: any) => state.login.token) || tokenData;

    useEffect(() => {
        initData()
    }, [])

    const initData = async () => {

        const { data, success } = await commonPublicGetApiCalls("/content_writing/list")
        if (success && success == true) {
            setContentWritingServiceList(data)
        }
    }

    const navigate = useNavigate()

    return (
        <div>
            <section className='flex flex-row items-center flex-wrap gap-5 justify-center p-3' >

                {contentWritingServiceList && contentWritingServiceList.map((item: any) => (
                    <div className="size-full lg:size-1/4 shadow-sm shadow-orange-500 rounded-lg p-5 flex flex-col space-y-2">
                        <div className="flex items-center gap-x-4 mb-3">
                            <div className="shrink-0">
                                <h3 className="block text-lg font-semibold text-gray-800 dark:text-white">{item?.name}</h3>
                            </div>
                        </div>
                        <p className="text-gray-600 dark:text-neutral-400">{item?.description}</p>
                        <Button 
                        as={"a"}
                        onPress={()=>{
                            token && token !="" ? setFormOptions({
                                ...formOptions,
                                content_requirement:item?.name
                            })
                            
                             : onOpenChange()
                        }}
                        href='#form_of_contact'
                        color='primary' variant='flat' className='w-fit'>Know More</Button>
                    </div>
                ))}
            </section>
        </div>
    )
}

export default ContentWritingList