/**
 * Copy files uploaded before S3 was switched on into the agencies' S3 folders, and point the
 * database rows at them. Local files are left where they are (delete them later by hand).
 *
 *   npm run files:s3            dry run - only reports what it would do
 *   npm run files:s3 -- --apply copy to S3 and update the database
 *
 * Safe to run again: rows that already hold an S3 key are skipped.
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";

type Owner = string; // "agencies/<uuid>" or "platform"
type Task = {
    label: string;
    model: any;
    field: string;
    folder: string;
    attrs: string[];
    where?: Record<string, unknown>;
    owner: (row: any) => Promise<Owner>;
    json?: boolean; // field holds [{ name, ... }]
};

const APPLY = process.argv.includes("--apply");

const main = async () => {
    const sequelize = (await import("../config/dbconfig")).default;
    await sequelize.authenticate();
    const { Op } = await import("sequelize");
    const storage = await import("../helpers/storage");
    if (!storage.s3Enabled()) throw new Error("AWS_S3_BUCKET is not set - nothing to copy to");

    const Agent = (await import("../model/Agent")).default as any;
    const User = (await import("../model/User")).default as any;
    const Admin = (await import("../model/Admin")).default as any;
    const Question = (await import("../model/Question")).default as any;
    const AgentTransectionsToAdmin = (await import("../model/AgentTransectionsToAdmin")).default as any;
    const GeneratedReport = (await import("../model/GeneratedReport")).default as any;
    const { Certification } = (await import("../model/AgentProfile")) as any;
    const SideBanner = (await import("../model/SideBanner")).default as any;
    const Courses = (await import("../model/Courses")).default as any;
    const EventBannerImage = (await import("../model/EventBannerImage")).default as any;
    const AgentEventBannerImages = (await import("../model/AgentEventBannerImages")).default as any;
    const ContentWritingServicesResponsesFiles = (await import("../model/ContentWritingServicesResponsesFiles")).default as any;
    const CourseChapterPoints = (await import("../model/CourseChapterPoints")).default as any;
    const ServiceInfo = (await import("../model/ServiceInfo")).default as any;
    const Testimonial = (await import("../model/Testimonial")).default as any;
    const UniversityApplication = (await import("../model/UniversityApplication")).default as any;
    const ServiceOrderUpdate = (await import("../model/ServiceOrderUpdate")).default as any;

    // ---- which agency a row belongs to (cached) ----
    const cache = new Map<string, Owner>();
    const agencyOfAgentRow = (a: any): Owner =>
        storage.agencyOwner(a ? (a.role === "agent" ? a.uuid : a.parent_uuid) : null);
    const byAgentId = async (id: unknown): Promise<Owner> => {
        const k = `aid:${id}`;
        if (!cache.has(k)) {
            const a = id ? await Agent.findByPk(Number(id), { attributes: ["uuid", "role", "parent_uuid"], raw: true, paranoid: false }) : null;
            cache.set(k, agencyOfAgentRow(a));
        }
        return cache.get(k)!;
    };
    const byAgentUuid = async (uuid: unknown): Promise<Owner> => {
        const k = `au:${uuid}`;
        if (!cache.has(k)) {
            const a = uuid ? await Agent.findOne({ where: { uuid: String(uuid) }, attributes: ["uuid", "role", "parent_uuid"], raw: true, paranoid: false }) : null;
            cache.set(k, agencyOfAgentRow(a));
        }
        return cache.get(k)!;
    };
    const byStudentId = async (id: unknown): Promise<Owner> => {
        const k = `sid:${id}`;
        if (!cache.has(k)) {
            const u = id ? await User.findByPk(Number(id), { attributes: ["agency_uuid"], raw: true, paranoid: false }) : null;
            cache.set(k, storage.agencyOwner(u?.agency_uuid));
        }
        return cache.get(k)!;
    };
    const platform = async () => storage.PLATFORM_OWNER;

    const tasks: Task[] = [
        ...["profile_image", "favicon_url", "og_image"].map((field): Task => ({
            label: `agency users.${field}`, model: Agent, field, folder: "profiles", attrs: ["role", "uuid", "parent_uuid"],
            owner: async (r) => agencyOfAgentRow(r),
        })),
        { label: "students.profile_image", model: User, field: "profile_image", folder: "profiles", attrs: ["agency_uuid"], owner: async (r) => storage.agencyOwner(r.agency_uuid) },
        { label: "admins.profile_image", model: Admin, field: "profile_image", folder: "profiles", attrs: [], owner: platform },
        {
            label: "student documents", model: Question, field: "question_answer", folder: "student_docs", attrs: ["student_id"],
            where: { question_type: ["file_selector", "document_provide"] }, owner: (r) => byStudentId(r.student_id),
        },
        { label: "payment proofs", model: AgentTransectionsToAdmin, field: "payment_proof", folder: "subscription_proof", attrs: ["agent_id"], owner: (r) => byAgentId(r.agent_id) },
        { label: "reports", model: GeneratedReport, field: "filename", folder: "reports", attrs: ["agentId"], owner: (r) => byAgentId(r.agentId) },
        { label: "certificates", model: Certification, field: "name", folder: "certificates", attrs: ["agent_uuid"], owner: (r) => byAgentUuid(r.agent_uuid) },
        { label: "side banners", model: SideBanner, field: "image", folder: "banners", attrs: ["agent_uuid"], owner: (r) => (r.agent_uuid ? byAgentUuid(r.agent_uuid) : platform()) },
        { label: "course banners", model: Courses, field: "banner_image", folder: "courses", attrs: ["angecy_id"], owner: (r) => (r.angecy_id ? byAgentId(r.angecy_id) : platform()) },
        { label: "event images", model: EventBannerImage, field: "imageUrl", folder: "event_images", attrs: [], owner: platform },
        { label: "agency event images", model: AgentEventBannerImages, field: "imageUrl", folder: "event_images", attrs: [], owner: platform },
        { label: "content writing files", model: ContentWritingServicesResponsesFiles, field: "file_name", folder: "content_writing_files", attrs: [], owner: platform },
        { label: "course chapter files", model: CourseChapterPoints, field: "file", folder: "course_chapter_items", attrs: [], owner: platform },
        { label: "service info files", model: ServiceInfo, field: "file", folder: "service_info", attrs: [], owner: platform },
        { label: "testimonials", model: Testimonial, field: "file_url", folder: "testimonials", attrs: [], owner: platform },
        { label: "university offer files", model: UniversityApplication, field: "offer_files", folder: "student_docs", attrs: ["agency_uuid"], json: true, owner: async (r) => storage.agencyOwner(r.agency_uuid) },
        { label: "service order files", model: ServiceOrderUpdate, field: "files", folder: "service_files", attrs: ["agency_uuid"], json: true, owner: async (r) => storage.agencyOwner(r.agency_uuid) },
    ];

    const isLegacy = (v: unknown) => typeof v === "string" && v.trim() !== "" && !storage.isS3Key(v) && !/^https?:\/\//i.test(v);
    const totals = { copied: 0, missing: 0, already: 0 };

    // copy one legacy file; returns the S3 key, or null when the file is not on disk
    const copy = async (folder: string, name: string, owner: Owner) => {
        const local = storage.existingLocalPath(folder as any, name);
        if (!local) return null;
        if (!APPLY) return `${owner}/${folder}/${name}`;
        return storage.saveFile({ owner, folder: folder as any, name, body: await fs.promises.readFile(local) });
    };

    console.log(APPLY ? "APPLY: copying files to S3 and updating the database\n" : "DRY RUN (nothing changes) - add --apply to copy\n");
    for (const t of tasks) {
        const stats = { copied: 0, missing: 0, already: 0 };
        const rows: any[] = await t.model.unscoped().findAll({
            attributes: ["id", t.field, ...t.attrs],
            where: { ...(t.where || {}), [t.field]: { [Op.ne]: null } },
            raw: true,
        });
        for (const r of rows) {
            if (t.json) {
                let list: any[] = r[t.field];
                if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = []; } }
                if (!Array.isArray(list) || !list.length) continue;
                let changedRow = false;
                const owner = await t.owner(r);
                const next = [];
                for (const f of list) {
                    if (!f || !isLegacy(f.name)) { if (f?.name) stats.already++; next.push(f); continue; }
                    const key = await copy(t.folder, f.name, owner);
                    if (key) { stats.copied++; changedRow = true; next.push({ ...f, name: key }); } else { stats.missing++; next.push(f); }
                }
                if (APPLY && changedRow) await t.model.update({ [t.field]: next }, { where: { id: r.id }, silent: true, hooks: false });
                continue;
            }
            const value = r[t.field];
            if (!isLegacy(value)) { if (value) stats.already++; continue; }
            const key = await copy(t.folder, value, await t.owner(r));
            if (!key) { stats.missing++; continue; }
            stats.copied++;
            if (APPLY) await t.model.update({ [t.field]: key }, { where: { id: r.id }, silent: true, hooks: false });
        }
        totals.copied += stats.copied; totals.missing += stats.missing; totals.already += stats.already;
        console.log(`${t.label.padEnd(26)} ${APPLY ? "copied" : "to copy"} ${String(stats.copied).padStart(4)}   not on disk ${String(stats.missing).padStart(4)}   already in S3 ${String(stats.already).padStart(4)}`);
    }
    console.log(`\nTotal: ${APPLY ? "copied" : "to copy"} ${totals.copied}, not on disk ${totals.missing}, already in S3 ${totals.already}`);
    if (totals.missing) console.log("'Not on disk' rows point at files that no longer exist locally; they are left unchanged.");
    await sequelize.close();
};

main().then(() => process.exit(0)).catch((e) => { console.error("Failed:", e?.message || e); process.exit(1); });
