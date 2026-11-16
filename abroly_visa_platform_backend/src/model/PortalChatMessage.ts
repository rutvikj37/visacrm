import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

/**
 * In-app chat between a student and their agency counsellor.
 * One thread per student within an agency (student_id + agency_uuid).
 */
const PortalChatMessage = sequelize.define("PortalChatMessage", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    sender_type: { type: DataTypes.ENUM("student", "agent"), allowNull: false },
    sender_id: { type: DataTypes.INTEGER, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    /** Set when the other party opens the thread (or marks read). */
    read_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: "portal_chat_messages",
    timestamps: true,
    updatedAt: false,
    indexes: [
        { fields: ["agency_uuid", "student_id"] },
        { fields: ["student_id", "createdAt"] },
    ],
});

export default PortalChatMessage;
