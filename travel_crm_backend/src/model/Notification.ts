import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/** In-app notification for an agency user (owner or team member). */
export const NOTIFICATION_TYPES = [
    "new_lead", "lead_assigned", "whatsapp_message", "portal_chat", "follow_up_due", "daily_digest",
    "document_uploaded", "case_assigned", "task_assigned", "trial_ending", "plan_ending", "plan_expired", "payment_received", "import_done",
    "payment_failed", "announcement", "mention", "itinerary_response",
] as const;

const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    recipient_id: { type: DataTypes.INTEGER, allowNull: false }, // Agent.id
    type: { type: DataTypes.ENUM(...NOTIFICATION_TYPES), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: true },
    link: { type: DataTypes.STRING, allowNull: true }, // path inside the agency panel
    dedupe_key: { type: DataTypes.STRING, allowNull: true }, // stops the same reminder twice
    meta: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('meta') },
    read_at: { type: DataTypes.DATE, allowNull: true },
    emailed_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'notifications',
    timestamps: true,
    indexes: [
        { fields: ['recipient_id', 'read_at'] },
        { unique: true, fields: ['recipient_id', 'dedupe_key'] },
    ]
});

export default Notification;
