import { Response } from "express";
import { Op, fn, col, literal } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import CrmLead, { CRM_LEAD_SOURCES } from "../../model/CrmLead";
import CrmLeadActivity from "../../model/CrmLeadActivity";
import AgencyLeads from "../../model/AgencyLeads";
import Agent from "../../model/Agent";
import MarketingSpend from "../../model/MarketingSpend";
import AgencyBranch from "../../model/AgencyBranch";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/dbconfig";
import { accessOf } from "../../helpers/access";
import { REFUSAL_REASONS } from "./CaseController";

/**
 * Whose numbers a person may see: the owner everything (optionally one branch with ?branch=),
 * a branch manager only their own branch. `filter` is undefined when no branch filter applies.
 */
const reportAccess = (req: RequestWithUser): { allowed: boolean; filter?: number | null; locked?: boolean } => {
    const a = accessOf(req);
    if (a.isOwner) {
        const raw = String(req.query.branch || "").trim();
        if (raw === "none") return { allowed: true, filter: null };
        const id = Number(raw);
        return { allowed: true, filter: raw && Number.isInteger(id) && id > 0 ? id : undefined };
    }
    if (a.teamRole === "branch_manager" && a.branchId) return { allowed: true, filter: a.branchId, locked: true };
    return { allowed: false };
};

/**
 * Pipeline analytics: owner / accounts / branch managers see agency (or branch) numbers;
 * counsellors see only leads assigned to them.
 */
const pipelineAccess = (req: RequestWithUser): {
    allowed: boolean;
    filter?: number | null;
    locked?: boolean;
    assigneeOnly?: number;
    canSeeBranches?: boolean;
} => {
    const a = accessOf(req);
    if (a.isOwner || a.teamRole === "accounts") {
        const raw = String(req.query.branch || "").trim();
        if (raw === "none") return { allowed: true, filter: null, canSeeBranches: true };
        const id = Number(raw);
        return {
            allowed: true,
            filter: raw && Number.isInteger(id) && id > 0 ? id : undefined,
            canSeeBranches: true,
        };
    }
    if (a.teamRole === "branch_manager") {
        if (a.seesAll || !a.branchId) {
            const raw = String(req.query.branch || "").trim();
            if (raw === "none") return { allowed: true, filter: null, canSeeBranches: true };
            const id = Number(raw);
            return {
                allowed: true,
                filter: raw && Number.isInteger(id) && id > 0 ? id : undefined,
                canSeeBranches: true,
            };
        }
        return { allowed: true, filter: a.branchId, locked: true, canSeeBranches: false };
    }
    // counsellor / documents: personal conversion only
    if (a.userId) return { allowed: true, assigneeOnly: a.userId, canSeeBranches: false };
    return { allowed: false };
};

/**
 * Agency reports (owner only): funnel, sources with cost per lead, trend, counsellors, visa outcomes.
 * Period = leads created between `from` and `to` (default last 30 days).
 */

const CLOSED = ["converted", "lost", "junk"];
const DAY = 24 * 60 * 60 * 1000;

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, isOwner: user.role === "agent" };
};

const period = (req: RequestWithUser) => {
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * DAY);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return null;
    to.setHours(23, 59, 59, 999);
    from.setHours(0, 0, 0, 0);
    if (to.getTime() - from.getTime() > 400 * DAY) return null;
    return { from, to };
};

const monthsBetween = (from: Date, to: Date) => {
    const months: string[] = [];
    const d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d <= to) {
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        d.setMonth(d.getMonth() + 1);
    }
    return months;
};

