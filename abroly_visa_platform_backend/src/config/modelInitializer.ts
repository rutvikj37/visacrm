import sequelize from "./dbconfig";
import { Model } from "sequelize";

// Import all models
import Accommodations from "../model/Accommodations";
import AddOn from "../model/AddOn";
import Admin from "../model/Admin";
import AgencyLeads from "../model/AgencyLeads";
import AgencyLeadsAssignHistory from "../model/AgencyLeadsAssignHistory";
import Agent from "../model/Agent";
import AgentApplications from "../model/AgentApplications";
import AgentCountrySpecialization from "../model/AgentCountrySpecialization";
import AgentEventBanner from "../model/AgentEventBanner";
import AgentEventBannerImages from "../model/AgentEventBannerImages";
import AgentEventBannerInterest from "../model/AgentEventBannerInterest";
import { AgentProfile, BranchOffice, Certification, Language } from "../model/AgentProfile";
import AgentService from "../model/AgentServices";
import AgentTransectionsToAdmin from "../model/AgentTransectionsToAdmin";
import Application from "../model/Application";
import Calendar from "../model/Calendar";
import ContactUs from "../model/ContactUs";
import ContentWriting from "../model/ContentWriting";
import ContentWritingServicesResponses from "../model/ContentWritingServicesResponses";
import ContentWritingServicesResponsesFiles from "../model/ContentWritingServicesResponsesFiles";
import ContentWritingSubPoints from "../model/ContentWritingSubPoints";
import CourseChapterPoints from "../model/CourseChapterPoints";
import CourseChapters from "../model/CourseChapters";
import CourseImages from "../model/CourseImages";
import CourseProgress from "../model/CourseProgress";
import CoursePurchase from "../model/CoursePurchase";
import Courses from "../model/Courses";
import EventBanner from "../model/EventBanner";
import EventBannerImage from "../model/EventBannerImage";
import EventBannerResponses from "../model/EventBannerResponses";
import Faq from "../model/Faq";
import GeneratedReport from "../model/GeneratedReport";
import HealthIns from "../model/HealthIns";
import JobApplicants from "../model/JobApplicants";
import JobPost from "../model/JobPost";
import LeadsCalendar from "../model/LeadsCalendar";
import OfflineLanguageInquiries from "../model/OfflineLanguageInquiries";
import OfflineLanguagesAgents from "../model/OfflineLanguagesAgents";
import OfflineLanguagesMaster from "../model/OfflineLanguagesMaster";
import Package from "../model/Packages";
import Question from "../model/Question";
import QuizAnswers from "../model/QuizAnswers";
import QuizQuestions from "../model/QuizQuestions";
import RaisedApplications from "../model/RaisedApplications";
import ServiceInfo from "../model/ServiceInfo";
import SideBanner from "../model/SideBanner";
import SideBannerResponses from "../model/SideBannerResponses";
import SimCards from "../model/SimCards";
import StaticContent from "../model/StaticContent";
import Step from "../model/Step";
import StudentBasicDetails from "../model/StudentBasicDetails";
import StudentCoins from "../model/StudentCoins";
import Subscription from "../model/Subscription";
import Testimonial from "../model/Testimonial";
import User from "../model/User";
import UserDevices from "../model/UserDevices";
import VisaType from "../model/VisaType";
import Layout from "../model/Layout";
import ServiceFromResponse from "../model/ServiceFromResponse";
import CrmLead from "../model/CrmLead";
import CrmLeadActivity from "../model/CrmLeadActivity";
import LeadIntegration from "../model/LeadIntegration";
import VisaTemplate from "../model/VisaTemplate";
import ClientForm from "../model/ClientForm";
import ClientFormAssignment from "../model/ClientFormAssignment";
import ClientFormSubmission from "../model/ClientFormSubmission";
import SaasPlan from "../model/SaasPlan";
import SaasSubscription from "../model/SaasSubscription";
import SaasPayment from "../model/SaasPayment";
import Notification from "../model/Notification";
import MarketingSpend from "../model/MarketingSpend";
import AgencyBranch from "../model/AgencyBranch";
import ClientInvoice from "../model/ClientInvoice";
import ClientPayment from "../model/ClientPayment";
import MessageTemplate from "../model/MessageTemplate";
import PlatformSetting from "../model/PlatformSetting";
import SaasCoupon from "../model/SaasCoupon";
import AgencyModule from "../model/AgencyModule";
import Announcement from "../model/Announcement";
import AnnouncementDismissal from "../model/AnnouncementDismissal";
import ActivityLog from "../model/ActivityLog";
import AgencyService from "../model/AgencyService";
import ServiceOrder from "../model/ServiceOrder";
import ServiceOrderUpdate from "../model/ServiceOrderUpdate";
import PortalChatMessage from "../model/PortalChatMessage";
import WhatsappPendingChat from "../model/WhatsappPendingChat";
import AgencyTask from "../model/AgencyTask";
import UniversityApplication from "../model/UniversityApplication";
import Commission from "../model/Commission";
import PlatformErrorLog from "../model/PlatformErrorLog";
import PlatformSchedulerHeartbeat from "../model/PlatformSchedulerHeartbeat";

