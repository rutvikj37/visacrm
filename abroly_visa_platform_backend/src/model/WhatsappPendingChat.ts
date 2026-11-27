import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";
import { jsonGetter } from "../helpers/json";

/**
 * WhatsApp chats waiting for staff review before becoming CRM leads.
 * Used when a connected number has settings.auto_create_leads === false ("Review first").
 * Messages are stored here until promote → CrmLead, or dismiss.
 */
export const WHATSAPP_PENDING_STATUSES = ["pending", "dismissed", "converted"] as const;
export type WhatsappPendingStatus = typeof WHATSAPP_PENDING_STATUSES[number];

const WhatsappPendingChat = sequelize.define("WhatsappPendingChat", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    integration_id: { type: DataTypes.INTEGER, allowNull: false },
    phone_normalized: { type: DataTypes.STRING, allowNull: false },
    profile_name: { type: DataTypes.STRING, allowNull: true },
    last_message: { type: DataTypes.TEXT, allowNull: true },
    last_message_at: { type: DataTypes.DATE, allowNull: true },
    message_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    // [{ wamid, text, at }] — capped in the service
    messages: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("messages") },
    campaign: { type: DataTypes.STRING, allowNull: true },
    extra: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("extra") },
    status: { type: DataTypes.ENUM(...WHATSAPP_PENDING_STATUSES), defaultValue: "pending" },
    lead_id: { type: DataTypes.INTEGER, allowNull: true },
    read_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: "whatsapp_pending_chats",
    timestamps: true,
    indexes: [
        { fields: ["agency_uuid", "status"] },
        { fields: ["agency_uuid", "phone_normalized"] },
        { fields: ["integration_id"] },
        { unique: true, fields: ["uuid"] },
    ],
});

export default WhatsappPendingChat;
