import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, CardBody, Spinner } from "@nextui-org/react";
import { ClipboardList } from "lucide-react";
import { useSelector } from "react-redux";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import FormFill, { FormFillLoading } from "./FormFill";

export const StudentFormsList = () => {
    const { commonGetAPICalls } = useApiCallUtils();
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/student/forms");
        if (success) setItems(data?.forms || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;

    return (
        <div className="flex flex-col gap-4 p-2 sm:p-4 max-w-2xl mx-auto w-full">
            <div>
                <h1 className="text-xl font-semibold flex items-center gap-2"><ClipboardList size={22} /> Forms to fill</h1>
                <p className="text-sm text-default-500">Forms your agency sent you.</p>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-default-500">Nothing pending right now.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {items.map((item) => (
                        <Card key={item.assignment_id} shadow="sm">
                            <CardBody className="flex flex-row items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">{item.form?.name}</div>
                                    {item.form?.description && <div className="text-xs text-default-500 line-clamp-2">{item.form.description}</div>}
                                    <div className="text-xs text-default-400 mt-1">{item.form?.field_count} questions</div>
                                </div>
                                <Button color="primary" size="sm" onPress={() => navigate(`/forms/${item.assignment_id}`)}>Fill</Button>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export const StudentFormFill = () => {
    const { assignmentId } = useParams();
    const { commonGetAPICalls } = useApiCallUtils();
    const token = useSelector((state: any) => state.login.token);
    const [form, setForm] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            const { success, data, message } = await commonGetAPICalls(`/student/forms/${assignmentId}`);
            if (success) {
                if (data?.completed) setError("You already submitted this form");
                else setForm(data);
            } else setError(message || "Form not found");
            setLoading(false);
        };
        load();
    }, [assignmentId]);

    if (loading) return <FormFillLoading />;
    if (error || !form) {
        return (
            <div className="max-w-lg mx-auto p-6 text-center">
                <p className="text-default-600 mb-3">{error || "Form not found"}</p>
                <Button variant="flat" onPress={() => navigate("/forms")}>Back to forms</Button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
            <FormFill
                form={form}
                submitUrl={`student/forms/${assignmentId}/submit`}
                authToken={token}
                onDone={() => setTimeout(() => navigate("/forms"), 1500)}
            />
        </div>
    );
};
