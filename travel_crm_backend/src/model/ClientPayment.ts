import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

/** Money received against a client invoice (paise). Each payment is also a receipt. */
const ClientPayment = sequelize.define('ClientPayment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
    invoice_id: { type: DataTypes.INTEGER, allowNull: false },
    receipt_number: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.BIGINT, allowNull: false },
    method: { type: DataTypes.ENUM("cash", "upi", "bank_transfer", "card", "cheque", "razorpay", "cashfree", "other"), defaultValue: "upi" },
    reference: { type: DataTypes.STRING, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: false },
    received_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'client_payments',
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ['invoice_id'] }, { fields: ['agency_uuid', 'paid_at'] }]
});

export default ClientPayment;
