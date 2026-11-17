import { PRIMARY_COLOR } from "@/lib/theme";
import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Spinner } from "@heroui/react";
import { Check, CreditCard, Lock, Phone, Mail, Users, FileText, CalendarClock } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { setSubscription } from "@/redux/slices/loginSlice";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { useNavigate } from "react-router-dom";
import { BillingDetailsCard, CheckoutModal } from "./SubscriptionBilling";

declare global {
    interface Window { Razorpay?: any }
}

const KIND_LABEL: Record<string, string> = { trial: "Free trial", paid: "Paid plan", complimentary: "Complimentary" };
const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");

const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

const statusTone = (data: any): { color: "danger" | "warning" | "success" | "primary" | "default"; label: string } => {
    if (data.expired) return { color: "danger", label: "Expired" };
    if (data.kind === "trial") return { color: data.days_left <= 3 ? "danger" : "warning", label: KIND_LABEL.trial };
    if (data.days_left <= 3) return { color: "danger", label: `${data.days_left} day(s) left` };
    if (data.days_left <= 7) return { color: "warning", label: `${data.days_left} day(s) left` };
    if (data.kind === "complimentary") return { color: "primary", label: KIND_LABEL.complimentary };
    return { color: "success", label: KIND_LABEL.paid };
};

