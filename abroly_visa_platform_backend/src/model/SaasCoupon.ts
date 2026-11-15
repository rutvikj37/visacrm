import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * Discount code for subscriptions, created by the platform admin.
 *   kind percent: value = % off (1-100), max_discount caps it (rupees, optional)
 *   kind flat:    value = rupees off
 * plan_ids null = every plan. billing: any | monthly | yearly.
 * Uses are counted from paid payments (SaasPayment.coupon_id), so abandoned checkouts do not use it up.
 */
const SaasCoupon = sequelize.define('SaasCoupon', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    code: { type: DataTypes.STRING(40), allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
    kind: { type: DataTypes.ENUM("percent", "flat"), defaultValue: "percent" },
    value: { type: DataTypes.INTEGER, allowNull: false },
    max_discount: { type: DataTypes.INTEGER, allowNull: true },
    plan_ids: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("plan_ids") },
    billing: { type: DataTypes.ENUM("any", "monthly", "yearly"), defaultValue: "any" },
    valid_from: { type: DataTypes.DATE, allowNull: true },
    valid_until: { type: DataTypes.DATE, allowNull: true },
    max_uses: { type: DataTypes.INTEGER, allowNull: true },
    per_agency_limit: { type: DataTypes.INTEGER, defaultValue: 1 },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
}, {
    tableName: 'saas_coupons',
    timestamps: true,
    paranoid: true,
    indexes: [{ unique: true, fields: ['code'] }]
});

export default SaasCoupon;
