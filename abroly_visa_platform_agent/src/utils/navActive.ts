/**
 * Sidebar active state that respects query strings.
 * Example: /crm/leads vs /crm/leads?follow_up=today must not both highlight.
 */
export const isNavItemActive = (url: string, pathname: string, search: string): boolean => {
    const [path, qs = ""] = url.split("?");
    const pathMatch = pathname === path || (path !== "/" && (pathname === path || pathname.startsWith(`${path}/`)));
    if (!pathMatch) return false;

    const wanted = new URLSearchParams(qs);
    const current = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

    for (const [key, value] of wanted.entries()) {
        if (current.get(key) !== value) return false;
    }

    // Bare path (no query in nav URL): not active when current has query keys
    // that sibling nav items use for the same path (e.g. follow_up on Lead Inbox).
    if (!qs && path === "/crm/leads" && current.get("follow_up")) return false;

    return true;
};
