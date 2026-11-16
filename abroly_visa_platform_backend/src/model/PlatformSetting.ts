import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * Platform-wide settings of the SaaS owner, one row per key.
 *   billing           - seller details on subscription invoices (legal name, GSTIN, state, SAC, GST %, prefix)
 *   invoice_counter   - running invoice number per financial year
 *   meta              - Meta app credentials for Facebook / Instagram Lead Ads (app id, encrypted secret, webhook token)
 */
const PlatformSetting = sequelize.define('PlatformSetting', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    key: { type: DataTypes.STRING(64), allowNull: false },
    value: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("value") },
}, {
    tableName: 'platform_settings',
    timestamps: true,
    indexes: [{ unique: true, fields: ['key'] }]
});

export default PlatformSetting;
