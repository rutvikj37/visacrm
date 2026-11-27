import { useEffect, useState } from "react";
import {
    Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner,
} from "@heroui/react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

/** Pick a published client form and assign/send it to this lead. */
const SendFormModal = ({
    isOpen, onOpenChange, leadUuid, onSent,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    leadUuid?: string;
    onSent?: () => void;
}) => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [formId, setFormId] = useState("");
    const [sending, setSending] = useState(false);
    const [share, setShare] = useState<any>(null);

    useEffect(() => {
        if (!isOpen) return;
        setShare(null);
        setFormId("");
        setLoading(true);
        (async () => {
            const { success, data } = await commonGetAPICalls("/crm/forms");
            const published = (data?.forms || []).filter((f: any) => f.status === "published");
            if (success) setForms(published);
            setLoading(false);
        })();
    }, [isOpen]);

    const send = async () => {
        if (!formId || !leadUuid) return ErrorToast("Pick a form");
        setSending(true);
        const { success, data } = await commonPostAPICall({ lead_uuid: leadUuid }, `crm/forms/${formId}/assign`, true);
        setSending(false);
        if (success) {
            setShare(data?.share || null);
            onSent?.();
        }
    };

    const sendEmail = async () => {
        if (!formId || !leadUuid) return;
        setSending(true);
        await commonPostAPICall({ lead_uuid: leadUuid }, `crm/forms/${formId}/assign/email`, true);
        setSending(false);
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            SuccessToast("Copied");
        } catch {
            ErrorToast("Could not copy");
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>Send form to client</ModalHeader>
                        <ModalBody className="gap-3">
                            {loading ? (
                                <div className="flex justify-center p-6"><Spinner /></div>
                            ) : forms.length === 0 ? (
                                <p className="text-sm text-default-500">
                                    No published forms yet. Create one under Settings → Client forms, then publish it.
                                </p>
                            ) : !share ? (
                                <Select
                                    label="Form"
                                    selectedKeys={formId ? [formId] : []}
                                    onChange={(e) => e.target.value && setFormId(e.target.value)}
                                >
                                    {forms.map((f) => (
                                        <SelectItem key={f.id} textValue={f.name}>
                                            {f.name} ({f.field_count} fields)
                                        </SelectItem>
                                    ))}
                                </Select>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {share.form_url && (
                                        <div className="rounded-xl bg-default-100 p-3 text-sm break-all">{share.form_url}</div>
                                    )}
                                    <div className="rounded-xl bg-default-100 p-3 text-sm whitespace-pre-wrap break-words">{share.message}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {share.form_url && (
                                            <Button size="sm" variant="flat" startContent={<Copy size={14} />} onPress={() => copy(share.form_url)}>Copy link</Button>
                                        )}
                                        <Button size="sm" variant="flat" startContent={<Copy size={14} />} onPress={() => copy(share.message)}>Copy message</Button>
                                        {share.whatsapp_url && (
                                            <Button size="sm" as="a" href={share.whatsapp_url} target="_blank" rel="noreferrer" color="success" variant="flat" startContent={<MessageCircle size={14} />}>WhatsApp</Button>
                                        )}
                                        {share.email && (
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                startContent={<Mail size={14} />}
                                                isLoading={sending}
                                                isDisabled={share.email_available === false}
                                                onPress={sendEmail}
                                            >
                                                Send email
                                            </Button>
                                        )}
                                    </div>
                                    {share.email_available === false && (
                                        <div className="text-xs text-warning-600">Platform email is not configured — WhatsApp and copy still work.</div>
                                    )}
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>{share ? "Done" : "Cancel"}</Button>
                            {!share && forms.length > 0 && (
                                <Button color="primary" isLoading={sending} isDisabled={!formId} onPress={send}>Assign & share</Button>
                            )}
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default SendFormModal;
