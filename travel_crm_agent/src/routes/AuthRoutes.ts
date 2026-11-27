import { lazy } from "react"
import { RedirectToCrmCalendar, RedirectToLeadInbox, RedirectToReports } from "@/modules/AgentAdmin/Crm/Redirects"

// Authenticated CRM pages: eager imports so Suspense does not blank the shell on every nav click.
import SubAgents from "@/modules/AgentAdmin/SubAgent/SubAgents"
import SubAgentDetails from "@/modules/AgentAdmin/SubAgent/SubAgentDetails"
import BasicProfile from "@/modules/AgentAdmin/Profile/BasicProfile"
import ServiceProfile from "@/modules/AgentAdmin/Profile/ServiceProfile"
import SideBanner from "@/modules/AgentAdmin/SideBanner/SideBanner"
import AddSideBanner from "@/modules/AgentAdmin/SideBanner/AddSideBanner"
import Responses from "@/modules/AgentAdmin/SideBanner/Responses"
import AgentEventBanners from "@/modules/AgentAdmin/event_banners/AgentEventBanners"
import ReportsGenerate from "@/modules/AgentAdmin/Reports/ReportsGenerate"
import LeadInbox from "@/modules/AgentAdmin/Crm/LeadInbox"
import ChatInbox from "@/modules/AgentAdmin/Chats/ChatInbox"
import TaskBoard from "@/modules/AgentAdmin/Tasks/TaskBoard"
import ActivityLogPage from "@/modules/AgentAdmin/Activity/ActivityLogPage"
import LeadDetails from "@/modules/AgentAdmin/Crm/LeadDetails"
import LeadSources from "@/modules/AgentAdmin/Crm/LeadSources"
import ReportsDashboard from "@/modules/AgentAdmin/Reports/ReportsDashboard"
import UnifiedCalendar from "@/modules/AgentAdmin/CalendarAll/UnifiedCalendar"
import RolesAndBranches from "@/modules/AgentAdmin/SubAgent/RolesAndBranches"
import BrandingSettings from "@/modules/AgentAdmin/Branding/BrandingSettings"
import TravelDesk from "@/modules/AgentAdmin/Travel/TravelDesk"
import LiveTrips from "@/modules/AgentAdmin/Travel/LiveTrips"
import Itineraries from "@/modules/AgentAdmin/Travel/Itineraries"
import ItineraryBuilder from "@/modules/AgentAdmin/Travel/ItineraryBuilder"
import Quotes from "@/modules/AgentAdmin/Travel/Quotes"
import QuoteEditor from "@/modules/AgentAdmin/Travel/quote/QuoteWizard"
import Bookings from "@/modules/AgentAdmin/Travel/Bookings"
import BookingDetails from "@/modules/AgentAdmin/Travel/BookingDetails"
import Packages from "@/modules/AgentAdmin/Travel/Packages"
import { Suppliers, SupplierDetails } from "@/modules/AgentAdmin/Travel/Suppliers"
import TravelLibrary from "@/modules/AgentAdmin/Travel/Library"
import TravelReports from "@/modules/AgentAdmin/Travel/TravelReports"
import TripFinance from "@/modules/AgentAdmin/Travel/TripFinance"
import Pipeline from "@/modules/AgentAdmin/Travel/Pipeline"
import { ClientPage, Clients } from "@/modules/AgentAdmin/Travel/Clients"
import WhatsappInbox from "@/modules/AgentAdmin/Messages/WhatsappInbox"
import TravelSettings from "@/modules/AgentAdmin/Travel/TravelSettings"
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
        // home: what needs doing today (Reports are at /reports)
        element: TodayPage
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
    { path: "/travel", element: TravelDesk },
    { path: "/travel/live-trips", element: LiveTrips },
    { path: "/travel/itineraries", element: Itineraries },
    { path: "/travel/itineraries/:id", element: ItineraryBuilder },
    { path: "/travel/quotes", element: Quotes },
    { path: "/travel/quotes/:id", element: QuoteEditor },
    { path: "/travel/bookings", element: Bookings },
    { path: "/travel/bookings/:id", element: BookingDetails },
    { path: "/travel/packages", element: Packages },
    { path: "/travel/suppliers", element: Suppliers },
    { path: "/travel/suppliers/:id", element: SupplierDetails },
    { path: "/travel/library", element: TravelLibrary },
    { path: "/travel/reports", element: TravelReports },
    { path: "/travel/finance", element: TripFinance },
    { path: "/travel/pipeline", element: Pipeline },
    { path: "/travel/clients", element: Clients },
    { path: "/travel/clients/:id", element: ClientPage },
    { path: "/crm/inbox", element: WhatsappInbox },
    { path: "/travel/settings", element: TravelSettings },
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
        path: "/crm/tasks",
        element: TaskBoard
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
        path: "/subscription",
        element: SubscriptionPage
    },
    {
        path: "/subscription/invoices/:id",
        element: SubscriptionInvoice
    },
    {
        path: "/dashboard",
        element: RedirectToReports
    },
    {
        path: "/reports",
        element: ReportsDashboard
    },
    {
        // requested PDF / Excel reports
        path: "/reports/generate",
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
        path: "/sub_agent",
        element: SubAgents
    },
    {
        path: "/sub_agent/:id",
        element: SubAgentDetails
    },
    {
        path: "/calendar",
        element: RedirectToCrmCalendar
    },
    {
        path: "/calendar/add/:selectedDate",
        element: RedirectToCrmCalendar
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
    {
        path: "/leads/calendar",
        element: RedirectToCrmCalendar
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
    { path: "/travel", element: TravelDesk },
    { path: "/travel/live-trips", element: LiveTrips },
    { path: "/travel/itineraries", element: Itineraries },
    { path: "/travel/itineraries/:id", element: ItineraryBuilder },
    { path: "/travel/quotes", element: Quotes },
    { path: "/travel/quotes/:id", element: QuoteEditor },
    { path: "/travel/bookings", element: Bookings },
    { path: "/travel/bookings/:id", element: BookingDetails },
    { path: "/travel/packages", element: Packages },
    { path: "/travel/suppliers", element: Suppliers },
    { path: "/travel/suppliers/:id", element: SupplierDetails },
    { path: "/travel/library", element: TravelLibrary },
    { path: "/travel/reports", element: TravelReports },
    { path: "/travel/finance", element: TripFinance },
    { path: "/travel/pipeline", element: Pipeline },
    { path: "/travel/clients", element: Clients },
    { path: "/travel/clients/:id", element: ClientPage },
    { path: "/crm/inbox", element: WhatsappInbox },
    { path: "/travel/settings", element: TravelSettings },
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
        path: "/crm/tasks",
        element: TaskBoard
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
    {
        path: "/leads/calendar",
        element: RedirectToCrmCalendar
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
