import { Plane } from "lucide-react";

/**
 * Travel menu group for the owner and team sidebars. Each item names the module it needs;
 * filterNav() drops items (and empty groups) the agency does not have.
 */
export const travelNavGroup = (opts: { team?: boolean } = {}) => ({
    title: "Travel",
    url: "#",
    icon: Plane,
    isActive: true,
    items: [
        { title: "Travel desk", url: "/travel", module: "itinerary" },
        { title: "Sales pipeline", url: "/travel/pipeline", module: "itinerary" },
        { title: "Itineraries", url: "/travel/itineraries", module: "itinerary" },
        { title: "Quotes", url: "/travel/quotes", module: "itinerary" },
        { title: "Bookings", url: "/travel/bookings", module: "bookings" },
        { title: "Travellers", url: "/travel/clients", module: "bookings" },
        { title: "Packages", url: "/travel/packages", module: "itinerary" },
        { title: "Suppliers", url: "/travel/suppliers", module: "suppliers" },
        { title: "Trip finance", url: "/travel/finance", module: "suppliers" },
        { title: "Reports", url: "/travel/reports", module: "itinerary" },
        ...(opts.team ? [] : [{ title: "Library", url: "/travel/library", module: "itinerary" }]),
        { title: opts.team ? "My calendar link" : "Travel settings", url: "/travel/settings", module: "itinerary" },
    ],
});

/** Keep items whose module (and plan add-on) the agency has; drop groups that end up empty. */
export const filterNav = (groups: any[], has: (key?: string | null) => boolean) =>
    groups
        .filter((g: any) => has(g.module) && has(g.addon))
        .map((g: any) => ({ ...g, items: (g.items || []).filter((i: any) => has(i.module) && has(i.addon)) }))
        .filter((g: any) => !g.items || g.items.length > 0);
