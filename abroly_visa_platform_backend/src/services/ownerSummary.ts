import { Op, Sequelize } from "sequelize";
import Agent from "../model/Agent";
import CrmLead from "../model/CrmLead";
import AgencyLeads from "../model/AgencyLeads";
import ClientPayment from "../model/ClientPayment";
import ClientInvoice from "../model/ClientInvoice";
import { agencyBrand, sendMail } from "./mailer";
import { activeAgencyUuids } from "./notifications";

/**
 * Monthly summary for agency owners: last month's leads, conversions, visas and money,
 * compared with the month before. Sent by email on the 1st (after 9:00 IST), once per month.
 */

const IST_MS = (5 * 60 + 30) * 60 * 1000;
const istNow = () => new Date(Date.now() + IST_MS);
const monthRange = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1) - IST_MS);
    const end = new Date(Date.UTC(y, m, 1) - IST_MS);
    return { start, end };
};
export const previousMonth = (ym?: string) => {
    const d = ym ? new Date(`${ym}-15T00:00:00Z`) : istNow();
    const p = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    return p.toISOString().slice(0, 7);
};
const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const rupees = (paise: number) => `Rs ${Math.round(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
const SOURCE_NAMES: Record<string, string> = { manual: "Added by hand", website: "Website", portal: "Student portal", csv: "Import", indiamart: "IndiaMART", facebook: "Facebook", whatsapp: "WhatsApp", google: "Google Ads", instagram: "Instagram", justdial: "Justdial", sulekha: "Sulekha", other: "Other" };

const numbers = async (agencyUuid: string, ym: string) => {
    const { start, end } = monthRange(ym);
    const inMonth = { [Op.gte]: start, [Op.lt]: end };
    const [leads, converted, approved, rejected, collected, bySource, byCounsellor] = await Promise.all([
        CrmLead.count({ where: { agency_uuid: agencyUuid, createdAt: inMonth } }),
        CrmLead.count({ where: { agency_uuid: agencyUuid, converted_at: inMonth } }),
        AgencyLeads.count({ where: { agent_uuid: agencyUuid, status: "visa_completed", updatedAt: inMonth } }),
        AgencyLeads.count({ where: { agent_uuid: agencyUuid, status: "visa_rejected", updatedAt: inMonth } }),
        ClientPayment.sum("amount", { where: { agency_uuid: agencyUuid, paid_at: inMonth } }),
        CrmLead.findAll({ where: { agency_uuid: agencyUuid, createdAt: inMonth }, attributes: ["source", [Sequelize.fn("COUNT", Sequelize.col("id")), "n"]], group: ["source"], raw: true }),
        CrmLead.findAll({ where: { agency_uuid: agencyUuid, converted_at: inMonth, assigned_to: { [Op.ne]: null } }, attributes: ["assigned_to", [Sequelize.fn("COUNT", Sequelize.col("id")), "n"]], group: ["assigned_to"], raw: true }),
    ]);
    const sources = (bySource as any[]).map((r) => ({ source: SOURCE_NAMES[r.source] || r.source, n: Number(r.n) })).sort((a, b) => b.n - a.n);
    const top: any = (byCounsellor as any[]).sort((a, b) => Number(b.n) - Number(a.n))[0];
    const topName: any = top ? await Agent.findOne({ where: { id: top.assigned_to }, attributes: ["username"], raw: true }) : null;
    return {
        leads, converted, conversion_rate: leads ? Math.round((converted / leads) * 100) : 0,
        approved, rejected, collected: Number(collected || 0), sources,
        top_counsellor: top ? { name: topName?.username || "Team member", converted: Number(top.n) } : null,
    };
};

/** The summary of one month (default: last month) for one agency. */
export const buildOwnerSummary = async (agencyUuid: string, ym = previousMonth()) => {
    const before = previousMonth(ym);
    const [now, prev] = await Promise.all([numbers(agencyUuid, ym), numbers(agencyUuid, before)]);
    const [openCases, overdue, outstanding] = await Promise.all([
        AgencyLeads.count({ where: { agent_uuid: agencyUuid, status: "visa_progress" } }),
        CrmLead.count({ where: { agency_uuid: agencyUuid, status: { [Op.notIn]: ["converted", "lost", "junk"] }, next_follow_up_at: { [Op.lt]: new Date() } } }),
        ClientInvoice.findAll({ where: { agency_uuid: agencyUuid, status: ["unpaid", "partial"] }, attributes: [[Sequelize.fn("SUM", Sequelize.literal("total - amount_paid")), "due"]], raw: true }),
    ]);
    return { month: ym, month_name: monthName(ym), previous_month_name: monthName(before), now, prev, open_cases: openCases, overdue_follow_ups: overdue, outstanding: Number((outstanding as any)[0]?.due || 0) };
};

const change = (a: number, b: number) => (!b ? (a ? " (new)" : "") : ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%)`);

