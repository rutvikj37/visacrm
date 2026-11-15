import { PRIMARY_COLOR } from "@/lib/theme";
import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Spinner, Tab, Tabs } from "@heroui/react";
import { Check, CreditCard, Lock, Phone, Mail, Users, FileText } from "lucide-react";
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
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "-");

const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

/** Plan, days left, usage, renew / upgrade with Razorpay, payment history. */
const SubscriptionPage = ({ onRenewed }: { onRenewed?: () => void }) => {
    const dispatch = useDispatch();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const profile = useSelector((state: any) => state.login);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
    const [paying, setPaying] = useState<string | null>(null);
    const [checkoutPlan, setCheckoutPlan] = useState<any>(null);
    const navigate = useNavigate();

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
        const { success, data: order } = await commonPostAPICall({ plan_id: plan.id, billing, coupon }, "crm/subscription/razorpay/order", true);
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
            description: `${order.plan_name} - ${order.months === 12 ? "1 year" : "1 month"}${coupon ? ` (coupon ${coupon})` : ""}`,
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

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (!data) return <div className="p-6 text-center">Could not load your subscription.</div>;

    const plan = data.plan;
    const sourceLabel = (k: string) => data.features?.sources?.find((f: any) => f.key === k)?.label || k;
    const addonLabel = (k: string) => data.features?.addons?.find((f: any) => f.key === k)?.label || k;
    const support = data.support || {};

    return (
        <div className="flex flex-col gap-5 max-w-5xl w-full">
            {/* current status */}
            <Card shadow="sm">
                <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-xs text-default-500">Plan</div>
                        <div className="font-semibold">{plan?.name || "Standard"}</div>
                        {data.kind && <Chip size="sm" variant="flat" color={data.kind === "trial" ? "primary" : "success"} className="mt-1">{KIND_LABEL[data.kind] || data.kind}</Chip>}
                    </div>
                    <div>
                        <div className="text-xs text-default-500">{data.expired ? "Ended on" : "Valid until"}</div>
                        <div className="font-semibold">{fmtDate(data.ends_at)}</div>
                        <div className={`text-xs ${data.expired || data.days_left <= 7 ? "text-danger" : "text-default-500"}`}>
                            {data.expired ? "Access has ended" : `${data.days_left} day(s) left`}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-default-500">Team members</div>
                        <div className="font-semibold flex items-center gap-1"><Users size={14} />{data.team_count}{plan && plan.max_team_members !== null ? ` / ${plan.max_team_members}` : ""}</div>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <div className="text-xs text-default-500 mb-1">Included</div>
                        <div className="flex flex-wrap gap-1">
                            {plan ? [...plan.features.sources.map(sourceLabel), ...plan.features.addons.map(addonLabel)].map((l: string) => (
                                <Chip key={l} size="sm" variant="flat">{l}</Chip>
                            )) : <span className="text-sm">All features</span>}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {!isOwner ? (
                <Card shadow="sm"><CardBody>Plans and payments are managed by your agency owner.</CardBody></Card>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">{data.expired ? "Choose a plan to continue" : "Renew or upgrade"}</h2>
                        <Tabs size="sm" selectedKey={billing} onSelectionChange={(k) => setBilling(k as any)} aria-label="Billing period">
                            <Tab key="monthly" title="Monthly" />
                            <Tab key="yearly" title="Yearly" />
                        </Tabs>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {data.plans.map((p: any) => {
                            const price = billing === "yearly" ? p.price_yearly : p.price_monthly;
                            const current = plan?.id === p.id;
                            return (
                                <Card key={p.id} shadow="sm" className={current ? "border-2 border-primary" : ""}>
                                    <CardHeader className="flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-2 w-full">
                                            <span className="text-lg font-semibold">{p.name}</span>
                                            {current && <Chip size="sm" color="primary" variant="flat" className="ml-auto">Current</Chip>}
                                        </div>
                                        {p.description && <p className="text-sm text-default-500">{p.description}</p>}
                                        <div className="mt-1">
                                            <span className="text-2xl font-bold">{price ? rupees(price) : "Contact us"}</span>
                                            {price > 0 && <span className="text-sm text-default-500"> / {billing === "yearly" ? "year" : "month"}{data.pricing && data.pricing.gst_percent > 0 ? (data.pricing.prices_include_gst ? " incl. GST" : ` + ${data.pricing.gst_percent}% GST`) : ""}</span>}
                                        </div>
                                    </CardHeader>
                                    <CardBody className="gap-2 pt-0 text-sm">
                                        <div className="flex items-center gap-2"><Check size={14} className="text-success" />{p.max_team_members === null ? "Unlimited team members" : `${p.max_team_members} team member(s)`}</div>
                                        {data.features.sources.map((f: any) => (
                                            <div key={f.key} className={`flex items-center gap-2 ${p.features.sources.includes(f.key) ? "" : "text-default-400"}`}>
                                                {p.features.sources.includes(f.key) ? <Check size={14} className="text-success" /> : <Lock size={14} />}{f.label}
                                            </div>
                                        ))}
                                        {data.features.addons.filter((f: any) => p.features.addons.includes(f.key)).map((f: any) => (
                                            <div key={f.key} className="flex items-center gap-2"><Check size={14} className="text-success" />{f.label}</div>
                                        ))}
                                    </CardBody>
                                    <CardFooter>
                                        {data.razorpay_enabled && price > 0 ? (
                                            <Button color="primary" fullWidth startContent={<CreditCard size={16} />} isLoading={paying === p.id} isDisabled={!!paying && paying !== p.id} onPress={() => setCheckoutPlan(p)}>
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
                    <p className="text-xs text-default-500">Paying early never loses days: the new period starts after your current end date. Have a coupon? Enter it on the next step.</p>
                    <CheckoutModal plan={checkoutPlan} billing={billing} isOpen={Boolean(checkoutPlan)} onClose={() => !paying && setCheckoutPlan(null)} paying={Boolean(paying)}
                        onPay={(coupon, total) => pay(checkoutPlan, coupon, total)} />

                    <BillingDetailsCard />

                    {(support.phone || support.email) && (
                        <Card shadow="sm">
                            <CardBody className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                                <span className="font-medium">Want to pay by UPI or bank transfer, or need a custom plan?</span>
                                <div className="flex flex-wrap gap-3 sm:ml-auto">
                                    {support.phone && <a className="flex items-center gap-1 text-primary" href={`tel:${support.phone.replace(/\s/g, "")}`}><Phone size={14} />{support.phone}</a>}
                                    {support.email && <a className="flex items-center gap-1 text-primary" href={`mailto:${support.email}`}><Mail size={14} />{support.email}</a>}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {data.payments?.length > 0 && (
                        <Card shadow="sm">
                            <CardHeader className="font-semibold">Payment history</CardHeader>
                            <CardBody className="pt-0 divide-y divide-default-100">
                                {data.payments.map((p: any) => (
                                    <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                                        <span className="w-28">{fmtDate(p.paid_at)}</span>
                                        <span className="font-medium">{rupees(p.amount)}</span>
                                        <span className="text-default-500">{p.plan}{p.months ? ` · ${p.months === 12 ? "1 year" : `${p.months} month(s)`}` : ""}</span>
                                        {p.coupon_code && <Chip size="sm" variant="flat" color="success">{p.coupon_code}</Chip>}
                                        {p.has_invoice && <Button size="sm" variant="light" color="primary" className="ml-auto" startContent={<FileText size={14} />} onPress={() => navigate(`/subscription/invoices/${p.id}`)}>{p.invoice_number || "Invoice"}</Button>}
                                    </div>
                                ))}
                            </CardBody>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default SubscriptionPage;
