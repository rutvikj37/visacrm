import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

/**
 * Internal agency tasks assigned to team members.
 * Optionally linked to a CRM lead (uuid) or visa case (AgencyLeads id as string).
 */
const AgencyTask = sequelize.define("AgencyTask", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    assignee_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
        type: DataTypes.ENUM("todo", "in_progress", "done"),
        allowNull: false,
        defaultValue: "todo",
    },
    priority: {
        type: DataTypes.ENUM("low", "normal", "high"),
        allowNull: false,
        defaultValue: "normal",
    },
    due_at: { type: DataTypes.DATE, allowNull: true },
    related_type: {
        type: DataTypes.ENUM("none", "lead", "case"),
        allowNull: false,
        defaultValue: "none",
    },
    related_id: { type: DataTypes.STRING(64), allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: "agency_tasks",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["agency_uuid", "status"] },
        { fields: ["agency_uuid", "assignee_id"] },
        { fields: ["agency_uuid", "due_at"] },
        { fields: ["agency_uuid", "created_by"] },
    ],
});

export default AgencyTask;
