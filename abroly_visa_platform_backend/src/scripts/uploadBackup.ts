/**
 * Upload a database backup to S3 (backups/db/<file>) and delete S3 backups older than 30 days.
 * Called by deploy/backup-db.sh:  node dist/scripts/uploadBackup.js /var/backups/visacrm/x.sql.gz
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

dotenv.config();
const KEEP_DAYS = 30;
const PREFIX = "backups/db/";

const main = async () => {
    const file = process.argv[2];
    const bucket = (process.env.AWS_S3_BUCKET || "").trim();
    if (!file || !fs.existsSync(file)) throw new Error("usage: uploadBackup <file.sql.gz>");
    if (!bucket) { console.log("AWS_S3_BUCKET not set - backup kept on this server only"); return; }

    const s3 = new S3Client({
        region: process.env.AWS_REGION || "ap-south-1",
        credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(), secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim() } : undefined,
    });
    const key = PREFIX + path.basename(file);
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.createReadStream(file), ContentLength: fs.statSync(file).size, ContentType: "application/gzip", ServerSideEncryption: "AES256" }));
    console.log(`uploaded s3://${bucket}/${key}`);

    // clean-up needs s3:ListBucket; without it the upload still counts as a success
    try {
        const cutoff = Date.now() - KEEP_DAYS * 86400_000;
        const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX }));
        const old = (list.Contents || []).filter((o) => o.Key && o.LastModified && o.LastModified.getTime() < cutoff).map((o) => ({ Key: o.Key! }));
        if (old.length) {
            await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: old } }));
            console.log(`removed ${old.length} backup(s) older than ${KEEP_DAYS} days`);
        }
    } catch (e: any) {
        console.log(`old backups not cleaned (${e.name}): add s3:ListBucket to the IAM policy, or set an S3 lifecycle rule on ${PREFIX}`);
    }
};

main().then(() => process.exit(0)).catch((e) => { console.error("backup upload failed:", e.message); process.exit(1); });
