import { ReactNode } from "react";

/**
 * Friendly empty screen: a soft illustration, one sentence, and the next step.
 * <EmptyState icon={Inbox} title="No leads yet" text="..." actions={<Button ...>Connect Facebook</Button>} />
 */
const EmptyState = ({ icon: Icon, title, text, actions, compact = false }: {
    icon: any; title: string; text?: ReactNode; actions?: ReactNode; compact?: boolean;
}) => (
    <div className={`flex flex-col items-center text-center ${compact ? "py-6" : "py-12"} px-4`}>
        <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-150" />
            <div className="relative h-16 w-16 rounded-2xl bg-primary-50 text-primary grid place-items-center ring-8 ring-primary-50/50">
                <Icon size={30} strokeWidth={1.8} />
            </div>
        </div>
        <div className="font-semibold text-lg">{title}</div>
        {text && <div className="text-sm text-default-500 max-w-md mt-1">{text}</div>}
        {actions && <div className="flex flex-wrap justify-center gap-2 mt-4">{actions}</div>}
    </div>
);

export default EmptyState;
