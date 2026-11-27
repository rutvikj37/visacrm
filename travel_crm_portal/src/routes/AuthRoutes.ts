
import path from "path"
import { lazy } from "react"

const ContactUs = lazy(()=> import("../components/ContactUs"))
const HealthInsurance = lazy(()=> import("../modules/HealthInsurance/HealthInsurance"))
const NotFound = lazy(()=> import("../modules/NotFound/NotFound"))
const IntroPage = lazy(()=> import("../modules/public/IntroPage"))
const Login = lazy(()=> import("../modules/public/Login"))
const SimCardListing = lazy(()=> import("../modules/SimcardListing/SimCardListing"))
const PublicStatic = lazy(()=> import("../modules/static/PublicStatic"))
const StudentProfile = lazy(()=> import("@/modules/Profile/StudentProfile"))
const ServiceInfo = lazy(()=> import("@/modules/Service_pages/ServiceInfo"))
const Faq = lazy(()=> import("@/modules/public/Faq"))
const PublicEventBanners = lazy(()=> import("@/modules/EventBanners/PublicEventBanners"))
const MyFees = lazy(() => import("@/modules/Fees/MyFees"))
const ServicesStore = lazy(() => import("@/modules/Services/ServicesStore"))
const ServiceOrder = lazy(() => import("@/modules/Services/ServiceOrder"))
const StudentHome = lazy(() => import("@/modules/Dashboard/StudentHome"))
// const CoinHistory = lazy(()=> import("@/modules/Coins/CoinHistory"))
const StudentChat = lazy(()=> import("@/modules/Chat/StudentChat"))

export const PublicRoutes = [
    {
        path: "/",
        element: IntroPage
    },
    {
        path: "/login",
        element: Login
    },
    {
        // no self sign-up: students are added by their agency and get a login code by email
        path: "/signup",
        element: Login
    },
    {
        path: "/contact_us",
        element: ContactUs
    },
    {
        path: "/sim_cards",
        element: SimCardListing
    },
    {
        path: "/health_insurance",
        element: HealthInsurance
    },
    {
        path: "/static/:id",
        element: PublicStatic
    },
    {
        path: "/services/:service",
        element: ServiceInfo
    },
    {
        path: "/faq",
        element: Faq
    },
    {
        path: "/event_banners",
        element: PublicEventBanners
    },
    {
        path: "*",
        element: NotFound
    },
]


export const StudentRoutes = [

    {
        path: "/",
        element: StudentHome
    },
    {
        path: "/contact_us",
        element: ContactUs
    },
    {
        path: "/static/:id",
        element: PublicStatic
    },

    // service information
    {
        path: "/services/:service",
        element: ServiceInfo
    },
    {
        path: "/chat",
        element: StudentChat
    },
    {
        path: "/my_fees",
        element: MyFees
    },
    {
        path: "/services",
        element: ServicesStore
    },
    {
        path: "/services/orders/:id",
        element: ServiceOrder
    },

    // profile
    {
        path: "/student_profile",
        element: StudentProfile
    },

    // faq
    {
        path: "/faq",
        element: Faq
    },

    // event banners
    {
        path: "/event_banners",
        element: PublicEventBanners
    },

    // // event banners
    // {
    //     path: "/coin_history",
    //     element: CoinHistory
    // },

    // 404
    {
        path: "*",
        element: NotFound
    }
]