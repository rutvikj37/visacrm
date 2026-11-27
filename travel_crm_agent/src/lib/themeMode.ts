import { useEffect, useState } from "react";

/**
 * Light / dark / system mode for the panel, saved per browser ("panel_theme").
 * Default is light when nothing is stored; index.html applies it before first paint.
 */
export type ThemeMode = "light" | "dark" | "system";
const KEY = "panel_theme";

export const getThemeMode = (): ThemeMode => {
    try {
        const v = localStorage.getItem(KEY);
        return v === "dark" || v === "light" || v === "system" ? v : "light";
    } catch {
        return "light";
    }
};
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
export const applyThemeMode = (mode: ThemeMode = getThemeMode()) => {
    const dark = mode === "dark" || (mode === "system" && prefersDark());
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
    window.dispatchEvent(new CustomEvent("theme-mode", { detail: { mode, dark } }));
};
export const setThemeMode = (mode: ThemeMode) => {
    try { localStorage.setItem(KEY, mode); } catch { /* storage blocked */ }
    applyThemeMode(mode);
};

export const useThemeMode = () => {
    const [mode, setMode] = useState<ThemeMode>(getThemeMode);
    const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
    useEffect(() => {
        const on = (e: any) => { setMode(e.detail.mode); setDark(e.detail.dark); };
        window.addEventListener("theme-mode", on);
        // follow the phone / computer setting while on "system"
        const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
        const sys = () => { if (getThemeMode() === "system") applyThemeMode("system"); };
        mq?.addEventListener?.("change", sys);
        return () => { window.removeEventListener("theme-mode", on); mq?.removeEventListener?.("change", sys); };
    }, []);
    return { mode, dark, setThemeMode };
};
