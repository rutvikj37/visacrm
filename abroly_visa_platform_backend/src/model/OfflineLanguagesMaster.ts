import { DataType, DataTypes, ModelDefined, Optional, TinyIntegerDataType } from "sequelize";
import sequelize from "../config/dbconfig";

const OfflineLanguagesMaster = sequelize.define(
  'OfflineLanguagesMaster',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    title: {
      type: DataTypes.TEXT,
    },
    is_active: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
  },
  {
    tableName: 'offline_languages_master',
    paranoid: true,
    timestamps: true,
  }
)


export default OfflineLanguagesMaster