import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

const Agent = sequelize.define('Agent', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
    },
    phone_number: {
        type: DataTypes.STRING,
    },
    country_code: {
        type: DataTypes.STRING,
        defaultValue: "+91"
    },
    phone: {
        type: DataTypes.VIRTUAL,
        get(this: any) {
            return (this.country_code !== null && this.phone_number !== null) ? this.country_code + " " + this.phone_number : null
        },
    },
    username: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
    },
    role: {
        type: DataTypes.ENUM("agent", "sub-agent", "tour-agent"), // Define main roles
        defaultValue: "agent"
    },
    parent_uuid:
    {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    designation: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.ENUM("active", "inactive"),
        defaultValue: "active",
    },
    otp: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    // fixed login code for the agency owner (sent in the welcome email), bcrypt hash; see services/agencyLogin.ts
    login_pin: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    login_pin_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    login_pin_locked_until: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    is_verified: {
        type: DataTypes.TINYINT,
        defaultValue: 0
    },
    profile_image: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    access_profile: {
        type: DataTypes.VIRTUAL,
        get(this: any) {
            return this.profile_image && this.profile_image !== "" ? `${process.env.LOCAL_PATH}public/profiles/${this.profile_image}` : null
        },
    },
    expires_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    // New fields 
    primary_color: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    primary_foreground_color: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    dark_primary_color: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    app_name: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    support_number: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    support_email: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    agency_address: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    certificate_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    favicon_url: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        // get(this: any) {
        //     const value = this.getDataValue('favicon_url');
        //     return value && value !== "" ? `${process.env.LOCAL_PATH}public/profiles/${value}` : null
        // },
    },
    meta_description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    meta_keywords: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    og_image: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        // get(this: any) {
        //     const value = this.getDataValue('og_image');
        //     return value && value !== "" ? `${process.env.LOCAL_PATH}public/profiles/${value}` : null
        // },
    },
    og_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    sudomain: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    domain: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    // CRM settings
    crm_auto_assign: {
        type: DataTypes.TINYINT,
        defaultValue: 0, // 1 = new leads are assigned round-robin to active team members
    },
    crm_last_assigned_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    // SaaS: current plan and what kind of access (expiry date stays in expires_at)
    saas_plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    saas_kind: {
        type: DataTypes.ENUM("trial", "paid", "complimentary"),
        allowNull: true,
        defaultValue: null
    },
    // notifications: also send important ones by email
    notify_email: {
        type: DataTypes.TINYINT,
        defaultValue: 1
    },
    // CRM follow-up rules: { new_lead_hours: number|null, stale_days: number|null } stored as JSON text
    crm_rules: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    // team members: what they do and which branch office they belong to
    team_role: {
        type: DataTypes.ENUM("counsellor", "branch_manager", "accounts", "documents"),
        defaultValue: "counsellor"
    },
    branch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    // any request by this user (agency usage report in the SaaS admin)
    last_active_at: { type: DataTypes.DATE, allowNull: true },
    // panel preferences of the agency owner: { checklist_hidden, sample_lead_ids } (JSON text)
    ui_prefs: { type: DataTypes.TEXT, allowNull: true },
    // client invoicing: { legal_name, gstin, address, invoice_prefix, default_gst_percent, upi_id, bank_details } as JSON text
    billing_settings: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    // the agency's own Razorpay keys for payment links, encrypted (helpers/crypto.ts)
    billing_credentials: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'agent',
    timestamps: true,
    paranoid:true,
    // never send the login code hash in API responses; read it only via Agent.scope("withLoginPin")
    defaultScope: { attributes: { exclude: ["login_pin", "login_pin_attempts", "login_pin_locked_until"] } },
    scopes: { withLoginPin: {} },
});

export default Agent;