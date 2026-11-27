import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

/** Sends a published form to a specific lead and/or portal student until they submit. */
const ClientFormAssignment = sequelize.define("ClientFormAssignment", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    form_id: { type: DataTypes.INTEGER, allowNull: false },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: true },
    lead_id: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.ENUM("pending", "completed"), defaultValue: "pending" },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    submission_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: "client_form_assignments",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["agency_uuid"] },
        { unique: true, fields: ["uuid"] },
        { fields: ["form_id"] },
        { fields: ["student_id"] },
        { fields: ["lead_id"] },
        { fields: ["status"] },
    ],
});

export default ClientFormAssignment;
