import { DataTypes } from "sequelize";
import sequelize from "../config/dbconfig";

const AgentService = sequelize.define('AgentService', {

    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    agent_uuid: {
        type: DataTypes.STRING,
    },
    // Section 1: Academic and Course Guidance

    // Do you offer course advising services? Yes/No
    courseAdvisors: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Specialization in course types (e.g., undergraduate, postgraduate)
    courseSpecialization: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // Do you provide university recommendations? Yes/No
    universityRecommendations: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // List of partnered universities
    partneredUniversities: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Fields of study specialization
    fieldExpertise: {
        type: DataTypes.TEXT,
        allowNull: true, // Comma-separated values or JSON
    },

    // Do you have formal partnerships with universities? Yes/No
    universityPartners: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Provide a list of university partners
    universityPartnersList: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Section 2: Country Specializations and Visa Assistance

    // Specialization in study abroad countries (related to Country model) -- mention on different table
    // countrySpecializations: {
    //     type: DataTypes.ARRAY(DataTypes.INTEGER),
    //     allowNull: true,
    // },

    // Do you provide visa consultancy? Yes/No
    visaConsultancy: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Specialization in visa types
    visaSpecialization: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Do you track visa success rates? Yes/No
    visaSuccessRate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Provide visa success rate details
    visaSuccessRateDetails: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    // Do you assist with work visa applications? Yes/No
    workVisaHelp: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Experience in transitioning to work visas
    workVisaExperience: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Section 3: Application and Documentation Support

    // Do you offer application review services? Yes/No
    applicationReview: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Real-time updates and tracking services
    applicationTracking: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Assistance with managing deadlines
    applicationDeadlines: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Document preparation services
    documentPreparation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Examples of SOPs or documents
    documentExamples: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Section 4: Scholarship and Budget Planning

    // Scholarship assistance services
    scholarshipAssistance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // List of scholarships and criteria
    scholarshipDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Financial planning and budgeting services
    budgetPlanning: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Tuition fee estimation and advice
    budgetDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Section 5: Language and Test Preparation

    // Language test preparation services
    languagePrep: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Specify language tests and duration
    languagePrepDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Assistance with standardized test preparation
    testPrep: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Section 6: Career and Internship Services

    // Career consulting services
    careerConsulting: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Specify career consulting areas
    careerConsultingDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Job placement services
    jobPlacement: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Internship programs
    internshipPrograms: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Section 7: Accommodation and Health Insurance

    // Accommodation assistance
    accommodationHelp: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    accommodationHelpText: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Health insurance selection assistance
    healthInsuranceOptions: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    healthInsuranceOptionsText: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Section 8: Additional Support Services

    // Assistance with part-time jobs
    partTimeJobs: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    partTimeJobsText: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // SOP writing services
    sopWriting: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    sopWritingText: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Post-graduation job assistance
    postGraduationJobs: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

    // Flight ticket booking assistance
    flightTicketAssistance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },

}, {
    timestamps: true,
    tableName: 'agent_services',
}
);

export default AgentService;
