import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import FormFill, { FormFillLoading } from "./FormFill";

const PublicFormFill = () => {
    const { token } = useParams();
    const { commonPublicGetApiCalls } = useApiCallUtils();
    const [form, setForm] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!token) { setError("Invalid link"); setLoading(false); return; }
            const { success, data, message } = await commonPublicGetApiCalls(`/public/forms/${token}`);
            if (success) setForm(data);
            else setError(message || "Form not found or no longer available");
            setLoading(false);
        };
        load();
    }, [token]);

    if (loading) return <FormFillLoading />;
    if (error || !form) {
        return (
            <div className="max-w-lg mx-auto p-6">
                <div className="rounded-2xl border border-default-200 p-6 text-center text-default-600">
                    {error || "Form not found"}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
            <FormFill form={form} submitUrl={`public/forms/${token}`} />
        </div>
    );
};

export default PublicFormFill;
