// models/AddOn.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

const RaisedApplications = sequelize.define('RaisedApplications', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    student_id:{
        type:DataTypes.INTEGER,
    },
    fieldOfStudy:{
        type:DataTypes.STRING
    },
    intake:{
        type:DataTypes.STRING
    },
    otherOption:{
        type:DataTypes.STRING
    },
    programLevel:{
        type:DataTypes.STRING
    },
    range:{
        type:DataTypes.STRING
    },
    state:{
        type:DataTypes.STRING
    },
    tuitionFees:{
        type:DataTypes.STRING
    },
    university:{
        type:DataTypes.STRING
    },
    universityType:{
        type:DataTypes.STRING
    },
    lat:{
        type:DataTypes.STRING
    },
    lng:{
        type:DataTypes.STRING
    },
    country:{
        type:DataTypes.STRING
    },
    status:{
        type:DataTypes.ENUM("pending","suggested","accepted","rejected"),
        defaultValue:"pending"
    },
    suggestions:{
        type:DataTypes.INTEGER,
        defaultValue:0
    }
}, {
    tableName: 'raised_applications',
    timestamps: true,
    paranoid: true
});

export default RaisedApplications;
