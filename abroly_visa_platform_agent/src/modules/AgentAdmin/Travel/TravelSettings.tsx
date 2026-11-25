import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Checkbox, Input, Select, SelectItem, Spinner } from "@heroui/react";
import { CalendarDays, Copy, Plus, ShieldCheck, Trash2 } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SuccessToast } from "@/utils/Toaster";
import { applyLeadStages } from "@/modules/AgentAdmin/Crm/crmShared";
import { PageHead } from "./travelShared";

const STAGE_DEFAULTS: Record<string, string> = { new: "New", contacted: "Contacted", follow_up: "Follow-up", interested: "Interested", counselling: "Counselling", converted: "Converted", lost: "Lost", junk: "Junk" };
const ROLE_LABELS: Record<string, string> = { branch_manager: "Sales manager", counsellor: "Sales agent / consultant", operations: "Operations", accounts: "Accounts", documents: "Document executive" };
const MODULE_LABELS: Record<string, string> = { itinerary: "Itineraries & quotes", bookings: "Bookings & travellers", suppliers: "Suppliers", reports: "Reports" };
const ACTION_LABELS: Record<string, string> = { view: "View", create: "Add", edit: "Edit", delete: "Delete", export: "Export" };

/** Owner settings for the travel side: stage names, destination routing, role permissions, calendar, two-step login. */
const TravelSettings = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [d, setD] = useState<any>(null);
    const [stages, setStages] = useState<Record<string, { label: string; hidden: boolean }>>({});
    const [rules, setRules] = useState<{ match: string; agent_id: number | null }[]>([]);
    const [perms, setPerms] = useState<any>({});
    const [contacts, setContacts] = useState<{ label: string; phone: string }[]>([]);
    const [saving, setSaving] = useState("");

    const load = async () => {
        const { success, data } = await commonGetAPICalls("/travel/settings");
        if (!success) return;
        setD(data);
        setStages(Object.fromEntries((data.stages || []).map((s: any) => [s.key, { label: s.label || "", hidden: Boolean(s.hidden) }])));
        setRules(data.destination_rules || []);
        setPerms(data.permissions || {});
        setContacts(data.emergency_contacts || []);
    };
    useEffect(() => { load(); }, []);

    const save = async (part: string, body: any) => {
        setSaving(part);
        const { success } = await commonPostAPICall(body, "travel/settings", true);
        setSaving("");
        if (success && part === "stages") applyLeadStages(Object.entries(stages).map(([key, v]) => ({ key, label: v.label || null, hidden: v.hidden })));
        if (success) load();
    };

    if (!d) return <div className="py-16 grid place-items-center"><Spinner /></div>;
    const owner = d.is_owner;

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-5xl">
            <PageHead title="Travel settings" sub={owner ? "Lead stages, routing, who can do what, calendar and login security" : "Your calendar link"} />

            <Card shadow="sm"><CardHeader className="font-semibold gap-2"><CalendarDays size={18} /> Your calendar</CardHeader><CardBody className="gap-2">
                <p className="text-sm text-default-600">Add this private link to Google Calendar (Other calendars → From URL) or your phone to see your follow-ups and trip departures. Google refreshes it every few hours.</p>
                <div className="flex gap-2"><Input aria-label="Calendar link" readOnly value={d.calendar_url} /><Button variant="flat" startContent={<Copy size={14} />} onPress={async () => { await navigator.clipboard?.writeText(d.calendar_url); SuccessToast("Calendar link copied"); }}>Copy</Button></div>
                <p className="text-xs text-default-500">Keep this link to yourself: anyone with it can see your follow-ups.</p>
            </CardBody></Card>

            {owner && <TwoStepCard />}

            {owner && (<>
                <Card shadow="sm"><CardHeader className="flex flex-col items-start"><div className="font-semibold">Lead stages</div><div className="text-xs text-default-500">Rename stages to match how your team sells. Hidden stages disappear from the status menus.</div></CardHeader><CardBody className="gap-2">
                    {d.stage_keys.map((k: string) => (
                        <div key={k} className="grid grid-cols-[120px_1fr_auto] gap-3 items-center">
                            <span className="text-sm text-default-500">{STAGE_DEFAULTS[k]}</span>
                            <Input aria-label={`${STAGE_DEFAULTS[k]} name`} size="sm" placeholder={d.stages.find((s: any) => s.key === k)?.label || STAGE_DEFAULTS[k]} value={stages[k]?.label || ""} onValueChange={(v) => setStages((s) => ({ ...s, [k]: { ...(s[k] || { hidden: false }), label: v } }))} />
                            <Checkbox size="sm" isDisabled={["new", "converted"].includes(k)} isSelected={Boolean(stages[k]?.hidden)} onValueChange={(v) => setStages((s) => ({ ...s, [k]: { ...(s[k] || { label: "" }), hidden: v } }))}>Hide</Checkbox>
                        </div>
                    ))}
                    <div className="flex justify-end"><Button color="primary" isLoading={saving === "stages"} onPress={() => save("stages", { lead_stages: stages })}>Save stages</Button></div>
                </CardBody></Card>

                <Card shadow="sm"><CardHeader className="flex flex-col items-start"><div className="font-semibold">Emergency contacts on trip pages</div><div className="text-xs text-default-500">Shown with Call and WhatsApp buttons on every client's trip page, above the trip manager and hotel numbers. Add your 24x7 helpline or ground team.</div></CardHeader><CardBody className="gap-2">
                    {contacts.map((c, i) => (
                        <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                            <Input aria-label="Label" size="sm" className="sm:max-w-xs" placeholder="e.g. 24x7 trip helpline" value={c.label} onValueChange={(v) => setContacts((x) => x.map((y, j) => (j === i ? { ...y, label: v } : y)))} />
                            <Input aria-label="Phone" size="sm" className="flex-1" type="tel" placeholder="+91 98200 11223" value={c.phone} onValueChange={(v) => setContacts((x) => x.map((y, j) => (j === i ? { ...y, phone: v } : y)))} />
                            <Button isIconOnly size="sm" variant="light" aria-label="Remove contact" onPress={() => setContacts((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                    <div className="flex justify-between">
                        <Button size="sm" variant="flat" startContent={<Plus size={14} />} isDisabled={contacts.length >= 8} onPress={() => setContacts((x) => [...x, { label: "", phone: "" }])}>Add contact</Button>
                        <Button color="primary" isLoading={saving === "contacts"} onPress={() => save("contacts", { emergency_contacts: contacts })}>Save contacts</Button>
                    </div>
                </CardBody></Card>

                <Card shadow="sm"><CardHeader className="flex flex-col items-start"><div className="font-semibold">Assign by destination</div><div className="text-xs text-default-500">A new travel enquiry for a matching destination goes straight to that person. Other enquiries use your normal auto-assign.</div></CardHeader><CardBody className="gap-2">
                    {rules.map((r, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <Input aria-label="Destination contains" size="sm" placeholder="e.g. dubai" value={r.match} onValueChange={(v) => setRules((x) => x.map((y, j) => (j === i ? { ...y, match: v } : y)))} />
                            <Select aria-label="Assign to" size="sm" className="max-w-xs" selectedKeys={r.agent_id ? [String(r.agent_id)] : []} onChange={(e) => setRules((x) => x.map((y, j) => (j === i ? { ...y, agent_id: Number(e.target.value) || null } : y)))}>
                                {d.team.map((t: any) => <SelectItem key={String(t.id)}>{t.name}</SelectItem>)}
                            </Select>
                            <Button isIconOnly size="sm" variant="light" aria-label="Remove rule" onPress={() => setRules((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                    <div className="flex justify-between">
                        <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => setRules((x) => [...x, { match: "", agent_id: null }])}>Add rule</Button>
                        <Button color="primary" isLoading={saving === "rules"} onPress={() => save("rules", { destination_rules: rules })}>Save rules</Button>
                    </div>
                </CardBody></Card>

                <Card shadow="sm"><CardHeader className="flex flex-col items-start"><div className="font-semibold">Role permissions</div><div className="text-xs text-default-500">What each team role can do in the travel modules. “See cost and margin” controls supplier costs, markup and profit everywhere.</div></CardHeader><CardBody className="gap-4 overflow-x-auto">
                    {d.roles.map((role: string) => (
                        <div key={role} className="min-w-[640px]">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-sm">{ROLE_LABELS[role] || role}</div>
                                <Checkbox size="sm" isSelected={Boolean(perms[role]?.see_cost)} onValueChange={(v) => setPerms((p: any) => ({ ...p, [role]: { ...p[role], see_cost: v } }))}>See cost and margin</Checkbox>
                            </div>
                            <table className="w-full text-sm">
                                <thead><tr className="text-xs text-default-500 text-left"><th className="p-1 w-48">Module</th>{d.actions.map((a: string) => <th key={a} className="p-1 text-center">{ACTION_LABELS[a]}</th>)}</tr></thead>
                                <tbody>{d.modules.map((m: string) => (
                                    <tr key={m} className="border-t border-default-100">
                                        <td className="p-1">{MODULE_LABELS[m]}</td>
                                        {d.actions.map((a: string) => (
                                            <td key={a} className="p-1 text-center"><Checkbox size="sm" aria-label={`${ROLE_LABELS[role]} ${MODULE_LABELS[m]} ${a}`} isSelected={Boolean(perms[role]?.[m]?.[a])}
                                                onValueChange={(v) => setPerms((p: any) => {
                                                    const row = { ...(p[role]?.[m] || {}), [a]: v };
                                                    if (a === "view" && !v) for (const x of d.actions) row[x] = false;
                                                    if (a !== "view" && v) row.view = true;
                                                    return { ...p, [role]: { ...p[role], [m]: row } };
                                                })} /></td>
                                        ))}
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    ))}
                    <div className="flex justify-between">
                        <Button size="sm" variant="light" onPress={() => setPerms(d.defaults)}>Reset to defaults</Button>
                        <Button color="primary" isLoading={saving === "perms"} onPress={() => save("perms", { permissions: perms })}>Save permissions</Button>
                    </div>
                </CardBody></Card>
            </>)}
        </div>
    );
};

/** Owner two-step login with an authenticator app. */
export const TwoStepCard = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [status, setStatus] = useState<any>(null);
    const [setup, setSetup] = useState<any>(null);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const load = async () => { const { success, data } = await commonGetAPICalls("/crm/security/totp"); if (success) setStatus(data); };
    useEffect(() => { load(); }, []);
    if (!status?.available) return null;
    const run = async (url: string, body: any = {}) => {
        setBusy(true);
        const r = await commonPostAPICall(body, url, true);
        setBusy(false);
        return r;
    };
    return (
        <Card shadow="sm"><CardHeader className="font-semibold gap-2"><ShieldCheck size={18} /> Two-step login {status.enabled ? <span className="text-xs font-normal text-success">On</span> : <span className="text-xs font-normal text-default-500">Off</span>}</CardHeader><CardBody className="gap-3">
            {status.enabled ? (<>
                <p className="text-sm text-default-600">After your passcode we ask for the 6-digit code from your authenticator app. To turn it off, enter the current code.</p>
                <div className="flex gap-2 max-w-sm"><Input aria-label="Current code" placeholder="123456" maxLength={6} value={code} onValueChange={(v) => setCode(v.replace(/\D/g, ""))} /><Button variant="flat" color="danger" isLoading={busy} onPress={async () => { const r = await run("crm/security/totp/disable", { code }); if (r.success) { setCode(""); load(); } }}>Turn off</Button></div>
            </>) : setup ? (<>
                <ol className="text-sm text-default-600 list-decimal pl-5 flex flex-col gap-1">
                    <li>Open Google Authenticator, Microsoft Authenticator or Authy and add an account.</li>
                    <li>Choose “Enter a setup key” and type this key: <code className="font-mono bg-default-100 px-1 rounded select-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code> (time based). On this phone you can also <a className="text-primary underline" href={setup.uri}>open it in the app</a>.</li>
                    <li>Enter the 6-digit code the app shows.</li>
                </ol>
                <div className="flex gap-2 max-w-sm"><Input aria-label="Code from app" placeholder="123456" maxLength={6} value={code} onValueChange={(v) => setCode(v.replace(/\D/g, ""))} /><Button color="primary" isLoading={busy} onPress={async () => { const r = await run("crm/security/totp/enable", { code }); if (r.success) { setSetup(null); setCode(""); load(); } }}>Turn on</Button></div>
            </>) : (<>
                <p className="text-sm text-default-600">Protect the owner account: even with your passcode, nobody can log in without the code on your phone.</p>
                <div><Button color="primary" variant="flat" isLoading={busy} onPress={async () => { const r = await run("crm/security/totp/setup"); if (r.success) setSetup(r.data); }}>Set up two-step login</Button></div>
            </>)}
        </CardBody></Card>
    );
};

export default TravelSettings;
