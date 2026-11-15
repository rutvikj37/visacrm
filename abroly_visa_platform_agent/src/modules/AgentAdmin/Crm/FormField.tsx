import { ReactNode } from "react";

/** Simple label above a field (this project does not use HeroUI's floating labels). */
const FormField = ({ label, className = "", children }: { label: ReactNode; className?: string; children: ReactNode }) => (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
        <span className="text-xs font-medium text-default-600">{label}</span>
        {children}
    </div>
);

export default FormField;
