import { DataType, DataTypes, ModelDefined, Optional, TinyIntegerDataType } from "sequelize";
import sequelize from "../config/dbconfig";

const StudentCoins = sequelize.define(
  'StudentCoins',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
    },
    used_coins: {
      type: DataTypes.INTEGER,
    },
    coin_balance: {
      type: DataTypes.INTEGER,
    },
    transection_type: {
      type: DataTypes.ENUM("debit", "credit"),
      defaultValue: "debit"
    },
    comment: {
      type: DataTypes.STRING,
    }
  },
  {
    tableName: 'student_coins',
    paranoid: true,
    timestamps: true,
  }
)

export default StudentCoins