import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { PRIVATE_FOLDERS, PrivateFolder, privateDir, existingLocalPath, safeName, isS3Key, validKey, redirectToS3 } from "./storage";

/**
 * Private files (student documents, payment proofs, lead reports, service files).
 *
 * Stored in S3 under agencies/<agency_uuid>/<folder>/ (see helpers/storage.ts), or for older
 * rows in <project>/storage/<folder> on local disk. Neither is public. The API hands out
 * short-lived signed links:
 *   /api/v1/files/<folder>/<name or s3 key>?exp=<unix seconds>&sig=<hmac>
 * A link is only created inside API responses that already passed login + agency checks,
 * and it stops working after LINK_TTL_SECONDS.
 */

export { PRIVATE_FOLDERS, privateDir };
export type { PrivateFolder };

const LINK_TTL_SECONDS = 60 * 60; // 1 hour

export const privateRoot = () => path.join(process.cwd(), "storage");

const secret = () => `${process.env.FILE_SIGNING_KEY || process.env.ACCESS_TOKEN_SECRET || ""}:files`;

const apiBase = () => {
    if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/+$/, "");
    return `${(process.env.LOCAL_PATH || "").replace(/\/+$/, "")}/api`;
};

const sign = (folder: string, name: string, exp: number) =>
    crypto.createHmac("sha256", secret()).update(`${folder}/${name}:${exp}`).digest("hex");

/** A stored value: a plain local file name, or an S3 key for this folder. */
const cleanRef = (folder: PrivateFolder, ref: string) => (isS3Key(ref) ? (validKey(folder, ref) ? ref : null) : safeName(ref));

export const signedFileUrl = (folder: PrivateFolder, ref?: string | null) => {
    const file = ref ? cleanRef(folder, ref) : null;
    if (!file) return null;
    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    const encoded = file.split("/").map(encodeURIComponent).join("/");
    return `${apiBase()}/v1/files/${folder}/${encoded}?exp=${exp}&sig=${sign(folder, file, exp)}`;
};

/** Absolute local path to write a new private file (local-disk mode only; prefer storage.saveFile). */
export const privateFilePath = (folder: PrivateFolder, name: string) => {
    const file = safeName(name);
    if (!file) throw new Error("Invalid file name");
    fs.mkdirSync(privateDir(folder), { recursive: true });
    return path.join(privateDir(folder), file);
};

/** Find a legacy local file: private storage first, then the old public folder. */
export const existingFilePath = (folder: PrivateFolder, name: string) => existingLocalPath(folder, name);

/** GET /api/v1/files/:folder/* - checks the signature and expiry, then sends the file. */
export const serveSignedFile = async (req: Request, res: Response) => {
    try {
        const folder = String(req.params.folder || "") as PrivateFolder;
        const raw = String((req.params as any)[0] || "");
        const exp = Number(req.query.exp);
        const sig = String(req.query.sig || "");
        if (!PRIVATE_FOLDERS.includes(folder) || !exp || !/^[a-f0-9]{64}$/.test(sig)) return res.status(404).send("Not found");
        const ref = cleanRef(folder, raw);
        if (!ref) return res.status(404).send("Not found");
        if (exp < Math.floor(Date.now() / 1000)) return res.status(410).send("This link has expired. Please open the document again from the app.");
        const expected = sign(folder, ref, exp);
        if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return res.status(403).send("Invalid link");

        res.setHeader("Cache-Control", "private, no-store");
        if (isS3Key(ref)) return await redirectToS3(res, ref, 5 * 60);

        const filePath = existingLocalPath(folder, ref);
        if (!filePath) return res.status(404).send("Not found");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const inline = /\.(pdf|jpe?g|png|webp|gif)$/i.test(ref);
        return res.sendFile(filePath, { headers: { "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ref.replace(/"/g, "")}"` } });
    } catch (error) {
        console.error("serveSignedFile", error);
        return res.status(404).send("Not found");
    }
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
