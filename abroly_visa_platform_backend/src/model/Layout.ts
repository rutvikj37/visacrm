import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";


const Layout = sequelize.define("layout", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false
    }
},{
    tableName: "layouts",
    timestamps: true,
    paranoid: true
});

export default Layout;