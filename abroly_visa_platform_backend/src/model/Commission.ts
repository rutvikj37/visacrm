import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

/**
 * Commission an agency earns from a university or partner for a student (usually a % of first-year tuition).
 * Money in minor units (cents / pence / paise) of `currency`.
 *   expected  - agreed, not billed yet
 *   invoiced  - the agency has sent its commission invoice to the university / partner
 *   received  - paid (fully or partly: amount_received)
 *   cancelled - will not be paid (student withdrew, deferred ...)
 */
export const COMMISSION_STATUSES = ["expected", "invoiced", "received", "cancelled"] as const;

const Commission = sequelize.define("Commission", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    case_id: { type: DataTypes.INTEGER, allowNull: true }, // AgencyLeads.id
    university_app_id: { type: DataTypes.INTEGER, allowNull: true }, // UniversityApplication.id
    student_id: { type: DataTypes.INTEGER, allowNull: true }, // User.id
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    partner: { type: DataTypes.STRING(255), allowNull: false }, // university or aggregator that pays
    basis: { type: DataTypes.ENUM("percent", "fixed"), allowNull: false, defaultValue: "fixed" },
    percent: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    tuition_fee: { type: DataTypes.BIGINT, allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "INR" },
    amount_expected: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    amount_received: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM(...COMMISSION_STATUSES), allowNull: false, defaultValue: "expected" },
    due_on: { type: DataTypes.DATEONLY, allowNull: true }, // when the agency expects to bill / be paid
    invoice_ref: { type: DataTypes.STRING(100), allowNull: true },
    invoiced_on: { type: DataTypes.DATEONLY, allowNull: true },
    received_on: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: "commissions",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["agency_uuid", "status"] },
        { fields: ["case_id"] },
        { fields: ["university_app_id"] },
    ],
});

export default Commission;
