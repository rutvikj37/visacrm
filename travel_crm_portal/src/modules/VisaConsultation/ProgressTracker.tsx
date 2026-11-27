import { useT } from "@/utils/i18n";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { commonGetAPICalls } from "@/utils/ApiCallUtils";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, FileUp, GraduationCap, IndianRupee, PencilLine, Star } from "lucide-react";
import { PRIMARY_COLOR } from "@/lib/theme";
import { isTravelFocus } from "@/utils/config";

export const fmt = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
export const overdue = (v?: string | null) => Boolean(v) && String(v).slice(0, 10) < new Date().toISOString().slice(0, 10);

/** The case's journey, so students see where they are (same stages as the agency's case board). */
export const STAGES = ["documents", "application", "offer", "funds", "visa_filed", "decision"].map((key) => ({ key, label: `stage_${key}` }));
/** Tourist / business visa cases (or a travel agency) use travel stage names. */
export const isTravelCaseView = (c?: { is_travel?: boolean } | null) => Boolean(c?.is_travel) || isTravelFocus();
export const stageText = (key: string, travel: boolean) => `${travel ? "tstage" : "stage"}_${key}`;
export const stageIndex = (stage?: string | null) => {
    if (stage === "biometrics") return 4; // shown together with "Visa filed"
    const i = STAGES.findIndex((s) => s.key === stage);
    return i >= 0 ? i : 0;
};

const money = (amount?: number | null, currency?: string | null) => {
    if (amount === null || amount === undefined) return "";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(amount); }
    catch { return `${currency || ""} ${amount}`.trim(); }
};
const UNI_TONE: Record<string, string> = {
    offer: "bg-blue-100 text-blue-800", conditional: "bg-amber-100 text-amber-800", unconditional: "bg-green-100 text-green-800",
    cas: "bg-green-100 text-green-800", deposit_paid: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-700",
};

