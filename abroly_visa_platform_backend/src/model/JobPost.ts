import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

const JobPost = sequelize.define('JobPost', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4
    },
    agent_uuid: {
        type: DataTypes.STRING,
    },
    jobType: {
        type: DataTypes.ENUM('Full-time', 'Part-time', 'Temporary/Contract', 'Internship'),
        defaultValue: "Full-time"
    },
    country: {
        type: DataTypes.STRING,
    },
    jobRole: {
        type: DataTypes.STRING,
    },
    salaryMin: {
        type: DataTypes.INTEGER,
    },
    salaryMax: {
        type: DataTypes.INTEGER,
    },
    experienceRequired: {
        type: DataTypes.INTEGER, // number of years
    },
    educationLevel: {
        type: DataTypes.STRING,
    },
    workPermit: {
        type: DataTypes.ENUM('Employment Visa (ECR)', 'Employment Visa (ECNR)'),
    },
    overtime: {
        type: DataTypes.BOOLEAN,
    },
    accommodation: {
        type: DataTypes.BOOLEAN,
    },
    transportation: {
        type: DataTypes.BOOLEAN,
    },
    food: {
        type: DataTypes.STRING,
    },
    medicalInsurance: {
        type: DataTypes.BOOLEAN,
    },
    workHours: {
        type: DataTypes.STRING,
    },
    agentCharges: {
        type: DataTypes.STRING, // fee description or range
    },
    skillsRequired: {
        type: DataTypes.STRING, // comma-separated skills
    },
    description: {
        type: DataTypes.TEXT, // comma-separated skills
    },
    applicationDeadline: {
        type: DataTypes.DATE,
    },
    job_post_end_date: {
        type: DataTypes.DATE
    },
    /** Agency-defined extra fields for this post: [{ id, label, value }] */
    custom_fields: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonGetter('custom_fields'),
    },
}, {
    tableName: 'job_posts',
    timestamps: true,
    paranoid: true
});

export default JobPost;
