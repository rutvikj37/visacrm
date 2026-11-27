import { signedFileUrl } from "../helpers/privateFiles";
// models/AddOn.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

const AgentTransectionsToAdmin = sequelize.define('AgentTransectionsToAdmin', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    agent_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    plan_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    transection_id: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    transaction_type: {
        type: DataTypes.ENUM("net_banking", "upi", "other"),
        defaultValue: "net_banking"
    },
    transection_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    amount: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    payment_proof: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM("pending", "accepted", "rejected"),
        defaultValue: "pending"
    },

    // payment_proof
    access_file: {
        type: DataTypes.VIRTUAL,
        get(this: any) {
            return signedFileUrl("subscription_proof", this.payment_proof) // short-lived signed link (private storage)
        },
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'agency_transections_to_admin',
    timestamps: true,
    paranoid: true
});

export default AgentTransectionsToAdmin;
