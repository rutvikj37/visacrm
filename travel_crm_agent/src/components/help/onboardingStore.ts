import { useEffect, useState } from "react";

/**
 * Tutorial switch: the "Get your agency set up" checklist on Today and the first-visit tips on each screen.
 * Turned off for now - set to true to bring both back (the Help drawer controls come back with it).
 */
export const TUTORIAL_ENABLED = false;

/** Shared onboarding status (checklist + support number), loaded once and refreshed on demand. */
let cache: any = null;
let inflight: Promise<any> | null = null;
const listeners = new Set<(d: any) => void>();

export const loadOnboarding = (get: (url: string) => Promise<any>, force = false) => {
    if (cache && !force) return Promise.resolve(cache);
    if (!inflight || force) {
        inflight = get("/crm/onboarding").then(({ success, data }: any) => {
            if (success) { cache = data; listeners.forEach((l) => l(cache)); }
            inflight = null;
            return cache;
        });
    }
    return inflight;
};

export const useOnboarding = (get: (url: string) => Promise<any>) => {
    const [data, setData] = useState<any>(cache);
    useEffect(() => {
        listeners.add(setData);
        loadOnboarding(get);
        return () => { listeners.delete(setData); };
    }, []);
    return { data, reload: () => loadOnboarding(get, true) };
};

/** One-time hints: shown until dismissed, remembered in this browser. */
const SEEN_KEY = "abroly_tips_seen";
export const tipSeen = (id: string) => { try { return (JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]).includes(id); } catch { return false; } };
export const markTipSeen = (id: string) => {
    try {
        const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
        seen.add(id);
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch { /* storage blocked */ }
};
export const resetTips = () => { try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ } };
