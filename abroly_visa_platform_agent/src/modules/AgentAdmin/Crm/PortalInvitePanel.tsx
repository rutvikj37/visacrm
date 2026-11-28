import { useState } from "react";
import { Button } from "@heroui/react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

/** Shows the student portal invite with WhatsApp / Resend email / copy. */
const PortalInvitePanel = ({ invite, leadUuid }: { invite: any; leadUuid?: string }) => {
    const { commonPostAPICall } = useApiCallUtils();
    const [sending, setSending] = useState(false);

    if (!invite) return null;

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            SuccessToast("Copied");
        } catch {
            ErrorToast("Could not copy - please select and copy it manually");
        }
    };

    const sendEmail = async () => {
        if (!leadUuid) {
            ErrorToast("Missing lead — reopen the invite from the lead page");
            return;
        }
        if (!invite.email) {
            ErrorToast("This lead has no email address. Add one, then send the invite.");
            return;
        }
        setSending(true);
        await commonPostAPICall({}, `crm/leads/${leadUuid}/invite/email`, true);
        setSending(false);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-default-100 p-3 text-sm whitespace-pre-wrap break-words">{invite.message}</div>
            {!invite.portal_configured && (
                <div className="text-xs text-warning-600">
                    Your student portal web address is not set yet, so the message has no link. Ask the platform admin to set your
                    domain / subdomain.
                </div>
            )}
            {invite.email && invite.email_available === false && (
                <div className="text-xs text-warning-600">
                    Platform email (Resend) is not configured yet — WhatsApp and copy still work. Ask the admin to set RESEND_API_KEY and MAIL_FROM.
                </div>
            )}
            {!invite.email && invite.login_code && (
                <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
                    <p className="text-sm text-default-600 mb-3">
                        No email on file — share these portal login details with the student (default code until they set a passcode):
                    </p>
                    <div className="rounded-xl border border-default-200 divide-y divide-default-200 bg-content1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 text-sm">
                            <span className="text-default-500">Mobile number</span>
                            <span className="font-semibold break-all">{invite.phone || "—"}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 text-sm">
                            <span className="text-default-500">Login code</span>
                            <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest break-all">{invite.login_code}</span>
                        </div>
                    </div>
                </div>
            )}
            {!invite.email && !invite.login_code && (
                <div className="text-xs text-warning-600">
                    This lead has no email address, so you cannot send a portal invite by email. Add an email on the lead, or use WhatsApp / copy.
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                {invite.whatsapp_url && (
                    <Button as="a" href={invite.whatsapp_url} target="_blank" rel="noreferrer" color="success" variant="flat" startContent={<MessageCircle size={16} />}>
                        Send on WhatsApp
                    </Button>
                )}
                {invite.email && leadUuid && (
                    <Button
                        color="primary"
                        variant="flat"
                        startContent={<Mail size={16} />}
                        isLoading={sending}
                        isDisabled={invite.email_available === false}
                        onPress={sendEmail}
                    >
                        Send email
                    </Button>
                )}
                <Button variant="flat" startContent={<Copy size={16} />} onPress={() => copy(invite.message)}>Copy message</Button>
                {invite.portal_url && (
                    <Button variant="light" startContent={<Copy size={16} />} onPress={() => copy(invite.portal_url)}>Copy link</Button>
                )}
            </div>
        </div>
    );
};

export default PortalInvitePanel;
