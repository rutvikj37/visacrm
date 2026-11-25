import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";
import { jsonGetter } from "../helpers/json";

/**
 * One completed form response.
 * answers: { [fieldId]: string | string[] | { file: storageKey, name: string } }
 */
const ClientFormSubmission = sequelize.define("ClientFormSubmission", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    form_id: { type: DataTypes.INTEGER, allowNull: false },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    answers: { type: DataTypes.JSON, allowNull: false, defaultValue: {}, get: jsonGetter("answers") },
    contact_name: { type: DataTypes.STRING, allowNull: true },
    contact_email: { type: DataTypes.STRING, allowNull: true },
    contact_phone: { type: DataTypes.STRING, allowNull: true },
    source: { type: DataTypes.ENUM("public", "portal"), defaultValue: "public" },
    student_id: { type: DataTypes.INTEGER, allowNull: true },
    lead_id: { type: DataTypes.INTEGER, allowNull: true },
    assignment_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: "client_form_submissions",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["agency_uuid"] },
        { unique: true, fields: ["uuid"] },
        { fields: ["form_id"] },
        { fields: ["lead_id"] },
        { fields: ["student_id"] },
        { fields: ["assignment_id"] },
    ],
});

export default ClientFormSubmission;
