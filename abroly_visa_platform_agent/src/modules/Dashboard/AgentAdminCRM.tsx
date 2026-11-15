import { ChevronRight, ChevronsUpDown, FileText, Inbox, LogOut, SquareTerminal, Users, Home, KanbanSquare, Settings } from "lucide-react"


import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Avatar, Spinner, useDisclosure } from "@heroui/react"
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import CommonConfirmation from "@/components/CommonConfirmation"
import { handleLogout } from "@/utils/LogoutUtils"
import { AgentAdminRoutes } from "@/routes/AuthRoutes"
import { useSelector } from "react-redux"
import { useEffect, useMemo, useState } from "react"
import { commonGetAPICalls } from "@/utils/ApiCallUtils"
import { RiAdvertisementFill } from "react-icons/ri"
import { PRIMARY_COLOR, PRIMARY_COLOR_FOREGROUND } from '@/lib/theme'
import SubscriptionBanner from "@/modules/AgentAdmin/Subscription/SubscriptionBanner"
import AnnouncementBanner from "@/modules/AgentAdmin/Notifications/AnnouncementBanner"
import SidebarBrand from "@/components/panel/SidebarBrand"
import PanelHeader from "@/components/panel/PanelHeader"
import PanelBottomNav from "@/components/panel/PanelBottomNav"
import UnreadChatsBadge from "@/modules/AgentAdmin/Chats/UnreadChatsBadge"
import KeyboardShortcuts from "@/components/panel/KeyboardShortcuts"
import NotificationBell from "@/modules/AgentAdmin/Notifications/NotificationBell"

