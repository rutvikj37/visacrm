/** Keep menu items whose module (and plan add-on) the agency has; drop groups that end up empty. */
export const filterNav = (groups: any[], has: (key?: string | null) => boolean) =>
    groups
        .filter((g: any) => has(g.module) && has(g.addon))
        .map((g: any) => ({ ...g, items: (g.items || []).filter((i: any) => has(i.module) && has(i.addon)) }))
        .filter((g: any) => !g.items || g.items.length > 0);
