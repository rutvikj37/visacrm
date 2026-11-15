import { DataType, DataTypes, ModelDefined, Optional, TinyIntegerDataType } from "sequelize";
import sequelize from "../config/dbconfig";

const LeadsCalendar = sequelize.define(
  'LeadsCalendar',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    created_by: {
      type: DataTypes.INTEGER
    },
    assgin_to: {
      type: DataTypes.INTEGER
    },
    description: {
      type: DataTypes.TEXT
    },
    lead_id: {
      type: DataTypes.INTEGER
    },
    user_id:{
      type:DataTypes.INTEGER
    },
    event_type: {
      type: DataTypes.ENUM("event", 'reminder', 'followup', 'task'),
      defaultValue: "followup"
    },
    date: {
      type: DataTypes.DATE
    },
    time: {
      type: DataTypes.TIME
    },
    is_done: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    },
    is_last: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    }
  },
  {
    tableName: 'leads_calendar',
    paranoid: true,
    timestamps: true,
  }
)




export default LeadsCalendar