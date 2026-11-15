import { Button, Input } from '@nextui-org/react'
import React, { useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { ErrorToast } from '../../utils/Toaster'
import { setAuthLoading, setProfile, setToken } from '../../redux/slices/loginSlice'
import { addToLocal } from '../../utils/localstorage'
import { GrEdit } from 'react-icons/gr'
import { useNavigate } from 'react-router-dom'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";

const IS_LOCAL = import.meta.env.VITE_IS_LOCAL || false
// SMS OTPs are 4 digits; local test OTPs and the admin's fixed login code are 6
const DEFAULT_OTP_LENGTH = IS_LOCAL == "true" ? 6 : 4

const Login = () => {

    const { commonPostPublicAPICall } = useApiCallUtils()

    const dispatch = useDispatch()
    const [OTPScreen, setOTPScreeen] = useState(false)
    const [verificationId, setVerificationId] = useState("")
    const [numberAndCountryCode, setNumberAndCountryCode] = useState({
        phone_number: "",
        country_code: "+91"
    })
    const [OTP_LENGTH, setOtpLength] = useState(DEFAULT_OTP_LENGTH)
    const usesLoginCode = OTP_LENGTH === 6 && IS_LOCAL != 'true'
    const initialValues = Array(DEFAULT_OTP_LENGTH).fill('');
    const [otpValues, setValues] = useState<string[]>(initialValues);
    const inputRefs = Array(6).fill(0).map(() => useRef<HTMLInputElement>(null));
    const startCodeEntry = (verification: string) => {
        const len = verification === 'LOGIN_CODE' ? 6 : DEFAULT_OTP_LENGTH
        setOtpLength(len)
        setValues(Array(len).fill(''))
    }

    const [sendOtpLoading, setSendOtpLoading] = useState(false)
    const [verifyOtpLoading, setVerifyOtpLoading] = useState(false)

    // handle change of otp
    const handleChange = (event: any, index: number) => {
        if (/^\d?$/.test(event.target.value)) {
            const newValues = [...otpValues];
            newValues[index] = event.target.value;
            setValues(newValues);
            if (event.target.value && index < OTP_LENGTH - 1) {
                const nextInput = inputRefs[index + 1].current;
                if (nextInput) {
                    nextInput.focus();
                }
            }
        }
    };

    // handle backspace 
    const handleBackspace = (event: any, index: number) => {
        if (event.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
    };

    // handle paste
    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        const pasteData = event.clipboardData.getData('text').slice(0, OTP_LENGTH).split('');
        pasteData.forEach((value: string, index: number) => {
            if (index < otpValues.length) {
                otpValues[index] = value;
                const inputEl = inputRefs[index].current;
                if (inputEl !== null) {
                    inputEl.value = value;
                }
            }
        });

        setValues([...otpValues]);
        const firstEmptyIndex = pasteData.length < OTP_LENGTH ? pasteData.length : -1;
        if (firstEmptyIndex !== -1) {
            inputRefs[firstEmptyIndex].current?.focus();
        }
    };

    const submitCall = async () => {    
        setSendOtpLoading(true)
        const { success, data } = await commonPostPublicAPICall({ phone: numberAndCountryCode.phone_number, country_code: "+91" }, `user/admin/${IS_LOCAL == 'true' ? 'login_with_number_custom' : 'login_with_number'}`, true);
        if (success) {
            startCodeEntry(data)
            setOTPScreeen(true)
            setVerificationId(data)
        }
        setSendOtpLoading(false)
    }

    const resendOTPCall = async () => {
        const { success, data } = await commonPostPublicAPICall({ country_code: numberAndCountryCode.country_code, phone: numberAndCountryCode.phone_number }, `user/admin/${IS_LOCAL == 'true' ? 'login_with_number_custom' : 'login_with_number'}`, true);
        if (success) {
            startCodeEntry(data)
            setOTPScreeen(true)
            setNumberAndCountryCode({
                country_code: numberAndCountryCode.country_code,
                phone_number: numberAndCountryCode.phone_number
            })
            setVerificationId(data)
        }
    }

    const navigate = useNavigate()
    return (
        <section className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Admin Login</h1>
                {
                    OTPScreen === false ?
                        <form className="space-y-4" onSubmit={(e) => {
                            e.preventDefault()
                            // submitCall()
                        }}>
                            <Input
                                label="Phone Number"
                                startContent={<p className='text-sm'>+91</p>}
                                type="tel"
                                {...phoneInputProps}
                                value={numberAndCountryCode.phone_number}
                                onChange={(e) => {
                                    setNumberAndCountryCode({
                                        ...numberAndCountryCode,
                                        phone_number: toPhoneDigits(e.target.value)
                                    })
                                }}
                                className='max-w-xl'
                                required
                            />
                            <Button
                                type='submit'
                                variant='solid'
                                color='primary'
                                onPress={submitCall}
                                className="w-full"
                                isLoading={sendOtpLoading}
                                disabled={sendOtpLoading}
                            >Send OTP</Button>
                        </form>
                        :
                        <div className="flex flex-col items-center">
                            <p className="text-base mb-4">{usesLoginCode ? "Enter your 6-digit admin login code" : "Enter the OTP sent to your phone number"}</p>
                            <section className="flex flex-row items-center gap-2">
                                <p className='flex items-center'>{"+91"}{" "}{numberAndCountryCode.phone_number}</p>
                                <Button isIconOnly variant='light' onPress={() => { setOTPScreeen(false) }}>
                                    <GrEdit className="text-sm" />
                                </Button>
                            </section>
                            <div className="flex flex-row items-center gap-x-2 gap-y-2 mt-4">
                                {otpValues.map((value: string, index: number) => (
                                    <input
                                        key={index}
                                        autoFocus={index === 0}
                                        ref={inputRefs[index]}
                                        type="number"
                                        maxLength={1}
                                        max={9}
                                        value={value}
                                        onChange={(e) => handleChange(e, index)}
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && index === OTP_LENGTH - 1) {
                                                let emptyOTP = otpValues.some(item => item === "");
                                                if (emptyOTP) {
                                                    ErrorToast("Please Enter OTP")
                                                } else {
                                                    setVerifyOtpLoading(true)
                                                    const { success, data } = await commonPostPublicAPICall({ country_code: numberAndCountryCode.country_code, otp: otpValues.join(""), phone_number: "" + numberAndCountryCode.phone_number, verificationId }, `user/admin/${IS_LOCAL == 'true' ? 'validate_otp_custom' : 'validate_otp'}`, true);
                                                    if (success) {
                                                        dispatch(setToken(data.token))
                                                        dispatch(setProfile({
                                                            phone: data.country_code + " " + data.phone,
                                                            user_name: data.name
                                                        }))
                                                        addToLocal("token", data.token)
                                                        addToLocal("phone_with_code", data.country_code + " " + data.phone)
                                                        addToLocal("name", data.name)
                                                        dispatch(setAuthLoading('false'))
                                                        navigate("/")
                                                    }
                                                    setVerifyOtpLoading(false)
                                                }
                                            } else {
                                                handleBackspace(e, index)
                                            }
                                        }}
                                        onPaste={handlePaste}
                                        className="h-10 w-10 text-center text-gray-900 border border-gray-300 rounded-lg bg-gray-50 text-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                ))}
                            </div>
                            <div className='flex flex-row gap-2 my-4'>
                                <Button
                                    onPress={async () => {
                                        let emptyOTP = otpValues.some(item => item === "");
                                        if (emptyOTP) {
                                            ErrorToast("Please Enter OTP")
                                        } else {
                                            setVerifyOtpLoading(true)
                                            const { success, data } = await commonPostPublicAPICall({ country_code: numberAndCountryCode.country_code, otp: otpValues.join(""), phone_number: "" + numberAndCountryCode.phone_number, verificationId }, `user/admin/${IS_LOCAL == 'true' ? 'validate_otp_custom' : 'validate_otp'}`, true);
                                            if (success) {
                                                dispatch(setToken(data.token))
                                                dispatch(setProfile({
                                                    phone: data.country_code + " " + data.phone,
                                                    user_name: data.name
                                                }))
                                                addToLocal("token", data.token)
                                                addToLocal("phone_with_code", data.country_code + " " + data.phone)
                                                addToLocal("name", data.name)
                                                dispatch(setAuthLoading('false'))
                                                navigate("/")
                                            }
                                            setVerifyOtpLoading(false)
                                        }
                                    }}
                                    className="w-full"
                                >
                                    Verify
                                </Button>
                                <Button
                                    onPress={resendOTPCall}
                                    className="w-full"
                                >
                                    Resend
                                </Button>
                            </div>
                        </div>
                }
            </div>
        </section>
    )
}

export default Login