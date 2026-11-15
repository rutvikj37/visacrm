import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * CRM lead - one enquiry that an agency received from any source
 * (website form, CSV import, IndiaMART, Facebook, WhatsApp, manual ...).
 *
 * Separate from AgencyLeads, which is the visa case created after a lead converts.
 */
export const CRM_LEAD_SOURCES = ["manual", "website", "portal", "csv", "indiamart", "facebook", "whatsapp", "google", "other", "instagram", "justdial", "sulekha"] as const;
export const CRM_LEAD_STATUSES = ["new", "contacted", "follow_up", "interested", "counselling", "converted", "lost", "junk"] as const;
export type CrmLeadSource = typeof CRM_LEAD_SOURCES[number];
export type CrmLeadStatus = typeof CRM_LEAD_STATUSES[number];

const CrmLead = sequelize.define('CrmLead', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    // tenant: Agent.uuid of the main agency account
    agency_uuid: { type: DataTypes.STRING, allowNull: false },

    name: { type: DataTypes.STRING, allowNull: true },
    country_code: { type: DataTypes.STRING, allowNull: true },
    phone_number: { type: DataTypes.STRING, allowNull: true },
    // digits only, country code included - used to find duplicates
    phone_normalized: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },

    // what the person is interested in
    interested_country: { type: DataTypes.STRING, allowNull: true },
    interested_course: { type: DataTypes.STRING, allowNull: true },
    visa_type: { type: DataTypes.STRING, allowNull: true },
    intake: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },

    // where it came from
    source: { type: DataTypes.ENUM(...CRM_LEAD_SOURCES), defaultValue: "manual" },
    source_ref: { type: DataTypes.STRING, allowNull: true }, // id in the source system (e.g. IndiaMART UNIQUE_QUERY_ID)
    integration_id: { type: DataTypes.INTEGER, allowNull: true },
    campaign: { type: DataTypes.STRING, allowNull: true },
    extra: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('extra') }, // any other fields from the source

    // pipeline
    status: { type: DataTypes.ENUM(...CRM_LEAD_STATUSES), defaultValue: "new" },
    lost_reason: { type: DataTypes.TEXT, allowNull: true },
    assigned_to: { type: DataTypes.INTEGER, allowNull: true }, // Agent.id (agency owner or team member)
    tags: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('tags') },
    // keys of pre-convert docs the counsellor has collected (see services/docChecklist.ts)
    doc_checklist: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('doc_checklist') },
    next_follow_up_at: { type: DataTypes.DATE, allowNull: true },
    follow_up_note: { type: DataTypes.TEXT, allowNull: true },
    follow_up_notified_at: { type: DataTypes.DATE, allowNull: true }, // reminder sent for the current follow-up
    last_activity_at: { type: DataTypes.DATE, allowNull: true },
    enquiry_count: { type: DataTypes.INTEGER, defaultValue: 1 },
    // 0-100, how promising the lead is (see services/leadScore.ts): hot >= 70, warm >= 40, else cold
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    // branch office that owns this lead (null = not in a branch / head office) - see services/branches.ts
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    // when someone in the agency last opened this lead's WhatsApp / Instagram chat (unread = messages after it)
    chat_read_at: { type: DataTypes.DATE, allowNull: true },

    // conversion (filled in Phase 2: visa case)
    converted_at: { type: DataTypes.DATE, allowNull: true },
    converted_case_id: { type: DataTypes.INTEGER, allowNull: true }, // AgencyLeads.id
    converted_student_id: { type: DataTypes.INTEGER, allowNull: true }, // User.id

    created_by: { type: DataTypes.INTEGER, allowNull: true }, // Agent.id, null = system/integration
}, {
    tableName: 'crm_leads',
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ['agency_uuid', 'status'] },
        { fields: ['agency_uuid', 'phone_normalized'] },
        { fields: ['agency_uuid', 'email'] },
        { fields: ['agency_uuid', 'source', 'source_ref'] },
        { fields: ['agency_uuid', 'assigned_to'] },
        { fields: ['agency_uuid', 'next_follow_up_at'] },
        { fields: ['agency_uuid', 'score'] },
        { unique: true, fields: ['uuid'] },
    ]
});

export default CrmLead;
