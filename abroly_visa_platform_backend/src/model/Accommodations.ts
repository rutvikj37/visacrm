// models/AddOn.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

const Accommodations = sequelize.define('Accommodations', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    company_name: {
        type: DataTypes.STRING,
    },
    short_description: {
        type: DataTypes.TEXT,
    },
    link: {
        type: DataTypes.STRING,
    },
    is_destination_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    has_specific_move_in_date: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    knows_accommodation_duration: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    has_fixed_budget: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    prefers_private_room: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    wants_fully_furnished: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    needs_utilities_included: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    prefers_near_university_or_work: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    requires_accessibility_features: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    wants_shared_kitchen_or_meal_plan: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    needs_additional_facilities: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    has_documents_ready: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    wants_student_reviews: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    wants_flexible_cancellation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    interested_in_verified_listings: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    clicks:{
        type:DataTypes.INTEGER,
        defaultValue:0
    },
    images:{
        type:DataTypes.TEXT
    }
}, {
    tableName: 'accommodations',
    timestamps: true,
    paranoid: true,
});

export default Accommodations;

