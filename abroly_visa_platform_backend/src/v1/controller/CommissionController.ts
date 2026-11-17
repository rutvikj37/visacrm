import { Response } from "express";
import { Op } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import { accessOf, caseScope } from "../../helpers/access";
import AgencyLeads from "../../model/AgencyLeads";
import User from "../../model/User";
import UniversityApplication from "../../model/UniversityApplication";
import Commission, { COMMISSION_STATUSES } from "../../model/Commission";
import { audit } from "../../services/audit";

/**
 * Commission from universities / partners: what is expected, invoiced and received.
 * Owner and Accounts manage it; branch managers can see their branch's commissions; counsellors do not see money.
 * Amounts travel in major units (e.g. 1500.50) and are stored in minor units.
 */

const STATUS_LABEL: Record<string, string> = { expected: "Expected", invoiced: "Invoiced", received: "Received", cancelled: "Cancelled" };
const toMinor = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v) * 100));
const fromMinor = (v: any) => (v === null || v === undefined ? null : Number(v) / 100);
const date = (v: any) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);
const text = (v: any, max = 255) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
const currencyOf = (v: any) => String(v || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
const today = () => new Date().toISOString().slice(0, 10);

const canManage = (req: RequestWithUser) => { const a = accessOf(req); return a.isOwner || a.teamRole === "accounts"; };
const canView = (req: RequestWithUser) => canManage(req) || accessOf(req).teamRole === "branch_manager";

/** Ids of the cases this person may see (null = all of the agency). */
const visibleCaseIds = async (req: RequestWithUser): Promise<number[] | null> => {
    const a = accessOf(req);
    if (a.isOwner || a.teamRole === "accounts" || a.seesAll) return null;
    const rows: any[] = await AgencyLeads.findAll({ where: caseScope(req), attributes: ["id"], raw: true });
    return rows.map((r) => r.id);
};

const present = (c: any, extra: { student?: any; university?: any } = {}) => {
    const x = c.toJSON ? c.toJSON() : c;
    const expected = fromMinor(x.amount_expected) || 0;
    const received = fromMinor(x.amount_received) || 0;
    return {
        id: x.id, case_id: x.case_id, university_app_id: x.university_app_id, student_id: x.student_id,
        partner: x.partner, basis: x.basis, percent: x.percent !== null ? Number(x.percent) : null,
        tuition_fee: fromMinor(x.tuition_fee), currency: x.currency, amount_expected: expected, amount_received: received,
        balance: x.status === "cancelled" ? 0 : Math.max(0, Math.round((expected - received) * 100) / 100),
        status: x.status, status_label: STATUS_LABEL[x.status], due_on: x.due_on, invoice_ref: x.invoice_ref,
        invoiced_on: x.invoiced_on, received_on: x.received_on, notes: x.notes,
        overdue: x.status !== "received" && x.status !== "cancelled" && Boolean(x.due_on) && String(x.due_on) < today(),
        student: extra.student || null, university: extra.university || null, createdAt: x.createdAt,
    };
};

/** Money fields from the request, with the % rule applied. */
const readMoney = (b: any, current: any = {}) => {
    const f: any = {};
    if ("partner" in b) f.partner = text(b.partner);
    if ("basis" in b) f.basis = b.basis === "percent" ? "percent" : "fixed";
    if ("percent" in b) f.percent = b.percent === "" || b.percent === null || isNaN(Number(b.percent)) ? null : Math.min(100, Math.max(0, Number(b.percent)));
    if ("tuition_fee" in b) f.tuition_fee = toMinor(b.tuition_fee);
    if ("currency" in b) f.currency = currencyOf(b.currency) || "INR";
    if ("amount_expected" in b) f.amount_expected = toMinor(b.amount_expected) ?? 0;
    if ("amount_received" in b) f.amount_received = Math.max(0, toMinor(b.amount_received) ?? 0);
    if ("due_on" in b) f.due_on = date(b.due_on);
    if ("invoice_ref" in b) f.invoice_ref = text(b.invoice_ref, 100);
    if ("invoiced_on" in b) f.invoiced_on = date(b.invoiced_on);
    if ("received_on" in b) f.received_on = date(b.received_on);
    if ("notes" in b) f.notes = text(b.notes, 4000);
    const basis = f.basis ?? current.basis;
    const percent = f.percent !== undefined ? f.percent : current.percent;
    const tuition = f.tuition_fee !== undefined ? f.tuition_fee : current.tuition_fee;
    // % of tuition: the expected amount follows unless it was typed in
    if (basis === "percent" && percent !== null && percent !== undefined && tuition && !("amount_expected" in b && b.amount_expected !== "" && b.amount_expected !== null)) {
        f.amount_expected = Math.round((Number(tuition) * Number(percent)) / 100);
    }
    return f;
};

class CommissionController {
    // GET /crm/commissions?status=&q=&case_id=&due=overdue|month
    async list(req: RequestWithUser, res: Response) {
        try {
            if (!canView(req)) return returnHelper(res, 200, false, "Only the owner, Accounts or a branch manager can see commissions");
            const a = accessOf(req);
            const q = req.query as Record<string, string>;
            const where: any = { agency_uuid: a.agencyUuid };
            const ids = await visibleCaseIds(req);
            if (ids) where.case_id = ids.length ? ids : [-1];
            if (q.case_id) where.case_id = ids && !ids.includes(Number(q.case_id)) ? -1 : Number(q.case_id) || -1;
            if (q.status && (COMMISSION_STATUSES as readonly string[]).includes(q.status)) where.status = q.status;
            if (q.status === "open") where.status = ["expected", "invoiced"];
            if (q.due === "overdue") { where.status = ["expected", "invoiced"]; where.due_on = { [Op.lt]: today() }; }
            const search = String(q.q || "").trim().slice(0, 100);
            if (search) where.partner = { [Op.like]: `%${search}%` };

            const page = Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(String(q.limit || "25"), 10) || 25));

            // totals from every matching row (not just the page); amounts are stored in minor units
            const forTotals: any[] = await Commission.findAll({
                where,
                attributes: ["status", "currency", "amount_expected", "amount_received", "due_on"],
                raw: true,
            });
            const totals: Record<string, { currency: string; expected: number; invoiced: number; received: number; outstanding: number; overdue: number }> = {};
            const todayStr = today();
            for (const r of forTotals) {
                if (r.status === "cancelled") continue;
                const expected = fromMinor(r.amount_expected) || 0;
                const received = fromMinor(r.amount_received) || 0;
                const balance = Math.max(0, Math.round((expected - received) * 100) / 100);
                const overdue = r.status !== "received" && Boolean(r.due_on) && String(r.due_on) < todayStr;
                const t = (totals[r.currency] ||= { currency: r.currency, expected: 0, invoiced: 0, received: 0, outstanding: 0, overdue: 0 });
                t.expected += expected;
                if (r.status === "invoiced") t.invoiced += expected - received;
                t.received += received;
                t.outstanding += balance;
                if (overdue) t.overdue += balance;
            }

            const { count, rows }: any = await Commission.findAndCountAll({
                where,
                order: [["due_on", "ASC"], ["createdAt", "DESC"]],
                limit,
                offset: (page - 1) * limit,
            });
            const studentIds = [...new Set(rows.map((r: any) => r.dataValues.student_id).filter(Boolean))];
            const appIds = [...new Set(rows.map((r: any) => r.dataValues.university_app_id).filter(Boolean))];
            const [students, apps]: any[] = await Promise.all([
                studentIds.length ? User.findAll({ where: { id: studentIds }, attributes: ["id", "username"], raw: true }) : [],
                appIds.length ? UniversityApplication.findAll({ where: { id: appIds }, attributes: ["id", "university", "course", "intake", "status"], raw: true }) : [],
            ]);
            const sMap = Object.fromEntries(students.map((s: any) => [s.id, { id: s.id, name: s.username }]));
            const aMap = Object.fromEntries(apps.map((x: any) => [x.id, x]));
            const items = rows.map((r: any) => present(r, { student: sMap[r.dataValues.student_id], university: aMap[r.dataValues.university_app_id] }));

            const round = (n: number) => Math.round(n * 100) / 100;
            const totalPages = Math.max(1, Math.ceil(count / limit));
            return returnHelper(res, 200, true, "Commissions", {
                commissions: items,
                totals: Object.values(totals).map((t) => ({ ...t, expected: round(t.expected), invoiced: round(t.invoiced), received: round(t.received), outstanding: round(t.outstanding), overdue: round(t.overdue) })),
                can_manage: canManage(req),
                pagination: { currentPage: page, totalPages, totalItems: count, itemsPerPage: limit },
            });
        } catch (error) {
            console.error("commission list failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/commissions { case_id, university_app_id?, partner?, basis, percent?, tuition_fee?, currency, amount_expected?, due_on?, notes? }
    async create(req: RequestWithUser, res: Response) {
        try {
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can add commissions");
            const b = req.body || {};
            const c: any = await AgencyLeads.findOne({ where: { ...caseScope(req), id: Number(b.case_id) || 0 } });
            if (!c) return returnHelper(res, 200, false, "Case not found");
            let app: any = null;
            if (b.university_app_id) {
                app = await UniversityApplication.findOne({ where: { id: Number(b.university_app_id) || 0, case_id: c.dataValues.id } });
                if (!app) return returnHelper(res, 200, false, "University application not found");
            }
            const f = readMoney({
                ...b,
                partner: b.partner || app?.dataValues.university,
                currency: b.currency || app?.dataValues.currency || "INR",
                tuition_fee: b.tuition_fee ?? (app?.dataValues.tuition_fee !== null && app?.dataValues.tuition_fee !== undefined ? Number(app.dataValues.tuition_fee) / 100 : null),
            });
            if (!f.partner) return returnHelper(res, 200, false, "Please enter who pays the commission");
            if (!f.amount_expected || f.amount_expected <= 0) return returnHelper(res, 200, false, "Please enter the commission amount (or % and tuition fee)");
            const row: any = await Commission.create({
                ...f, status: "expected", agency_uuid: c.dataValues.agent_uuid, case_id: c.dataValues.id, university_app_id: app?.dataValues.id || null,
                student_id: c.dataValues.user_id, branch_id: c.dataValues.branch_id || null, created_by: accessOf(req).userId,
            });
            audit(req, { entity: "case", entityId: c.dataValues.id, branchId: c.dataValues.branch_id, action: "commission_added", summary: `Commission expected from ${f.partner}: ${f.currency} ${(f.amount_expected / 100).toFixed(2)}` });
            return returnHelper(res, 200, true, "Commission added", { commission: present(row) });
        } catch (error) {
            console.error("commission create failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/commissions/:id { status?, amount_received?, invoice_ref?, ... }
    async update(req: RequestWithUser, res: Response) {
        try {
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can change commissions");
            const row: any = await Commission.findOne({ where: { id: Number(req.params.id) || 0, agency_uuid: accessOf(req).agencyUuid } });
            if (!row) return returnHelper(res, 200, false, "Commission not found");
            const b = req.body || {};
            const f = readMoney(b, row.dataValues);
            if ("partner" in f && !f.partner) return returnHelper(res, 200, false, "Please enter who pays the commission");
            const old = row.dataValues.status;
            if (b.status !== undefined) {
                if (!(COMMISSION_STATUSES as readonly string[]).includes(String(b.status))) return returnHelper(res, 200, false, "Invalid status");
                f.status = String(b.status);
                if (f.status === "invoiced" && !row.dataValues.invoiced_on && !f.invoiced_on) f.invoiced_on = today();
                if (f.status === "received") {
                    if (!row.dataValues.received_on && !f.received_on) f.received_on = today();
                    // "received" with nothing entered means paid in full
                    if (!("amount_received" in b) && !Number(row.dataValues.amount_received)) f.amount_received = f.amount_expected ?? row.dataValues.amount_expected;
                }
            } else if ("amount_received" in f && old !== "cancelled") {
                // paid in full → received; a part payment keeps it open (invoiced) so the balance still shows as due
                const expected = Number(f.amount_expected ?? row.dataValues.amount_expected);
                if (f.amount_received > 0 && f.amount_received >= expected) f.status = "received";
                else if (f.amount_received > 0 && old === "expected") f.status = "invoiced";
                else if (old === "received" && f.amount_received < expected) f.status = "invoiced";
                if (f.amount_received > 0 && !row.dataValues.received_on && !f.received_on) f.received_on = today();
            }
            await Commission.update(f, { where: { id: row.dataValues.id } });
            const fresh: any = await Commission.findByPk(row.dataValues.id);
            if (f.status && f.status !== old) {
                audit(req, { entity: "case", entityId: row.dataValues.case_id, branchId: row.dataValues.branch_id, action: "commission_status", summary: `Commission from ${fresh.dataValues.partner}: ${STATUS_LABEL[old]} → ${STATUS_LABEL[f.status]}` });
            }
            return returnHelper(res, 200, true, f.status && f.status !== old ? `Commission ${STATUS_LABEL[f.status].toLowerCase()}` : "Saved", { commission: present(fresh) });
        } catch (error) {
            console.error("commission update failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/commissions/:id/delete
    async remove(req: RequestWithUser, res: Response) {
        try {
            if (!canManage(req)) return returnHelper(res, 200, false, "Only the owner or Accounts can delete commissions");
            const row: any = await Commission.findOne({ where: { id: Number(req.params.id) || 0, agency_uuid: accessOf(req).agencyUuid } });
            if (!row) return returnHelper(res, 200, false, "Commission not found");
            if (Number(row.dataValues.amount_received) > 0) return returnHelper(res, 200, false, "A commission with money received can not be deleted - mark it cancelled instead");
            await Commission.destroy({ where: { id: row.dataValues.id } });
            audit(req, { entity: "case", entityId: row.dataValues.case_id, branchId: row.dataValues.branch_id, action: "commission_removed", summary: `Commission from ${row.dataValues.partner} deleted` });
            return returnHelper(res, 200, true, "Commission deleted");
        } catch (error) {
            console.error("commission delete failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new CommissionController();
