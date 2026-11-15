import { Response } from "express";
import { RequestWithUser } from "../../utils/types";
import { returnHelper } from "../../helpers/returnHelper";
import VisaTemplate from "../../model/VisaTemplate";
import { VISA_TEMPLATE_LIBRARY, findLibraryTemplate, sanitizeSteps } from "../../services/visaTemplateLibrary";

/**
 * Visa process templates: built-in library + the agency's own templates.
 * Read: everyone in the agency. Create / edit / delete: agency owner.
 */

const ctx = (req: RequestWithUser) => {
    const user: any = req.user?.user || {};
    return { agencyUuid: user.agent_uuid as string, userId: Number(user.id), isOwner: user.role === "agent" };
};

const countQuestions = (steps: any[]) => (steps || []).reduce((n, s) => n + (s?.questions?.length || 0), 0);

const presentOwn = (t: any) => {
    const data = t.toJSON ? t.toJSON() : t;
    const steps = Array.isArray(data.steps) ? data.steps : [];
    return {
        id: data.uuid,
        source: "agency",
        name: data.name,
        country: data.country,
        visa_type: data.visa_type,
        description: data.description,
        based_on: data.based_on,
        steps,
        step_count: steps.length,
        question_count: countQuestions(steps),
        updatedAt: data.updatedAt,
    };
};

const presentLibrary = (t: any) => ({
    id: `library:${t.key}`,
    source: "library",
    name: t.name,
    country: t.country,
    visa_type: t.visa_type,
    description: t.description,
    steps: t.steps,
    step_count: t.steps.length,
    question_count: countQuestions(t.steps),
});

/** Resolve "library:<key>" or an agency template uuid to { name, steps } (null if not found). */
export const resolveTemplate = async (agencyUuid: string, id?: string | null) => {
    if (!id) return null;
    if (id.startsWith("library:")) {
        const t = findLibraryTemplate(id.slice("library:".length));
        return t ? { name: t.name, steps: t.steps } : null;
    }
    const own: any = await VisaTemplate.findOne({ where: { uuid: id, agency_uuid: agencyUuid } });
    if (!own) return null;
    const data = own.toJSON();
    return { name: data.name, steps: Array.isArray(data.steps) ? data.steps : [] };
};

const readBody = (body: any) => {
    const name = String(body?.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Please give the template a name");
    return {
        name,
        country: body?.country ? String(body.country).trim().slice(0, 255) : null,
        visa_type: body?.visa_type ? String(body.visa_type).trim().slice(0, 255) : null,
        description: body?.description ? String(body.description).trim().slice(0, 2000) : null,
        steps: sanitizeSteps(body?.steps),
    };
};

class VisaTemplateController {
    // GET /crm/visa_templates
    async list(req: RequestWithUser, res: Response) {
        try {
            const own = await VisaTemplate.findAll({ where: { agency_uuid: ctx(req).agencyUuid }, order: [["name", "ASC"]] });
            return returnHelper(res, 200, true, "Templates fetched", {
                agency: own.map(presentOwn),
                library: VISA_TEMPLATE_LIBRARY.map(presentLibrary),
            });
        } catch (error) {
            console.error("list visa templates failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // GET /crm/visa_templates/:id   (uuid or library:<key>)
    async details(req: RequestWithUser, res: Response) {
        try {
            const id = String(req.params.id || "");
            if (id.startsWith("library:")) {
                const t = findLibraryTemplate(id.slice("library:".length));
                if (!t) return returnHelper(res, 200, false, "Template not found");
                return returnHelper(res, 200, true, "Template fetched", presentLibrary(t));
            }
            const own = await VisaTemplate.findOne({ where: { uuid: id, agency_uuid: ctx(req).agencyUuid } });
            if (!own) return returnHelper(res, 200, false, "Template not found");
            return returnHelper(res, 200, true, "Template fetched", presentOwn(own));
        } catch (error) {
            console.error("visa template details failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/visa_templates   { name, country, visa_type, description, steps } or { copy_from: "library:<key>" | uuid }
    async create(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, userId, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage templates");
            const count = await VisaTemplate.count({ where: { agency_uuid: agencyUuid } });
            if (count >= 100) return returnHelper(res, 200, false, "You can keep up to 100 templates");

            let data: any;
            if (req.body?.copy_from) {
                const from = String(req.body.copy_from);
                if (from.startsWith("library:")) {
                    const t = findLibraryTemplate(from.slice("library:".length));
                    if (!t) return returnHelper(res, 200, false, "Template not found");
                    data = { name: t.name, country: t.country, visa_type: t.visa_type, description: t.description, steps: t.steps, based_on: t.key };
                } else {
                    const own: any = await VisaTemplate.findOne({ where: { uuid: from, agency_uuid: agencyUuid } });
                    if (!own) return returnHelper(res, 200, false, "Template not found");
                    const o = own.toJSON();
                    data = { name: `${o.name} (copy)`.slice(0, 255), country: o.country, visa_type: o.visa_type, description: o.description, steps: o.steps, based_on: o.based_on };
                }
            } else {
                try {
                    data = readBody(req.body);
                } catch (e: any) {
                    return returnHelper(res, 200, false, e.message);
                }
            }

            const created = await VisaTemplate.create({ ...data, agency_uuid: agencyUuid, created_by: userId });
            return returnHelper(res, 200, true, "Template saved", presentOwn(created));
        } catch (error) {
            console.error("create visa template failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/visa_templates/:id/update
    async update(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage templates");
            const own: any = await VisaTemplate.findOne({ where: { uuid: req.params.id, agency_uuid: agencyUuid } });
            if (!own) return returnHelper(res, 200, false, "Template not found (built-in templates can be copied, not edited)");
            let data;
            try {
                data = readBody(req.body);
            } catch (e: any) {
                return returnHelper(res, 200, false, e.message);
            }
            await VisaTemplate.update(data, { where: { id: own.dataValues.id } });
            const fresh = await VisaTemplate.findByPk(own.dataValues.id);
            return returnHelper(res, 200, true, "Template saved", presentOwn(fresh));
        } catch (error) {
            console.error("update visa template failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }

    // POST /crm/visa_templates/:id/delete
    async remove(req: RequestWithUser, res: Response) {
        try {
            const { agencyUuid, isOwner } = ctx(req);
            if (!isOwner) return returnHelper(res, 200, false, "Only the agency owner can manage templates");
            const own: any = await VisaTemplate.findOne({ where: { uuid: req.params.id, agency_uuid: agencyUuid } });
            if (!own) return returnHelper(res, 200, false, "Template not found");
            await VisaTemplate.destroy({ where: { id: own.dataValues.id } });
            return returnHelper(res, 200, true, "Template deleted. Cases already created from it are not changed.");
        } catch (error) {
            console.error("delete visa template failed", error);
            return returnHelper(res, 500, false, "Something went wrong");
        }
    }
}

export default new VisaTemplateController();
