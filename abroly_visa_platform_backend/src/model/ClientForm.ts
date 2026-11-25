import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";
import { jsonGetter } from "../helpers/json";

/**
 * Agency-built custom form (Google Forms–style). Separate from VisaTemplate case checklists.
 * fields: [{ id, label, type, required?, options?, help? }]
 * settings: { thank_you_message?, allow_multiple?, collect_contact? }
 */
const ClientForm = sequelize.define("ClientForm", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    fields: { type: DataTypes.JSON, allowNull: false, defaultValue: [], get: jsonGetter("fields") },
    status: { type: DataTypes.ENUM("draft", "published", "archived"), defaultValue: "draft" },
    share_token: { type: DataTypes.STRING(64), allowNull: true },
    settings: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("settings") },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: "client_forms",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["agency_uuid"] },
        { unique: true, fields: ["uuid"] },
        { unique: true, fields: ["share_token"] },
    ],
});

export default ClientForm;
