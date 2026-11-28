import { Avatar } from "@heroui/react";
import { useSelector } from "react-redux";
import { SidebarMenuButton } from "@/components/ui/sidebar";

/** Top of the sidebar: the agency's logo and name (from Branding), not the platform's. */
const SidebarBrand = ({ subtitle }: { subtitle: string }) => {
    const agency = useSelector((state: any) => state.login.agency);
    const name = agency?.name || "Agency";
    const media = agency?.logo ? (
        <img src={agency.logo} alt="" className="size-8 rounded-lg object-cover" />
    ) : (
        <Avatar name={name} showFallback className="size-8 min-w-8 rounded-lg text-tiny" />
    );
    return (
        <SidebarMenuButton
            size="lg"
            className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">{media}</span>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-xs text-default-500">{subtitle}</span>
            </div>
        </SidebarMenuButton>
    );
};

export default SidebarBrand;
