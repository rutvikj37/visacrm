import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";
import { jsonGetter } from "../helpers/json";

/**
 * One application to a university / college inside a visa case (AgencyLeads).
 * A student usually applies to several universities for the same intake; each has its own status and offer letter.
 * offer_files: [{ name, original, size, mime, at }] in private storage (student_docs).
 */
export const UNI_APP_STATUSES = [
    "shortlisted", "applied", "offer", "conditional", "unconditional", "cas", "deposit_paid", "rejected", "withdrawn",
] as const;

const UniversityApplication = sequelize.define("UniversityApplication", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    case_id: { type: DataTypes.INTEGER, allowNull: false }, // AgencyLeads.id
    student_id: { type: DataTypes.INTEGER, allowNull: false }, // User.id
    university: { type: DataTypes.STRING(255), allowNull: false },
    course: { type: DataTypes.STRING(255), allowNull: true },
    campus: { type: DataTypes.STRING(255), allowNull: true },
    intake: { type: DataTypes.STRING(50), allowNull: true },
    application_ref: { type: DataTypes.STRING(100), allowNull: true }, // the university's application / student id
    status: { type: DataTypes.ENUM(...UNI_APP_STATUSES), allowNull: false, defaultValue: "shortlisted" },
    applied_on: { type: DataTypes.DATEONLY, allowNull: true },
    offer_on: { type: DataTypes.DATEONLY, allowNull: true },
    // tuition fee and deposit, in minor units (cents / pence / paise) of `currency`
    currency: { type: DataTypes.STRING(3), allowNull: true },
    tuition_fee: { type: DataTypes.BIGINT, allowNull: true },
    deposit_amount: { type: DataTypes.BIGINT, allowNull: true },
    deposit_paid_on: { type: DataTypes.DATEONLY, allowNull: true },
    // the one the student is going with (its name is copied to the case)
    is_final: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    offer_files: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("offer_files") },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status_updated_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: "university_applications",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["agency_uuid", "status"] },
        { fields: ["case_id"] },
        { fields: ["student_id"] },
    ],
});

export default UniversityApplication;
