import { DataType, DataTypes, ModelDefined, Optional, TinyIntegerDataType } from "sequelize";
import sequelize from "../config/dbconfig";

const OfflineLanguageInquiries = sequelize.define(
  'OfflineLanguageInquiries',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    agent_id: {
      type: DataTypes.INTEGER,
    },
    user_id: {
      type: DataTypes.INTEGER,
    },
    selected_language_text: {
      type: DataTypes.TEXT,
    }
  },
  {
    tableName: 'offline_languages_inquiries',
    paranoid: true,
    timestamps: true,
  }
)


export default OfflineLanguageInquiries