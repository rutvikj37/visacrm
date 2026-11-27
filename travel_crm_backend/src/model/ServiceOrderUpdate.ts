import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * One entry on a service order: a message, a status change or a delivery, with optional files
 * (files: [{ name, original, size, mime }], stored privately in storage/service_files).
 * internal = note for the agency team only, never shown to the student.
 */
const ServiceOrderUpdate = sequelize.define('ServiceOrderUpdate', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    kind: { type: DataTypes.ENUM("message", "status", "delivery"), defaultValue: "message" },
    author_type: { type: DataTypes.ENUM("staff", "student", "system"), defaultValue: "staff" },
    author_id: { type: DataTypes.INTEGER, allowNull: true },
    author_name: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    files: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('files') },
    internal: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    tableName: 'service_order_updates',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['order_id'] }],
});

export default ServiceOrderUpdate;
