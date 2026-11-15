import { DataTypes } from 'sequelize';
import EventBanner from './EventBanner'; // Import the EventBanner model
import sequelize from '../config/dbconfig';

const AgentEventBannerInterest = sequelize.define('AgentEventBannerInterest', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    agent_event_banner_id: {
        type: DataTypes.INTEGER,
    },
    agent_id: {
        type: DataTypes.INTEGER
    }
}, {
    tableName: 'agent_event_banner_interest', // Optional: specify the table name if different
    timestamps: true, // Optional: if you want to include createdAt and updatedAt
});


export default AgentEventBannerInterest; 