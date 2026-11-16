import { lazy } from "react"
import { RedirectToLeadInbox } from "@/modules/AgentAdmin/Crm/Redirects"

// Authenticated CRM pages: eager imports so Suspense does not blank the shell on every nav click.
import JobPost from "@/modules/AgentAdmin/JobPost/JobPost"
import JobPostAddEdit from "@/modules/AgentAdmin/JobPost/JobPostAddEdit"
import JobPostApplicants from "@/modules/AgentAdmin/JobPost/JobPostApplicants"
import SubAgents from "@/modules/AgentAdmin/SubAgent/SubAgents"
import SubAgentDetails from "@/modules/AgentAdmin/SubAgent/SubAgentDetails"
import AgentCalendar from "@/modules/AgentAdmin/Calendar/AgentCalendar"
import AssignEvent from "@/modules/AgentAdmin/Calendar/AssignEvent"
import BasicProfile from "@/modules/AgentAdmin/Profile/BasicProfile"
import ServiceProfile from "@/modules/AgentAdmin/Profile/ServiceProfile"
import SideBanner from "@/modules/AgentAdmin/SideBanner/SideBanner"
import AddSideBanner from "@/modules/AgentAdmin/SideBanner/AddSideBanner"
import Responses from "@/modules/AgentAdmin/SideBanner/Responses"
import LeadsStudents from "@/modules/AgentAdmin/Leads/students/LeadsStudents"
import LeadsApplications from "@/modules/AgentAdmin/Leads/applications/LeadsApplications"
import LeadsVisa from "@/modules/AgentAdmin/Leads/visa/LeadsVisa"
import LeadVisaAccepted from "@/modules/AgentAdmin/Leads/visa/LeadVisaAccepted"
import LeadVisaRejected from "@/modules/AgentAdmin/Leads/visa/LeadVisaRejected"
import LeadsWithdrawn from "@/modules/AgentAdmin/Leads/withdrawn/LeadsWithdrawn"
import LeadsCalendar from "@/modules/AgentAdmin/Leads/calendar/LeadsCalendar"
import LeadsProgress from "@/modules/AgentAdmin/Leads/progress/LeadsProgress"
import StudentProfile from "@/modules/AgentAdmin/Leads/IncomingRequest/StudentProfile"
import AgentEventBanners from "@/modules/AgentAdmin/event_banners/AgentEventBanners"
import OfflineLangPrep from "@/modules/AgentAdmin/Offline_lang_prep/OfflineLangPrep"
import OfflineInquiries from "@/modules/AgentAdmin/Offline_lang_prep/OfflineInquiries"
import ReportsGenerate from "@/modules/AgentAdmin/Reports/ReportsGenerate"
import LeadInbox from "@/modules/AgentAdmin/Crm/LeadInbox"
import ChatInbox from "@/modules/AgentAdmin/Chats/ChatInbox"
import ActivityLogPage from "@/modules/AgentAdmin/Activity/ActivityLogPage"
import LeadDetails from "@/modules/AgentAdmin/Crm/LeadDetails"
import LeadSources from "@/modules/AgentAdmin/Crm/LeadSources"
import VisaTemplates from "@/modules/AgentAdmin/Crm/VisaTemplates"
import ReportsDashboard from "@/modules/AgentAdmin/Reports/ReportsDashboard"
import CaseBoard from "@/modules/AgentAdmin/Cases/CaseBoard"
import UnifiedCalendar from "@/modules/AgentAdmin/CalendarAll/UnifiedCalendar"
import RolesAndBranches from "@/modules/AgentAdmin/SubAgent/RolesAndBranches"
import BrandingSettings from "@/modules/AgentAdmin/Branding/BrandingSettings"
import FeesList from "@/modules/AgentAdmin/Fees/FeesList"
import ServicesStore from "@/modules/AgentAdmin/Services/ServicesStore"
import ServiceOrderPage from "@/modules/AgentAdmin/Services/ServiceOrderPage"
import PaymentSettings from "@/modules/AgentAdmin/Services/PaymentSettings"
import MessagesPage from "@/modules/AgentAdmin/Messages/MessagesPage"
import InvoiceDetails from "@/modules/AgentAdmin/Fees/InvoiceDetails"
import SubscriptionPage from "@/modules/AgentAdmin/Subscription/SubscriptionScreen"
import TodayPage from "@/modules/AgentAdmin/Today/TodayPage"
import BranchesPage from "@/modules/AgentAdmin/Branches/BranchesPage"
import SubscriptionInvoice from "@/modules/AgentAdmin/Subscription/SubscriptionInvoice"
import JobDetails from "@/modules/AgentAdmin/JobPost/JobDetails"
import LanguagePrep from "@/modules/language_prep/LanguagePrep"
import LanguagePrepAdd from "@/modules/language_prep/LanguagePrepAdd"
import LanguagePrepEdit from "@/modules/language_prep/LanguagePrepEdit"
import LanguagePrepChapters from "@/modules/language_prep/chapters/LanguagePrepChapters"
import ChapterAdd from "@/modules/language_prep/chapters/ChapterAdd"
import ChapterEdit from "@/modules/language_prep/chapters/ChapterEdit"
import SubChaptersList from "@/modules/language_prep/sub_chapters/SubChaptersList"
import AddSubChapters from "@/modules/language_prep/sub_chapters/AddSubChapters"
import UpdateSubChapter from "@/modules/language_prep/sub_chapters/UpdateSubChapter"
import EnrolledStudents from "@/modules/language_prep/enrolled_students/EnrolledStudents"
import QuizList from "@/modules/language_prep/chapters/QuizList"
import ServiceRequest from "@/modules/ServiceRequest/ServiceRequest"
import AgentContactUs from "@/modules/AgentAdmin/ContactUs/ContactUs"
import NotFound from "@/modules/NotFound/NotFound"
import PublicStatic from "@/modules/static/PublicStatic"

