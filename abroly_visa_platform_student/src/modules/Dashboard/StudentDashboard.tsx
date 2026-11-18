import {
  Briefcase,
  ChevronsUpDown,
  Contact,
  FileCheck2,
  Home,
  IndianRupee,
  LogOut,
  MessageCircleQuestion,
  MessagesSquare,
  Route as RouteIcon,
  Store,
  UserRound,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Suspense, useMemo, type ComponentType } from "react"
import { Avatar, useDisclosure } from "@nextui-org/react"
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { StudentRoutes } from "@/routes/AuthRoutes"
import CommonConfirmation from "@/components/CommonConfirmation"
import LogoutAllDevicesItem from "@/components/LogoutAllDevicesItem"
import { handleLogout } from "@/utils/LogoutUtils"
import { useSelector } from "react-redux"
import { getAppName, getConfig } from "@/utils/config"
import { AgencyLogo, StudentTopBar } from "@/components/AgencyBrand"
import StudentBottomNav from "@/components/StudentBottomNav"
import { PRIMARY_COLOR, PRIMARY_COLOR_FOREGROUND } from "@/lib/theme"

type NavLink = {
  title: string
  url: string
  icon: ComponentType<{ className?: string }>
  addon?: string
  match?: (pathname: string) => boolean
}

const MAIN_LINKS: NavLink[] = [
  { title: "Home", url: "/", icon: Home, match: (p) => p === "/" },
  {
    title: "My progress",
    url: "/my_progress",
    icon: RouteIcon,
    match: (p) => p.startsWith("/my_progress"),
  },
  { title: "Chat with counsellor", url: "/chat", icon: MessagesSquare, match: (p) => p.startsWith("/chat") },
  { title: "My fees", url: "/my_fees", icon: IndianRupee, match: (p) => p.startsWith("/my_fees") },
  { title: "Services", url: "/services", icon: Store, match: (p) => p === "/services" || p.startsWith("/services/orders") },
  {
    title: "My applications",
    url: "/accepted_applications",
    icon: FileCheck2,
    match: (p) => p.startsWith("/accepted_applications"),
  },
  {
    title: "Jobs",
    url: "/career/1",
    icon: Briefcase,
    addon: "jobs",
    match: (p) => p.startsWith("/career"),
  },
]

const ACCOUNT_LINKS: NavLink[] = [
  { title: "Student profile", url: "/student_profile", icon: UserRound, match: (p) => p.startsWith("/student_profile") },
  { title: "FAQs", url: "/faq", icon: MessageCircleQuestion, match: (p) => p.startsWith("/faq") },
  { title: "Contact us", url: "/contact_us", icon: Contact, match: (p) => p.startsWith("/contact") },
]

const isActiveLink = (item: NavLink, pathname: string) =>
  item.match ? item.match(pathname) : pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))

const NavLinkButton = ({ item }: { item: NavLink }) => {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const active = isActiveLink(item, pathname)
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={active}>
        <Link
          to={item.url}
          onClick={() => { if (isMobile) setOpenMobile(false) }}
          className="no-underline"
          style={
            active
              ? { backgroundColor: PRIMARY_COLOR, color: PRIMARY_COLOR_FOREGROUND, textDecoration: "none" }
              : { textDecoration: "none" }
          }
        >
          <Icon />
          <span className="font-medium">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const StudentDashboard = () => {
  const planAddons: string[] | null = (() => {
    try { return JSON.parse(getConfig("ADDONS") || "null") } catch { return null }
  })()

  const { isOpen, onOpenChange } = useDisclosure()
  const navigate = useNavigate()
  const { phone, profileimage, user_name } = useSelector((state: any) => state.login)

  const mainLinks = MAIN_LINKS.filter((item) => !item.addon || !planAddons || planAddons.includes(item.addon))

  const routeNodes = useMemo(
    () => StudentRoutes.map((item: any) => (
      <Route key={item.path} path={item.path} element={<item.element />} />
    )),
    []
  )

  return (
    <>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="pointer-events-none">
                  <AgencyLogo size={32} />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{getAppName()}</span>
                    <span className="truncate text-xs text-default-500">Student portal</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarMenu>
                {mainLinks.map((item) => (
                  <NavLinkButton key={item.url + item.title} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ACCOUNT_LINKS.map((item) => (
                    <NavLinkButton key={item.url} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
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
                      <Avatar src={profileimage} showFallback className="h-8 w-8 rounded-lg" />
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user_name}</span>
                        <span className="truncate text-xs">{phone}</span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-content1"
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar src={profileimage} showFallback className="h-8 w-8 rounded-lg" />
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">{user_name}</span>
                          <span className="truncate text-xs">{phone}</span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenChange}>
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                    <LogoutAllDevicesItem />
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-default-100 bg-background/90 backdrop-blur px-3 sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <StudentTopBar />
          </header>

          <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 min-w-0 w-full pb-24 md:pb-4">
            <Suspense fallback={<div className="min-h-[40vh] w-full" aria-busy="true" aria-label="Loading page" />}>
              <Routes>{routeNodes}</Routes>
            </Suspense>
          </div>

          <StudentBottomNav />
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
    </>
  )
}

export default StudentDashboard
