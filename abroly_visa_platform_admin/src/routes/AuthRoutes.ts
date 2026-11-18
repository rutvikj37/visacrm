import { lazy } from "react"

// SaaS: agencies, plans, payments
const SaasAgencies = lazy(()=> import("@/modules/Saas/SaasAgencies"))
const SaasAgencyDetails = lazy(()=> import("@/modules/Saas/SaasAgencyDetails"))
const SaasPlans = lazy(()=> import("@/modules/Saas/SaasPlans"))
const SaasPayments = lazy(()=> import("@/modules/Saas/SaasPayments"))
const SaasInvoice = lazy(()=> import("@/modules/Saas/SaasInvoice"))
const SaasCoupons = lazy(()=> import("@/modules/Saas/SaasCoupons"))
const SaasUsage = lazy(()=> import("@/modules/Saas/SaasUsage"))
const SaasMonitoring = lazy(()=> import("@/modules/Saas/SaasMonitoring"))
const SaasApiDocs = lazy(()=> import("@/modules/Saas/SaasApiDocs"))
const SaasAnnouncements = lazy(()=> import("@/modules/Saas/SaasAnnouncements"))
const SaasBillingSettings = lazy(()=> import("@/modules/Saas/SaasBillingSettings"))
const SaasMetaSettings = lazy(()=> import("@/modules/Saas/SaasMetaSettings"))
import { RedirectToAgencies, RedirectToPayments, RedirectToPlans } from "@/modules/Saas/Redirects"

const HomePage = lazy(()=> import("@/modules/Home/HomePage"))
const ContactUs = lazy(()=> import("../components/ContactUs"))
const FAQs = lazy(()=> import("../modules/FAQ/FAQs"))
const NotFound = lazy(()=> import("../modules/NotFound/NotFound"))
const IntroPage = lazy(()=> import("../modules/public/IntroPage"))
const Login = lazy(()=> import("../modules/public/Login"))
const Testimonials = lazy(()=> import("../modules/Testimonials/Testimonials"))
const ContentWritingList = lazy(()=> import("@/modules/ContentWriting/ContentWritingList"))
const SimCardListing = lazy(()=> import("@/modules/SimCard/SimCardListing"))
const StaticContent = lazy(()=> import("@/modules/Static_content/StaticContent"))
const StaticContentEdit = lazy(()=> import("@/modules/Static_content/StaticContentEdit"))
const StaticContentAdd = lazy(()=> import("@/modules/Static_content/StaticContentAdd"))
const ContentWritingDetails = lazy(()=> import("@/modules/ContentWriting/ContentWritingDetails"))
const LanguagePrep = lazy(()=> import("@/modules/language_prep/LanguagePrep"))
const LanguagePrepAdd = lazy(()=> import("@/modules/language_prep/LanguagePrepAdd"))
const ContentWritingPages = lazy(()=> import("@/modules/ContentWriting/ContentWritingPages"))
const LanguagePrepEdit = lazy(()=> import("@/modules/language_prep/LanguagePrepEdit"))
const LanguagePrepChapters = lazy(()=> import("@/modules/language_prep/chapters/LanguagePrepChapters"))
const ChapterAdd = lazy(()=> import("@/modules/language_prep/chapters/ChapterAdd"))
const ChapterEdit = lazy(()=> import("@/modules/language_prep/chapters/ChapterEdit"))
const SubChaptersList = lazy(()=> import("@/modules/language_prep/sub_chapters/SubChaptersList"))
const AddSubChapters = lazy(()=> import("@/modules/language_prep/sub_chapters/AddSubChapters"))
const UpdateSubChapter = lazy(()=> import("@/modules/language_prep/sub_chapters/UpdateSubChapter"))
const HealthIns = lazy(()=> import("@/modules/HealthInsurance/HealthIns"))
const QuizList = lazy(()=> import("@/modules/language_prep/chapters/QuizList"))
const Agents = lazy(()=> import("@/modules/Agents/Agents"))
const AgentDetails = lazy(()=> import("@/modules/Agents/AgentDetails"))
const Students = lazy(()=> import("@/modules/Students/Students"))
const StudentDetails = lazy(()=> import("@/modules/Students/StudentDetails"))
const PackageList = lazy(()=> import("@/modules/Package/PackageList"))
const ActiveSubscription = lazy(()=> import("@/modules/Agents/Subscriptions/ActiveSubscription"))
const ServiceInfo = lazy(()=> import("@/modules/ServiceInfo/ServiceInfo"))
const AddUpdateServiceInfo = lazy(()=> import("@/modules/ServiceInfo/AddUpdateServiceInfo"))
const EnrolledStudents = lazy(()=> import("@/modules/language_prep/enrolled_students/EnrolledStudents"))
const SideBannerAchievements = lazy(()=> import("@/modules/SideBannerAchievements/SideBannerAchievements"))
const SideBannerResponses = lazy(()=> import("@/modules/SideBannerAchievements/SideBannerResponses"))
const PublicEventBanners = lazy(()=> import("@/modules/PublicEventBanners/PublicEventBanners"))
const PublicEventBannerCreate = lazy(()=> import("@/modules/PublicEventBanners/PublicEventBannerCreate"))
const PublicEventBannerEdit = lazy(()=> import("@/modules/PublicEventBanners/PublicEventBannerEdit"))
const PublicEventBannerInquiries = lazy(()=> import("@/modules/PublicEventBanners/PuiblicEventBannerInquiries"))
const AccommodationManagement = lazy(()=> import("@/modules/Accommodations/Accommodations"))
const AgentEventBannerForm = lazy(()=> import("@/modules/AgentEventBanners/AgentEventBannerForm"))
const AgentEventBannerInquiries = lazy(()=> import("@/modules/AgentEventBanners/AgentEventBannerInquiries"))
const OfflineLanguages = lazy(()=> import("@/modules/OfflineLanguages/OfflineLanguages"))
const AgentEventBanners = lazy(()=> import("@/modules/AgentEventBanners/AgentEventBanners"))
const SubscriptionInquiries = lazy(()=> import("@/modules/Package/SubscriptionInquiries"))
const JobPost = lazy(()=> import("@/modules/JobPost/JobPost"))
const JobDetails = lazy(()=> import("@/modules/JobPost/JobDetails"))
const CreateAgent = lazy(()=> import("@/modules/Agents/CreateAgent"))
const EditAgent = lazy(()=> import("@/modules/Agents/EditAgent")) 

