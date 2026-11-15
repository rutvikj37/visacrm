import { Button, Link, Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Spinner } from '@nextui-org/react';
import React, { Suspense } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom';
import { PublicRoutes } from '../../routes/AuthRoutes';
import ThemeToggle from '../../components/ThemeToggle';
import Footer from '../../components/Footer';
import aborlyIcon from "../../assets/logo.png"

const PublicDashboard = () => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const navigate = useNavigate()
    const SideMenu = [
    ]
    return (
        <div>
            <Navbar
                onMenuOpenChange={setIsMenuOpen}
                isMenuOpen={isMenuOpen}
            >
                <NavbarContent>
                    <NavbarMenuToggle
                        className="sm:hidden"
                    />
                    <NavbarBrand>
                        {/* <AcmeLogo /> */}
                        <section
                            className='cursor-pointer'
                            onClick={() => navigate("/")}
                        // className={`bg-[url('${logo}')] bg-cover bg-center w-12 h-12`}
                        // style={{
                        //     // backgroundImage: `url(${logo})`,
                        //     backgroundSize: 'cover',
                        //     backgroundPosition: 'center',
                        //     width: '10rem', 
                        //     height: '2.5rem',
                        //     cursor: 'pointer',
                        //     backgroundColor:"#000000",
                        //     borderRadius:20 
                        //   }}
                        >
                           <img src="/techx-logo.png" alt="TechX CRM" className="h-9 w-auto dark:hidden" />
                           <img src="/techx-logo-dark.png" alt="TechX CRM" className="h-9 w-auto hidden dark:block" />
                        </section>
                    </NavbarBrand>
                </NavbarContent>

                <NavbarContent className="hidden sm:flex gap-4" justify="end">
                    {SideMenu.map((item, index) => (
                        <NavbarMenuItem key={`${item}-${index}`}>
                            <Link
                                className='cursor-pointer text-primary'
                                onClick={() => {
                                    navigate(item.to)
                                    setIsMenuOpen(false)
                                }}
                            >
                                {item.title}
                            </Link>
                        </NavbarMenuItem>
                    ))}
                </NavbarContent>
                <NavbarContent justify="end">
                    <NavbarItem className='flex flex-row gap-2 items-center justify-center'>
                        {/* <ThemeToggle /> */}
                        <Button onPress={() => {
                            navigate("/login")
                        }}
                            // color="warning" 
                            className='bg-sidebar-primary'
                            // variant='solid'
                            color='primary'
                        >Login</Button>

                    </NavbarItem>

                </NavbarContent>
                <NavbarMenu>
                    {SideMenu.map((item, index) => (
                        <NavbarMenuItem key={`${item}-${index}`}>
                            <Link
                                className="w-full"
                                // to={item.to}
                                onPress={() => {
                                    navigate(item.to)
                                    setIsMenuOpen(!isMenuOpen)
                                }}
                            >
                                {item.title}
                            </Link>
                        </NavbarMenuItem>
                    ))}
                </NavbarMenu>
            </Navbar>
            <section className={`flex-grow overflow-auto `}>
                <Suspense fallback={<div className="min-h-[40vh] w-full" aria-busy="true" aria-label="Loading page" />}>
                    <Routes>
                        {
                            PublicRoutes.map(
                                (item: any) => <Route key={item.path} path={item.path} element={<item.element />} />)
                        }
                    </Routes>
                </Suspense>
                {/* <Footer footerLinks={adminLinks} /> */}
                <Footer />

            </section>
        </div>
    )
}

export default PublicDashboard