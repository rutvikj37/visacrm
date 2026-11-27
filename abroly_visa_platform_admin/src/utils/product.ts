/**
 * The platform has two separate products, each with its own API and database:
 *   Visa CRM   -> VITE_API_BASE_URL
 *   Travel CRM -> VITE_TRAVEL_API_BASE_URL (leave empty to hide the switch)
 * This admin panel manages one product at a time. The choice is kept in localStorage; switching
 * signs out, because each product has its own admin accounts and login.
 */
export type Product = "visa" | "travel";

const KEY = "admin_product";
const VISA_API = import.meta.env.VITE_API_BASE_URL as string;
const TRAVEL_API = (import.meta.env.VITE_TRAVEL_API_BASE_URL as string | undefined) || "";

export const travelAvailable = () => Boolean(TRAVEL_API);

export const getProduct = (): Product => (travelAvailable() && localStorage.getItem(KEY) === "travel" ? "travel" : "visa");

export const productName = (p: Product = getProduct()) => (p === "travel" ? "Travel CRM" : "Visa CRM");

/** API base (…/api) of the product being managed. */
export const apiBase = (): string => (getProduct() === "travel" ? TRAVEL_API : VISA_API);

/** Clear the session but keep which product was picked. */
export const clearSession = () => {
    const p = localStorage.getItem(KEY);
    localStorage.clear();
    if (p) localStorage.setItem(KEY, p);
};

export const switchProduct = (p: Product) => {
    if (p === getProduct()) return;
    localStorage.clear();
    localStorage.setItem(KEY, p);
    window.location.href = "/";
};
