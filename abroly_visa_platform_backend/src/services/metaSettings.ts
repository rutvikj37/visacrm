import PlatformSetting from "../model/PlatformSetting";
import { decryptJson, encryptJson, generatePublicKey, maskSecret } from "../helpers/crypto";
import { parseJsonValue } from "../helpers/json";
import { SaasError } from "./saasError";

/**
 * Platform-wide Meta (Facebook) app credentials.
 * Env vars win when set; otherwise values from PlatformSetting key "meta".
 * Agencies then connect their own Pages from Lead Sources.
 */

export type MetaRuntimeConfig = {
    appId: string;
    appSecret: string;
    verifyToken: string;
    configId: string;
    version: string;
    graphBase: string;
    publicApi: string;
};

type StoredMeta = {
    app_id?: string;
    /** encrypted `{ s: string }` — never store the raw secret in JSON */
    app_secret_enc?: string | null;
    verify_token?: string;
    login_config_id?: string;
    graph_version?: string;
};

let cache: { at: number; config: MetaRuntimeConfig } | null = null;
const CACHE_MS = 15_000;

const fromEnvOnly = (): MetaRuntimeConfig => ({
    appId: (process.env.META_APP_ID || "").trim(),
    appSecret: (process.env.META_APP_SECRET || "").trim(),
    verifyToken: (process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim(),
    configId: (process.env.META_LOGIN_CONFIG_ID || "").trim(),
    version: (process.env.META_GRAPH_VERSION || "v21.0").trim() || "v21.0",
    graphBase: (process.env.META_GRAPH_BASE || "https://graph.facebook.com").replace(/\/+$/, ""),
    publicApi: (process.env.PUBLIC_API_URL || "").replace(/\/+$/, ""),
});

const merge = (stored: StoredMeta): MetaRuntimeConfig => {
    const base = fromEnvOnly();
    let secretFromDb = "";
    if (stored.app_secret_enc) {
        secretFromDb = decryptJson<{ s: string }>(stored.app_secret_enc)?.s || "";
    }
    return {
        appId: base.appId || String(stored.app_id || "").trim(),
        appSecret: base.appSecret || secretFromDb,
        verifyToken: base.verifyToken || String(stored.verify_token || "").trim(),
        configId: base.configId || String(stored.login_config_id || "").trim(),
        version: base.version || String(stored.graph_version || "v21.0").trim() || "v21.0",
        graphBase: base.graphBase,
        publicApi: base.publicApi,
    };
};

/** Sync snapshot (env + last loaded DB). Prefer refreshMetaConfig() on request paths. */
export const peekMetaConfig = (): MetaRuntimeConfig => cache?.config || fromEnvOnly();

export const refreshMetaConfig = async (force = false): Promise<MetaRuntimeConfig> => {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.config;
    const row: any = await PlatformSetting.findOne({ where: { key: "meta" } });
    const stored = (parseJsonValue(row?.get?.("value") ?? row?.value) || {}) as StoredMeta;
    const config = merge(stored);
    cache = { at: Date.now(), config };
    return config;
};

export const invalidateMetaConfigCache = () => { cache = null; };

export const metaConfiguredFrom = (c: MetaRuntimeConfig) => ({
    facebook: Boolean(c.appId && c.appSecret && c.publicApi),
    webhook: Boolean(c.appSecret && c.verifyToken),
});

/** Safe payload for the platform admin form (no raw secret). */
export const presentMetaSettings = async () => {
    const config = await refreshMetaConfig(true);
    const row: any = await PlatformSetting.findOne({ where: { key: "meta" } });
    const stored = (parseJsonValue(row?.get?.("value") ?? row?.value) || {}) as StoredMeta;
    const envLocks = {
        app_id: Boolean((process.env.META_APP_ID || "").trim()),
        app_secret: Boolean((process.env.META_APP_SECRET || "").trim()),
        verify_token: Boolean((process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim()),
        login_config_id: Boolean((process.env.META_LOGIN_CONFIG_ID || "").trim()),
    };
    const publicApi = config.publicApi;
    return {
        app_id: config.appId,
        app_secret_saved: Boolean(config.appSecret),
        app_secret_hint: config.appSecret ? maskSecret(config.appSecret) : null,
        verify_token: config.verifyToken,
        login_config_id: config.configId,
        graph_version: config.version,
        public_api_url: publicApi || null,
        oauth_redirect_uri: publicApi ? `${publicApi}/v1/public/meta/oauth/callback` : null,
        webhook_url: publicApi ? `${publicApi}/v1/public/meta/webhook` : null,
        configured: metaConfiguredFrom(config),
        env_locked: envLocks,
        stored_in_db: Boolean(row),
        docs: "See backend docs/META_SETUP.md for Meta app + App Review steps.",
    };
};

export const saveMetaSettings = async (body: any) => {
    const row: any = await PlatformSetting.findOne({ where: { key: "meta" } });
    const prev = (parseJsonValue(row?.get?.("value") ?? row?.value) || {}) as StoredMeta;

    const appId = String(body?.app_id ?? prev.app_id ?? "").trim();
    if (appId && !/^\d{5,20}$/.test(appId)) throw new SaasError("App ID should be the numeric ID from Meta App settings → Basic");

    const verifyToken = String(body?.verify_token ?? prev.verify_token ?? "").trim() || generatePublicKey().slice(0, 32);
    if (verifyToken.length < 8) throw new SaasError("Webhook verify token should be at least 8 characters");

    const loginConfigId = String(body?.login_config_id ?? prev.login_config_id ?? "").trim();
    const graphVersion = String(body?.graph_version ?? prev.graph_version ?? "v21.0").trim() || "v21.0";
    if (!/^v\d+(\.\d+)?$/.test(graphVersion)) throw new SaasError("Graph version should look like v21.0");

    let appSecretEnc = prev.app_secret_enc || null;
    const secretInput = String(body?.app_secret || "").trim();
    if (secretInput) {
        if (secretInput.length < 16) throw new SaasError("App secret looks too short - copy it from App settings → Basic");
        appSecretEnc = encryptJson({ s: secretInput });
    }
    if (body?.clear_app_secret === true) appSecretEnc = null;

    // Env-locked fields are not overwritten in DB (env still wins at runtime)
    const value: StoredMeta = {
        app_id: (process.env.META_APP_ID || "").trim() ? (prev.app_id || "") : appId,
        app_secret_enc: (process.env.META_APP_SECRET || "").trim() ? prev.app_secret_enc || null : appSecretEnc,
        verify_token: (process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim() ? (prev.verify_token || "") : verifyToken,
        login_config_id: (process.env.META_LOGIN_CONFIG_ID || "").trim() ? (prev.login_config_id || "") : loginConfigId,
        graph_version: graphVersion,
    };

    if (row) await row.update({ value });
    else await PlatformSetting.create({ key: "meta", value });

    invalidateMetaConfigCache();
    return presentMetaSettings();
};
