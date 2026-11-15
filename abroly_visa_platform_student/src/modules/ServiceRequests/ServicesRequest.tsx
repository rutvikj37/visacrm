import { Input } from "@/components/ui/input";
import { Button, Select, SelectItem } from "@nextui-org/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { Form, Formik, Field } from "formik";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";
import ReactFlagsSelect from "react-flags-select";
import AchievementBanner from "../AchievementBanner/AchievementBanner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Shield,
  Wifi,
  MapPin,
} from "lucide-react";
import { PRIMARY_COLOR } from '@/lib/theme';
import { getAgentId } from "@/utils/config";
import { phoneInputProps, sanitizePhoneInput } from "@/utils/phone";

const ServicesRequest = () => {
  const { service } = useParams();
  const { commonPostPublicAPICall } = useApiCallUtils();
  const [showThankYouDialog, setShowThankYouDialog] = useState(false);

  const isHealth = service === "health";
  const pageTitle = isHealth ? "Health Insurance Request" : "International E-SIM Request";
  const pageSubtitle = isHealth
    ? "Get the right health insurance plan for your study abroad journey with expert support."
    : "Request an international e-SIM with the right data plan before you land.";

  // Initial values for Health Insurance form
  const healthInitialValues = {
    name: "",
    email: "",
    phone: "",
    country_of_study_or_travel: "",
    coverage_type: "",
    start_date_of_insurance: "",
    type_of_response: "health",
  };

  // Initial values for E-sim form
  const eSimInitialValues = {
    name: "",
    email: "",
    phone: "",
    country_of_study_or_travel: "",
    coverage_type: "",
    data_requirements: "",
    travel_date: "",
    type_of_response: "data",
  };

  // Validation function
  const validateForm = (formData: any, type: "health" | "data") => {
    const errors: any = {};

    if (!formData.name?.trim()) {
      errors.name = "Please Provide Name";
    }
    if (!formData.email?.trim()) {
      errors.email = "Please Provide Email";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please Provide Valid Email";
    }
    if (!formData.phone?.trim()) {
      errors.phone = "Please Provide Phone";
    }
    if (!formData.country_of_study_or_travel?.trim()) {
      errors.country_of_study_or_travel =
        "Please Provide Country of Study or Travel";
    }

    if (type === "health") {
      if (!formData.start_date_of_insurance?.trim()) {
        errors.start_date_of_insurance =
          "Please Provide Start Date of Insurance";
      }
    }

    if (type === "data") {
      if (!formData.data_requirements?.trim()) {
        errors.data_requirements = "Please Provide Data Requirements";
      }
      if (!formData.coverage_type?.trim()) {
        errors.coverage_type = "Please Provide Coverage Type";
      }
    }

    return errors;
  };

  // Health Insurance form submission
  const handleHealthSubmit = async (values: any, { resetForm }: any) => {
    const errors = validateForm(values, "health");
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0] as string;
      ErrorToast(firstError);
      return;
    }

    const { success } = await commonPostPublicAPICall(
      {...values,agent_id:getAgentId()},
      "service_form_requests/add",
      true
    );

    if (success) {
      SuccessToast("Health Insurance request submitted successfully!");
      resetForm();
      setShowThankYouDialog(true);
    }
  };

  // E-sim form submission
  const handleESimSubmit = async (values: any, { resetForm }: any) => {
    const errors = validateForm(values, "data");
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0] as string;
      ErrorToast(firstError);
      return;
    }

    const { success } = await commonPostPublicAPICall(
      {
        ...values,
        start_date_of_insurance: values.travel_date, // Map travel_date to start_date_of_insurance for API
      },
      "service_form_requests/add",
      true
    );

    if (success) {
      SuccessToast("E-sim request submitted successfully!");
      resetForm();
      setShowThankYouDialog(true);
    }
  };

  // ====== FORM COMPONENTS (UI only changed, functionality same) ======
  const HealthInsurance = () => {
    return (
      <div className="w-full flex flex-col">
        <Card className="rounded-xl border border-default-200 bg-content1 shadow-none flex flex-col h-full">
          <CardHeader className="pb-4 border-b border-default-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Shield size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Health Insurance Request
                </CardTitle>
                <p className="text-sm text-default-500 mt-0.5">
                  Share your details and our team will suggest the best student
                  health coverage for you.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 md:pt-7 px-4 md:px-6 lg:px-8 pb-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 -mr-3">
            <Formik
              initialValues={healthInitialValues}
              onSubmit={handleHealthSubmit}
            >
              {({ values, setFieldValue, handleSubmit }) => (
                <Form id="health-form" onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-7">
                  {/* Personal Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.16em]">
                      Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <User size={16} style={{ color: PRIMARY_COLOR }} />
                          Full Name *
                        </label>
                        <Field
                          as={Input}
                          name="name"
                          placeholder="Enter your full name"
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Mail size={16} style={{ color: PRIMARY_COLOR }} />
                          Email Address *
                        </label>
                        <Field
                          as={Input}
                          name="email"
                          type="email"
                          placeholder="Enter your email address"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Phone size={16} style={{ color: PRIMARY_COLOR }} />
                        Mobile Number (WhatsApp preferred) *
                      </label>
                      <Field
                        as={Input}
                        name="phone"
                        type="tel"
                        {...phoneInputProps}
                        onInput={sanitizePhoneInput}
                        placeholder="Enter your mobile number"
                        className="w-full"
                        onKeyPress={(e: any) => {
                          if (
                            !/[0-9]/.test(e.key) &&
                            e.key !== "Backspace" &&
                            e.key !== "Delete" &&
                            e.key !== "ArrowLeft" &&
                            e.key !== "ArrowRight"
                          ) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Insurance Details Section */}
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.16em]">
                      Insurance Details
                    </h3>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Globe size={16} style={{ color: PRIMARY_COLOR }} />
                        Country of Study / Destination *
                      </label>
                      <ReactFlagsSelect
                        selected={values.country_of_study_or_travel}
                        onSelect={(countryCode) =>
                          setFieldValue(
                            "country_of_study_or_travel",
                            countryCode
                          )
                        }
                        placeholder="Select country"
                        searchable
                        className="w-full"
                        selectButtonClassName="w-full h-11 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-left bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Shield size={16} style={{ color: PRIMARY_COLOR }} />
                          Preferred Coverage Type *
                        </label>
                        <Select
                          name="coverage_type"
                          placeholder="Select coverage type"
                          selectedKeys={
                            values.coverage_type ? [values.coverage_type] : []
                          }
                          onSelectionChange={(keys) => {
                            const selectedValue = Array.from(keys)[0] as string;
                            setFieldValue("coverage_type", selectedValue);
                          }}
                          className="w-full"
                        >
                          <SelectItem key="Basic" value="Basic">
                            Basic
                          </SelectItem>
                          <SelectItem key="Comprehensive" value="Comprehensive">
                            Comprehensive
                          </SelectItem>
                          <SelectItem
                            key="Not sure, suggest me"
                            value="Not sure, suggest me"
                          >
                            Not sure, suggest me
                          </SelectItem>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Calendar size={16} style={{ color: PRIMARY_COLOR }} />
                          Start Date of Insurance *
                        </label>
                        <Field
                          as={Input}
                          name="start_date_of_insurance"
                          type="date"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                </Form>
              )}
            </Formik>
            </div>
            <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-900/90 pt-4 pb-6 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-800">
              <Button
                type="submit"
                form="health-form"
                size="lg"
                className="w-full font-semibold text-white"
                style={{ backgroundColor: PRIMARY_COLOR }}
              >
                Submit Health Insurance Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const InternationalSIMCard = () => {
    return (
      <div className="w-full flex flex-col">
        <Card className="rounded-xl border border-default-200 bg-content1 shadow-none flex flex-col h-full">
          <CardHeader className="pb-4 border-b border-default-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Wifi size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  E-SIM Request
                </CardTitle>
                <p className="text-sm text-default-500 mt-0.5">
                  Fill in your details to get the right international e-SIM and
                  data plan for your travel.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 md:pt-7 px-4 md:px-6 lg:px-8 pb-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 -mr-3">
            <Formik initialValues={eSimInitialValues} onSubmit={handleESimSubmit}>
              {({ values, setFieldValue, handleSubmit }) => (
                <Form id="esim-form" onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-7">
                  {/* Personal Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.16em]">
                      Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <User size={16} style={{ color: PRIMARY_COLOR }} />
                          Full Name *
                        </label>
                        <Field
                          as={Input}
                          name="name"
                          placeholder="Enter your full name"
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Mail size={16} style={{ color: PRIMARY_COLOR }} />
                          Email Address *
                        </label>
                        <Field
                          as={Input}
                          name="email"
                          type="email"
                          placeholder="Enter your email address"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Phone size={16} style={{ color: PRIMARY_COLOR }} />
                        Mobile Number (WhatsApp preferred) *
                      </label>
                      <Field
                        as={Input}
                        name="phone"
                        type="tel"
                        {...phoneInputProps}
                        onInput={sanitizePhoneInput}
                        placeholder="Enter your mobile number"
                        className="w-full"
                        onKeyPress={(e: any) => {
                          if (
                            !/[0-9]/.test(e.key) &&
                            e.key !== "Backspace" &&
                            e.key !== "Delete" &&
                            e.key !== "ArrowLeft" &&
                            e.key !== "ArrowRight"
                          ) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* E-SIM Details Section */}
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.16em]">
                      E-SIM Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Globe size={16} style={{ color: PRIMARY_COLOR }} />
                          Country of Travel / Destination *
                        </label>
                        <ReactFlagsSelect
                          selected={values.country_of_study_or_travel}
                          onSelect={(countryCode) =>
                            setFieldValue(
                              "country_of_study_or_travel",
                              countryCode
                            )
                          }
                          placeholder="Select country"
                          searchable
                          className="w-full"
                          selectButtonClassName="w-full h-11 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-left bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Calendar size={16} style={{ color: PRIMARY_COLOR }} />
                          Travel Date (Approx.) *
                        </label>
                        <Field
                          as={Input}
                          name="travel_date"
                          type="date"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Wifi size={16} style={{ color: PRIMARY_COLOR }} />
                          Data Requirement *
                        </label>
                        <Select
                          name="data_requirements"
                          placeholder="Select data requirement"
                          selectedKeys={
                            values.data_requirements
                              ? [values.data_requirements]
                              : []
                          }
                          onSelectionChange={(keys) => {
                            const selectedValue = Array.from(keys)[0] as string;
                            setFieldValue("data_requirements", selectedValue);
                          }}
                          className="w-full"
                        >
                          <SelectItem key="1GB–5GB" value="1GB–5GB">
                            1GB–5GB
                          </SelectItem>
                          <SelectItem key="5GB–10GB" value="5GB–10GB">
                            5GB–10GB
                          </SelectItem>
                          <SelectItem key="Unlimited" value="Unlimited">
                            Unlimited
                          </SelectItem>
                          <SelectItem
                            key="Not sure, suggest me"
                            value="Not sure, suggest me"
                          >
                            Not sure, suggest me
                          </SelectItem>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <MapPin size={16} style={{ color: PRIMARY_COLOR }} />
                          Coverage Type *
                        </label>
                        <Select
                          name="coverage_type"
                          placeholder="Select coverage type"
                          selectedKeys={
                            values.coverage_type ? [values.coverage_type] : []
                          }
                          onSelectionChange={(keys) => {
                            const selectedValue = Array.from(keys)[0] as string;
                            setFieldValue("coverage_type", selectedValue);
                          }}
                          className="w-full"
                        >
                          <SelectItem key="Local" value="Local">
                            Local
                          </SelectItem>
                          <SelectItem key="Regional" value="Regional">
                            Regional
                          </SelectItem>
                          <SelectItem key="Global" value="Global">
                            Global
                          </SelectItem>
                          <SelectItem
                            key="Not sure, suggest me"
                            value="Not sure, suggest me"
                          >
                            Not sure, suggest me
                          </SelectItem>
                        </Select>
                      </div>
                    </div>
                  </div>

                </Form>
              )}
            </Formik>
            </div>
            <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-900/90 pt-4 pb-6 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-800">
              <Button
                type="submit"
                form="esim-form"
                size="lg"
                className="w-full font-semibold text-white"
                style={{ backgroundColor: PRIMARY_COLOR }}
              >
                Submit E-SIM Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
          {pageTitle}
        </h1>
        <p className="text-sm text-default-500">{pageSubtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:flex-1 min-w-0">
          {isHealth ? <HealthInsurance /> : <InternationalSIMCard />}
        </div>
        <aside className="lg:w-72 shrink-0">
          <div className="rounded-xl border border-default-200 bg-content1 p-3 sticky top-6">
            <AchievementBanner
              target_type={isHealth ? "health_ins" : "sim_card"}
            />
          </div>
        </aside>
      </div>

      <Dialog open={showThankYouDialog} onOpenChange={setShowThankYouDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">
              Thank You for Your Inquiry!
            </DialogTitle>
            <DialogDescription className="text-center text-sm pt-2">
              Our team will connect with you soon.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesRequest;
