import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * A lead source an agency has connected.
 * - website:   public webhook, identified by `public_key`
 * - indiamart: CRM key stored encrypted in `credentials`; pulled on a schedule and/or pushed to the webhook
 * - facebook:  a Facebook Page (Lead Ads), page token in `credentials`
 * - instagram: an Instagram business account linked to a connected Page (DMs), external_id = IG account id
 * - whatsapp:  WhatsApp Cloud API number
 * - google:    Google Ads lead form webhook; `credentials.google_key` must match the key Google sends
 * - justdial / sulekha: push webhooks identified by `public_key`
 */
export const LEAD_INTEGRATION_TYPES = ["website", "indiamart", "facebook", "whatsapp", "google", "instagram", "justdial", "sulekha"] as const;
export type LeadIntegrationType = typeof LEAD_INTEGRATION_TYPES[number];

const LeadIntegration = sequelize.define('LeadIntegration', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM(...LEAD_INTEGRATION_TYPES), allowNull: false },
    name: { type: DataTypes.STRING, allowNull: true },
    // random key used in public webhook URLs - never reveals the agency
    public_key: { type: DataTypes.STRING, allowNull: false },
    // id in the source system: Facebook page id, WhatsApp phone number id ...
    external_id: { type: DataTypes.STRING, allowNull: true },
    // leads from this source go to this branch (null = decide by city / assignee)
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    // AES-256-GCM encrypted JSON (see helpers/crypto.ts) - never returned to the client
    credentials: { type: DataTypes.TEXT, allowNull: true },
    settings: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('settings') },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    last_synced_at: { type: DataTypes.DATE, allowNull: true },
    last_lead_at: { type: DataTypes.DATE, allowNull: true },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    leads_received: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
    tableName: 'lead_integrations',
    timestamps: true,
    paranoid: true,
    indexes: [
        { unique: true, fields: ['public_key'] },
        { fields: ['agency_uuid', 'type'] },
        { fields: ['type', 'external_id'] }
    ]
});

export default LeadIntegration;
