import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/** An agency user closed the banner of an announcement. */
const AnnouncementDismissal = sequelize.define('AnnouncementDismissal', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    announcement_id: { type: DataTypes.INTEGER, allowNull: false },
    agent_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
    tableName: 'announcement_dismissals',
    timestamps: true,
    indexes: [{ unique: true, fields: ['announcement_id', 'agent_id'] }]
});

export default AnnouncementDismissal;
