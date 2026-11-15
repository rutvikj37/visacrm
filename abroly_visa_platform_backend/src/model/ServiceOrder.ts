import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/**
 * Work the agency owes a student after a services-store purchase (one per paid invoice).
 *   new -> in_progress -> delivered -> completed, with changes_requested when the student asks for changes.
 * The conversation and delivered files are ServiceOrderUpdate rows.
 */
export const SERVICE_ORDER_STATUSES = ["new", "in_progress", "delivered", "changes_requested", "completed"] as const;

const ServiceOrder = sequelize.define('ServiceOrder', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    invoice_id: { type: DataTypes.INTEGER, allowNull: false },
    service_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    case_id: { type: DataTypes.INTEGER, allowNull: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    title: { type: DataTypes.STRING, allowNull: false }, // service name at the time of purchase
    status: { type: DataTypes.ENUM(...SERVICE_ORDER_STATUSES), defaultValue: "new" },
    assigned_to: { type: DataTypes.INTEGER, allowNull: true },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    last_update_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'service_orders',
    timestamps: true,
    indexes: [{ fields: ['agency_uuid', 'status'] }, { fields: ['student_id'] }, { unique: true, fields: ['invoice_id'] }, { unique: true, fields: ['uuid'] }],
});

export default ServiceOrder;
