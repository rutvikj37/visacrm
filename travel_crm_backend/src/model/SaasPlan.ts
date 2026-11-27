import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * A SaaS plan the platform admin sells to agencies.
 * features: { sources: ["website","csv",...], addons: ["jobs","side_banner",...] }
 * max_team_members: null = unlimited
 * duration_months: how long access lasts when this plan is activated (e.g. 6 or 12)
 * Prices in rupees (package price for the duration); 0 = admin-assigned only (no online checkout).
 */
const SaasPlan = sequelize.define('SaasPlan', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price_monthly: { type: DataTypes.INTEGER, defaultValue: 0 },
    price_yearly: { type: DataTypes.INTEGER, defaultValue: 0 },
    duration_months: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    max_team_members: { type: DataTypes.INTEGER, allowNull: true },
    features: { type: DataTypes.JSON, allowNull: false, get: jsonGetter('features') },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
    tableName: 'saas_plans',
    timestamps: true,
    paranoid: true,
    indexes: [{ unique: true, fields: ['uuid'] }]
});

export default SaasPlan;
