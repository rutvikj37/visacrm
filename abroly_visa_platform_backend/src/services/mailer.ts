import nodemailer from "nodemailer";
import Agent from "../model/Agent";

/**
 * Outgoing email.
 *   RESEND_API_KEY                      - send through Resend (smtp.resend.com); takes priority over SMTP_*
 *   MAIL_FROM                           - sender address, e.g. no-reply@yourdomain.com
 *                                         (with Resend it must be on a domain verified in Resend)
 *   SMTP_EMAIL, SMTP_PASSWORD           - otherwise: any SMTP login (Gmail app password, Mailpit locally...)
 *   SMTP_HOST, SMTP_PORT (optional)     - default Gmail
 *   MAIL_FROM_NAME (optional)           - sender name
 * Without settings emails are skipped silently (in-app notifications still work).
 */
let transporter: nodemailer.Transporter | null = null;

const resendKey = () => (process.env.RESEND_API_KEY || "").trim();

const getTransporter = () => {
    if (transporter) return transporter;
    if (resendKey()) {
        // Resend SMTP: username is literally "resend", password is the API key
        transporter = nodemailer.createTransport({
            host: "smtp.resend.com",
            port: 465,
            secure: true,
            auth: { user: "resend", pass: resendKey() },
        });
        return transporter;
    }
    const user = process.env.SMTP_EMAIL;
    const pass = process.env.SMTP_PASSWORD;
    if (!user || !pass) return null;
    transporter = process.env.SMTP_HOST
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: { user, pass },
        })
        : nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    return transporter;
};

/**
 * Sender address: MAIL_FROM, else the SMTP login (Resend has no login address, so MAIL_FROM is required there).
 * MAIL_FROM may be just a domain ("mail.yourdomain.com") - then we send from no-reply@that-domain.
 */
const fromAddress = () => {
    const from = (process.env.MAIL_FROM || (resendKey() ? "" : process.env.SMTP_EMAIL) || "").trim().replace(/^<|>$/g, "");
    if (!from) return "";
    return from.includes("@") ? from : `no-reply@${from.replace(/^@/, "")}`;
};

export const mailEnabled = () => Boolean(resendKey() ? fromAddress() : process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export type MailBrand = { name?: string | null; color?: string | null; logo?: string | null; footer?: string | null };

/** The agency's own name, colour and logo for its emails (cached for 10 minutes). */
const brandCache = new Map<string, { brand: MailBrand; at: number }>();
export const agencyBrand = async (agencyUuid?: string | null): Promise<MailBrand | null> => {
    if (!agencyUuid) return null;
    const hit = brandCache.get(agencyUuid);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.brand;
    try {
        const a: any = await Agent.findOne({ where: { uuid: agencyUuid, role: "agent" }, attributes: ["app_name", "username", "primary_color", "favicon_url", "support_number", "support_email"], raw: true });
        if (!a) return null;
        const contact = [a.support_number, a.support_email].filter(Boolean).join(" · ");
        const brand: MailBrand = {
            name: a.app_name || a.username || null,
            color: /^#[0-9a-f]{6}$/i.test(String(a.primary_color || "")) ? a.primary_color : null,
            logo: /^https:\/\//i.test(String(a.favicon_url || "")) ? a.favicon_url : null,
            footer: contact || null,
        };
        brandCache.set(agencyUuid, { brand, at: Date.now() });
        return brand;
    } catch { return null; }
};

/** Readable text colour on the brand colour. */
const textOn = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? "#111111" : "#ffffff";
};

/**
 * Email with an optional button, in the agency's colours when `brand` is given
 * (logo + name at the top, coloured button, agency contact in the footer). Never throws.
 */
export const sendMail = async (to: string, subject: string, text: string, button?: { label: string; url: string } | null, brand?: MailBrand | null, extraHtml?: string) => {
    const t = getTransporter();
    if (!t || !to) return false;
    if (!fromAddress()) {
        console.error("Email skipped: set MAIL_FROM to an address on your Resend-verified domain");
        return false;
    }
    const color = brand?.color || "#0f5bd8";
    const name = brand?.name ? escapeHtml(brand.name) : "";
    const header = brand?.name || brand?.logo
        ? `<div style="display:flex;align-items:center;gap:10px;padding:14px 0 16px;border-bottom:3px solid ${color};margin-bottom:18px">` +
          (brand?.logo ? `<img src="${escapeHtml(brand.logo)}" alt="" width="36" height="36" style="border-radius:8px;object-fit:cover">` : `<span style="display:inline-block;width:36px;height:36px;border-radius:8px;background:${color};color:${textOn(color)};text-align:center;line-height:36px;font-weight:bold">${name.slice(0, 1).toUpperCase()}</span>`) +
          `<span style="font-size:16px;font-weight:bold;margin-left:10px">${name}</span></div>`
        : "";
    const html =
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#222">` + header +
        `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(subject)}</h2>` +
        `<p style="white-space:pre-line;line-height:1.5">${escapeHtml(text)}</p>` +
        (extraHtml || "") +
        (button ? `<p style="margin-top:20px"><a href="${escapeHtml(button.url)}" style="background:${color};color:${textOn(color)};padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(button.label)}</a></p>` : "") +
        `<p style="color:#888;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:12px">${brand?.name ? `${name}${brand.footer ? ` · ${escapeHtml(brand.footer)}` : ""}` : "You get this because email notifications are on in your CRM."}</p></div>`;
    try {
        const fromName = String(brand?.name || process.env.MAIL_FROM_NAME || "TechX CRM").replace(/["<>\r\n]/g, "").slice(0, 80);
        await t.sendMail({ from: `"${fromName}" <${fromAddress()}>`, to, subject, text, html });
        return true;
    } catch (error: any) {
        console.error("Email failed:", error?.message);
        return false;
    }
};

