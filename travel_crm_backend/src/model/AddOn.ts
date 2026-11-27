// models/AddOn.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

const AddOn = sequelize.define('AddOn', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
    },
    subscription_uuid: {
        type: DataTypes.UUID,
    },
    agent_uuid: {
        type: DataTypes.STRING,
    },
    leads_remaining: {
        type: DataTypes.STRING,
        defaultValue: "0"
    },
    team_member_limit: {
        type: DataTypes.STRING,
        defaultValue: "0"
    },
    job_post_limit: {
        type: DataTypes.STRING,
        defaultValue: "0"
    },
    job_post_extend_days: {
        type: DataTypes.STRING,
        defaultValue: "0"
    },
    achievement_banner: {
        type: DataTypes.STRING,
        defaultValue: 0
    },
    pin_days: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'addon',
    timestamps: true,
    paranoid: true
});

export default AddOn;
