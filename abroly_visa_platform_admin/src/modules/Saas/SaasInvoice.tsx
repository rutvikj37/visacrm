import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Spinner } from "@nextui-org/react";
import { ArrowLeft, Printer } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import SubscriptionInvoiceSheet, { PRINT_CSS } from "@/components/SubscriptionInvoiceSheet";

/** GST invoice of one subscription payment. */
const SaasInvoice = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [invoice, setInvoice] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            const { success, data, message } = await commonGetAPICalls(`/saas_admin/payments/${id}/invoice`);
            if (success) setInvoice(data); else setError(message || "Invoice not found");
        })();
    }, [id]);

    if (error) return <div className="p-4 text-default-500">{error}</div>;
    if (!invoice) return <div className="p-10 flex justify-center"><Spinner /></div>;
    return (
        <div className="flex flex-col gap-4 p-2 max-w-3xl">
            <style>{PRINT_CSS}</style>
            <div className="flex flex-wrap items-center gap-2">
                <Button isIconOnly size="sm" variant="light" aria-label="Back" onPress={() => navigate(-1)}><ArrowLeft size={18} /></Button>
                <h1 className="text-xl font-semibold">Invoice {invoice.number}</h1>
                <div className="ml-auto flex gap-2">
                    {invoice.agency_id && <Button size="sm" variant="flat" onPress={() => navigate(`/saas/agencies/${invoice.agency_id}`)}>Open agency</Button>}
                    <Button size="sm" color="primary" startContent={<Printer size={14} />} onPress={() => window.print()}>Print / PDF</Button>
                </div>
            </div>
            <SubscriptionInvoiceSheet invoice={invoice} />
        </div>
    );
};

export default SaasInvoice;
