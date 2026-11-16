// import { Button, Link, Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from '@heroui/react';
// import React from 'react'
// import { Route, Routes, useNavigate } from 'react-router-dom';
// import { PublicRoutes } from '../../routes/AuthRoutes';
// import ThemeToggle from '../../components/ThemeToggle';
// import Footer from '../../components/Footer';



// const PublicDashboard = () => {
//     const [isMenuOpen, setIsMenuOpen] = React.useState(false);

//     const navigate = useNavigate()
//     const SideMenu = [
//         {
//             title: "Home",
//             to: "/",
//         },
//         {
//             title: "Pricing",
//             to: "/packages",
//         },
//         {
//             title: "FAQs",
//             to: "/faqs",
//         },
//         {
//             title: "Contact",
//             to: "/contact_us",
//         },
//     ]


//     return (
//         <div>
//             <Navbar
//                 onMenuOpenChange={setIsMenuOpen}
//                 isMenuOpen={isMenuOpen}
//             >
//                 <NavbarContent>
//                     <NavbarMenuToggle
//                         className="sm:hidden"
//                     />
//                     <NavbarBrand>
//                         {/* <AcmeLogo /> */}
//                         <section
//                             onClick={() => navigate("/")}
//                             // className={`bg-[url('${logo}')] bg-cover bg-center w-12 h-12`}
//                             // style={{
//                             //     // backgroundImage: `url(${logo})`,
//                             //     backgroundSize: 'cover',
//                             //     backgroundPosition: 'center',
//                             //     width: '10rem', 
//                             //     height: '2.5rem',
//                             //     cursor: 'pointer',
//                             //     backgroundColor:"#000000",
//                             //     borderRadius:20 
//                             //   }}
//                         >
//                             <p>TechX CRM</p>
//                         </section>
//                     </NavbarBrand>
//                 </NavbarContent>

//                 <NavbarContent className="hidden sm:flex gap-4" justify="end">
//                     {SideMenu.map((item, index) => (
//                         <NavbarMenuItem key={`${item}-${index}`}>
//                             <Link
//                                 className='cursor-pointer text-primary'
//                                 onClick={() => {
//                                     navigate(item.to)
//                                     setIsMenuOpen(false)
//                                 }}
//                                 >
//                                 {item.title}
//                             </Link>
//                         </NavbarMenuItem>
//                     ))}
//                 </NavbarContent>
//                 <NavbarContent justify="end">
//                     <NavbarItem className='flex flex-row gap-2 items-center justify-center'>
//                         {/* <ThemeToggle /> */}
//                         <Button onPress={() => {
//                             navigate("/login")
//                         }}
//                             // color="warning" 
//                             // className='border-primary'
//                             variant='shadow'
//                             color='primary'
//                             >Login</Button>

//                     </NavbarItem>

//                 </NavbarContent>
//                 <NavbarMenu>
//                     {SideMenu.map((item, index) => (
//                         <NavbarMenuItem key={`${item}-${index}`}>
//                             <Link
//                                 className="w-full"
//                                 // to={item.to}
//                                 onPress={() => {
//                                     navigate(item.to)
//                                     setIsMenuOpen(!isMenuOpen)
//                                 }}
//                             >
//                                 {item.title}
//                             </Link>
//                         </NavbarMenuItem>
//                     ))}
//                 </NavbarMenu>
//             </Navbar>
//             <section className={`flex-grow overflow-auto `}>
//                 <Routes>
//                     {
//                         PublicRoutes.map(
//                             (item: any) => <Route key={item.path} path={item.path} element={<item.element />} />)
//                     }
//                 </Routes>

//                 {/* <Footer footerLinks={adminLinks} /> */}
//                 <Footer />

//             </section>
//         </div>
//     )
// }

