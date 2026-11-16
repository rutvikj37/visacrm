
import UnreadChatsBadge from "@/modules/AgentAdmin/Chats/UnreadChatsBadge"
import {

  Calendar,
  ChevronRight,
  ChevronsUpDown,
  Folder,
  Forward,
  Inbox,
  LogOut,
  MoreHorizontal,
  Trash2,
  Users, Home } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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
  SidebarMenuAction,
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
import { SubAgentRoutes } from "@/routes/AuthRoutes"
import { useSelector } from "react-redux"
import { BarChart3 } from "lucide-react"
import { useMemo } from "react"
import aborlyIcon from "../../assets/logo.png"
import SubscriptionBanner from "@/modules/AgentAdmin/Subscription/SubscriptionBanner"
import AnnouncementBanner from "@/modules/AgentAdmin/Notifications/AnnouncementBanner"
import SidebarBrand from "@/components/panel/SidebarBrand"
import PanelHeader from "@/components/panel/PanelHeader"
import PanelBottomNav from "@/components/panel/PanelBottomNav"
import KeyboardShortcuts from "@/components/panel/KeyboardShortcuts"
import NotificationBell from "@/modules/AgentAdmin/Notifications/NotificationBell"
import { isNavItemActive } from "@/utils/navActive"

const SubAgentCRM = () => {
  // for logout
  const { isOpen, onOpenChange } = useDisclosure();

  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const routeNodes = useMemo(
    () => SubAgentRoutes.map((item: any) => (
      <Route key={item.path} path={item.path} element={<item.element />} />
    )),
    []
  )
  const teamRoleForMenu = useSelector((state: any) => state.login.team_role)
  const branchForMenu = useSelector((state: any) => state.login.branch_id)
  const data = {
    navMain: [
      // a branch manager sees their branch's report
      ...(teamRoleForMenu === "branch_manager" && branchForMenu ? [{
        title: "Branch",
        url: "#",
        icon: BarChart3,
        isActive: true,
        items: [{ title: "Branch report", url: "/reports" }],
      }] : []),
      {
        title: "Home",
        url: "#",
        icon: Home,
        isActive: true,
        items: [{ title: "Today", url: "/" }],
      },
      // Lead CRM (leads assigned to me)
      {
        title: "Lead CRM",
        url: "#",
        icon: Users,
        isActive: true,
        items: [
          {
            title: "Lead Inbox",
            url: "/crm/leads",
          },
          {
            title: "Chats",
            url: "/crm/chats",
          },
          {
            title: "Tasks",
            url: "/crm/tasks",
          },
          {
            title: "Follow-ups Today",
            url: "/crm/leads?follow_up=today",
          },
          {
            title: "Calendar",
            url: "/crm/calendar",
          },
        ],
      },
      {
        title: "Visa Processing",
        url: "#",
        icon: Inbox,
        isActive: true,
        items: [
          {
            title: "Case Board",
            url: "/cases/board",
          },
          {
            title: "Client Fees",
            url: "/fees",
          },
          // {
          //   title: "Leads",
          //   url: "/leads",
          // },
          {
            title: "Students",
            url: "/leads/students",
          },
          {
            title: "Applications",
            url: "/leads/applications",
          },
          {
            title: "Visa",
            url: "/leads/visa",
          },
          {
            title: "Withdrawn Applicants",
            url: "/leads/withdrawn",
          },
        ],
      },
      // {
      //   title: "Calendar",
      //   url: "/",
      //   icon: Calendar,
      //   isActive: true,
      //   items: [
      //     {
      //       title: "Remiders",
      //       url: "/",
      //     },
      //   ],
      // },
      // {
      //   title: "Users",
      //   url: "#",
      //   icon: Users,
      //   isActive: true,
      //   items: [
      //     {
      //       title: "Sub Agents",
      //       url: "/sub_agent",
      //     },
      //   ],
      // },
      // {
      //   title: "Models",
      //   url: "#",
      //   icon: Bot,
      //   items: [
      //     {
      //       title: "Genesis",
      //       url: "#",
      //     },
      //     {
      //       title: "Explorer",
      //       url: "#",
      //     },
      //     {
      //       title: "Quantum",
      //       url: "#",
      //     },
      //   ],
      // },
      // {
      //   title: "Documentation",
      //   url: "#",
      //   icon: BookOpen,
      //   items: [
      //     {
      //       title: "Introduction",
      //       url: "#",
      //     },
      //     {
      //       title: "Get Started",
      //       url: "#",
      //     },
      //     {
      //       title: "Tutorials",
      //       url: "#",
      //     },
      //     {
      //       title: "Changelog",
      //       url: "#",
      //     },
      //   ],
      // },
      // {
      //   title: "Settings",
      //   url: "#",
      //   icon: Settings2,
      //   items: [
      //     {
      //       title: "General",
      //       url: "#",
      //     },
      //     {
      //       title: "Team",
      //       url: "#",
      //     },
      //     {
      //       title: "Billing",
      //       url: "#",
      //     },
      //     {
      //       title: "Limits",
      //       url: "#",
      //     },
      //   ],
      // },
    ],
    projects: [
      // {
      //   name: "Design Engineering",
      //   url: "#",
      //   icon: Frame,
      // },
      // {
      //   name: "Sales & Marketing",
      //   url: "#",
      //   icon: PieChart,
      // },
      // {
      //   name: "Travel",
      //   url: "#",
      //   icon: Map,
      // },
    ],
  }

  const { phone, email, profileimage, user_name, designation } = useSelector((state: any) => state.login);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>

              <SidebarBrand subtitle="Team panel" />

            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarMenu>
              {data.navMain.map((item) => (
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
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                className={isNavItemActive(subItem.url, pathname, search) ? "!bg-primary !text-primary-foreground font-semibold hover:!bg-primary hover:!text-primary-foreground" : ""}
                                to={subItem.url}
                              ><span className="flex items-center w-full">{subItem.title}{subItem.url === "/crm/chats" && <UnreadChatsBadge />}</span></Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
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
                        {user_name} <span className="text-tiny font-medium">({designation})</span>
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
                          {user_name} <span className="text-tiny font-medium">({designation})</span>
                        </span>
                        <span className="truncate text-xs">
                          {phone}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpenChange}>
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
        <PanelHeader />
        <div className="flex flex-1 flex-col p-3 sm:p-4 min-w-0 w-full pb-24 md:pb-4">
          <SubscriptionBanner />
          <AnnouncementBanner />
          <Routes>{routeNodes}</Routes>
        </div>
        <PanelBottomNav />
          <KeyboardShortcuts />
        </SidebarInset>

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
    </SidebarProvider>

  )
}

export default SubAgentCRM