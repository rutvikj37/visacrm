import crypto from "crypto";
import bcrypt from "bcrypt";
import Jwt from "jsonwebtoken";
import Agent from "../model/Agent";
import User from "../model/User";
import Admin from "../model/Admin";
import { sendMail } from "./mailer";
import { getPlatformBilling } from "./saasBilling";
import { sharedPanel } from "./panelUrl";

/**
 * Login codes / personal passcodes for agency users and students.
 *
 * Invite / welcome: admin or agency emails a random 6-digit code (stored as bcrypt in login_pin,
 * passcode_set=false). First successful login returns a short-lived setup token so the user must
 * set their own 4–6 digit passcode before getting a normal session JWT.
 *
 * Daily login: once passcode_set=true, phone + personal passcode (same login_pin column).
 *
 * Forgot: email a short-lived reset code (not the passcode) → verify → setup token → set passcode.
 */

export const LOGIN_CODE_LENGTH = 6;
export const PASSCODE_MIN = 4;
export const PASSCODE_MAX = 6;
/** New passcodes must be 6 digits (4–5 digit passcodes set earlier still work at login). */
export const NEW_PASSCODE_MIN = 6;
/** returned as the "verificationId" by login_with_number so the panel shows invite-code boxes */
export const LOGIN_CODE_MARKER = "LOGIN_CODE";
/** returned when the account already has a personal passcode */
export const PASSCODE_MARKER = "PASSCODE";
/**
 * Old shared admin code. No longer accepted: anyone who knew an admin's phone number could log in.
 * Admins now get a random code from `npm run admin:code`, or a secret ADMIN_LOGIN_OTP in .env.
 */
const LEGACY_ADMIN_OTP = "111111";
const adminEnvOtp = () => String(process.env.ADMIN_LOGIN_OTP || "").replace(/\D/g, "");
const RESET_MINUTES = 15;
const SETUP_TOKEN_MINUTES = 30;

const secretTokenForJWT: string = process.env.ACCESS_TOKEN_SECRET || "";

const newCode = (len = LOGIN_CODE_LENGTH) =>
    String(crypto.randomInt(0, 10 ** len)).padStart(len, "0");

// Agency users (Agent) and students (User) share the same pin / reset columns and rules.
type CodeModel = typeof Agent | typeof User | typeof Admin;

const supportsPasscodeFlow = (model: CodeModel) => model !== Admin;

const setCodeOn = async (model: CodeModel, id: number) => {
    const code = newCode();
    const patch: Record<string, unknown> = {
        login_pin: await bcrypt.hash(code, 10),
        login_pin_attempts: 0,
        login_pin_locked_until: null,
    };
    if (supportsPasscodeFlow(model)) {
        // invite / welcome code — user must set a personal passcode after first login
        patch.passcode_set = false;
        patch.login_reset_code = null;
        patch.login_reset_expires = null;
    }
    await (model as any).update(patch, { where: { id } });
    return code;
};

const usesCodeOn = async (model: CodeModel, id: number) => {
    const attrs = supportsPasscodeFlow(model) ? ["login_pin", "passcode_set"] : ["login_pin"];
    const row: any = await (model as any).scope("withLoginPin").findOne({ where: { id }, attributes: attrs });
    return Boolean(row?.dataValues?.login_pin);
};

const hasPasscodeOn = async (model: CodeModel, id: number) => {
    if (!supportsPasscodeFlow(model)) return false;
    const row: any = await (model as any).scope("withLoginPin").findOne({
        where: { id },
        attributes: ["login_pin", "passcode_set"],
    });
    return Boolean(row?.dataValues?.login_pin && row?.dataValues?.passcode_set);
};

/**
 * Check a code typed at login.
 * - { applies: false }               the account has no fixed code: use the normal OTP flow
 * - { applies: true, ok: true, passcodeSet }  correct
 * - { applies: true, ok: false, message }  wrong code (no account lockout)
 */
