import CrmLead from "../model/CrmLead";
import CrmLeadActivity from "../model/CrmLeadActivity";

/**
 * Lead score (0-100): how complete the enquiry is + how far it has moved + how engaged the person is.
 * hot >= 70, warm >= 40, cold below. Recalculated whenever something happens on the lead.
 */
export const HOT_SCORE = 70;
export const WARM_SCORE = 40;

const STATUS_POINTS: Record<string, number> = { new: 0, contacted: 8, follow_up: 12, interested: 25, counselling: 35, converted: 40, lost: 0, junk: 0 };
const SOURCE_POINTS: Record<string, number> = { portal: 10, website: 8, whatsapp: 8, facebook: 5, google: 5, indiamart: 5, manual: 5, csv: 0, other: 0 };

export const temperatureOf = (score: number) => (score >= HOT_SCORE ? "hot" : score >= WARM_SCORE ? "warm" : "cold");

export const computeScore = (lead: any, engagements = 0) => {
    if (["lost", "junk"].includes(lead.status)) return 0;
    let score = 0;
    if (lead.phone_normalized) score += 12;
    if (lead.email) score += 6;
    if (lead.interested_country) score += 10;
    if (lead.interested_course) score += 7;
    if (lead.intake) score += 8;
    if (lead.visa_type) score += 4;
    score += SOURCE_POINTS[lead.source] ?? 0;
    score += STATUS_POINTS[lead.status] ?? 0;
    if (Number(lead.enquiry_count) > 1) score += 8;            // asked more than once
    score += Math.min(engagements, 3) * 4;                     // calls / WhatsApp / emails logged
    if (lead.next_follow_up_at) score += 3;
    return Math.max(0, Math.min(100, score));
};

export const refreshScore = async (leadId: number) => {
    try {
        const lead: any = await CrmLead.findByPk(leadId);
        if (!lead) return;
        const engagements = await CrmLeadActivity.count({ where: { lead_id: leadId, type: ["call", "whatsapp", "email"] } });
        const score = computeScore(lead.dataValues, engagements);
        if (score !== Number(lead.dataValues.score)) await CrmLead.update({ score }, { where: { id: leadId } });
    } catch (error) {
        console.error("refreshScore failed", error);
    }
};
