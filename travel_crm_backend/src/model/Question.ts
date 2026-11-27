import { signedFileUrl } from "../helpers/privateFiles";
import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

const Question = sequelize.define(
    "Question",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        step_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        student_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        agent_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        created_by_agent_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        question_text: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        question_answer: {
            type: DataTypes.TEXT,
        },
        question_type: {
            type: DataTypes.ENUM("text_input", "update_status", "file_selector","document_provide"),
            defaultValue:"text_input"
        },
        file_path: {
            type: DataTypes.VIRTUAL,
            get(this: any) {
                if ((this.question_type === "file_selector" || this.question_type == "document_provide") && this.question_answer) {
                    return signedFileUrl("student_docs", this.question_answer) // short-lived signed link (private storage)
                }
                return null;
            },
        },
        status:{
            type:DataTypes.ENUM("pending","provided","rejected","completed"),
            defaultValue:"pending"
        },
        reason:{
            type:DataTypes.TEXT
        }
    },
    {
        tableName: "questions",
        paranoid: true,
        timestamps: true,
    }
);

export default Question