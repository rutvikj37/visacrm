import { createContext, ReactNode, useContext } from "react";
import {
    BadgeCheck, Bed, Bus, Car, Coins, Luggage, Map as MapIcon, Plane, Plus, Shield, Sparkles, Stamp, Ticket, TrainFront, Utensils,
} from "lucide-react";
import { Line, Option, TONE, Totals, serviceDef } from "./quoteKit";

/** Everything the builder steps share: the quote, its options, totals and how to change them. */
export type QuoteCtx = {
    q: any;
    set: (patch: Record<string, any>) => void;
    options: Option[];
    oi: number;
    setOi: (i: number) => void;
    lines: Line[];
    setLines: (fn: (ls: Line[]) => Line[]) => void;
    setOptions: (fn: (os: Option[]) => Option[]) => void;
    t: Totals;
    canEdit: boolean;
    seesCost: boolean;
    reload: () => Promise<void>;
    save: (extra?: Record<string, any>) => Promise<boolean>;
    go: (step: number) => void;
};

const Ctx = createContext<QuoteCtx | null>(null);
export const QuoteProvider = ({ value, children }: { value: QuoteCtx; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useQuote = () => {
    const v = useContext(Ctx);
    if (!v) throw new Error("useQuote outside QuoteProvider");
    return v;
};

const ICONS: Record<string, any> = {
    plane: Plane, luggage: Luggage, train: TrainFront, bus: Bus, bed: Bed, map: MapIcon, stamp: Stamp, sparkles: Sparkles, car: Car,
    utensils: Utensils, ticket: Ticket, shield: Shield, coins: Coins, plus: Plus, check: BadgeCheck,
};

/** Coloured round icon for a service type. */
export const ServiceIcon = ({ type, size = 16, className = "" }: { type: string; size?: number; className?: string }) => {
    const def = serviceDef(type);
    const Icon = ICONS[def.icon] || Plus;
    return <span className={`inline-grid place-items-center rounded-xl shrink-0 ${TONE[def.tone] || TONE.slate} ${className}`} style={{ width: size + 16, height: size + 16 }}><Icon size={size} /></span>;
};

/** White card with a heading, used by every step. */
export const Panel = ({ title, sub, right, children, className = "" }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) => (
    <section className={`rounded-2xl border border-default-200 bg-content1 p-4 sm:p-5 shadow-sm ${className}`}>
        {(title || right) && (
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                    {title && <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>}
                    {sub && <p className="text-sm text-default-500 mt-0.5">{sub}</p>}
                </div>
                {right}
            </div>
        )}
        {children}
    </section>
);

/** Two-way choice shown as big tappable cards (Domestic / International, Exclusive / Inclusive...). */
export const Choice = <T extends string>({ value, onChange, items, disabled, cols = 2 }: { value: T; onChange: (v: T) => void; items: { key: T; title: string; text?: string; icon?: ReactNode }[]; disabled?: boolean; cols?: number }) => (
    <div className={`grid gap-2 ${cols === 3 ? "sm:grid-cols-3" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2"}`}>
        {items.map((it) => {
            const on = it.key === value;
            return (
                <button key={it.key} type="button" disabled={disabled} onClick={() => onChange(it.key)}
                    className={`text-left rounded-xl border px-3.5 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${on ? "border-primary bg-primary-50 ring-1 ring-primary dark:bg-primary/10" : "border-default-200 hover:border-default-400 bg-content1"}`}>
                    <div className="flex items-center gap-2">
                        <span className={`h-4 w-4 rounded-full border-2 grid place-items-center shrink-0 ${on ? "border-primary" : "border-default-300"}`}>{on && <span className="h-2 w-2 rounded-full bg-primary" />}</span>
                        {it.icon}
                        <span className={`font-medium text-sm ${on ? "text-primary" : "text-foreground"}`}>{it.title}</span>
                    </div>
                    {it.text && <div className="text-xs text-default-500 mt-1 pl-6">{it.text}</div>}
                </button>
            );
        })}
    </div>
);

/** − n + counter for travellers. */
export const Counter = ({ label, hint, value, onChange, min = 0, disabled }: { label: string; hint?: string; value: number; onChange: (n: number) => void; min?: number; disabled?: boolean }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-default-200 px-3 py-2.5">
        <div><div className="text-sm font-medium">{label}</div>{hint && <div className="text-xs text-default-500">{hint}</div>}</div>
        <div className="flex items-center gap-2">
            <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className="h-8 w-8 rounded-full border border-default-300 text-lg leading-none disabled:opacity-40">−</button>
            <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
            <button type="button" disabled={disabled || value >= 99} onClick={() => onChange(value + 1)} className="h-8 w-8 rounded-full border border-primary text-primary text-lg leading-none disabled:opacity-40">+</button>
        </div>
    </div>
);

export const SumRow = ({ k, v, strong, muted, tone, indent }: { k: ReactNode; v: ReactNode; strong?: boolean; muted?: boolean; tone?: "success" | "danger"; indent?: boolean }) => (
    <div className={`flex justify-between gap-4 py-1 ${strong ? "text-base font-semibold border-t border-default-200 pt-2 mt-1" : "text-sm"} ${muted ? "text-default-500" : ""} ${indent ? "pl-4 text-xs" : ""} ${tone === "success" ? "text-success-600 font-medium" : tone === "danger" ? "text-danger font-medium" : ""}`}>
        <span>{k}</span><span className="tabular-nums text-right">{v}</span>
    </div>
);
