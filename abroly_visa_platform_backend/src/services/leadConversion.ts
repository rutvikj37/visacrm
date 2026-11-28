import { Transaction } from "sequelize";
import sequelize from "../config/dbconfig";
import CrmLead from "../model/CrmLead";
import CrmLeadActivity from "../model/CrmLeadActivity";
import User from "../model/User";
import Agent from "../model/Agent";
import RaisedApplications from "../model/RaisedApplications";
import AgencyLeads from "../model/AgencyLeads";
import Step from "../model/Step";
import Question from "../model/Question";
import { TemplateStep } from "./visaTemplateLibrary";
import { agencyBrand, mailEnabled, sendMail } from "./mailer";
import {
    setStudentLoginCode,
    setStudentNoEmailLoginCode,
    STUDENT_NO_EMAIL_LOGIN_CODE,
    studentHasPasscode,
    studentUsesLoginCode,
} from "./agencyLogin";

/**
 * Lead -> visa case.
 *
 *   1. find or create the student (User) inside this agency, by phone
 *   2. create the application + visa case (AgencyLeads, status "visa_progress") so it shows up
 *      in the existing Visa Processing screens and in the student portal
 *   3. copy the chosen template into Steps + Questions
 *   4. mark the lead converted and log it
 * All in one database transaction.
 */

export class ConversionError extends Error { }

