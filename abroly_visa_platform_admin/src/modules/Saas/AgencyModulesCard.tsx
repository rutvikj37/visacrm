import { useEffect, useState } from "react";
import { Button, Checkbox, Chip } from "@nextui-org/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

/**
 * Super Admin: CRM type and module checklist for one agency (SA-01, SA-02, SA-04).
 * Ticks start from the CRM type and plan; ticking or unticking stores an override.
 * Switching a module off only hides it - the agency's data is kept. Every change is written to the activity log.
 */
type ModuleState = { key: string; label: string; group: "common" | "visa" | "travel"; default: "on" | "addon" | "off"; in_plan: boolean; override: boolean | null; enabled: boolean };

const GROUPS: { key: ModuleState["group"]; label: string }[] = [
    { key: "common", label: "Shared" }, { key: "visa", label: "Visa" }, { key: "travel", label: "Travel" },
];

const AgencyModulesCard = ({ agencyId, crmType, modules, onSaved }: { agencyId: string; crmType: string; modules: ModuleState[]; onSaved: () => void }) => {
    const { commonPostAPICall } = useApiCallUtils();
    const [type, setType] = useState(crmType || "visa");
    const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});
    const [saving, setSaving] = useState(false);
    useEffect(() => { setType(crmType || "visa"); setOverrides({}); }, [crmType, modules]);

    const changedType = type !== (crmType || "visa");
    const dirty = changedType || Object.keys(overrides).length > 0;

    const valueOf = (m: ModuleState) => (overrides[m.key] !== undefined ? overrides[m.key] : m.override);
    // what the checkbox shows: an override wins; otherwise the default for the (possibly new) CRM type and plan
    const checked = (m: ModuleState) => {
        const o = valueOf(m);
        if (o !== null && o !== undefined) return o;
        if (changedType) return false; // shown after save; the server works out the new defaults
        return m.enabled;
    };

    const toggle = (m: ModuleState, on: boolean) => {
        const defaultOn = !changedType && m.default === "on" && m.in_plan;
        // back to default when the tick matches the default again
        setOverrides((o) => ({ ...o, [m.key]: !changedType && on === defaultOn ? null : on }));
    };

    const save = async () => {
        setSaving(true);
        const { success } = await commonPostAPICall({ ...(changedType ? { crm_type: type } : {}), overrides }, `saas_admin/agencies/${agencyId}/modules`, true);
        setSaving(false);
        if (success) onSaved();
    };

    return (
        <div className="rounded-xl border border-default-200 bg-content1 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                    <div className="font-semibold">Modules</div>
                    <div className="text-xs text-default-500">Menus, dashboards and APIs follow these ticks. Switching a module off keeps its data.</div>
                </div>
                <Button size="sm" color="primary" isDisabled={!dirty} isLoading={saving} onPress={save}>Save modules</Button>
            </div>
            {changedType && <div className="text-xs rounded-lg bg-warning-50 border border-warning-200 p-2">Modules switch to the {type === "both" ? "Visa + Travel" : type === "travel" ? "Travel" : "Visa"} defaults when you save. Overrides you keep stay as they are.</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {GROUPS.map((g) => (
                    <div key={g.key} className="flex flex-col gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-default-500">{g.label}</div>
                        {modules.filter((m) => m.group === g.key).map((m) => (
                            <div key={m.key} className="flex items-start gap-2">
                                <Checkbox size="sm" isSelected={Boolean(checked(m))} onValueChange={(v) => toggle(m, v)} aria-label={m.label} />
                                <div className="min-w-0 text-sm leading-tight pt-0.5">
                                    <div>{m.label}</div>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {valueOf(m) !== null && valueOf(m) !== undefined
                                            ? <Chip size="sm" variant="flat" color="secondary">Override</Chip>
                                            : m.default === "addon" ? <Chip size="sm" variant="flat" color="warning">Add-on</Chip>
                                                : m.default === "off" ? <Chip size="sm" variant="flat">Not in this CRM type</Chip> : null}
                                        {!m.in_plan && <Chip size="sm" variant="flat" color="danger">Not in plan</Chip>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AgencyModulesCard;
