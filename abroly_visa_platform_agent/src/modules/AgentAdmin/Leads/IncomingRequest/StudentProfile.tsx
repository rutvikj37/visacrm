import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import {
  MessageSquare,
  User,
  Mail,
  Phone,
  Globe,
  Paperclip,
  GraduationCap,
  Briefcase,
  DollarSign,
  Calendar,
  Building2,
  MapPin,
  School,
  BookOpen,
  Target,
  Award,
  FileText, 
  ArrowRight,
} from "lucide-react";
import { countries } from "country-data";
import { Button, Chip, Spinner as HeroSpinner } from "@heroui/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BackButton from "@/components/BackButton";
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from "@/lib/theme";

const StudentProfile = () => {
  const navigate = useNavigate();

  const { id } = useParams();
  const { commonGetAPICalls } = useApiCallUtils();

  const fetchStudentProfile = async (id) => {
    const { success, data, message } = await commonGetAPICalls(
      `/leads/student_profile/${id}`
    );
    if (success === true) {
      return data;
    }
    throw new Error(message);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student_profile", id],
    queryFn: () => fetchStudentProfile(id),
  });

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}20` }}></div>
            <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }}></div>
          </div>
          <p className="text-sm font-medium text-gray-600 animate-pulse" style={{ color: BRAND_TEXT }}>
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30 flex items-center justify-center p-4">
        <div className="text-center py-16 bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl border-2 border-red-200 shadow-sm max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-red-700 font-semibold text-base mb-2">Error loading profile</p>
          <p className="text-sm text-red-500">{error.message}</p>
        </div>
      </div>
    );
  }

  // Destructure the data for easy access
  const { student, studentDetails, applications } = data || {};

  const qaItem = (question, answer, Icon?) => {
    const displayValue =
      answer !== null && answer !== undefined
        ? answer.toString()
        : "Not specified";
    return (
      <div 
        className="flex items-start gap-3 p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200/50 
                   hover:bg-white hover:shadow-md transition-all group/item"
        style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = PRIMARY_COLOR;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
        }}
      >
        {Icon && (
          <div 
            className="p-1.5 rounded-md mt-0.5 flex-shrink-0 transition-colors"
            style={{ backgroundColor: `${PRIMARY_COLOR}15` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}15`;
            }}
          >
            <Icon className="w-4 h-4 transition-colors" style={{ color: BRAND_TEXT }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            {question}
          </p>
          <p 
            className="text-sm font-semibold text-gray-900 break-words transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
            onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
          >
            {displayValue}
          </p>
        </div>
      </div>
    );
  };

  const LeadTable = ({ leads }) => {
    // Function to parse the selected_suggestion JSON string
    const parseSuggestion = (suggestionString) => {
      try {
        return JSON.parse(suggestionString);
      } catch (e) {
        console.error("Error parsing suggestion:", e);
        return {};
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case "accepted":
          return "success";
        case "visa_completed":
          return "primary";
        case "withdrawn_by_student":
          return "danger";
        default:
          return "warning";
      }
    };

    if (leads?.length == 0) {
      return (
        <div className="text-center py-12 bg-white/60 backdrop-blur-sm rounded-lg border-2 border-dashed" 
             style={{ borderColor: `${PRIMARY_COLOR}30` }}>
          <Paperclip className="w-12 h-12 mx-auto mb-3" style={{ color: `${PRIMARY_COLOR}60` }} />
          <p className="font-medium" style={{ color: BRAND_TEXT }}>No Applications Found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr style={{ background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)` }}>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    University
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Program
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Intake
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Fees
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: BRAND_TEXT }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads?.map((lead, index) => {
                  const suggestion = parseSuggestion(lead.selected_suggestion);
                  return (
                    <tr
                      key={index}
                      className="transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}08`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Chip
                          color={getStatusColor(lead.status)}
                          variant="flat"
                          size="sm"
                        >
                          {lead.status.replace(/_/g, " ").toUpperCase()}
                        </Chip>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {countries[suggestion?.country]?.name || "N/A"}
                          </p>
                          <p className="text-gray-500">
                            {suggestion?.state || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {suggestion?.university || "N/A"}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {suggestion?.universityType || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {suggestion?.programLevel || "N/A"}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {suggestion?.fieldOfStudy || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {suggestion?.intakeMonth && suggestion?.intakeYear
                          ? `${suggestion.intakeMonth} ${suggestion.intakeYear}`
                          : "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${suggestion?.tuitionFees || "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(lead?.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="flat"
                          className="text-white border-0 shadow-md hover:shadow-lg 
                                   hover:scale-105 transition-all duration-200 font-semibold"
                          style={{ background: getPrimaryGradient('to-r') }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = `linear-gradient(to right, ${PRIMARY_COLOR_DARK}, ${PRIMARY_COLOR})`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = getPrimaryGradient('to-r');
                          }}
                          endContent={<ArrowRight className="w-3 h-3" />}
                          onPress={() =>
                            navigate(`/leads/progress/${lead?.id}`)
                          }
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {leads?.map((lead, index) => {
            const suggestion = parseSuggestion(lead.selected_suggestion);
            return (
              <Card key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3 border-b border-gray-200/60">
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-base font-bold text-gray-900 tracking-tight">
                      Application #{index + 1}
                    </CardTitle>
                    <Chip
                      color={getStatusColor(lead.status)}
                      variant="flat"
                      size="sm"
                    >
                      {lead.status.replace(/_/g, " ").toUpperCase()}
                    </Chip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Location
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {countries[suggestion?.country]?.name || "N/A"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {suggestion?.state || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        University
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {suggestion?.university || "N/A"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {suggestion?.universityType || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Program
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {suggestion?.programLevel || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Intake
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {suggestion?.intakeMonth && suggestion?.intakeYear
                          ? `${suggestion.intakeMonth} ${suggestion.intakeYear}`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Fees
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        ${suggestion?.tuitionFees || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Created
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(lead?.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    className="w-full text-white border-0 shadow-md hover:shadow-lg 
                             hover:scale-105 transition-all duration-200 font-semibold"
                    style={{ background: getPrimaryGradient('to-r') }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(to right, ${PRIMARY_COLOR_DARK}, ${PRIMARY_COLOR})`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = getPrimaryGradient('to-r');
                    }}
                    endContent={<ArrowRight className="w-3 h-3" />}
                    onPress={() => navigate(`/leads/progress/${lead?.id}`)}
                  >
                    View Progress
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
      `}</style>

      {/* Premium Header Section */}
      <div className="relative mb-2">
        <div className="relative py-1">
          <div className="max-w-[1920px] mx-auto">
            <div className="flex items-center gap-3">
              <BackButton title="" />
              <div className="relative">
                <div className="relative p-2 bg-primary-50 rounded-xl border border-primary-100">
                  <User className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-1 
                             tracking-tight leading-tight">
                  Student Profile
                </h1>
                <p className="text-default-500 text-xs sm:text-sm font-medium">
                  Complete student information and application history
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-[1920px] mx-auto space-y-6" style={{ animation: 'fadeInUp 0.6s ease-out' }}>

        {/* Student Basic Information */}
        <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="border-b border-gray-200/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl font-bold text-gray-900 tracking-tight">Basic Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 
                          hover:bg-white hover:shadow-md transition-all group/item"
                style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = PRIMARY_COLOR;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                    <User className="w-4 h-4" style={{ color: BRAND_TEXT }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND_TEXT }}>
                    Username
                  </p>
                </div>
                <p 
                  className="text-base font-bold text-gray-900 transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
                >
                  {student?.username || "N/A"}
                </p>
              </div>
              <div 
                className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 
                          hover:bg-white hover:shadow-md transition-all group/item"
                style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = PRIMARY_COLOR;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                    <Mail className="w-4 h-4" style={{ color: BRAND_TEXT }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND_TEXT }}>
                    Email
                  </p>
                </div>
                <p 
                  className="text-sm font-semibold text-gray-900 break-words transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
                >
                  {student?.email || "N/A"}
                </p>
              </div>
              <div 
                className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 
                          hover:bg-white hover:shadow-md transition-all group/item"
                style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = PRIMARY_COLOR;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                    <Phone className="w-4 h-4" style={{ color: BRAND_TEXT }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND_TEXT }}>
                    Phone
                  </p>
                </div>
                <p 
                  className="text-sm font-semibold text-gray-900 transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
                >
                  {student?.country_code ? `${student.country_code} ` : ""}
                  {student?.phone_number || "N/A"}
                </p>
              </div>
              <div 
                className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50 
                          hover:bg-white hover:shadow-md transition-all group/item"
                style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = PRIMARY_COLOR;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                    <FileText className="w-4 h-4" style={{ color: BRAND_TEXT }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND_TEXT }}>
                    UUID
                  </p>
                </div>
                <p 
                  className="text-xs font-mono font-semibold text-gray-900 break-all transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
                >
                  {student?.uuid || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details - Organized by Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Academic & Study Preferences */}
          <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-200/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 tracking-tight">
                  Academic & Study Preferences
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-3">
                {qaItem(
                  "Study Abroad Intentions",
                  studentDetails?.study_abroad_intentions,
                  Target
                )}
                {qaItem(
                  "Reasons to Study Abroad",
                  studentDetails?.study_abroad_reasons,
                  MessageSquare
                )}
                {qaItem(
                  "Field of Study",
                  studentDetails?.field_of_study,
                  BookOpen
                )}
                {qaItem(
                  "Degree Level",
                  studentDetails?.degree_level,
                  GraduationCap
                )}
                {qaItem(
                  "Course Selection",
                  studentDetails?.course_selection,
                  FileText
                )}
                {qaItem(
                  "Program Duration",
                  studentDetails?.program_duration,
                  Calendar
                )}
                {qaItem(
                  "Preferred Country",
                  studentDetails?.preferred_country,
                  Globe
                )}
                {qaItem(
                  "University Preferences",
                  studentDetails?.university_preferences,
                  Building2
                )}
                {qaItem(
                  "Academic Performance",
                  studentDetails?.academic_performance,
                  Award
                )}
                {qaItem(
                  "Language Proficiency",
                  studentDetails?.language_proficiency_scores,
                  MessageSquare
                )}
              </div>
            </CardContent>
          </Card>

          {/* Career & Financial */}
          <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-200/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 tracking-tight">Career & Financial</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-3">
                {qaItem("Career Goals", studentDetails?.career_goals, Target)}
                {qaItem(
                  "Work Experience",
                  studentDetails?.work_experience,
                  Briefcase
                )}
                {qaItem(
                  "Internship Roles",
                  studentDetails?.preferred_internship_roles,
                  Briefcase
                )}
                {qaItem("Budget", studentDetails?.budget, DollarSign)}
                {qaItem(
                  "Scholarship Requirements",
                  studentDetails?.scholarship_requirements ? "Yes" : "No",
                  Award
                )}
                {qaItem(
                  "Part-Time Job Interest",
                  studentDetails?.interested_in_part_time_jobs ? "Yes" : "No",
                  Briefcase
                )}
              </div>
            </CardContent>
          </Card>

          {/* Visa & Accommodation */}
          <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-200/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 tracking-tight">Visa & Accommodation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-3">
                {qaItem("Visa Type", studentDetails?.visa_type, FileText)}
                {qaItem(
                  "Accommodation Needs",
                  studentDetails?.accommodation_needs ? "Yes" : "No",
                  Building2
                )}
                {qaItem(
                  "Accommodation Preferences",
                  studentDetails?.accommodation_preferences,
                  Building2
                )}
                {qaItem(
                  "Health Insurance",
                  studentDetails?.health_insurance_needs ? "Yes" : "No",
                  FileText
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-200/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 tracking-tight">
                  Additional Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-3">
                {qaItem(
                  "Extracurricular Interests",
                  studentDetails?.extracurricular_interests,
                  Target
                )}
                {qaItem(
                  "Previous Applications",
                  studentDetails?.previous_applications ? "Yes" : "No",
                  FileText
                )}
                {qaItem(
                  "Previous Application Details",
                  studentDetails?.previous_application_details,
                  FileText
                )}
                {qaItem(
                  "Language Courses",
                  studentDetails?.interested_in_language_courses ? "Yes" : "No",
                  BookOpen
                )}
                {qaItem(
                  "Application Documents",
                  studentDetails?.application_documents ? "Yes" : "No",
                  Paperclip
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Section */}
        {/* <Card className="border border-gray-200 shadow-lg">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Paperclip className="w-5 h-5 text-indigo-600" />
                </div>
                <CardTitle className="text-xl">Applications</CardTitle>
              </div>
              {applications?.length > 0 && (
                <Chip color="primary" variant="flat" size="sm">
                  {applications.length}{" "}
                  {applications.length === 1 ? "Application" : "Applications"}
                </Chip>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <LeadTable leads={applications} />
          </CardContent>
        </Card> */}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
