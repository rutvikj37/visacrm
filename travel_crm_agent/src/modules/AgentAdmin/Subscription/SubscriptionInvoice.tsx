import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Spinner } from "@heroui/react";
import { ArrowLeft, Printer } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import SubscriptionInvoiceSheet, { PRINT_CSS } from "@/components/SubscriptionInvoiceSheet";

/** Owner: GST invoice of one subscription payment. */
const SubscriptionInvoice = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [invoice, setInvoice] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            const { success, data, message } = await commonGetAPICalls(`/crm/subscription/invoices/${id}`);
            if (success) setInvoice(data); else setError(message || "Invoice not found");
        })();
    }, [id]);

    if (error) return <div className="p-4 text-default-500">{error}</div>;
    if (!invoice) return <div className="p-10 flex justify-center"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-4 p-2 sm:p-4 max-w-3xl">
            <style>{PRINT_CSS}</style>
            <div className="flex flex-wrap items-center gap-2">
                <Button isIconOnly size="sm" variant="light" aria-label="Back" onPress={() => navigate("/subscription")}><ArrowLeft size={18} /></Button>
                <h1 className="text-xl font-semibold">Invoice {invoice.number}</h1>
                <Button size="sm" color="primary" className="ml-auto" startContent={<Printer size={14} />} onPress={() => window.print()}>Print / PDF</Button>
            </div>
            <SubscriptionInvoiceSheet invoice={invoice} />
        </div>
    );
};

export default SubscriptionInvoice;
