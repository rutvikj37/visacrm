import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAgencyUuidFromRequest } from "./tenant";

/**
 * File storage for every upload (documents, images, videos, reports).
 *
 * With AWS_S3_BUCKET set, files go to S3, one folder per agency:
 *
 *   agencies/<agency_uuid>/student_docs/...       private (signed links only)
 *   agencies/<agency_uuid>/lead_files/...         CRM lead attachments (e.g. WhatsApp)
 *   agencies/<agency_uuid>/subscription_proof/...
 *   agencies/<agency_uuid>/reports/...
 *   agencies/<agency_uuid>/service_files/...
 *   agencies/<agency_uuid>/profiles/...            public images (logos, profile photos)
 *   agencies/<agency_uuid>/certificates/...
 *   agencies/<agency_uuid>/event_images/...
 *   platform/<folder>/...                          uploads by the platform admin (courses, banners, testimonials...)
 *
 * The database keeps the S3 key (it contains "/"). Rows saved before S3 was switched on keep a
 * plain file name and are still served from local disk, so nothing needs migrating.
 * Without AWS_S3_BUCKET everything stays on local disk exactly as before.
 *
 * The bucket stays fully private (Block Public Access on). The API hands out short-lived
 * presigned links; set AWS_S3_PUBLIC_URL (e.g. a CloudFront domain) to link public images directly.
 */

export const PRIVATE_FOLDERS = ["student_docs", "subscription_proof", "reports", "service_files", "travel_docs", "lead_files"] as const;
export const PUBLIC_FOLDERS = [
    "profiles", "certificates", "event_images", "courses", "course_chapter_items",
    "testimonials", "banners", "service_info", "content_writing_files", "travel_media",
] as const;
export type PrivateFolder = typeof PRIVATE_FOLDERS[number];
export type PublicFolder = typeof PUBLIC_FOLDERS[number];
export type StorageFolder = PrivateFolder | PublicFolder;

const isPrivateFolder = (folder: string): folder is PrivateFolder => (PRIVATE_FOLDERS as readonly string[]).includes(folder);
const isPublicFolder = (folder: string): folder is PublicFolder => (PUBLIC_FOLDERS as readonly string[]).includes(folder);

// ---------- S3 client ----------

export const s3Enabled = () => Boolean(process.env.AWS_S3_BUCKET);
const bucket = () => String(process.env.AWS_S3_BUCKET || "");

let client: S3Client | null = null;
const s3 = () => {
    if (!client) {
        client = new S3Client({
            region: process.env.AWS_REGION || "ap-south-1",
            // falls back to the default AWS chain (env vars, ~/.aws, EC2 instance role) when keys are not set
            credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
                : undefined,
        });
    }
    return client;
};

// ---------- owners (agency folders) ----------

const cleanId = (v: unknown) => {
    const s = String(v ?? "").trim();
    return /^[A-Za-z0-9-]{1,64}$/.test(s) ? s : null;
};

/** S3 prefix for one agency. */
export const agencyOwner = (agencyUuid?: string | null) => {
    const id = cleanId(agencyUuid);
    return id ? `agencies/${id}` : "platform";
};
export const PLATFORM_OWNER = "platform";

/**
 * Which agency an upload belongs to, from the logged-in user:
 * agency owner / staff → their agency, student → the agency they belong to, admin → platform.
 */
export const ownerFromRequest = (req: Request) => {
    const u: any = (req as any).user?.user || {};
    return agencyOwner(u.agent_uuid || u.agency_uuid || getAgencyUuidFromRequest(req));
};

// ---------- names and keys ----------

/** Plain file name only: no folders, no "..", no hidden files. */
export const safeName = (name: string) => {
    const base = path.basename(String(name || ""));
    return base && base === name && !base.startsWith(".") ? base : null;
};

const OWNER_RE = /^(agencies\/[A-Za-z0-9-]{1,64}|platform)$/;

