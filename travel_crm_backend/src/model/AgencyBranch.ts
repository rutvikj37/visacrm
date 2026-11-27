import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * A branch office of an agency.
 *   - team members belong to a branch (Agent.branch_id); branch managers see their branch's work
 *   - leads, visa cases and invoices carry branch_id
 *   - routing_cities: a new lead whose city matches goes to this branch (plus the branch's own city)
 *   - address / gstin / invoice_prefix: used on the branch's student invoices instead of the head-office details
 *   - last_assigned_id: round-robin pointer for auto-assign inside the branch
 */
const AgencyBranch = sequelize.define('AgencyBranch', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    city: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING(1000), allowNull: true },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    gstin: { type: DataTypes.STRING(20), allowNull: true },
    invoice_prefix: { type: DataTypes.STRING(10), allowNull: true },
    routing_cities: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("routing_cities") },
    last_assigned_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'agency_branches',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['agency_uuid'] }]
});

export default AgencyBranch;
