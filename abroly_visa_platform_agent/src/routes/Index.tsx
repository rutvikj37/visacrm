import { applyCaseFlow } from '@/modules/AgentAdmin/Cases/caseShared';
import React, { useEffect } from 'react'
import { applyBrand } from '@/lib/theme';
import { useDispatch, useSelector } from 'react-redux';
import { addToLocal, getFromLocal } from '../utils/localstorage';
import { setAgencyInfo, setAuthLoading, setBranchId, setProfile, setRole, setSubscription, setTeamRole, setToken } from '../redux/slices/loginSlice';
import SubscriptionExpired from '@/modules/AgentAdmin/Subscription/SubscriptionExpired';
import PublicDashboard from '../modules/Dashboard/PublicDashboard';
import AgentCRM from '../modules/Dashboard/AgentAdminCRM';
import SubAgentCRM from '@/modules/Dashboard/SubAgentCRM';
import { persistor } from '@/redux/store';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import AppLoader from '@/components/AppLoader';
import { appPath } from "@/utils/appBase";

const PleaseWait = () => <AppLoader label="Signing you in" />

const Index = () => {

    const { commonPostAPICall } = useApiCallUtils()

    const tokenData = getFromLocal("token")
    const website = getFromLocal("website")

    const token = useSelector((state: any) => state.login.token) || tokenData;
    const role_type = useSelector((state: any) => state.login.role_type)
    const subscription = useSelector((state: any) => state.login.subscription)
    const dispatch = useDispatch();

    useEffect(() => {
        if (!token) return
        findTheRole()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    useEffect(() => {
        if (website !== null && website != "agent") {
            window.localStorage.clear()
            window.open(appPath("/"), "_self")
        }
    }, [])

    const findTheRole = async () => {
        const { data, success } = await commonPostAPICall({}, "agent/kyc")

        if (success == true) {
            // Brand CSS vars first (no React remount). Then batch Redux updates.
            applyBrand(data?.brand_color)
            applyCaseFlow(data?.business_focus)
            dispatch(setRole(data?.role))
            dispatch(setSubscription(data?.subscription))
            dispatch(setTeamRole(data?.team_role))
            dispatch(setBranchId(data?.branch_id))
            dispatch(setAgencyInfo({ name: data?.agency_name || null, logo: data?.agency_logo || null }))
            dispatch(setAuthLoading('true'))
            localStorage.setItem("authLoad", 'true')
            // Avoid setToken if unchanged — prevents AgentCRM remount churn via token effect
            dispatch(setProfile({
                profileimage: data?.profile,
                user_name: data?.name,
                phone: data?.country_code + " " + data?.phone,
                email: data?.email,
                designation: data?.designation
            }))
            addToLocal("profile", data?.profile)
            addToLocal("phone_with_code", data?.country_code + " " + data?.phone)
            addToLocal("name", data?.name)
            addToLocal("website", "agent")

        } else {
            dispatch(setAuthLoading('true'))
            dispatch(setToken(null))
            localStorage.clear()
            persistor.purge()
        }
    }

    // Keep CRM mounted whenever we already know the role (refresh / background KYC).
    // Only show the full-screen wait on first login before KYC returns a role.
    if (token) {
        if (!role_type) return <PleaseWait />
        return (
            <>
                {(subscription?.expired && (role_type == "agent" || role_type == "sub-agent")) && <SubscriptionExpired /> ||
                    role_type == "agent" && <AgentCRM /> ||
                    role_type == "sub-agent" && <SubAgentCRM />}
            </>
        )
    }

    return <PublicDashboard />
}

export default Index
