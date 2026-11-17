import useApiCallUtils from '@/hooks/useApiCallUtils'
import { ModalContent, useDisclosure, Modal, ModalHeader, ModalBody, Input, Button } from '@nextui-org/react'
import { ChevronLeft, ChevronRight, LucideMegaphone } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { getAgentUuid } from '@/utils/config'
import { phoneInputProps, phoneOnChange } from "@/utils/phone";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/autoplay';

/** Active campaign banners for a page — hero slider when live; hidden when none. */
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
        const agencyUuid = getAgentUuid();
        if (!agencyUuid || !target_type) return;
        const { data, success } = await commonGetAPICalls(`/side_banner/student/achievement/${target_type}/${agencyUuid}`)
        if (success) {
            const now = Date.now();
            const live = (data || []).filter((b: any) => {
                const start = new Date(b.start_date).getTime();
                const end = new Date(b.end_date).getTime();
                return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
            });
            // Prefer API order (createdAt); fall back to createdAt / position
            setBanners(
                live.sort((a: any, b: any) => {
                    const ac = new Date(a.createdAt || 0).getTime();
                    const bc = new Date(b.createdAt || 0).getTime();
                    if (ac !== bc) return ac - bc;
                    return Number(a.position || 0) - Number(b.position || 0);
                }),
            );
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

    const openInterest = (item: any) => {
        setForm({
            name: "",
            email: "",
            phone_number: "",
            banner_id: item?.uuid,
            title: item?.campaign_title
        });
        onOpenChangeInquieryAdd();
    };

    const submitApiCall = async () => {
        const { success } = await commonPostPublicAPICall({ ...form }, "/side_banner/student/add_interest", true)
        if (success) {
            onOpenChangeInquieryAdd()
            setForm({ name: "", email: "", phone_number: "", banner_id: "", title: "" })
        }
    }

    if (!banners?.length) return null;

    const slide = (item: any, index: number) => (
        <button
            type="button"
            key={item?.uuid || index}
            onClick={() => openInterest(item)}
            className="relative block w-full overflow-hidden rounded-xl bg-default-100 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={item?.campaign_title ? `Learn more about ${item.campaign_title}` : "Banner campaign"}
        >
            {item?.access_image ? (
                <img
                    src={item.access_image}
                    alt={item?.campaign_title || "Campaign banner"}
                    className="w-full max-h-[280px] sm:max-h-[360px] object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
                />
            ) : (
                <div className="w-full h-48 sm:h-56 flex items-center justify-center text-default-400">
                    <div className="text-center">
                        <LucideMegaphone className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{item?.campaign_title || "Campaign"}</p>
                    </div>
                </div>
            )}
            {item?.campaign_title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 py-3">
                    <p className="text-sm sm:text-base font-medium text-white truncate">{item.campaign_title}</p>
                </div>
            )}
        </button>
    );

    return (
        <section className="w-full" aria-label="Featured campaigns">
            {banners.length === 1 ? (
                slide(banners[0], 0)
            ) : (
                <div className="relative group/hero">
                    <Swiper
                        modules={[Autoplay, Navigation, Pagination]}
                        spaceBetween={0}
                        slidesPerView={1}
                        loop={banners.length > 1}
                        autoplay={{ delay: 5000, disableOnInteraction: false }}
                        pagination={{ clickable: true }}
                        navigation={{
                            prevEl: ".banner-hero-prev",
                            nextEl: ".banner-hero-next",
                        }}
                        className="rounded-xl overflow-hidden [&_.swiper-pagination-bullet-active]:bg-primary"
                    >
                        {banners.map((item: any, index: number) => (
                            <SwiperSlide key={item?.uuid || index}>
                                {slide(item, index)}
                            </SwiperSlide>
                        ))}
                    </Swiper>
                    <button
                        type="button"
                        className="banner-hero-prev absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 text-white p-1.5 opacity-0 group-hover/hero:opacity-100 transition-opacity"
                        aria-label="Previous banner"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        className="banner-hero-next absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 text-white p-1.5 opacity-0 group-hover/hero:opacity-100 transition-opacity"
                        aria-label="Next banner"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

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
        </section>
    )
}

export default AchievementBanner