const checkCodeOn = async (model: CodeModel, id: number, code: unknown) => {
    const attrs = ["id", "login_pin", "login_pin_attempts", "login_pin_locked_until"];
    if (supportsPasscodeFlow(model)) attrs.push("passcode_set");
    const row: any = await (model as any).scope("withLoginPin").findOne({ where: { id }, attributes: attrs });
    const hash = row?.dataValues?.login_pin;
    if (!hash) return { applies: false as const };

    // Admin CLI codes stay invite-style (always 6 digits). Agency/student: personal passcode once set.
    const passcodeSet = supportsPasscodeFlow(model) ? Boolean(row.dataValues.passcode_set) : false;
    const typed = String(code ?? "").replace(/\D/g, "");
    const lenOk = passcodeSet
        ? typed.length >= PASSCODE_MIN && typed.length <= PASSCODE_MAX
        : typed.length === LOGIN_CODE_LENGTH;

    if (lenOk && (await bcrypt.compare(typed, hash))) {
        // Clear any legacy lock fields left from the old 5-attempt lockout.
        if (row.dataValues.login_pin_attempts || row.dataValues.login_pin_locked_until) {
            await (model as any).update({ login_pin_attempts: 0, login_pin_locked_until: null }, { where: { id } });
        }
        return { applies: true as const, ok: true, passcodeSet };
    }

    const label = passcodeSet ? "passcode" : "login code";
    return {
        applies: true as const,
        ok: false,
        passcodeSet,
        message: `Wrong ${label}.`,
    };
};

/** Create (or replace) an agency user's invite login code. Returns the plain code - send it, never store it. */
export const setLoginCode = (agencyUserId: number) => setCodeOn(Agent, agencyUserId);
/** Does this agency user log in with a fixed code / passcode (instead of an SMS OTP)? */
export const usesLoginCode = (agencyUserId: number) => usesCodeOn(Agent, agencyUserId);
export const agentHasPasscode = (agencyUserId: number) => hasPasscodeOn(Agent, agencyUserId);
export const checkLoginCode = (agencyUserId: number, code: unknown) => checkCodeOn(Agent, agencyUserId, code);

/** Students (portal) - same rules. */
export const setStudentLoginCode = (studentId: number) => setCodeOn(User, studentId);
export const studentUsesLoginCode = (studentId: number) => usesCodeOn(User, studentId);
export const studentHasPasscode = (studentId: number) => hasPasscodeOn(User, studentId);
export const checkStudentLoginCode = (studentId: number, code: unknown) => checkCodeOn(User, studentId, code);

/** Platform admins: a random 6-digit code per admin (replaces the previous one). Returns the plain code once. */
export const setAdminLoginCode = (adminId: number) => setCodeOn(Admin, adminId);
/** Admins always log in with their code (never SMS). */
export const adminUsesLoginCode = async (_adminId: number) => true;
export const checkAdminLoginCode = async (adminId: number, code: unknown) => {
    const typed = String(code ?? "").replace(/\D/g, "");
    const envOtp = adminEnvOtp();
    if (typed === LEGACY_ADMIN_OTP && envOtp !== LEGACY_ADMIN_OTP) {
        return { applies: true as const, ok: false, passcodeSet: false, message: "This admin code is no longer valid. Run npm run admin:code on the server for a new one." };
    }
    if (envOtp.length >= 6 && typed === envOtp) {
        await (Admin as any).update(
            { login_pin_attempts: 0, login_pin_locked_until: null },
            { where: { id: adminId } },
        );
        return { applies: true as const, ok: true, passcodeSet: false };
    }
    const viaPin = await checkCodeOn(Admin, adminId, code);
    if (viaPin.applies) return viaPin;
    return {
        applies: true as const,
        ok: false,
        passcodeSet: false,
        message: "Wrong login code.",
    };
};

export type PasscodeAudience = "agent" | "student";

/** Short-lived token used only to set / reset a passcode (not a session JWT). */
export const issueSetupToken = (opts: { audience: PasscodeAudience; id: number; uuid: string }) => {
    if (!secretTokenForJWT) throw new Error("ACCESS_TOKEN_SECRET is not configured");
    return Jwt.sign(
        { purpose: "set_passcode", audience: opts.audience, id: opts.id, uuid: opts.uuid },
        secretTokenForJWT,
        { expiresIn: `${SETUP_TOKEN_MINUTES}m` },
    );
};

export const verifySetupToken = (token: unknown, audience: PasscodeAudience) => {
    if (!token || typeof token !== "string") return null;
    try {
        const decoded: any = Jwt.verify(token, secretTokenForJWT);
        if (decoded?.purpose !== "set_passcode" || decoded?.audience !== audience) return null;
        if (!decoded.id || !decoded.uuid) return null;
        return { id: Number(decoded.id), uuid: String(decoded.uuid) };
    } catch {
        return null;
    }
};

