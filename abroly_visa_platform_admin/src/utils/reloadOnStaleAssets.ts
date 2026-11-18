/**
 * After a deploy, a tab that was already open still points at the old script files, which
 * the new build no longer has (404: "Failed to fetch dynamically imported module").
 * Reload once to pick up the new build instead of showing a broken page.
 * The time guard stops a reload loop if the file really is missing.
 */
const KEY = "stale-assets-reloaded-at";
const GUARD_MS = 30_000;

const reloadOnce = () => {
    try {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last < GUARD_MS) return false;
        sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
        // storage blocked: still reload, the browser cache makes a loop unlikely
    }
    window.location.reload();
    return true;
};

const isStaleChunkError = (reason: unknown) =>
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        String((reason as any)?.message || reason || "")
    );

export const reloadOnStaleAssets = () => {
    // Vite fires this when a lazy-loaded chunk (or its CSS) fails to load
    window.addEventListener("vite:preloadError", (event) => {
        if (reloadOnce()) event.preventDefault();
    });
    window.addEventListener("unhandledrejection", (event) => {
        if (isStaleChunkError(event.reason) && reloadOnce()) event.preventDefault();
    });
};
