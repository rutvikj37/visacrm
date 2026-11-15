// Accommodations.sync({alter:true})
// AddOn.sync({alter:true})
// Admin.sync({alter:true})
// AgencyLeads.sync({alter:true})
// AgencyLeadsAssignHistory.sync({alter:true})
// Agent.sync({alter:true})
// AgentApplications.sync({alter:true})
// AgentCountrySpecialization.sync({alter:true})
// AgentEventBanner.sync({alter:true})
// AgentEventBannerImages.sync({alter:true})
// AgentEventBannerInterest.sync({alter:true})
// AgentProfile.sync({alter:true})
// BranchOffice.sync({alter:true})
// Certification.sync({alter:true})
// Language.sync({alter:true})
// AgentService.sync({alter:true})
// AgentTransectionsToAdmin.sync({alter:true})
// Application.sync({alter:true})
// Calendar.sync({alter:true})
// ContactUs.sync({alter:true})
// ContentWriting.sync({alter:true})
// ContentWritingServicesResponses.sync({alter:true})
// ContentWritingServicesResponsesFiles.sync({alter:true})
// ContentWritingSubPoints.sync({alter:true})
// CourseChapterPoints.sync({alter:true})
// CourseChapters.sync({alter:true})
// CourseImages.sync({alter:true})
// CourseProgress.sync({alter:true})
// CoursePurchase.sync({alter:true})
// Courses.sync({alter:true})
// EventBanner.sync({alter:true})
// EventBannerImage.sync({alter:true})
// EventBannerResponses.sync({alter:true})
// Faq.sync({alter:true})
// HealthIns.sync({alter:true})
// JobApplicants.sync({alter:true})
// JobPost.sync({alter:true})
// LeadsCalendar.sync({alter:true})
// OfflineLanguageInquiries.sync({alter:true})
// OfflineLanguagesAgents.sync({alter:true})
// OfflineLanguagesMaster.sync({alter:true})
// Package.sync({alter:true})
// Question.sync({alter:true})
// QuizAnswers.sync({alter:true})
// QuizQuestions.sync({alter:true})
// RaisedApplications.sync({alter:true})
// ServiceInfo.sync({alter:true})
// SideBanner.sync({alter:true})
// SideBannerResponses.sync({alter:true})
// SimCards.sync({alter:true})
// StaticContent.sync({alter:true})
// Step.sync({alter:true})
// StudentBasicDetails.sync({alter:true})
// StudentCoins.sync({alter:true})
// Subscription.sync({alter:true})
// Testimonial.sync({alter:true})
// User.sync({alter:true})
// UserDevices.sync({alter:true})
// VisaType.sync({alter:true})

import AddOn from "../model/AddOn"
import Agent from "../model/Agent"
import { AgentProfile, BranchOffice, Certification, Language } from "../model/AgentProfile"
import Calendar from "../model/Calendar"
import CourseChapterPoints from "../model/CourseChapterPoints"
import CourseChapters from "../model/CourseChapters"
import CoursePurchase from "../model/CoursePurchase"
import Courses from "../model/Courses"
import EventBannerImage from "../model/EventBannerImage"
import EventBanner from "../model/EventBanner"
import JobApplicants from "../model/JobApplicants"
import JobPost from "../model/JobPost"
import Package from "../model/Packages"
import SideBanner from "../model/SideBanner"
import Subscription from "../model/Subscription"
import User from "../model/User"
import AgencyLeads from "../model/AgencyLeads"
import RaisedApplications from "../model/RaisedApplications"
import sequelize from "./dbconfig"
import Question from "../model/Question"
import Step from "../model/Step"
import LeadsCalendar from "../model/LeadsCalendar"
import AgentEventBannerImages from "../model/AgentEventBannerImages"
import AgentEventBanner from "../model/AgentEventBanner"
import AgentEventBannerInterest from "../model/AgentEventBannerInterest"
import OfflineLanguagesAgents from "../model/OfflineLanguagesAgents"
import OfflineLanguageInquiries from "../model/OfflineLanguageInquiries"
import AgentTransectionsToAdmin from "../model/AgentTransectionsToAdmin"
import Accommodations from "../model/Accommodations"
import Admin from "../model/Admin"
import AgencyLeadsAssignHistory from "../model/AgencyLeadsAssignHistory"
import AgentApplications from "../model/AgentApplications"
import AgentCountrySpecialization from "../model/AgentCountrySpecialization"
import AgentService from "../model/AgentServices"
import Application from "../model/Application"
import ContactUs from "../model/ContactUs"
import ContentWriting from "../model/ContentWriting"
import ContentWritingServicesResponses from "../model/ContentWritingServicesResponses"
import ContentWritingServicesResponsesFiles from "../model/ContentWritingServicesResponsesFiles"
import ContentWritingSubPoints from "../model/ContentWritingSubPoints"
import CourseImages from "../model/CourseImages"
import CourseProgress from "../model/CourseProgress"
import EventBannerResponses from "../model/EventBannerResponses"
import Faq from "../model/Faq"
import HealthIns from "../model/HealthIns"
import OfflineLanguagesMaster from "../model/OfflineLanguagesMaster"
import QuizAnswers from "../model/QuizAnswers"
import QuizQuestions from "../model/QuizQuestions"
import ServiceInfo from "../model/ServiceInfo"
import SideBannerResponses from "../model/SideBannerResponses"
import SimCards from "../model/SimCards"
import StaticContent from "../model/StaticContent"
import StudentBasicDetails from "../model/StudentBasicDetails"
import StudentCoins from "../model/StudentCoins"
import Testimonial from "../model/Testimonial"
import UserDevices from "../model/UserDevices"
import VisaType from "../model/VisaType"
import GeneratedReport from "../model/GeneratedReport"


/**
 * @deprecated This file is deprecated. Use ModelInitializer instead.
 * 
 * This approach had several issues:
 * - No error handling
 * - Unreliable setTimeout for associations
 * - No dependency ordering for sync operations
 * - Mixed concerns (sync + associations)
 * - Not properly integrated with server startup
 * 
 * @see ModelInitializer for the improved implementation
 */

import ModelInitializer from './modelInitializer';

const associateModels = async () => {
    console.warn('⚠️  associateModels is deprecated. Use ModelInitializer instead.');
    
    const initializer = ModelInitializer.getInstance();
    
    // Use appropriate sync options based on environment
    const syncOptions = {
        alter: process.env.NODE_ENV !== 'production', // Only use alter in development
        force: false // Never use force in production
    };
    
    await initializer.initializeModels(syncOptions);
}

export default associateModels
