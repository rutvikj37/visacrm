import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from "@/components/ui/sidebar";
import { PRIMARY_COLOR, PRIMARY_COLOR_FOREGROUND } from "@/lib/theme";
import UnreadChatsBadge from "@/modules/AgentAdmin/Chats/UnreadChatsBadge";
import { isNavItemActive } from "@/utils/navActive";

type NavSubItem = { title: string; url: string };
type NavItem = {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    isActive?: boolean;
    items?: NavSubItem[];
};

/** Parent nav section: expands when sidebar is open; flyout menu when collapsed to icons. */
const SidebarNavGroup = ({ item, styledLinks = false }: { item: NavItem; styledLinks?: boolean }) => {
    const { state, isMobile } = useSidebar();
    const { pathname, search } = useLocation();
    const collapsed = state === "collapsed" && !isMobile;
    const Icon = item.icon;
    const subs = item.items || [];

    const label = (sub: NavSubItem) => (
        <span className="flex items-center gap-1 w-full">
            {sub.title}
            {sub.url === "/crm/chats" && <UnreadChatsBadge />}
        </span>
    );

    if (collapsed) {
        return (
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                            {Icon && <Icon />}
                            <span>{item.title}</span>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-48">
                        <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                        {subs.map((sub) => (
                            <DropdownMenuItem key={sub.title} asChild>
                                <Link to={sub.url}>{label(sub)}</Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        );
    }

    return (
        <Collapsible asChild defaultOpen={item.isActive} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title}>
                        {Icon && <Icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {subs.map((sub) => {
                            const active = isNavItemActive(sub.url, pathname, search);
                            return (
                                <SidebarMenuSubItem key={sub.title}>
                                    <SidebarMenuSubButton asChild>
                                        {styledLinks ? (
                                            <Link
                                                to={sub.url}
                                                className={`
                                      w-full h-9 px-3 rounded-md transition-colors duration-150
                                      flex items-center font-medium text-sm no-underline
                                      ${active
                                                        ? "text-white font-semibold shadow-md"
                                                        : "text-gray-700 hover:bg-gray-100"
                                                    }
                                    `}
                                                style={active ? {
                                                    background: PRIMARY_COLOR,
                                                    color: PRIMARY_COLOR_FOREGROUND,
                                                    textDecoration: "none",
                                                } : { textDecoration: "none" }}
                                            >
                                                {label(sub)}
                                            </Link>
                                        ) : (
                                            <Link
                                                className={active ? "!bg-primary !text-primary-foreground font-semibold hover:!bg-primary hover:!text-primary-foreground" : ""}
                                                to={sub.url}
                                            >
                                                {label(sub)}
                                            </Link>
                                        )}
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
};

export default SidebarNavGroup;
