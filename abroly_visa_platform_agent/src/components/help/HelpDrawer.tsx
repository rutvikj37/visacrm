import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Kbd, Tooltip, useDisclosure } from "@heroui/react";
import { BookOpen, CircleHelp, Keyboard, ListChecks, MessageCircle, RotateCcw } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { SHORTCUTS } from "@/components/panel/KeyboardShortcuts";
import { TUTORIAL_ENABLED, useOnboarding, resetTips } from "./onboardingStore";

type Help = { title: string; points: string[] };

/** Short help for each screen, by path prefix (longest match wins). */
const HELP: [string, Help][] = [
    ["/", { title: "Today", points: [
        "Everything that needs you today: overdue and today's follow-ups, new leads, case steps due, documents to review and fees due.",
        "Tap the phone or WhatsApp button on a lead to contact them. After a call you are asked how it went.",
        "Owners and branch managers can pick a branch at the top to see only that office.",
    ] }],
    ["/crm/leads", { title: "Lead Inbox", points: [
        "Every enquiry from your website, Facebook, WhatsApp, IndiaMART, Google Ads, Justdial and other sources lands here.",
        "Click a lead to open it on the side. Use the arrow keys (or j / k) to move to the next lead without closing it.",
        "Change status or who it is assigned to right from the list. Select several leads for bulk actions - you can undo for a few seconds.",
        "Set a follow-up on every lead you talk to. Overdue follow-ups show in red on Today.",
        "When a student is ready, open the lead and press 'Convert to visa case'.",
    ] }],
    ["/crm/chats", { title: "Chats", points: [
        "In-app chat with students who have a visa case with you. They message from their student portal.",
        "Open a chat to reply. The assigned counsellor and your team (by branch) can see the same thread.",
        "Green numbers are unread student messages. Use All / Unread / Mine to focus.",
    ] }],
    ["/crm/tasks", { title: "Tasks", points: [
        "Assign work to your team: create a task, pick an assignee and due date.",
        "Board columns are To do, In progress and Done. Use Move to on a card to change status.",
        "Optionally link a CRM lead or visa case so the assignee can open it from the task.",
        "Filters: Mine, Assigned by me, All — plus Open / Overdue / Done.",
    ] }],
    ["/crm/sources", { title: "Lead sources", points: [
        "Connect where your leads come from. Each source gets its own link or key - new leads arrive in the inbox within seconds.",
        "A source can belong to a branch, so its leads go straight to that office.",
        "Turn on auto-assign and pick which counsellors receive new leads (round robin). Leave none selected to include everyone eligible.",
        "Use 'Send test lead' after connecting to check it works.",
    ] }],
    ["/crm/templates", { title: "Visa templates", points: [
        "A template is the list of steps and documents for one visa type (for example Canada study permit).",
        "Copy a ready template and change it to how your agency works. New cases start from it.",
    ] }],
    ["/crm/calendar", { title: "Calendar", points: [
        "Follow-ups, case step dues, fee instalments, tasks and events in one place. On phones it opens as an agenda.",
        "Filter by type, mark a follow-up done or snooze it, and Call / WhatsApp from the row. Add a simple event from the calendar.",
        "Subscribe with Google / Apple / Outlook using the private calendar link.",
    ] }],
    ["/crm/messages", { title: "Messages", points: ["Automatic WhatsApp and email messages: welcome message to new leads, follow-up reminders and fee reminders. Turn each on or off and edit the text."] }],
    ["/cases/board", { title: "Case board", points: [
        "Every visa case as a card, grouped by stage. Drag a card to move it to the next stage.",
        "Open a case to tick off steps, review documents the student uploaded and message the student.",
    ] }],
    ["/leads/progress", { title: "Visa case", points: [
        "The stage tracker at the top shows where this case is. Tick each step when done - the student sees progress in their portal.",
        "Documents the student uploads wait for your review here. Accept or ask for a new copy with a note.",
    ] }],
    ["/fees", { title: "Client fees", points: [
        "Create invoices for your students with GST worked out automatically. Share a payment link on WhatsApp.",
        "Record cash or bank payments by hand. Due dates show on Today two days ahead.",
        "Set your GSTIN and invoice details under Billing settings.",
    ] }],
    ["/services", { title: "Services store", points: [
        "Add the services you sell (coaching, SOP writing, visa file charges, accommodation ...) with a price and GST.",
        "Services that are on sale appear under Services in your student portal. Students pay online with Razorpay.",
        "Every purchase becomes a paid GST invoice with a receipt in Client fees, and you get a notification.",
        "Share a service on WhatsApp with the portal link. Hide a service with its switch without deleting it.",
    ] }],
    ["/settings/payments", { title: "Payments", points: [
        "Connect your own Razorpay account. Payments from students go straight to your bank account.",
        "Paste the Key ID and Key Secret from Razorpay Dashboard > Account & Settings > API Keys. They are checked before saving.",
        "Try with test keys first, then switch to live keys.",
    ] }],
    ["/branches", { title: "Branches", points: ["Add each office. New leads go to a branch by their source, then city, then the person assigned. Each branch can have its own GSTIN and invoice numbers."] }],
    ["/team/roles", { title: "Roles & branches", points: ["Choose what each team member can do (counsellor, documents, accounts, branch manager) and which branch they belong to."] }],
    ["/sub_agent", { title: "Team", points: ["Add counsellors and staff. They sign in with their own phone number and see only their own leads (managers see their branch)."] }],
    ["/reports", { title: "Reports", points: ["Overview for leads and visas. Click Converted to open those visa cases. Pipeline shows conversion by source, counsellor and branch."] }],
    ["/branding", { title: "Branding", points: ["Your logo, name and colour appear on the student portal, this panel, invoices and emails."] }],
    ["/subscription", { title: "Subscription", points: ["Your plan, renewal date and GST invoices for what you paid us."] }],
];

