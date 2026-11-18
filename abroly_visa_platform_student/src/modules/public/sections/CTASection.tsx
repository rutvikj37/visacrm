import { Button } from '@nextui-org/react'
import React from 'react'
import { LogInIcon } from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAppName, getMetaDescription, isTravelFocus } from '@/utils/config'

const CTASection = () => {
    const navigate = useNavigate()
    const agencyName = getAppName() || 'your agency'
    const blurb = getMetaDescription() || (isTravelFocus() ? `Plan your next holiday or business trip with ${agencyName} - we handle the visa.` : `Take the next step toward studying abroad with ${agencyName}.`)

    return (
        <section className='bg-gradient-to-r from-primary to-sidebar-primary py-16 my-20'>
            <div className="container mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-3xl mx-auto"
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Ready to Start Your Journey?
                    </h2>
                    <p className="text-xl text-white/90 mb-8">
                        {blurb}
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center">
                        <Button
                            size="lg"
                            color="default"
                            variant="solid"
                            className="text-lg px-8 bg-white text-primary hover:bg-gray-100"
                            onPress={() => navigate('/login')}
                            endContent={<LogInIcon />}
                        >
                            {isTravelFocus() ? "Client login" : "Student login"}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

export default CTASection

