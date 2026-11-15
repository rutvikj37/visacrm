import { Input } from "@/components/ui/input"
import fetchQueriesHook from "@/hooks/fetchQueriesHook"
import useApiCallUtils from "@/hooks/useApiCallUtils"
import { commonGetAPICalls } from "@/utils/ApiCallUtils"
import { Button, Checkbox, CheckboxGroup, Spinner } from "@heroui/react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import ReactFlagsSelect from "react-flags-select"
import { SelectPicker } from "rsuite"
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from "@/lib/theme"
import { 
  User, Phone, Mail, Globe, MapPin, Building2, School, GraduationCap, 
  DollarSign, Calendar, FileText, CheckCircle2, AlertCircle, Plus, X,
  Sparkles, ArrowRight
} from "lucide-react"

const AddOfflineLead = () => {
  const { commonPostAPICall } = useApiCallUtils()
  const queryInvalidte = fetchQueriesHook()

  // State for initial student check form
  const [studentFormData, setStudentFormData] = useState({
    phone_number: '',
    country_code: '',
    name: '',
    email: ''
  })

  // State for raise application form
  const [raiseApplicationFormOpen, setRaiseApplicationFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    country: '',
    state: '',
    university: '',
    universityType: '',
    programLevel: '',
    fieldOfStudy: '',
    intakeMonth: '',
    intakeYear: '',
    tuitionFees: '',
    otherOption: ''
  })

  const CheckStudentExist = () => {
    const [studentData, setStudentData] = useState(null);
    const [studentFormData, setStudentFormData] = useState({
      phone_number: '',
      country_code: '',
      name: '',
      email: '',
    });
    const [formData, setFormData] = useState({
      country: '',
      state: '',
      university: '',
      universityType: '',
      programLevel: '',
      fieldOfStudy: '',
      intakeMonth: '',
      intakeYear: '',
      tuitionFees: '',
      otherOption: '',
    });
    const [raiseApplicationFormOpen, setRaiseApplicationFormOpen] = useState(false);
  
    // const { mutate, isPending, isError, error } = useMutation({
    //   mutationFn: async () => {
    //     const { data, success, message } = await commonPostAPICall(
    //       {
    //         phone_number: studentFormData.phone_number,
    //         country_code: studentFormData.country_code,
    //       },
    //       "/leads/check_student_exist"
    //     );
    //     if (success && success === true) {
    //       setStudentData(data);
    //       return data;
    //     }
    //     throw new Error(message);
    //   },
    //   onSuccess: (data) => {
    //     console.log("Student existence check successful:", data);
    //   },
    //   onError: (error) => {
    //     console.error("Error checking student existence:", error.message);
    //   },
    // });
  
    // const handleCheckStudent = () => {
    //   mutate(); // Trigger the mutation on click
    // };
  
    const handleStudentFormChange = (key, value) => {
      setStudentFormData((prev) => ({
        ...prev,
        [key]: value,
      }));
    };
  
    const handleNext = () => {
      setRaiseApplicationFormOpen(true);
    };
  
    const programLevels = [
      { label: 'Undergraduate', items: ['1-Year Post-Secondary Certificate', '2-Year Undergraduate Diploma', '3-Year Undergraduate Advanced Diploma', "3-Year Bachelor's Degree", 'Top-up Degree', "4-Year Bachelor's Degree", 'Integrated Masters'] },
      { label: 'Post-graduate', items: ['Postgraduate Certificate', 'Postgraduate Diploma', "Master's Degree", 'Doctoral / PhD', 'Non-Credential'] },
      { label: 'Elementary and High School', items: Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`) },
      { label: 'Language Proficiency', items: ['English as Second Language (ESL)'] },
      { label: 'Other', items: ['Other Option'] },
    ];
  
    const tuitionFees = ['0 - 1k', '1k - 5k', '5k - 10k', '10k - 20k', '20k - 30k', '30k+'];
    const fieldsOfStudy = ['Arts', 'Business, Management and Economics', 'Elementary and High School', 'Engineering and Technology', 'English for Academic Studies', 'Health Sciences, Medicine, Nursing, Paramedic and Kinesiology', 'Law, Politics, Social, Community Service and Teaching'];
  
    const handleInputChange = (key, value) => {
      setFormData((prev) => ({
        ...prev,
        [key]: value,
      }));
    };
  
    const generateMonths = () => {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      return formData.intakeYear === currentYear.toString()
        ? months.slice(currentMonth).map((month) => ({ label: month, value: month }))
        : months.map((month) => ({ label: month, value: month }));
    };
  
    const generateYears = () => {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 2 }, (_, i) => ({ label: `${currentYear + i}`, value: `${currentYear + i}` }));
    };
  
    const handleSubmit = async () => {
      const sendData = {
        phone_number: studentFormData.phone_number,
        country_code: studentFormData.country_code,
        name: studentFormData.name,
        email: studentFormData.email,
        country: formData.country,
        state: formData.state,
        university: formData.university,
        universityType: formData.universityType,
        programLevel: formData.programLevel,
        fieldOfStudy: formData.fieldOfStudy,
        intakeMonth: formData.intakeMonth,
        intakeYear: formData.intakeYear,
        tuitionFees: formData.tuitionFees,
        otherOption: formData.otherOption,
      };
  
      const { success } = await commonPostAPICall(sendData, "/leads/offline_lead_add", true);
  
      if (success) {
        setRaiseApplicationFormOpen(false);
        setStudentFormData({ phone_number: '', country_code: '', name: '', email: '' });
        setFormData({ country: '', state: '', university: '', universityType: '', programLevel: '', fieldOfStudy: '', intakeMonth: '', intakeYear: '', tuitionFees: '', otherOption: '' });
        queryInvalidte(["student_exist"]);
      }
    };
  
    return (
      <div>
        {!raiseApplicationFormOpen ? (
          <div className="space-y-6" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            {/* Phone Number Section */}
            <div className="group relative bg-gradient-to-br from-white via-gray-50/50 to-white rounded-2xl p-6 border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Active Phone Number</h2>
              </div>
              <section className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    Country Code
                  </label>
                  <Input
                    placeholder="Country Code (e.g. for india +91)"
                    type="text"
                    onInput={(e:any) => {
                      const value = e.target.value;
                      if (value && !/^\+\d{0,3}$/.test(value)) {
                        e.target.value = value.slice(0, -1);
                      }
                    }}
                    pattern="^\+\d{1,3}$"
                    value={studentFormData.country_code}
                    onChange={(e) => handleStudentFormChange('country_code', e.target.value)}
                    className="hover:border-primary transition-colors"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    Phone Number
                  </label>
                  <Input
                    type="number"
                    placeholder="Phone Number"
                    value={studentFormData.phone_number}
                    onChange={(e) => handleStudentFormChange('phone_number', e.target.value)}
                    className="hover:border-primary transition-colors"
                  />
                </div>
              </section>
            </div>

            {studentData ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Student Profile Exists</h3>
                </div>
                <Button 
                  onPress={handleNext}
                  className="font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                  style={{ background: getPrimaryGradient('to-r'), color: 'white' }}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              </div>
            ) : (
              <div className="group relative bg-gradient-to-br from-white via-gray-50/50 to-white rounded-2xl p-6 border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                    <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                      <User className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Student Details</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                      Student Name
                    </label>
                    <Input
                      placeholder="Enter Student Name"
                      value={studentFormData.name}
                      onChange={(e) => handleStudentFormChange('name', e.target.value)}
                      className="hover:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                      Email Address
                    </label>
                    <Input
                      placeholder="Enter Email Address"
                      value={studentFormData.email}
                      onChange={(e) => handleStudentFormChange('email', e.target.value)}
                      className="hover:border-primary transition-colors"
                    />
                  </div>
                  <Button
                    onPress={handleNext}
                    disabled={!studentFormData.name || !studentFormData.email}
                    className="w-full font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      background: (!studentFormData.name || !studentFormData.email) ? '#ccc' : getPrimaryGradient('to-r'),
                      color: 'white'
                    }}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="group relative bg-gradient-to-br from-white via-gray-50/50 to-white rounded-2xl p-6 sm:p-8 border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style={{ background: `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)` }} />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-lg opacity-30" style={{ backgroundColor: PRIMARY_COLOR }} />
                  <div className="relative p-2.5 rounded-xl shadow-md" style={{ background: getPrimaryGradient('to-br') }}>
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Application Details</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <Globe className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    Country
                  </label>
                  <ReactFlagsSelect
                    selected={formData.country}
                    searchable
                    onSelect={(e) => handleInputChange('country', e)}
                    className="!w-full"
                  />
                </div>
                
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <MapPin className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    State / Province
                  </label>
                  <Input
                    placeholder="Enter State/Province"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="hover:border-primary transition-colors"
                  />
                </div>
                
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <Building2 className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    University
                  </label>
                  <Input
                    placeholder="Enter University"
                    value={formData.university}
                    onChange={(e) => handleInputChange('university', e.target.value)}
                    className="hover:border-primary transition-colors"
                  />
                </div>
                
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <School className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    Type of University
                  </label>
                  <div className="p-3 border-2 rounded-lg hover:border-primary transition-colors" style={{ borderColor: '#e5e7eb' }}>
                    <CheckboxGroup
                      onChange={(value) => handleInputChange('universityType', value)}
                      className="flex gap-4"
                    >
                      <Checkbox value="private">Private</Checkbox>
                      <Checkbox value="public">Public</Checkbox>
                    </CheckboxGroup>
                  </div>
                </div>
                
                <div className="col-span-full space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <GraduationCap className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    Program Level
                  </label>
                  <SelectPicker
                    data={programLevels.flatMap((group) =>
                      group.items.map((item) => ({
                        label: item,
                        value: item,
                        group: group.label,
                      }))
                    )}
                    groupBy="group"
                    onChange={(value) => handleInputChange('programLevel', value)}
                    placeholder="Select Program Level"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <FileText className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    Field of Study
                  </label>
                  <SelectPicker
                    data={fieldsOfStudy.map((field) => ({ label: field, value: field }))}
                    onChange={(value) => handleInputChange('fieldOfStudy', value)}
                    placeholder="Select Field of Study"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <Calendar className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    Intake
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <SelectPicker
                      data={generateMonths()}
                      onChange={(value) => handleInputChange('intakeMonth', value)}
                      placeholder="Select Month"
                      style={{ width: '100%' }}
                    />
                    <SelectPicker
                      data={generateYears()}
                      onChange={(value) => handleInputChange('intakeYear', value)}
                      placeholder="Select Year"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                
                <div className="space-y-2 group/field">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <DollarSign className="w-3.5 h-3.5" style={{ color: BRAND_TEXT }} />
                    </div>
                    Tuition Fees (USD) / Year
                  </label>
                  <SelectPicker
                    data={tuitionFees.map((fee) => ({ label: fee, value: fee }))}
                    onChange={(value) => handleInputChange('tuitionFees', value)}
                    placeholder="Select Tuition Range"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="col-span-full mt-6 pt-6 border-t border-gray-200/60 flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onPress={handleSubmit}
                    size="lg"
                    className="font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 px-8"
                    style={{ background: getPrimaryGradient('to-r'), color: 'white' }}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Submit Application
                  </Button>
                  <Button 
                    onPress={() => setRaiseApplicationFormOpen(false)}
                    size="lg"
                    variant="flat"
                    className="font-semibold border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const canAddOfflineLead = async () => {
    const { data, success } = await commonGetAPICalls("/leads/can_add_offline_lead")
    if (success && success == true) {
      return (data !== null)
    }
    throw new Error("Something went wrong")
  }

  const { data: canAddOffline, isFetching } = useQuery({
    queryKey: ['canAddOfflineLead'],
    queryFn: canAddOfflineLead,
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/30 p-4 sm:p-6">
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
      
      {isFetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}20` }}></div>
              <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }}></div>
            </div>
            <p className="text-sm font-medium text-gray-600 animate-pulse">Loading...</p>
          </div>
        </div>
      ) : canAddOffline ? (
        <div className="max-w-[1920px] mx-auto">
          {/* Premium Header Section */}
          <div className="relative overflow-hidden mb-6">
            <div className="absolute inset-0" style={{ background: getPrimaryGradient('to-r') }} />
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                            animate-[shimmer_3s_ease-in-out_infinite] bg-[length:200%_100%]" />
            
            <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-md rounded-xl blur-lg" />
                  <div className="relative p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
                    <User className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 tracking-tight">
                    Add Offline Lead
                  </h1>
                  <p className="text-xs sm:text-sm font-medium text-white/90">
                    Create a new student lead manually
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-gray-50/30" />
          </div>

          {/* Form Content */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="p-6 sm:p-8">
              <CheckStudentExist />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[1920px] mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600">You cannot add offline leads at this time.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddOfflineLead