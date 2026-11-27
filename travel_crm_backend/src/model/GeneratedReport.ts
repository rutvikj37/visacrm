import { signedFileUrl } from "../helpers/privateFiles";
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/dbconfig"; // Adjust path

const GeneratedReport = sequelize.define("GeneratedReport",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reportType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['agent_activity', 'lead_conversion', 'student_engagement', 'step_completion', 'question_resolution', 'lead_source', 'country_intake', 'agent_performance']], // List of report types
      },
    },
    agentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: true, // Starts as null, updated after generation
    },
    fileUrl: {
      type: DataTypes.VIRTUAL,
      get(this: any) {
        return signedFileUrl("reports", this.filename); // short-lived signed link (private storage)
      },
    },
  },
  {
    tableName: "generated_reports",
    timestamps: true,
    paranoid:true,
    updatedAt: false, // No need for updatedAt since we only track creation
  }
);

export default GeneratedReport;