// export default PublicDashboard
import {
    Button,
    Link,
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenu,
    NavbarMenuItem,
    NavbarMenuToggle,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Spinner
} from "@heroui/react";
import { motion } from 'framer-motion';
import {
    Building2,
    ChevronDown,
    BarChart2,
    Users,
    FileText,
    Phone,
    HelpCircle,
    LogIn
} from 'lucide-react';
import React, { Suspense } from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { PublicRoutes } from '../../routes/AuthRoutes';
import Footer from '../../components/Footer';
import aborlyIcon from "../../assets/logo.png"

import { publicAsset } from "@/utils/appBase";
const PublicDashboard = () => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const SideMenu = [
        {
            title: "Home",
            to: "/",
            icon: <Building2 size={18} />
        },
        // {
        //     title: "Solutions",
        //     items: [
        //         { title: "Visa Processing", description: "Streamline visa applications" },
        //         { title: "Client Management", description: "Manage client relationships" },
        //         { title: "Document Handling", description: "Secure document management" },
        //         { title: "Analytics", description: "Business insights dashboard" }
        //     ],
        //     icon: <BarChart2 size={18} />
        // },
        // {
        //     title: "Pricing",
        //     to: "/packages",
        //     icon: <FileText size={18} />
        // },
        {
            title: "FAQs",
            to: "/faqs",
            icon: <HelpCircle size={18} />
        },
        {
            title: "Contact",
            to: "/contact_us",
            icon: <Phone size={18} />
        },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <div>
            <Navbar
                onMenuOpenChange={setIsMenuOpen}
                isMenuOpen={isMenuOpen}
                maxWidth="xl"
                className="border-b"
                height="4rem"
            >
                <NavbarContent>
                    <NavbarMenuToggle
                        className="sm:hidden"
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                    />
                    <NavbarBrand>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => navigate("/")}
                        >
                            {/* <Building2 className="text-primary h-6 w-6" /> */}
                            {/* <span className="font-bold text-inherit text-xl">TechX CRM</span> */}
                            <img src={publicAsset("techx-logo.png")} alt="TechX CRM" className="h-9 w-auto dark:hidden" />
                            <img src={publicAsset("techx-logo-dark.png")} alt="TechX CRM" className="h-9 w-auto hidden dark:block" />
                        </motion.div>
                    </NavbarBrand>
                </NavbarContent>

                <NavbarContent className="hidden sm:flex gap-4" justify="center">
                    {SideMenu.map((item, index) => (

                        <NavbarItem key={index}>
                            <Button
                                className={`${isActive(item?.to) ? 'text-primary' : 'text-default-600'}`}
                                variant="light"
                                disableRipple
                                startContent={item?.icon}
                                onPress={() => navigate(item?.to)}
                            >
                                {item?.title}
                            </Button>
                        </NavbarItem>
                    ))}
                </NavbarContent>

                <NavbarContent justify="end">
                    <NavbarItem>
                        <Button
                            onPress={() => navigate("/login")}
                            color="primary"
                            variant="shadow"
                            startContent={<LogIn size={18} />}
                            className="font-medium"
                        >
                            Login
                        </Button>
                    </NavbarItem>
                </NavbarContent>

                <NavbarMenu className="pt-6">
                    {SideMenu.map((item, index) => (
                        <NavbarMenuItem key={`${item}-${index}`}>
                            <Link
                                className={`w-full ${isActive(item.to) ? 'text-primary' : 'text-default-700'}`}
                                size="lg"
                                onPress={() => {
                                    navigate(item.to);
                                    setIsMenuOpen(false);
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    {item.icon}
                                    {item.title}
                                </div>
                            </Link>
                        </NavbarMenuItem>
                    ))}
                </NavbarMenu>
            </Navbar>

            <section className="flex-grow overflow-auto">
                <Suspense fallback={<div className="min-h-[40vh] w-full" aria-busy="true" aria-label="Loading page" />}>
                    <Routes>
                        {PublicRoutes.map((item: any) => (
                            <Route key={item.path} path={item.path} element={<item.element />} />
                        ))}
                    </Routes>
                </Suspense>
                <Footer />
            </section>
        </div>
    );
};

export default PublicDashboard;