import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/** Live API failures seen by agencies, students, public, or admin — for SaaS Monitoring. */
const PlatformErrorLog = sequelize.define('PlatformErrorLog', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    severity: { type: DataTypes.ENUM('critical', 'error', 'warning'), allowNull: false, defaultValue: 'error' },
    source: { type: DataTypes.ENUM('agency', 'student', 'public', 'admin', 'system'), allowNull: false, defaultValue: 'system' },
    agency_uuid: { type: DataTypes.STRING, allowNull: true },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_role: { type: DataTypes.STRING(40), allowNull: true },
    method: { type: DataTypes.STRING(10), allowNull: true },
    path: { type: DataTypes.STRING(500), allowNull: false },
    status_code: { type: DataTypes.INTEGER, allowNull: false },
    message: { type: DataTypes.STRING(1000), allowNull: true },
    stack: { type: DataTypes.TEXT, allowNull: true },
    request_id: { type: DataTypes.STRING(64), allowNull: true },
    count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, {
    tableName: 'platform_error_logs',
    timestamps: false,
    indexes: [
        { fields: ['occurred_at'] },
        { fields: ['agency_uuid'] },
        { fields: ['severity'] },
        { fields: ['source'] },
        { fields: ['path', 'status_code'] },
    ],
});

export default PlatformErrorLog;
