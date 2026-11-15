/**
 * GST tax invoice for a subscription payment (platform -> agency). Plain markup so the same file
 * works in the agency panel and the admin panel. Wrap the page with PRINT_CSS to print only this sheet.
 */

export const PRINT_CSS = `@media print { body * { visibility: hidden; } #invoice-print, #invoice-print * { visibility: visible; } #invoice-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; } }`;

const money = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const twoDigits = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const threeDigits = (n: number) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " : ""}` : ""}${n % 100 ? twoDigits(n % 100) : ""}`;

/** 152340.5 -> "One Lakh Fifty Two Thousand Three Hundred Forty Rupees and Fifty Paise Only" (Indian system). */
export const amountInWords = (amount: number) => {
    let rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    if (rupees === 0 && paise === 0) return "Zero Rupees Only";
    const parts: string[] = [];
    const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
    const lakh = Math.floor(rupees / 100000); rupees %= 100000;
    const thousand = Math.floor(rupees / 1000); rupees %= 1000;
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
    if (rupees) parts.push(threeDigits(rupees));
    const words = parts.join(" ");
    return `${words ? `${words} Rupees` : ""}${paise ? `${words ? " and " : ""}${twoDigits(paise)} Paise` : ""} Only`;
};

const METHOD: Record<string, string> = { razorpay: "Online (Razorpay)", upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", other: "Other" };

const Party = ({ title, p }: { title: string; p: any }) => (
    <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</div>
        <div className="font-semibold">{p?.legal_name || "-"}</div>
        {p?.address && <div className="text-sm whitespace-pre-line">{p.address}</div>}
        {p?.state_name && <div className="text-sm">State: {p.state_name} ({p.state_code})</div>}
        <div className="text-sm">GSTIN: {p?.gstin || "Unregistered"}</div>
        {(p?.email || p?.phone) && <div className="text-sm text-gray-600">{[p.phone, p.email].filter(Boolean).join(" · ")}</div>}
    </div>
);

const SubscriptionInvoiceSheet = ({ invoice }: { invoice: any }) => {
    const inv = invoice || {};
    const inter = Number(inv.igst) > 0;
    const half = Number(inv.gst_percent || 0) / 2;
    return (
        <div id="invoice-print" className="bg-white text-black rounded-xl border border-gray-200 shadow-sm p-5 sm:p-8 flex flex-col gap-6 max-w-3xl w-full">
            <div className="flex flex-wrap justify-between gap-4">
                <div>
                    <img src="/techx-logo.png" alt="TechX CRM" className="h-8 w-auto mb-2" />
                    <div className="text-xl font-bold">{inv.seller?.legal_name || "Tax invoice"}</div>
                    {inv.seller?.gstin && <div className="text-sm">GSTIN: {inv.seller.gstin}</div>}
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold tracking-wide">TAX INVOICE</div>
                    <div className="text-sm">No. <span className="font-medium">{inv.number}</span></div>
                    <div className="text-sm">Date: {date(inv.date)}</div>
                    {inv.buyer?.state_name && <div className="text-sm">Place of supply: {inv.buyer.state_name}</div>}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Party title="From" p={inv.seller} />
                <Party title="Billed to" p={inv.buyer} />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                    <thead>
                        <tr className="border-b border-gray-300 text-left text-gray-600">
                            <th className="py-2 font-medium">Description</th><th className="py-2 font-medium">SAC</th><th className="py-2 font-medium text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-100">
                            <td className="py-2">{inv.item?.description}{inv.coupon_code ? <div className="text-xs text-gray-500">Coupon {inv.coupon_code}{inv.list_amount ? ` - list price ${money(inv.list_amount)}, discount ${money(inv.discount)}` : ""}</div> : null}</td>
                            <td className="py-2">{inv.item?.sac}</td>
                            <td className="py-2 text-right">{money(inv.taxable)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end">
                <div className="w-full sm:w-72 text-sm flex flex-col gap-1">
                    <div className="flex justify-between"><span>Taxable value</span><span>{money(inv.taxable)}</span></div>
                    {inter
                        ? <div className="flex justify-between"><span>IGST {inv.gst_percent}%</span><span>{money(inv.igst)}</span></div>
                        : <>
                            <div className="flex justify-between"><span>CGST {half}%</span><span>{money(inv.cgst)}</span></div>
                            <div className="flex justify-between"><span>SGST {half}%</span><span>{money(inv.sgst)}</span></div>
                        </>}
                    <div className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-1"><span>Total</span><span>{money(inv.total)}</span></div>
                    <div className="flex justify-between text-green-700"><span>Paid</span><span>{money(inv.total)}</span></div>
                </div>
            </div>

            <div className="text-sm"><span className="text-gray-500">Amount in words: </span>{amountInWords(Number(inv.total || 0))}</div>

            <div className="text-sm text-gray-600 flex flex-col gap-1">
                <div>Paid on {date(inv.paid_at)} · {METHOD[inv.method] || inv.method}{inv.reference ? ` · Ref ${inv.reference}` : ""}</div>
                {inv.seller?.terms && <div className="whitespace-pre-line">{inv.seller.terms}</div>}
            </div>
        </div>
    );
};

export default SubscriptionInvoiceSheet;
