import { Button, Input } from "@heroui/react";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { ErrorToast } from "../../utils/Toaster";
import {
  setAuthLoading,
  setProfile,
  setToken,
} from "../../redux/slices/loginSlice";
import { addToLocal } from "../../utils/localstorage";

import { Link, useNavigate } from "react-router-dom";

const IS_LOCAL = import.meta.env.VITE_IS_LOCAL || false;

import { motion } from "framer-motion";
import {
  ArrowRight,
  Edit2,
  Lock,
  Phone,
  Shield,
} from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";
import { useAgencyBrand } from "@/utils/agencyHost";

import { publicAsset } from "@/utils/appBase";
const Login = () => {
  const { commonPostPublicAPICall } = useApiCallUtils();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const dispatch = useDispatch();
  // crm.<agency address>: this agency's name/logo, and only its team can log in here
  const { host: agencyHost, brand } = useAgencyBrand();

  // for OTP

  const [OTPScreen, setOTPScreeen] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [numberAndCountryCode, setNumberAndCountryCode] = useState({
    phone_number: "",
    country_code: "+91",
  });
  // SMS OTPs are 4 digits; agencies created by the platform admin log in with a 6-digit code from their welcome email
  const [codeLength, setCodeLength] = useState(4);
  const usesLoginCode = codeLength === 6;
  const initialValues = Array(4).fill("");
  const [otpValues, setValues] = useState<string[]>(initialValues);
  const inputRefs = Array(6)
    .fill(0)
    .map(() => useRef<HTMLInputElement>(null));
  const startCodeEntry = (verification: string) => {
    const len = verification === "LOGIN_CODE" ? 6 : 4;
    setCodeLength(len);
    setValues(Array(len).fill(""));
  };

  const [isLoadingOtpSend, setIsLoadingOtpSend] = useState(false);
  const [isLoadingOtpVerify, setIsLoadingOtpVerify] = useState(false);

  // handle change of otp
  const handleChange = (event: any, index: number) => {
    // Allow only single digit input
    if (/^\d?$/.test(event.target.value)) {
      const newValues = [...otpValues];
      newValues[index] = event.target.value;
      setValues(newValues);
      if (event.target.value && index < codeLength - 1) {
        const nextInput = inputRefs[index + 1].current;
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };

  // for handle backspace
  const handleBackspace = (event: any, index: number) => {
    if (event.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };
  // use for handle paste
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasteData = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeLength).split("");
    pasteData.forEach((value: string, index: number) => {
      if (index < otpValues.length) {
        otpValues[index] = value;
        const inputEl = inputRefs[index].current; // Get a reference to the current input element
        if (inputEl !== null) {
          // Check if the input element is not null
          inputEl.value = value; // Directly set the value of the input element
        }
      }
    });

    setValues([...otpValues]);
    const firstEmptyIndex = pasteData.length < codeLength ? pasteData.length : -1;
    if (firstEmptyIndex !== -1) {
      inputRefs[firstEmptyIndex].current?.focus();
    }
  };

  const submitCall = async () => {
    setIsLoadingOtpSend(true);
    const { success, data } = await commonPostPublicAPICall(
      { phone: numberAndCountryCode.phone_number, country_code: "+91", agency_host: agencyHost || undefined },
      `agent/${
        IS_LOCAL == "true" ? "login_with_number_custom" : "login_with_number"
      }`,
      true
    );
    // console.log(data);

    if (success == true) {
      startCodeEntry(data);
      setOTPScreeen(true);

      setVerificationId(data);
    }
    setIsLoadingOtpSend(false);
  };
  const resendOTPCall = async () => {
    const { success, data } = await commonPostPublicAPICall(
      {
        country_code: numberAndCountryCode.country_code,
        phone: numberAndCountryCode.phone_number,
        agency_host: agencyHost || undefined,
      },
      `agent/${
        IS_LOCAL == "true" ? "login_with_number_custom" : "login_with_number"
      }`,
      true
    );
    // console.log(data);

    if (success == true) {
      startCodeEntry(data);
      setOTPScreeen(true);
      setNumberAndCountryCode({
        country_code: numberAndCountryCode.country_code,
        phone_number: numberAndCountryCode.phone_number,
      });

      setVerificationId(data);
    }
  };
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 overflow-hidden">
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row h-fit">
            {/* Left Side - Image & Content */}
            <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-indigo-700 to-blue-800">
              <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg')] bg-cover bg-center opacity-20" />
              <div className="relative h-full p-12 flex flex-col justify-between text-white">
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    {brand?.logo
                      ? <img src={brand.logo} alt="" className="w-12 h-12 rounded-xl shadow-lg object-cover bg-white" />
                      : brand
                        ? <span className="w-12 h-12 rounded-xl shadow-lg bg-white text-primary grid place-items-center text-2xl font-bold">{brand.name.slice(0, 1).toUpperCase()}</span>
                        : <img src={publicAsset("logo.png")} alt="" className="w-12 h-12 rounded-xl shadow-lg" />}
                    <span className="text-2xl font-semibold tracking-tight">
                      {brand?.name || "TechX CRM"}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
                      Welcome Back
                    </h2>
                    <p className="mt-4 text-indigo-100 text-lg leading-relaxed">
                      Streamline your visa consultancy with our powerful tools
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                      <Shield className="w-6 h-6 text-indigo-200" />
                    </div>
                    <p className="text-base text-indigo-100">
                      Secure with Encryption
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                      <Lock className="w-6 h-6 text-indigo-200" />
                    </div>
                    <p className="text-base text-indigo-100">
                      Private with Authentication
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 p-8 lg:p-12 bg-white">
              <div className="max-w-md mx-auto">
                {!OTPScreen ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-8"
                  >
                    <div className="text-center lg:text-left">
                      <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Sign In
                      </h2>
                      <p className="text-gray-600 mt-2 text-sm">
                        {brand ? `Sign in to your ${brand.name} panel with your phone number` : "Access your account with your phone number"}
                      </p>
                    </div>

                    <form
                      className="space-y-6"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitCall();
                      }}
                    >
                       <Input
                         type="tel"
                         {...phoneInputProps}
                         name="phone_number"
                         label="Phone Number"
                         labelPlacement="outside-top"
                         placeholder="Enter your phone number"
                         startContent={
                           <div className="flex items-center gap-2">
                             <Phone size={20} className="text-gray-400" />
                             <span className="text-gray-600 text-sm">+91</span>
                           </div>
                         }
                         value={numberAndCountryCode.phone_number}
                         onChange={(e) => {
                           setNumberAndCountryCode({
                             ...numberAndCountryCode,
                             phone_number: toPhoneDigits(e.target.value),
                           });
                         }}
                       />
                      <Button
                        type="submit"
                        className="w-full rounded-xl py-3 font-semibold shadow-md transition-all duration-200"
                        size="lg"
                        variant="solid"
                        color="primary"
                        endContent={<ArrowRight size={20} />}
                        isLoading={isLoadingOtpSend}
                        isDisabled={isLoadingOtpSend}
                      >
                        Send OTP
                      </Button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-8"
                  >
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
                        {usesLoginCode ? "Enter login code" : "Verify OTP"}
                      </h2>
                      <div className="mt-2">
                        <p className="text-gray-600 text-sm">
                          {usesLoginCode ? "Enter the 6-digit login code from your welcome email for" : "Enter the code sent to"}
                        </p>
                        <div className="flex items-center justify-center lg:justify-start gap-2 mt-1 text-sm">
                          <span className="font-medium text-gray-800">
                            +91 {numberAndCountryCode.phone_number}
                          </span>
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            onPress={() => setOTPScreeen(false)}
                          >
                            <Edit2
                              size={16}
                              className="text-indigo-600 hover:text-indigo-800"
                            />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className={`flex justify-center ${usesLoginCode ? "gap-2" : "gap-4"}`}>
                        {otpValues.map((value: string, index: number) => (
                          <input
                            key={index}
                            ref={inputRefs[index]}
                            type="number"
                            maxLength={1}
                            value={value}
                            onChange={(e) => handleChange(e, index)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && index == codeLength - 1) {
                                let emptyOTP = false;
                                otpValues.forEach((item: any) => {
                                  if (item == "") {
                                    emptyOTP = true;
                                  }
                                });
                                if (emptyOTP) {
                                  ErrorToast(usesLoginCode ? "Please enter your login code" : "Please Enter OTP");
                                } else {
                                  setIsLoadingOtpVerify(true);
                                  const { success, data } =
                                    await commonPostPublicAPICall(
                                      {
                                        country_code:
                                          numberAndCountryCode.country_code,
                                        otp: otpValues.join(""),
                                        phone_number:
                                          "" +
                                          numberAndCountryCode.phone_number,
                                        verificationId,
                                        agency_host: agencyHost || undefined,
                                      },
                                      `agent/${
                                        IS_LOCAL == "true"
                                          ? "validate_otp_custom"
                                          : "validate_otp"
                                      }`,
                                      true
                                    );
                                  if (success == true) {
                                    dispatch(setToken(data.token));
                                    dispatch(
                                      setProfile({
                                        phone:
                                          data.country_code + " " + data.phone,
                                        user_name: data.name,
                                      })
                                    );
                                    addToLocal("token", data.token);
                                    addToLocal(
                                      "phone_with_code",
                                      data.country_code + " " + data.phone
                                    );
                                    addToLocal("name", data.name);
                                    addToLocal("website", "agent");
                                    dispatch(setAuthLoading("false"));
                                    navigate("/");
                                  }
                                  setIsLoadingOtpVerify(false);
                                }
                              } else {
                                handleBackspace(e, index);
                              }
                            }}
                            onPaste={handlePaste}
                            className={`${usesLoginCode ? "w-11 h-12 sm:w-12 sm:h-14" : "w-14 h-14"} text-center text-xl font-medium border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 transition-all duration-200`}
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>

                      <div className="flex gap-4">
                        <Button
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold shadow-md transition-all duration-200"
                          size="lg"
                          isLoading={isLoadingOtpVerify}
                          isDisabled={isLoadingOtpVerify}
                          onPress={async () => {
                            let emptyOTP = false;
                            otpValues.forEach((item: any) => {
                              if (item == "") {
                                emptyOTP = true;
                              }
                            });
                            if (emptyOTP) {
                              ErrorToast(usesLoginCode ? "Please enter your login code" : "Please Enter OTP");
                            } else {
                              setIsLoadingOtpVerify(true);
                              const { success, data } =
                                await commonPostPublicAPICall(
                                  {
                                    country_code:
                                      numberAndCountryCode.country_code,
                                    otp: otpValues.join(""),
                                    phone_number:
                                      "" + numberAndCountryCode.phone_number,
                                    verificationId,
                                    agency_host: agencyHost || undefined,
                                  },
                                  `agent/${
                                    IS_LOCAL == "true"
                                      ? "validate_otp_custom"
                                      : "validate_otp"
                                  }`,
                                  true
                                );
                              if (success == true) {
                                dispatch(setToken(data.token));
                                dispatch(
                                  setProfile({
                                    phone: data.country_code + " " + data.phone,
                                    user_name: data.name,
                                  })
                                );
                                addToLocal("token", data.token);
                                addToLocal(
                                  "phone_with_code",
                                  data.country_code + " " + data.phone
                                );
                                addToLocal("name", data.name);
                                dispatch(setAuthLoading("false"));
                                navigate("/");
                              }
                              setIsLoadingOtpVerify(false);
                            }
                          }}
                        >
                          {usesLoginCode ? "Log in" : "Verify OTP"}
                        </Button>
                        {!usesLoginCode && (
                          <Button
                            variant="bordered"
                            size="lg"
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl py-3 font-semibold transition-all duration-200"
                            onPress={resendOTPCall}
                          >
                            Resend
                          </Button>
                        )}
                      </div>
                      {usesLoginCode && (
                        <p className="text-xs text-gray-500 text-center lg:text-left">
                          Lost your code? Ask the platform admin to send you a new one.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
