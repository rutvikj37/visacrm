import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/** Timeline entry for a CRM lead: notes, calls, status changes, assignments, re-enquiries ... */
export const CRM_ACTIVITY_TYPES = [
    "created", "note", "call", "email", "whatsapp", "status_change", "assignment",
    "follow_up", "follow_up_done", "re_enquiry", "updated", "converted", "instagram", "portal",
] as const;
export type CrmActivityType = typeof CRM_ACTIVITY_TYPES[number];

const CrmLeadActivity = sequelize.define('CrmLeadActivity', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    lead_id: { type: DataTypes.INTEGER, allowNull: false },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM(...CRM_ACTIVITY_TYPES), defaultValue: "note" },
    message: { type: DataTypes.TEXT, allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('meta') },
    created_by: { type: DataTypes.INTEGER, allowNull: true }, // Agent.id, null = system
}, {
    tableName: 'crm_lead_activities',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['lead_id'] }, { fields: ['agency_uuid'] }]
});

export default CrmLeadActivity;
