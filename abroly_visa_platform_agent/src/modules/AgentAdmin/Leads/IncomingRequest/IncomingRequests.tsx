import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Chip,
  Button,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Building2,
  MapPin,
  Globe,
  DollarSign,
  School,
  Target,
  EyeIcon,
  User,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  Checkbox,
  CheckboxGroup,
  Input,
  InputPicker,
  SelectPicker,
} from "rsuite";
import ReactFlagsSelect from "react-flags-select";
import { countries } from "country-data";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from "@/lib/theme";

const IncomingRequests = () => {
  // add suggestion scroll
  const [provideSuggest, setProvideSuggest] = useState(false);
  useEffect(() => {
    if (provideSuggest) {
      const target = document.getElementById("add-suggestion");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [provideSuggest]);

  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState<any>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
  });

  const [currentLeadData, setCurrentLeadData] = useState<any>({});

  const getIncomingLeads = async (page: number) => {
    const { success, data } = await commonGetAPICalls(
      `/leads/incoming_leads?page=${page}`
    );
    if (success && success == true) {
      setPagination(data.pagination);
      return data;
    }
    throw new Error("Failed to fetch leads");
  };

  const { data, isFetching, isError, isFetched, error } = useQuery({
    queryKey: ["incomingLeads", pagination.currentPage],
    queryFn: () => getIncomingLeads(page),
  });

  const handlePageChange = (page: number) => {
    setPage(page);
  };

  const { isOpen: isLoadDataOpen, onOpenChange: onLoadDataOpenChange } =
    useDisclosure();

  const handleLeadViewOpen = async (leadId: number) => {
    const { data, success } = await commonPostAPICall(
      { id: leadId },
      `/leads/lead_details`
    );
    if (success && success == true) {
      setCurrentLeadData(data);
      onLoadDataOpenChange();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "warning";
      case "approved":
        return "success";
      case "rejected":
        return "danger";
      default:
        return "default";
    }
  };

  const [suggestions, setSuggestions] = useState<any[]>([]);

  const handleInputChange = (index, key, value) => {
    setSuggestions((prevSuggestions) => {
      const updatedSuggestions = [...prevSuggestions];
      updatedSuggestions[index] = {
        ...updatedSuggestions[index],
        [key]: value,
      };
      return updatedSuggestions;
    });
  };
  const queryClient = useQueryClient();

  const handleSubmitProvideSuggestions = async () => {
    // console.log(suggestions, "SUGG")
    const filterRecords = suggestions.map((suggestion) => {
      return {
        country: suggestion.country,
        state: suggestion.state,
        university: suggestion.university,
        universityType: suggestion.universityType.join(),
        useCurrentLocation: suggestion.useCurrentLocation,
        range: suggestion.range,
        programLevel: suggestion.programLevel,
        fieldOfStudy: suggestion.fieldOfStudy,
        intakeMonth: suggestion.intakeMonth,
        intakeYear: suggestion.intakeYear,
        tuitionFees: suggestion.tuitionFees,
        otherOption: suggestion.otherOption,
        course_program_name: suggestion.course_program_name,
        description: suggestion.description,
      };
    });
    const { success } = await commonPostAPICall(
      { suggestions: [...filterRecords], id: currentLeadData?.details?.id },
      "/leads/provide_suggestions",
      true
    );
    if (success && success == true) {
      onLoadDataOpenChange();
      setCurrentLeadData({});
      setSuggestions([]);
      getIncomingLeads(1);
    }
  };

  const mutateSuggest = useMutation({
    mutationFn: () => handleSubmitProvideSuggestions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomingLeads", page] });
    },
  });

  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 sm:p-6">
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
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      
      <div className="max-w-[1920px] mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          {/* Premium Header */}
          <div className="relative p-4 sm:p-6 border-b" style={{ background: getPrimaryGradient('to-r'), borderColor: `${PRIMARY_COLOR}40` }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  Incoming Lead Requests
                </h2>
                <p className="text-xs sm:text-sm text-white/90">Manage and review incoming lead requests</p>
              </div>
              <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 shadow-lg">
                <Chip 
                  color="primary" 
                  variant="flat" 
                  size="md"
                  className="bg-white/90 font-bold text-sm"
                  style={{ color: BRAND_TEXT }}
                >
                  Total: {pagination.totalItems}
                </Chip>
              </div>
            </div>
          </div>

          {/* Modern Table/List View */}
          <div className="p-4 sm:p-6">
            {isFetching ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}20` }}></div>
                    <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }}></div>
                  </div>
                  <p className="text-sm font-medium text-gray-600 animate-pulse">Loading leads...</p>
                </div>
              </div>
            ) : isError ? (
              <div 
                className="text-center py-16 bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl border-2 border-red-200 shadow-sm"
                style={{ animation: 'fadeInUp 0.6s ease-out' }}
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-red-700 font-semibold text-base">{error.message}</p>
              </div>
            ) : data?.leads?.length == 0 ? (
              <div 
                className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border-2 border-dashed border-gray-300"
                style={{ animation: 'fadeInUp 0.6s ease-out' }}
              >
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold text-base">No leads found</p>
                <p className="text-gray-500 text-sm mt-1">New leads will appear here</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {data?.leads?.map((lead, index) => (
                  <div
                    key={lead?.id}
                    className="group relative bg-white border border-gray-200/60 rounded-xl p-4 sm:p-5 
                               hover:shadow-xl transition-all duration-300 ease-out
                               hover:-translate-y-1 overflow-hidden cursor-pointer"
                    style={{ 
                      borderColor: 'rgba(229, 231, 235, 0.6)',
                      animation: `fadeInUp 0.6s ease-out ${index * 50}ms both`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = PRIMARY_COLOR;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.6)';
                    }}
                  >
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 transition-all duration-300"
                         style={{ backgroundColor: 'transparent' }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.background = `linear-gradient(to right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05, transparent)`;
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.background = 'transparent';
                         }} />
                    
                    {/* Shine effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
                                    transition-transform duration-1000 ease-in-out
                                    bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-10">
                      {/* Left Section - Lead Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto">
                        <div className="flex-shrink-0">
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 
                                        group-hover:rotate-3 transition-all duration-300"
                               style={{ background: getPrimaryGradient('to-br') }}>
                            <span className="text-white font-bold text-base">#{lead?.id}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <Chip
                              color={getStatusColor(lead.status)}
                              variant="flat"
                              size="sm"
                              className="font-semibold shadow-sm"
                            >
                              {lead.status.replace(/_/g, ' ').toUpperCase()}
                            </Chip>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg transition-colors"
                                 style={{ backgroundColor: 'rgba(15, 91, 216, 0.05)' }}
                                 onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}15`}
                                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(15, 91, 216, 0.05)'}>
                              <Clock className="w-4 h-4 text-gray-400 transition-colors" 
                                     onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
                                     onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'} />
                              <span className="text-xs font-medium">
                                {new Date(lead?.createdAt).toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(lead?.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Section - Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                        <Button
                          size="sm"
                          color="primary"
                          variant="bordered"
                          startContent={<EyeIcon className="w-4 h-4" />}
                          onPress={() => {
                            handleLeadViewOpen(lead?.raised_aplication_id);
                          }}
                          className="font-medium hover:scale-105 transition-transform duration-200"
                        >
                          View Lead
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          variant="solid"
                          startContent={<User className="w-4 h-4" />}
                          endContent={<ExternalLink className="w-3 h-3" />}
                          onPress={() => {
                            window.open(
                              `/leads/student_profile/${lead?.id}`,
                              "_blank"
                            );
                          }}
                          className="font-medium hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg"
                        >
                          Profile
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Premium Pagination */}
            {!isFetching && data?.leads?.length > 0 && pagination?.totalPages > 0 && (
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 pt-6 border-t border-gray-200/60">
                <Pagination
                  total={pagination?.totalPages}
                  color="primary"
                  page={pagination?.currentPage}
                  onChange={handlePageChange}
                  showControls
                  showShadow
                  classNames={{
                    wrapper: "gap-2",
                    item: "w-10 h-10",
                    cursor: "shadow-lg"
                  }}
                />
                <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    Page <span className="font-bold" style={{ color: BRAND_TEXT }}>{pagination?.currentPage}</span> of <span className="font-bold">{pagination?.totalPages}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isLoadDataOpen}
        onOpenChange={onLoadDataOpenChange}
        placement="top-center"
        size="full"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-full bg-gradient-to-br from-gray-50 to-white",
          body: "p-6 sm:p-8",
          header: "border-b bg-white",
          footer: "border-t border-gray-200/60 bg-white/80 backdrop-blur-sm",
        }}
        onClose={() => {
          setCurrentLeadData({});
          setSuggestions([]);
        }}
      >
        <ModalContent>
          <ModalHeader 
            className="flex flex-col gap-1 pb-4 relative overflow-hidden"
            style={{ 
              background: getPrimaryGradient('to-r'),
              borderBottomColor: `${PRIMARY_COLOR}40`
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  Lead Details
                </h1>
                <p className="text-sm text-white/90 mt-2">
                  Lead ID: <span className="font-semibold">#{currentLeadData?.details?.id}</span>
                </p>
              </div>
              {currentLeadData?.details?.status && (
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 shadow-lg">
                  <Chip
                    color={getStatusColor(currentLeadData.details.status)}
                    variant="flat"
                    size="lg"
                    className="bg-white/90 font-bold"
                  >
                    {currentLeadData.details.status.toUpperCase()}
                  </Chip>
                </div>
              )}
            </div>
          </ModalHeader>
          <ModalBody className="gap-6">
            {/* Lead Data Section */}
            <div className="bg-gradient-to-br from-white via-gray-50/50 to-white rounded-2xl p-6 sm:p-8 border border-gray-200/60 shadow-lg">
              <LeadData
                leadData={currentLeadData?.details}
                studentData={currentLeadData?.user}
              />
            </div>

            {/* Suggestions Section */}
            {currentLeadData?.details?.status == "pending" && (
              <div id="add-suggestion" className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border"
                     style={{ 
                       background: `linear-gradient(to right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}08)`,
                       borderColor: `${PRIMARY_COLOR}30`
                     }}>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      Your Suggestions
                    </h2>
                    <p className="text-sm text-gray-600 ml-12">
                      Provide university recommendations for this lead
                    </p>
                  </div>
                  {suggestions?.length == 0 && (
                    <Button
                      color="primary"
                      size="lg"
                      startContent={<Plus className="w-5 h-5" />}
                      onPress={() => {
                        setProvideSuggest(true);
                        setSuggestions([
                          {
                            country: "",
                            state: "",
                            university: "",
                            universityType: [],
                            useCurrentLocation: false,
                            course_program_name: "",
                            range: 10,
                            programLevel: "",
                            fieldOfStudy: "",
                            intakeMonth: "",
                            intakeYear: "",
                            tuitionFees: "",
                            otherOption: "",
                            description: "",
                          },
                        ]);
                      }}
                      className="font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                    >
                      Add Suggestion
                    </Button>
                  )}
                </div>
                {(() => {
                  const isFormValid = (suggestion) => {
                    return (
                      suggestion?.country?.trim() !== "" &&
                      suggestion?.state?.trim() !== "" &&
                      suggestion?.university?.trim() !== "" &&
                      suggestion?.universityType?.length > 0 &&
                      suggestion?.programLevel?.trim() !== "" &&
                      suggestion?.course_program_name?.trim() !== "" &&
                      suggestion?.fieldOfStudy?.trim() !== "" &&
                      suggestion?.tuitionFees?.trim() !== "" &&
                      suggestion?.intakeMonth?.trim() !== "" &&
                      suggestion?.intakeYear?.trim() !== ""
                    );
                  };
                  return suggestions?.map((suggestion, index) => (
                    <div
                      key={index}
                      className="group relative bg-white rounded-2xl p-6 sm:p-8 border-2 border-gray-200/60 
                                 shadow-lg hover:shadow-2xl transition-all duration-300 
                                 hover:-translate-y-1 overflow-hidden"
                      style={{ 
                        borderColor: 'rgba(229, 231, 235, 0.6)',
                        animation: `fadeInUp 0.6s ease-out ${index * 100}ms both`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = PRIMARY_COLOR;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.6)';
                      }}
                    >
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 transition-all duration-300"
                           style={{ backgroundColor: 'transparent' }}
                           onMouseEnter={(e) => {
                             e.currentTarget.style.background = `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)`;
                           }}
                           onMouseLeave={(e) => {
                             e.currentTarget.style.background = 'transparent';
                           }} />
                      
                      <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-6 border-b border-gray-200/60">
                          <div className="flex items-center gap-3 mb-3 sm:mb-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 
                                          group-hover:rotate-3 transition-all duration-300"
                                 style={{ background: getPrimaryGradient('to-br') }}>
                              <span className="text-sm font-bold text-white">
                                {index + 1}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">
                              Suggestion #{index + 1}
                            </h3>
                          </div>
                          {isFormValid(suggestion) ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-semibold text-green-700">Valid</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                              <span className="text-sm font-semibold text-amber-700">
                                Incomplete
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                          <div className="space-y-2 group/field">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                              <div className="p-1.5 rounded-lg transition-colors"
                                   style={{ backgroundColor: `${PRIMARY_COLOR}15` }}
                                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}25`}
                                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}15`}>
                                <Globe className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                              </div>
                              Country
                            </label>
                          <ReactFlagsSelect
                            selected={suggestion?.country}
                            searchable={true}
                            onSelect={(e) =>
                              handleInputChange(index, "country", e)
                            }
                            className="w-full"
                          />
                        </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-green-100 rounded-lg group-hover/field:bg-green-200 transition-colors">
                                  <MapPin className="w-3.5 h-3.5 text-green-600" />
                                </div>
                                State / Province
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter State/Province"
                                value={suggestion?.state}
                                onChange={(value) =>
                                  handleInputChange(index, "state", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-purple-100 rounded-lg group-hover/field:bg-purple-200 transition-colors">
                                  <Building2 className="w-3.5 h-3.5 text-purple-600" />
                                </div>
                                University
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter University"
                                value={suggestion?.university}
                                onChange={(value) =>
                                  handleInputChange(index, "university", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                              <div className="p-1.5 rounded-lg transition-colors"
                                   style={{ backgroundColor: `${PRIMARY_COLOR}15` }}
                                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}25`}
                                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}15`}>
                                <School className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                              </div>
                              University Type
                            </label>
                            <div className="flex gap-3 p-3 border-2 rounded-lg transition-colors bg-gray-50/50"
                                 style={{ borderColor: '#e5e7eb' }}
                                 onMouseEnter={(e) => e.currentTarget.style.borderColor = PRIMARY_COLOR}
                                 onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}>
                                <CheckboxGroup
                                  inline
                                  value={suggestion?.universityType || []}
                                  onChange={(value) =>
                                    handleInputChange(
                                      index,
                                      "universityType",
                                      value
                                    )
                                  }
                                  className="flex gap-4"
                                >
                                  <Checkbox value="private">Private</Checkbox>
                                  <Checkbox value="public">Public</Checkbox>
                                </CheckboxGroup>
                              </div>
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-amber-100 rounded-lg group-hover/field:bg-amber-200 transition-colors">
                                  <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                                </div>
                                Program Level
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Provide Program Level"
                                value={suggestion?.programLevel}
                                onChange={(value) =>
                                  handleInputChange(index, "programLevel", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-pink-100 rounded-lg group-hover/field:bg-pink-200 transition-colors">
                                  <FileText className="w-3.5 h-3.5 text-pink-600" />
                                </div>
                                Course/Program Name
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter Course/Program Name"
                                value={suggestion?.course_program_name}
                                onChange={(value) =>
                                  handleInputChange(
                                    index,
                                    "course_program_name",
                                    value
                                  )
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-teal-100 rounded-lg group-hover/field:bg-teal-200 transition-colors">
                                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                Field of Study
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter Field of Study"
                                value={suggestion?.fieldOfStudy}
                                onChange={(value) =>
                                  handleInputChange(index, "fieldOfStudy", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-emerald-100 rounded-lg group-hover/field:bg-emerald-200 transition-colors">
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                                Tuition Fees (USD) / Year
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter Tuition Fees"
                                value={suggestion?.tuitionFees}
                                onChange={(value) =>
                                  handleInputChange(index, "tuitionFees", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-rose-100 rounded-lg group-hover/field:bg-rose-200 transition-colors">
                                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                                </div>
                                Intake Month
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter Intake Month"
                                value={suggestion?.intakeMonth}
                                onChange={(value) =>
                                  handleInputChange(index, "intakeMonth", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-violet-100 rounded-lg group-hover/field:bg-violet-200 transition-colors">
                                  <Calendar className="w-3.5 h-3.5 text-violet-600" />
                                </div>
                                Intake Year
                              </label>
                              <Input
                                className="w-full"
                                placeholder="Enter Intake Year"
                                value={suggestion?.intakeYear}
                                onChange={(value) =>
                                  handleInputChange(index, "intakeYear", value)
                                }
                              />
                            </div>

                            <div className="space-y-2 group/field col-span-full">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 px-2">
                                <div className="p-1.5 bg-indigo-100 rounded-lg group-hover/field:bg-indigo-200 transition-colors">
                                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                </div>
                                Description
                              </label>
                              <textarea
                                className="w-full p-3 text-sm border-2 rounded-lg transition-all duration-200 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#a53860]/20 focus:border-[#da627d] resize-y min-h-[100px]"
                                style={{ borderColor: '#e5e7eb' }}
                                placeholder="Enter description or additional notes about this suggestion..."
                                value={suggestion?.description || ""}
                                onChange={(e) =>
                                  handleInputChange(index, "description", e.target.value)
                                }
                                onMouseEnter={(e) => {
                                  if (document.activeElement !== e.target) {
                                    e.currentTarget.style.borderColor = PRIMARY_COLOR;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (document.activeElement !== e.target) {
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                  }
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = PRIMARY_COLOR;
                                  e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY_COLOR}20`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = '#e5e7eb';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              />
                            </div>
                          </div>

                        <div className="col-span-full flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
                        {index == suggestions?.length - 1 && (
                          <Button
                            color="default"
                            variant="flat"
                            startContent={<Plus className="w-4 h-4" />}
                            onPress={() =>
                              setSuggestions([
                                ...suggestions,
                                suggestions?.length !== 0
                                  ? { ...suggestions[index] }
                                  : {
                                      country: "",
                                      state: "",
                                      university: "",
                                      universityType: [],
                                      useCurrentLocation: false,
                                      range: 10,
                                      course_program_name: "",
                                      programLevel: "",
                                      fieldOfStudy: "",
                                      intakeMonth: "",
                                      intakeYear: "",
                                      tuitionFees: "",
                                      otherOption: "",
                                      description: "",
                                    },
                              ])
                            }
                          >
                            Add Another Suggestion
                          </Button>
                        )}

                        {suggestions?.length > 1 && (
                          <Button
                            color="danger"
                            variant="flat"
                            startContent={<Trash2 className="w-4 h-4" />}
                            onPress={() =>
                              setSuggestions(
                                suggestions?.filter((_, i) => i !== index)
                              )
                            }
                          >
                            Remove This Suggestion
                          </Button>
                        )}
                        </div>
                      </div>
                    </div>
                  ));
                })()}

                {suggestions?.length > 0 &&
                  (() => {
                    const isFormValid = (suggestion) => {
                      return (
                        suggestion?.country?.trim() !== "" &&
                        suggestion?.state?.trim() !== "" &&
                        suggestion?.university?.trim() !== "" &&
                        suggestion?.universityType?.length > 0 &&
                        suggestion?.programLevel?.trim() !== "" &&
                        suggestion?.course_program_name?.trim() !== "" &&
                        suggestion?.fieldOfStudy?.trim() !== "" &&
                        suggestion?.tuitionFees?.trim() !== "" &&
                        suggestion?.intakeMonth?.trim() !== "" &&
                        suggestion?.intakeYear?.trim() !== ""
                      );
                    };
                    return (
                      <div className="sticky bottom-0 bg-gradient-to-r from-white via-gray-50/80 to-white 
                                      border-t-2 border-gray-200/60 p-6 rounded-b-xl shadow-2xl backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3 px-4 py-2 rounded-lg 
                                        bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                            {suggestions.every(isFormValid) ? (
                              <>
                                <div className="p-1.5 bg-green-100 rounded-lg">
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <span className="text-sm font-bold text-green-700">
                                  All suggestions are valid
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="p-1.5 bg-amber-100 rounded-lg">
                                  <AlertCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <span className="text-sm font-bold text-amber-700">
                                  Please complete all required fields
                                </span>
                              </>
                            )}
                          </div>
                          <Button
                            color="primary"
                            variant="solid"
                            size="lg"
                            disabled={!suggestions.every(isFormValid)}
                            isDisabled={!suggestions.every(isFormValid)}
                            onPress={() => mutateSuggest.mutate()}
                            className="px-8 font-bold shadow-lg hover:shadow-xl hover:scale-105 
                                     transition-all duration-200"
                            style={{ background: getPrimaryGradient('to-r') }}
                          >
                            Submit All Suggestions
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Suggested Recommendations Display */}
            {currentLeadData?.lead?.status == "suggested" && (
              <div className="space-y-6">
                <div className="p-4 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-xl border border-green-200/50">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    Submitted Recommendations
                  </h2>
                  <p className="text-sm text-gray-600 ml-12">
                    Review the suggestions provided for this lead
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {[
                    ...JSON.parse(currentLeadData?.lead?.suggestions || "[]"),
                  ]?.map((suggestion: any, index: number) => (
                    <div
                      key={index}
                      className="group relative bg-white rounded-2xl border-2 border-gray-200/60 
                                  transition-all duration-300 shadow-lg 
                                  hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                      style={{ 
                        borderColor: 'rgba(229, 231, 235, 0.6)',
                        animation: `fadeInUp 0.6s ease-out ${index * 100}ms both`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = PRIMARY_COLOR;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.6)';
                      }}
                    >
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 transition-all duration-300"
                           style={{ backgroundColor: 'transparent' }}
                           onMouseEnter={(e) => {
                             e.currentTarget.style.background = `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)`;
                           }}
                           onMouseLeave={(e) => {
                             e.currentTarget.style.background = 'transparent';
                           }} />
                      <div className="relative z-10 p-5 sm:p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5 pb-5 border-b border-gray-200/60">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl 
                                        flex items-center justify-center shadow-lg group-hover:scale-110 
                                        group-hover:rotate-3 transition-all duration-300"
                                 style={{ background: getPrimaryGradient('to-br') }}>
                              <span className="text-sm font-bold text-white">
                                {index + 1}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                              Option #{index + 1}
                            </h3>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg transition-all duration-200 
                                        border border-gray-200/50"
                                 style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.background = `linear-gradient(to right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}08)`;
                                   e.currentTarget.style.borderColor = PRIMARY_COLOR;
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.background = 'linear-gradient(to right, #f9fafb, #f3f4f680)';
                                   e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
                                 }}>
                            <div className="p-1.5 rounded-lg transition-colors"
                                 style={{ backgroundColor: `${PRIMARY_COLOR}15` }}
                                 onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}25`}
                                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}15`}>
                              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: BRAND_TEXT }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                Country
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {countries[suggestion?.country || "IN"]?.name ||
                                  "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-green-50 hover:to-emerald-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-green-200">
                            <div className="p-1.5 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                State
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {suggestion?.state || "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-purple-50 hover:to-purple-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-purple-200">
                            <div className="p-1.5 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                              <Building2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                University
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {suggestion?.university || "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg transition-all duration-200 
                                        border border-gray-200/50"
                                 style={{ borderColor: 'rgba(229, 231, 235, 0.5)' }}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.background = `linear-gradient(to right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}08)`;
                                   e.currentTarget.style.borderColor = PRIMARY_COLOR;
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.background = 'linear-gradient(to right, #f9fafb, #f3f4f680)';
                                   e.currentTarget.style.borderColor = 'rgba(229, 231, 235, 0.5)';
                                 }}>
                            <div className="p-1.5 rounded-lg transition-colors"
                                 style={{ backgroundColor: `${PRIMARY_COLOR}15` }}
                                 onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}25`}
                                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${PRIMARY_COLOR}15`}>
                              <School className="w-4 h-4 flex-shrink-0" style={{ color: BRAND_TEXT }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                University Type
                              </p>
                              <p className="text-sm font-bold text-gray-900 capitalize">
                                {suggestion?.universityType || "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-amber-50 hover:to-amber-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-amber-200">
                            <div className="p-1.5 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                              <GraduationCap className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                Program Level
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {suggestion?.programLevel || "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-pink-50 hover:to-pink-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-pink-200">
                            <div className="p-1.5 bg-pink-100 rounded-lg group-hover:bg-pink-200 transition-colors">
                              <FileText className="w-4 h-4 text-pink-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                Course/Program
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {suggestion?.course_program_name ||
                                  "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-teal-50 hover:to-teal-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-teal-200">
                            <div className="p-1.5 bg-teal-100 rounded-lg group-hover:bg-teal-200 transition-colors">
                              <BookOpen className="w-4 h-4 text-teal-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                Field of Study
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {suggestion?.fieldOfStudy || "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-emerald-50 hover:to-emerald-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-emerald-200">
                            <div className="p-1.5 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                              <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                Tuition Fees
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                ${suggestion?.tuitionFees || "Not specified"} /
                                Year
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 
                                        rounded-lg hover:from-violet-50 hover:to-violet-50 transition-all duration-200 
                                        border border-gray-200/50 hover:border-violet-200">
                            <div className="p-1.5 bg-violet-100 rounded-lg group-hover:bg-violet-200 transition-colors">
                              <Calendar className="w-4 h-4 text-violet-600 flex-shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                Intake
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {suggestion?.intakeMonth &&
                                suggestion?.intakeYear
                                  ? `${suggestion.intakeMonth} ${suggestion.intakeYear}`
                                  : "Not specified"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="border-t border-gray-200 pt-4">
            <Button
              variant="flat"
              onPress={() => {
                onLoadDataOpenChange();
                setCurrentLeadData({});
                setSuggestions([]);
              }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

interface LeadDataProps {
  leadData: {
    fieldOfStudy: string;
    intake: string | null;
    programLevel: string;
    range: string;
    state: string;
    tuitionFees: string;
    university: string;
    universityType: string;
    country: string;
    lat: string;
    lng: string;
  };
  studentData: any;
}

const LeadData = ({ leadData, studentData }: LeadDataProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Student Details */}
      <div className="group relative bg-white rounded-xl p-5 sm:p-6 border border-gray-200/60 
                      shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 
                      overflow-hidden">
        <div className="absolute inset-0 transition-all duration-300"
             style={{ backgroundColor: 'transparent' }}
             onMouseEnter={(e) => {
               e.currentTarget.style.background = `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, transparent)`;
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.background = 'transparent';
             }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200/60">
            <div className="p-2.5 rounded-lg shadow-md 
                          group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
                 style={{ background: getPrimaryGradient('to-br') }}>
              <User className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Student
            </h3>
          </div>
          <p className="text-lg font-bold text-gray-900 transition-colors"
             onMouseEnter={(e) => e.currentTarget.style.color = PRIMARY_COLOR}
             onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}>
            {studentData?.username || "N/A"}
          </p>
        </div>
      </div>

      {/* Academic Information */}
      <div className="group relative bg-white rounded-xl p-5 sm:p-6 border border-gray-200/60 
                      shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 
                      overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/0 to-green-50/0 
                        group-hover:from-green-50/50 group-hover:to-transparent transition-all duration-300" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200/60">
            <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md 
                          group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Academic
            </h3>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-green-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Program Level
              </p>
              <p className="text-sm font-bold text-gray-900">
                {leadData?.programLevel || "N/A"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-green-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Field of Study
              </p>
              <p className="text-sm font-bold text-gray-900">
                {leadData?.fieldOfStudy || "N/A"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-green-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Intake
              </p>
              <p className="text-sm font-bold text-gray-900">
                {leadData?.intake || "Not specified"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* University & Location */}
      <div className="group relative bg-white rounded-xl p-5 sm:p-6 border border-gray-200/60 
                      shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 
                      overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 to-purple-50/0 
                        group-hover:from-purple-50/50 group-hover:to-transparent transition-all duration-300" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200/60">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md 
                          group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <School className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              University & Location
            </h3>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-purple-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                University
              </p>
              <p className="text-sm font-bold text-gray-900">
                {leadData?.university || "N/A"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-purple-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Type
              </p>
              <p className="text-sm font-bold text-gray-900 capitalize">
                {leadData?.universityType?.replace(",", ", ") || "N/A"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-purple-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Tuition Fees
              </p>
              <p className="text-sm font-bold text-gray-900">
                ${leadData?.tuitionFees || "N/A"} / Year
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-purple-50/50 transition-colors">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Location
              </p>
              <p className="text-sm font-bold text-gray-900">
                {leadData?.country || "N/A"}, {leadData?.state || "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingRequests;
