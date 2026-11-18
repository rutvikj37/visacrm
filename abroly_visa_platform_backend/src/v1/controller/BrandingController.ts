import { publicFileUrl, saveFile, deleteFile, agencyOwner } from "../../helpers/storage";
import fs from "fs";
import path from "path";
import { Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import Agent from "../../model/Agent";

/** Agency branding for the student portal: name, logo, colours, support details (agency owner). */

const FIELDS = ["app_name", "primary_color", "primary_foreground_color", "dark_primary_color", "support_number", "support_email", "agency_address", "meta_description"];
const COLOR_FIELDS = ["primary_color", "primary_foreground_color", "dark_primary_color"];
const LOGO_TYPES: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp" };

const present = (agency: any) => {
    const a = agency.toJSON();
    const logo = a.favicon_url ? (String(a.favicon_url).startsWith("http") ? a.favicon_url : publicFileUrl("profiles", a.favicon_url)) : null;
    return {
        app_name: a.app_name, primary_color: a.primary_color, primary_foreground_color: a.primary_foreground_color, dark_primary_color: a.dark_primary_color,
        support_number: a.support_number, support_email: a.support_email, agency_address: a.agency_address, meta_description: a.meta_description,
        logo_url: logo,
        portal_address: a.domain ? `${a.sudomain ? `${a.sudomain}.` : ""}${a.domain}` : null,
    };
};

class BrandingController {
    // GET /crm/branding
    async get(req: RequestWithUser, res: Response) {
        const agency: any = await Agent.findOne({ where: { uuid: (req.user?.user as any)?.agent_uuid, role: "agent" } });
        if (!agency) return returnHelper(res, 200, false, "Agency not found");
        return returnHelper(res, 200, true, "Branding", present(agency));
    }

    // POST /crm/branding  (multipart: fields + optional "logo" image)
    async save(req: RequestWithUser, res: Response) {
        try {
            const user: any = req.user?.user || {};
            if (user.role !== "agent") return returnHelper(res, 200, false, "Only the agency owner can change branding");
            const agency: any = await Agent.findOne({ where: { uuid: user.agent_uuid, role: "agent" } });
            if (!agency) return returnHelper(res, 200, false, "Agency not found");

            const updates: Record<string, any> = {};
            for (const field of FIELDS) {
                if (req.body?.[field] === undefined) continue;
                const value = String(req.body[field] ?? "").trim();
                if (COLOR_FIELDS.includes(field)) {
                    if (value && !/^#[0-9a-fA-F]{6}$/.test(value)) return returnHelper(res, 200, false, "Colours must look like #1a2b3c");
                    updates[field] = value || null;
                } else if (field === "support_email") {
                    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return returnHelper(res, 200, false, "Please enter a valid support email");
                    updates[field] = value || null;
                } else {
                    updates[field] = value ? value.slice(0, field === "agency_address" || field === "meta_description" ? 1000 : 255) : null;
                }
            }

            const file = (req as any).file as Express.Multer.File | undefined;
            if (file) {
                const ext = LOGO_TYPES[file.mimetype];
                if (!ext) return returnHelper(res, 200, false, "Logo must be a PNG, JPG or WEBP image");
                if (file.size > 2 * 1024 * 1024) return returnHelper(res, 200, false, "Logo must be smaller than 2 MB");
                const name = `logo-${agency.dataValues.id}-${Date.now()}${ext}`;
                const old = agency.dataValues.favicon_url;
                updates.favicon_url = await saveFile({ owner: agencyOwner(agency.dataValues.uuid), folder: "profiles", name, body: file.buffer, contentType: file.mimetype });
                if (old && /(^|\/)logo-\d+-\d+\.(png|jpg|webp)$/.test(old)) await deleteFile("profiles", old);
            }

            if (!Object.keys(updates).length) return returnHelper(res, 200, false, "Nothing to save");
            await Agent.update(updates, { where: { id: agency.dataValues.id } });
            const fresh = await Agent.findByPk(agency.dataValues.id);
            return returnHelper(res, 200, true, "Branding saved. Students see it the next time they open the portal.", present(fresh));
        } catch (error) {
            console.error("save branding failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new BrandingController();
