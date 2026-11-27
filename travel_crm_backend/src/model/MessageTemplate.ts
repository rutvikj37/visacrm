import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * A reusable message of an agency, sent by hand (broadcast) or automatically on a trigger.
 * body uses {{name}} {{agency}} {{country}} {{portal_link}} {{amount}} {{due_date}} {{pending_count}}.
 * WhatsApp: wa_template_name = name of the template approved in WhatsApp Manager;
 *           wa_variables = which values fill its {{1}}, {{2}} ... (e.g. ["name", "agency"]).
 */
export const MESSAGE_TRIGGERS = ["manual", "lead_created", "lead_converted", "documents_pending", "fee_due", "quote_sent", "itinerary_shared", "booking_confirmed", "trip_kit", "trip_tomorrow", "welcome_back"] as const;

const MessageTemplate = sequelize.define('MessageTemplate', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    channel: { type: DataTypes.ENUM("whatsapp", "email"), allowNull: false },
    trigger: { type: DataTypes.ENUM(...MESSAGE_TRIGGERS), defaultValue: "manual" },
    subject: { type: DataTypes.STRING, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    wa_template_name: { type: DataTypes.STRING, allowNull: true },
    wa_language: { type: DataTypes.STRING, allowNull: true },
    wa_variables: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('wa_variables') },
    is_active: { type: DataTypes.TINYINT, defaultValue: 1 },
    sent_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    failed_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_error: { type: DataTypes.TEXT, allowNull: true },
}, {
    tableName: 'message_templates',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['agency_uuid', 'trigger'] }, { unique: true, fields: ['uuid'] }]
});

export default MessageTemplate;
