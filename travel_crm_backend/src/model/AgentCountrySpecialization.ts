import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";


const AgentCountrySpecialization = sequelize.define('AgentCountrySpecialization', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agent_uuid: {
        type: DataTypes.STRING
    },
    country: { type: DataTypes.STRING, allowNull: false }, // E.g., "USA", "Canada"
}, {
    tableName: 'agent_country_specializations',
    timestamps: true,
});

export default AgentCountrySpecialization;
