import { publicFileUrl } from "../helpers/storage";
import { DataType, DataTypes, ModelDefined, Optional, TinyIntegerDataType } from "sequelize";
import sequelize from "../config/dbconfig";

const Admin = sequelize.define(
  'Admin',
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
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING
    },
    country_code: {
      type: DataTypes.STRING
    },
    phone: {
      type: DataTypes.VIRTUAL,
      get(this: any) {
        return this.country_code !== null && this.phone_number !== null ? this.country_code + "" + this.phone_number : null
      },
    },
    profile_image: {
      type: DataTypes.STRING,
    },
    access_profile: {
      type: DataTypes.VIRTUAL,
      get(this: any) {
        return this.profile_image !== "" ? publicFileUrl("profiles", this.profile_image) : null
      },
    },
    user_type: {
      type: DataTypes.ENUM("admin"),
      defaultValue: "admin"
    },
    otp:
    {
      type: DataTypes.STRING
    },
    otp_expire:
    {
      type: DataTypes.DATE
    },
    // fixed login code (bcrypt hash) - set with `npm run admin:code -- <mobile>`; see services/agencyLogin.ts
    login_pin: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    login_pin_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    login_pin_locked_until: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  {
    tableName: 'admin',
    paranoid: true,
    timestamps: true,
    // never send the login code hash in API responses; read it only via Admin.scope("withLoginPin")
    defaultScope: { attributes: { exclude: ["login_pin", "login_pin_attempts", "login_pin_locked_until"] } },
    scopes: { withLoginPin: {} },
  }
)




export default Admin