/** Copy a resolved visa template into Steps + Questions for one case. */
export const seedCaseStepsFromTemplate = async (opts: {
    template: { steps: TemplateStep[] };
    agencyId: number;
    studentId: number;
    caseId: number;
    userId: number;
    transaction?: Transaction;
}) => {
    const { template, agencyId, studentId, caseId, userId, transaction: t } = opts;
    let stepCount = 0;
    let questionCount = 0;
    for (const [index, step] of (template.steps || []).entries()) {
        const createdStep: any = await Step.create({
            agent_id: agencyId,
            student_id: studentId,
            lead_id: caseId,
            created_by_id: userId,
            step_title: step.title,
            step_description: step.description || null,
            step_order: index + 1,
            due_date: step.due_in_days !== null && step.due_in_days !== undefined
                ? new Date(Date.now() + Number(step.due_in_days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                : null,
        }, { transaction: t });
        stepCount++;
        if (step.questions?.length) {
            await Question.bulkCreate(step.questions.map((q) => ({
                step_id: createdStep.dataValues.id,
                student_id: String(studentId),
                agent_id: String(agencyId),
                created_by_agent_id: String(userId),
                question_text: q.text,
                question_type: q.type === "file_selector" ? "file_selector" : "text_input",
                status: "pending",
            })), { transaction: t });
            questionCount += step.questions.length;
        }
    }
    return { stepCount, questionCount };
};

export interface ConvertInput {
    agencyUuid: string;
    agencyId: number;      // Agent.id of the agency owner (Step.agent_id)
    userId: number;        // who converts
    lead: any;             // CrmLead instance
    country: string;
    intake?: string | null;
    visaType?: string | null;
    course?: string | null;
    university?: string | null;
    assignTo?: number | null; // Agent.id (team member) for the case
    branchId?: number | null; // branch that owns the case
    template?: { name: string; steps: TemplateStep[] } | null;
}

const splitIntake = (intake?: string | null) => {
    const value = (intake || "").trim();
    const year = value.match(/(20\d{2})/)?.[1] || "";
    const month = value.replace(year, "").trim();
    return { month, year };
};

export const convertLeadToCase = async (input: ConvertInput) => {
    const { agencyUuid, agencyId, userId, lead, template } = input;
    const l = lead.dataValues;

    if (l.status === "converted") throw new ConversionError("This lead is already converted");
    if (!l.phone_number) throw new ConversionError("Add the student's phone number first - they log in to the portal with it");
    const country = (input.country || "").trim();
    if (!country) throw new ConversionError("Please choose the visa country");

    const { month, year } = splitIntake(input.intake);
    const course = (input.course ?? l.interested_course ?? "") || null;
    const visaType = (input.visaType ?? l.visa_type ?? "") || null;

    return sequelize.transaction(async (t: Transaction) => {
        // 1. student (one per phone per agency)
        let student: any = await User.findOne({
            where: { phone_number: l.phone_number, country_code: l.country_code, agency_uuid: agencyUuid },
            transaction: t,
        });
        let studentCreated = false;
        if (!student) {
            student = await User.create({
                username: l.name || `Student ${l.phone_number}`,
                phone_number: l.phone_number,
                country_code: l.country_code,
                email: l.email,
                user_type: "user",
                agency_uuid: agencyUuid,
            }, { transaction: t });
            studentCreated = true;
        } else if (!student.dataValues.email && l.email) {
            await User.update({ email: l.email }, { where: { id: student.dataValues.id }, transaction: t });
        }
        const studentId = student.dataValues.id;

        let loginCode: string | null = null;
        const hasEmail = Boolean(String(l.email || student.dataValues.email || "").trim());
        if (!hasEmail && !(await studentHasPasscode(studentId))) {
            loginCode = await setStudentNoEmailLoginCode(studentId, t);
        }

        // 2. application + case (same shape as an offline lead, so existing screens work)
        const application: any = await RaisedApplications.create({
            country,
            fieldOfStudy: course,
            intake: input.intake || null,
            otherOption: visaType,
            student_id: studentId,
            status: "accepted",
        }, { transaction: t });

        const selection = {
            country,
            fieldOfStudy: course,
            intakeMonth: month,
            intakeYear: year,
            otherOption: visaType,
        };
        const visaCase: any = await AgencyLeads.create({
            agent_uuid: agencyUuid,
            raised_aplication_id: application.dataValues.id,
            user_id: studentId,
            status: "visa_progress",
            lead_type: "offline",
            suggestions: JSON.stringify([selection]),
            selected_suggestion: JSON.stringify(selection),
            selected_country: country,
            selected_intake_year: year || null,
            assign_id: input.assignTo || null,
            branch_id: input.branchId || null,
            case_stage: "documents",
            stage_updated_at: new Date(),
            university: input.university ? String(input.university).trim().slice(0, 255) : null,
            last_follow_up_remark: `Converted from CRM lead (${l.source})`,
        }, { transaction: t });
        const caseId = visaCase.dataValues.id;

        // 3. template -> steps + questions (only when the agency explicitly chose one)
        const seeded = template?.steps?.length
            ? await seedCaseStepsFromTemplate({ template, agencyId, studentId, caseId, userId, transaction: t })
            : { stepCount: 0, questionCount: 0 };
        const { stepCount, questionCount } = seeded;

        // 4. lead -> converted
        const now = new Date();
        await CrmLead.update({
            status: "converted",
            converted_at: now,
            converted_case_id: caseId,
            converted_student_id: studentId,
            next_follow_up_at: null,
            follow_up_note: null,
            last_activity_at: now,
        }, { where: { id: l.id }, transaction: t });
        await CrmLeadActivity.create({
            lead_id: l.id,
            agency_uuid: agencyUuid,
            type: "converted",
            message: `Converted to visa case for ${country}${template ? ` using "${template.name}" (${stepCount} steps)` : ""}`,
            created_by: userId,
            meta: { case_id: caseId, student_id: studentId, template: template?.name || null },
        }, { transaction: t });

        return { caseId, studentId, studentCreated, stepCount, questionCount, login_code: loginCode };
    });
};

/** Plain login code to show in the agency UI when the student has no email and still uses the default invite code. */
export const portalInviteLoginCode = async (lead: any) => {
    const l = lead.dataValues || lead;
    if (String(l.email || "").trim()) return null;
    const sid = Number(l.converted_student_id);
    if (!sid) return null;
    if (await studentHasPasscode(sid)) return null;
    if (!(await studentUsesLoginCode(sid))) return null;
    const row: any = await User.findByPk(sid, { attributes: ["email"] });
    if (String(row?.dataValues?.email || "").trim()) return null;
    return STUDENT_NO_EMAIL_LOGIN_CODE;
};

/** Link to the agency's branded student portal (resolved from its subdomain / domain). */
export const studentPortalUrl = async (agencyUuid: string) => {
    const agency: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["sudomain", "domain", "app_name", "username"] });
    const sub = agency?.dataValues?.sudomain;
    const domain = agency?.dataValues?.domain;
    let base = "";
    if (domain) base = `https://${sub ? `${sub}.` : ""}${domain}`;
    else if (process.env.STUDENT_PORTAL_URL) base = process.env.STUDENT_PORTAL_URL.replace(/\/+$/, "");
    return { base, agencyName: agency?.dataValues?.app_name || agency?.dataValues?.username || "our agency" };
};