const normalizePasscode = (code: unknown) => String(code ?? "").replace(/\D/g, "");

export const validatePasscodeShape = (passcode: unknown, confirm?: unknown) => {
    const pin = normalizePasscode(passcode);
    if (pin.length < NEW_PASSCODE_MIN || pin.length > PASSCODE_MAX) {
        return { ok: false as const, message: `Passcode must be ${PASSCODE_MAX} digits.` };
    }
    if (confirm !== undefined && normalizePasscode(confirm) !== pin) {
        return { ok: false as const, message: "Passcodes do not match." };
    }
    return { ok: true as const, pin };
};

const setPersonalPasscodeOn = async (model: CodeModel, id: number, pin: string) => {
    await (model as any).update(
        {
            login_pin: await bcrypt.hash(pin, 10),
            login_pin_attempts: 0,
            login_pin_locked_until: null,
            passcode_set: true,
            login_reset_code: null,
            login_reset_expires: null,
        },
        { where: { id } },
    );
};

export const setAgentPasscode = (id: number, pin: string) => setPersonalPasscodeOn(Agent, id, pin);
export const setStudentPasscode = (id: number, pin: string) => setPersonalPasscodeOn(User, id, pin);

const issueResetOn = async (model: CodeModel, id: number) => {
    const code = newCode(LOGIN_CODE_LENGTH);
    await (model as any).update(
        {
            login_reset_code: await bcrypt.hash(code, 10),
            login_reset_expires: new Date(Date.now() + RESET_MINUTES * 60000),
        },
        { where: { id } },
    );
    return code;
};

const checkResetOn = async (model: CodeModel, id: number, code: unknown) => {
    const row: any = await (model as any).scope("withLoginPin").findOne({
        where: { id },
        attributes: ["id", "login_reset_code", "login_reset_expires"],
    });
    const hash = row?.dataValues?.login_reset_code;
    const expires = row?.dataValues?.login_reset_expires ? new Date(row.dataValues.login_reset_expires) : null;
    if (!hash || !expires) return { ok: false as const, message: "No reset code requested. Request a new one." };
    if (expires < new Date()) return { ok: false as const, message: "That reset code has expired. Request a new one." };
    const typed = String(code ?? "").replace(/\D/g, "");
    if (typed.length !== LOGIN_CODE_LENGTH || !(await bcrypt.compare(typed, hash))) {
        return { ok: false as const, message: "Wrong reset code." };
    }
    // one-time use
    await (model as any).update({ login_reset_code: null, login_reset_expires: null }, { where: { id } });
    return { ok: true as const };
};

export const issueAgentResetCode = (id: number) => issueResetOn(Agent, id);
export const issueStudentResetCode = (id: number) => issueResetOn(User, id);
export const checkAgentResetCode = (id: number, code: unknown) => checkResetOn(Agent, id, code);
export const checkStudentResetCode = (id: number, code: unknown) => checkResetOn(User, id, code);

