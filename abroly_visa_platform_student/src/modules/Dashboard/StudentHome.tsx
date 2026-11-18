import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle, ArrowRight, Briefcase, CalendarDays, CheckCircle2, ChevronRight, Clock, FileCheck2, FileText, FileUp,
    Fingerprint, GraduationCap, IndianRupee, Mail, MessagesSquare, PartyPopper, PencilLine, Phone, RefreshCw, Send,
    Sparkles, Store, UserRound, Wallet, type LucideIcon,
} from "lucide-react";
import { commonGetAPICalls } from "@/utils/ApiCallUtils";
import { useT } from "@/utils/i18n";
import { getAppName, getConfig, getSupportEmail, getSupportNumber } from "@/utils/config";
import { useChatUpdates } from "@/lib/realtime";
import InstallAppCard from "@/components/InstallAppCard";
import AchievementBanner from "@/modules/AchievementBanner/AchievementBanner";
import { STAGES, fmt, overdue, stageIndex } from "@/modules/VisaConsultation/ProgressTracker";

/* ------------------------------------------------------------------ data */

const rupees = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const caseLabel = (c: any, fallback: string) => [c.country, c.university].filter(Boolean).join(" · ") || fallback;

/** Same query keys as the Progress / Fees / Services pages, so the cache is shared between them. */
const useHomeData = () => {
    const qc = useQueryClient();
    const overview = useQuery({
        queryKey: ["student_overview"],
        queryFn: async () => {
            const { data, success } = await commonGetAPICalls("/leads/lead_progress/student/overview");
            if (!success) throw new Error("overview");
            return Array.isArray(data) ? data : [];
        },
        retry: 1,
    });
    const fees = useQuery({
        queryKey: ["student_fees"],
        queryFn: async () => {
            const { data, success } = await commonGetAPICalls("/student/fees");
            return success ? data : null;
        },
    });
    const orders = useQuery({
        queryKey: ["student_service_orders"],
        queryFn: async () => {
            const { data, success } = await commonGetAPICalls("/student/service_orders");
            return success ? data : null;
        },
    });
    // the unread count only - opening /student/chat would mark the messages as read
    const unread = useQuery({
        queryKey: ["student_chat_unread"],
        queryFn: async () => {
            const { data, success } = await commonGetAPICalls("/student/chat/unread");
            return success ? Number(data?.unread || 0) : 0;
        },
    });
    useChatUpdates(() => { qc.invalidateQueries({ queryKey: ["student_chat_unread"] }); });
    return { overview, fees, orders, unread };
};

type Todo = {
    key: string;
    icon: LucideIcon;
    title: string;
    meta?: string;
    cta: string;
    tone: "danger" | "warning" | "brand";
    rank: number;
    sortDate: string;
    onClick: () => void;
};

/* ------------------------------------------------------------- building blocks */

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <section className={`rounded-2xl border border-default-200 bg-content1 shadow-sm ${className}`}>{children}</section>
);

const SectionTitle = ({ icon: Icon, children, action }: { icon?: LucideIcon; children: ReactNode; action?: ReactNode }) => (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {Icon && <Icon size={18} className="text-primary shrink-0" />}
        <h2 className="text-base font-semibold text-foreground flex-1 min-w-0 truncate">{children}</h2>
        {action}
    </div>
);

const Skeleton = ({ className = "" }: { className?: string }) => <div className={`rounded-xl bg-black/5 dark:bg-white/10 animate-pulse ${className}`} />;

