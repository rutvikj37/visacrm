import crypto from "crypto";

/**
 * Time-based one-time codes (RFC 6238, 30 s, 6 digits, SHA-1) for the owner's two-step login.
 * Works with Google Authenticator, Microsoft Authenticator, Authy and others.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const newTotpSecret = () => {
    const bytes = crypto.randomBytes(20);
    let bits = "", out = "";
    for (const b of bytes) bits += b.toString(2).padStart(8, "0");
    for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
    return out;
};

const fromBase32 = (s: string) => {
    let bits = "";
    for (const c of s.replace(/=+$/, "").toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, "0"); }
    const out: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(out);
};

const codeAt = (secret: string, counter: number) => {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const h = crypto.createHmac("sha1", fromBase32(secret)).update(buf).digest();
    const o = h[h.length - 1] & 0xf;
    const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1_000_000).padStart(6, "0");
};

/** Accepts the current code and one step either side (clock drift). */
export const verifyTotp = (secret: string, code: unknown) => {
    const c = String(code ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(c)) return false;
    const now = Math.floor(Date.now() / 30000);
    return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(codeAt(secret, now + d)), Buffer.from(c)));
};

export const totpUri = (secret: string, label: string, issuer = "TechX CRM") =>
    `otpauth://totp/${encodeURIComponent(`${issuer}:${label}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
