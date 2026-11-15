// models/AddOn.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { assign } from 'nodemailer/lib/shared';

const AgencyLeadsAssignHistory = sequelize.define('AgencyLeadsAssignHistory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    lead_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    previous_assign_id:{
        type:DataTypes.INTEGER,
        allowNull: true,
    },
    assign_by:{
        type:DataTypes.INTEGER,
        allowNull: true,
    },
    assign_to:{
        type:DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    tableName: 'agency_leads_assign_history',
    timestamps: true,
    paranoid: true
});

export default AgencyLeadsAssignHistory;