export const summaryText = (s: any) => {
    const n = s.now, p = s.prev;
    return [
        `Here is how ${s.month_name} went, compared with ${s.previous_month_name}:`,
        "",
        `New leads: ${n.leads}${change(n.leads, p.leads)}`,
        `Converted to visa cases: ${n.converted} (${n.conversion_rate}% of leads)${change(n.converted, p.converted)}`,
        `Visas approved: ${n.approved}${n.rejected ? ` · rejected: ${n.rejected}` : ""}`,
        `Fees collected: ${rupees(n.collected)}${change(n.collected, p.collected)}`,
        n.sources.length ? `Best lead source: ${n.sources[0].source} (${n.sources[0].n} leads)` : null,
        n.top_counsellor ? `Top counsellor: ${n.top_counsellor.name} (${n.top_counsellor.converted} converted)` : null,
        "",
        "Right now:",
        `${s.open_cases} visa case(s) in progress · ${s.overdue_follow_ups} overdue follow-up(s) · ${rupees(s.outstanding)} fees still due`,
    ].filter((x) => x !== null).join("\n");
};

const summaryTable = (s: any, color: string) => {
    const n = s.now, p = s.prev;
    const cell = (label: string, value: string, note: string) =>
        `<td style="padding:10px;border:1px solid #eee;border-radius:8px;width:50%"><div style="font-size:12px;color:#666">${label}</div><div style="font-size:20px;font-weight:bold;color:${color}">${value}</div><div style="font-size:12px;color:#888">${note}</div></td>`;
    return `<table style="width:100%;border-collapse:separate;border-spacing:6px;margin:8px 0">` +
        `<tr>${cell("New leads", String(n.leads), `${p.leads} the month before`)}${cell("Converted", String(n.converted), `${n.conversion_rate}% of leads`)}</tr>` +
        `<tr>${cell("Visas approved", String(n.approved), n.rejected ? `${n.rejected} rejected` : "")}${cell("Fees collected", rupees(n.collected), `${rupees(p.collected)} the month before`)}</tr></table>`;
};

const panelUrl = (path: string) => { const b = (process.env.AGENCY_PANEL_URL || "").replace(/\/+$/, ""); return b ? `${b}${path}` : null; };

/** Email the summary to one agency's owner. Returns whether it went out. */
export const sendOwnerSummary = async (agencyUuid: string, ym = previousMonth()) => {
    const owner: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["email", "username"], raw: true });
    if (!owner?.email) return { ok: false, reason: "No email address on the owner account" };
    const s = await buildOwnerSummary(agencyUuid, ym);
    const brand = await agencyBrand(agencyUuid);
    const url = panelUrl("/dashboard");
    const ok = await sendMail(owner.email, `Your ${s.month_name} summary`, summaryText(s), url ? { label: "Open reports", url } : null, brand, summaryTable(s, brand?.color || "#0f5bd8"));
    return { ok, reason: ok ? undefined : "Email is not set up on the server (SMTP)", to: owner.email };
};

/** Scheduler: on the 1st (after 9:00 IST) send last month's summary to every active agency, once. */
export const monthlyOwnerSummaries = async () => {
    const now = istNow();
    if (now.getUTCDate() !== 1 || now.getUTCHours() < 9) return;
    const ym = previousMonth();
    for (const agencyUuid of await activeAgencyUuids()) {
        const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["id", "ui_prefs"], raw: true });
        let prefs: any = {};
        try { prefs = agency?.ui_prefs ? JSON.parse(agency.ui_prefs) : {}; } catch { prefs = {}; }
        if (prefs.summary_off || prefs.last_summary_month === ym) continue;
        // mark first, so a slow mail server never causes a second email
        await Agent.update({ ui_prefs: JSON.stringify({ ...prefs, last_summary_month: ym }) }, { where: { id: agency.id } });
        await sendOwnerSummary(agencyUuid, ym).catch((e) => console.error("owner summary failed", agencyUuid, e?.message));
    }
};
