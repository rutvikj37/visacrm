import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/**
 * Super Admin override of one module for one agency (services/modules.ts).
 * Only overrides are stored; everything else follows the agency's CRM type and plan.
 *   is_enabled 1 = switched on (e.g. Visa add-on for a travel agency), 0 = switched off.
 */
const AgencyModule = sequelize.define('AgencyModule', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    module_key: { type: DataTypes.STRING(40), allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false },
    updated_by: { type: DataTypes.INTEGER, allowNull: true }, // Admin.id
}, {
    tableName: 'agency_modules',
    timestamps: true,
    indexes: [{ unique: true, fields: ['agency_uuid', 'module_key'] }]
});

export default AgencyModule;
