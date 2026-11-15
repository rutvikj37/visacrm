import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/** One period of access for an agency (trial, paid or complimentary). History is kept. */
const SaasSubscription = sequelize.define('SaasSubscription', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    plan_id: { type: DataTypes.INTEGER, allowNull: true },
    kind: { type: DataTypes.ENUM("trial", "paid", "complimentary"), defaultValue: "paid" },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE, allowNull: false },
    payment_id: { type: DataTypes.INTEGER, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    created_by_admin: { type: DataTypes.INTEGER, allowNull: true }, // null = online payment
}, {
    tableName: 'saas_subscriptions',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['agency_uuid'] }]
});

export default SaasSubscription;
