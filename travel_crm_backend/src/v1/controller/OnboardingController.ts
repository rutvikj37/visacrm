import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Agent from "../../model/Agent";
import CrmLead from "../../model/CrmLead";
import CrmLeadActivity from "../../model/CrmLeadActivity";
import LeadIntegration from "../../model/LeadIntegration";
import { Quotation, Booking } from "../../model/Travel";
import { buildOwnerSummary, previousMonth, sendOwnerSummary } from "../../services/ownerSummary";

/**
 * Getting started for a new agency (owner): a checklist worked out from real data, and demo leads to
 * explore the CRM with (tagged "sample", removed in one click).
 */

const ctx = (req: RequestWithUser) => {
    const u: any = req.user?.user || {};
    return { agencyUuid: u.agent_uuid as string, userId: Number(u.id), isOwner: u.role === "agent" };
};

const support = () => String(process.env.SAAS_SUPPORT_PHONE || "").replace(/\D/g, "") || null;

const readPrefs = (raw: any) => { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } };
const savePrefs = async (agencyUuid: string, change: Record<string, any>) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "ui_prefs"] });
    const next = { ...readPrefs(agency?.dataValues?.ui_prefs), ...change };
    await Agent.update({ ui_prefs: JSON.stringify(next) }, { where: { id: agency.dataValues.id } });
    return next;
};

const SAMPLE = [
    { name: "Aarav Mehta (sample)", phone: "9000000101", country: "Canada", course: "MBA", source: "facebook", status: "new", city: "Ahmedabad", message: "Want to study MBA in Canada, Sep intake", score: 72 },
    { name: "Diya Patel (sample)", phone: "9000000102", country: "United Kingdom", course: "MSc Data Science", source: "website", status: "contacted", city: "Surat", message: "IELTS 7.0, looking for UK universities", score: 55 },
    { name: "Kabir Singh (sample)", phone: "9000000103", country: "Australia", course: "Nursing", source: "whatsapp", status: "follow_up", city: "Vadodara", message: "What is the total cost for Australia?", score: 48, followUp: 0 },
    { name: "Ananya Rao (sample)", phone: "9000000104", country: "Germany", course: "Mechanical Engineering", source: "indiamart", status: "interested", city: "Rajkot", message: "Public universities in Germany?", score: 80 },
    { name: "Vihaan Shah (sample)", phone: "9000000105", country: "Ireland", course: "MSc Finance", source: "google", status: "counselling", city: "Ahmedabad", message: "Booked counselling for Saturday", score: 85, followUp: 1 },
    { name: "Ishita Joshi (sample)", phone: "9000000106", country: "USA", course: "MS Computer Science", source: "instagram", status: "new", city: "Mumbai", message: "Hi, need help with F1 visa", score: 40 },
    { name: "Reyansh Desai (sample)", phone: "9000000107", country: "Canada", course: "Diploma", source: "justdial", status: "lost", city: "Surat", message: "Budget too low", score: 10, lost: "Budget" },
    { name: "Saanvi Kapoor (sample)", phone: "9000000108", country: "New Zealand", course: "Hospitality", source: "csv", status: "contacted", city: "Pune", message: "Interested in work rights after study", score: 35, followUp: -1 },
];

