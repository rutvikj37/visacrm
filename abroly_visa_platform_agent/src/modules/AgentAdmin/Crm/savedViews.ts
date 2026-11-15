/** Per-user saved filter views for the Lead Inbox (localStorage). */

export type SavedViewFilters = {
    status?: string;
    source?: string;
    assigned_to?: string;
    follow_up?: string;
    temperature?: string;
    branch?: string;
    created?: string;
    search?: string;
};

export type SavedView = {
    id: string;
    name: string;
    filters: SavedViewFilters;
    preset?: boolean;
};

const storageKey = (userKey: string) => `crm_lead_views:${userKey || "anon"}`;

export const PRESET_VIEWS: SavedView[] = [
    {
        id: "preset-my-overdue",
        name: "My overdue",
        preset: true,
        filters: { status: "open", assigned_to: "me", follow_up: "overdue" },
    },
    {
        id: "preset-meta-today",
        name: "Meta ads today",
        preset: true,
        filters: { source: "facebook", created: "today", status: "open" },
    },
    {
        id: "preset-unassigned-branch",
        name: "Unassigned this branch",
        preset: true,
        filters: { status: "open", assigned_to: "unassigned", branch: "__mine__" },
    },
];

export const loadCustomViews = (userKey: string): SavedView[] => {
    try {
        const raw = localStorage.getItem(storageKey(userKey));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((v) => v && typeof v.id === "string" && typeof v.name === "string" && v.filters)
            .map((v) => ({ id: v.id, name: String(v.name).slice(0, 40), filters: v.filters as SavedViewFilters }));
    } catch {
        return [];
    }
};

export const saveCustomViews = (userKey: string, views: SavedView[]) => {
    try {
        const custom = views.filter((v) => !v.preset).map(({ id, name, filters }) => ({ id, name, filters }));
        localStorage.setItem(storageKey(userKey), JSON.stringify(custom));
    } catch { /* private mode */ }
};

export const allViews = (userKey: string) => [...PRESET_VIEWS, ...loadCustomViews(userKey)];

/** Resolve special tokens like __mine__ for branch using the caller's branch id. */
export const resolveViewFilters = (filters: SavedViewFilters, myBranch: number | null): SavedViewFilters => {
    const next = { ...filters };
    if (next.branch === "__mine__") {
        next.branch = myBranch ? String(myBranch) : "";
    }
    return next;
};

export const filtersFromParams = (params: URLSearchParams): SavedViewFilters => {
    const keys = ["status", "source", "assigned_to", "follow_up", "temperature", "branch", "created", "search"] as const;
    const out: SavedViewFilters = {};
    for (const k of keys) {
        const v = params.get(k);
        if (v) out[k] = v;
    }
    return out;
};

export const applyFiltersToParams = (filters: SavedViewFilters, keepView?: string) => {
    const next = new URLSearchParams();
    if (keepView === "board") next.set("view", "board");
    const entries: [keyof SavedViewFilters, string | undefined][] = [
        ["status", filters.status],
        ["source", filters.source],
        ["assigned_to", filters.assigned_to],
        ["follow_up", filters.follow_up],
        ["temperature", filters.temperature],
        ["branch", filters.branch],
        ["created", filters.created],
        ["search", filters.search],
    ];
    for (const [k, v] of entries) {
        if (v) next.set(k, v);
    }
    return next;
};

export const viewMatchesParams = (filters: SavedViewFilters, params: URLSearchParams, myBranch: number | null) => {
    const resolved = resolveViewFilters(filters, myBranch);
    const keys = ["status", "source", "assigned_to", "follow_up", "temperature", "branch", "created", "search"] as const;
    for (const k of keys) {
        const want = resolved[k] || "";
        const have = params.get(k) || "";
        // presets that omit status should still match "open" default on the inbox
        if (k === "status") {
            const haveNorm = have || "open";
            const wantNorm = want || "open";
            if (wantNorm !== haveNorm) return false;
            continue;
        }
        if (want !== have) return false;
    }
    return true;
};
