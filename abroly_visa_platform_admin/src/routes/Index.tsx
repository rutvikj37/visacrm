import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { addToLocal, getFromLocal } from '../utils/localstorage';
import { setAuthLoading, setProfile, setRole, setToken } from '../redux/slices/loginSlice';
import AdminDashboard from '../modules/Dashboard/AdminDashboard';
import PublicDashboard from '../modules/Dashboard/PublicDashboard';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import AppLoader from '@/components/AppLoader';

const PleaseWait = () => <AppLoader label="Signing you in" />

const Index = () => {

    const { commonPostAPICall } = useApiCallUtils()

    const tokenData = getFromLocal("token")
    const website = getFromLocal("website")

    useEffect(() => {
        if (website !== null && website != "admin") {
            window.localStorage.clear()
            window.open("/", "_self")
        }
    }, [])

    const token = useSelector((state: any) => state.login.token) || tokenData;
    const role_type = useSelector((state: any) => state.login.role_type)
    const dispatch = useDispatch();

    useEffect(() => {
        if (!token) return
        findTheRole()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    const findTheRole = async () => {
        const { data, success } = await commonPostAPICall({}, "/user/admin/kyc")

        if (success == true) {

            dispatch(setRole(data.role))
            dispatch(setAuthLoading('true'))
            localStorage.setItem("authLoad", 'true')
            dispatch(setToken(token))
            dispatch(setProfile({
                profileimage: data?.profile,
                user_name: data?.name,
                phone: data?.country_code + " " + data?.phone,
                email: data?.email
            }))
            addToLocal("profile", data.profile)
            addToLocal("phone_with_code", data.country_code + " " + data.phone)
            addToLocal("name", data.name)
            addToLocal("website", "admin")

        } else {
            // leave public shell; do not flash-clear mid-session on a transient KYC miss
        }
    }

    if (token) {
        if (!role_type) return <PleaseWait />
        return role_type == "admin" ? <AdminDashboard /> : null
    }

    return <PublicDashboard />
}

export default Index