const helpFor = (path: string): Help => {
    if (path === "/") return HELP[0][1];
    const hit = HELP.filter(([p]) => p !== "/" && (path === p || path.startsWith(`${p}/`))).sort((a, b) => b[0].length - a[0].length)[0];
    return hit ? hit[1] : { title: "Help", points: ["Use the menu on the left to move between Leads, Visa cases, Team and Settings. Press / to search anything."] };
};

/** "?" button in the top bar: help for this screen, shortcuts, setup checklist and WhatsApp support. */
const HelpDrawer = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
    const { data, reload } = useOnboarding(commonGetAPICalls);
    const isOwner = useSelector((state: any) => state.login.role_type) === "agent";
    const drawer = useDisclosure();
    const [placement, setPlacement] = useState<"right" | "bottom">("right");
    useEffect(() => {
        const set = () => setPlacement(window.innerWidth < 640 ? "bottom" : "right");
        set(); window.addEventListener("resize", set);
        const open = () => drawer.onOpen();
        window.addEventListener("open-help", open);
        return () => { window.removeEventListener("resize", set); window.removeEventListener("open-help", open); };
    }, []);
    const h = helpFor(pathname);
    const go = (to: string) => { drawer.onClose(); navigate(to); };
    const showChecklist = async () => {
        const { success } = await commonPostAPICall({ hidden: false }, "crm/onboarding/hide", false);
        if (success) { await reload(); go("/"); }
    };
    const supportText = encodeURIComponent(`Hi, I need help with the CRM (screen: ${h.title}).`);

    return (
        <>
            <Tooltip content="Help" placement="bottom">
                <Button isIconOnly variant="light" size="sm" aria-label="Help" onPress={drawer.onOpen}><CircleHelp size={19} /></Button>
            </Tooltip>
            <Drawer isOpen={drawer.isOpen} onOpenChange={drawer.onOpenChange} placement={placement} size={placement === "bottom" ? "lg" : "sm"}>
                <DrawerContent>
                    <DrawerHeader className="flex items-center gap-2"><BookOpen size={18} /> {h.title}</DrawerHeader>
                    <DrawerBody className="gap-5">
                        <ul className="flex flex-col gap-2 text-sm text-default-700">
                            {h.points.map((p) => <li key={p} className="flex gap-2"><span className="text-primary">•</span><span>{p}</span></li>)}
                        </ul>

                        {TUTORIAL_ENABLED && isOwner && data?.owner && (
                            <div className="rounded-xl border border-default-200 p-3 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-sm font-medium"><ListChecks size={16} /> Setup checklist <span className="text-default-500 font-normal">{data.done} / {data.total}</span></div>
                                {data.show
                                    ? <Button size="sm" variant="flat" onPress={() => go("/")}>Open on Today</Button>
                                    : <Button size="sm" variant="flat" onPress={showChecklist}>Show it again on Today</Button>}
                            </div>
                        )}

                        <div className="max-sm:hidden flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium"><Keyboard size={16} /> Keyboard shortcuts</div>
                            <div className="flex flex-col divide-y divide-default-100 text-sm">
                                {SHORTCUTS.slice(0, 7).map((s) => (
                                    <div key={s.label} className="flex items-center gap-2 py-1.5">
                                        <span className="flex-1 text-default-600">{s.label}</span>
                                        <span className="flex gap-1">{s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {TUTORIAL_ENABLED && (
                            <button type="button" className="flex items-center gap-2 text-xs text-default-500 hover:text-default-700 self-start" onClick={() => { resetTips(); drawer.onClose(); window.location.reload(); }}>
                                <RotateCcw size={13} /> Show first-visit tips again
                            </button>
                        )}
                    </DrawerBody>
                    <DrawerFooter className="flex-col items-stretch gap-2">
                        {/* /contact_us in the panel is the agency's own contact-form inbox, not support - so no fallback link */}
                        {data?.support_whatsapp && <Button as="a" href={`https://wa.me/${data.support_whatsapp}?text=${supportText}`} target="_blank" rel="noopener" color="success" variant="flat" startContent={<MessageCircle size={16} />}>Chat with support on WhatsApp</Button>}
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </>
    );
};

export default HelpDrawer;
