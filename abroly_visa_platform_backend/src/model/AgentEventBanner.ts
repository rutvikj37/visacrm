import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

const AgentEventBanner = sequelize.define('AgentEventBanner', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    heading: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    descriptive_text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'inactive',
    },
}, {
    tableName: 'agent_event_banners', // Optional: specify the table name if different
    timestamps: true, // Optional: if you want to include createdAt and updatedAt
});


export default AgentEventBanner; 