const AgentCRM = () => {
  // for logout
  const { isOpen, onOpenChange } = useDisclosure();

  // static page add 
  const [staticPage, setStaticPages] = useState([])

  useEffect(() => {
    getStaticPages()
  }, [])

  const getStaticPages = async () => {
    const { success, data } = await commonGetAPICalls("/static/list")
    if (success && success == true) {
      setStaticPages(data)
    }
  }

  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Stable route elements — avoid recreating element trees that remount pages on shell re-render
  const routeNodes = useMemo(
    () => AgentAdminRoutes.map((item: any) => (
      <Route key={item.path} path={item.path} element={<item.element />} />
    )),
    []
  )

  const data = {
    navMain: [
      // the screens used every day first; settings and add-ons last
      {
        title: "Home",
        url: "#",
        icon: Home,
        isActive: true,
        items: [
          { title: "Today", url: "/" },
          { title: "Reports", url: "/dashboard" },
        ],
      },
      {
        title: "Leads",
        url: "#",
        icon: Inbox,
        isActive: true,
        items: [
          { title: "Lead Inbox", url: "/crm/leads" },
          { title: "Chats", url: "/crm/chats" },
          { title: "Follow-ups today", url: "/crm/leads?follow_up=today" },
          { title: "Calendar", url: "/crm/calendar" },
          { title: "Messages", url: "/crm/messages" },
          { title: "Contact requests", url: "/contact_us" },
        ],
      },
      {
        title: "Visa cases",
        url: "#",
        icon: KanbanSquare,
        isActive: true,
        items: [
          { title: "Case board", url: "/cases/board" },
          { title: "In progress", url: "/leads/visa" },
          { title: "Approved", url: "/leads/accepted" },
          { title: "Rejected", url: "/leads/rejected" },
          { title: "Withdrawn", url: "/leads/withdrawn" },
          { title: "Client fees", url: "/fees" },
          { title: "Services store", url: "/services" },
        ],
      },
      {
        title: "Team",
        url: "#",
        icon: Users,
        isActive: false,
        items: [
          { title: "Team members", url: "/sub_agent" },
          { title: "Roles", url: "/team/roles" },
          { title: "Branches", url: "/branches" },
          { title: "Activity log", url: "/activity" },
        ],
      },
      {
        title: "Settings",
        url: "#",
        icon: Settings,
        isActive: false,
        items: [
          { title: "Lead sources", url: "/crm/sources" },
          { title: "Visa templates", url: "/crm/templates" },
          { title: "Branding", url: "/branding" },
          { title: "Payments (Razorpay)", url: "/settings/payments" },
          { title: "Subscription", url: "/subscription" },
          { title: "My profile", url: "/basic_profile" },
        ],
      },
      // paid add-ons (shown only when the plan includes them)
      {
        title: "Service requests",
        addon: "service_requests",
        url: "#",
        icon: FileText,
        isActive: false,
        items: [
          { title: "Health insurance", url: "/service_request/health" },
          { title: "SIM cards", url: "/service_request/data" },
        ],
      },
      {
        title: "Jobs",
        addon: "jobs",
        url: "#",
        icon: SquareTerminal,
        isActive: false,
        items: [
          { title: "Active", url: "/job_post/find/active" },
          { title: "Inactive", url: "/job_post/find/inactive" },
        ],
      },
      {
        title: "Side banners",
        addon: "side_banner",
        url: "#",
        icon: RiAdvertisementFill,
        isActive: false,
        items: [
          { title: "Active campaigns", url: "/side_banner/current" },
          { title: "Past campaigns", url: "/side_banner/past" },
        ],
      },
    ],

    static: [
      ...staticPage?.map(el => {
        return {
          name: el?.title,
          url: `/${el?.url}`,
        }
      }),
    ],
  }


  const { phone, email, profileimage, user_name } = useSelector((state: any) => state.login);
  // SaaS: hide add-on modules that are not in the plan (no plan = everything)
  const subscription = useSelector((state: any) => state.login.subscription)
  const planAddons: string[] | null = subscription?.plan ? (subscription.plan.features?.addons || []) : null

  const [sideBarOpen, setSideBarOpen] = useState(false)

  // const { toggleSidebar } = useSidebar()

  return (
    (<>
      <SidebarProvider  >
        <Sidebar collapsible="icon" >
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>

                <SidebarBrand subtitle="Agency panel" />

              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarMenu>
                {data.navMain.filter((item: any) => !item.addon || !planAddons || planAddons.includes(item.addon)).map((item) => (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={item.isActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item?.items?.map((subItem) => {
                            const isActive = pathname === subItem.url || (subItem.url !== "/" && pathname.startsWith(subItem.url.split("?")[0]));
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <Link
                                    to={subItem.url}
                                    className={`
                                      w-full h-9 px-3 rounded-md transition-colors duration-150
                                      flex items-center font-medium text-sm no-underline
                                      ${isActive 
                                        ? 'text-white font-semibold shadow-md' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                      }
                                    `}
                                    style={isActive ? {
                                      background: PRIMARY_COLOR,
                                      color: PRIMARY_COLOR_FOREGROUND,
                                      textDecoration: 'none'
                                    } : {
                                      textDecoration: 'none'
                                    }}
                                  >
                                    {subItem.title}
                                    {subItem.url === "/crm/chats" && <UnreadChatsBadge />}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar
                        src={profileimage}
                        showFallback
                        className="h-8 w-8 rounded-lg"
                      />
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user_name}
                        </span>
                        <span className="truncate text-xs">
                          {phone}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar
                          src={profileimage}
                          showFallback
                          className="h-8 w-8 rounded-lg"
                        />
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">
                            {user_name}
                          </span>
                          <span className="truncate text-xs">
                            {phone}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => {
                      onOpenChange()
                      // setSideBarOpen(false) 
                    }}>
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-w-0">
          <PanelHeader onMenu={() => { setSideBarOpen(true) }} />
          <div className="flex flex-1 flex-col p-3 sm:p-4 min-w-0 w-full pb-24 md:pb-4">
            <SubscriptionBanner />
            <AnnouncementBanner />
            <Routes>{routeNodes}</Routes>
          </div>
          <PanelBottomNav />
          <KeyboardShortcuts />
        </SidebarInset>
      </SidebarProvider>
      <CommonConfirmation
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title={"Are you sure want to logout ?"}
        handleSubmit={() => {
          handleLogout(navigate)
        }}
        nagativeTitle={"No"}
        positiveTitle={"Yes"}
      />
    </>)
  );
}

export default AgentCRM