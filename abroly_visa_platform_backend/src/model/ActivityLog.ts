import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * Who changed what in an agency (visa cases, steps, documents, invoices, leads, team, settings).
 * Lead conversations stay on the lead timeline (crm_lead_activities); this is the audit trail around it.
 *   entity     case | invoice | lead | team | settings
 *   entity_id  AgencyLeads.id for cases, ClientInvoice.id for invoices, CrmLead.id for leads ...
 *   actor_*    snapshot of who did it (agency staff, student, or "system")
 */
const ActivityLog = sequelize.define('ActivityLog', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    entity: { type: DataTypes.STRING(20), allowNull: false },
    entity_id: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING(40), allowNull: false },
    summary: { type: DataTypes.STRING(500), allowNull: false },
    meta: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('meta') },
    actor_type: { type: DataTypes.STRING(10), defaultValue: "staff" }, // staff | student | system
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_name: { type: DataTypes.STRING, allowNull: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'activity_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['agency_uuid', 'createdAt'] }, { fields: ['entity', 'entity_id'] }],
});

export default ActivityLog;
