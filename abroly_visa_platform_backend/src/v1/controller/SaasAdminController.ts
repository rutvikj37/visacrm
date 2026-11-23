import { clearModuleCache, CRM_TYPES, moduleDetails, MODULE_KEYS, normalizeCrmType } from "../../services/modules";
import AgencyModule from "../../model/AgencyModule";
import { audit } from "../../services/audit";
import { Response } from "express";
import { notifyLater } from "../../services/notifications";
import { Op, fn, col } from "sequelize";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import sequelize from "../../config/dbconfig";
import Agent from "../../model/Agent";
import SaasPlan from "../../model/SaasPlan";
import SaasSubscription from "../../model/SaasSubscription";
import SaasPayment from "../../model/SaasPayment";
import CrmLead from "../../model/CrmLead";
import SaasCoupon from "../../model/SaasCoupon";
import { sendFailureReminderNow } from "../../services/saasFollowups";
import { agencyUsage } from "../../services/saasUsage";
import { buildMonitoringPayload } from "../../services/platformMonitoring";
import { sendLoginEmail, setLoginCode } from "../../services/agencyLogin";
import { normalizeCountryCode } from "../../services/phoneMatch";
import { panelBaseOf } from "../../services/panelUrl";
import { GST_STATES, couponUses, describeCoupon, getPlatformBilling, issueInvoice, loadInvoice, normalizeCode, savePlatformBilling } from "../../services/saasBilling";
import { presentMetaSettings, saveMetaSettings as persistMetaSettings } from "../../services/metaSettings";
import {
    ADDON_FEATURES, LEAD_SOURCE_FEATURES, SaasError, addMonths, applyPeriod, assignTrial, cleanFeatures, ensureDefaultPlans,
    extensionStart, getAgencyAccess, presentPlan, razorpayEnabled,
} from "../../services/saas";

/** Platform admin: plans, agencies, trials, extensions and payments. */

