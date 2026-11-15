import { useState } from "react";
import { Card, CardBody, CardHeader, Select, SelectItem } from "@heroui/react";
import { Building2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { useBranches } from "@/modules/AgentAdmin/Branches/branchShared";

const TYPE_LABEL: Record<string, string> = {
    website: "Website form", indiamart: "IndiaMART", facebook: "Facebook Page", instagram: "Instagram", whatsapp: "WhatsApp",
    google: "Google Ads", justdial: "Justdial", sulekha: "Sulekha",
};

/** Owner: send all leads of a source to one branch (e.g. the Surat website form, the Surat WhatsApp number). */
const SourceBranchCard = ({ integrations, onChanged }: { integrations: any[]; onChanged: () => void }) => {
    const branches = useBranches();
    const { commonPostAPICall } = useApiCallUtils();
    const [busy, setBusy] = useState<string | null>(null);
    if (!branches.length || !integrations.length) return null;

    const save = async (uuid: string, value: string) => {
        setBusy(uuid);
        const { success } = await commonPostAPICall({ branch_id: value === "auto" ? null : Number(value) }, `crm/integrations/${uuid}/branch`, true);
        setBusy(null);
        if (success) onChanged();
    };

    return (
        <Card shadow="sm">
            <CardHeader className="font-semibold flex items-center gap-2"><Building2 size={18} /> Which branch gets these leads</CardHeader>
            <CardBody className="pt-0 gap-2">
                <p className="text-sm text-default-500">"By city" sends each lead to the branch serving its city (set cities on the Branches page), or to the branch of the person it is assigned to.</p>
                <div className="divide-y divide-default-100">
                    {integrations.map((i) => (
                        <div key={i.uuid} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{i.name || TYPE_LABEL[i.type] || i.type}</div>
                                <div className="text-xs text-default-500">{TYPE_LABEL[i.type] || i.type}{i.status !== "active" ? " · off" : ""}</div>
                            </div>
                            <Select aria-label={`Branch for ${i.name || i.type}`} size="sm" className="w-full sm:w-56" isDisabled={busy === i.uuid}
                                selectedKeys={[i.branch_id ? String(i.branch_id) : "auto"]} onChange={(e) => e.target.value && save(i.uuid, e.target.value)}>
                                {[<SelectItem key="auto">By city / assignee</SelectItem>, ...branches.map((b) => <SelectItem key={String(b.id)}>{b.name}</SelectItem>)]}
                            </Select>
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
};

export default SourceBranchCard;
