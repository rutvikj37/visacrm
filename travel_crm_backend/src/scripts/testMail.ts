import dotenv from "dotenv";
dotenv.config();

/**
 * Send a test email with the current mail settings (Resend when RESEND_API_KEY is set, else SMTP_*).
 *   npm run mail:test -- you@example.com
 */
const main = async () => {
    const to = process.argv[2];
    if (!to) {
        console.error("Usage: npm run mail:test -- you@example.com");
        process.exit(1);
    }
    const { sendMail } = await import("../services/mailer");
    const via = process.env.RESEND_API_KEY ? "Resend" : process.env.SMTP_HOST ? `SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}` : "Gmail SMTP";
    console.log(`Sending via ${via} from ${process.env.MAIL_FROM || process.env.SMTP_EMAIL || "(no MAIL_FROM)"} to ${to}...`);
    const ok = await sendMail(to, "TechX CRM test email", `This is a test email sent ${new Date().toLocaleString()} via ${via}. If you can read this, email is working.`, null, { name: "TechX CRM", color: "#0f5bd8" });
    console.log(ok ? "Sent." : "Not sent - see the error above.");
    process.exit(ok ? 0 : 1);
};

main();