// Public marketing/auth pages stay lazy (first paint of landing).
const ContactUs = lazy(() => import("../components/ContactUs"))
const Login = lazy(() => import("../modules/public/Login"))
const IntroPage3 = lazy(() => import("@/modules/public/IntroPage3"))
const Faq = lazy(() => import("@/modules/public/Faq"))
const AboutPage = lazy(() => import("@/modules/public/CompanyPages").then((m) => ({ default: m.AboutPage })))
const TermsPage = lazy(() => import("@/modules/public/CompanyPages").then((m) => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import("@/modules/public/CompanyPages").then((m) => ({ default: m.PrivacyPage })))
const RefundPage = lazy(() => import("@/modules/public/CompanyPages").then((m) => ({ default: m.RefundPage })))

export const PublicRoutes = [
    {
        path: "/",
        element: IntroPage3
    },
    {
        path: "/login",
        element: Login
    },
    {
        path: "/contact_us",
        element: ContactUs
    },
    {
        path: "/about",
        element: AboutPage
    },
    {
        path: "/terms",
        element: TermsPage
    },
    {
        path: "/privacy",
        element: PrivacyPage
    },
    {
        path: "/refund",
        element: RefundPage
    },
    {
        path: "/static/:id",
        element: PublicStatic
    },

    // faqs
    {
        path: "/faqs",
        element: Faq
    },

    {
        path: "*",
        element: NotFound
    }

]


export const AgentAdminRoutes = [
    {
        path: "/",
        // home: what needs doing today (Reports moved to /dashboard)
        element: TodayPage
    },
    {
        path: "/cases/board",
        element: CaseBoard
    },
    {
        path: "/services",
        element: ServicesStore
    },
    {
        path: "/services/orders/:id",
        element: ServiceOrderPage
    },
    {
        path: "/settings/payments",
        element: PaymentSettings
    },
    {
        path: "/fees",
        element: FeesList
    },
    {
        path: "/fees/:id",
        element: InvoiceDetails
    },
    {
        path: "/crm/calendar",
        element: UnifiedCalendar
    },
    // Lead CRM
    {
        path: "/crm/leads",
        element: LeadInbox
    },
    {
        path: "/crm/leads/:uuid",
        element: LeadDetails
    },
    {
        path: "/crm/chats",
        element: ChatInbox
    },
    {
        path: "/activity",
        element: ActivityLogPage
    },
    {
        path: "/crm/sources",
        element: LeadSources
    },
    {
        path: "/team/roles",
        element: RolesAndBranches
    },
    {
        path: "/branches",
        element: BranchesPage
    },
    {
        path: "/crm/messages",
        element: MessagesPage
    },
    {
        path: "/branding",
        element: BrandingSettings
    },
    {
        path: "/crm/templates",
        element: VisaTemplates
    },
    {
        path: "/subscription",
        element: SubscriptionPage
    },
    {
        path: "/subscription/invoices/:id",
        element: SubscriptionInvoice
    },
    {
        path: "/dashboard",
        element: ReportsDashboard
    },
    {
        path: "/reports",
        element: ReportsGenerate
    },
    {
        path: "/side_banner/:find_for",
        element: SideBanner
    },
    {
        path: "/add_side_banner",
        element: AddSideBanner
    },
    {
        path: "/responses_side_banner/:uuid",
        element: Responses
    },
    {
        path: "/job_post/find/:status",
        element: JobPost
    },
    {
        path: "/job_post/edit",
        element: JobPostAddEdit
    },
    {
        path: "/job_post/applicants/:id",
        element: JobPostApplicants
    },
    {
        path: "/job_posts/:uuid",
        element: JobDetails
    },
    {
        path: "/sub_agent",
        element: SubAgents
    },
    {
        path: "/sub_agent/:id",
        element: SubAgentDetails
    },
    {
        path: "/calendar",
        element: AgentCalendar
    },
    {
        path: "/calendar/add/:selectedDate",
        element: AssignEvent
    },

    // profile
    {
        path: "/basic_profile",
        element: BasicProfile
    },
    {
        path: "/service_profile",
        element: ServiceProfile
    },

    // Service Request 
    {
        path: "/service_request/:type",
        element: ServiceRequest
    },

    // static 
    {
        path: "/static/:id",
        element: PublicStatic
    },

    // leads
    {
        path: "/leads",
        element: RedirectToLeadInbox
    },
    // user profile
    {
        path: "/leads/student_profile/:id",
        element: StudentProfile
    },

    {
        path: "/leads/progress/:id",
        element: LeadsProgress
    },
    {
        path: "/leads/students",
        element: LeadsStudents
    },
    {
        path: "/leads/applications",
        element: LeadsApplications
    },
    {
        path: "/leads/visa",
        element: LeadsVisa
    },
    {
        path: "/leads/accepted",
        element: LeadVisaAccepted
    },
    {
        path: "/leads/rejected",
        element: LeadVisaRejected
    },
    {
        path: "/leads/withdrawn",
        element: LeadsWithdrawn
    },
    {
        path: "/leads/calendar",
        element: LeadsCalendar
    },

    // add offline lead
    {
        path: "/add_offline_lead",
        element: RedirectToLeadInbox
    },

    // events
    {
        path: "/events",
        element: AgentEventBanners
    },

    // offline language preparation
    {
        path: "/offline_lang_prep",
        element: OfflineLangPrep
    },
    {
        path: "/offline_lang_prep_inquiries",
        element: OfflineInquiries
    },

    // Language Preparation
    {
        path: "/lang_prep",
        element: LanguagePrep
    },
    {
        path: "/lang_prep/enrolled_students/:id",
        element: EnrolledStudents
    },
    {
        path: "/lang_prep/add",
        element: LanguagePrepAdd
    },
    {
        path: "/lang_prep/edit/:id",
        element: LanguagePrepEdit
    },
    {
        path: "/lang_prep/chapters/:id",
        element: LanguagePrepChapters
    },
    {
        path: "/lang_prep/chapters/add/:leval/:course_uuid",
        element: ChapterAdd
    },
    {
        path: "/lang_prep/chapters/edit/:leval/:course_uuid/:id",
        element: ChapterEdit
    },

     // quiz
     {
        path: "/lang_prep/quiz/:leval/:course_uuid",
        element: QuizList
    },

    // sub chapters
    {
        path: "/lang_prep/sub_chapters/:id",
        element: SubChaptersList
    },
    {
        path: "/lang_prep/add_sub_chapters/:id",
        element: AddSubChapters
    },
    {
        path: "/lang_prep/edit_sub_chapters/:id",
        element: UpdateSubChapter
    },
    
    {
        path: "/contact_us",
        element: AgentContactUs
    },

    {
        path: "*",
        element: NotFound
    }
]
export const SubAgentRoutes = [
    {
        path: "/",
        element: TodayPage
    },
    {
        // branch managers: their branch's report (others see a message)
        path: "/reports",
        element: ReportsDashboard
    },
    {
        path: "/cases/board",
        element: CaseBoard
    },
    {
        path: "/services",
        element: ServicesStore
    },
    {
        path: "/services/orders/:id",
        element: ServiceOrderPage
    },
    {
        path: "/settings/payments",
        element: PaymentSettings
    },
    {
        path: "/fees",
        element: FeesList
    },
    {
        path: "/fees/:id",
        element: InvoiceDetails
    },
    {
        path: "/crm/calendar",
        element: UnifiedCalendar
    },
    // Lead CRM
    {
        path: "/crm/leads",
        element: LeadInbox
    },
    {
        path: "/crm/leads/:uuid",
        element: LeadDetails
    },
    {
        path: "/crm/chats",
        element: ChatInbox
    },
    {
        path: "/activity",
        element: ActivityLogPage
    },

    // static
    {
        path: "/static/:id",
        element: PublicStatic
    },

    // leads
    // {
    //     path: "/leads",
    //     element: IncomingRequests
    // },
    // user profile
    {
        path: "/leads/student_profile/:id",
        element: StudentProfile
    },
    {
        path: "/leads/progress/:id",
        element: LeadsProgress
    },
    {
        path: "/leads/students",
        element: LeadsStudents
    },
    {
        path: "/leads/applications",
        element: LeadsApplications
    },
    {
        path: "/leads/visa",
        element: LeadsVisa
    },
    {
        path: "/leads/withdrawn",
        element: LeadsWithdrawn
    },
    {
        path: "/leads/calendar",
        element: LeadsCalendar
    },
    {
        path: "/add_offline_lead",
        element: RedirectToLeadInbox
    },
    {
        path: "*",
        element: NotFound
    }
]
