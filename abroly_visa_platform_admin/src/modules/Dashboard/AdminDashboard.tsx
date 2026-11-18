// import { Avatar, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, useDisclosure } from '@nextui-org/react';
// import React, { useState } from 'react'
// import { Link, Route, Routes, useNavigate } from 'react-router-dom';
// import { AdminRoutes, PublicRoutes } from '../../routes/AuthRoutes';
// import ThemeToggle from '../../components/ThemeToggle';
// import Footer from '../../components/Footer';
// import CommonConfirmation from '../../components/CommonConfirmation';
// import { handleLogout } from '../../utils/LogoutUtils';
// import {
//   Home,
//   LucideLanguages,
//   LucideShieldQuestion,
//   Menu,
//   User,
// } from "lucide-react"

// import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
// import { RiHealthBookLine, RiHome5Line } from 'react-icons/ri';
// import { MdLanguage, MdOutlineDocumentScanner, MdOutlineReviews, MdOutlineSimCard } from 'react-icons/md';
// import { BsQuestion } from 'react-icons/bs';
// import { PiNewspaper } from 'react-icons/pi';

import { Home, User, FileText, ShieldQuestion, Newspaper, Star, ChevronRight, MoreHorizontal, ChevronsUpDown, BadgeCheck, Bell, LogOut, SubscriptIcon, MemoryStick, Award, Building2 } from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Suspense, useState } from "react"
import { Avatar, Spinner, useDisclosure } from "@nextui-org/react"
import { Link, Route, Routes, useNavigate } from "react-router-dom"
import CommonConfirmation from "@/components/CommonConfirmation"
import { handleLogout } from "@/utils/LogoutUtils"
import { useSelector } from "react-redux"
import { AdminRoutes } from "@/routes/AuthRoutes"
import { RiAdvertisementLine } from "react-icons/ri";
import aborlyIcon from "../../assets/logo.png"

// Super admin manages agencies only. Old platform-content screens (students, services,
// event banners, FAQs, static content, testimonials) are hidden; their routes redirect
// to Agencies (see AuthRoutes.ts). The code and data are kept.
const data = {
  navMain: [
    // SaaS: agencies, plans and payments
    {
      title: "SaaS",
      url: "#",
      icon: Building2,
      isActive: true,
      items: [
        {
          title: "Agencies",
          url: "/saas/agencies",
        },
        {
          title: "Usage & health",
          url: "/saas/usage",
        },
        {
          title: "Monitoring",
          url: "/saas/monitoring",
        },
        {
          title: "Plans",
          url: "/saas/plans",
        },
        {
          title: "Payments",
          url: "/saas/payments",
        },
        {
          title: "Coupons",
          url: "/saas/coupons",
        },
        {
          title: "Announcements",
          url: "/saas/announcements",
        },
        {
          title: "Billing settings",
          url: "/saas/billing_settings",
        },
        {
          title: "Meta / Facebook",
          url: "/saas/meta",
        },
      ],
    },
    {
      title: "Agencies",
      url: "#",
      icon: User,
      isActive: true,
      items: [
        {
          title: "Agency profiles",
          url: "/agents",
        },
        // banners agencies submit for approval
        {
          title: "Achievement requests",
          url: "/side_banner_achievements/pending",
        },
        {
          title: "Achievement history",
          url: "/side_banner_achievements/history",
        },
      ],
    },
  ],
  navSecondary: [] as { title: string; url: string; icon: React.ElementType }[],
};

const AdminDashboard = () => {
  const { phone, email, profileimage, user_name } = useSelector((state: any) => state.login);

  // for logout
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const navigate = useNavigate()

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <img src={aborlyIcon} alt="" className="size-8 shrink-0 rounded-lg shadow-sm ring-1 ring-black/5" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">TechX CRM</span>
                    <span className="truncate text-xs">Platform admin</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.isActive}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link
                        to={item.url}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.items?.length ? (
                      <>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="data-[state=open]:rotate-90">
                            <ChevronRight />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items?.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  {/* <a href={subItem.url}>
                                <span>{subItem.title}</span>
                              </a> */}
                                  <Link
                                    className={window.location.pathname == subItem.url ? "!bg-primary !text-primary-foreground font-semibold hover:!bg-primary hover:!text-primary-foreground" : ""}
                                    to={subItem.url}
                                  >
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </>
                    ) : null}
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {data.navSecondary.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild size="sm">
                      <Link
                        to={item.url}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
                    <section className="h-8 w-8 rounded-lg">
                      <Avatar
                        size="sm"
                        src={profileimage}
                        alt={user_name}
                        showFallback
                      />
                    </section>
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
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-white" // Added background color
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <section className="h-8 w-8 rounded-lg">
                        <Avatar
                          size="sm"
                          showFallback
                          src={profileimage}
                          alt={user_name}
                        />
                      </section>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpen}>
                    <LogOut className="p-1" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-semibold">Platform admin</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 pt-0 min-w-0 w-full">
          <Suspense fallback={<div className="min-h-[50vh] w-full" aria-busy="true" aria-label="Loading page" />}>
            <Routes>
              {
                AdminRoutes.map(
                  (item: any) => <Route key={item.path} path={item.path} element={<item.element />} />)
              }
            </Routes>
          </Suspense>

        </div>
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

export default AdminDashboard