interface SyncOptions {
  force?: boolean;
  alter?: boolean | { drop: boolean };
}

class ModelInitializer {
  private static instance: ModelInitializer;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ModelInitializer {
    if (!ModelInitializer.instance) {
      ModelInitializer.instance = new ModelInitializer();
    }
    return ModelInitializer.instance;
  }

  /**
   * Initialize database models with proper sequencing
   */
  public async initializeModels(options: SyncOptions = {}): Promise<void> {
    if (this.isInitialized) {
      console.log("Models already initialized");
      return;
    }

    try {
      console.log("🔄 Starting model initialization...");
      
      // Test database connection first
      await this.testConnection();
      
      // Sync models in dependency order
      await this.syncModelsInOrder(options);
      
      // Set up associations
      this.setupAssociations();
      
      this.isInitialized = true;
      console.log("✅ Model initialization completed successfully");
      
    } catch (error) {
      console.error("❌ Model initialization failed:", error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      await sequelize.authenticate();
      console.log("✅ Database connection established successfully");
    } catch (error) {
      console.error("❌ Unable to connect to database:", error);
      throw error;
    }
  }

  /**
   * Sync models in proper dependency order to avoid foreign key constraint errors
   */
  private async syncModelsInOrder(options: SyncOptions): Promise<void> {
    console.log("🔄 Syncing models...");
    
    // Base models (no dependencies)
    const baseModels = [
      Admin, User, Agent, Package, Courses, EventBanner, JobPost, 
      Faq, ContactUs, StaticContent, VisaType, SimCards, HealthIns,
      Accommodations, ServiceInfo, Testimonial, ContentWriting,
      OfflineLanguagesMaster, GeneratedReport, Layout, ServiceFromResponse
    ];

    // Models with dependencies (sync after base models)
    const dependentModels = [
      AgentProfile, BranchOffice, Certification, Language,
      Subscription, AddOn, Calendar, CoursePurchase, CourseChapters,
      CourseChapterPoints, CourseImages, CourseProgress, SideBanner,
      EventBannerImage, EventBannerResponses, JobApplicants,
      AgencyLeads, RaisedApplications, Step, Question, LeadsCalendar,
      AgentEventBanner, AgentEventBannerImages, AgentEventBannerInterest,
      OfflineLanguagesAgents, OfflineLanguageInquiries, AgentTransectionsToAdmin,
      AgencyLeadsAssignHistory, AgentApplications, AgentCountrySpecialization,
      AgentService, Application, ContentWritingServicesResponses,
      ContentWritingServicesResponsesFiles, ContentWritingSubPoints,
      QuizAnswers, QuizQuestions, SideBannerResponses, StudentBasicDetails,
      StudentCoins, UserDevices,
      // CRM
      LeadIntegration, CrmLead, CrmLeadActivity, VisaTemplate, ClientForm, ClientFormAssignment, ClientFormSubmission,
      // SaaS billing
      SaasPlan, SaasSubscription, SaasPayment,
      Notification, MarketingSpend, AgencyBranch, ClientInvoice, ClientPayment, MessageTemplate, PlatformSetting, SaasCoupon, Announcement, AnnouncementDismissal, ActivityLog, AgencyService, ServiceOrder, ServiceOrderUpdate, PortalChatMessage, WhatsappPendingChat, AgencyTask, UniversityApplication, Commission, PlatformErrorLog, PlatformSchedulerHeartbeat,
      // module overrides per agency
      AgencyModule
    ];

    // Sync base models first
    for (const model of baseModels) {
      try {
        await model.sync(options);
        console.log(`✅ Synced: ${model.name}`);
      } catch (error) {
        console.error(`❌ Failed to sync ${model.name}:`, error);
        throw error;
      }
    }

    // Then sync dependent models
    for (const model of dependentModels) {
      try {
        await model.sync(options);
        console.log(`✅ Synced: ${model.name}`);
      } catch (error) {
        console.error(`❌ Failed to sync ${model.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Set up all model associations
   */
  private setupAssociations(): void {
    console.log("🔄 Setting up model associations...");
    
    try {
      // Course relationships
      this.setupCourseAssociations();
      
      // Job relationships
      this.setupJobAssociations();
      
      // Agent relationships
      this.setupAgentAssociations();
      
      // Subscription relationships
      this.setupSubscriptionAssociations();
      
      // Calendar relationships
      this.setupCalendarAssociations();
      
      // Event Banner relationships
      this.setupEventBannerAssociations();
      
      // Agency Leads relationships
      this.setupAgencyLeadsAssociations();
      
      // Language preparation relationships
      this.setupLanguageAssociations();
      
      // Transaction relationships
      this.setupTransactionAssociations();

      // CRM lead relationships
      this.setupCrmAssociations();
      
      console.log("✅ All associations set up successfully");
      
    } catch (error) {
      console.error("❌ Failed to setup associations:", error);
      throw error;
    }
  }

  private setupCourseAssociations(): void {
    // Courses -> CourseChapters
    Courses.hasMany(CourseChapters, {
      foreignKey: "course_uuid",
      as: "chapters",
      sourceKey: "uuid"
    });
    
    CourseChapters.belongsTo(Courses, {
      foreignKey: "course_uuid",
      as: "chapter_of",
      targetKey: "uuid"
    });

    // CourseChapters -> CourseChapterPoints
    CourseChapters.hasMany(CourseChapterPoints, {
      foreignKey: "chapter_uuid",
      as: "chapter_points",
      sourceKey: "uuid"
    });
    
    CourseChapterPoints.belongsTo(CourseChapters, {
      foreignKey: "chapter_uuid",
      as: "chapter_point_of",
      targetKey: "uuid"
    });

    // Course Purchase relationships
    CoursePurchase.belongsTo(Courses, {
      foreignKey: "course_uuid",
      targetKey: "uuid",
      as: "course_of"
    });
    
    Courses.hasMany(CoursePurchase, {
      foreignKey: "course_uuid",
      sourceKey: "uuid",
      as: "purchased"
    });
    
    CoursePurchase.belongsTo(User, {
      foreignKey: "student_uuid",
      targetKey: "uuid",
      as: "student"
    });
    
    User.hasMany(CoursePurchase, {
      foreignKey: "student_uuid",
      sourceKey: "uuid",
      as: "courses"
    });
  }

  private setupJobAssociations(): void {
    JobApplicants.belongsTo(User, {
      foreignKey: "user_uuid",
      as: "applicant_user",
      targetKey: "uuid"
    });
    
    User.hasMany(JobApplicants, {
      foreignKey: "user_uuid",
      as: "applied_for",
      sourceKey: "uuid"
    });

    JobApplicants.belongsTo(JobPost, {
      foreignKey: "job_post_uuid",
      as: "applicant_job",
      targetKey: "uuid"
    });
    
    JobPost.hasMany(JobApplicants, {
      foreignKey: "job_post_uuid",
      as: "job_applicants",
      sourceKey: "uuid"
    });
  }

  private setupAgentAssociations(): void {
    // Agent -> AgentProfile
    Agent.hasOne(AgentProfile, { 
      foreignKey: 'agent_uuid', 
      as: 'profile', 
      sourceKey: "uuid" 
    });

    // AgentProfile relationships
    AgentProfile.hasMany(BranchOffice, { 
      foreignKey: 'agentProfileUUID', 
      as: 'branchOffices', 
      sourceKey: "uuid" 
    });
    BranchOffice.belongsTo(AgentProfile, { 
      foreignKey: 'agentProfileUUID', 
      targetKey: "uuid" 
    });

    AgentProfile.hasMany(Certification, { 
      foreignKey: 'agentProfileUUID', 
      as: 'certifications', 
      sourceKey: "uuid" 
    });
    Certification.belongsTo(AgentProfile, { 
      foreignKey: 'agentProfileUUID', 
      targetKey: "uuid" 
    });

    AgentProfile.hasMany(Language, { 
      foreignKey: 'agentProfileUUID', 
      as: 'languages', 
      sourceKey: "uuid" 
    });
    Language.belongsTo(AgentProfile, { 
      foreignKey: 'agentProfileUUID', 
      targetKey: "uuid" 
    });

    // Side Banner relationships
    SideBanner.belongsTo(Agent, {
      foreignKey: "agent_uuid",
      targetKey: "uuid",
      as: "banner_of"
    });
    
    Agent.hasMany(SideBanner, {
      foreignKey: "agent_uuid",
      sourceKey: "uuid",
      as: "achievements"
    });

    // Agent Event Banner Interest
    AgentEventBannerInterest.belongsTo(Agent, {
      foreignKey: "agent_id",
      targetKey: "id",
      as: "agent"
    });
    
    Agent.hasMany(AgentEventBannerInterest, {
      foreignKey: "agent_id",
      sourceKey: "id",
      as: "interests"
    });
  }

  private setupSubscriptionAssociations(): void {
    Agent.hasMany(Subscription, { 
      foreignKey: 'agent_uuid', 
      sourceKey: "uuid" 
    });
    Subscription.belongsTo(Agent, { 
      foreignKey: 'agent_uuid', 
      targetKey: "uuid" 
    });

    Package.hasMany(Subscription, { 
      foreignKey: 'package_uuid', 
      sourceKey: "uuid" 
    });
    Subscription.belongsTo(Package, { 
      foreignKey: 'package_uuid', 
      targetKey: "uuid" 
    });

    Subscription.hasMany(AddOn, { 
      foreignKey: 'subscription_uuid', 
      sourceKey: "uuid" 
    });
    AddOn.belongsTo(Subscription, { 
      foreignKey: 'subscription_uuid', 
      targetKey: "uuid" 
    });
  }

  private setupCalendarAssociations(): void {
    Calendar.belongsTo(Agent, {
      foreignKey: "assgin_to",
      targetKey: "uuid",
      as: 'to_assign'
    });

    Agent.hasMany(Calendar, {
      foreignKey: "assgin_to",
      sourceKey: "uuid",
      as: "events_assigned_to"
    });

    Calendar.belongsTo(Agent, {
      foreignKey: "assign_by",
      targetKey: "uuid",
      as: 'by_assign'
    });

    Agent.hasMany(Calendar, {
      foreignKey: "assign_by",
      sourceKey: "uuid",
      as: "events_assigned_for"
    });
  }

  private setupEventBannerAssociations(): void {
    // EventBanner -> EventBannerImage
    EventBanner.hasMany(EventBannerImage, {
      foreignKey: "eventBannerId",
      sourceKey: "uuid",
      as: "images"
    });

    EventBannerImage.belongsTo(EventBanner, {
      foreignKey: "eventBannerId",
      targetKey: "uuid",
      as: "banner"
    });

    // AgentEventBanner -> AgentEventBannerImages
    AgentEventBanner.hasMany(AgentEventBannerImages, {
      foreignKey: "agent_event_banner_id",
      sourceKey: "id",
      as: "images"
    });

    AgentEventBannerImages.belongsTo(AgentEventBanner, {
      foreignKey: "agent_event_banner_id",
      targetKey: "id",
      as: "banner"
    });
  }

  private setupCrmAssociations(): void {
    CrmLead.hasMany(CrmLeadActivity, { foreignKey: "lead_id", sourceKey: "id", as: "activities" });
    CrmLeadActivity.belongsTo(CrmLead, { foreignKey: "lead_id", targetKey: "id", as: "lead" });

    CrmLead.belongsTo(Agent, { foreignKey: "assigned_to", targetKey: "id", as: "assignee" });
    CrmLeadActivity.belongsTo(Agent, { foreignKey: "created_by", targetKey: "id", as: "author" });

    ClientInvoice.hasMany(ClientPayment, { foreignKey: "invoice_id", sourceKey: "id", as: "payments" });
    ClientPayment.belongsTo(ClientInvoice, { foreignKey: "invoice_id", targetKey: "id", as: "invoice" });
    ClientInvoice.belongsTo(User, { foreignKey: "student_id", targetKey: "id", as: "student" });

    SaasSubscription.belongsTo(SaasPlan, { foreignKey: "plan_id", targetKey: "id", as: "plan" });
    SaasPayment.belongsTo(SaasPlan, { foreignKey: "plan_id", targetKey: "id", as: "plan" });
    SaasPayment.belongsTo(SaasCoupon, { foreignKey: "coupon_id", targetKey: "id", as: "coupon", constraints: false });
    Agent.belongsTo(SaasPlan, { foreignKey: "saas_plan_id", targetKey: "id", as: "saas_plan" });

    CrmLead.belongsTo(LeadIntegration, { foreignKey: "integration_id", targetKey: "id", as: "integration" });
    LeadIntegration.hasMany(CrmLead, { foreignKey: "integration_id", sourceKey: "id", as: "leads" });

    ClientForm.hasMany(ClientFormAssignment, { foreignKey: "form_id", sourceKey: "id", as: "assignments" });
    ClientFormAssignment.belongsTo(ClientForm, { foreignKey: "form_id", targetKey: "id", as: "form" });
    ClientForm.hasMany(ClientFormSubmission, { foreignKey: "form_id", sourceKey: "id", as: "submissions" });
    ClientFormSubmission.belongsTo(ClientForm, { foreignKey: "form_id", targetKey: "id", as: "form" });
  }

  private setupAgencyLeadsAssociations(): void {
    // Agent -> AgencyLeads
    AgencyLeads.belongsTo(Agent, {
      foreignKey: "agent_uuid",
      targetKey: "uuid",
      as: "lead_of"
    });

    Agent.hasMany(AgencyLeads, {
      foreignKey: "agent_uuid",
      sourceKey: "uuid",
      as: "leads"
    });

    // User -> AgencyLeads
    AgencyLeads.belongsTo(User, {
      foreignKey: "user_id",
      targetKey: "id",
      as: "user_of"
    });

    User.hasMany(AgencyLeads, {
      foreignKey: "user_id",
      sourceKey: "id",
      as: "leads_of"
    });

    // RaisedApplications -> AgencyLeads
    AgencyLeads.belongsTo(RaisedApplications, {
      foreignKey: "raised_aplication_id",
      targetKey: "id",
      as: "application_of"
    });

    RaisedApplications.hasMany(AgencyLeads, {
      foreignKey: "raised_aplication_id",
      sourceKey: "id",
      as: "leads_of"
    });

    // Step -> Question
    Step.hasMany(Question, {
      foreignKey: "step_id",
      sourceKey: "id",
      as: "questions"
    });
    
    Question.belongsTo(Step, {
      foreignKey: "step_id",
      targetKey: "id",
      as: "step"
    });

    Question.belongsTo(Agent, {
      foreignKey: "agent_id",
      targetKey: "id",
      as: "created_by"
    });

    // LeadsCalendar relationships
    LeadsCalendar.belongsTo(User, {
      foreignKey: "user_id",
      targetKey: "id",
      as: "student"
    });

    AgencyLeads.hasMany(LeadsCalendar, {
      foreignKey: "lead_id",
      sourceKey: "id",
      as: "follow_ups"
    });

    LeadsCalendar.belongsTo(AgencyLeads, {
      foreignKey: "lead_id",
      targetKey: "id",
      as: "lead"
    });

    // Step -> AgencyLeads
    Step.belongsTo(AgencyLeads, {
      foreignKey: "lead_id",
      targetKey: "id",
      as: "lead"
    });

    AgencyLeads.hasMany(Step, {
      foreignKey: "lead_id",
      sourceKey: "id",
      as: "steps"
    });

    AgencyLeads.belongsTo(User, {
      foreignKey: "user_id",
      targetKey: "id",
      as: "user"
    });
  }

  private setupLanguageAssociations(): void {
    // Agent -> OfflineLanguagesAgents
    Agent.hasMany(OfflineLanguagesAgents, {
      foreignKey: "agent_id",
      sourceKey: "id",
      as: "languages"
    });

    OfflineLanguagesAgents.belongsTo(Agent, {
      foreignKey: "agent_id",
      targetKey: "id",
      as: "agent"
    });

    // OfflineLanguageInquiries -> User
    OfflineLanguageInquiries.belongsTo(User, {
      foreignKey: "user_id",
      targetKey: "id",
      as: "student"
    });
  }

  private setupTransactionAssociations(): void {
    // AgentTransectionsToAdmin -> Agent
    AgentTransectionsToAdmin.belongsTo(Agent, {
      foreignKey: "agent_id",
      targetKey: "id",
      as: "agent"
    });

    // AgentTransectionsToAdmin -> Package
    AgentTransectionsToAdmin.belongsTo(Package, {
      foreignKey: "plan_id",
      targetKey: "id",
      as: "package"
    });
  }

  /**
   * Get initialization status
   */
  public isModelInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Set up associations only (without syncing models)
   * Useful when you want to use existing database schema
   */
  public setupAssociationsOnly(): void {
    if (this.isInitialized) {
      console.log("Associations already set up");
      return;
    }
    
    try {
      this.setupAssociations();
      this.isInitialized = true; // Mark as initialized to prevent re-running
      console.log("✅ Model associations set up successfully (no sync)");
    } catch (error) {
      console.error("❌ Failed to setup associations:", error);
      throw error;
    }
  }

  /**
   * Force re-initialization (useful for testing)
   */
  public async reinitialize(options: SyncOptions = {}): Promise<void> {
    this.isInitialized = false;
    await this.initializeModels(options);
  }
}

export default ModelInitializer;