/** Plan, days left, usage, renew / upgrade with Razorpay, payment history. */
const SubscriptionPage = ({ onRenewed }: { onRenewed?: () => void }) => {
    const dispatch = useDispatch();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const profile = useSelector((state: any) => state.login);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState<string | null>(null);
    const [checkoutPlan, setCheckoutPlan] = useState<any>(null);
    const navigate = useNavigate();

    const planPrice = (p: any) => {
        const months = Number(p?.duration_months);
        if (months === 12) return Number(p.price_yearly || p.price_monthly || 0);
        if (months === 6) return Number(p.price_monthly || p.price_yearly || 0);
        return Number(p.price_yearly || p.price_monthly || 0);
    };
    const planBilling = (p: any): "monthly" | "yearly" => (Number(p?.duration_months) === 12 ? "yearly" : "monthly");
    const planPeriod = (p: any) => {
        const months = Number(p?.duration_months);
        if (months === 12) return "12 months";
        if (months === 6) return "6 months";
        return "package";
    };

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/crm/subscription");
        if (success) setData(data);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const finish = async () => {
        const { success, data: fresh } = await commonGetAPICalls("/crm/subscription");
        if (success) { setData(fresh); dispatch(setSubscription(fresh)); }
        onRenewed?.();
    };

    const pay = async (plan: any, coupon: string | null, total: number) => {
        setPaying(plan.id);
        if (total > 0 && !(await loadRazorpay())) {
            setPaying(null);
            return ErrorToast("Could not load Razorpay. Please check your internet and try again.");
        }
        const { success, data: order } = await commonPostAPICall({ plan_id: plan.id, billing: planBilling(plan), coupon }, "crm/subscription/razorpay/order", true);
        if (!success) {
            setPaying(null);
            return;
        }
        if (order.free) {
            setPaying(null);
            setCheckoutPlan(null);
            SuccessToast(`${order.plan_name} plan activated until ${fmtDate(order.ends_at)}`);
            return finish();
        }
        setCheckoutPlan(null);
        const checkout = new window.Razorpay({
            key: order.key_id,
            order_id: order.order_id,
            amount: order.amount,
            currency: order.currency,
            name: "Subscription",
            description: `${order.plan_name} - ${order.months === 12 ? "12 months" : `${order.months || 6} months`}${coupon ? ` (coupon ${coupon})` : ""}`,
            prefill: { name: profile.user_name || "", email: profile.email || "", contact: (profile.phone || "").replace(/\s/g, "") },
            theme: { color: PRIMARY_COLOR },
            handler: async (response: any) => {
                const { success } = await commonPostAPICall(response, "crm/subscription/razorpay/verify", true);
                setPaying(null);
                if (success) await finish();
            },
            modal: { ondismiss: () => setPaying(null) },
        });
        checkout.on("payment.failed", (resp: any) => {
            setPaying(null);
            // tell the server why, so the follow-up message can help (card declined, UPI timeout ...)
            commonPostAPICall({ order_id: order.order_id, reason: resp?.error?.description || resp?.error?.reason || "" }, "crm/subscription/razorpay/failed");
            ErrorToast(`Payment failed${resp?.error?.description ? `: ${resp.error.description}` : ""}. No money was taken - please try again.`);
        });
        checkout.open();
    };

    if (loading) {
        return (
            <div className="rounded-xl border border-default-200 bg-content1 flex items-center justify-center gap-2 py-14">
                <Spinner size="sm" />
                <span className="text-sm text-default-500">Loading subscription…</span>
            </div>
        );
    }
    if (!data) return <div className="rounded-xl border border-default-200 bg-content1 p-6 text-center text-sm text-default-500">Could not load your subscription.</div>;

    const plan = data.plan;
    const sourceLabel = (k: string) => data.features?.sources?.find((f: any) => f.key === k)?.label || k;
    const addonLabel = (k: string) => data.features?.addons?.find((f: any) => f.key === k)?.label || k;
    const support = data.support || {};
    const tone = statusTone(data);
    const included = plan
        ? [...plan.features.sources.map(sourceLabel), ...plan.features.addons.map(addonLabel)]
        : [];
    const teamLimit = plan && plan.max_team_members !== null ? plan.max_team_members : null;
    const teamNearLimit = teamLimit !== null && data.team_count >= teamLimit;

    return (
        <div className="flex flex-col gap-5 w-full max-w-5xl">
            {/* Current plan */}
            <Card shadow="sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-2">
                    <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-wide text-default-500">Current plan</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold text-foreground">{plan?.name || "Standard"}</h2>
                            <Chip size="sm" variant="flat" color={tone.color} className="font-medium">{tone.label}</Chip>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-default-50 px-3 py-2 text-sm">
                        <CalendarClock size={16} className={`mt-0.5 shrink-0 ${data.expired || data.days_left <= 7 ? "text-danger" : "text-default-500"}`} />
                        <div>
                            <div className="text-xs text-default-500">{data.expired ? "Ended on" : "Valid until"}</div>
                            <div className="font-semibold">{fmtDate(data.ends_at)}</div>
                            <div className={`text-xs ${data.expired || data.days_left <= 7 ? "text-danger" : "text-default-500"}`}>
                                {data.expired ? "Access has ended" : `${data.days_left} day(s) left`}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="pt-0 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-default-200 px-3 py-2.5">
                            <div className="text-xs text-default-500 mb-1">Team members</div>
                            <div className={`font-semibold flex items-center gap-1.5 ${teamNearLimit ? "text-warning-700" : ""}`}>
                                <Users size={15} className="shrink-0" />
                                {data.team_count}{teamLimit !== null ? ` / ${teamLimit}` : " · Unlimited"}
                            </div>
                        </div>
                        <div className="rounded-lg border border-default-200 px-3 py-2.5">
                            <div className="text-xs text-default-500 mb-1.5">Included features</div>
                            {included.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {included.map((l: string) => (
                                        <Chip key={l} size="sm" variant="flat" className="h-6 text-xs">{l}</Chip>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-sm font-medium">All features</span>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {!isOwner ? (
                <Card shadow="sm">
                    <CardBody className="text-sm text-default-600">
                        Plans and payments are managed by your agency owner. Ask them if you need a renewal or upgrade.
                    </CardBody>
                </Card>
            ) : (
                <>
                    {/* Renew / upgrade */}
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">{data.expired ? "Choose a plan to continue" : "Renew or upgrade"}</h2>
                            <p className="text-xs text-default-500 mt-0.5">Paying early never loses days — the new period starts after your current end date.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.plans.map((p: any) => {
                                const price = planPrice(p);
                                const current = plan?.id === p.id;
                                return (
                                    <Card key={p.id} shadow="sm" className={current ? "border-2 border-primary" : "border border-default-200"}>
                                        <CardHeader className="flex flex-col items-start gap-1 pb-2">
                                            <div className="flex items-center gap-2 w-full">
                                                <span className="text-lg font-semibold">{p.name}</span>
                                                {current && <Chip size="sm" color="primary" variant="flat" className="ml-auto shrink-0">Current</Chip>}
                                            </div>
                                            {p.description && <p className="text-sm text-default-500 leading-snug">{p.description}</p>}
                                            <div className="mt-1">
                                                <span className="text-2xl font-bold tracking-tight">{price ? rupees(price) : "Contact us"}</span>
                                                {price > 0 && (
                                                    <span className="text-sm text-default-500">
                                                        {" "}/ {planPeriod(p)}
                                                        {data.pricing && data.pricing.gst_percent > 0
                                                            ? (data.pricing.prices_include_gst ? " incl. GST" : ` + ${data.pricing.gst_percent}% GST`)
                                                            : ""}
                                                    </span>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardBody className="gap-2 pt-0 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Check size={14} className="text-success shrink-0" />
                                                {p.max_team_members === null ? "Unlimited team members" : `${p.max_team_members} team member(s)`}
                                            </div>
                                            {data.features.sources.map((f: any) => (
                                                <div key={f.key} className={`flex items-center gap-2 ${p.features.sources.includes(f.key) ? "" : "text-default-400"}`}>
                                                    {p.features.sources.includes(f.key)
                                                        ? <Check size={14} className="text-success shrink-0" />
                                                        : <Lock size={14} className="shrink-0" />}
                                                    {f.label}
                                                </div>
                                            ))}
                                            {data.features.addons.filter((f: any) => p.features.addons.includes(f.key)).map((f: any) => (
                                                <div key={f.key} className="flex items-center gap-2">
                                                    <Check size={14} className="text-success shrink-0" />{f.label}
                                                </div>
                                            ))}
                                        </CardBody>
                                        <CardFooter>
                                            {data.razorpay_enabled && price > 0 ? (
                                                <Button
                                                    color="primary"
                                                    fullWidth
                                                    startContent={<CreditCard size={16} />}
                                                    isLoading={paying === p.id}
                                                    isDisabled={!!paying && paying !== p.id}
                                                    onPress={() => setCheckoutPlan(p)}
                                                >
                                                    {current ? "Renew" : "Choose"} {p.name}
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-default-500">Contact us to activate this plan.</span>
                                            )}
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                        <p className="text-xs text-default-500">Have a coupon? Enter it on the next step before paying.</p>
                    </section>

                    <CheckoutModal
                        plan={checkoutPlan}
                        billing={checkoutPlan ? planBilling(checkoutPlan) : "yearly"}
                        isOpen={Boolean(checkoutPlan)}
                        onClose={() => !paying && setCheckoutPlan(null)}
                        paying={Boolean(paying)}
                        onPay={(coupon, total) => pay(checkoutPlan, coupon, total)}
                    />

                    <BillingDetailsCard />

                    {(support.phone || support.email) && (
                        <Card shadow="sm">
                            <CardHeader className="pb-1 font-semibold">Need help paying?</CardHeader>
                            <CardBody className="pt-0 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                                <span className="text-default-600">UPI, bank transfer, or a custom plan — reach us directly.</span>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
                                    {support.phone && (
                                        <a className="flex items-center gap-1.5 text-primary font-medium" href={`tel:${support.phone.replace(/\s/g, "")}`}>
                                            <Phone size={14} />{support.phone}
                                        </a>
                                    )}
                                    {support.email && (
                                        <a className="flex items-center gap-1.5 text-primary font-medium" href={`mailto:${support.email}`}>
                                            <Mail size={14} />{support.email}
                                        </a>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {data.payments?.length > 0 && (
                        <Card shadow="sm">
                            <CardHeader className="font-semibold pb-2">Payment history</CardHeader>
                            <CardBody className="pt-0 px-0 sm:px-3">
                                <div className="divide-y divide-default-100">
                                    {data.payments.map((p: any) => (
                                        <div key={p.id} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-2 px-3 sm:px-0 py-3 text-sm">
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                <span className="text-default-500 w-auto sm:w-28 shrink-0">{fmtDate(p.paid_at)}</span>
                                                <span className="font-semibold">{rupees(p.amount)}</span>
                                                <span className="text-default-500 truncate">
                                                    {p.plan}{p.months ? ` · ${p.months === 12 ? "1 year" : `${p.months} month(s)`}` : ""}
                                                </span>
                                                {p.coupon_code && <Chip size="sm" variant="flat" color="success">{p.coupon_code}</Chip>}
                                            </div>
                                            {p.has_invoice && (
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    color="primary"
                                                    className="sm:ml-auto w-fit"
                                                    startContent={<FileText size={14} />}
                                                    onPress={() => navigate(`/subscription/invoices/${p.id}`)}
                                                >
                                                    {p.invoice_number || "Invoice"}
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default SubscriptionPage;