/** Progress ring drawn in the text colour, for use on the brand-coloured hero. */
const Ring = ({ pct }: { pct: number }) => {
    const r = 26, c = 2 * Math.PI * r;
    return (
        <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${pct}%`}>
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" stroke="currentColor" className="opacity-25" />
                <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke="currentColor" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-sm font-bold">{pct}%</span>
        </div>
    );
};

/** Six-stage journey (same stages as the agency case board): segments, with labels from tablet width. */
const StageBar = ({ stage, done }: { stage?: string | null; done?: boolean }) => {
    const { t } = useT();
    const at = done ? STAGES.length - 1 : stageIndex(stage);
    return (
        <div>
            <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
                {STAGES.map((s, i) => (
                    <span key={s.key} className={`h-1.5 rounded-full ${i <= at ? "bg-current" : "bg-current opacity-25"}`} />
                ))}
            </div>
            <div className="hidden sm:grid grid-cols-6 gap-1.5 mt-1.5 text-[11px] leading-tight">
                {STAGES.map((s, i) => (
                    <span key={s.key} className={i === at ? "font-semibold" : "opacity-70"}>{t(s.label)}</span>
                ))}
            </div>
            <div className="sm:hidden mt-1.5 text-xs">
                <span className="opacity-80">{t("now")}:</span> <span className="font-semibold">{t(STAGES[at].label)}</span>
                {at < STAGES.length - 1 && <span className="opacity-80"> · {t("next")}: {t(STAGES[at + 1].label)}</span>}
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------- sections */

/** (1) Where the case stands - brand-coloured, the first thing on the screen. */
const CaseHero = ({ c }: { c: any }) => {
    const { t } = useT();
    const navigate = useNavigate();
    const approved = c.status === "visa_completed";
    const rejected = c.status === "visa_rejected";
    const pct = c.steps_total ? Math.round((c.steps_done / c.steps_total) * 100) : 0;
    const openStep = c.current_step ? c.current_step.number - 1 : 0;
    const dates = [
        c.visa?.lodged_on && t("visa_filed_on", { date: fmt(c.visa.lodged_on) }),
        c.visa?.biometrics_on && t("biometrics_on", { date: fmt(c.visa.biometrics_on) }),
        c.visa?.decision_on && t("decision_on", { date: fmt(c.visa.decision_on) }),
    ].filter(Boolean) as string[];

    return (
        <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-md">
            {/* soft decoration, follows the brand colour */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -right-4 bottom-[-4.5rem] h-40 w-40 rounded-full bg-white/5" />

            <div className="relative p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="opacity-85 uppercase tracking-wide">{t("case_status")}</span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                        {approved ? <><CheckCircle2 size={14} /> {t("visa_approved")}</>
                            : rejected ? <><AlertCircle size={14} /> {t("visa_not_approved").split(" - ")[0]}</>
                                : <><Clock size={14} /> {t("in_progress")}</>}
                    </span>
                </div>

                <div className="flex items-start gap-4">
                    {!approved && !rejected && c.steps_total > 0 && <Ring pct={pct} />}
                    {approved && <div className="h-16 w-16 shrink-0 grid place-items-center rounded-full bg-white/20"><PartyPopper size={30} /></div>}
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">{caseLabel(c, t("visa_application"))}</h1>
                        {(c.course || c.reapplication) && (
                            <div className="mt-0.5 text-sm opacity-85 break-words">
                                {[c.course, c.reapplication ? t("reapplication") : ""].filter(Boolean).join(" · ")}
                            </div>
                        )}
                        {!approved && !rejected && (
                            <div className="mt-2 text-sm">
                                {c.steps_total > 0 ? (
                                    c.current_step ? (
                                        <>
                                            <div className="font-semibold">{t("step_of", { n: c.current_step.number, total: c.steps_total })}</div>
                                            <div className="opacity-90 break-words">{c.current_step.title}{c.current_step.due_date ? ` · ${overdue(c.current_step.due_date) ? t("was_due") : t("due")} ${fmt(c.current_step.due_date)}` : ""}</div>
                                        </>
                                    ) : <div className="font-semibold">{t("all_steps_done", { total: c.steps_total })}</div>
                                ) : <div className="opacity-90">{t("preparing_steps")}</div>}
                            </div>
                        )}
                        {rejected && <div className="mt-2 text-sm opacity-90">{t("visa_not_approved")}</div>}
                    </div>
                </div>

                {!rejected && <StageBar stage={c.stage} done={approved} />}

                {dates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {dates.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs"><CalendarDays size={12} /> {d}</span>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => navigate(`/accepted_applications/${c.id}?step=${Math.max(0, openStep)}`)}
                    className="self-stretch sm:self-start inline-flex items-center justify-center gap-2 rounded-xl bg-primary-foreground px-4 py-2.5 text-sm font-semibold text-primary shadow-sm active:scale-[0.98] transition-transform"
                >
                    {t("open_case")} <ArrowRight size={16} />
                </button>
            </div>
        </section>
    );
};

const OtherCases = ({ cases }: { cases: any[] }) => {
    const { t } = useT();
    const navigate = useNavigate();
    if (!cases.length) return null;
    return (
        <Card>
            <SectionTitle icon={FileCheck2}>{t("other_cases")}</SectionTitle>
            <ul className="divide-y divide-default-100 pb-1">
                {cases.map((c) => {
                    const pct = c.steps_total ? Math.round((c.steps_done / c.steps_total) * 100) : 0;
                    const status = c.status === "visa_completed" ? t("visa_approved") : c.status === "visa_rejected" ? t("visa_not_approved").split(" - ")[0] : t("steps_done_of", { n: c.steps_done, total: c.steps_total });
                    return (
                        <li key={c.id}>
                            <button type="button" onClick={() => navigate(`/accepted_applications/${c.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/5">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate">{caseLabel(c, t("visa_application"))}</div>
                                    <div className="text-xs text-default-500">{status}</div>
                                    {c.status === "visa_progress" && c.steps_total > 0 && (
                                        <div className="mt-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/15"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                                    )}
                                </div>
                                <ChevronRight size={18} className="text-default-400 shrink-0" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
};

const TONE: Record<Todo["tone"], { tile: string; cta: string }> = {
    danger: { tile: "bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400", cta: "bg-danger text-danger-foreground" },
    warning: { tile: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400", cta: "bg-primary text-primary-foreground" },
    brand: { tile: "bg-primary/10 text-primary", cta: "bg-primary text-primary-foreground" },
};

/** (2) What to do next - documents, answers, fees, files to review, unread messages - most urgent first. */
const TodoList = ({ items, loading, waitingReview }: { items: Todo[]; loading: boolean; waitingReview: number }) => {
    const { t } = useT();
    const navigate = useNavigate();
    const shown = items.slice(0, 5);
    return (
        <Card>
            <SectionTitle
                icon={Sparkles}
                action={items.length > 0 ? <span className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5">{items.length}</span> : undefined}
            >
                {t("todo")}
            </SectionTitle>
            {loading ? (
                <div className="px-4 pb-4 flex flex-col gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
            ) : items.length === 0 ? (
                <div className="px-4 pb-5 pt-2 flex flex-col items-center text-center gap-2">
                    <div className="h-12 w-12 rounded-2xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400 grid place-items-center"><CheckCircle2 size={24} /></div>
                    <div className="font-semibold text-sm">{t("all_caught_up")}</div>
                    <p className="text-xs text-default-500 max-w-xs">
                        {waitingReview > 0 ? t("nothing_needed_checking", { n: waitingReview }) : t("todo_empty")}
                    </p>
                </div>
            ) : (
                <>
                    <ul className="px-2 pb-2 flex flex-col">
                        {shown.map((it) => {
                            const Icon = it.icon;
                            const tone = TONE[it.tone];
                            return (
                                <li key={it.key}>
                                    <button type="button" onClick={it.onClick} className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/5 active:bg-black/5 transition-colors">
                                        <span className={`h-10 w-10 shrink-0 rounded-xl grid place-items-center ${tone.tile}`}><Icon size={20} /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium text-foreground break-words line-clamp-2">{it.title}</span>
                                            {it.meta && <span className={`block text-xs mt-0.5 break-words ${it.tone === "danger" ? "text-danger-600 dark:text-danger-400 font-medium" : "text-default-500"}`}>{it.meta}</span>}
                                        </span>
                                        <span className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${tone.cta}`}>{it.cta}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {items.length > shown.length && (
                        <button type="button" onClick={() => navigate("/my_progress")} className="w-full border-t border-default-100 px-4 py-3 text-sm font-medium text-primary flex items-center justify-center gap-1">
                            {t("see_all", { n: items.length })} <ChevronRight size={16} />
                        </button>
                    )}
                </>
            )}
        </Card>
    );
};

type Tile = { key: string; label: string; icon: LucideIcon; to: string; badge?: string; badgeTone?: "brand" | "warning" };

const QuickLinks = ({ unread, due }: { unread: number; due: number }) => {
    const { t } = useT();
    const navigate = useNavigate();
    const addons: string[] | null = (() => { try { return JSON.parse(getConfig("ADDONS") || "null"); } catch { return null; } })();
    const tiles: Tile[] = [
        { key: "chat", label: t("ql_chat"), icon: MessagesSquare, to: "/chat", badge: unread > 0 ? t("new_n", { n: unread }) : undefined },
        { key: "fees", label: t("ql_fees"), icon: Wallet, to: "/my_fees", badge: due > 0 ? rupees(due) : undefined, badgeTone: "warning" },
        { key: "apps", label: t("ql_applications"), icon: FileCheck2, to: "/accepted_applications" },
        { key: "services", label: t("ql_services"), icon: Store, to: "/services" },
        ...(!addons || addons.includes("jobs") ? [{ key: "jobs", label: t("ql_jobs"), icon: Briefcase, to: "/career/1" }] : []),
        { key: "profile", label: t("ql_profile"), icon: UserRound, to: "/student_profile" },
    ];
    return (
        <Card>
            <SectionTitle>{t("quick_links")}</SectionTitle>
            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                {tiles.map(({ key, label, icon: Icon, to, badge, badgeTone }) => (
                    <button key={key} type="button" onClick={() => navigate(to)} className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] px-1 py-3 hover:bg-black/[0.06] dark:hover:bg-white/10 active:scale-[0.97] transition">
                        <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon size={18} /></span>
                        <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
                        {badge && (
                            <span className={`absolute top-1.5 right-1.5 max-w-[calc(100%-12px)] truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badgeTone === "warning" ? "bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-300" : "bg-primary text-primary-foreground"}`}>{badge}</span>
                        )}
                    </button>
                ))}
            </div>
        </Card>
    );
};

type Update = { key: string; icon: LucideIcon; text: string; date: string; href?: string; to?: string };

/** (3) Recent updates - offers, deposits, visa dates (from the case) plus the agency's live campaigns. */
const Updates = ({ cases, loading }: { cases: any[]; loading: boolean }) => {
    const { t } = useT();
    const navigate = useNavigate();
    const agency = getAppName() || t("your_agency");
    const updates = useMemo(() => {
        const out: Update[] = [];
        for (const c of cases) {
            for (const u of c.universities || []) {
                if (u.offer_on && ["offer", "conditional", "unconditional", "cas", "deposit_paid"].includes(u.status)) {
                    const status = t(`uni_${u.status === "deposit_paid" ? "offer" : u.status}`);
                    out.push({ key: `o${u.id}`, icon: GraduationCap, text: t("upd_offer", { status, uni: u.university }), date: u.offer_on, href: u.offer_files?.[0]?.url });
                }
                if (u.deposit_paid_on) out.push({ key: `d${u.id}`, icon: IndianRupee, text: t("upd_deposit", { uni: u.university }), date: u.deposit_paid_on });
            }
            const to = `/accepted_applications/${c.id}`;
            if (c.visa?.lodged_on) out.push({ key: `l${c.id}`, icon: Send, text: t("upd_visa_filed"), date: c.visa.lodged_on, to });
            if (c.visa?.biometrics_on) out.push({ key: `b${c.id}`, icon: Fingerprint, text: t("upd_biometrics"), date: c.visa.biometrics_on, to });
            if (c.visa?.decision_on) out.push({ key: `x${c.id}`, icon: CheckCircle2, text: t("upd_decision"), date: c.visa.decision_on, to });
        }
        return out.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
    }, [cases, t]);

    return (
        <Card>
            <SectionTitle icon={Sparkles}>{t("updates_from", { agency })}</SectionTitle>
            <div className="px-3 pb-1 [&_section]:mb-2"><AchievementBanner target_type="home" /></div>
            {loading ? (
                <div className="px-4 pb-4 flex flex-col gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : updates.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-default-500">{t("updates_empty")}</p>
            ) : (
                <ol className="px-4 pb-3">
                    {updates.map((u, i) => {
                        const Icon = u.icon;
                        const upcoming = String(u.date).slice(0, 10) > today();
                        const body = (
                            <>
                                <span className="relative flex flex-col items-center self-stretch">
                                    <span className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><Icon size={15} /></span>
                                    {i < updates.length - 1 && <span className="w-px flex-1 bg-default-200 mt-1" />}
                                </span>
                                <span className="min-w-0 flex-1 pb-3">
                                    <span className="block text-sm text-foreground break-words">{u.text}</span>
                                    <span className="block text-xs text-default-500">
                                        {fmt(u.date)}{upcoming && <span className="ml-1.5 rounded-full bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-300 px-1.5 py-px text-[10px] font-semibold">{t("upcoming")}</span>}
                                    </span>
                                </span>
                                {u.href ? <FileText size={16} className="text-primary shrink-0 mt-2" /> : u.to ? <ChevronRight size={16} className="text-default-400 shrink-0 mt-2" /> : null}
                            </>
                        );
                        return (
                            <li key={u.key}>
                                {u.href ? (
                                    <a href={u.href} target="_blank" rel="noreferrer" className="flex gap-3 no-underline text-inherit">{body}</a>
                                ) : u.to ? (
                                    <button type="button" onClick={() => navigate(u.to!)} className="w-full flex gap-3 text-left">{body}</button>
                                ) : (
                                    <div className="flex gap-3">{body}</div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </Card>
    );
};

const HelpCard = () => {
    const { t } = useT();
    const navigate = useNavigate();
    const phone = getSupportNumber();
    const email = getSupportEmail();
    const agency = getAppName() || t("your_agency");
    const btn = "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium no-underline";
    return (
        <Card className="p-4 flex flex-col gap-3">
            <div>
                <div className="font-semibold text-sm">{t("need_help")}</div>
                <p className="text-xs text-default-500 mt-0.5">{t("need_help_text", { agency })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate("/chat")} className={`${btn} basis-full bg-primary text-primary-foreground`}><MessagesSquare size={16} /> {t("message_us")}</button>
                {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`${btn} border border-default-200 text-foreground`}><Phone size={16} /> {t("call")}</a>}
                {email && <a href={`mailto:${email}`} className={`${btn} border border-default-200 text-foreground`}><Mail size={16} /> {t("email")}</a>}
            </div>
        </Card>
    );
};

const NoCase = () => {
    const { t } = useT();
    const navigate = useNavigate();
    return (
        <section className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5 flex flex-col items-start gap-3">
            <span className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center"><GraduationCap size={22} /></span>
            <div>
                <h1 className="text-lg font-bold">{t("not_started_title")}</h1>
                <p className="text-sm text-default-600 mt-0.5">{t("not_started")}</p>
            </div>
            <button type="button" onClick={() => navigate("/chat")} className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold"><MessagesSquare size={16} /> {t("message_us")}</button>
        </section>
    );
};

/* ------------------------------------------------------------------------ page */

/**
 * Student home: where the case stands, what to do next, and what's new from the agency.
 * Phones: one column in that order. Desktop: case + to-do on the left, links / updates / help on the right.
 */
const StudentHome = () => {
    const { t } = useT();
    const navigate = useNavigate();
    const userName: string = useSelector((s: any) => s.login?.user_name) || "";
    const { overview, fees, orders, unread } = useHomeData();

    const cases: any[] = overview.data || [];
    const primary = cases.find((c) => c.status === "visa_progress") || cases[0];
    const others = cases.filter((c) => c !== primary);
    const active = cases.filter((c) => c.status === "visa_progress");
    const unreadCount = unread.data || 0;
    const due = Number(fees.data?.total_due || 0);

    const todos = useMemo(() => {
        const out: Todo[] = [];
        for (const c of active) {
            for (const n of c.needed || []) {
                const late = overdue(n.due_date);
                const where = [n.step_title, active.length > 1 ? caseLabel(c, "") : ""].filter(Boolean).join(" · ");
                const when = n.due_date ? `${late ? t("was_due") : t("due")} ${fmt(n.due_date)}` : "";
                out.push({
                    key: `q${n.question_id}`,
                    icon: n.type === "file_selector" ? FileUp : PencilLine,
                    title: n.text,
                    meta: n.rejected ? t("redo_reason", { reason: n.reason || t("not_accepted") }) : [where, when].filter(Boolean).join(" · "),
                    cta: n.type === "file_selector" ? t("upload") : t("answer"),
                    tone: n.rejected || late ? "danger" : "brand",
                    rank: n.rejected ? 0 : late ? 1 : n.due_date ? 3 : 4,
                    sortDate: n.due_date || "9999",
                    onClick: () => navigate(`/accepted_applications/${c.id}?step=${Math.max(0, n.step_index)}`),
                });
            }
        }
        if (due > 0) {
            const open = (fees.data?.invoices || []).filter((i: any) => i.balance > 0);
            const late = open.some((i: any) => i.overdue);
            const next = open.map((i: any) => i.next_due?.due_date).filter(Boolean).sort()[0];
            out.push({
                key: "fees",
                icon: Wallet,
                title: t("todo_fees_title"),
                meta: [rupees(due), next ? `${late ? t("was_due") : t("due")} ${fmt(next)}` : ""].filter(Boolean).join(" · "),
                cta: t("pay"),
                tone: late ? "danger" : "warning",
                rank: late ? 1 : 3,
                sortDate: next || "9999",
                onClick: () => navigate("/my_fees"),
            });
        }
        for (const o of orders.data?.orders || []) {
            if (o.status !== "delivered") continue;
            out.push({
                key: `s${o.id}`, icon: FileCheck2, title: t("todo_review_files", { title: o.title }), cta: t("todo_review"),
                tone: "brand", rank: 2, sortDate: String(o.at || "9999"), onClick: () => navigate(`/services/orders/${o.id}`),
            });
        }
        if (unreadCount > 0) {
            out.push({
                key: "chat", icon: MessagesSquare, title: t("todo_unread", { n: unreadCount }), cta: t("todo_read"),
                tone: "brand", rank: 2, sortDate: "0000", onClick: () => navigate("/chat"),
            });
        }
        return out.sort((a, b) => a.rank - b.rank || a.sortDate.localeCompare(b.sortDate));
    }, [active, due, fees.data, orders.data, unreadCount, navigate, t]);

    const firstName = userName.trim().split(/\s+/)[0];
    const waitingReview = active.reduce((n, c) => n + Number(c.waiting_review || 0), 0);
    const todoLoading = overview.isLoading || fees.isLoading;

    return (
        <div className="w-full max-w-6xl mx-auto grid gap-4 lg:grid-cols-3 lg:items-start min-w-0">
            <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
                <header className="px-1">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{firstName ? t("hello_name", { name: firstName }) : t("hello")} 👋</p>
                    <p className="text-sm text-default-500 mt-0.5">
                        {todoLoading ? " " : todos.length > 0 ? t("todo_count", { n: todos.length }) : t("all_caught_up")}
                    </p>
                </header>

                {overview.isLoading ? (
                    <div className="rounded-3xl bg-black/5 dark:bg-white/10 animate-pulse h-64" aria-busy="true" />
                ) : overview.isError ? (
                    <Card className="p-5 flex flex-col items-start gap-3">
                        <div className="flex items-center gap-2 text-sm text-default-700"><AlertCircle size={18} className="text-danger shrink-0" /> {t("could_not_load")}</div>
                        <button type="button" onClick={() => overview.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-default-200 px-3 py-2 text-sm font-medium"><RefreshCw size={14} /> {t("try_again")}</button>
                    </Card>
                ) : primary ? (
                    <CaseHero c={primary} />
                ) : (
                    <NoCase />
                )}

                <TodoList items={todos} loading={todoLoading} waitingReview={waitingReview} />
                <OtherCases cases={others} />
                <InstallAppCard />
            </div>

            <aside className="flex flex-col gap-4 min-w-0 lg:pt-[4.25rem]">
                <QuickLinks unread={unreadCount} due={due} />
                <Updates cases={cases} loading={overview.isLoading} />
                <HelpCard />
            </aside>
        </div>
    );
};

export default StudentHome;