export const PublicRoutes = [
    {
        path: "/",
        element: Login
    },
    {
        path: "/login",
        element: Login
    },
    {
        path: "*",
        element: NotFound
    }

]


// Super admin = agency management only: old platform-content pages redirect to Agencies
export const AdminRoutes = [
    // SaaS
    {
        path: "/saas/agencies",
        element: SaasAgencies
    },
    {
        path: "/saas/agencies/:id",
        element: SaasAgencyDetails
    },
    {
        path: "/saas/plans",
        element: SaasPlans
    },
    {
        path: "/saas/payments",
        element: SaasPayments
    },
    {
        path: "/saas/invoices/:id",
        element: SaasInvoice
    },
    {
        path: "/saas/usage",
        element: SaasUsage
    },
    {
        path: "/saas/monitoring",
        element: SaasMonitoring
    },
    {
        path: "/saas/api-docs",
        element: SaasApiDocs
    },
    {
        path: "/saas/announcements",
        element: SaasAnnouncements
    },
    {
        path: "/saas/coupons",
        element: SaasCoupons
    },
    {
        path: "/saas/billing_settings",
        element: SaasBillingSettings
    },
    {
        path: "/saas/meta",
        element: SaasMetaSettings
    },


    {
        path: "/",
        element: RedirectToAgencies
    },
    {
        path: "/faqs",
        element: RedirectToAgencies
    },
    {
        path: "/testimonails",
        element: RedirectToAgencies
    },
    {
        path: "/content_writing",
        element: RedirectToAgencies
    },
    {
        path: "/content_writing/page/:id",
        element: RedirectToAgencies
    },
    {
        path: "/sim_card",
        element: RedirectToAgencies
    },
    {
        path: "/health_in",
        element: RedirectToAgencies
    },
    {
        path: "/static_content",
        element: RedirectToAgencies
    },
    {
        path: "/static/edit/:id",
        element: RedirectToAgencies
    },
    {
        path: "/content_writing_details/:id",
        element: RedirectToAgencies
    },
    {
        path: "/static/add",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/enrolled_students/:id",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/add",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/edit/:id",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/chapters/:id",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/chapters/add/:leval/:course_uuid",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/chapters/edit/:leval/:course_uuid/:id",
        element: RedirectToAgencies
    },

    // sub chapters
    {
        path: "/lang_prep/sub_chapters/:id",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/add_sub_chapters/:id",
        element: RedirectToAgencies
    },
    {
        path: "/lang_prep/edit_sub_chapters/:id",
        element: RedirectToAgencies
    },

    // side banner achievements 
    {
        path: "/side_banner_achievements/:status",
        element: SideBannerAchievements
    },
    {
        path: "/side_banner_responses/:uuid",
        element: SideBannerResponses
    },

    // quiz
    {
        path: "/lang_prep/quiz/:leval/:course_uuid",
        element: RedirectToAgencies
    },

    // agents 
    {
        path: "/agents",
        element: Agents
    },

    {
        path: "/agent/create_agent",
        element: RedirectToAgencies
    },
    {
        path: "/agent/edit_agent/:id",
        element: EditAgent
    },
    {
        path: "/agents/:id",
        element: AgentDetails
    },
    {
        path: "/agents/subscription/:id",
        element: RedirectToAgencies
    },

    // student
    {
        path: "/student",
        element: RedirectToAgencies
    },
    {
        path: "/student/:id",
        element: RedirectToAgencies
    },

    // packages
    {
        path: "/packages",
        element: RedirectToPlans
    },
    {
        path: "/subscription_inquiries",
        element: RedirectToPayments
    },

    // service information
    {
        path: "/services_info",
        element: RedirectToAgencies
    },
    {
        path: "/services_info/:service",
        element: RedirectToAgencies
    },

    // event banners
    {
        path: "/public_event_banners",
        element: RedirectToAgencies
    },
    {
        path: "/public_event_banner_create",
        element: RedirectToAgencies
    },
    {
        path: "/public_event_banner_create/:id",
        element: RedirectToAgencies
    },
    {
        path: "/public_event_banner_inquiries/:id",
        element: RedirectToAgencies
    },

    // agent event banner 
    {
        path: "/agent_event_banners",
        element: RedirectToAgencies
    },
    {
        path: "/agent_event_banners_create",
        element: RedirectToAgencies
    },
    {
        path: "/agent_event_banners_create/:id",
        element: RedirectToAgencies
    },
    {
        path: "/agent_event_banners_inquiries/:id",
        element: RedirectToAgencies
    },

    // accomondation
    {
        path: "/accomodation",
        element: RedirectToAgencies
    },

    // offline languages
    {
        path: "/offline_languages",
        element: RedirectToAgencies
    },

    // Job Posts
    // {
    //     path:"/job_posts",
    //     element:JobPost
    // },

    {
        path: "/job_posts/:uuid",
        element: RedirectToAgencies
    },


    // 404
    {
        path: "*",
        element: NotFound
    }
]