import { ChevronsUpDown, Inbox, LogOut, Users, Home, KanbanSquare, Settings, GraduationCap } from "lucide-react"


import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Avatar, Spinner, useDisclosure } from "@heroui/react"
import { Route, Routes, useNavigate } from "react-router-dom"
import CommonConfirmation from "@/components/CommonConfirmation"
import LogoutAllDevicesItem from "@/components/LogoutAllDevicesItem"
import ChangePasscodeItem, { ChangePasscodeDialog } from "@/components/ChangePasscodeItem"
import { handleLogout } from "@/utils/LogoutUtils"
import { AgentAdminRoutes } from "@/routes/AuthRoutes"
import { useSelector } from "react-redux"
import { useEffect, useMemo, useState } from "react"
import { commonGetAPICalls } from "@/utils/ApiCallUtils"
import SidebarNavGroup from "@/components/panel/SidebarNavGroup"
import SubscriptionBanner from "@/modules/AgentAdmin/Subscription/SubscriptionBanner"
import AnnouncementBanner from "@/modules/AgentAdmin/Notifications/AnnouncementBanner"
import SidebarBrand from "@/components/panel/SidebarBrand"
import PanelHeader from "@/components/panel/PanelHeader"
import PanelBottomNav from "@/components/panel/PanelBottomNav"
import KeyboardShortcuts from "@/components/panel/KeyboardShortcuts"
import NotificationBell from "@/modules/AgentAdmin/Notifications/NotificationBell"
import useModules from "@/hooks/useModules"
import { filterNav, travelNavGroup } from "@/modules/AgentAdmin/Travel/travelNav"

const AgentCRM = () => {
  const { crmType, modules, has } = useModules()
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
          { title: "Calendar", url: "/crm/calendar" },
          { title: "Tasks", url: "/crm/tasks" },
          { title: "Chats", url: "/crm/chats" },
          { title: "WhatsApp inbox", url: "/crm/inbox", module: "messaging" },
          { title: "Reports", url: "/reports" },
        ],
      },
      {
        title: "Leads",
        url: "#",
        icon: Inbox,
        isActive: true,
        items: [
          { title: "Lead Inbox", url: "/crm/leads" },
          { title: "Follow-ups today", url: "/crm/leads?follow_up=today" },
          // contact form messages arrive in the Lead Inbox (source "Portal"); the old list is linked from Lead sources
        ],
      },
      // travel agencies see the Travel group before visa cases
      ...(crmType === "travel" ? [travelNavGroup()] : []),
      {
        title: has("visa") ? "Visa cases" : "Billing",
        url: "#",
        icon: KanbanSquare,
        isActive: true,
        items: [
          { title: "Case board", url: "/cases/board", module: "visa" },
          { title: "Client fees", url: "/fees", module: "billing" },
          { title: "Commissions", url: "/commissions", module: "visa" },
        ],
      },
      ...(crmType !== "travel" ? [travelNavGroup()] : []),
      {
        // what students see in the agency's student portal (job openings / banners are paid add-ons)
        title: crmType === "travel" ? "Client portal" : "Student portal",
        url: "#",
        icon: GraduationCap,
        isActive: false,
        items: [
          { title: "Services store", url: "/services" },
          { title: "Portal banners", url: "/side_banner/current", addon: "side_banner" },
          { title: "Job openings", url: "/job_post/find/active", addon: "jobs" },
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
          { title: "Visa templates", url: "/crm/templates", module: "visa" },
          { title: "Branding", url: "/branding" },
          { title: "Payments (Razorpay)", url: "/settings/payments" },
          { title: "Subscription", url: "/subscription" },
          { title: "My profile", url: "/basic_profile" },
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
                {/* modules (CRM type, plan, Super Admin overrides) decide what shows; older backends fall back to plan add-ons */}
                {filterNav(data.navMain, (key?: string | null) => !key || (modules ? has(key) : (!planAddons || planAddons.includes(key) || !["jobs", "side_banner"].includes(key))))
                  .map((item: any) => (
                  <SidebarNavGroup key={item.title} item={item} styledLinks />
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
                    <ChangePasscodeItem />
                    <LogoutAllDevicesItem />
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
          <ChangePasscodeDialog />
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