import { Accordion, AccordionItem, Button, useDisclosure } from "@heroui/react"
import React, { useEffect, useState } from 'react'
import { BiBadge } from 'react-icons/bi'
import { FaPlayCircle } from 'react-icons/fa'

import FaqSection from '../../components/FaqSection';
import Testimonials from '../../components/Testimonials';
import { Md12Mp } from 'react-icons/md';
import ContentWritingList from '../../components/ContentWritingList';
import { useNavigate } from 'react-router-dom';
import HomePageFlags from '../../components/HomePageFlags';
import CommonConfirmation from '../../components/CommonConfirmation';

import {
    Users,
    BarChart3,
    Globe2,
    Shield,
    CheckCircle2,
    ArrowRight,
    Mail,
    Calendar,
    MessageSquare,
    GitBranch,
    Database,
    Box,
    Download,
    TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { CheckCircle, ArrowRightCircle, Globe, UserCheck, ShieldCheck } from "lucide-react";

const IntroPage = () => {

    // for login 
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const navigate = useNavigate()

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const stats = [
        { value: '85%', label: 'Time Saved', icon: <TrendingUp /> },
        { value: '24/7', label: 'Support', icon: <Globe2 /> },
        { value: '10k+', label: 'Applications', icon: <Database /> },
        { value: '99%', label: 'Success Rate', icon: <CheckCircle2 /> }
    ];

    return (
        <div className='text-dark_primary dark:text-white'>

            {/* <div className="w-full overflow-hidden bg-gray-50">
                <div className="relative min-h-screen bg-white">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 10px 10px, #f0f0f0 2px, transparent 0)',
                            backgroundSize: '40px 40px',
                            opacity: 0.5
                        }}
                    />

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-4 py-2 text-sm rounded-full">
                                    Trusted by 1000+ Visa Consultancy Agencies
                                </Badge>

                                <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 leading-tight">
                                    Transform Your Visa Agency into a Digital Powerhouse
                                </h1>

                                <p className="text-xl text-gray-600 leading-relaxed">
                                    Experience the next generation of visa consultancy management. Streamline applications, automate workflows, and scale your business effortlessly.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-xl text-lg shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:shadow-blue-300">
                                        Start Free Trial <ArrowRight className="ml-2" />
                                    </Button>
                                    <Button  className="border-2 border-blue-200 text-blue-700 hover:bg-blue-50 px-8 py-6 rounded-xl text-lg">
                                        Watch Demo
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-8">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="text-green-500" />
                                        <span className="text-gray-600">No credit card required</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="text-green-500" />
                                        <span className="text-gray-600">Free 14-day trial</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-20 blur-lg" />
                                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                                    <img
                                        src="https://images.pexels.com/photos/196645/pexels-photo-196645.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
                                        alt="Visa Consultancy Dashboard"
                                        className="w-full h-auto"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 max-w-6xl mx-auto px-4 -mt-20">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-lg bg-opacity-90">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            {stats.map((stat, index) => (
                                <div key={index} className="text-center">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
                                        {stat.icon}
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                                    <div className="text-gray-600">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 py-32">
                    <div className="text-center mb-20">
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 px-4 py-2 text-sm rounded-full mb-4">
                            Features
                        </Badge>
                        <h2 className="text-4xl font-bold mb-4">Everything You Need in One Place</h2>
                        <p className="text-xl text-gray-600">Powerful tools designed for modern visa consultancy agencies</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                title: "Smart Document Management",
                                description: "Automated document verification and storage with AI-powered insights",
                                icon: <Box className="w-6 h-6" />,
                                image: "https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg"
                            },
                            {
                                title: "Application Tracking",
                                description: "Real-time visa application status monitoring and updates",
                                icon: <GitBranch className="w-6 h-6" />,
                                image: "https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg"
                            },
                            {
                                title: "Client Portal",
                                description: "Secure client access for document uploads and status checks",
                                icon: <Users className="w-6 h-6" />,
                                image: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg"
                            }
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl"
                            >
                                <div className="absolute inset-0">
                                    <img
                                        src={feature.image}
                                        alt={feature.title}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/0" />
                                </div>

                                <div className="relative p-8 h-96 flex flex-col justify-end">
                                    <div className="mb-4 p-3 bg-white/10 backdrop-blur-lg rounded-lg w-12 h-12 flex items-center justify-center text-white">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-2xl font-semibold text-white mb-2">{feature.title}</h3>
                                    <p className="text-gray-200">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-purple-600 py-32 relative overflow-hidden">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 10px 10px, rgba(255,255,255,0.1) 2px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }} />

                    <div className="max-w-7xl mx-auto px-4 relative">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="text-white space-y-8">
                                <Badge className="bg-white/10 text-white hover:bg-white/20 px-4 py-2 backdrop-blur-lg rounded-full">
                                    Live Demo
                                </Badge>
                                <h2 className="text-4xl font-bold">See TechX CRM in Action</h2>
                                <p className="text-xl text-blue-100">
                                    Watch how TechX CRM streamlines your visa consultancy operations and helps you manage applications effortlessly.
                                </p>
                                <Button className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 rounded-xl text-lg">
                                    Schedule Live Demo <ArrowRight className="ml-2" />
                                </Button>
                            </div>

                            <div className="relative">
                                <div className="absolute -inset-4 bg-white/20 rounded-2xl blur-lg" />
                                <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                                    <img
                                        src="https://images.pexels.com/photos/2115217/pexels-photo-2115217.jpeg"
                                        alt="Platform Demo"
                                        className="w-full h-auto"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-gray-900/0" />
                                    <div className="absolute bottom-0 left-0 right-0 p-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-3 h-3 rounded-full bg-red-500" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                            <div className="w-3 h-3 rounded-full bg-green-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="py-32 bg-white">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="text-center mb-20">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-4 py-2 text-sm rounded-full mb-4">
                                Testimonials
                            </Badge>
                            <h2 className="text-4xl font-bold mb-4">Trusted by Leading Agencies</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[1, 2, 3].map((index) => (
                                <Card key={index} className="bg-white border-0 shadow-xl">
                                    <CardContent className="p-8">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                                            <div>
                                                <div className="font-semibold text-lg">Agency Director</div>
                                                <div className="text-gray-600">Global Visa Services</div>
                                            </div>
                                        </div>
                                        <p className="text-gray-600 leading-relaxed">
                                            "TechX CRM has revolutionized how we handle visa applications. The automation features alone have saved us countless hours."
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative bg-gray-50 py-32 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50" />
                    <div className="relative max-w-7xl mx-auto px-4 text-center">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-4 py-2 text-sm rounded-full mb-8">
                            Get Started Today
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Ready to Transform Your Agency?
                        </h2>
                        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                            Join thousands of successful visa consultants who trust TechX CRM to scale their business.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-xl text-lg shadow-lg shadow-blue-200">
                                Start Free Trial
                            </Button>
                            <Button className="border-2 border-blue-200 text-blue-700 hover:bg-blue-50 px-8 py-6 rounded-xl text-lg">
                                Contact Sales
                            </Button>
                        </div>
                    </div>
                </div>
            </div> */}

<div className="bg-gray-50">
{/* Hero Section */}
<section className="relative overflow-hidden bg-white">
  <div className="container mx-auto px-6 py-16 lg:flex lg:items-center lg:justify-between lg:py-20">
    {/* Text Content */}
    <div className="max-w-2xl">
      <h1 className="text-4xl font-bold text-gray-800 sm:text-5xl">
        Empower Your Visa Consultancy with{" "}
        <span className="text-blue-600">TechX CRM</span>
      </h1>
      <p className="mt-6 text-lg text-gray-600">
        TechX CRM offers an all-in-one solution for managing leads, improving client
        relationships, and growing your business. Whether you're a solo consultant or running
        a team, we've got you covered.
      </p>
      <div className="mt-6 flex gap-x-4">
        <a
          href="#features"
          className="inline-flex items-center justify-center px-6 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg"
        >
          Get Started Now
          <ArrowRightCircle className="ml-2 w-5 h-5" />
        </a>
        <a
          href="#"
          className="inline-flex items-center justify-center px-6 py-3 text-blue-600 border border-blue-600 rounded-lg shadow-lg hover:bg-blue-50"
        >
          Learn More
        </a>
      </div>
    </div>
    {/* Hero Image */}
    <div className="mt-10 lg:mt-0 lg:w-1/2">
      <img
        src="https://images.pexels.com/photos/3184298/pexels-photo-3184298.jpeg?auto=compress&cs=tinysrgb&w=1200"
        alt="CRM Dashboard"
        className="rounded-lg shadow-lg"
      />
    </div>
  </div>
</section>

{/* Features Section */}
<section id="features" className="py-16 bg-gray-50">
  <div className="container mx-auto px-6 text-center">
    <h2 className="text-3xl font-bold text-gray-800 sm:text-4xl">
      Why Choose TechX CRM?
    </h2>
    <p className="mt-4 text-lg text-gray-600">
      Everything you need to take your visa consultancy business to the next level.
    </p>

    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <Globe className="w-10 h-10 text-blue-600 mx-auto" />
        <h3 className="mt-4 text-xl font-semibold text-gray-800">Global Reach</h3>
        <p className="mt-2 text-gray-600">
          Manage clients and leads from around the world with our tailored tools.
        </p>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <UserCheck className="w-10 h-10 text-blue-600 mx-auto" />
        <h3 className="mt-4 text-xl font-semibold text-gray-800">Lead Management</h3>
        <p className="mt-2 text-gray-600">
          Easily track and convert leads into paying customers with detailed analytics.
        </p>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto" />
        <h3 className="mt-4 text-xl font-semibold text-gray-800">Secure Data</h3>
        <p className="mt-2 text-gray-600">
          Your client data is safe with us, ensuring privacy and compliance.
        </p>
      </div>
    </div>
  </div>
</section>

{/* Subscription CTA Section */}
<section className="bg-blue-600 text-white py-16">
  <div className="container mx-auto px-6 text-center">
    <h2 className="text-3xl font-bold sm:text-4xl">
      Ready to Grow Your Business?
    </h2>
    <p className="mt-4 text-lg">
      Choose from our flexible plans and start managing your business with ease.
    </p>
    <div className="mt-6">
      <a
        href="#pricing"
        className="inline-flex items-center justify-center px-6 py-3 text-blue-600 bg-white rounded-lg shadow-lg hover:bg-gray-100"
      >
        View Pricing
        <ArrowRightCircle className="ml-2 w-5 h-5" />
      </a>
    </div>
  </div>
</section>

{/* Testimonials Section */}
<section className="py-16 bg-gray-50">
  <div className="container mx-auto px-6 text-center">
    <h2 className="text-3xl font-bold text-gray-800 sm:text-4xl">
      What Our Customers Say
    </h2>
    <p className="mt-4 text-lg text-gray-600">
      Join thousands of successful agents and consultants who trust TechX CRM.
    </p>
    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <p className="text-gray-600">
          "TechX CRM made managing my leads so much easier. I've seen a 30% increase in
          conversions!"
        </p>
        <p className="mt-4 font-semibold text-gray-800">- John D., Visa Consultant</p>
      </div>
      <div className="p-6 bg-white rounded-lg shadow-md">
        <p className="text-gray-600">
          "The analytics and tools are top-notch. I can’t imagine running my agency without
          it."
        </p>
        <p className="mt-4 font-semibold text-gray-800">- Priya S., Agency Owner</p>
      </div>
      <div className="p-6 bg-white rounded-lg shadow-md">
        <p className="text-gray-600">
          "Highly recommended! TechX CRM has everything I need to manage my business and more."
        </p>
        <p className="mt-4 font-semibold text-gray-800">- Ahmed K., Consultant</p>
      </div>
    </div>
  </div>
</section>
</div>

            {/* services */}


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

            <Testimonials />

            <FaqSection />


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
    )

}

export default IntroPage