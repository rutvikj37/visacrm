import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

const Subscription = sequelize.define('Subscription', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
    },
    agent_uuid: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    package_uuid: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
    },
    leads_remaining: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    team_member_limit: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },
    job_post_limit: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    job_post_start_date: {
        type: DataTypes.DATE
    },
    job_post_end_date: {
        type: DataTypes.DATE
    },
    subscription_start_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    achievement_banner: {
        type: DataTypes.STRING,
        defaultValue: 0
    },
    pin_end_date: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true
    },
    can_add_offline_leads: {
        type: DataTypes.TINYINT,
        defaultValue: 0
    },
    offline_lead_end_date: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM("active", "expired"),
        defaultValue: "active",
    },
}, {
    tableName: 'subscription',
    timestamps: true,
    paranoid: true
});

export default Subscription