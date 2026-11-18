import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/** Last run status for in-process app scheduler jobs (not host/VPS metrics). */
const PlatformSchedulerHeartbeat = sequelize.define('PlatformSchedulerHeartbeat', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    job_name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    last_ok_at: { type: DataTypes.DATE, allowNull: true },
    last_error: { type: DataTypes.STRING(1000), allowNull: true },
    last_duration_ms: { type: DataTypes.INTEGER, allowNull: true },
    last_started_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'platform_scheduler_heartbeats',
    timestamps: true,
});

export default PlatformSchedulerHeartbeat;
