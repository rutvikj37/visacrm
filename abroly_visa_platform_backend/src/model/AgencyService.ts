import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/**
 * A paid service an agency sells to its students (IELTS coaching, SOP writing, visa file charges, accommodation ...).
 * Students buy it in the student portal and pay on the agency's own Razorpay account; each purchase becomes a paid
 * GST invoice in Client fees (ClientInvoice.service_id).
 * Prices in paise.
 */
const AgencyService = sequelize.define('AgencyService', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING(60), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: { type: DataTypes.BIGINT, allowNull: false },
    gst_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    delivery: { type: DataTypes.STRING(120), allowNull: true }, // e.g. "Online, 4 weeks" / "Within 3 days"
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'agency_services',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['agency_uuid'] }, { unique: true, fields: ['uuid'] }],
});

export default AgencyService;
