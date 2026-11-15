import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

// Steps Model
const Step = sequelize.define(
    "Step",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        agent_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        student_id: {
            type: DataTypes.INTEGER,
        },
        lead_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        created_by_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        step_title: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        step_description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        step_order: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        step_status: {
            type: DataTypes.TINYINT,
            defaultValue: 0,
            comment: "1 for completed, 0 for not completed"
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        due_notified_at: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    },
    {
        tableName: "steps",
        paranoid: true,
        timestamps: true,
    }
);


export default Step
