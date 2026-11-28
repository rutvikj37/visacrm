import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

/** Files attached to a CRM lead (WhatsApp inbound, manual upload later, …). Stored in private `lead_files` storage. */
const CrmLeadFile = sequelize.define("CrmLeadFile", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    lead_id: { type: DataTypes.INTEGER, allowNull: false },
    storage_name: { type: DataTypes.STRING, allowNull: false },
    original_name: { type: DataTypes.STRING, allowNull: true },
    mime: { type: DataTypes.STRING(120), allowNull: true },
    size: { type: DataTypes.INTEGER, allowNull: true },
    source: { type: DataTypes.STRING(40), defaultValue: "whatsapp" },
    wamid: { type: DataTypes.STRING, allowNull: true },
    activity_id: { type: DataTypes.INTEGER, allowNull: true },
    // when the lead is converted, WhatsApp files are copied into the visa case checklist
    case_id: { type: DataTypes.INTEGER, allowNull: true },
    case_question_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: "crm_lead_files",
    timestamps: true,
    indexes: [
        { fields: ["lead_id"] },
        { fields: ["agency_uuid", "lead_id"] },
        { unique: true, fields: ["lead_id", "wamid"], name: "crm_lead_files_lead_wamid" },
        { unique: true, fields: ["uuid"] },
    ],
});

export default CrmLeadFile;