import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/** What an agency spent on a lead source in a month - used for cost per lead / ROI in reports. */
const MarketingSpend = sequelize.define('MarketingSpend', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    month: { type: DataTypes.STRING(7), allowNull: false }, // YYYY-MM
    source: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.INTEGER, defaultValue: 0 }, // rupees
}, {
    tableName: 'marketing_spend',
    timestamps: true,
    indexes: [{ unique: true, fields: ['agency_uuid', 'month', 'source'] }]
});

export default MarketingSpend;
