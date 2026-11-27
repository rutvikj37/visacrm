import fs from "fs";
import path from "path";

/**
 * Ask the server to set up HTTPS for agency addresses right away.
 *
 * deploy/auto-certs.sh issues the certificate and Nginx site for every agency address. It runs every
 * minute, and also the moment this file changes (systemd path unit visacrm-certs.path), so a new or
 * changed agency address gets its certificate within seconds instead of up to a minute or more.
 * No-op in local dev or when the folder doesn't exist (server not set up for it).
 */
const TRIGGER_FILE = process.env.CERT_TRIGGER_FILE || "/var/lib/visacrm-certs/trigger";

export const requestCertificates = () => {
    if (process.env.ISLOCAL === "yes") return;
    try {
        if (!fs.existsSync(path.dirname(TRIGGER_FILE))) return;
        fs.writeFileSync(TRIGGER_FILE, `${new Date().toISOString()}\n`);
    } catch {
        /* the every-minute run picks it up anyway */
    }
};

/** Fields of an agency that decide its web address or whether it is served */
export const PORTAL_FIELDS = ["sudomain", "domain", "status", "deletedAt"];

/** Run after the change is committed (the certificate job reads the database), or now if there is no transaction. */
export const requestCertificatesAfter = (options: any) => {
    const t = options?.transaction;
    if (t && typeof t.afterCommit === "function") t.afterCommit(() => requestCertificates());
    else requestCertificates();
};
