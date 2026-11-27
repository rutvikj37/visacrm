import crypto from "crypto";

/**
 * Small AES-256-GCM helper for secrets we must store (e.g. an agency's IndiaMART CRM key).
 *
 * Key: INTEGRATION_ENCRYPTION_KEY (any long random string). If it is missing we fall back to a key
 * derived from ACCESS_TOKEN_SECRET so local setups keep working - set a dedicated key in production.
 */
const getKey = (): Buffer => {
    const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
        throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured");
    }
    return crypto.createHash("sha256").update(secret).digest();
};

export const encryptJson = (value: unknown): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
};

export const decryptJson = <T = any>(payload: string | null | undefined): T | null => {
    if (!payload) return null;
    try {
        const [ivB64, tagB64, dataB64] = payload.split(".");
        const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
        decipher.setAuthTag(Buffer.from(tagB64, "base64"));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
        return JSON.parse(decrypted.toString("utf8")) as T;
    } catch (error) {
        console.error("Failed to decrypt integration credentials");
        return null;
    }
};

/** URL-safe random key for public webhook URLs. */
export const generatePublicKey = (): string => crypto.randomBytes(24).toString("hex");

/** Show only the last 4 characters of a secret. */
export const maskSecret = (value: string | null | undefined): string | null => {
    if (!value) return null;
    return value.length <= 4 ? "****" : `${"*".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
};

// ---------------------------------------------------------------- personal data (passport, PAN, bank)

/**
 * Personal IDs use their own key (DATA_ENCRYPTION_KEY) so rotating the integration key does not touch them.
 * Falls back to the integration key for local setups - set a dedicated key in production.
 */
const piiKey = (): Buffer => {
    const secret = process.env.DATA_ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY || process.env.ACCESS_TOKEN_SECRET;
    if (!secret) throw new Error("DATA_ENCRYPTION_KEY is not configured");
    return crypto.createHash("sha256").update(`pii:${secret}`).digest();
};

export const encryptPii = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", piiKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
};

export const decryptPii = (payload: string | null | undefined): string | null => {
    if (!payload) return null;
    try {
        const [ivB64, tagB64, dataB64] = payload.split(".");
        const decipher = crypto.createDecipheriv("aes-256-gcm", piiKey(), Buffer.from(ivB64, "base64"));
        decipher.setAuthTag(Buffer.from(tagB64, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
};