const MANUAL_METHODS = ["upi", "bank_transfer", "cash", "cheque", "other"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY = 24 * 60 * 60 * 1000;

const fail = (res: Response, error: any, where: string) => {
    if (error instanceof SaasError) return returnHelper(res, 200, false, error.message);
    console.error(`SaaS admin ${where} failed`, error);
    return returnHelper(res, 500, false, "Something went wrong");
};

/** Platform base domain for agency subdomains (e.g. techxsolutions.io). */
export const platformPortalDomain = () => {
    const fromEnv = String(process.env.PLATFORM_PORTAL_DOMAIN || "").trim().toLowerCase();
    if (fromEnv) return fromEnv.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    try {
        const u = process.env.STUDENT_PORTAL_URL ? new URL(process.env.STUDENT_PORTAL_URL) : null;
        const host = u?.hostname || "";
        // student.techxsolutions.io -> techxsolutions.io
        const parts = host.split(".").filter(Boolean);
        if (parts.length >= 2) return parts.slice(-2).join(".");
    } catch { /* ignore */ }
    return "techxsolutions.io";
};

/** Validate and normalize sudomain + domain. Empty both = no branded portal yet. */
const normalizePortal = (rawSub: any, rawDomain: any) => {
    const sudomain = rawSub ? String(rawSub).trim().toLowerCase() : null;
    let domain = rawDomain ? String(rawDomain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
    if (sudomain && !domain) domain = platformPortalDomain();
    if (sudomain && !/^[a-z0-9-]{2,40}$/.test(sudomain)) {
        return { sudomain: null, domain: null, error: "Subdomain can only have letters, numbers and dashes" };
    }
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        return { sudomain: null, domain: null, error: "Please enter a valid domain, e.g. yourdomain.com" };
    }
    if (!domain && sudomain) {
        return { sudomain: null, domain: null, error: "Please enter a portal domain, or leave both blank" };
    }
    return { sudomain: sudomain || null, domain: domain || null, error: null as string | null };
};

const readPlan = (body: any) => {
    const name = String(body?.name || "").trim().slice(0, 100);
    if (!name) throw new SaasError("Plan name is required");
    const money = (v: any) => {
        const n = Math.round(Number(v || 0));
        if (!Number.isFinite(n) || n < 0 || n > 10000000) throw new SaasError("Please enter a valid price");
        return n;
    };
    let team: number | null = null;
    if (body?.max_team_members !== null && body?.max_team_members !== undefined && body?.max_team_members !== "") {
        team = Math.round(Number(body.max_team_members));
        if (!Number.isFinite(team) || team < 0 || team > 10000) throw new SaasError("Please enter a valid team limit");
    }
    let duration: number | null = null;
    if (body?.duration_months !== null && body?.duration_months !== undefined && body?.duration_months !== "") {
        duration = Math.round(Number(body.duration_months));
        if (![6, 12].includes(duration)) throw new SaasError("Plan duration must be 6 or 12 months");
    }
    return {
        name,
        description: body?.description ? String(body.description).trim().slice(0, 1000) : null,
        price_monthly: money(body?.price_monthly),
        price_yearly: money(body?.price_yearly),
        duration_months: duration,
        max_team_members: team,
        features: cleanFeatures(body?.features),
        status: body?.status === "inactive" ? "inactive" : "active",
        sort_order: Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0,
    };
};

const statusOf = (agency: any) => {
    const ends = agency.expires_at ? new Date(agency.expires_at) : null;
    if (agency.status !== "active") return "suspended";
    if (!ends || ends.getTime() <= Date.now()) return "expired";
    return agency.saas_kind === "trial" ? "trial" : "active";
};

class SaasAdminController {
    // GET /saas_admin/features
    async features(req: RequestWithUser, res: Response) {
        return returnHelper(res, 200, true, "Features", { sources: LEAD_SOURCE_FEATURES, addons: ADDON_FEATURES, razorpay_enabled: razorpayEnabled() });
    }

    // ------------------------------------------------ plans
    async listPlans(req: RequestWithUser, res: Response) {
        try {
            await ensureDefaultPlans();
            const plans = await SaasPlan.findAll({ order: [["sort_order", "ASC"], ["id", "ASC"]] });
            const counts: any[] = await Agent.findAll({
                where: { role: "agent", saas_plan_id: { [Op.ne]: null } },
                attributes: ["saas_plan_id", [fn("COUNT", col("id")), "n"]],
                group: ["saas_plan_id"],
                raw: true,
            });
            const byPlan = Object.fromEntries(counts.map((c) => [c.saas_plan_id, Number(c.n)]));
            return returnHelper(res, 200, true, "Plans", plans.map((p: any) => ({ ...presentPlan(p), agencies: byPlan[p.dataValues.id] || 0 })));
        } catch (error) {
            return fail(res, error, "listPlans");
        }
    }

    async createPlan(req: RequestWithUser, res: Response) {
        try {
            const plan = await SaasPlan.create(readPlan(req.body));
            return returnHelper(res, 200, true, "Plan created", presentPlan(plan));
        } catch (error) {
            return fail(res, error, "createPlan");
        }
    }

    async updatePlan(req: RequestWithUser, res: Response) {
        try {
            const plan: any = await SaasPlan.findOne({ where: { uuid: req.params.uuid } });
            if (!plan) return returnHelper(res, 200, false, "Plan not found");
            await SaasPlan.update(readPlan(req.body), { where: { id: plan.dataValues.id } });
            return returnHelper(res, 200, true, "Plan saved. Agencies on this plan get the new limits right away.", presentPlan(await SaasPlan.findByPk(plan.dataValues.id)));
        } catch (error) {
            return fail(res, error, "updatePlan");
        }
    }

    async deletePlan(req: RequestWithUser, res: Response) {
        try {
            const plan: any = await SaasPlan.findOne({ where: { uuid: req.params.uuid } });
            if (!plan) return returnHelper(res, 200, false, "Plan not found");
            const used = await Agent.count({ where: { role: "agent", saas_plan_id: plan.dataValues.id } });
            if (used > 0) return returnHelper(res, 200, false, `${used} agency(ies) are on this plan. Move them first, or set the plan to inactive.`);
            await SaasPlan.destroy({ where: { id: plan.dataValues.id } });
            return returnHelper(res, 200, true, "Plan deleted");
        } catch (error) {
            return fail(res, error, "deletePlan");
        }
    }

    // ------------------------------------------------ agencies
    // GET /saas_admin/agencies?status=trial|active|expired|suspended&search=&plan=&joined=<days>&sort=ending|ending_desc|newest|oldest|name&page=&limit=
    async listAgencies(req: RequestWithUser, res: Response) {
        try {
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
            const { status, search, plan, sort } = req.query as Record<string, string>;
            const joined = Math.round(Number(req.query.joined || 0));
            const now = new Date();
            const where: any = { role: "agent" };
            if (status === "suspended") where.status = "inactive";
            else if (status) {
                where.status = "active";
                if (status === "expired") where[Op.or] = [{ expires_at: null }, { expires_at: { [Op.lte]: now } }];
                else {
                    where.expires_at = { [Op.gt]: now };
                    if (status === "trial") where.saas_kind = "trial";
                    if (status === "active") where.saas_kind = { [Op.ne]: "trial" };
                    if (status === "expiring") where.expires_at = { [Op.between]: [now, new Date(now.getTime() + 7 * DAY)] };
                }
            }
            if (plan) {
                const p: any = await SaasPlan.findOne({ where: { uuid: plan }, attributes: ["id"] });
                where.saas_plan_id = p ? p.dataValues.id : -1;
            }
            if (search && search.trim()) {
                const term = `%${search.trim().slice(0, 100)}%`;
                where[Op.and] = [{ [Op.or]: [{ username: { [Op.like]: term } }, { email: { [Op.like]: term } }, { phone_number: { [Op.like]: term } }, { app_name: { [Op.like]: term } }, { sudomain: { [Op.like]: term } }] }];
            }
            if (joined > 0 && joined <= 3650) where.createdAt = { [Op.gte]: new Date(now.getTime() - joined * DAY) };
            const ORDER: Record<string, any[]> = {
                ending: [["expires_at", "ASC"]],
                ending_desc: [["expires_at", "DESC"]],
                newest: [["createdAt", "DESC"]],
                oldest: [["createdAt", "ASC"]],
                name: [[fn("COALESCE", col("app_name"), col("username")), "ASC"]],
            };

            const { count, rows } = await Agent.findAndCountAll({
                where,
                attributes: ["id", "uuid", "username", "app_name", "email", "phone_number", "country_code", "status", "expires_at", "saas_kind", "saas_plan_id", "sudomain", "domain", "crm_type", "createdAt"],
                include: [{ model: SaasPlan, as: "saas_plan", attributes: ["uuid", "name"], required: false }],
                order: [...(ORDER[sort] || ORDER.ending), ["id", "ASC"]],
                limit,
                offset: (page - 1) * limit,
            });

            const ids = rows.map((r: any) => r.dataValues.id);
            const uuids = rows.map((r: any) => r.dataValues.uuid);
            const [team, leads]: any[] = await Promise.all([
                ids.length ? Agent.findAll({ where: { parent_id: ids }, attributes: ["parent_id", [fn("COUNT", col("id")), "n"]], group: ["parent_id"], raw: true }) : [],
                uuids.length ? CrmLead.findAll({ where: { agency_uuid: uuids }, attributes: ["agency_uuid", [fn("COUNT", col("id")), "n"]], group: ["agency_uuid"], raw: true }) : [],
            ]);
            const teamBy = Object.fromEntries(team.map((t: any) => [t.parent_id, Number(t.n)]));
            const leadsBy = Object.fromEntries(leads.map((l: any) => [l.agency_uuid, Number(l.n)]));

            const agencies = rows.map((r: any) => {
                const a = r.toJSON();
                const ends = a.expires_at ? new Date(a.expires_at) : null;
                const left = ends ? Math.ceil((ends.getTime() - Date.now()) / DAY) : 0;
                return {
                    id: a.uuid,
                    name: a.app_name || a.username,
                    owner_name: a.username,
                    crm_type: a.crm_type || "visa",
                    email: a.email,
                    phone: `${a.country_code || ""} ${a.phone_number || ""}`.trim(),
                    portal: a.domain ? `${a.sudomain ? `${a.sudomain}.` : ""}${a.domain}` : null,
                    plan: a.saas_plan ? { id: a.saas_plan.uuid, name: a.saas_plan.name } : null,
                    kind: a.saas_kind,
                    status: statusOf(a),
                    ends_at: a.expires_at,
                    days_left: left > 0 ? left : 0,
                    team_members: teamBy[a.id] || 0,
                    leads: leadsBy[a.uuid] || 0,
                    createdAt: a.createdAt,
                };
            });

            const [trial, active, expiring] = await Promise.all([
                Agent.count({ where: { role: "agent", status: "active", saas_kind: "trial", expires_at: { [Op.gt]: now } } }),
                Agent.count({ where: { role: "agent", status: "active", saas_kind: { [Op.ne]: "trial" }, expires_at: { [Op.gt]: now } } }),
                Agent.count({ where: { role: "agent", status: "active", expires_at: { [Op.between]: [now, new Date(now.getTime() + 7 * DAY)] } } }),
            ]);
            const total = await Agent.count({ where: { role: "agent" } });

            return returnHelper(res, 200, true, "Agencies", {
                agencies,
                pagination: { currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count, itemsPerPage: limit },
                summary: { total, trial, active, expiring_7_days: expiring },
            });
        } catch (error) {
            return fail(res, error, "listAgencies");
        }
    }

    // GET /saas_admin/agencies/:uuid
    async agencyDetails(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({
                where: { uuid: req.params.uuid, role: "agent" },
                attributes: [
                    "id", "uuid", "username", "app_name", "email", "phone_number", "country_code", "status",
                    "expires_at", "saas_kind", "sudomain", "domain", "createdAt",
                    "primary_color", "primary_foreground_color", "dark_primary_color",
                    "support_number", "support_email", "agency_address", "meta_description", "crm_type",
                ],
            });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const moduleState = await moduleDetails(agency.dataValues.uuid);
            const [access, history, payments, leads] = await Promise.all([
                getAgencyAccess(agency.dataValues.uuid),
                SaasSubscription.findAll({
                    where: { agency_uuid: agency.dataValues.uuid },
                    include: [{ model: SaasPlan, as: "plan", attributes: ["uuid", "name"], required: false }],
                    order: [["createdAt", "DESC"], ["id", "DESC"]],
                }),
                SaasPayment.findAll({
                    where: { agency_uuid: agency.dataValues.uuid, status: "paid" },
                    include: [{ model: SaasPlan, as: "plan", attributes: ["uuid", "name"], required: false }],
                    order: [["paid_at", "DESC"]],
                }),
                CrmLead.count({ where: { agency_uuid: agency.dataValues.uuid } }),
            ]);
            const a = agency.toJSON();
            const [usage] = await agencyUsage(agency.dataValues.uuid);
            const portal = a.domain ? `${a.sudomain ? `${a.sudomain}.` : ""}${a.domain}` : null;
            return returnHelper(res, 200, true, "Agency", {
                usage: usage || null,
                agency: { ...a, name: a.app_name || a.username, status_label: statusOf(a), portal },
                access,
                leads,
                crm_type: moduleState?.crmType || "visa",
                modules: moduleState?.modules || [],
                history: history.map((h: any) => {
                    const x = h.toJSON();
                    return { id: x.uuid, kind: x.kind, plan: x.plan?.name || null, starts_at: x.starts_at, ends_at: x.ends_at, note: x.note, by_admin: Boolean(x.created_by_admin), createdAt: x.createdAt };
                }),
                payments: payments.map((p: any) => {
                    const x = p.toJSON();
                    return { id: x.uuid, plan: x.plan?.name || null, months: x.months, amount: Number(x.amount) / 100, method: x.method, reference: x.reference || x.razorpay_payment_id, note: x.note, paid_at: x.paid_at, invoice_number: x.invoice_number || null, discount: Number(x.discount || 0) / 100, coupon_code: x.coupon_code || null };
                }),
            });
        } catch (error) {
            return fail(res, error, "agencyDetails");
        }
    }

    // POST /saas_admin/agencies/:uuid/update
    // { name, owner_name, phone_number, country_code, email, support_number?, support_email?,
    //   agency_address?, primary_color?, primary_foreground_color?, dark_primary_color?, meta_description? }
    async updateAgency(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" } });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const b = req.body || {};
            const ownerName = String(b.owner_name ?? agency.dataValues.username ?? "").trim().slice(0, 255);
            const brandName = String(b.name ?? agency.dataValues.app_name ?? ownerName).trim().slice(0, 255);
            const phone = String(b.phone_number ?? agency.dataValues.phone_number ?? "").replace(/\D/g, "");
            const countryCode = normalizeCountryCode(b.country_code ?? agency.dataValues.country_code);
            const email = String(b.email ?? agency.dataValues.email ?? "").trim().toLowerCase().slice(0, 255);

            if (!ownerName) return returnHelper(res, 200, false, "Please enter the owner's name");
            if (!brandName) return returnHelper(res, 200, false, "Please enter the agency name");
            if (phone.length < 8 || phone.length > 14) return returnHelper(res, 200, false, "Please enter a valid phone number");
            if (!email) return returnHelper(res, 200, false, "Please enter the owner's email");
            if (!EMAIL_RE.test(email)) return returnHelper(res, 200, false, "Please enter a valid email address");

            if (phone !== agency.dataValues.phone_number) {
                const clash: any = await Agent.findOne({ where: { phone_number: phone, id: { [Op.ne]: agency.dataValues.id } }, attributes: ["id"] });
                if (clash) return returnHelper(res, 200, false, "This phone number is already used by another account");
            }

            const colorOrNull = (v: any) => {
                if (v === undefined) return undefined;
                const s = String(v || "").trim();
                if (!s) return null;
                if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new SaasError("Colours must be hex like #0f5bd8");
                return s;
            };
            const strOrNull = (v: any, max: number) => {
                if (v === undefined) return undefined;
                const s = String(v || "").trim();
                return s ? s.slice(0, max) : null;
            };

            const patch: any = {
                username: ownerName,
                app_name: brandName,
                phone_number: phone,
                country_code: countryCode,
                email,
            };
            const supportNumber = strOrNull(b.support_number, 40);
            if (supportNumber !== undefined) patch.support_number = supportNumber;
            const supportEmail = strOrNull(b.support_email, 255);
            if (supportEmail !== undefined) {
                if (supportEmail && !EMAIL_RE.test(supportEmail)) return returnHelper(res, 200, false, "Please enter a valid support email");
                patch.support_email = supportEmail;
            }
            const address = strOrNull(b.agency_address, 2000);
            if (address !== undefined) patch.agency_address = address;
            const meta = strOrNull(b.meta_description, 2000);
            if (meta !== undefined) patch.meta_description = meta;
            const primary = colorOrNull(b.primary_color);
            if (primary !== undefined) patch.primary_color = primary;
            const primaryFg = colorOrNull(b.primary_foreground_color);
            if (primaryFg !== undefined) patch.primary_foreground_color = primaryFg;
            const darkPrimary = colorOrNull(b.dark_primary_color);
            if (darkPrimary !== undefined) patch.dark_primary_color = darkPrimary;

            await Agent.update(patch, { where: { id: agency.dataValues.id } });
            return returnHelper(res, 200, true, "Agency details saved");
        } catch (error) {
            return fail(res, error, "updateAgency");
        }
    }

    // POST /saas_admin/agencies/:uuid/delete  - soft-delete agency + team (Agent is paranoid)
    async deleteAgency(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" } });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const a = agency.dataValues;
            await sequelize.transaction(async (t: any) => {
                // free the portal address for reuse (paranoid rows still unique-check elsewhere without paranoid:false)
                await Agent.update(
                    { sudomain: null, domain: null, status: "inactive" },
                    { where: { id: a.id }, transaction: t },
                );
                await Agent.destroy({ where: { parent_id: a.id }, transaction: t });
                await Agent.destroy({ where: { id: a.id }, transaction: t });
            });
            return returnHelper(res, 200, true, `${a.app_name || a.username} deleted. Team members were removed too.`);
        } catch (error) {
            return fail(res, error, "deleteAgency");
        }
    }

    // POST /saas_admin/agencies
    // { name, owner_name, phone_number, country_code, email, sudomain, domain, plan_id,
    //   activate?: "paid"|"trial"|"none", trial_days?, amount?, method?, reference?, note? }
    async createAgency(req: RequestWithUser, res: Response) {
        try {
            const b = req.body || {};
            const ownerName = String(b.owner_name || b.name || "").trim().slice(0, 255);
            const phone = String(b.phone_number || "").replace(/\D/g, "");
            const countryCode = normalizeCountryCode(b.country_code);
            const trialDays = Math.round(Number(b.trial_days || 0));
            const email = String(b.email || "").trim().toLowerCase().slice(0, 255);
            const activate = ["paid", "trial", "none"].includes(String(b.activate || ""))
                ? String(b.activate)
                : (b.amount != null && b.amount !== "" ? "paid" : (trialDays > 0 ? "trial" : "none"));
            if (!ownerName) return returnHelper(res, 200, false, "Please enter the owner's name");
            if (phone.length < 8 || phone.length > 14) return returnHelper(res, 200, false, "Please enter a valid phone number");
            // the welcome email with the login code goes here
            if (!email) return returnHelper(res, 200, false, "Please enter the owner's email - their login details are sent there");
            if (!EMAIL_RE.test(email)) return returnHelper(res, 200, false, "Please enter a valid email address");
            if (await Agent.findOne({ where: { phone_number: phone }, attributes: ["id"] })) {
                return returnHelper(res, 200, false, "This phone number is already used by another account");
            }
            const portal = normalizePortal(b.sudomain, b.domain);
            if (portal.error) return returnHelper(res, 200, false, portal.error);
            if (portal.domain && await Agent.findOne({ where: { domain: portal.domain, sudomain: portal.sudomain }, attributes: ["id"] })) {
                return returnHelper(res, 200, false, "This portal address is already used by another agency");
            }
            let plan: any = null;
            let planId: number | null = null;
            if (b.plan_id) {
                plan = await SaasPlan.findOne({ where: { uuid: b.plan_id } });
                if (!plan) return returnHelper(res, 200, false, "Plan not found");
                planId = plan.dataValues.id;
            }
            if (activate === "paid" && !planId) return returnHelper(res, 200, false, "Please choose a 6 or 12 month plan");
            if (activate === "trial" && (trialDays < 1 || trialDays > 365)) return returnHelper(res, 200, false, "Trial days must be between 1 and 365");

            const months = plan?.dataValues?.duration_months
                ? Number(plan.dataValues.duration_months)
                : Math.round(Number(b.months || 0));
            if (activate === "paid" && (![6, 12].includes(months))) {
                return returnHelper(res, 200, false, "Paid activation needs a 6 or 12 month plan");
            }
            const amountRupees = Math.round(Number(b.amount || 0));
            if (activate === "paid" && (!Number.isFinite(amountRupees) || amountRupees < 0)) {
                return returnHelper(res, 200, false, "Please enter the amount received");
            }
            const method = MANUAL_METHODS.includes(b.method) ? b.method : "upi";

            const agency: any = await sequelize.transaction(async (t: any) => {
                const brandName = (b.name ? String(b.name).trim() : ownerName).slice(0, 255);
                const created: any = await Agent.create({
                    username: ownerName,
                    app_name: brandName,
                    email,
                    phone_number: phone,
                    country_code: countryCode,
                    role: "agent",
                    status: "active",
                    crm_type: normalizeCrmType(b.crm_type),
                    sudomain: portal.sudomain,
                    domain: portal.domain,
                    // student landing + login branding defaults (owner can change in CRM → Branding)
                    primary_color: "#0f5bd8",
                    primary_foreground_color: "#ffffff",
                    dark_primary_color: "#050a30",
                    support_number: phone,
                    support_email: email,
                    meta_description: `Study abroad with ${brandName}. Track your visa application, upload documents and get counselling support.`,
                    // no access until a trial or paid plan is assigned below
                    expires_at: new Date(),
                    saas_plan_id: planId,
                }, { transaction: t });

                if (activate === "paid" && planId) {
                    const start = new Date();
                    const end = addMonths(start, months);
                    const amount = amountRupees * 100;
                    let paymentId: number | null = null;
                    if (amount > 0) {
                        const payment: any = await SaasPayment.create({
                            agency_uuid: created.dataValues.uuid, plan_id: planId, months, amount, currency: "INR",
                            method, status: "paid",
                            reference: b.reference ? String(b.reference).slice(0, 255) : null,
                            note: b.note ? String(b.note).slice(0, 1000) : "Activated on create",
                            paid_at: new Date(), created_by_admin: req.id || null,
                        }, { transaction: t });
                        paymentId = payment.dataValues.id;
                        await issueInvoice(payment.dataValues.id, t);
                    }
                    await applyPeriod({
                        agencyUuid: created.dataValues.uuid, planId, kind: "paid",
                        startsAt: start, endsAt: end, paymentId,
                        note: b.note ? String(b.note).slice(0, 1000) : `Payment recorded (${method})`,
                        adminId: req.id || null, transaction: t,
                    });
                } else if (activate === "trial" && trialDays) {
                    const start = new Date();
                    await applyPeriod({
                        agencyUuid: created.dataValues.uuid, planId, kind: "trial", startsAt: start,
                        endsAt: new Date(start.getTime() + trialDays * DAY), note: `Free trial: ${trialDays} days`, adminId: req.id || null, transaction: t,
                    });
                }
                return created;
            });

            // login code + welcome email (after the transaction, so a mail problem never undoes the agency)
            const code = await setLoginCode(agency.dataValues.id);
            const sent = await sendLoginEmail({
                to: email, ownerName, agencyName: agency.dataValues.app_name, phone: `${countryCode} ${phone}`, code,
                panelBase: panelBaseOf(agency.dataValues),
                trialDays: activate === "trial" ? trialDays || undefined : undefined,
            });
            const what = activate === "paid"
                ? `Agency created and activated for ${months} months.`
                : activate === "trial"
                    ? `Agency created with a ${trialDays}-day free trial.`
                    : "Agency created. Give them a trial or plan to activate the account.";
            const portalHost = agency.dataValues.domain
                ? `${agency.dataValues.sudomain ? `${agency.dataValues.sudomain}.` : ""}${agency.dataValues.domain}`
                : null;
            return returnHelper(res, 200, true,
                sent ? `${what} Login details were emailed to ${email}.` : `${what} The welcome email could not be sent - share the login code with the owner yourself.`,
                // the plain code is only returned when the email failed, so the admin can pass it on
                { id: agency.dataValues.uuid, email_sent: sent, portal: portalHost, ...(sent ? {} : { login_code: code, phone: `${countryCode} ${phone}` }) });
        } catch (error) {
            return fail(res, error, "createAgency");
        }
    }

    // POST /saas_admin/agencies/:uuid/portal  { sudomain?, domain? }  - own domain or platform subdomain
    // POST /saas_admin/agencies/:uuid/modules  { crm_type?, overrides?: { [module_key]: true | false | null } }
    // null removes an override (back to the CRM type / plan default). Data is never deleted when a module is off.
    async updateModules(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" }, attributes: ["id", "uuid", "crm_type"] });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const b = req.body || {};
            const before = await moduleDetails(agency.dataValues.uuid);
            const adminId = Number((req.user?.user as any)?.id) || null;
            const changes: string[] = [];
            await sequelize.transaction(async (t: any) => {
                if (b.crm_type !== undefined) {
                    if (!CRM_TYPES.includes(b.crm_type)) throw new Error("CRM type must be visa, travel or both");
                    if (b.crm_type !== agency.dataValues.crm_type) {
                        await Agent.update({ crm_type: b.crm_type }, { where: { id: agency.dataValues.id }, transaction: t });
                        changes.push(`CRM type: ${agency.dataValues.crm_type || "visa"} → ${b.crm_type}`);
                    }
                }
                const overrides = b.overrides && typeof b.overrides === "object" ? b.overrides : {};
                for (const [key, value] of Object.entries(overrides)) {
                    if (!MODULE_KEYS.includes(key)) throw new Error(`Unknown module: ${key}`);
                    if (value === null) {
                        const n = await AgencyModule.destroy({ where: { agency_uuid: agency.dataValues.uuid, module_key: key }, transaction: t });
                        if (n) changes.push(`${key}: back to default`);
                    } else {
                        const existing: any = await AgencyModule.findOne({ where: { agency_uuid: agency.dataValues.uuid, module_key: key }, transaction: t });
                        if (existing) await existing.update({ is_enabled: Boolean(value), updated_by: adminId }, { transaction: t });
                        else await AgencyModule.create({ agency_uuid: agency.dataValues.uuid, module_key: key, is_enabled: Boolean(value), updated_by: adminId }, { transaction: t });
                        changes.push(`${key}: ${value ? "on" : "off"}`);
                    }
                }
            });
            clearModuleCache(agency.dataValues.uuid);
            const after = await moduleDetails(agency.dataValues.uuid);
            if (changes.length) {
                audit(null, {
                    agencyUuid: agency.dataValues.uuid, entity: "settings", action: "modules",
                    summary: `Super Admin changed modules - ${changes.join(", ")}`,
                    meta: { before: before?.modules.filter((m) => m.enabled).map((m) => m.key), after: after?.modules.filter((m) => m.enabled).map((m) => m.key), admin_id: adminId },
                    actor: { type: "system", name: "Super Admin" },
                });
            }
            return returnHelper(res, 200, true, changes.length ? "Modules updated" : "No changes", { crm_type: after?.crmType, modules: after?.modules || [] });
        } catch (error: any) {
            if (error?.message && !error?.sql) return returnHelper(res, 200, false, error.message);
            return fail(res, error, "updateModules");
        }
    }

    async updatePortal(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" } });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const portal = normalizePortal(req.body?.sudomain, req.body?.domain);
            if (portal.error) return returnHelper(res, 200, false, portal.error);
            if (portal.domain) {
                const clash: any = await Agent.findOne({
                    where: { domain: portal.domain, sudomain: portal.sudomain, id: { [Op.ne]: agency.dataValues.id } },
                    attributes: ["id"],
                });
                if (clash) return returnHelper(res, 200, false, "This portal address is already used by another agency");
            }
            await Agent.update(
                { sudomain: portal.sudomain, domain: portal.domain },
                { where: { id: agency.dataValues.id } },
            );
            const host = portal.domain ? `${portal.sudomain ? `${portal.sudomain}.` : ""}${portal.domain}` : null;
            return returnHelper(res, 200, true, host ? `Student portal set to ${host}` : "Student portal address cleared", { portal: host, sudomain: portal.sudomain, domain: portal.domain });
        } catch (error) {
            return fail(res, error, "updatePortal");
        }
    }

    // POST /saas_admin/agencies/:uuid/trial  { days, plan_id, note }
    async giveTrial(req: RequestWithUser, res: Response) {
        try {
            let planId: number | null = null;
            if (req.body?.plan_id) {
                const plan: any = await SaasPlan.findOne({ where: { uuid: req.body.plan_id } });
                if (!plan) return returnHelper(res, 200, false, "Plan not found");
                planId = plan.dataValues.id;
            } else {
                const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" }, attributes: ["saas_plan_id"] });
                planId = agency?.dataValues?.saas_plan_id || null;
            }
            const days = Math.round(Number(req.body?.days));
            await assignTrial(req.params.uuid, planId, days, req.id || 0, req.body?.note ? String(req.body.note).slice(0, 1000) : undefined);
            return returnHelper(res, 200, true, `Free trial set: ${days} days from today`);
        } catch (error) {
            return fail(res, error, "giveTrial");
        }
    }

    /**
     * POST /saas_admin/agencies/:uuid/extend
     * { plan_id, months? | ends_at?, kind: "paid" | "complimentary", amount?, method?, reference?, note? }
     * Paid time is added after the current end date.
     */
    async extend(req: RequestWithUser, res: Response) {
        try {
            const b = req.body || {};
            const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" } });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const plan: any = b.plan_id ? await SaasPlan.findOne({ where: { uuid: b.plan_id } }) : null;
            if (b.plan_id && !plan) return returnHelper(res, 200, false, "Plan not found");
            const planId = plan ? plan.dataValues.id : agency.dataValues.saas_plan_id;
            if (!planId) return returnHelper(res, 200, false, "Please choose a plan");
            const kind = b.kind === "complimentary" ? "complimentary" : "paid";

            const start = extensionStart(agency);
            let end: Date;
            let months = 0;
            if (b.ends_at) {
                end = new Date(b.ends_at);
                if (isNaN(end.getTime()) || end <= new Date()) return returnHelper(res, 200, false, "Please pick an end date in the future");
            } else {
                months = Math.round(Number(b.months));
                if (!months || months < 1 || months > 60) return returnHelper(res, 200, false, "Please choose 1 to 60 months");
                end = addMonths(start, months);
            }
            const amount = Math.round(Number(b.amount || 0) * 100);
            if (kind === "paid" && (!Number.isFinite(amount) || amount < 0)) return returnHelper(res, 200, false, "Please enter a valid amount");
            const method = MANUAL_METHODS.includes(b.method) ? b.method : "other";

            await sequelize.transaction(async (t: any) => {
                let paymentId: number | null = null;
                if (kind === "paid" && amount > 0) {
                    const payment: any = await SaasPayment.create({
                        agency_uuid: agency.dataValues.uuid, plan_id: planId, months: months || null, amount, currency: "INR", method, status: "paid",
                        reference: b.reference ? String(b.reference).slice(0, 255) : null, note: b.note ? String(b.note).slice(0, 1000) : null,
                        paid_at: new Date(), created_by_admin: req.id || null,
                    }, { transaction: t });
                    paymentId = payment.dataValues.id;
                    await issueInvoice(payment.dataValues.id, t);
                    await SaasPayment.update({ resolved: true }, { where: { agency_uuid: agency.dataValues.uuid, status: "failed", resolved: false }, transaction: t });
                }
                await applyPeriod({
                    agencyUuid: agency.dataValues.uuid, planId, kind,
                    startsAt: b.ends_at ? new Date() : start, endsAt: end, paymentId,
                    note: b.note ? String(b.note).slice(0, 1000) : (kind === "paid" ? `Payment recorded (${method})` : "Complimentary extension"),
                    adminId: req.id || null, transaction: t,
                });
            });
            notifyLater({
                agencyUuid: agency.dataValues.uuid, recipientIds: [agency.dataValues.id],
                type: kind === "paid" ? "payment_received" : "plan_ending",
                title: kind === "paid" ? "Payment received - thank you!" : "You have been given extra days",
                body: `Your access is extended until ${end.toDateString()}.`,
                link: "/subscription", email: true,
            });
            return returnHelper(res, 200, true, `Access extended until ${end.toDateString()}`);
        } catch (error) {
            return fail(res, error, "extend");
        }
    }

    // POST /saas_admin/agencies/:uuid/change_plan { plan_id }  - same end date, new limits
    async changePlan(req: RequestWithUser, res: Response) {
        try {
            const plan: any = await SaasPlan.findOne({ where: { uuid: req.body?.plan_id } });
            if (!plan) return returnHelper(res, 200, false, "Plan not found");
            const [n] = await Agent.update({ saas_plan_id: plan.dataValues.id }, { where: { uuid: req.params.uuid, role: "agent" } });
            if (!n) return returnHelper(res, 200, false, "Agency not found");
            return returnHelper(res, 200, true, `Plan changed to ${plan.dataValues.name}. The end date stays the same.`);
        } catch (error) {
            return fail(res, error, "changePlan");
        }
    }

    // POST /saas_admin/agencies/:uuid/end_access  - stop access today (e.g. trial abuse, refund)
    async endAccess(req: RequestWithUser, res: Response) {
        try {
            const [n] = await Agent.update({ expires_at: new Date() }, { where: { uuid: req.params.uuid, role: "agent" } });
            if (!n) return returnHelper(res, 200, false, "Agency not found");
            return returnHelper(res, 200, true, "Access ended. The owner will see the renew screen.");
        } catch (error) {
            return fail(res, error, "endAccess");
        }
    }

    // POST /saas_admin/agencies/:uuid/send_login { email? }  - new login code by email (the old one stops working)
    async sendLoginDetails(req: RequestWithUser, res: Response) {
        try {
            const agency: any = await Agent.findOne({ where: { uuid: req.params.uuid, role: "agent" }, attributes: ["id", "username", "app_name", "email", "phone_number", "country_code", "sudomain", "domain"] });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");
            const a = agency.dataValues;
            let email = String(req.body?.email || a.email || "").trim().toLowerCase().slice(0, 255);
            if (!email) return returnHelper(res, 200, false, "This agency has no email. Add one to send the login code.");
            if (!EMAIL_RE.test(email)) return returnHelper(res, 200, false, "Please enter a valid email address");
            if (email !== a.email) await Agent.update({ email }, { where: { id: a.id } });

            const code = await setLoginCode(a.id);
            const phone = `${a.country_code || ""} ${a.phone_number || ""}`.trim();
            const sent = await sendLoginEmail({ to: email, ownerName: a.username, agencyName: a.app_name, phone, code, reset: true, panelBase: panelBaseOf(a) });
            return returnHelper(res, 200, true,
                sent ? `New login code emailed to ${email}. The old code no longer works.` : "New login code created, but the email could not be sent - share it with the owner yourself.",
                { email_sent: sent, ...(sent ? {} : { login_code: code, phone }) });
        } catch (error) {
            return fail(res, error, "sendLoginDetails");
        }
    }

    // POST /saas_admin/agencies/:uuid/status { status: "active" | "inactive" }  - suspend blocks login and the API
    async setAgencyStatus(req: RequestWithUser, res: Response) {
        try {
            const status = req.body?.status === "inactive" ? "inactive" : "active";
            const [n] = await Agent.update({ status }, { where: { uuid: req.params.uuid, role: "agent" } });
            if (!n) return returnHelper(res, 200, false, "Agency not found");
            return returnHelper(res, 200, true, status === "inactive" ? "Agency suspended. The owner and team can't log in." : "Agency reactivated.");
        } catch (error) {
            return fail(res, error, "setAgencyStatus");
        }
    }

    /**
     * POST /saas_admin/agencies/bulk
     * { action: "trial" | "free_days" | "change_plan" | "suspend" | "reactivate" | "end_access", ids: [uuid], days?, plan_id? }
     * Runs per agency and reports which ones failed, so one bad row doesn't stop the rest.
     */
    async bulkAgencies(req: RequestWithUser, res: Response) {
        try {
            const b = req.body || {};
            const action = String(b.action || "");
            const ids: string[] = Array.isArray(b.ids) ? [...new Set(b.ids.map(String))].slice(0, 500) as string[] : [];
            if (!ids.length) return returnHelper(res, 200, false, "Select at least one agency");
            const ACTIONS = ["trial", "free_days", "change_plan", "suspend", "reactivate", "end_access"];
            if (!ACTIONS.includes(action)) return returnHelper(res, 200, false, "Unknown action");

            const days = Math.round(Number(b.days));
            if ((action === "trial" || action === "free_days") && (!Number.isInteger(days) || days < 1 || days > 365)) {
                return returnHelper(res, 200, false, "Days must be between 1 and 365");
            }
            let plan: any = null;
            if (b.plan_id) {
                plan = await SaasPlan.findOne({ where: { uuid: b.plan_id } });
                if (!plan) return returnHelper(res, 200, false, "Plan not found");
            }
            if (action === "change_plan" && !plan) return returnHelper(res, 200, false, "Please choose a plan");

            const agencies: any[] = await Agent.findAll({ where: { uuid: ids, role: "agent" } });
            const found = new Set(agencies.map((a) => a.dataValues.uuid));
            const failed: { id: string; name: string; reason: string }[] = ids
                .filter((id) => !found.has(id))
                .map((id) => ({ id, name: id, reason: "Agency not found" }));
            let done = 0;

            for (const agency of agencies) {
                const a = agency.dataValues;
                const name = a.app_name || a.username;
                try {
                    if (action === "suspend" || action === "reactivate") {
                        await Agent.update({ status: action === "suspend" ? "inactive" : "active" }, { where: { id: a.id } });
                    } else if (action === "end_access") {
                        await Agent.update({ expires_at: new Date() }, { where: { id: a.id } });
                    } else if (action === "change_plan") {
                        await Agent.update({ saas_plan_id: plan.dataValues.id }, { where: { id: a.id } });
                    } else if (action === "trial") {
                        await assignTrial(a.uuid, plan ? plan.dataValues.id : a.saas_plan_id || null, days, req.id || 0);
                    } else if (action === "free_days") {
                        const planId = plan ? plan.dataValues.id : a.saas_plan_id;
                        if (!planId) throw new SaasError("No plan - change the plan first");
                        const start = extensionStart(agency);
                        const end = new Date(start.getTime() + days * DAY);
                        await applyPeriod({ agencyUuid: a.uuid, planId, kind: "complimentary", startsAt: start, endsAt: end, note: `Complimentary: ${days} free day(s)`, adminId: req.id || null });
                        notifyLater({
                            agencyUuid: a.uuid, recipientIds: [a.id], type: "plan_ending",
                            title: "You have been given extra days", body: `Your access is extended until ${end.toDateString()}.`, link: "/subscription", email: true,
                        });
                    }
                    done++;
                } catch (error: any) {
                    if (!(error instanceof SaasError)) console.error(`SaaS admin bulk ${action} failed for ${a.uuid}`, error);
                    failed.push({ id: a.uuid, name, reason: error instanceof SaasError ? error.message : "Something went wrong" });
                }
            }

            const VERB: Record<string, string> = {
                trial: `given a ${days}-day free trial`, free_days: `given ${days} free day(s)`, change_plan: `moved to ${plan?.dataValues?.name}`,
                suspend: "suspended", reactivate: "reactivated", end_access: "access ended",
            };
            const message = `${done} agenc${done === 1 ? "y" : "ies"} ${VERB[action]}` + (failed.length ? `, ${failed.length} failed` : "");
            return returnHelper(res, 200, done > 0, message, { done, failed });
        } catch (error) {
            return fail(res, error, "bulkAgencies");
        }
    }

    // GET /saas_admin/payments?page=&limit=&status=paid|failed&open=1&search=&method=&from=YYYY-MM-DD&to=YYYY-MM-DD
    async listPayments(req: RequestWithUser, res: Response) {
        try {
            const page = Math.max(parseInt(req.query.page as string) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
            const failed = req.query.status === "failed";
            const where: any = failed ? { status: "failed", failed_at: { [Op.ne]: null } } : { status: "paid" };
            if (failed && req.query.open === "1") where.resolved = false;
            const dateCol = failed ? "failed_at" : "paid_at";
            const { search, method, from, to } = req.query as Record<string, string>;
            if (method && (MANUAL_METHODS.includes(method) || method === "razorpay")) where.method = method;
            const range: any = {};
            if (from && !isNaN(new Date(from).getTime())) range[Op.gte] = new Date(`${from}T00:00:00`);
            if (to && !isNaN(new Date(to).getTime())) range[Op.lte] = new Date(`${to}T23:59:59.999`);
            if (Object.getOwnPropertySymbols(range).length) where[dateCol] = failed ? { [Op.ne]: null, ...range } : range;
            if (search && search.trim()) {
                const term = `%${search.trim().slice(0, 100)}%`;
                const matches: any[] = await Agent.findAll({
                    where: { role: "agent", [Op.or]: [{ app_name: { [Op.like]: term } }, { username: { [Op.like]: term } }, { phone_number: { [Op.like]: term } }] },
                    attributes: ["uuid"], raw: true,
                });
                where[Op.and] = [{ [Op.or]: [
                    { agency_uuid: matches.map((m) => m.uuid) },
                    { reference: { [Op.like]: term } }, { razorpay_payment_id: { [Op.like]: term } }, { invoice_number: { [Op.like]: term } },
                ] }];
            }
            const { count, rows } = await SaasPayment.findAndCountAll({
                where,
                include: [{ model: SaasPlan, as: "plan", attributes: ["name"], required: false }],
                order: [[dateCol, "DESC"], ["id", "DESC"]],
                limit,
                offset: (page - 1) * limit,
            });
            const uuids = [...new Set(rows.map((r: any) => r.dataValues.agency_uuid))];
            const agencies: any[] = uuids.length ? await Agent.findAll({ where: { uuid: uuids }, attributes: ["uuid", "username", "app_name"], raw: true }) : [];
            const nameBy = Object.fromEntries(agencies.map((a) => [a.uuid, a.app_name || a.username]));
            const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
            const thisMonth = await SaasPayment.sum("amount", { where: { status: "paid", paid_at: { [Op.gte]: month } } });
            return returnHelper(res, 200, true, "Payments", {
                payments: rows.map((r: any) => {
                    const x = r.toJSON();
                    return { id: x.uuid, agency: nameBy[x.agency_uuid] || "-", agency_id: x.agency_uuid, plan: x.plan?.name || null, months: x.months, amount: Number(x.amount) / 100, method: x.method, reference: x.reference || x.razorpay_payment_id, paid_at: x.paid_at, invoice_number: x.invoice_number || null, discount: Number(x.discount || 0) / 100, coupon_code: x.coupon_code || null, failed_at: x.failed_at, failure_reason: x.failure_reason, followup_count: x.followup_count, last_followup_at: x.last_followup_at, resolved: Boolean(x.resolved) };
                }),
                pagination: { currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count },
                this_month: Number(thisMonth || 0) / 100,
                open_failures: await SaasPayment.count({ where: { status: "failed", resolved: false, failed_at: { [Op.ne]: null } } }),
            });
        } catch (error) {
            return fail(res, error, "listPayments");
        }
    }
    // GET /saas_admin/usage?health=healthy|at_risk|inactive&search=&sort=score|idle|leads|name
    async usage(req: RequestWithUser, res: Response) {
        try {
            let rows = await agencyUsage();
            const summary = {
                total: rows.length,
                healthy: rows.filter((r) => r.health === "healthy").length,
                at_risk: rows.filter((r) => r.health === "at_risk").length,
                inactive: rows.filter((r) => r.health === "inactive").length,
                active_today: rows.filter((r) => r.days_idle !== null && r.days_idle < 1).length,
                leads_30d: rows.reduce((s, r) => s + r.leads_30d, 0),
            };
            const health = String(req.query.health || "");
            if (["healthy", "at_risk", "inactive"].includes(health)) rows = rows.filter((r) => r.health === health);
            const search = String(req.query.search || "").trim().toLowerCase();
            if (search) rows = rows.filter((r) => [r.name, r.owner_name, r.phone].some((v) => String(v || "").toLowerCase().includes(search)));
            const sort = String(req.query.sort || "score");
            const idle = (r: any) => (r.days_idle === null ? 1e9 : r.days_idle);
            rows.sort((a, b) =>
                sort === "idle" ? idle(b) - idle(a)
                    : sort === "leads" ? b.leads_30d - a.leads_30d
                        : sort === "name" ? String(a.name).localeCompare(String(b.name))
                            : a.score - b.score); // default: weakest first
            return returnHelper(res, 200, true, "Usage", { summary, agencies: rows });
        } catch (error) {
            return fail(res, error, "usage");
        }
    }

    // GET /saas_admin/monitoring — application/platform health (API probes, live errors, scheduler jobs)
    // Query: agency_uuid, source, severity — filter recent_errors (summary stays global)
    async monitoring(req: RequestWithUser, res: Response) {
        try {
            const q = req.query || {};
            const data = await buildMonitoringPayload({
                agency_uuid: typeof q.agency_uuid === 'string' ? q.agency_uuid : null,
                source: typeof q.source === 'string' ? q.source : null,
                severity: typeof q.severity === 'string' ? q.severity : null,
            });
            return returnHelper(res, 200, true, "Monitoring", data);
        } catch (error) {
            return fail(res, error, "monitoring");
        }
    }

    // POST /saas_admin/payments/:uuid/remind  - send the owner a reminder about a failed payment now
    async remindFailed(req: RequestWithUser, res: Response) {
        try {
            const ok = await sendFailureReminderNow(req.params.uuid);
            return returnHelper(res, 200, ok, ok ? "Reminder sent to the agency owner" : "Payment not found");
        } catch (error) {
            return fail(res, error, "remindFailed");
        }
    }

    // POST /saas_admin/payments/:uuid/resolve  - stop follow-ups (agency paid another way, not interested ...)
    async resolveFailed(req: RequestWithUser, res: Response) {
        try {
            const payment: any = await SaasPayment.findOne({ where: { uuid: req.params.uuid, status: "failed" }, attributes: ["id"] });
            if (!payment) return returnHelper(res, 200, false, "Payment not found");
            await SaasPayment.update({ resolved: true }, { where: { id: payment.dataValues.id } });
            return returnHelper(res, 200, true, "Marked as handled - no more reminders");
        } catch (error) {
            return fail(res, error, "resolveFailed");
        }
    }

    // POST /saas_admin/payments/bulk { action: "remind" | "resolve", ids: [uuid] }  - failed payments only
    async bulkPayments(req: RequestWithUser, res: Response) {
        try {
            const action = req.body?.action;
            const ids: string[] = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String))].slice(0, 500) as string[] : [];
            if (!ids.length) return returnHelper(res, 200, false, "Select at least one payment");
            if (action !== "remind" && action !== "resolve") return returnHelper(res, 200, false, "Unknown action");
            const rows: any[] = await SaasPayment.findAll({ where: { uuid: ids, status: "failed" }, attributes: ["id", "uuid", "resolved"] });
            let done = 0;
            if (action === "resolve") {
                const open = rows.filter((r) => !r.dataValues.resolved).map((r) => r.dataValues.id);
                if (open.length) await SaasPayment.update({ resolved: true }, { where: { id: open } });
                done = open.length;
            } else {
                for (const r of rows) if (await sendFailureReminderNow(r.dataValues.uuid)) done++;
            }
            const skipped = ids.length - done;
            const message = action === "resolve"
                ? `${done} marked as handled${skipped ? `, ${skipped} skipped (already handled or not a failed payment)` : ""}`
                : `${done} reminder(s) sent${skipped ? `, ${skipped} skipped` : ""}`;
            return returnHelper(res, 200, done > 0, message, { done, skipped });
        } catch (error) {
            return fail(res, error, "bulkPayments");
        }
    }

    // ---------------------------------------------------------------- billing settings & invoices

    // GET /saas_admin/billing_settings
    async billingSettings(req: RequestWithUser, res: Response) {
        try {
            return returnHelper(res, 200, true, "Billing settings", { ...(await getPlatformBilling()), states: GST_STATES });
        } catch (error) {
            return fail(res, error, "billingSettings");
        }
    }

    // POST /saas_admin/billing_settings
    async saveBillingSettings(req: RequestWithUser, res: Response) {
        try {
            await savePlatformBilling(req.body || {});
            return returnHelper(res, 200, true, "Billing settings saved. New invoices will use them.");
        } catch (error) {
            return fail(res, error, "saveBillingSettings");
        }
    }

    // GET /saas_admin/payments/:uuid/invoice
    async invoice(req: RequestWithUser, res: Response) {
        try {
            const invoice = await loadInvoice(req.params.uuid, null, sequelize);
            const payment: any = await SaasPayment.findOne({ where: { uuid: req.params.uuid }, attributes: ["agency_uuid"] });
            return returnHelper(res, 200, true, "Invoice", { ...invoice, agency_id: payment?.dataValues?.agency_uuid || null });
        } catch (error) {
            return fail(res, error, "invoice");
        }
    }

    // ---------------------------------------------------------------- coupons

    // GET /saas_admin/coupons
    async listCoupons(req: RequestWithUser, res: Response) {
        try {
            const [coupons, plans] = await Promise.all([
                SaasCoupon.findAll({ order: [["createdAt", "DESC"]] }),
                SaasPlan.findAll({ attributes: ["id", "uuid", "name"], raw: true }),
            ]);
            const uuidById = Object.fromEntries((plans as any[]).map((p) => [p.id, p.uuid]));
            const nameById = Object.fromEntries((plans as any[]).map((p) => [p.id, p.name]));
            const rows = await Promise.all(coupons.map(async (c: any) => {
                const x = c.toJSON();
                const planIds: number[] = Array.isArray(c.get("plan_ids")) ? c.get("plan_ids") : [];
                const discountGiven = await SaasPayment.sum("discount", { where: { coupon_id: x.id, status: "paid" } });
                return {
                    id: x.uuid, code: x.code, description: x.description, kind: x.kind, value: x.value, max_discount: x.max_discount,
                    plan_ids: planIds.map((id) => uuidById[id]).filter(Boolean), plan_names: planIds.map((id) => nameById[id]).filter(Boolean),
                    billing: x.billing, valid_from: x.valid_from, valid_until: x.valid_until, max_uses: x.max_uses, per_agency_limit: x.per_agency_limit,
                    status: x.status, uses: await couponUses(x.id), discount_given: Number(discountGiven || 0) / 100, label: describeCoupon(x)?.label,
                };
            }));
            return returnHelper(res, 200, true, "Coupons", rows);
        } catch (error) {
            return fail(res, error, "listCoupons");
        }
    }

    // POST /saas_admin/coupons  and  /saas_admin/coupons/:uuid/update
    async saveCoupon(req: RequestWithUser, res: Response) {
        try {
            const b = req.body || {};
            const code = normalizeCode(b.code);
            if (code.length < 3) return returnHelper(res, 200, false, "Code needs at least 3 letters or numbers");
            const kind = b.kind === "flat" ? "flat" : "percent";
            const value = Math.round(Number(b.value));
            if (!Number.isFinite(value) || value < 1 || (kind === "percent" && value > 100) || value > 10000000) {
                return returnHelper(res, 200, false, kind === "percent" ? "Discount % must be between 1 and 100" : "Please enter a valid discount amount");
            }
            const intOrNull = (v: any, max: number) => {
                if (v === null || v === undefined || v === "") return null;
                const n = Math.round(Number(v));
                if (!Number.isFinite(n) || n < 1 || n > max) throw new SaasError("Please check the numbers you entered");
                return n;
            };
            const dateOrNull = (v: any, endOfDay = false) => {
                if (!v) return null;
                const d = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T23:59:59` : v);
                if (isNaN(d.getTime())) throw new SaasError("Please enter valid dates");
                return d;
            };
            const planUuids: string[] = Array.isArray(b.plan_ids) ? b.plan_ids : [];
            const plans: any[] = planUuids.length ? await SaasPlan.findAll({ where: { uuid: planUuids }, attributes: ["id"], raw: true }) : [];
            const data = {
                code, kind, value,
                description: b.description ? String(b.description).trim().slice(0, 255) : null,
                max_discount: kind === "percent" ? intOrNull(b.max_discount, 10000000) : null,
                plan_ids: plans.length ? plans.map((p) => p.id) : null,
                billing: ["monthly", "yearly"].includes(b.billing) ? b.billing : "any",
                valid_from: dateOrNull(b.valid_from), valid_until: dateOrNull(b.valid_until, true),
                max_uses: intOrNull(b.max_uses, 1000000),
                // not sent -> once per agency; sent empty -> no limit
                per_agency_limit: b.per_agency_limit === undefined ? 1 : intOrNull(b.per_agency_limit, 1000),
                status: b.status === "inactive" ? "inactive" : "active",
            };
            if (data.valid_from && data.valid_until && data.valid_until <= data.valid_from) return returnHelper(res, 200, false, "End date must be after the start date");
            const clash: any = await SaasCoupon.findOne({ where: { code }, paranoid: false });
            if (req.params.uuid) {
                const coupon: any = await SaasCoupon.findOne({ where: { uuid: req.params.uuid } });
                if (!coupon) return returnHelper(res, 200, false, "Coupon not found");
                if (clash && clash.dataValues.id !== coupon.dataValues.id) return returnHelper(res, 200, false, "Another coupon already uses this code");
                await coupon.update(data);
                return returnHelper(res, 200, true, "Coupon saved");
            }
            if (clash) return returnHelper(res, 200, false, "A coupon with this code already exists (codes can not be reused)");
            await SaasCoupon.create(data);
            return returnHelper(res, 200, true, `Coupon ${code} created`);
        } catch (error) {
            return fail(res, error, "saveCoupon");
        }
    }

    // POST /saas_admin/coupons/:uuid/delete  - used coupons are switched off instead, so reports keep their code
    async deleteCoupon(req: RequestWithUser, res: Response) {
        try {
            const coupon: any = await SaasCoupon.findOne({ where: { uuid: req.params.uuid } });
            if (!coupon) return returnHelper(res, 200, false, "Coupon not found");
            if (await couponUses(coupon.dataValues.id)) {
                await coupon.update({ status: "inactive" });
                return returnHelper(res, 200, true, "This coupon was already used, so it has been switched off instead of deleted");
            }
            await coupon.destroy();
            return returnHelper(res, 200, true, "Coupon deleted");
        } catch (error) {
            return fail(res, error, "deleteCoupon");
        }
    }

    // ---------------------------------------------------------------- Meta (Facebook Lead Ads)

    // GET /saas_admin/meta_settings
    async metaSettings(req: RequestWithUser, res: Response) {
        try {
            return returnHelper(res, 200, true, "Meta settings", await presentMetaSettings());
        } catch (error) {
            return fail(res, error, "metaSettings");
        }
    }

    // POST /saas_admin/meta_settings
    async saveMetaSettings(req: RequestWithUser, res: Response) {
        try {
            const data = await persistMetaSettings(req.body || {});
            const ready = data.configured?.facebook;
            return returnHelper(
                res,
                200,
                true,
                ready
                    ? "Meta settings saved. Agencies can connect Facebook Pages from Lead Sources."
                    : "Saved. Add App ID, App secret, and ensure PUBLIC_API_URL is set on the server to unlock Connect Facebook.",
                data,
            );
        } catch (error) {
            return fail(res, error, "saveMetaSettings");
        }
    }
}

export default new SaasAdminController();
