import { Button, Link, Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Spinner } from '@nextui-org/react';
import { motion } from 'framer-motion';
import { HiHome, HiPhone, HiOutlineMenuAlt4 } from 'react-icons/hi';
import ThemeToggle from '../../components/ThemeToggle';
import { Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PublicRoutes } from '@/routes/AuthRoutes';
import Footer from '@/components/Footer';
import { GraduationCap, LogIn, MessageCircleQuestion } from 'lucide-react';
import { getAppName, isPortalEnabled } from '@/utils/config'
import { AgencyLogo } from '@/components/AgencyBrand'

const PublicDashboard = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    // client portal pages switched off: only the login page is here, so no portal menu and the brand leads to the agency page
    const portalOn = isPortalEnabled();
    const [logoIsWordmark, setLogoIsWordmark] = useState(false);

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const menuItems = !portalOn ? [] : [
        {
            title: "Home",
            to: "/",
            icon: <HiHome className="text-xl" />
        },
        {
            title: "FAQs",
            to: "/faq",
            icon: <MessageCircleQuestion className="text-xl" />
        },
        {
            title: "Contact",
            to: "/contact_us",
            icon: <HiPhone className="text-xl" />
        },
    ];

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar
                onMenuOpenChange={setIsMenuOpen}
                isMenuOpen={isMenuOpen}
                className={
                    `transition-all duration-300 ${isScrolled ? 'shadow-lg backdrop-blur-lg bg-background/70' : ''}
                    ${isScrolled ? "h-14" : "h-16"}
                    `}
                maxWidth="xl"
            >
                <NavbarContent>
                    {portalOn && (
                        <NavbarMenuToggle
                            icon={<HiOutlineMenuAlt4 className="text-2xl" />}
                            className="sm:hidden"
                        />
                    )}
                    <NavbarBrand>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => (portalOn ? navigate("/") : window.location.assign("/agency/"))}
                            className="flex items-center gap-2 cursor-pointer min-w-0"
                        >
                            <AgencyLogo size={40} wide onShape={setLogoIsWordmark} />
                            {!logoIsWordmark && (
                                <span className="font-bold text-lg text-primary truncate max-w-[160px] sm:max-w-none">
                                    {getAppName() || "Student portal"}
                                </span>
                            )}
                        </motion.div>
                    </NavbarBrand>
                </NavbarContent>

                <NavbarContent className="hidden sm:flex gap-3" justify="center">
                    {menuItems.map((item, index) => {
                        const isActive = location.pathname === item.to;
                        return (
                            <NavbarItem key={`${item.title}-${index}`}>
                                <motion.div
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    <Button
                                        className={`min-w-[120px] ${isActive
                                            ? 'bg-primary text-white'
                                            : 'bg-default text-default-600 hover:bg-default-200'
                                            }`}
                                        variant={isActive ? "solid" : "flat"}
                                        onPress={() => navigate(item.to)}
                                        startContent={item.icon}
                                    >
                                        {item.title}
                                    </Button>
                                </motion.div>
                            </NavbarItem>
                        );
                    })}
                </NavbarContent>

                <NavbarContent justify="end">
                    <NavbarItem className="flex gap-3 items-center">
                        <motion.div
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {portalOn ? (
                                <Button
                                    color="primary"
                                    variant="solid"
                                    className='bg-primary'
                                    onPress={() => navigate("/login")}
                                    startContent={<LogIn className="text-lg" />}
                                >
                                    Login
                                </Button>
                            ) : (
                                <Button
                                    as="a"
                                    href="/agency/login"
                                    variant="flat"
                                    className="font-medium"
                                    startContent={<LogIn className="text-lg" />}
                                >
                                    Agency login
                                </Button>
                            )}
                        </motion.div>
                    </NavbarItem>
                </NavbarContent>

                {/* Mobile Menu */}
                <NavbarMenu className="pt-6">
                    {menuItems.map((item, index) => (
                        <NavbarMenuItem key={`${item.title}-${index}`}>
                            <Link
                                className="w-full py-2 flex items-center gap-3 text-default-600 hover:text-primary"
                                onClick={() => {
                                    navigate(item.to);
                                    setIsMenuOpen(false);
                                }}
                            >
                                {item.icon}
                                {item.title}
                            </Link>
                        </NavbarMenuItem>
                    ))}
                </NavbarMenu>
            </Navbar>

            {/* Main Content */}
            <main className="flex-grow">
                <Suspense fallback={<div className="min-h-[40vh] w-full" aria-busy="true" aria-label="Loading page" />}>
                    <Routes>
                        {PublicRoutes.map((item: any) => (
                            <Route key={item.path} path={item.path} element={<item.element />} />
                        ))}
                    </Routes>
                </Suspense>
            </main>

            {portalOn ? <Footer /> : (
                <footer className="border-t border-default-200 bg-background">
                    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-default-500 sm:flex-row">
                        <span>© {new Date().getFullYear()} {getAppName()}</span>
                        <span>Powered by <a href="https://techxsolutions.io/" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">TechX Solutions</a></span>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default PublicDashboard;