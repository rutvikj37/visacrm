import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@nextui-org/react";
import { Copy, MailWarning } from "lucide-react";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

export type LoginCodeInfo = { phone: string; code: string } | null;

/**
 * Shown only when the welcome / new-code email could not be sent: the admin sees the login code once
 * and passes it to the agency owner. Codes are stored hashed, so it can't be shown again later.
 */
const LoginCodeDialog = ({ info, onClose }: { info: LoginCodeInfo; onClose: () => void }) => {
    const message = info ? `Your TechX CRM login\nMobile number: ${info.phone}\nLogin code: ${info.code}` : "";
    const copy = async () => {
        try { await navigator.clipboard.writeText(message); SuccessToast("Login details copied"); } catch { ErrorToast("Couldn't copy"); }
    };
    return (
        <Modal isOpen={!!info} onOpenChange={(open) => !open && onClose()} isDismissable={false}>
            <ModalContent>
                {(close) => info && (
                    <>
                        <ModalHeader className="flex items-center gap-2"><MailWarning size={18} className="text-warning" />Email not sent - share the login code</ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-default-600">
                                The email couldn't be sent, so share these login details with the agency owner yourself (WhatsApp, call...).
                                This is the only time the code is shown. If it's lost, use "Send new login code".
                            </p>
                            <div className="rounded-xl border border-default-200 divide-y divide-default-200">
                                <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-default-500">Mobile number</span><span className="font-semibold">{info.phone}</span></div>
                                <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-default-500">Login code</span><span className="font-mono text-2xl font-bold tracking-[0.3em]">{info.code}</span></div>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" startContent={<Copy size={16} />} onPress={copy}>Copy details</Button>
                            <Button color="primary" onPress={close}>Done</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default LoginCodeDialog;
