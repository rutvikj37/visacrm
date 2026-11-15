import { Button } from '@nextui-org/react'
import React from 'react'
import { FaPassport, FaUniversity, FaUserGraduate } from 'react-icons/fa'
import { LogInIcon } from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AgencyLogo } from '@/components/AgencyBrand'
import { getAppName, getMetaDescription } from '@/utils/config'

const HeroSection = () => {
    const navigate = useNavigate()
    const agencyName = getAppName() || "your agency"
    const tagline = getMetaDescription() || `Study abroad with ${agencyName}. Expert counselling, visa guidance and end-to-end support.`

    const features = [
        {
            icon: <FaUniversity className="text-2xl" />,
            title: "University Admission",
            desc: "Guidance for universities that fit your goals"
        },
        {
            icon: <FaPassport className="text-2xl" />,
            title: "Visa Support",
            desc: "Document checklist and application tracking"
        },
        {
            icon: <FaUserGraduate className="text-2xl" />,
            title: "Student Portal",
            desc: "Upload documents, pay fees and follow your case"
        }
    ];

    const blobVariants = {
        blob1: {
            initial: { x: 0, y: 0, scale: 1 },
            animate: {
                x: [0, 100, -100, 0],
                y: [0, -100, 100, 0],
                scale: [1, 1.2, 0.8, 1],
                transition: { duration: 20, repeat: Infinity, ease: "easeInOut" }
            }
        },
        blob2: {
            initial: { x: 0, y: 0, scale: 1 },
            animate: {
                x: [0, -150, 150, 0],
                y: [0, 100, -100, 0],
                scale: [1, 1.3, 0.9, 1],
                transition: { duration: 25, repeat: Infinity, ease: "easeInOut" }
            }
        },
        blob3: {
            initial: { x: 0, y: 0, scale: 1 },
            animate: {
                x: [0, 150, -150, 0],
                y: [0, 150, -150, 0],
                scale: [1, 1.1, 0.9, 1],
                transition: { duration: 30, repeat: Infinity, ease: "easeInOut" }
            }
        },
    };

    return (
        <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-primary/10 flex items-center justify-center">
            <div className="absolute inset-0">
                <motion.div variants={blobVariants.blob1} initial="initial" animate="animate"
                    className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full filter blur-xl opacity-60" />
                <motion.div variants={blobVariants.blob2} initial="initial" animate="animate"
                    className="absolute top-0 -right-4 w-72 h-72 bg-primary/15 rounded-full filter blur-xl opacity-60" />
                <motion.div variants={blobVariants.blob3} initial="initial" animate="animate"
                    className="absolute -bottom-8 left-20 w-72 h-72 bg-primary/25 rounded-full filter blur-xl opacity-50" />
            </div>

            <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 flex flex-col items-center">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8 text-start"
                    >
                        <div className="inline-flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-full">
                            <AgencyLogo size={28} />
                            <span className="font-semibold text-primary">{agencyName}</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                            Study abroad with
                            <span className="bg-primary bg-clip-text text-transparent"> {agencyName}</span>
                        </h1>

                        <p className="text-base md:text-lg text-default-600 max-w-xl">{tagline}</p>

                        <div className="flex flex-wrap gap-4 justify-start">
                            <Button
                                size="lg"
                                color="primary"
                                variant="shadow"
                                className="text-lg px-8"
                                onPress={() => navigate('/login')}
                                endContent={<LogInIcon />}
                            >
                                Student login
                            </Button>
                            <Button
                                size="lg"
                                variant="bordered"
                                className="text-gray-800 border-primary text-lg px-8"
                                as={"a"}
                                href='#services'
                            >
                                Explore more
                            </Button>
                        </div>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-4 pt-8">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="bg-gray/10 backdrop-blur-sm rounded-xl p-4 border border-gray-200"
                            >
                                <div className="text-primary mb-2">{feature.icon}</div>
                                <h3 className="font-semibold text-sidebar-primary">{feature.title}</h3>
                                <p className="text-sm text-gray-500">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeroSection
