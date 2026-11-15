import crypto from "crypto";
import bcrypt from "bcrypt";
import Agent from "../model/Agent";
import User from "../model/User";
import Admin from "../model/Admin";
import { sendMail } from "./mailer";
import { getPlatformBilling } from "./saasBilling";

/**
 * Fixed login code for agency owners.
 *
 * When the platform admin creates an agency, the owner gets a random 6-digit code by email.
 * They log in with their mobile number + this code instead of an SMS OTP. The code is stored
 * as a bcrypt hash (like a password), so it can't be shown again - the admin can only send a new one.
 * Wrong codes are counted: after MAX_ATTEMPTS the code is locked for LOCK_MINUTES.
 */

export const LOGIN_CODE_LENGTH = 6;
/** returned as the "verificationId" by login_with_number so the panel shows the code boxes, not an SMS prompt */
export const LOGIN_CODE_MARKER = "LOGIN_CODE";
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const newCode = () => String(crypto.randomInt(0, 10 ** LOGIN_CODE_LENGTH)).padStart(LOGIN_CODE_LENGTH, "0");

// Agency users (Agent) and students (User) share the same three columns and rules.
type CodeModel = typeof Agent | typeof User | typeof Admin;

const setCodeOn = async (model: CodeModel, id: number) => {
    const code = newCode();
    await (model as any).update(
        { login_pin: await bcrypt.hash(code, 10), login_pin_attempts: 0, login_pin_locked_until: null },
        { where: { id } },
    );
    return code;
};

const usesCodeOn = async (model: CodeModel, id: number) => {
    const row: any = await (model as any).scope("withLoginPin").findOne({ where: { id }, attributes: ["login_pin"] });
    return Boolean(row?.dataValues?.login_pin);
};

/**
 * Check a code typed at login.
 * - { applies: false }               the account has no fixed code: use the normal OTP flow
 * - { applies: true, ok: true }      correct
 * - { applies: true, ok: false, message }  wrong / locked
 */
const checkCodeOn = async (model: CodeModel, id: number, code: unknown) => {
    const row: any = await (model as any).scope("withLoginPin").findOne({
        where: { id },
        attributes: ["id", "login_pin", "login_pin_attempts", "login_pin_locked_until"],
    });
    const hash = row?.dataValues?.login_pin;
    if (!hash) return { applies: false as const };

    const lockedUntil = row.dataValues.login_pin_locked_until ? new Date(row.dataValues.login_pin_locked_until) : null;
    if (lockedUntil && lockedUntil > new Date()) {
        const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        return { applies: true as const, ok: false, message: `Too many wrong codes. Try again in ${mins} minute(s), or ask for a new code.` };
    }

    const typed = String(code ?? "").replace(/\D/g, "");
    if (typed.length === LOGIN_CODE_LENGTH && (await bcrypt.compare(typed, hash))) {
        if (row.dataValues.login_pin_attempts || lockedUntil) {
            await (model as any).update({ login_pin_attempts: 0, login_pin_locked_until: null }, { where: { id } });
        }
        return { applies: true as const, ok: true };
    }

    const attempts = Number(row.dataValues.login_pin_attempts || 0) + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await (model as any).update(
        { login_pin_attempts: lock ? 0 : attempts, login_pin_locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null },
        { where: { id } },
    );
    return {
        applies: true as const,
        ok: false,
        message: lock
            ? `Too many wrong codes. Login is locked for ${LOCK_MINUTES} minutes.`
            : `Wrong login code. ${MAX_ATTEMPTS - attempts} attempt(s) left.`,
    };
};

/** Create (or replace) an agency user's login code. Returns the plain code - send it, never store it. */
export const setLoginCode = (agencyUserId: number) => setCodeOn(Agent, agencyUserId);
/** Does this agency user log in with a fixed code (instead of an SMS OTP)? */
export const usesLoginCode = (agencyUserId: number) => usesCodeOn(Agent, agencyUserId);
export const checkLoginCode = (agencyUserId: number, code: unknown) => checkCodeOn(Agent, agencyUserId, code);

