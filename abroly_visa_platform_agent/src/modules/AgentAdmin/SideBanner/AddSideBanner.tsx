import React, { useEffect, useState } from "react";
import {
  Input,
  Button,
  Textarea,
  Spacer,
  Spinner,
  Card,
  CardBody,
  Tooltip,
  Chip,
} from "@heroui/react";
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker, SelectPicker } from "rsuite";
import "rsuite/dist/rsuite.min.css"; // Import RSuite styles
import axios from "axios";
import moment from "moment";
import { getAuthToken } from "@/utils/localstorage";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  XCircle,
  Upload,
  Image as ImageIcon,
  Target,
  Clock,
  MapPin,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { RiAdvertisementLine } from "react-icons/ri";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { PRIMARY_COLOR, BRAND_TEXT, PRIMARY_COLOR_LIGHT, PRIMARY_COLOR_DARK, getPrimaryGradient } from '@/lib/theme';

const AddSideBanner = () => {
  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();

  // check if user can add or not

  const [canAssign, setCanAssign] = useState(null);

  useEffect(() => {
    findCanAssign();
  }, []);

  const findCanAssign = async () => {
    const { data, success } = await commonGetAPICalls(
      "/side_banner/can_assign_slot"
    );
    if (success && success == true) {
      setCanAssign(data);
    }
  };

  const targets = [
    // { label: "Statement of Purpose (SOP)", value: "sop" },
    // { label: "Motivational letter", value: "motivation" },
    // { label: "Cover letter", value: "cover" },
    { label: "Health Insurance", value: "health_ins" },
    { label: "Internation Sim Card", value: "sim_card" },
    // { label: "Language Preparation", value: "language" },
    { label: "Jobs (Career section)", value: "career" },
    { label: "Visa and Consultation", value: "visa_consultation" },
    // { label: "Tourist Visa", value: "tourist_visa" },
  ];

  // add details
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null); // Store the value as Date
  const [selectTarget, setSelectTarget] = useState(targets[0]?.value);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [formData, setFormData] = useState({
    campaign_title: "",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch available slots based on selected month
  const fetchAvailableSlots = async (month: string) => {
    try {
      setLoading(true);
      const { success, data } = await commonPostAPICall(
        { requestedMonth: month, target_type: selectTarget },
        `/side_banner/get_avalible_slots`
      );
      if (success && success == true) {
        setAvailableSlots(data);
        setSelectedSlot(null);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setErrorMessage("Error fetching available slots");
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      const formattedMonth = moment(selectedMonth).format("YYYY-MM");
      fetchAvailableSlots(formattedMonth);
    }
  }, [selectedMonth, selectTarget]);

  // Handle slot selection
  const handleSlotSelect = (slot: any) => {
    if (slot?.position_1?.isAvailable || slot?.position_2?.isAvailable) {
      setSelectedSlot(slot);
    } else {
      ErrorToast("Slot Not avalible");
    }
  };

  // Handle form field change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    
    if (file) {
      // Create preview URL using FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setFormData((prevState) => ({
        ...prevState,
        image: file,
      }));
    } else {
      // Clean up preview if no file
      setImagePreview(null);
      setFormData((prevState) => ({
        ...prevState,
        image: null,
      }));
    }
  };

  const navigate = useNavigate();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaign_title || !formData.image || !selectedSlot) {
      ErrorToast("Please provide all required fields.");
      return;
    }

    setLoading(true);
    const formDataToSend = new FormData();
    formDataToSend.append("campaign_title", formData?.campaign_title);
    formDataToSend.append("target_type", selectTarget);
    formDataToSend.append("start_date", selectedSlot?.start_date);
    formDataToSend.append("end_date", selectedSlot?.end_date);
    formDataToSend.append(
      "position",
      selectedSlot?.position_1?.isAvailable ? "1" : "2"
    );
    formDataToSend.append("image", formData.image);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/v1/side_banner/assign_slots`,
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      if (response.data.success) {
        SuccessToast("Slot assigned successfully!");
        setFormData({
          campaign_title: "",
          image: null,
        });
        setImagePreview(null);
        navigate(-1);
        setSelectedSlot(null);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      ErrorToast("There was an error assigning the banner slot.");
      console.error("Error:", error);
    }
  };

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

      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* Premium Header Section */}
        <div className="relative mb-2">
          <div className="relative py-1">
            <div className="flex items-center gap-3">
              <Button
                isIconOnly
                variant='flat'
                size='sm'
                onPress={() => navigate(-1)}
                className="bg-primary-50 border border-primary-100 text-foreground hover:bg-primary-50"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="relative">
                <div className="relative p-2 bg-primary-50 rounded-xl border border-primary-100">
                  <RiAdvertisementLine className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-1 
                             tracking-tight leading-tight">
                  Side Banner Advertisement
                </h1>
                <p className="text-default-500 text-xs sm:text-sm font-medium">
                  Select a slot and create a new advertisement
                </p>
              </div>
            </div>
          </div>
          </div>

        {/* Premium Filter Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ 
                background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`
              }}>
                <Target className="w-5 h-5" style={{ color: BRAND_TEXT }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Select Campaign Details</h2>
                <p className="text-xs text-gray-500">Choose month and target type to view available slots</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="month" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Select Month
                </label>
                <DatePicker
                  id="month"
                  format="yyyy-MM"
                  value={selectedMonth}
                  onChange={(date) =>
                    setSelectedMonth(date ? new Date(date) : null)
                  }
                  placeholder="Select Month"
                  disabledDate={(date) => {
                    const currentDate = new Date();
                    const maxDate = new Date();
                    maxDate.setMonth(currentDate.getMonth() + 6);
                    return date < currentDate || date > maxDate;
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Target Type
                </label>
                <SelectPicker
                  value={selectTarget}
                  onChange={setSelectTarget}
                  data={targets}
                  style={{ width: "100%" }}
                  placeholder="Select Target Type"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Premium Available Slots Section */}
        <div>
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                <CalendarDays className="w-5 h-5" style={{ color: BRAND_TEXT }} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Available Slots</h2>
            </div>
            <p className="text-sm text-gray-500 ml-9">Select a slot to assign your banner</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}20` }}></div>
                  <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }}></div>
                </div>
                <p className="text-sm font-medium text-gray-600 animate-pulse">Loading available slots...</p>
              </div>
            </div>
          ) : availableSlots?.length === 0 ? (
            <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-semibold text-base">No slots available for selected month</p>
              <p className="text-sm text-gray-500 mt-1">Please select a different month or target type</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {availableSlots?.map((slot: any, index: number) => {
                const isSelected = selectedSlot?.start_date === slot.start_date;
                const isAvailable = slot?.position_1?.isAvailable || slot?.position_2?.isAvailable;
                
                return (
                  <div
                    key={slot?.start_date}
                    className={`
                      bg-white/80 backdrop-blur-sm border-2 rounded-xl p-5 transition-all duration-300
                      ${
                        isSelected
                          ? `shadow-xl border-[${PRIMARY_COLOR}]`
                          : "border-gray-200 hover:border-primary/50 hover:shadow-lg"
                      }
                      ${
                        isAvailable
                          ? "cursor-pointer hover:scale-[1.02]"
                          : "cursor-not-allowed opacity-60"
                      }
                    `}
                    style={isSelected ? {
                      borderColor: PRIMARY_COLOR,
                      background: `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)`
                    } : {}}
                    onClick={() => isAvailable && handleSlotSelect(slot)}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isSelected ? '' : 'bg-gray-100'}`} style={isSelected ? {
                          background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`
                        } : {}}>
                          <CalendarDays className={`w-4 h-4 ${isSelected ? '' : 'text-gray-600'}`} style={isSelected ? { color: BRAND_TEXT } : {}} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">Slot #{index + 1}</h3>
                          {isSelected && (
                            <Chip 
                              variant="flat" 
                              size="sm" 
                              className="mt-1 font-semibold"
                              style={{ 
                                background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`,
                                color: BRAND_TEXT
                              }}
                            >
                              Selected
                            </Chip>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: BRAND_TEXT }} />
                      )}
                    </div>

                    {/* Date Section */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                        <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Start Date</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(slot?.start_date).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                        <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">End Date</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(slot?.end_date).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Availability Section */}
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Positions</p>
                      <div className="space-y-2">
                        {/* Position 1 */}
                        <div className={`flex items-center justify-between p-2 rounded-lg ${
                          slot?.position_1?.isAvailable ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          <div className="flex items-center gap-2">
                            {slot?.position_1?.isAvailable ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-xs font-medium text-gray-700">Position 1</span>
                          </div>
                          <Chip
                            color={slot?.position_1?.isAvailable ? "success" : "danger"}
                            variant="flat"
                            size="sm"
                          >
                            {slot?.position_1?.isAvailable ? "Available" : "Taken"}
                          </Chip>
                        </div>

                        {/* Position 2 */}
                        <div className={`flex items-center justify-between p-2 rounded-lg ${
                          slot?.position_2?.isAvailable ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          <div className="flex items-center gap-2">
                            {slot?.position_2?.isAvailable ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-xs font-medium text-gray-700">Position 2</span>
                          </div>
                          <Chip
                            color={slot?.position_2?.isAvailable ? "success" : "danger"}
                            variant="flat"
                            size="sm"
                          >
                            {slot?.position_2?.isAvailable ? "Available" : "Taken"}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Premium Slot Details Form */}
        {selectedSlot && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            <div className="p-4 sm:p-6 border-b border-gray-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ 
                  background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`
                }}>
                  <CheckCircle className="w-5 h-5" style={{ color: BRAND_TEXT }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Campaign Details</h2>
                  <p className="text-xs text-gray-500">Fill in the details for your banner campaign</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selected Slot Summary */}
                <div className="rounded-xl p-4 border" style={{ 
                  background: `linear-gradient(to bottom right, ${PRIMARY_COLOR}08, ${PRIMARY_COLOR_LIGHT}05)`,
                  borderColor: `${PRIMARY_COLOR}30`
                }}>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4" style={{ color: BRAND_TEXT }} />
                    <h4 className="text-sm font-bold text-gray-900">Selected Slot Information</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-white/60 rounded-lg border border-gray-200/50">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Start Date</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(selectedSlot.start_date).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg border border-gray-200/50">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">End Date</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(selectedSlot.end_date).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg border border-gray-200/50">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Position</p>
                      <Chip 
                        variant="flat" 
                        size="sm"
                        className="font-semibold"
                        style={{ 
                          background: `linear-gradient(to right, ${PRIMARY_COLOR}15, ${PRIMARY_COLOR_LIGHT}15)`,
                          color: BRAND_TEXT
                        }}
                      >
                        Position {selectedSlot.position_1?.isAvailable ? "1" : "2"}
                      </Chip>
                    </div>
                  </div>
                </div>

                {/* Campaign Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="p-1 rounded" style={{ backgroundColor: `${PRIMARY_COLOR}15` }}>
                      <Target className="w-4 h-4" style={{ color: BRAND_TEXT }} />
                    </div>
                    Campaign Title
                  </label>
                  <Input
                    name="campaign_title"
                    value={formData.campaign_title}
                    onChange={handleChange}
                    placeholder="Enter campaign title"
                    required
                    variant="bordered"
                    classNames={{
                      input: "text-sm",
                      inputWrapper: "border-gray-300 hover:border-primary focus-within:border-primary transition-colors"
                    }}
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Banner Image
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="file"
                        name="image"
                        onChange={handleImageChange}
                        required
                        accept=".jpg, .jpeg, .png, .webp"
                        className="hidden"
                        id="banner-image-upload"
                      />
                      <label
                        htmlFor="banner-image-upload"
                        className={`flex flex-col items-center justify-center w-full border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors ${
                          imagePreview ? 'h-auto p-4' : 'h-32'
                        }`}
                      >
                        {imagePreview ? (
                          <div className="flex flex-col items-center gap-3 w-full">
                            <div className="relative w-full max-w-md">
                              <img
                                src={imagePreview}
                                alt="Banner preview"
                                className="w-full h-auto max-h-64 object-contain rounded-lg border border-gray-200"
                              />
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <ImageIcon className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-gray-700">{formData.image?.name}</span>
                            </div>
                            <span className="text-xs text-gray-500">Click to change image</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-8 h-8 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Click to upload image</span>
                            <span className="text-xs text-gray-500">JPG, PNG, or WEBP (Max 5MB)</span>
                          </div>
                        )}
                      </label>
                    </div>
                    {formData.image && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{formData.image.name}</p>
                            <p className="text-xs text-gray-500">
                              {(formData.image.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => {
                            setFormData((prev) => ({ ...prev, image: null }));
                            setImagePreview(null);
                            // Reset file input
                            const fileInput = document.getElementById('banner-image-upload') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-600">{errorMessage}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200/60">
                  <Button
                    type="button"
                    variant="light"
                    onPress={() => {
                      setSelectedSlot(null);
                      setFormData({ campaign_title: "", image: null });
                      setImagePreview(null);
                    }}
                    className="border border-gray-300 hover:border-gray-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    isLoading={loading}
                    startContent={!loading && <CheckCircle className="w-4 h-4" />}
                    className="font-semibold shadow-lg hover:shadow-xl transition-all"
                    style={{ 
                      background: getPrimaryGradient('to-r'),
                      color: 'white'
                    }}
                  >
                    {loading ? "Assigning..." : "Assign Slot"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddSideBanner;
