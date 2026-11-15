import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * A bill from an agency to one of its students (service fee, application fee ...).
 * All money is stored in paise. items: [{ description, amount }], installments: [{ label, amount, due_date }]
 */
const ClientInvoice = sequelize.define('ClientInvoice', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    number: { type: DataTypes.STRING, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false }, // User.id
    case_id: { type: DataTypes.INTEGER, allowNull: true },     // AgencyLeads.id
    title: { type: DataTypes.STRING, allowNull: true },
    items: { type: DataTypes.JSON, allowNull: false, get: jsonGetter('items') },
    subtotal: { type: DataTypes.BIGINT, defaultValue: 0 },
    gst_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    gst_amount: { type: DataTypes.BIGINT, defaultValue: 0 },
    total: { type: DataTypes.BIGINT, defaultValue: 0 },
    amount_paid: { type: DataTypes.BIGINT, defaultValue: 0 },
    status: { type: DataTypes.ENUM("unpaid", "partial", "paid", "cancelled"), defaultValue: "unpaid" },
    issue_date: { type: DataTypes.DATEONLY, allowNull: false },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    installments: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('installments') },
    notes: { type: DataTypes.TEXT, allowNull: true },
    payment_link_id: { type: DataTypes.STRING, allowNull: true },
    payment_link_url: { type: DataTypes.STRING, allowNull: true },
    reminded_at: { type: DataTypes.DATE, allowNull: true }, // last automatic fee reminder
    branch_id: { type: DataTypes.INTEGER, allowNull: true }, // branch that billed it (its address / GSTIN / number series)
    // bought from the agency's services store in the student portal (AgencyService.id)
    service_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'client_invoices',
    timestamps: true,
    paranoid: true,
    indexes: [
        { unique: true, fields: ['agency_uuid', 'number'] },
        { unique: true, fields: ['uuid'] },
        { fields: ['agency_uuid', 'status'] },
        { fields: ['student_id'] },
    ]
});

export default ClientInvoice;
