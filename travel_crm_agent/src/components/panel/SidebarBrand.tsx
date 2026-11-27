import { useSelector } from "react-redux";
import { SidebarMenuButton } from "@/components/ui/sidebar";

/** Top of the sidebar: the agency's logo and name (from Branding), not the platform's. */
const SidebarBrand = ({ subtitle }: { subtitle: string }) => {
    const agency = useSelector((state: any) => state.login.agency);
    const name = agency?.name || "Agency";
    return (
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            {agency?.logo
                ? <img src={agency.logo} alt="" className="size-8 rounded-lg object-cover shrink-0" />
                : <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">{name.slice(0, 1).toUpperCase()}</div>}
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-xs text-default-500">{subtitle}</span>
            </div>
        </SidebarMenuButton>
    );
};

export default SidebarBrand;
