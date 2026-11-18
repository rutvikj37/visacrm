// models/AddOn.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';

const AgencyLeads = sequelize.define('AgencyLeads', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    raised_aplication_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    agent_uuid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM("pending", "suggested", "accepted", "assign_to_agent", "application_progress", "visa_progress", "visa_completed", "visa_rejected", "withdrawn","withdrawn_by_student"),
        defaultValue: "pending"
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    suggestions: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    last_follow_up_remark:{
        type:DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    selected_suggestion: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
    },
    lead_type:{
        type:DataTypes.ENUM("offline","online"),
        defaultValue:"online"
    },
    assign_id:{
        type:DataTypes.INTEGER,
        allowNull: true,
    },
    selected_country:{
        type:DataTypes.STRING,
        allowNull: true
    },
    selected_intake_year:{
        type:DataTypes.STRING,
        allowNull: true
    },
    // visa case board: where an in-progress case is now
    case_stage:{
        type:DataTypes.ENUM("documents","application","offer","funds","visa_filed","biometrics","decision"),
        allowNull: true,
        defaultValue: null
    },
    stage_updated_at:{
        type:DataTypes.DATE,
        allowNull: true
    },
    university:{
        type:DataTypes.STRING,
        allowNull: true
    },
    // tourist / business visas: itinerary, cover letter and funds check (JSON) - see CaseController.travelDocs
    travel_docs:{
        type:DataTypes.TEXT,
        allowNull: true
    },
    // last automatic "documents pending" reminder sent to the student
    docs_reminded_at:{
        type:DataTypes.DATE,
        allowNull: true
    },
    // branch office that owns this visa case (null = not in a branch) - see services/branches.ts
    branch_id:{
        type:DataTypes.INTEGER,
        allowNull: true
    },
    // visa application timeline (CaseController.saveVisa)
    visa_lodged_on:{ type:DataTypes.DATEONLY, allowNull: true },
    biometrics_on:{ type:DataTypes.DATEONLY, allowNull: true },
    decision_on:{ type:DataTypes.DATEONLY, allowNull: true },
    // structured reason when the visa is refused (REFUSAL_REASONS in CaseController); free text stays in `reason`
    refusal_reason:{ type:DataTypes.STRING(50), allowNull: true },
    // a new case opened after a refusal points back to the refused one
    reapplied_from:{ type:DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'agency_leads',
    timestamps: true,
    paranoid: true
});

export default AgencyLeads;
