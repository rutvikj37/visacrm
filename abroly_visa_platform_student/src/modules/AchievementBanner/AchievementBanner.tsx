import useApiCallUtils from '@/hooks/useApiCallUtils'
import { ModalContent, useDisclosure, Modal, ModalHeader, ModalBody, Input, Button } from '@nextui-org/react'
import { LucideMegaphone } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { getAgentUuid } from '@/utils/config'
import { phoneInputProps, phoneOnChange } from "@/utils/phone";

/** Side banners for a page — only campaigns whose start/end window includes now. */
const AchievementBanner = ({ target_type }) => {
    const { commonGetAPICalls, commonPostPublicAPICall } = useApiCallUtils()
    const [banners, setBanners] = useState([])
    const { isOpen: isOpenInquieryAdd, onOpenChange: onOpenChangeInquieryAdd } = useDisclosure();
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone_number: "",
        banner_id: "",
        title: ""
    });

    const findBanners = useCallback(async () => {
        if (document.hidden) return;
        const { data, success } = await commonGetAPICalls(`/side_banner/student/achievement/${target_type}/${getAgentUuid()}`)
        if (success) {
            const now = Date.now();
            const live = (data || []).filter((b: any) => {
                const start = new Date(b.start_date).getTime();
                const end = new Date(b.end_date).getTime();
                return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
            });
            setBanners(live);
        }
    }, [target_type]);

    useEffect(() => {
        findBanners();
        const t = setInterval(findBanners, 60000);
        return () => clearInterval(t);
    }, [findBanners]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const submitApiCall = async () => {
        const { success } = await commonPostPublicAPICall({ ...form }, "/side_banner/student/add_interest", true)
        if (success) {
            onOpenChangeInquieryAdd()
            setForm({ name: "", email: "", phone_number: "", banner_id: "", title: "" })
        }
    }

    if (!banners?.length) return null;

    return (
        <div className='w-full flex flex-wrap justify-center gap-4 p-4'>
            {banners?.sort((a, b) => a.position - b.position)?.map((item: any, index: number) => (
                <div
                    key={item?.uuid || index}
                    onClick={() => {
                        setForm({
                            name: "",
                            email: "",
                            phone_number: "",
                            banner_id: item?.uuid,
                            title: item?.campaign_title
                        })
                        onOpenChangeInquieryAdd()
                    }}
                    className="flex flex-col cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxWidth: '300px' }}
                >
                    {item?.access_image ? (
                        <img
                            src={item?.access_image}
                            alt={item?.campaign_title}
                            className="w-full h-auto rounded-md shadow-sm"
                        />
                    ) : (
                        <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 rounded-md">
                            <div className="text-center">
                                <LucideMegaphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">No Image</p>
                            </div>
                        </div>
                    )}
                    {item?.campaign_title && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            {item?.campaign_title}
                        </p>
                    )}
                </div>
            ))}

            <Modal
                isOpen={isOpenInquieryAdd}
                onOpenChange={onOpenChangeInquieryAdd}
                scrollBehavior="inside"
                backdrop='blur'
                size='3xl'
                placement="center"
            >
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Submit Your Interest - {form?.title}
                            </ModalHeader>
                            <ModalBody>
                                <form onSubmit={(e) => {
                                    e.preventDefault()
                                    submitApiCall()
                                }} className="space-y-4 mb-8">
                                    <Input type="email" label="Email" name="email" value={form.email} onChange={handleChange} required />
                                    <Input type="text" name="name" label="Name" value={form.name} onChange={handleChange} required />
                                    <Input type="tel" {...phoneInputProps} name="phone_number" label="Phone Number" value={form.phone_number} onChange={phoneOnChange(handleChange)} required />
                                    <Button type="submit" variant='shadow' color='primary'>Submit</Button>
                                </form>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    )
}

export default AchievementBanner
