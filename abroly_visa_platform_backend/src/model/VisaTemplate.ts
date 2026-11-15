import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * An agency's own visa process template (built-in ones live in services/visaTemplateLibrary.ts).
 * steps: [{ title, description, questions: [{ text, type: "text_input" | "file_selector" }] }]
 */
const VisaTemplate = sequelize.define('VisaTemplate', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    country: { type: DataTypes.STRING, allowNull: true },
    visa_type: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    steps: { type: DataTypes.JSON, allowNull: false, get: jsonGetter('steps') },
    based_on: { type: DataTypes.STRING, allowNull: true }, // library key it was copied from
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'visa_templates',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['agency_uuid'] }, { unique: true, fields: ['uuid'] }]
});

export default VisaTemplate;
