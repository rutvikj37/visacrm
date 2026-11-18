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

import { useNavigate } from "react-router-dom";

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

type Screen = "phone" | "code" | "set_passcode" | "forgot" | "reset_code";

const Login = () => {
  const { commonPostPublicAPICall } = useApiCallUtils();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { host: agencyHost, brand } = useAgencyBrand();

  const [screen, setScreen] = useState<Screen>("phone");
  const [verificationId, setVerificationId] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [numberAndCountryCode, setNumberAndCountryCode] = useState({
    phone_number: "",
    country_code: "+91",
  });
  // SMS OTP = 4; invite / reset email code = 6; personal passcode = flexible 4–6
  const [codeLength, setCodeLength] = useState(4);
  const usesLoginCode = verificationId === "LOGIN_CODE";
  const usesPasscode = verificationId === "PASSCODE";
  const usesDigitLogin = usesLoginCode || usesPasscode;
  const initialValues = Array(4).fill("");
  const [otpValues, setValues] = useState<string[]>(initialValues);
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const inputRefs = Array(6)
    .fill(0)
    .map(() => useRef<HTMLInputElement>(null));

  const startCodeEntry = (verification: string) => {
    const len = verification === "LOGIN_CODE" || verification === "PASSCODE" ? 6 : 4;
    setCodeLength(len);
    setValues(Array(len).fill(""));
    setVerificationId(verification || "");
    if (verification === "PASSCODE") setPasscode("");
  };

  const [isLoadingOtpSend, setIsLoadingOtpSend] = useState(false);
  const [isLoadingOtpVerify, setIsLoadingOtpVerify] = useState(false);

  const finishLogin = (data: any) => {
    dispatch(setToken(data.token));
    dispatch(
      setProfile({
        phone: data.country_code + " " + data.phone,
        user_name: data.name,
      })
    );
    addToLocal("token", data.token);
    addToLocal("phone_with_code", data.country_code + " " + data.phone);
    addToLocal("name", data.name);
    addToLocal("website", "agent");
    dispatch(setAuthLoading("false"));
    navigate("/");
  };

  const handleMustSetPasscode = (data: any) => {
    if (data?.must_set_passcode && data?.setup_token) {
      setSetupToken(data.setup_token);
      setPasscode("");
      setConfirmPasscode("");
      setScreen("set_passcode");
      return true;
    }
    return false;
  };

  const handleChange = (event: any, index: number) => {
    if (/^\d?$/.test(event.target.value)) {
      const newValues = [...otpValues];
      newValues[index] = event.target.value;
      setValues(newValues);
      if (event.target.value && index < codeLength - 1) {
        inputRefs[index + 1].current?.focus();
      }
    }
  };

  const handleBackspace = (event: any, index: number) => {
    if (event.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasteData = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeLength).split("");
    pasteData.forEach((value: string, index: number) => {
      if (index < otpValues.length) {
        otpValues[index] = value;
        const inputEl = inputRefs[index].current;
        if (inputEl !== null) inputEl.value = value;
      }
    });
    setValues([...otpValues]);
    const firstEmptyIndex = pasteData.length < codeLength ? pasteData.length : -1;
    if (firstEmptyIndex !== -1) inputRefs[firstEmptyIndex].current?.focus();
  };

  const loginEndpoint = () =>
    `agent/${IS_LOCAL == "true" ? "login_with_number_custom" : "login_with_number"}`;
  const validateEndpoint = () =>
    `agent/${IS_LOCAL == "true" ? "validate_otp_custom" : "validate_otp"}`;

  const submitCall = async () => {
    setIsLoadingOtpSend(true);
    const { success, data } = await commonPostPublicAPICall(
      {
        phone: numberAndCountryCode.phone_number,
        country_code: "+91",
        agency_host: agencyHost || undefined,
      },
      loginEndpoint(),
      true
    );
    if (success == true) {
      startCodeEntry(typeof data === "string" ? data : data || "");
      setScreen("code");
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
      loginEndpoint(),
      true
    );
    if (success == true) {
      startCodeEntry(typeof data === "string" ? data : data || "");
      setScreen("code");
    }
  };

  const enteredCode = () => {
    if (usesPasscode) return passcode.replace(/\D/g, "");
    return otpValues.join("");
  };

  const codeComplete = () => {
    const code = enteredCode();
    if (usesPasscode) return code.length >= 4 && code.length <= 6;
    return otpValues.slice(0, codeLength).every((v) => v !== "") && code.length === codeLength;
  };

  const verifyCode = async () => {
    if (!codeComplete()) {
      ErrorToast(
        usesPasscode
          ? "Enter your 4–6 digit passcode"
          : usesLoginCode
            ? "Please enter your login code"
            : "Please Enter OTP"
      );
      return;
    }
    setIsLoadingOtpVerify(true);
    const { success, data } = await commonPostPublicAPICall(
      {
        country_code: numberAndCountryCode.country_code,
        otp: enteredCode(),
        phone_number: "" + numberAndCountryCode.phone_number,
        verificationId: verificationId || "PASSCODE",
        agency_host: agencyHost || undefined,
      },
      validateEndpoint(),
      true
    );
    if (success == true) {
      if (handleMustSetPasscode(data)) {
        setIsLoadingOtpVerify(false);
        return;
      }
      if (data?.token) finishLogin(data);
    }
    setIsLoadingOtpVerify(false);
  };

  const requestReset = async () => {
    setIsLoadingOtpSend(true);
    const { success } = await commonPostPublicAPICall(
      {
        phone: numberAndCountryCode.phone_number,
        country_code: numberAndCountryCode.country_code || "+91",
        agency_host: agencyHost || undefined,
      },
      "agent/request_passcode_reset",
      true
    );
    if (success) {
      startCodeEntry("LOGIN_CODE");
      setScreen("reset_code");
    }
    setIsLoadingOtpSend(false);
  };

  const verifyResetCode = async () => {
    if (!codeComplete()) {
      ErrorToast("Enter the 6-digit reset code from your email");
      return;
    }
    setIsLoadingOtpVerify(true);
    const { success, data } = await commonPostPublicAPICall(
      {
        phone: numberAndCountryCode.phone_number,
        country_code: numberAndCountryCode.country_code || "+91",
        code: enteredCode(),
        agency_host: agencyHost || undefined,
      },
      "agent/verify_passcode_reset",
      true
    );
    if (success && handleMustSetPasscode(data)) {
      /* moved to set_passcode */
    }
    setIsLoadingOtpVerify(false);
  };

  const savePasscode = async () => {
    const pin = passcode.replace(/\D/g, "");
    if (pin.length !== 6) {
      ErrorToast("Passcode must be 6 digits");
      return;
    }
    if (pin !== confirmPasscode.replace(/\D/g, "")) {
      ErrorToast("Passcodes do not match");
      return;
    }
    setIsLoadingOtpVerify(true);
    const { success, data } = await commonPostPublicAPICall(
      {
        setup_token: setupToken,
        passcode: pin,
        confirm_passcode: pin,
        agency_host: agencyHost || undefined,
      },
      "agent/set_passcode",
      true
    );
    if (success && data?.token) finishLogin(data);
    setIsLoadingOtpVerify(false);
  };

  const codeBoxes = (onSubmit: () => void) => (
    <div className={`flex justify-center ${usesDigitLogin || screen === "reset_code" ? "gap-2" : "gap-4"}`}>
      {otpValues.map((value: string, index: number) => (
        <input
          key={index}
          ref={inputRefs[index]}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && index === codeLength - 1) onSubmit();
            else handleBackspace(e, index);
          }}
          onPaste={handlePaste}
          className={`${usesDigitLogin || screen === "reset_code" ? "w-11 h-12 sm:w-12 sm:h-14" : "w-14 h-14"} text-center text-xl font-medium border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 transition-all duration-200`}
          autoFocus={index === 0}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 overflow-hidden">
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row h-fit">
            <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-indigo-700 to-blue-800">
              <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg')] bg-cover bg-center opacity-20" />
              <div className="relative h-full p-12 flex flex-col justify-between text-white">
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    {brand?.logo ? (
                      <img src={brand.logo} alt="" className="w-12 h-12 rounded-xl shadow-lg object-cover bg-white" />
                    ) : brand ? (
                      <span className="w-12 h-12 rounded-xl shadow-lg bg-white text-primary grid place-items-center text-2xl font-bold">
                        {brand.name.slice(0, 1).toUpperCase()}
                      </span>
                    ) : (
                      <img src={publicAsset("logo.png")} alt="" className="w-12 h-12 rounded-xl shadow-lg" />
                    )}
                    <span className="text-2xl font-semibold tracking-tight">{brand?.name || "TechX CRM"}</span>
                  </div>
                  <div>
                    <h2 className="text-4xl font-extrabold tracking-tight leading-tight">Welcome Back</h2>
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
                    <p className="text-base text-indigo-100">Secure with Encryption</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                      <Lock className="w-6 h-6 text-indigo-200" />
                    </div>
                    <p className="text-base text-indigo-100">Private with Authentication</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-1/2 p-8 lg:p-12 bg-white">
              <div className="max-w-md mx-auto">
                {screen === "phone" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="text-center lg:text-left">
                      <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Sign In</h2>
                      <p className="text-gray-600 mt-2 text-sm">
                        {brand
                          ? `Sign in to your ${brand.name} panel with your phone number`
                          : "Access your account with your phone number"}
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
                        isDisabled={isLoadingOtpSend || numberAndCountryCode.phone_number.length < 10}
                      >
                        Continue
                      </Button>
                    </form>
                  </motion.div>
                )}

                {screen === "code" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
                        {usesPasscode ? "Enter passcode" : usesLoginCode ? "Enter login code" : "Verify OTP"}
                      </h2>
                      <div className="mt-2">
                        <p className="text-gray-600 text-sm">
                          {usesPasscode
                            ? "Enter your 4–6 digit passcode for"
                            : usesLoginCode
                              ? "Enter the 6-digit login code from your welcome email for"
                              : "Enter the code sent to"}
                        </p>
                        <div className="flex items-center justify-center lg:justify-start gap-2 mt-1 text-sm">
                          <span className="font-medium text-gray-800">+91 {numberAndCountryCode.phone_number}</span>
                          <Button isIconOnly variant="light" size="sm" onPress={() => setScreen("phone")}>
                            <Edit2 size={16} className="text-indigo-600 hover:text-indigo-800" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {usesPasscode ? (
                        <Input
                          type="password"
                          inputMode="numeric"
                          autoComplete="current-password"
                          label="Passcode"
                          labelPlacement="outside-top"
                          placeholder="4–6 digits"
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") verifyCode();
                          }}
                        />
                      ) : (
                        codeBoxes(verifyCode)
                      )}
                      <div className="flex gap-4">
                        <Button
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold shadow-md"
                          size="lg"
                          isLoading={isLoadingOtpVerify}
                          isDisabled={isLoadingOtpVerify}
                          onPress={verifyCode}
                        >
                          {usesDigitLogin ? "Log in" : "Verify OTP"}
                        </Button>
                        {!usesDigitLogin && (
                          <Button
                            variant="bordered"
                            size="lg"
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl py-3 font-semibold"
                            onPress={resendOTPCall}
                          >
                            Resend
                          </Button>
                        )}
                      </div>
                      {usesLoginCode && (
                        <p className="text-xs text-gray-500 text-center lg:text-left">
                          Lost your invite code? Ask the platform admin (or your agency owner) to send a new one.
                        </p>
                      )}
                      {usesPasscode && (
                        <button
                          type="button"
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium w-full text-center lg:text-left"
                          onClick={() => setScreen("forgot")}
                        >
                          Forgot passcode?
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {screen === "forgot" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Forgot passcode</h2>
                      <p className="text-gray-600 mt-2 text-sm">
                        We will email a short-lived reset code to the address on your account for{" "}
                        <span className="font-medium text-gray-800">+91 {numberAndCountryCode.phone_number}</span>.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button
                        className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold"
                        size="lg"
                        isLoading={isLoadingOtpSend}
                        onPress={requestReset}
                      >
                        Email me a reset code
                      </Button>
                      <Button variant="light" onPress={() => setScreen("code")}>
                        Back to passcode
                      </Button>
                    </div>
                  </motion.div>
                )}

                {screen === "reset_code" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Enter reset code</h2>
                      <p className="text-gray-600 mt-2 text-sm">
                        Enter the 6-digit reset code from your email, then choose a new passcode.
                      </p>
                    </div>
                    <div className="space-y-6">
                      {codeBoxes(verifyResetCode)}
                      <Button
                        className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold"
                        size="lg"
                        isLoading={isLoadingOtpVerify}
                        onPress={verifyResetCode}
                      >
                        Continue
                      </Button>
                      <button
                        type="button"
                        className="text-sm text-indigo-600 font-medium"
                        onClick={requestReset}
                      >
                        Resend reset email
                      </button>
                    </div>
                  </motion.div>
                )}

                {screen === "set_passcode" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Set your passcode</h2>
                      <p className="text-gray-600 mt-2 text-sm">
                        Choose a 6-digit passcode for future logins. Do not reuse your email login code.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <Input
                        type="password"
                        inputMode="numeric"
                        label="New passcode"
                        labelPlacement="outside-top"
                        placeholder="6 digits"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                      <Input
                        type="password"
                        inputMode="numeric"
                        label="Confirm passcode"
                        labelPlacement="outside-top"
                        placeholder="Re-enter passcode"
                        value={confirmPasscode}
                        onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePasscode();
                        }}
                      />
                      <Button
                        className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold"
                        size="lg"
                        isLoading={isLoadingOtpVerify}
                        onPress={savePasscode}
                      >
                        Save passcode & continue
                      </Button>
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