/** Students (portal) - same rules; used for demo students who can't receive an SMS. */
export const setStudentLoginCode = (studentId: number) => setCodeOn(User, studentId);
export const studentUsesLoginCode = (studentId: number) => usesCodeOn(User, studentId);
export const checkStudentLoginCode = (studentId: number, code: unknown) => checkCodeOn(User, studentId, code);

/** Platform admins - fixed code, created / replaced with `npm run admin:code -- <mobile>`. */
export const setAdminLoginCode = (adminId: number) => setCodeOn(Admin, adminId);
export const adminUsesLoginCode = (adminId: number) => usesCodeOn(Admin, adminId);
export const checkAdminLoginCode = (adminId: number, code: unknown) => checkCodeOn(Admin, adminId, code);

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/**
 * Welcome email (or "new login code" email) with the panel address, mobile number and login code.
 * Returns true if it was sent.
 */
export const sendLoginEmail = async (opts: {
    to: string;
    /** the person receiving the email (agency owner or team member) */
    ownerName: string;
    agencyName?: string | null;
    phone: string;
    code: string;
    trialDays?: number;
    reset?: boolean;
    /** team member invited by an agency owner: who invited them (owner's name) */
    invitedBy?: string | null;
}) => {
    const billing = await getPlatformBilling().catch(() => null);
    const panel = (process.env.AGENCY_PANEL_URL || "").replace(/\/+$/, "");
    const loginUrl = panel ? `${panel}/login` : "";
    const support = [billing?.phone, billing?.email].filter(Boolean).join(" · ");
    const agency = opts.agencyName && opts.agencyName !== opts.ownerName ? ` for ${opts.agencyName}` : "";
    const team = opts.invitedBy !== undefined && opts.invitedBy !== null;
    const teamName = opts.agencyName || opts.invitedBy || "your agency";

    const subject = opts.reset
        ? "Your new TechX CRM login code"
        : team ? `You've been added to ${teamName} on TechX CRM` : "Welcome to TechX CRM - your login details";
    const intro = opts.reset
        ? `Hi ${opts.ownerName},\n\nHere is your new login code for ${team ? `${teamName}'s` : "your"} TechX CRM agency panel${team ? "" : agency}. Your old code no longer works.`
        : team
            ? `Hi ${opts.ownerName},\n\n${opts.invitedBy || "Your agency owner"} added you to the ${teamName} team on TechX CRM. You can now log in to the agency panel.`
            : `Hi ${opts.ownerName},\n\nYour TechX CRM agency panel${agency} is ready.` +
              (opts.trialDays ? ` You have a ${opts.trialDays}-day free trial.` : "");
    const steps =
        `\n\nHow to log in:\n` +
        `1. Open ${loginUrl || "the agency panel"}\n` +
        `2. Enter your mobile number: ${opts.phone}\n` +
        `3. Enter your 6-digit login code: ${opts.code}\n\n` +
        `Keep this code private - anyone with your mobile number and this code can open your panel. ` +
        (team ? `If you lose it, ask ${opts.invitedBy || "your agency owner"} to send you a new one.` : `If you lose it, ask us for a new one.`) +
        (support ? `\n\nNeed help? ${support}` : "");

    const card =
        `<table role="presentation" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;width:100%">` +
        `<tr><td style="padding:12px 16px;color:#555;font-size:13px">Mobile number</td><td style="padding:12px 16px;font-weight:bold;font-size:15px">${escapeHtml(opts.phone)}</td></tr>` +
        `<tr><td style="padding:12px 16px;color:#555;font-size:13px;border-top:1px solid #e5e7eb">Login code</td>` +
        `<td style="padding:12px 16px;border-top:1px solid #e5e7eb"><span style="font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:6px">${escapeHtml(opts.code)}</span></td></tr>` +
        `</table>`;

    return sendMail(
        opts.to,
        subject,
        intro + steps,
        loginUrl ? { label: "Open agency panel", url: loginUrl } : null,
        { name: "TechX CRM", color: "#0f5bd8", footer: support || null },
        card,
    );
};