/** Invite message + links the agency can send to the student (WhatsApp / copy / email). */
export const buildPortalInvite = async (agencyUuid: string, lead: any, country?: string | null, loginCode?: string | null) => {
    const l = lead.dataValues || lead;
    const { base, agencyName } = await studentPortalUrl(agencyUuid);
    const phone = `${l.country_code || ""} ${l.phone_number || ""}`.trim();
    const link = base ? `${base}/login?phone=${encodeURIComponent(l.phone_number || "")}` : "";
    const firstName = (l.name || "").split(" ")[0] || "there";
    const countryLabel = (country || l.interested_country || "").trim();
    const message =
        `Hi ${firstName}, welcome to ${agencyName}! ` +
        `Your ${countryLabel} visa process has started.`.replace("  ", " ") +
        (link ? ` Track your progress and upload documents here: ${link} ` : " ") +
        (loginCode
            ? `Log in with mobile number ${phone} and login code ${loginCode}. On first login, set your own passcode.`
            : `Log in with your mobile number ${phone} (we will send you an OTP).`);
    const digits = (l.phone_normalized || "").replace(/\D/g, "");
    return {
        portal_url: link || null,
        message,
        whatsapp_url: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null,
        email: l.email || null,
        // kept for fallback / copy; the agency panel sends via POST .../invite/email (Resend)
        email_url: l.email ? `mailto:${l.email}?subject=${encodeURIComponent(`Your visa process with ${agencyName}`)}&body=${encodeURIComponent(message)}` : null,
        portal_configured: Boolean(base),
        email_available: mailEnabled(),
        agency_name: agencyName,
        subject: `Your visa process with ${agencyName}`,
        login_code: loginCode || null,
        phone,
    };
};

/**
 * Email the student portal invite through the platform mailer (Resend when RESEND_API_KEY is set).
 * Returns { sent, reason?, invite } — never throws for mail failures.
 */
export const sendPortalInviteEmail = async (agencyUuid: string, lead: any, country?: string | null) => {
    const invite = await buildPortalInvite(agencyUuid, lead, country);
    const to = (invite.email || "").trim();
    if (!to) return { sent: false, reason: "This lead has no email address. Add one, then send the invite.", invite };
    if (!mailEnabled()) {
        return {
            sent: false,
            reason: "Email sending is not set up yet. Set RESEND_API_KEY and MAIL_FROM (or SMTP_*) on the server.",
            invite,
        };
    }
    const l = lead.dataValues || lead;
    const firstName = (l.name || "").split(" ")[0] || "there";
    const phone = `${l.country_code || ""} ${l.phone_number || ""}`.trim();
    const countryLabel = (country || l.interested_country || "").trim();
    const agencyName = invite.agency_name || "our agency";
    // a fresh 6-digit login code for the student (no SMS needed); sending the invite again replaces it
    const student: any = l.converted_student_id
        ? await User.findByPk(l.converted_student_id, { attributes: ["id"] })
        : await User.findOne({ where: { phone_number: l.phone_number, country_code: l.country_code, agency_uuid: agencyUuid }, attributes: ["id"] });
    const code = student ? await setStudentLoginCode(student.dataValues.id) : null;
    const text =
        `Hi ${firstName},\n\n` +
        `Welcome to ${agencyName}! Your ${countryLabel} visa process has started.\n\n` +
        (invite.portal_url
            ? `Track your progress, upload documents and pay fees in the student portal:\n${invite.portal_url}\n\n`
            : "Your agency will share the student portal link with you.\n\n") +
        (code
            ? `How to log in:\n1. Enter your mobile number: ${phone || "(the number on file)"}\n2. Enter your 6-digit login code: ${code}\n3. On first login, set your own passcode (4–6 digits) for future sign-ins\n\nKeep this code private. If you lose it before setting a passcode, ask ${agencyName} to send the invite again. After you set a passcode, use Forgot passcode on the login screen.\n\n`
            : `Log in with your mobile number ${phone || "(the number on file)"}.\n\n`) +
        `If you did not expect this email, you can ignore it.`;
    const card = code
        ? `<table role="presentation" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;width:100%">` +
          `<tr><td style="padding:12px 16px;color:#555;font-size:13px">Mobile number</td><td style="padding:12px 16px;font-weight:bold;font-size:15px">${phone}</td></tr>` +
          `<tr><td style="padding:12px 16px;color:#555;font-size:13px;border-top:1px solid #e5e7eb">Login code</td>` +
          `<td style="padding:12px 16px;border-top:1px solid #e5e7eb"><span style="font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:6px">${code}</span></td></tr></table>` +
          `<p style="color:#555;font-size:13px;margin:0">After you log in once, you will set a personal passcode for everyday use.</p>`
        : undefined;
    const brand = await agencyBrand(agencyUuid);
    const sent = await sendMail(
        to,
        invite.subject || `Your visa process with ${agencyName}`,
        text,
        invite.portal_url ? { label: "Open student portal", url: invite.portal_url } : null,
        brand || { name: agencyName },
        card,
    );
    return {
        sent,
        reason: sent ? undefined : "Could not send the invite email. Check Resend / mail settings, or use WhatsApp / copy instead.",
        invite,
    };
};
