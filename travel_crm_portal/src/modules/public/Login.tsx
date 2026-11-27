import { Button, Input, Card, CardBody, CardHeader } from '@nextui-org/react'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { ErrorToast } from '../../utils/Toaster'
import { setAuthLoading, setProfile, setToken } from '../../redux/slices/loginSlice'
import { addToLocal } from '../../utils/localstorage'
import { GrEdit } from 'react-icons/gr'
import { useNavigate } from 'react-router-dom'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import { getAgentUuid, getAppName, getSupportEmail, getSupportNumber, isTravelFocus } from '@/utils/config'
import { phoneInputProps, toPhoneDigits } from "@/utils/phone";
import { AgencyLogo } from '@/components/AgencyBrand'
import InstallAppCard from '@/components/InstallAppCard'

const IS_LOCAL = import.meta.env.VITE_IS_LOCAL || false

type Screen = "phone" | "code" | "set_passcode" | "forgot" | "reset_code"

const Login = () => {
    const { commonPostPublicAPICall } = useApiCallUtils()
    const agencyReady = Boolean(getAgentUuid())
    const agencyName = getAppName() || "Student portal"
    const supportPhone = getSupportNumber()
    const supportEmail = getSupportEmail()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [loginLoading, setLoginLoading] = useState(false)
    const [screen, setScreen] = useState<Screen>("phone")
    const [verificationId, setVerificationId] = useState("")
    const [setupToken, setSetupToken] = useState("")
    const [numberAndCountryCode, setNumberAndCountryCode] = useState(() => ({
        phone_number: (new URLSearchParams(window.location.search).get("phone") || "").replace(/\D/g, "").slice(-10),
        country_code: "+91"
    }))
    const [codeLength, setCodeLength] = useState(4)
    const usesLoginCode = verificationId === 'LOGIN_CODE'
    const usesPasscode = verificationId === 'PASSCODE'
    const usesDigitLogin = usesLoginCode || usesPasscode
    const [otpValues, setValues] = useState<string[]>(Array(4).fill(''))
    const [passcode, setPasscode] = useState("")
    const [confirmPasscode, setConfirmPasscode] = useState("")
    const inputRefs = Array(6).fill(0).map(() => useRef<HTMLInputElement>(null))

    const startCodeEntry = (verification: string) => {
        const len = verification === 'LOGIN_CODE' || verification === 'PASSCODE' ? 6 : 4
        setCodeLength(len)
        setValues(Array(len).fill(''))
        setVerificationId(verification || '')
        if (verification === 'PASSCODE') setPasscode("")
    }

    const finishLogin = (data: any) => {
        dispatch(setToken(data.token))
        dispatch(setProfile({ phone: data.country_code + " " + data.phone, user_name: data.name }))
        addToLocal("token", data.token)
        addToLocal("phone_with_code", data.country_code + " " + data.phone)
        addToLocal("name", data.name)
        dispatch(setAuthLoading('false'))
        navigate("/")
    }

    const handleMustSetPasscode = (data: any) => {
        if (data?.must_set_passcode && data?.setup_token) {
            setSetupToken(data.setup_token)
            setPasscode("")
            setConfirmPasscode("")
            setScreen("set_passcode")
            return true
        }
        return false
    }

    const handleChange = (event: any, index: number) => {
        if (/^\d?$/.test(event.target.value)) {
            const newValues = [...otpValues]
            newValues[index] = event.target.value
            setValues(newValues)
            if (event.target.value && index < codeLength - 1) {
                inputRefs[index + 1].current?.focus()
            }
        }
    }

    const handleBackspace = (event: any, index: number) => {
        if (event.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs[index - 1].current?.focus()
        }
    }

    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault()
        const pasteData = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, codeLength).split('')
        pasteData.forEach((value: string, index: number) => {
            if (index < otpValues.length) {
                otpValues[index] = value
                const inputEl = inputRefs[index].current
                if (inputEl) inputEl.value = value
            }
        })
        setValues([...otpValues])
        const firstEmptyIndex = pasteData.length < codeLength ? pasteData.length : -1
        if (firstEmptyIndex !== -1) inputRefs[firstEmptyIndex].current?.focus()
    }

    const loginPath = () => `user/student/${IS_LOCAL == 'true' ? 'login_with_number_custom' : 'login_with_number'}`
    const validatePath = () => `user/student/${IS_LOCAL == 'true' ? 'validate_otp_custom' : 'validate_otp'}`

    const submitCall = async () => {
        if (!agencyReady) {
            ErrorToast("This portal is not linked to an agency. Open your agency's portal link.")
            return
        }
        setLoginLoading(true)
        const { success, data } = await commonPostPublicAPICall(
            { phone: numberAndCountryCode.phone_number, country_code: "+91" },
            loginPath(),
            true
        )
        if (success) {
            startCodeEntry(typeof data === 'string' ? data : data || '')
            setScreen("code")
        }
        setLoginLoading(false)
    }

    const resendOTPCall = async () => {
        const { success, data } = await commonPostPublicAPICall(
            { country_code: numberAndCountryCode.country_code, phone: numberAndCountryCode.phone_number },
            loginPath(),
            true
        )
        if (success) {
            startCodeEntry(typeof data === 'string' ? data : data || '')
            setScreen("code")
        }
    }

    const enteredCode = () => (usesPasscode ? passcode.replace(/\D/g, "") : otpValues.join(""))

    const codeComplete = () => {
        const code = enteredCode()
        if (usesPasscode) return code.length >= 4 && code.length <= 6
        return otpValues.slice(0, codeLength).every((v) => v !== "") && code.length === codeLength
    }

    const verifyOTP = async () => {
        if (!codeComplete()) {
            ErrorToast(usesPasscode ? "Enter your 4–6 digit passcode" : usesLoginCode ? "Enter your login code" : "Please Enter OTP")
            return
        }
        setLoginLoading(true)
        const { success, data } = await commonPostPublicAPICall(
            {
                country_code: numberAndCountryCode.country_code,
                otp: enteredCode(),
                phone_number: numberAndCountryCode.phone_number,
                verificationId: verificationId || "PASSCODE"
            },
            validatePath(),
            true
        )
        if (success) {
            if (handleMustSetPasscode(data)) {
                setLoginLoading(false)
                return
            }
            if (data?.token) finishLogin(data)
        }
        setLoginLoading(false)
    }

    const requestReset = async () => {
        setLoginLoading(true)
        const { success } = await commonPostPublicAPICall(
            {
                phone: numberAndCountryCode.phone_number,
                country_code: numberAndCountryCode.country_code || "+91"
            },
            "user/student/request_passcode_reset",
            true
        )
        if (success) {
            startCodeEntry("LOGIN_CODE")
            setScreen("reset_code")
        }
        setLoginLoading(false)
    }

    const verifyResetCode = async () => {
        if (!otpValues.every((v) => v !== "")) {
            ErrorToast("Enter the 6-digit reset code from your email")
            return
        }
        setLoginLoading(true)
        const { success, data } = await commonPostPublicAPICall(
            {
                phone: numberAndCountryCode.phone_number,
                country_code: numberAndCountryCode.country_code || "+91",
                code: otpValues.join("")
            },
            "user/student/verify_passcode_reset",
            true
        )
        if (success) handleMustSetPasscode(data)
        setLoginLoading(false)
    }

    const savePasscode = async () => {
        const pin = passcode.replace(/\D/g, "")
        if (pin.length !== 6) {
            ErrorToast("Passcode must be 6 digits")
            return
        }
        if (pin !== confirmPasscode.replace(/\D/g, "")) {
            ErrorToast("Passcodes do not match")
            return
        }
        setLoginLoading(true)
        const { success, data } = await commonPostPublicAPICall(
            { setup_token: setupToken, passcode: pin, confirm_passcode: pin },
            "user/student/set_passcode",
            true
        )
        if (success && data?.token) finishLogin(data)
        setLoginLoading(false)
    }

    return (
        <section className="min-h-[85vh] flex flex-col items-center justify-center gap-4 px-4 bg-gradient-to-b from-primary/10 to-default-100">
            <div className="w-full max-w-md">
                <InstallAppCard />
            </div>
            <Card className="w-full max-w-md shadow-lg p-6 bg-white rounded-xl">
                <CardHeader className="flex flex-col items-center gap-3">
                    <AgencyLogo size={56} wide />
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-gray-800">{agencyName}</h1>
                        <p className="text-sm text-gray-500 mt-1">{isTravelFocus() ? "Client login — track your visa application and documents" : "Student login — track your visa case and documents"}</p>
                    </div>
                </CardHeader>
                <CardBody>
                    {!agencyReady && (
                        <p className="text-sm text-warning-600 mb-4 text-center">
                            Open the portal link from your agency (their subdomain or domain) so we can load their branding.
                        </p>
                    )}

                    {screen === "phone" && (
                        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                            <Input
                                label="Enter your phone number"
                                labelPlacement='outside-left'
                                startContent={<span className="text-sm text-gray-500">+91</span>}
                                type="tel"
                                {...phoneInputProps}
                                value={numberAndCountryCode.phone_number}
                                onChange={(e) =>
                                    setNumberAndCountryCode({
                                        ...numberAndCountryCode,
                                        phone_number: toPhoneDigits(e.target.value)
                                    })
                                }
                                className="w-full block"
                                variant="bordered"
                                placeholder="1234567890"
                            />
                            <Button
                                type="submit"
                                variant="solid"
                                color="primary"
                                onPress={submitCall}
                                isLoading={loginLoading}
                                isDisabled={!agencyReady || numberAndCountryCode.phone_number.length < 10}
                                className="w-full bg-primary hover:bg-primary/80 text-white font-medium"
                            >
                                Continue
                            </Button>
                        </form>
                    )}

                    {screen === "code" && (
                        <div className="space-y-6">
                            <div className="text-center flex items-center justify-center gap-2">
                                <p className="text-sm text-gray-600">
                                    {usesPasscode
                                        ? 'Enter your passcode for'
                                        : usesLoginCode
                                            ? 'Enter your 6-digit login code for'
                                            : 'Enter the OTP sent to'}{" "}
                                    <span className="font-medium">
                                        {numberAndCountryCode.country_code} {numberAndCountryCode.phone_number}
                                    </span>
                                </p>
                                <Button isIconOnly variant="light" onPress={() => setScreen("phone")}>
                                    <GrEdit className="text-gray-500" />
                                </Button>
                            </div>
                            {usesPasscode ? (
                                <Input
                                    type="password"
                                    inputMode="numeric"
                                    label="Passcode"
                                    labelPlacement="outside"
                                    placeholder="4–6 digits"
                                    variant="bordered"
                                    value={passcode}
                                    onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') verifyOTP() }}
                                />
                            ) : (
                                <div className="flex justify-center gap-2">
                                    {otpValues.map((value: string, index: number) => (
                                        <input
                                            key={index}
                                            autoFocus={index === 0}
                                            ref={inputRefs[index]}
                                            type="number"
                                            maxLength={1}
                                            value={value}
                                            onChange={(e) => handleChange(e, index)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && index === codeLength - 1) verifyOTP()
                                                else handleBackspace(e, index)
                                            }}
                                            onPaste={handlePaste}
                                            className="w-11 h-12 sm:w-12 text-center text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between gap-2">
                                <Button
                                    variant="flat"
                                    color="primary"
                                    onPress={verifyOTP}
                                    isLoading={loginLoading}
                                    className="w-full font-medium bg-primary hover:bg-primary/80 text-white"
                                >
                                    {usesDigitLogin ? 'Log in' : 'Verify OTP'}
                                </Button>
                                {!usesDigitLogin && (
                                    <Button
                                        variant="bordered"
                                        onPress={resendOTPCall}
                                        className="w-full text-gray-600 hover:text-blue-600 font-medium border border-primary"
                                    >
                                        Resend OTP
                                    </Button>
                                )}
                            </div>
                            {usesLoginCode && (
                                <p className="text-xs text-center text-default-500">
                                    Lost your invite code? Ask your agency to send the portal invite again.
                                </p>
                            )}
                            {usesPasscode && (
                                <button
                                    type="button"
                                    className="text-sm text-primary font-medium w-full text-center"
                                    onClick={() => setScreen("forgot")}
                                >
                                    Forgot passcode?
                                </button>
                            )}
                        </div>
                    )}

                    {screen === "forgot" && (
                        <div className="space-y-6">
                            <p className="text-sm text-gray-600 text-center">
                                We will email a short-lived reset code to the address on your account for{" "}
                                <span className="font-medium">
                                    {numberAndCountryCode.country_code} {numberAndCountryCode.phone_number}
                                </span>.
                            </p>
                            <Button
                                color="primary"
                                className="w-full bg-primary text-white"
                                isLoading={loginLoading}
                                onPress={requestReset}
                            >
                                Email me a reset code
                            </Button>
                            <Button variant="light" className="w-full" onPress={() => setScreen("code")}>
                                Back to passcode
                            </Button>
                        </div>
                    )}

                    {screen === "reset_code" && (
                        <div className="space-y-6">
                            <p className="text-sm text-gray-600 text-center">
                                Enter the 6-digit reset code from your email, then choose a new passcode.
                            </p>
                            <div className="flex justify-center gap-2">
                                {otpValues.map((value: string, index: number) => (
                                    <input
                                        key={index}
                                        autoFocus={index === 0}
                                        ref={inputRefs[index]}
                                        type="number"
                                        maxLength={1}
                                        value={value}
                                        onChange={(e) => handleChange(e, index)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && index === codeLength - 1) verifyResetCode()
                                            else handleBackspace(e, index)
                                        }}
                                        onPaste={handlePaste}
                                        className="w-11 h-12 sm:w-12 text-center text-lg border border-gray-300 rounded-md"
                                    />
                                ))}
                            </div>
                            <Button color="primary" className="w-full bg-primary text-white" isLoading={loginLoading} onPress={verifyResetCode}>
                                Continue
                            </Button>
                            <button type="button" className="text-sm text-primary font-medium w-full text-center" onClick={requestReset}>
                                Resend reset email
                            </button>
                        </div>
                    )}

                    {screen === "set_passcode" && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 text-center">
                                Choose a 6-digit passcode for future logins.
                            </p>
                            <Input
                                type="password"
                                inputMode="numeric"
                                label="New passcode"
                                labelPlacement="outside"
                                placeholder="6 digits"
                                variant="bordered"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            />
                            <Input
                                type="password"
                                inputMode="numeric"
                                label="Confirm passcode"
                                labelPlacement="outside"
                                placeholder="Re-enter passcode"
                                variant="bordered"
                                value={confirmPasscode}
                                onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                onKeyDown={(e) => { if (e.key === 'Enter') savePasscode() }}
                            />
                            <Button color="primary" className="w-full bg-primary text-white" isLoading={loginLoading} onPress={savePasscode}>
                                Save passcode & continue
                            </Button>
                        </div>
                    )}

                    {(supportPhone || supportEmail) && (
                        <>
                            <hr className="my-6 border-gray-200" />
                            <p className="text-center text-xs text-default-500">
                                Need help?{" "}
                                {supportPhone && <a className="text-primary font-medium" href={`tel:${supportPhone}`}>{supportPhone}</a>}
                                {supportPhone && supportEmail && " · "}
                                {supportEmail && <a className="text-primary font-medium" href={`mailto:${supportEmail}`}>{supportEmail}</a>}
                            </p>
                        </>
                    )}
                    <p className="text-center text-xs text-default-500 mt-4">
                        Agency owner or team member?{" "}
                        <a className="text-primary font-medium" href={agencyLoginUrl()}>Agency login</a>
                    </p>
                </CardBody>
            </Card>
        </section>
    )
}

/**
 * The agency panel lives on the same address as this portal, under /agency
 * (rutvik.techxsolutions.io/agency/login). The platform's own student site links to the shared panel.
 */
const agencyLoginUrl = () => {
    const h = window.location.hostname;
    if (/^student\./.test(h)) return `https://${h.replace(/^student\./, "crm.")}/agency/login`;
    return "/agency/login";
};

export default Login
