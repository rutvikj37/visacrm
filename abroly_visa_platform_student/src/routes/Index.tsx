import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { addToLocal, getFromLocal } from '../utils/localstorage';
import { setAuthLoading, setProfile, setRole, setToken } from '../redux/slices/loginSlice';
import StudentDashboard from '../modules/Dashboard/StudentDashboard';
import PublicDashboard from '../modules/Dashboard/PublicDashboard';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import { initializeMetaTags } from '../utils/setMetaTags';
import { setThemeColors } from '../utils/setThemeColors';
import AppLoader from '@/components/AppLoader';

const Index = () => {

    const { commonPostAPICall, commonPublicGetApiCalls } = useApiCallUtils()
    const [configLoading, setConfigLoading] = useState(true);
    const [portalMissing, setPortalMissing] = useState(false);
    const [portalBrandKey, setPortalBrandKey] = useState('');

    const tokenData = getFromLocal("token")
    const website = getFromLocal("website")

    const token = useSelector((state: any) => state.login.token) || tokenData;
    const role_type = useSelector((state: any) => state.login.role_type)
    const dispatch = useDispatch();

    const hostKey = () => window.location.hostname.split(':')[0];

    // Apply cached config only when it matches this hostname (avoids wrong agency branding)
    const applyStoredConfig = () => {
        const existingConfig = getFromLocal('app_config');
        if (!existingConfig) return;
        try {
            const cfg = JSON.parse(existingConfig);
            if (cfg.PORTAL_HOST && cfg.PORTAL_HOST !== hostKey()) {
                localStorage.removeItem('app_config');
                return;
            }
            initializeMetaTags();
            setThemeColors();
            if (cfg.AGENT_UUID) setPortalBrandKey(`${hostKey()}:${cfg.AGENT_UUID}`);
        } catch {
            localStorage.removeItem('app_config');
        }
    };

    useEffect(() => {
        applyStoredConfig();
        fetchAppConfig();
    }, []);

    useEffect(() => {
        if (!token) return
        findTheRole()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    useEffect(() => {
        // alert(website)
        if (website !== null && website != "student") {
            window.localStorage.clear()
            window.open("/", "_self")
        }
    }, [])

    const fetchAppConfig = async () => {
        setConfigLoading(true);
        setPortalMissing(false);
        try {
            const hostnameWithoutPort = hostKey();
            const hostParts = hostnameWithoutPort.split('.');
            const isLocalHost = hostnameWithoutPort === 'localhost' || hostnameWithoutPort === '127.0.0.1';

            let domain = '';
            let subdomain = '';
            if (hostParts.length >= 3) {
                subdomain = hostParts[0];
                domain = hostParts.slice(-2).join('.');
            } else if (hostParts.length === 2) {
                domain = hostnameWithoutPort;
            }

            const queryParams = new URLSearchParams();
            if (domain) queryParams.append('domain', domain);
            if (subdomain) queryParams.append('sudomain', subdomain);
            const queryString = queryParams.toString();
            const apiUrl = queryString ? `/agent/get_agency?${queryString}` : '/agent/get_agency';

            const { data, success } = await commonPublicGetApiCalls(apiUrl);

            if (success && data) {
                const ensureFullUrl = (url: string) => {
                    if (!url) return '';
                    if (url.startsWith('http://') || url.startsWith('https://')) return url;
                    if (url.startsWith('www.')) return `https://${url}`;
                    return url;
                };

                const config = {
                    PORTAL_HOST: hostnameWithoutPort,
                    AGENT_UUID: data.uuid,
                    AGENT_ID: data.id || data.agent_id || data.agentId || '',
                    PRIMARY_COLOR: data.primary_color || data.primaryColor || '',
                    PRIMARY_FOREGROUND_COLOR: data.primary_foreground_color || data.primaryForegroundColor || '',
                    DARK_PRIMARY_COLOR: data.dark_primary_color || data.darkPrimaryColor || '',
                    APP_NAME: data.app_name || data.appName || '',
                    SUPPORT_NUMBER: data.support_number || data.supportNumber || '',
                    SUPPORT_EMAIL: data.support_email || data.supportEmail || '',
                    CERTIFICATE_URL: ensureFullUrl(data.certificate_url || data.certificateUrl || ''),
                    AGENCY_ADDRESS: data.agency_address || data.agencyAddress || '',
                    FAVICON_URL: data.favicon_url_full || data.faviconUrlFull || data.favicon_url || data.faviconUrl || '/logo.png',
                    META_DESCRIPTION: data.meta_description || data.metaDescription || '',
                    META_KEYWORDS: data.meta_keywords || data.metaKeywords || '',
                    OG_IMAGE: data.og_image_full || data.ogImageFull || data.og_image || data.ogImage || '/logo.png',
                    OG_URL: ensureFullUrl(data.og_url || data.ogUrl || ''),
                    ADDONS: JSON.stringify(data.addons ?? null)
                };

                addToLocal('app_config', JSON.stringify(config));
                initializeMetaTags();
                setThemeColors();
                setPortalBrandKey(`${hostnameWithoutPort}:${config.AGENT_UUID}`);
                setConfigLoading(false);
            } else {
                // Don't keep another agency's cached branding on this host
                localStorage.removeItem('app_config');
                if (!isLocalHost) setPortalMissing(true);
                initializeMetaTags();
                setConfigLoading(false);
            }
        } catch (error) {
            console.error('Failed to fetch app config:', error);
            const existingConfig = getFromLocal('app_config');
            if (existingConfig) {
                try {
                    const cfg = JSON.parse(existingConfig);
                    if (cfg.PORTAL_HOST === hostKey()) {
                        initializeMetaTags();
                        setThemeColors();
                        if (cfg.AGENT_UUID) setPortalBrandKey(`${hostKey()}:${cfg.AGENT_UUID}`);
                        setConfigLoading(false);
                        return;
                    }
                } catch { /* ignore */ }
                localStorage.removeItem('app_config');
            }
            if (hostKey() !== 'localhost' && hostKey() !== '127.0.0.1') setPortalMissing(true);
            initializeMetaTags();
            setConfigLoading(false);
        }
    }

    const findTheRole = async () => {
        const { data, success } = await commonPostAPICall({}, "/user/kyc")

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
            addToLocal("website", "student")

        } else {
            dispatch(setAuthLoading('true'))
            dispatch(setToken(null))
            // Only clear auth-related items, keep app_config
            localStorage.removeItem('token');
            localStorage.removeItem('authLoad');
            localStorage.removeItem('profile');
            localStorage.removeItem('phone_with_code');
            localStorage.removeItem('name');
            localStorage.removeItem('website');
            // Don't clear app_config - keep it for consistent branding
        }
    }
    if (configLoading) {
        return <AppLoader label="Loading" />
    }

    if (portalMissing && !token) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-default-50">
                <div className="max-w-md text-center space-y-3">
                    <h1 className="text-2xl font-semibold">Portal not found</h1>
                    <p className="text-default-500 text-sm">
                        This address is not linked to an agency student portal. Ask your agency for their portal link
                        (subdomain or custom domain).
                    </p>
                </div>
            </div>
        );
    }

    if (token) {
        if (!role_type) {
            return <AppLoader label="Signing you in" />
        }
        return role_type == "user" ? <StudentDashboard /> : null
    }

    return <PublicDashboard key={portalBrandKey || hostKey()} />
}

export default Index