/** The universities the agency applied to, with offer letters to download. */
const Universities = ({ list }: { list: any[] }) => {
    const { t } = useT();
    if (!list?.length) return null;
    return (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><GraduationCap size={16} /> {t("my_universities")}</div>
            <ul className="flex flex-col gap-2">
                {list.map((u) => (
                    <li key={u.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium break-words">{u.university}</span>
                            {u.is_final && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5"><Star size={12} /> {t("your_choice")}</span>}
                            <span className={`ml-auto text-xs font-medium rounded-full px-2 py-0.5 ${UNI_TONE[u.status] || "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"}`}>{t(`uni_${u.status}`)}</span>
                        </div>
                        {(u.course || u.intake) && <div className="text-xs text-gray-500 break-words">{[u.course, u.intake].filter(Boolean).join(" · ")}</div>}
                        {u.deposit_amount !== null && u.deposit_amount !== undefined && (
                            <div className="text-xs text-gray-500">{t("deposit_amount", { amount: money(u.deposit_amount, u.currency) })}{u.deposit_paid_on ? ` · ${t("uni_deposit_paid")} ${fmt(u.deposit_paid_on)}` : ""}</div>
                        )}
                        {u.offer_files?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                                {u.offer_files.map((f: any, i: number) => (
                                    <a key={i} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium rounded-full border border-gray-300 dark:border-gray-600 px-2.5 py-1" style={{ color: PRIMARY_COLOR }}>
                                        <FileText size={12} /> {t("offer_letter")}{u.offer_files.length > 1 ? ` ${i + 1}` : ""}
                                    </a>
                                ))}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

/** Visa lodged / biometrics / decision dates the agency recorded. */
const VisaDates = ({ visa }: { visa?: any }) => {
    const { t } = useT();
    const parts = [
        visa?.lodged_on && t("visa_filed_on", { date: fmt(visa.lodged_on) }),
        visa?.biometrics_on && t("biometrics_on", { date: fmt(visa.biometrics_on) }),
        visa?.decision_on && t("decision_on", { date: fmt(visa.decision_on) }),
    ].filter(Boolean);
    if (!parts.length) return null;
    return <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><CalendarDays size={14} className="shrink-0" /> {parts.join(" · ")}</div>;
};

/** "You have ₹X to pay" - links to the fees page. */
const FeesDue = () => {
    const { t } = useT();
    const navigate = useNavigate();
    const { data } = useQuery({
        queryKey: ["student_fees_due"],
        queryFn: async () => {
            const { data, success } = await commonGetAPICalls("/student/fees");
            return success ? Number(data?.total_due || 0) : 0;
        },
    });
    if (!data || data <= 0) return null;
    return (
        <button type="button" onClick={() => navigate("/my_fees")} className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex items-center gap-3">
            <IndianRupee size={22} className="shrink-0 text-amber-700" />
            <span className="flex-1 text-sm font-semibold text-amber-900 dark:text-amber-200">{t("fees_due_banner", { amount: `₹${data.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` })}</span>
            <span className="text-sm font-medium shrink-0" style={{ color: PRIMARY_COLOR }}>{t("view_and_pay")}</span>
            <ChevronRight size={18} className="shrink-0 text-gray-400" />
        </button>
    );
};

const Ring = ({ pct }: { pct: number }) => {
    const r = 22, c = 2 * Math.PI * r;
    return (
        <div className="relative h-14 w-14 shrink-0" aria-label={`${pct}% done`}>
            <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
                <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke={PRIMARY_COLOR} strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-xs font-bold">{pct}%</span>
        </div>
    );
};

const StagePath = ({ stage, done, travel = false }: { stage?: string | null; done?: boolean; travel?: boolean }) => {
    const { t } = useT();
    const at = done ? STAGES.length - 1 : stageIndex(stage);
    return (
        <div className="mt-3">
            <div className="flex items-center">
                {STAGES.map((s, i) => (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                        <span className={`h-3 w-3 rounded-full shrink-0 ${i <= at ? "" : "bg-gray-200 dark:bg-gray-700"}`} style={i <= at ? { background: PRIMARY_COLOR } : undefined} />
                        {i < STAGES.length - 1 && <span className={`h-0.5 flex-1 ${i < at ? "" : "bg-gray-200 dark:bg-gray-700"}`} style={i < at ? { background: PRIMARY_COLOR } : undefined} />}
                    </div>
                ))}
            </div>
            <div className="mt-1 text-xs text-gray-500">{t("now")}: <span className="font-medium text-gray-800 dark:text-gray-200">{t(stageText(STAGES[at].key, travel))}</span>{at < STAGES.length - 1 ? ` · ${t("next")}: ${t(stageText(STAGES[at + 1].key, travel))}` : ""}</div>
        </div>
    );
};

/**
 * Mobile-first summary of the student's visa cases:
 * "Step 3 of 7", a progress bar, and the list of what the agency still needs from them.
 */
const ProgressTracker = ({ compact = false }: { compact?: boolean }) => {
    const navigate = useNavigate();
    const { t } = useT();
    const { data, isLoading } = useQuery({
        queryKey: ["student_overview"],
        queryFn: async () => {
            const { data, success } = await commonGetAPICalls("/leads/lead_progress/student/overview");
            return success ? data : [];
        },
    });

    const cases: any[] = Array.isArray(data) ? data : [];
    if (isLoading) {
        return (
            <div className={`w-full max-w-2xl mx-auto flex flex-col gap-4 ${compact ? "min-h-[6rem]" : "min-h-[10rem]"}`}>
                {!compact && <h1 className="text-xl font-bold">{t("my_progress")}</h1>}
                <div className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </div>
        );
    }
    if (!cases.length) {
        return compact ? null : (
            <div className="max-w-2xl mx-auto p-6 text-center text-gray-500">
                {t("not_started")}
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
            {!compact && <h1 className="text-xl font-bold">{t("my_progress")}</h1>}
            <FeesDue />
            {cases.map((c) => {
                const pct = c.steps_total ? Math.round((c.steps_done / c.steps_total) * 100) : 0;
                const approved = c.status === "visa_completed";
                const rejected = c.status === "visa_rejected";
                const open = (stepIndex = 0) => navigate(`/accepted_applications/${c.id}?step=${Math.max(0, stepIndex)}`);
                return (
                    <div key={c.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                        <button type="button" onClick={() => open(c.current_step ? c.current_step.number - 1 : 0)} className="w-full text-left p-4 flex items-start gap-3">
                            {!approved && !rejected && c.steps_total > 0 && <Ring pct={pct} />}
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate">{[c.country, c.university].filter(Boolean).join(" · ") || t("visa_application")}</div>
                                {c.reapplication && <span className="inline-block mt-1 text-xs font-medium rounded-full px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">{t("reapplication")}</span>}
                                {c.course && <div className="text-xs text-gray-500 truncate">{c.course}</div>}
                                {approved ? (
                                    <div className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-100 rounded-full px-3 py-1"><CheckCircle2 size={16} /> {t("visa_approved")}</div>
                                ) : rejected ? (
                                    <div className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 bg-red-100 rounded-full px-3 py-1"><AlertCircle size={16} /> {t("visa_not_approved")}</div>
                                ) : c.steps_total > 0 ? (
                                    <>
                                        <div className="mt-2 text-sm">
                                            <span className="font-semibold" style={{ color: PRIMARY_COLOR }}>
                                                {c.current_step ? t("step_of", { n: c.current_step.number, total: c.steps_total }) : t("all_steps_done", { total: c.steps_total })}
                                            </span>
                                            {c.current_step && <span className="text-gray-600 dark:text-gray-300"> · {c.current_step.title}</span>}
                                        </div>
                                        <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                            <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%`, background: PRIMARY_COLOR }} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-2 text-sm text-gray-500">{t("preparing_steps")}</div>
                                )}
                                {!rejected && <StagePath stage={c.stage} done={approved} travel={isTravelCaseView(c)} />}
                                <VisaDates visa={c.visa} />
                            </div>
                            <ChevronRight className="text-gray-400 shrink-0 mt-1" size={20} />
                        </button>

                        {!compact && <Universities list={c.universities} />}

                        {!approved && !rejected && (
                            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
                                {c.needed.length > 0 ? (
                                    <>
                                        {(() => {
                                            const next = [...c.needed].sort((a: any, b: any) =>
                                                Number(Boolean(b.rejected)) - Number(Boolean(a.rejected)) ||
                                                Number(overdue(b.due_date)) - Number(overdue(a.due_date)) ||
                                                String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")))[0];
                                            return (
                                                <button type="button" onClick={() => open(next.step_index)} className="w-full text-left rounded-xl p-3 mb-3 text-white flex items-center gap-3" style={{ background: PRIMARY_COLOR }}>
                                                    {next.type === "file_selector" ? <FileUp size={22} className="shrink-0" /> : <PencilLine size={22} className="shrink-0" />}
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-xs opacity-90">{next.rejected ? t("please_redo") : t("next_thing")}</span>
                                                        <span className="block text-sm font-semibold break-words">{next.text}</span>
                                                        {next.due_date && <span className="block text-xs opacity-90">{overdue(next.due_date) ? t("was_due") : t("due")} {fmt(next.due_date)}</span>}
                                                    </span>
                                                    <ChevronRight size={20} className="shrink-0" />
                                                </button>
                                            );
                                        })()}
                                        <div className="text-sm font-semibold mb-2">{t("what_we_need", { n: c.needed.length })}</div>
                                        <ul className="flex flex-col gap-2">
                                            {c.needed.slice(0, compact ? 3 : 20).map((n: any) => (
                                                <li key={n.question_id}>
                                                    <button type="button" onClick={() => open(n.step_index)} className={`w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5 ${n.rejected ? "bg-red-50 dark:bg-red-950/30" : "bg-gray-50 dark:bg-gray-800"}`}>
                                                        {n.type === "file_selector" ? <FileUp size={18} className="shrink-0 mt-0.5" /> : <PencilLine size={18} className="shrink-0 mt-0.5" />}
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-sm break-words">{n.text}</span>
                                                            {n.rejected && <span className="block text-xs text-red-700 break-words">{t("redo_reason", { reason: n.reason || t("not_accepted") })}</span>}
                                                            <span className={`block text-xs ${overdue(n.due_date) ? "text-red-600 font-medium" : "text-gray-500"}`}>
                                                                {n.step_title}{n.due_date ? ` · ${overdue(n.due_date) ? t("was_due") : t("due")} ${fmt(n.due_date)}` : ""}
                                                            </span>
                                                        </span>
                                                        <span className="text-xs font-medium shrink-0 mt-0.5" style={{ color: PRIMARY_COLOR }}>{n.type === "file_selector" ? t("upload") : t("answer")}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        {compact && c.needed.length > 3 && (
                                            <button type="button" className="mt-2 text-sm font-medium" style={{ color: PRIMARY_COLOR }} onClick={() => navigate("/my_progress")}>{t("see_all", { n: c.needed.length })}</button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                        {c.waiting_review > 0 ? <><Clock size={16} /> {t("nothing_needed_checking", { n: c.waiting_review })}</> : <><CheckCircle2 size={16} className="text-green-600" /> {t("nothing_needed")}</>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ProgressTracker;