// "UK" and "United Kingdom" are the same country in reports
const COUNTRY_ALIASES: Record<string, string> = {
    uk: "United Kingdom", "u.k.": "United Kingdom", england: "United Kingdom", britain: "United Kingdom", "great britain": "United Kingdom",
    usa: "United States", us: "United States", "u.s.a.": "United States", america: "United States", "united states of america": "United States",
    uae: "United Arab Emirates", nz: "New Zealand", aus: "Australia",
};
const normCountry = (c?: string | null) => {
    const v = String(c || "").trim();
    if (!v) return "Not set";
    const alias = COUNTRY_ALIASES[v.toLowerCase()];
    return alias || v.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

class ReportsCrmController {
    // GET /crm/reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
    async overview(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const access = reportAccess(req);
            if (!access.allowed) return returnHelper(res, 200, false, "Reports are available to the agency owner and branch managers");
            const p = period(req);
            if (!p) return returnHelper(res, 200, false, "Please choose a valid date range (up to 1 year)");
            const created = { [Op.between]: [p.from, p.to] };
            // one branch only (owner picked it, or a branch manager's own branch)
            const filtered = access.filter !== undefined;
            const bf: Record<string, any> = filtered ? { branch_id: access.filter } : {};
            const base = { agency_uuid: agencyUuid, createdAt: created, ...bf };

            // ---- funnel (leads created in the period, by where they are now)
            const byStatus: any[] = await CrmLead.findAll({ where: base, attributes: ["status", [fn("COUNT", col("id")), "n"]], group: ["status"], raw: true });
            const s = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]));
            const total = Object.values(s).reduce((a: number, b: any) => a + Number(b), 0) as number;
            const converted = s.converted || 0;
            const reached = total - (s.new || 0) - (s.junk || 0);
            const engaged = (s.interested || 0) + (s.counselling || 0) + converted;
            const caseIds: any[] = await CrmLead.findAll({ where: { ...base, status: "converted", converted_case_id: { [Op.ne]: null } }, attributes: ["converted_case_id"], raw: true });
            const approved = caseIds.length
                ? await AgencyLeads.count({ where: { id: caseIds.map((c) => c.converted_case_id), status: "visa_completed" } })
                : 0;
            const funnel = [
                { key: "leads", label: "Leads", value: total },
                { key: "reached", label: "Contacted", value: reached },
                { key: "engaged", label: "Interested / counselling", value: engaged },
                { key: "converted", label: "Converted to case", value: converted },
                { key: "approved", label: "Visa approved", value: approved },
            ];

            // ---- sources with spend
            const bySource: any[] = await CrmLead.findAll({
                where: base,
                attributes: ["source", [fn("COUNT", col("id")), "n"], [fn("SUM", literal("CASE WHEN status = 'converted' THEN 1 ELSE 0 END")), "conv"]],
                group: ["source"],
                raw: true,
            });
            const months = monthsBetween(p.from, p.to);
            const spendRows: any[] = await MarketingSpend.findAll({ where: { agency_uuid: agencyUuid, month: months }, raw: true });
            // spend of partly covered months is counted in full (simple and predictable)
            const spendBy: Record<string, number> = {};
            // ad spend is entered for the whole agency, so it is left out of a single branch's report
            if (!filtered) for (const r of spendRows) spendBy[r.source] = (spendBy[r.source] || 0) + Number(r.amount || 0);
            const sources = (CRM_LEAD_SOURCES as readonly string[])
                .map((key) => {
                    const row = bySource.find((r) => r.source === key);
                    const leads = Number(row?.n || 0);
                    const conv = Number(row?.conv || 0);
                    const spend = spendBy[key] || 0;
                    return {
                        source: key, leads, converted: conv, conversion_rate: pct(conv, leads), spend,
                        cost_per_lead: spend && leads ? Math.round(spend / leads) : null,
                        cost_per_conversion: spend && conv ? Math.round(spend / conv) : null,
                    };
                })
                .filter((r) => r.leads || r.spend)
                .sort((a, b) => b.leads - a.leads);

            // ---- trend (per day up to 62 days, else per week)
            const days = Math.ceil((p.to.getTime() - p.from.getTime()) / DAY);
            const weekly = days > 62;
            const bucketExpr = weekly ? "YEARWEEK(createdAt, 1)" : "DATE(createdAt)";
            const trendRows: any[] = await CrmLead.findAll({
                where: base,
                attributes: [[literal(bucketExpr), "bucket"], [fn("COUNT", col("id")), "n"]],
                group: [literal(bucketExpr) as any],
                raw: true,
            });
            const convRows: any[] = await CrmLead.findAll({
                where: { agency_uuid: agencyUuid, converted_at: created, ...bf },
                attributes: [[literal(weekly ? "YEARWEEK(converted_at, 1)" : "DATE(converted_at)"), "bucket"], [fn("COUNT", col("id")), "n"]],
                group: [literal(weekly ? "YEARWEEK(converted_at, 1)" : "DATE(converted_at)") as any],
                raw: true,
            });
            const key = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
            const leadsBy = Object.fromEntries(trendRows.map((r) => [key(r.bucket), Number(r.n)]));
            const convBy = Object.fromEntries(convRows.map((r) => [key(r.bucket), Number(r.n)]));
            const trend: { label: string; leads: number; converted: number }[] = [];
            if (weekly) {
                const keys = [...new Set([...Object.keys(leadsBy), ...Object.keys(convBy)])].sort();
                for (const k of keys) trend.push({ label: `Week ${k.slice(4)} ${k.slice(0, 4)}`, leads: leadsBy[k] || 0, converted: convBy[k] || 0 });
            } else {
                for (let d = new Date(p.from); d <= p.to; d = new Date(d.getTime() + DAY)) {
                    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    trend.push({ label: k, leads: leadsBy[k] || 0, converted: convBy[k] || 0 });
                }
            }

            // ---- counsellors
            const team: any[] = await Agent.findAll({
                where: { [Op.or]: [{ uuid: agencyUuid, role: "agent" }, { parent_uuid: agencyUuid }] },
                attributes: ["id", "username", "role", "status", "branch_id"],
                raw: true,
            });
            const perAssignee: any[] = await CrmLead.findAll({
                where: base,
                attributes: ["assigned_to", "status", [fn("COUNT", col("id")), "n"]],
                group: ["assigned_to", "status"],
                raw: true,
            });
            const overdueRows: any[] = await CrmLead.findAll({
                where: { agency_uuid: agencyUuid, ...bf, status: { [Op.notIn]: CLOSED }, next_follow_up_at: { [Op.lt]: new Date(new Date().setHours(0, 0, 0, 0)) } },
                attributes: ["assigned_to", [fn("COUNT", col("id")), "n"]],
                group: ["assigned_to"],
                raw: true,
            });
            const activityRows: any[] = await CrmLeadActivity.findAll({
                where: { agency_uuid: agencyUuid, createdAt: created, type: ["call", "whatsapp", "email", "note", "follow_up_done"], created_by: { [Op.ne]: null } },
                attributes: ["created_by", [fn("COUNT", col("id")), "n"]],
                group: ["created_by"],
                raw: true,
            });
            const counsellors = team.map((m) => {
                const rows = perAssignee.filter((r) => r.assigned_to === m.id);
                const assigned = rows.reduce((a, r) => a + Number(r.n), 0);
                const conv = rows.filter((r) => r.status === "converted").reduce((a, r) => a + Number(r.n), 0);
                const contacted = rows.filter((r) => !["new", "junk"].includes(r.status)).reduce((a, r) => a + Number(r.n), 0);
                return {
                    id: m.id, name: m.username, role: m.role, active: m.status === "active",
                    assigned, contacted, converted: conv, conversion_rate: pct(conv, assigned),
                    activities: Number(activityRows.find((r) => r.created_by === m.id)?.n || 0),
                    overdue: Number(overdueRows.find((r) => r.assigned_to === m.id)?.n || 0),
                };
            }).filter((c) => c.assigned || c.overdue || (filtered
                ? team.find((m) => m.id === c.id)?.branch_id === access.filter
                : c.activities || c.role !== "agent"))
                .sort((a, b) => b.converted - a.converted || b.assigned - a.assigned);
            const unassignedOpen = await CrmLead.count({ where: { agency_uuid: agencyUuid, ...bf, assigned_to: null, status: { [Op.notIn]: CLOSED } } });

            // ---- visa outcomes by country (all cases, decided in the period or still open)
            const caseRows: any[] = await AgencyLeads.findAll({
                where: { agent_uuid: agencyUuid, ...bf, status: ["visa_progress", "visa_completed", "visa_rejected", "withdrawn", "withdrawn_by_student"] },
                attributes: ["selected_country", "status", [fn("COUNT", col("id")), "n"]],
                group: ["selected_country", "status"],
                raw: true,
            });
            const countries: Record<string, any> = {};
            for (const r of caseRows) {
                const c = normCountry(r.selected_country);
                countries[c] = countries[c] || { country: c, in_progress: 0, approved: 0, rejected: 0, withdrawn: 0 };
                const n = Number(r.n);
                if (r.status === "visa_progress") countries[c].in_progress += n;
                else if (r.status === "visa_completed") countries[c].approved += n;
                else if (r.status === "visa_rejected") countries[c].rejected += n;
                else countries[c].withdrawn += n;
            }
            const visa = Object.values(countries)
                .map((c: any) => ({ ...c, success_rate: pct(c.approved, c.approved + c.rejected) }))
                .sort((a: any, b: any) => (b.approved + b.rejected + b.in_progress) - (a.approved + a.rejected + a.in_progress));

            // ---- why visas were refused (decided in the period) and how long decisions take
            const refusedRows: any[] = await AgencyLeads.findAll({
                where: { agent_uuid: agencyUuid, ...bf, status: "visa_rejected", updatedAt: created },
                attributes: ["refusal_reason", "selected_country"],
                raw: true,
            });
            const refusalMap: Record<string, { key: string; label: string; count: number; countries: Record<string, number> }> = {};
            for (const r of refusedRows) {
                const key = r.refusal_reason && REFUSAL_REASONS[r.refusal_reason] ? r.refusal_reason : "not_given";
                const e = (refusalMap[key] ||= { key, label: key === "not_given" ? "Reason not recorded" : REFUSAL_REASONS[key], count: 0, countries: {} });
                e.count += 1;
                const c = normCountry(r.selected_country);
                e.countries[c] = (e.countries[c] || 0) + 1;
            }
            const refusal_reasons = Object.values(refusalMap)
                .map((e) => ({ ...e, countries: Object.entries(e.countries).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count) }))
                .sort((a, b) => b.count - a.count);
            const timing: any[] = await AgencyLeads.findAll({
                where: { agent_uuid: agencyUuid, ...bf, status: ["visa_completed", "visa_rejected"], visa_lodged_on: { [Op.ne]: null }, decision_on: { [Op.ne]: null }, updatedAt: created },
                attributes: ["visa_lodged_on", "decision_on"],
                raw: true,
            });
            const decisionDays = timing.map((t) => (new Date(t.decision_on).getTime() - new Date(t.visa_lodged_on).getTime()) / DAY).filter((d) => d >= 0 && d < 400);
            const visa_timing = { decided: decisionDays.length, avg_days: decisionDays.length ? Math.round(decisionDays.reduce((a, b) => a + b, 0) / decisionDays.length) : null };

            // ---- why leads are lost
            const lostRows: any[] = await CrmLead.findAll({
                where: { ...base, status: "lost" },
                attributes: ["lost_reason"],
                raw: true,
            });
            const reasons: Record<string, number> = {};
            for (const r of lostRows) {
                const k = String(r.lost_reason || "Not given").trim().slice(0, 60);
                reasons[k] = (reasons[k] || 0) + 1;
            }
            const lost_reasons = Object.entries(reasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6);

            const totalSpend = Object.values(spendBy).reduce((a, b) => a + b, 0);
            const branchRow: any = filtered && access.filter ? await AgencyBranch.findOne({ where: { id: access.filter, agency_uuid: agencyUuid }, attributes: ["id", "name"] }) : null;
            return returnHelper(res, 200, true, "Report", {
                // which branch these numbers are for (null = whole agency); locked = a branch manager's own branch
                branch: filtered ? {
                    id: access.filter,
                    name: branchRow?.dataValues?.name
                        || (access.filter == null ? "Unassigned (no branch)" : `Branch #${access.filter}`),
                    locked: Boolean(access.locked),
                } : null,
                period: { from: p.from, to: p.to, weekly },
                summary: {
                    leads: total,
                    converted,
                    conversion_rate: pct(converted, total),
                    visa_approved: approved,
                    spend: totalSpend,
                    cost_per_lead: totalSpend && total ? Math.round(totalSpend / total) : null,
                    unassigned_open: unassignedOpen,
                },
                funnel, sources, trend, counsellors, visa, lost_reasons, refusal_reasons, visa_timing,
            });
        } catch (error) {
            console.error("reports overview failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/reports/branches?from=&to=  - branches side by side (owner)
    async branches(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "The branch comparison is available to the agency owner");
            const p = period(req);
            if (!p) return returnHelper(res, 200, false, "Please choose a valid date range (up to 1 year)");
            const repl = { a: agencyUuid, from: p.from, to: p.to };
            const q = (sql: string) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: repl }) as Promise<any[]>;
            const [branches, team, leads, open, cases, invoiced, collected, outstanding] = await Promise.all([
                AgencyBranch.findAll({ where: { agency_uuid: agencyUuid }, attributes: ["id", "name", "city"], order: [["name", "ASC"]], raw: true }) as Promise<any[]>,
                q("SELECT branch_id b, COUNT(*) n FROM agent WHERE parent_uuid = :a AND status = 'active' AND deletedAt IS NULL GROUP BY branch_id"),
                q(`SELECT branch_id b, COUNT(*) leads, SUM(status = 'converted') converted, SUM(status NOT IN ('new','junk')) contacted
                   FROM crm_leads WHERE agency_uuid = :a AND deletedAt IS NULL AND createdAt BETWEEN :from AND :to GROUP BY branch_id`),
                q(`SELECT branch_id b, COUNT(*) open_leads, SUM(assigned_to IS NULL) unassigned, SUM(next_follow_up_at < CURDATE()) overdue
                   FROM crm_leads WHERE agency_uuid = :a AND deletedAt IS NULL AND status NOT IN ('converted','lost','junk') GROUP BY branch_id`),
                q(`SELECT branch_id b, SUM(status = 'visa_progress') open_cases,
                          SUM(status = 'visa_completed' AND updatedAt BETWEEN :from AND :to) approved,
                          SUM(status = 'visa_rejected' AND updatedAt BETWEEN :from AND :to) rejected
                   FROM agency_leads WHERE agent_uuid = :a AND deletedAt IS NULL AND status IN ('visa_progress','visa_completed','visa_rejected') GROUP BY branch_id`),
                q(`SELECT branch_id b, SUM(total) v FROM client_invoices
                   WHERE agency_uuid = :a AND deletedAt IS NULL AND status <> 'cancelled' AND issue_date BETWEEN DATE(:from) AND DATE(:to) GROUP BY branch_id`),
                q(`SELECT i.branch_id b, SUM(p.amount) v FROM client_payments p JOIN client_invoices i ON i.id = p.invoice_id
                   WHERE p.agency_uuid = :a AND p.deletedAt IS NULL AND p.paid_at BETWEEN :from AND :to GROUP BY i.branch_id`),
                q(`SELECT branch_id b, SUM(total - amount_paid) v FROM client_invoices
                   WHERE agency_uuid = :a AND deletedAt IS NULL AND status IN ('unpaid','partial') GROUP BY branch_id`),
            ]);
            // Coerce both sides — MySQL may return branch_id as a string; strict === then misses real branches.
            const pick = (rows: any[], id: number | null) =>
                rows.find((r) => (r.b == null ? null : Number(r.b)) === (id == null ? null : Number(id))) || {};
            const n = (v: any) => Number(v || 0);
            const row = (id: number | null, name: string, city: string | null) => {
                const l = pick(leads, id), o = pick(open, id), c = pick(cases, id);
                return {
                    id, name, city,
                    team: n(pick(team, id).n),
                    leads: n(l.leads), contacted: n(l.contacted), converted: n(l.converted), conversion_rate: pct(n(l.converted), n(l.leads)),
                    open_leads: n(o.open_leads), unassigned: n(o.unassigned), overdue_follow_ups: n(o.overdue),
                    open_cases: n(c.open_cases), approved: n(c.approved), rejected: n(c.rejected), success_rate: pct(n(c.approved), n(c.approved) + n(c.rejected)),
                    invoiced: n(pick(invoiced, id).v) / 100, collected: n(pick(collected, id).v) / 100, outstanding: n(pick(outstanding, id).v) / 100,
                };
            };
            const rows = branches.map((b) => row(Number(b.id), String(b.name || "").trim() || `Branch #${b.id}`, b.city || null));
            // Synthetic row for work with branch_id IS NULL — not a real office name.
            const none = row(null, "Unassigned (no branch)", null);
            if (none.leads || none.open_leads || none.open_cases || none.invoiced || none.collected || none.outstanding) rows.push(none);
            const sum = (k: string) => rows.reduce((a: number, r: any) => a + Number(r[k] || 0), 0);
            return returnHelper(res, 200, true, "Branches", {
                period: { from: p.from, to: p.to },
                branches: rows,
                total: {
                    leads: sum("leads"), converted: sum("converted"), conversion_rate: pct(sum("converted"), sum("leads")), open_leads: sum("open_leads"),
                    open_cases: sum("open_cases"), approved: sum("approved"), invoiced: sum("invoiced"), collected: sum("collected"), outstanding: sum("outstanding"),
                },
            });
        } catch (error) {
            console.error("branch report failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    /**
     * GET /crm/reports/pipeline?from=&to=&branch=
     * Conversion funnel and rates by source, counsellor, and branch (not just counts).
     * Conversion rate = converted / total leads created in the period.
     */
    async pipeline(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid } = ctx(req);
            const access = pipelineAccess(req);
            if (!access.allowed) return returnHelper(res, 200, false, "Pipeline analytics are not available for this account");
            const p = period(req);
            if (!p) return returnHelper(res, 200, false, "Please choose a valid date range (up to 1 year)");

            const filtered = access.filter !== undefined;
            const bf: Record<string, any> = filtered ? { branch_id: access.filter } : {};
            const assignee: Record<string, any> = access.assigneeOnly ? { assigned_to: access.assigneeOnly } : {};
            const base = { agency_uuid: agencyUuid, createdAt: { [Op.between]: [p.from, p.to] }, ...bf, ...assignee };

            const byStatus: any[] = await CrmLead.findAll({
                where: base,
                attributes: ["status", [fn("COUNT", col("id")), "n"]],
                group: ["status"],
                raw: true,
            });
            const s = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]));
            const total = (Object.values(s) as number[]).reduce((a, b) => a + Number(b), 0);
            const converted = s.converted || 0;
            const lost = s.lost || 0;
            const junk = s.junk || 0;
            const open = total - converted - lost - junk;
            const contacted = total - (s.new || 0) - junk;
            const engaged = (s.interested || 0) + (s.counselling || 0) + converted;
            const counselling = (s.counselling || 0) + converted;

            const caseIds: any[] = await CrmLead.findAll({
                where: { ...base, status: "converted", converted_case_id: { [Op.ne]: null } },
                attributes: ["converted_case_id"],
                raw: true,
            });
            const approved = caseIds.length
                ? await AgencyLeads.count({ where: { id: caseIds.map((c) => c.converted_case_id), status: "visa_completed" } })
                : 0;

            const funnel = [
                { key: "leads", label: "Leads", value: total, rate_of_total: total ? 100 : 0 },
                { key: "contacted", label: "Contacted+", value: contacted, rate_of_total: pct(contacted, total) },
                { key: "engaged", label: "Interested / counselling", value: engaged, rate_of_total: pct(engaged, total) },
                { key: "counselling", label: "Counselling+", value: counselling, rate_of_total: pct(counselling, total) },
                { key: "converted", label: "Converted to case", value: converted, rate_of_total: pct(converted, total) },
                { key: "approved", label: "Visa approved", value: approved, rate_of_total: pct(approved, total) },
            ].map((step, i, arr) => ({
                ...step,
                rate_of_previous: i === 0 ? 100 : pct(step.value, arr[i - 1].value),
            }));

            // ---- by source
            const bySource: any[] = await CrmLead.findAll({
                where: base,
                attributes: [
                    "source",
                    [fn("COUNT", col("id")), "leads"],
                    [fn("SUM", literal("CASE WHEN status = 'converted' THEN 1 ELSE 0 END")), "converted"],
                    [fn("SUM", literal("CASE WHEN status = 'lost' THEN 1 ELSE 0 END")), "lost"],
                    [fn("SUM", literal("CASE WHEN status NOT IN ('converted','lost','junk') THEN 1 ELSE 0 END")), "open"],
                ],
                group: ["source"],
                raw: true,
            });
            const sources = bySource
                .map((r) => {
                    const leads = Number(r.leads || 0);
                    const conv = Number(r.converted || 0);
                    return {
                        source: r.source || "other",
                        leads,
                        converted: conv,
                        lost: Number(r.lost || 0),
                        open: Number(r.open || 0),
                        conversion_rate: pct(conv, leads),
                    };
                })
                .filter((r) => r.leads)
                .sort((a, b) => b.conversion_rate - a.conversion_rate || b.leads - a.leads);

            // ---- by counsellor (assignee)
            const teamWhere: Record<string, any> = access.assigneeOnly
                ? { id: access.assigneeOnly }
                : { [Op.or]: [{ uuid: agencyUuid, role: "agent" }, { parent_uuid: agencyUuid }] };
            const team: any[] = await Agent.findAll({
                where: teamWhere,
                attributes: ["id", "username", "role", "status", "branch_id"],
                raw: true,
            });
            const perAssignee: any[] = await CrmLead.findAll({
                where: base,
                attributes: [
                    "assigned_to",
                    [fn("COUNT", col("id")), "leads"],
                    [fn("SUM", literal("CASE WHEN status = 'converted' THEN 1 ELSE 0 END")), "converted"],
                    [fn("SUM", literal("CASE WHEN status = 'lost' THEN 1 ELSE 0 END")), "lost"],
                    [fn("SUM", literal("CASE WHEN status NOT IN ('converted','lost','junk') THEN 1 ELSE 0 END")), "open"],
                ],
                group: ["assigned_to"],
                raw: true,
            });
            const teamById = Object.fromEntries(team.map((m) => [m.id, m]));
            const counsellors = perAssignee
                .map((r) => {
                    const id = r.assigned_to == null ? null : Number(r.assigned_to);
                    const m = id != null ? teamById[id] : null;
                    const leads = Number(r.leads || 0);
                    const conv = Number(r.converted || 0);
                    return {
                        id,
                        name: id == null ? "Unassigned" : (m?.username || `User #${id}`),
                        role: m?.role || null,
                        active: id == null ? true : m?.status === "active",
                        leads,
                        converted: conv,
                        lost: Number(r.lost || 0),
                        open: Number(r.open || 0),
                        conversion_rate: pct(conv, leads),
                    };
                })
                .filter((c) => c.leads)
                .sort((a, b) => b.conversion_rate - a.conversion_rate || b.converted - a.converted || b.leads - a.leads);

            // ---- by branch (agency-wide views only)
            let branches: any[] = [];
            if (access.canSeeBranches && !filtered) {
                const branchMeta: any[] = await AgencyBranch.findAll({
                    where: { agency_uuid: agencyUuid },
                    attributes: ["id", "name", "city"],
                    order: [["name", "ASC"]],
                    raw: true,
                });
                const perBranch: any[] = await CrmLead.findAll({
                    where: base,
                    attributes: [
                        "branch_id",
                        [fn("COUNT", col("id")), "leads"],
                        [fn("SUM", literal("CASE WHEN status = 'converted' THEN 1 ELSE 0 END")), "converted"],
                        [fn("SUM", literal("CASE WHEN status = 'lost' THEN 1 ELSE 0 END")), "lost"],
                        [fn("SUM", literal("CASE WHEN status NOT IN ('converted','lost','junk') THEN 1 ELSE 0 END")), "open"],
                    ],
                    group: ["branch_id"],
                    raw: true,
                });
                const nameOf = (id: number | null) => {
                    if (id == null) return "Unassigned (no branch)";
                    const meta = branchMeta.find((b) => Number(b.id) === Number(id));
                    return meta?.name || `Branch #${id}`;
                };
                branches = perBranch
                    .map((r) => {
                        const id = r.branch_id == null ? null : Number(r.branch_id);
                        const leads = Number(r.leads || 0);
                        const conv = Number(r.converted || 0);
                        const meta = id == null ? null : branchMeta.find((b) => Number(b.id) === Number(id));
                        return {
                            id,
                            name: nameOf(id),
                            city: meta?.city || null,
                            leads,
                            converted: conv,
                            lost: Number(r.lost || 0),
                            open: Number(r.open || 0),
                            conversion_rate: pct(conv, leads),
                        };
                    })
                    .filter((b) => b.leads)
                    .sort((a, b) => b.conversion_rate - a.conversion_rate || b.leads - a.leads);
            }

            const branchRow: any = filtered && access.filter
                ? await AgencyBranch.findOne({ where: { id: access.filter, agency_uuid: agencyUuid }, attributes: ["id", "name"] })
                : null;

            return returnHelper(res, 200, true, "Pipeline", {
                branch: filtered
                    ? {
                        id: access.filter,
                        name: branchRow?.dataValues?.name
                            || (access.filter == null ? "Unassigned (no branch)" : `Branch #${access.filter}`),
                        locked: Boolean(access.locked),
                    }
                    : null,
                scope: access.assigneeOnly ? "mine" : (filtered ? "branch" : "agency"),
                period: { from: p.from, to: p.to },
                definition: "Conversion rate = converted ÷ total leads created in this period (status = converted).",
                summary: {
                    leads: total,
                    converted,
                    lost,
                    junk,
                    open,
                    conversion_rate: pct(converted, total),
                    lost_rate: pct(lost, total),
                    visa_approved: approved,
                },
                funnel,
                by_source: sources,
                by_counsellor: counsellors,
                by_branch: branches,
            });
        } catch (error) {
            console.error("pipeline report failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/reports/spend?month=YYYY-MM
    async getSpend(req: RequestWithUser, res: Response) {
        const { agencyUuid, isOwner } = ctx(req);
        if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can see spend");
        const month = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : new Date().toISOString().slice(0, 7);
        const rows: any[] = await MarketingSpend.findAll({ where: { agency_uuid: agencyUuid, month }, raw: true });
        return returnHelper(res, 200, true, "Spend", { month, spend: Object.fromEntries(rows.map((r) => [r.source, Number(r.amount)])) });
    }

    // POST /crm/reports/spend { month: "YYYY-MM", spend: { facebook: 20000, google: 5000 } }
    async saveSpend(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can change spend");
            const month = String(req.body?.month || "");
            if (!/^\d{4}-\d{2}$/.test(month)) return returnHelper(res, 200, false, "Please choose a month");
            const spend = req.body?.spend || {};
            for (const source of CRM_LEAD_SOURCES as readonly string[]) {
                if (spend[source] === undefined) continue;
                const amount = Math.max(0, Math.round(Number(spend[source]) || 0));
                const existing: any = await MarketingSpend.findOne({ where: { agency_uuid: agencyUuid, month, source } });
                if (existing) await MarketingSpend.update({ amount }, { where: { id: existing.dataValues.id } });
                else if (amount) await MarketingSpend.create({ agency_uuid: agencyUuid, month, source, amount });
            }
            return returnHelper(res, 200, true, "Spend saved");
        } catch (error) {
            console.error("save spend failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new ReportsCrmController();