/** Marker + copy for the login step after phone submit. */
export const loginCodePrompt = async (model: "agent" | "student", id: number) => {
    const has = model === "agent" ? await agentHasPasscode(id) : await studentHasPasscode(id);
    if (has) {
        return {
            marker: PASSCODE_MARKER,
            message: "Enter your passcode.",
        };
    }
    return {
        marker: LOGIN_CODE_MARKER,
        message:
            model === "agent"
                ? "Enter the 6-digit login code from your welcome email."
                : "Enter the 6-digit login code you were given.",
    };
};

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
    /** the agency's own panel, e.g. https://rutvik.techxsolutions.io/agency (default: AGENCY_PANEL_URL) */
    panelBase?: string | null;
}) => {
    const billing = await getPlatformBilling().catch(() => null);
    const panel = (opts.panelBase || sharedPanel()).replace(/\/+$/, "");
    const loginUrl = panel ? `${panel}/login` : "";
    const support = [billing?.phone, billing?.email].filter(Boolean).join(" · ");
    const agency = opts.agencyName && opts.agencyName !== opts.ownerName ? ` for ${opts.agencyName}` : "";
    const team = opts.invitedBy !== undefined && opts.invitedBy !== null;
    const teamName = opts.agencyName || opts.invitedBy || "your agency";

    const subject = opts.reset
        ? "Your new TechX CRM login code"
        : team
          ? `You've been added to ${teamName} on TechX CRM`
          : "Welcome to TechX CRM - your login details";
    const intro = opts.reset
        ? `Hi ${opts.ownerName},\n\nHere is your new login code for ${team ? `${teamName}'s` : "your"} TechX CRM agency panel${team ? "" : agency}. Your old invite code no longer works.`
        : team
          ? `Hi ${opts.ownerName},\n\n${opts.invitedBy || "Your agency owner"} added you to the ${teamName} team on TechX CRM. You can now log in to the agency panel.`
          : `Hi ${opts.ownerName},\n\nYour TechX CRM agency panel${agency} is ready.` +
            (opts.trialDays ? ` You have a ${opts.trialDays}-day free trial.` : "");
    const steps =
        `\n\nHow to log in:\n` +
        `1. Open ${loginUrl || "the agency panel"}\n` +
        `2. Enter your mobile number: ${opts.phone}\n` +
        `3. Enter your 6-digit login code: ${opts.code}\n` +
        `4. On first login, set your own passcode (4–6 digits) for future sign-ins\n\n` +
        `Keep this code private - anyone with your mobile number and this code can open your panel. ` +
        (team
            ? `If you lose it before setting a passcode, ask ${opts.invitedBy || "your agency owner"} to send you a new one.`
            : `If you lose it before setting a passcode, ask us for a new one. After you set a passcode, use Forgot passcode on the login screen.`) +
        (support ? `\n\nNeed help? ${support}` : "");

    const card =
        `<table role="presentation" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;width:100%">` +
        `<tr><td style="padding:12px 16px;color:#555;font-size:13px">Mobile number</td><td style="padding:12px 16px;font-weight:bold;font-size:15px">${escapeHtml(opts.phone)}</td></tr>` +
        `<tr><td style="padding:12px 16px;color:#555;font-size:13px;border-top:1px solid #e5e7eb">Login code</td>` +
        `<td style="padding:12px 16px;border-top:1px solid #e5e7eb"><span style="font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:6px">${escapeHtml(opts.code)}</span></td></tr>` +
        `</table>` +
        `<p style="color:#555;font-size:13px;margin:0">After you log in once, you will set a personal passcode for everyday use.</p>`;

    return sendMail(
        opts.to,
        subject,
        intro + steps,
        loginUrl ? { label: "Open agency panel", url: loginUrl } : null,
        { name: "TechX CRM", color: "#0f5bd8", footer: support || null },
        card,
    );
};

/** Email a short-lived passcode-reset code (not the permanent passcode). */
export const sendPasscodeResetEmail = async (opts: {
    to: string;
    name: string;
    phone: string;
    code: string;
    /** agency panel or student portal login URL */
    loginUrl?: string | null;
    panelLabel?: string;
    brandName?: string | null;
}) => {
    const label = opts.panelLabel || "panel";
    const subject = "Reset your TechX CRM passcode";
    const text =
        `Hi ${opts.name},\n\n` +
        `You asked to reset the passcode for ${opts.phone} on the TechX CRM ${label}.\n\n` +
        `Your reset code (valid for ${RESET_MINUTES} minutes): ${opts.code}\n\n` +
        `Enter this code on the login screen, then choose a new 4–6 digit passcode.\n\n` +
        `If you did not request this, you can ignore this email.`;
    const card =
        `<table role="presentation" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;width:100%">` +
        `<tr><td style="padding:12px 16px;color:#555;font-size:13px">Mobile number</td><td style="padding:12px 16px;font-weight:bold;font-size:15px">${escapeHtml(opts.phone)}</td></tr>` +
        `<tr><td style="padding:12px 16px;color:#555;font-size:13px;border-top:1px solid #e5e7eb">Reset code</td>` +
        `<td style="padding:12px 16px;border-top:1px solid #e5e7eb"><span style="font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:6px">${escapeHtml(opts.code)}</span></td></tr>` +
        `</table>` +
        `<p style="color:#555;font-size:13px;margin:0">This code expires in ${RESET_MINUTES} minutes and is not your permanent passcode.</p>`;

    return sendMail(
        opts.to,
        subject,
        text,
        opts.loginUrl ? { label: `Open ${label}`, url: opts.loginUrl } : null,
        { name: opts.brandName || "TechX CRM", color: "#0f5bd8" },
        card,
    );
};
