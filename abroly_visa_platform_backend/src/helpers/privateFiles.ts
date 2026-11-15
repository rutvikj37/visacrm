import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";

/**
 * Private files (student documents, payment proofs, lead reports).
 *
 * Files live in <project>/storage/<folder>, which is NOT served by express.static.
 * The API hands out short-lived signed links:
 *   /api/v1/files/<folder>/<name>?exp=<unix seconds>&sig=<hmac>
 * A link is only created inside API responses that already passed login + agency checks,
 * and it stops working after LINK_TTL_SECONDS.
 */

export const PRIVATE_FOLDERS = ["student_docs", "subscription_proof", "reports", "service_files"] as const;
export type PrivateFolder = typeof PRIVATE_FOLDERS[number];

const LINK_TTL_SECONDS = 60 * 60; // 1 hour

export const privateRoot = () => path.join(process.cwd(), "storage");
export const privateDir = (folder: PrivateFolder) => path.join(privateRoot(), folder);

const secret = () => `${process.env.FILE_SIGNING_KEY || process.env.ACCESS_TOKEN_SECRET || ""}:files`;

const apiBase = () => {
    if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/+$/, "");
    return `${(process.env.LOCAL_PATH || "").replace(/\/+$/, "")}/api`;
};

const sign = (folder: string, name: string, exp: number) =>
    crypto.createHmac("sha256", secret()).update(`${folder}/${name}:${exp}`).digest("hex");

/** Only plain file names (no folders, no "..") are ever accepted. */
const safeName = (name: string) => {
    const base = path.basename(String(name || ""));
    return base && base === name && !base.startsWith(".") ? base : null;
};

export const signedFileUrl = (folder: PrivateFolder, name?: string | null) => {
    const file = name ? safeName(name) : null;
    if (!file) return null;
    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    return `${apiBase()}/v1/files/${folder}/${encodeURIComponent(file)}?exp=${exp}&sig=${sign(folder, file, exp)}`;
};

/** Absolute path to write a new private file. */
export const privateFilePath = (folder: PrivateFolder, name: string) => {
    const file = safeName(name);
    if (!file) throw new Error("Invalid file name");
    fs.mkdirSync(privateDir(folder), { recursive: true });
    return path.join(privateDir(folder), file);
};

/** Find a file: private storage first, then the old public folder (until migrated). */
export const existingFilePath = (folder: PrivateFolder, name: string) => {
    const file = safeName(name);
    if (!file) return null;
    const candidates = [path.join(privateDir(folder), file), path.join(process.cwd(), "public", folder, file)];
    return candidates.find((p) => fs.existsSync(p)) || null;
};

/** GET /api/v1/files/:folder/:name - checks the signature and expiry, then streams the file. */
export const serveSignedFile = (req: Request, res: Response) => {
    const folder = String(req.params.folder || "") as PrivateFolder;
    const name = safeName(String(req.params.name || ""));
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig || "");
    if (!PRIVATE_FOLDERS.includes(folder) || !name || !exp || !/^[a-f0-9]{64}$/.test(sig)) return res.status(404).send("Not found");
    if (exp < Math.floor(Date.now() / 1000)) return res.status(410).send("This link has expired. Please open the document again from the app.");
    const expected = sign(folder, name, exp);
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return res.status(403).send("Invalid link");
    const filePath = existingFilePath(folder, name);
    if (!filePath) return res.status(404).send("Not found");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // open PDFs and images in the browser; download anything else (never render uploaded HTML / SVG)
    const inline = /\.(pdf|jpe?g|png|webp|gif)$/i.test(name);
    return res.sendFile(filePath, { headers: { "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"` } });
};

/** One-time move of files from public/<folder> to storage/<folder> (safe to run on every start). */
export const migratePublicFiles = () => {
    for (const folder of PRIVATE_FOLDERS) {
        const from = path.join(process.cwd(), "public", folder);
        if (!fs.existsSync(from)) continue;
        fs.mkdirSync(privateDir(folder), { recursive: true });
        let moved = 0;
        for (const file of fs.readdirSync(from)) {
            const src = path.join(from, file);
            const dest = path.join(privateDir(folder), file);
            try {
                if (!fs.statSync(src).isFile()) continue;
                if (!fs.existsSync(dest)) fs.renameSync(src, dest);
                else fs.unlinkSync(src);
                moved++;
            } catch (error) {
                console.error(`Could not move ${folder}/${file} to private storage`, error);
            }
        }
        if (moved) console.log(`🔒 Moved ${moved} file(s) from public/${folder} to private storage`);
    }
};
