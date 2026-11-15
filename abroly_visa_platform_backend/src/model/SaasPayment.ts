import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/** Money received from an agency: online (Razorpay) or recorded by the admin (UPI, bank transfer ...). */
const SaasPayment = sequelize.define('SaasPayment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    plan_id: { type: DataTypes.INTEGER, allowNull: true },
    months: { type: DataTypes.INTEGER, defaultValue: 1 },
    amount: { type: DataTypes.INTEGER, defaultValue: 0 }, // paise
    currency: { type: DataTypes.STRING, defaultValue: "INR" },
    method: { type: DataTypes.ENUM("razorpay", "upi", "bank_transfer", "cash", "cheque", "other"), defaultValue: "razorpay" },
    status: { type: DataTypes.ENUM("created", "paid", "failed"), defaultValue: "created" },
    razorpay_order_id: { type: DataTypes.STRING, allowNull: true },
    razorpay_payment_id: { type: DataTypes.STRING, allowNull: true },
    reference: { type: DataTypes.STRING, allowNull: true }, // UTR / cheque no. for manual payments
    note: { type: DataTypes.TEXT, allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    created_by_admin: { type: DataTypes.INTEGER, allowNull: true },
    // price before discount, discount and coupon (paise); amount above is what was charged
    list_amount: { type: DataTypes.INTEGER, allowNull: true },
    discount: { type: DataTypes.INTEGER, defaultValue: 0 },
    coupon_id: { type: DataTypes.INTEGER, allowNull: true },
    coupon_code: { type: DataTypes.STRING(40), allowNull: true },
    // GST tax invoice, fixed when the payment is marked paid (paise)
    invoice_number: { type: DataTypes.STRING(20), allowNull: true },
    invoice_date: { type: DataTypes.DATE, allowNull: true },
    gst_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    taxable_amount: { type: DataTypes.INTEGER, allowNull: true },
    cgst: { type: DataTypes.INTEGER, defaultValue: 0 },
    sgst: { type: DataTypes.INTEGER, defaultValue: 0 },
    igst: { type: DataTypes.INTEGER, defaultValue: 0 },
    seller: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("seller") },
    buyer: { type: DataTypes.JSON, allowNull: true, get: jsonGetter("buyer") },
    // failed online payments and the reminders sent about them
    failure_reason: { type: DataTypes.STRING(500), allowNull: true },
    failed_at: { type: DataTypes.DATE, allowNull: true },
    followup_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_followup_at: { type: DataTypes.DATE, allowNull: true },
    resolved: { type: DataTypes.BOOLEAN, defaultValue: false }, // agency paid later / admin closed it
}, {
    tableName: 'saas_payments',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['agency_uuid'] }, { unique: true, fields: ['razorpay_order_id'] }, { unique: true, fields: ['invoice_number'] }, { fields: ['coupon_id'] }]
});

export default SaasPayment;