class OnboardingController {
    // GET /crm/onboarding  - setup checklist (owner)
    async status(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, true, "Onboarding", { show: false, owner: false, support_whatsapp: support() });
            const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "app_name", "favicon_url", "primary_color", "billing_settings", "ui_prefs"] });
            const prefs = readPrefs(agency?.dataValues?.ui_prefs);
            const sampleIds: number[] = Array.isArray(prefs.sample_lead_ids) ? prefs.sample_lead_ids : [];
            const [sources, team, quotes, realLeads, bookings] = await Promise.all([
                LeadIntegration.count({ where: { agency_uuid: agencyUuid } }),
                Agent.count({ where: { parent_id: agency.dataValues.id } }),
                Quotation.count({ where: { agency_uuid: agencyUuid } }),
                CrmLead.count({ where: { agency_uuid: agencyUuid, ...(sampleIds.length ? { id: { [Op.notIn]: sampleIds } } : {}) } }),
                Booking.count({ where: { agency_uuid: agencyUuid } }),
            ]);
            let billing: any = {};
            try { billing = agency.dataValues.billing_settings ? JSON.parse(agency.dataValues.billing_settings) : {}; } catch { billing = {}; }
            const steps = [
                { key: "branding", title: "Add your logo and colour", text: "Your name, logo and colour on the client portal, quotes and this panel.", done: Boolean(agency.dataValues.favicon_url || agency.dataValues.primary_color), link: "/branding", action: "Open Branding" },
                { key: "source", title: "Connect a lead source", text: "Website form, Facebook, WhatsApp, IndiaMART, Google Ads, Justdial ...", done: sources > 0, link: "/crm/sources", action: "Connect" },
                { key: "team", title: "Invite your team", text: "Add travel consultants so new leads are shared automatically.", done: team > 0, link: "/sub_agent", action: "Add team member" },
                { key: "lead", title: "Get your first real lead", text: "Add one by hand, import a file, or wait for your connected source.", done: realLeads > 0, link: "/crm/leads?add=1", action: "Add a lead" },
                { key: "quote", title: "Send your first quotation", text: "Build a day-wise quote with hotels, transfers and pricing, and share it as a link or PDF.", done: quotes > 0, link: "/travel/quotes", action: "Open quotations" },
                { key: "booking", title: "Confirm your first booking", text: "Turn an accepted quote into a booking with travellers, services and payments.", done: bookings > 0, link: "/travel/bookings", action: "Open bookings" },
                { key: "fees", title: "Set up client fees", text: "Your GST details for invoices, and Razorpay for online payments.", done: Boolean(billing.legal_name || billing.gstin), link: "/fees", action: "Open Client fees" },
            ];
            const done = steps.filter((s) => s.done).length;
            return returnHelper(res, 200, true, "Onboarding", {
                show: !prefs.checklist_hidden, owner: true, support_whatsapp: support(), steps, done, total: steps.length,
                sample_loaded: sampleIds.length > 0,
            });
        } catch (error) {
            console.error("onboarding failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/onboarding/hide { hidden }
    async hide(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can do this");
        await savePrefs(agencyUuid, { checklist_hidden: req.body?.hidden !== false });
        return returnHelper(res, 200, true, req.body?.hidden === false ? "Checklist shown" : "Checklist hidden - find it again under Help");
    }

    // POST /crm/sample_data { action: "load" | "clear" }
    async sampleData(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can do this");
            const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "ui_prefs"] });
            const prefs = readPrefs(agency?.dataValues?.ui_prefs);
            const existing: number[] = Array.isArray(prefs.sample_lead_ids) ? prefs.sample_lead_ids : [];

            if (req.body?.action === "clear") {
                if (existing.length) {
                    await CrmLeadActivity.destroy({ where: { lead_id: existing, agency_uuid: agencyUuid }, force: true });
                    await CrmLead.destroy({ where: { id: existing, agency_uuid: agencyUuid }, force: true });
                }
                await savePrefs(agencyUuid, { sample_lead_ids: [] });
                return returnHelper(res, 200, true, "Sample data removed");
            }
            if (existing.length) return returnHelper(res, 200, false, "Sample data is already loaded");

            // created directly (not through lead intake) so no welcome messages or notifications go out
            const ids: number[] = [];
            const day = 24 * 3600 * 1000;
            for (const [i, x] of SAMPLE.entries()) {
                const created = new Date(Date.now() - (i + 1) * 5 * 3600 * 1000);
                const followAt = x.followUp === undefined ? null : new Date(new Date().setHours(11, 0, 0, 0) + x.followUp * day);
                const lead: any = await CrmLead.create({
                    agency_uuid: agencyUuid, name: x.name, country_code: "+91", phone_number: x.phone, phone_normalized: `91${x.phone}`,
                    city: x.city, interested_country: x.country, interested_course: x.course, message: x.message, source: x.source,
                    status: x.status, lost_reason: x.lost || null, score: x.score, tags: ["sample"], assigned_to: userId,
                    next_follow_up_at: followAt, follow_up_note: followAt ? "Call about documents" : null,
                    last_activity_at: created, createdAt: created, created_by: userId,
                });
                ids.push(lead.dataValues.id);
                await CrmLeadActivity.create({ lead_id: lead.dataValues.id, agency_uuid: agencyUuid, type: "created", message: `Lead received via ${x.source} (sample)`, created_by: null, createdAt: created });
                if (x.status !== "new") {
                    await CrmLeadActivity.create({ lead_id: lead.dataValues.id, agency_uuid: agencyUuid, type: "call", message: "Call: discussed courses and budget (sample)", created_by: userId });
                }
            }
            await savePrefs(agencyUuid, { sample_lead_ids: ids });
            return returnHelper(res, 200, true, `${ids.length} sample leads added - remove them any time from the checklist`);
        } catch (error) {
            console.error("sample data failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/monthly_summary?month=YYYY-MM  - the owner's monthly numbers (default last month) + whether the email is on
    async monthlySummary(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can see this");
        const ym = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? String(req.query.month) : previousMonth();
        const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["ui_prefs", "email"], raw: true });
        const prefs = readPrefs(agency?.ui_prefs);
        return returnHelper(res, 200, true, "Summary", { summary: await buildOwnerSummary(agencyUuid, ym), email_on: !prefs.summary_off, email: agency?.email || null });
    }

    // POST /crm/monthly_summary { action: "send" | "on" | "off" }
    async monthlySummaryAction(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can do this");
        const action = String(req.body?.action || "");
        if (action === "on" || action === "off") {
            await savePrefs(agencyUuid, { summary_off: action === "off" });
            return returnHelper(res, 200, true, action === "on" ? "Monthly summary email turned on" : "Monthly summary email turned off");
        }
        if (action === "send") {
            const r = await sendOwnerSummary(agencyUuid);
            return returnHelper(res, 200, r.ok, r.ok ? `Summary sent to ${r.to}` : r.reason || "Could not send");
        }
        return returnHelper(res, 200, false, "Invalid action");
    }
}

export default new OnboardingController();
