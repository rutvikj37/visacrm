import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

const ServiceFormResponse = sequelize.define('ServiceFormResponse', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name:{
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue:"",
    },
    email:{
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue:"",
    },
    phone:{
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue:"",
    },
    country_of_study_or_travel:{
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue:"",
    },

    // DATA
    coverage_type:{
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue:"",
    },

    data_requirements:{
        type: DataTypes.TEXT,
        allowNull:true,
        defaultValue:"",
    },

    // HEALTH
    start_date_of_insurance:{
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull:true,
    },

    status:{
        type: DataTypes.TEXT,
        defaultValue:"pending",
        allowNull:true,
    },

    type_of_response:{
        type: DataTypes.ENUM("health", "data"),
        defaultValue:"health",
        allowNull:true,
    },

    agent_id:{
        type: DataTypes.INTEGER,
        allowNull:true,
        defaultValue:null,
    },

},{
    tableName: 'service_form_responses',
    timestamps: true,
    paranoid: true
});

export default ServiceFormResponse;