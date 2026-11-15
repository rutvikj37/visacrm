import { useCallback, useEffect, useState } from "react";
import {
    Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Switch, Textarea, useDisclosure,
} from "@nextui-org/react";
import { AlertTriangle, Megaphone, PartyPopper, Pencil, Plus, Send, Square, Trash2, Users } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { FormField, fmtDate } from "./saasShared";

const EMPTY = {
    title: "", body: "", level: "info", link_url: "", link_label: "", audience: "all", plan_ids: [] as string[], agency_uuids: [] as string[],
    people: "everyone", show_banner: true, send_email: false, starts_at: "", ends_at: "",
};
const LEVEL: Record<string, { label: string; icon: any; box: string }> = {
    info: { label: "Information", icon: Megaphone, box: "bg-primary-50 text-primary-800" },
    success: { label: "Good news / new feature", icon: PartyPopper, box: "bg-success-50 text-success-800" },
    warning: { label: "Important / maintenance", icon: AlertTriangle, box: "bg-warning-50 text-warning-800" },
};
const AUDIENCE: Record<string, string> = { all: "All agencies", trial: "Agencies on free trial", paid: "Paying agencies", plans: "Agencies on certain plans", agencies: "Chosen agencies" };
const STATE: Record<string, { label: string; color: any }> = {
    draft: { label: "Draft", color: "default" }, live: { label: "Live", color: "success" }, scheduled: { label: "Scheduled", color: "primary" }, ended: { label: "Ended", color: "default" },
};
const localInput = (v?: string | null) => (v ? new Date(new Date(v).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

/** Messages to agencies: banner in their panel + bell notification (+ email). */
const SaasAnnouncements = () => {
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const [rows, setRows] = useState<any[] | null>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [agencies, setAgencies] = useState<any[]>([]);
    const [form, setForm] = useState<any>(EMPTY);
    const [editing, setEditing] = useState<any>(null);
    const [reach, setReach] = useState<any>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const modal = useDisclosure();

    const load = useCallback(async () => {
        const { success, data } = await commonGetAPICalls("/saas_admin/announcements");
        setRows(success ? data || [] : []);
    }, []);
    useEffect(() => {
        load();
        (async () => {
            const [p, a] = await Promise.all([commonGetAPICalls("/saas_admin/plans"), commonGetAPICalls("/saas_admin/usage?sort=name")]);
            if (p.success) setPlans(p.data || []);
            if (a.success) setAgencies(a.data?.agencies || []);
        })();
    }, [load]);

    // how many people will get it
    useEffect(() => {
        if (!modal.isOpen) return;
        const t = setTimeout(async () => {
            const { success, data } = await commonPostAPICall({ audience: form.audience, plan_ids: form.plan_ids, agency_uuids: form.agency_uuids, people: form.people }, "/saas_admin/announcements/preview");
            setReach(success ? data : null);
        }, 300);
        return () => clearTimeout(t);
    }, [modal.isOpen, form.audience, form.plan_ids, form.agency_uuids, form.people]);

    const open = (a?: any) => {
        setEditing(a || null);
        setForm(a ? { ...EMPTY, ...a, body: a.body || "", link_url: a.link_url || "", link_label: a.link_label || "", starts_at: localInput(a.starts_at), ends_at: localInput(a.ends_at) } : EMPTY);
        modal.onOpen();
    };
    const save = async (publish: boolean, close: () => void) => {
        if (publish && !window.confirm(`Publish to ${reach ? `${reach.people} people` : "this audience"}? They get a notification${form.send_email ? " and an email" : ""} right away.`)) return;
        setSaving(publish ? "publish" : "save");
        const body = { ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null, publish };
        const { success } = await commonPostAPICall(body, editing ? `/saas_admin/announcements/${editing.id}/update` : "/saas_admin/announcements", true);
        setSaving(null);
        if (success) { close(); load(); }
    };
    const action = async (a: any, what: "end" | "delete") => {
        if (!window.confirm(what === "end" ? "End this announcement now? Banners disappear for everyone." : "Delete this announcement?")) return;
        const { success } = await commonPostAPICall({}, `/saas_admin/announcements/${a.id}/${what}`, true);
        if (success) load();
    };
    const set = (k: string) => (v: any) => setForm({ ...form, [k]: v });
    const sent = editing && editing.status !== "draft";
    const Preview = LEVEL[form.level]?.icon || Megaphone;

    return (
        <div className="flex flex-col gap-4 p-2 max-w-4xl">
            <div className="flex flex-wrap items-start gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Announcements</h1>
                    <p className="text-sm text-default-500">Tell agencies about new features, maintenance or offers. They see a banner in their panel and a notification.</p>
                </div>
                <Button color="primary" className="ml-auto" startContent={<Plus size={16} />} onPress={() => open()}>New announcement</Button>
            </div>

            {!rows ? <div className="flex justify-center p-8"><Spinner /></div> : !rows.length ? (
                <Card shadow="sm"><CardBody className="text-center text-default-500 py-10">No announcements yet.</CardBody></Card>
            ) : rows.map((a) => {
                const L = LEVEL[a.level] || LEVEL.info;
                const Icon = L.icon;
                return (
                    <Card key={a.id} shadow="sm">
                        <CardBody className="flex flex-col sm:flex-row gap-3">
                            <div className={`p-2 rounded-lg h-fit w-fit ${L.box}`}><Icon size={18} /></div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">{a.title}</span>
                                    <Chip size="sm" variant="flat" color={STATE[a.state]?.color}>{STATE[a.state]?.label || a.state}</Chip>
                                </div>
                                {a.body && <p className="text-sm text-default-600 whitespace-pre-line line-clamp-2">{a.body}</p>}
                                <div className="text-xs text-default-500 mt-1 flex flex-wrap gap-x-3">
                                    <span>{AUDIENCE[a.audience]}{a.people === "owners" ? " · owners only" : " · whole team"}</span>
                                    {a.published_at && <span>Sent {fmtDate(a.published_at)} to {a.recipients} {a.recipients === 1 ? "person" : "people"}</span>}
                                    {a.dismissed > 0 && <span>{a.dismissed} closed the banner</span>}
                                    {a.ends_at && <span>Until {fmtDate(a.ends_at)}</span>}
                                    {a.send_email && <span>Emailed</span>}
                                </div>
                            </div>
                            <div className="flex gap-1 sm:self-start">
                                <Button isIconOnly size="sm" variant="light" aria-label="Edit" onPress={() => open(a)}><Pencil size={15} /></Button>
                                {a.state === "live" || a.state === "scheduled" ? <Button isIconOnly size="sm" variant="light" aria-label="End now" onPress={() => action(a, "end")}><Square size={15} /></Button> : null}
                                <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete" onPress={() => action(a, "delete")}><Trash2 size={15} /></Button>
                            </div>
                        </CardBody>
                    </Card>
                );
            })}

            <Modal isOpen={modal.isOpen} onOpenChange={modal.onOpenChange} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{editing ? "Edit announcement" : "New announcement"}</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField label="Title *" className="sm:col-span-2"><Input aria-label="Title" value={form.title} onValueChange={set("title")} /></FormField>
                                    <FormField label="Message" className="sm:col-span-2"><Textarea aria-label="Message" minRows={3} value={form.body} onValueChange={set("body")} /></FormField>
                                    <FormField label="Type">
                                        <Select aria-label="Type" selectedKeys={[form.level]} onChange={(e) => e.target.value && set("level")(e.target.value)}>
                                            {Object.entries(LEVEL).map(([k, v]) => <SelectItem key={k}>{v.label}</SelectItem>)}
                                        </Select>
                                    </FormField>
                                    <FormField label="Who sees it">
                                        <Select aria-label="People" selectedKeys={[form.people]} onChange={(e) => e.target.value && set("people")(e.target.value)}>
                                            <SelectItem key="everyone">Owners and their team</SelectItem>
                                            <SelectItem key="owners">Agency owners only</SelectItem>
                                        </Select>
                                    </FormField>
                                    <FormField label="Agencies" className="sm:col-span-2">
                                        <Select aria-label="Audience" selectedKeys={[form.audience]} onChange={(e) => e.target.value && set("audience")(e.target.value)}>
                                            {Object.entries(AUDIENCE).map(([k, v]) => <SelectItem key={k}>{v}</SelectItem>)}
                                        </Select>
                                    </FormField>
                                    {form.audience === "plans" && (
                                        <FormField label="Plans" className="sm:col-span-2">
                                            <Select aria-label="Plans" selectionMode="multiple" selectedKeys={new Set(form.plan_ids)} onSelectionChange={(k) => set("plan_ids")(Array.from(k as Set<string>))}>
                                                {plans.map((p: any) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                                            </Select>
                                        </FormField>
                                    )}
                                    {form.audience === "agencies" && (
                                        <FormField label="Agencies" className="sm:col-span-2">
                                            <Select aria-label="Chosen agencies" selectionMode="multiple" selectedKeys={new Set(form.agency_uuids)} onSelectionChange={(k) => set("agency_uuids")(Array.from(k as Set<string>))}>
                                                {agencies.map((a: any) => <SelectItem key={a.id} textValue={a.name}>{a.name}{a.phone ? ` · ${a.phone}` : ""}</SelectItem>)}
                                            </Select>
                                        </FormField>
                                    )}
                                    <FormField label="Button link (optional)"><Input aria-label="Link" placeholder="/crm/sources or https://..." value={form.link_url} onValueChange={set("link_url")} /></FormField>
                                    <FormField label="Button text"><Input aria-label="Button text" placeholder="Learn more" value={form.link_label} onValueChange={set("link_label")} /></FormField>
                                    <FormField label="Show from (optional)"><Input aria-label="Show from" type="datetime-local" value={form.starts_at} onValueChange={set("starts_at")} /></FormField>
                                    <FormField label="Show until (optional)"><Input aria-label="Show until" type="datetime-local" value={form.ends_at} onValueChange={set("ends_at")} /></FormField>
                                    <div className="flex items-center gap-2 text-sm"><Switch size="sm" aria-label="Banner" isSelected={form.show_banner} onValueChange={set("show_banner")} />Show as a banner in their panel</div>
                                    <div className="flex items-center gap-2 text-sm"><Switch size="sm" aria-label="Email" isDisabled={sent} isSelected={form.send_email} onValueChange={set("send_email")} />Also send by email</div>
                                </div>
                                {form.title && (
                                    <div className="mt-2">
                                        <div className="text-xs text-default-500 mb-1">Preview</div>
                                        <div className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm ${LEVEL[form.level]?.box}`}>
                                            <Preview size={18} className="shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0"><div className="font-semibold">{form.title}</div>{form.body && <div className="whitespace-pre-line opacity-90">{form.body}</div>}</div>
                                            {form.link_url && <span className="rounded-lg bg-white/60 px-2 py-1 text-xs font-medium self-center">{form.link_label || "Learn more"}</span>}
                                        </div>
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter className="flex-wrap">
                                <span className="text-sm text-default-500 flex items-center gap-1 mr-auto"><Users size={14} />{reach ? `${reach.people} ${reach.people === 1 ? "person" : "people"} in ${reach.agencies} ${reach.agencies === 1 ? "agency" : "agencies"}` : "-"}</span>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                {!sent && <Button variant="flat" isLoading={saving === "save"} onPress={() => save(false, onClose)}>Save draft</Button>}
                                {sent
                                    ? <Button color="primary" isLoading={saving === "save"} onPress={() => save(false, onClose)}>Save changes</Button>
                                    : <Button color="primary" startContent={<Send size={14} />} isLoading={saving === "publish"} onPress={() => save(true, onClose)}>Publish</Button>}
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default SaasAnnouncements;