/** A stored value is an S3 key when it has "/" in it (owner/folder/name). */
export const isS3Key = (ref?: string | null) => Boolean(ref && ref.includes("/") && !/^https?:\/\//i.test(ref));

/** Checks an S3 key is <owner>/<folder>/<name> for the expected folder. */
export const validKey = (folder: string, key: string) => {
    const parts = String(key || "").split("/");
    const name = parts.pop() || "";
    const keyFolder = parts.pop() || "";
    return keyFolder === folder && OWNER_RE.test(parts.join("/")) && Boolean(safeName(name));
};

const contentTypeOf = (name: string, fallback?: string) => {
    const ext = path.extname(name).toLowerCase();
    const map: Record<string, string> = {
        ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime",
        ".avi": "video/x-msvideo", ".mpeg": "video/mpeg",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    return map[ext] || fallback || "application/octet-stream";
};

/** Open PDFs and images in the browser; download anything else (never render uploaded HTML / SVG). */
const isInline = (name: string) => /\.(pdf|jpe?g|png|webp|gif|mp4|mov)$/i.test(name);

// ---------- local disk (no S3, or files saved before S3) ----------

export const privateDir = (folder: PrivateFolder) => path.join(process.cwd(), "storage", folder);
const publicDir = (folder: PublicFolder) => path.join(process.cwd(), "public", folder);
const localDir = (folder: StorageFolder) => (isPrivateFolder(folder) ? privateDir(folder) : publicDir(folder as PublicFolder));

/** Find a legacy local file: private storage first, then the old public folder. */
export const existingLocalPath = (folder: StorageFolder, name: string) => {
    const file = safeName(name);
    if (!file) return null;
    const candidates = [path.join(localDir(folder), file), path.join(process.cwd(), "public", folder, file)];
    return candidates.find((p) => fs.existsSync(p)) || null;
};

// ---------- save / delete ----------

/**
 * Saves an upload and returns the value to store in the database
 * (S3 key when S3 is on, otherwise the plain file name).
 */
export const saveFile = async (opts: { owner: string; folder: StorageFolder; name: string; body: Buffer; contentType?: string }) => {
    const name = safeName(opts.name);
    if (!name) throw new Error("Invalid file name");
    if (!OWNER_RE.test(opts.owner)) throw new Error("Invalid storage owner");

    if (s3Enabled()) {
        const key = `${opts.owner}/${opts.folder}/${name}`;
        await s3().send(new PutObjectCommand({
            Bucket: bucket(),
            Key: key,
            Body: opts.body,
            ContentType: contentTypeOf(name, opts.contentType),
            ServerSideEncryption: "AES256",
        }));
        return key;
    }

    const dir = localDir(opts.folder);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, name), opts.body);
    return name;
};

/** Read a stored file body (S3 key or legacy local name). */
export const readStoredFile = async (folder: StorageFolder, ref: string): Promise<Buffer> => {
    if (isS3Key(ref)) {
        if (!s3Enabled() || !validKey(folder, ref)) throw new Error("File not found");
        const out = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: ref }));
        const bytes = await out.Body?.transformToByteArray();
        if (!bytes?.length) throw new Error("Empty file");
        return Buffer.from(bytes);
    }
    const file = safeName(ref);
    if (!file) throw new Error("Invalid file name");
    const local = existingLocalPath(folder, file);
    if (!local) throw new Error("File not found");
    return fs.promises.readFile(local);
};

/** Deletes a stored file (S3 key or legacy local name). Never throws. */
export const deleteFile = async (folder: StorageFolder, ref?: string | null) => {
    if (!ref || /^https?:\/\//i.test(ref)) return;
    try {
        if (isS3Key(ref)) {
            if (!s3Enabled() || !validKey(folder, ref)) return;
            await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: ref }));
            return;
        }
        const p = existingLocalPath(folder, ref);
        if (p) await fs.promises.unlink(p);
    } catch (error) {
        console.error(`Could not delete ${folder}/${ref}`, error);
    }
};

// ---------- links ----------

const apiBase = () => {
    if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/+$/, "");
    return `${(process.env.LOCAL_PATH || "").replace(/\/+$/, "")}/api`;
};

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

/** Link for a public file (logos, course images, banners...). */
export const publicFileUrl = (folder: PublicFolder, ref?: string | null) => {
    if (!ref) return null;
    if (/^https?:\/\//i.test(ref)) return ref;
    if (isS3Key(ref)) {
        const direct = (process.env.AWS_S3_PUBLIC_URL || "").replace(/\/+$/, "");
        return direct ? `${direct}/${encodeKey(ref)}` : `${apiBase()}/v1/media/${encodeKey(ref)}`;
    }
    return `${process.env.LOCAL_PATH || ""}public/${folder}/${ref}`;
};

const presign = (key: string, seconds: number) => {
    const name = key.split("/").pop() || "file";
    return getSignedUrl(s3(), new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ResponseContentDisposition: `${isInline(name) ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`,
    }), { expiresIn: seconds });
};

/** Sends an S3 object to the browser by redirecting to a short-lived presigned link. */
export const redirectToS3 = async (res: Response, key: string, seconds: number) => {
    if (!s3Enabled()) return res.status(404).send("Not found");
    const url = await presign(key, seconds);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.redirect(302, url);
};

/** GET /api/v1/media/<owner>/<folder>/<name> - public images stored in S3. */
export const serveMedia = async (req: Request, res: Response) => {
    try {
        const key = String((req.params as any)[0] || "");
        const folder = key.split("/").slice(-2, -1)[0] || "";
        if (!isPublicFolder(folder) || !validKey(folder, key)) return res.status(404).send("Not found");
        // browsers may reuse the redirect for a few minutes; the presigned link lives longer than that
        res.setHeader("Cache-Control", "public, max-age=600");
        return await redirectToS3(res, key, 60 * 60);
    } catch (error) {
        console.error("serveMedia", error);
        return res.status(404).send("Not found");
    }
};

export { isPrivateFolder, isPublicFolder };
