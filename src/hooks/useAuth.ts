import { useState, useEffect, useCallback } from 'react';
import { QuotaInfo, ApiProviderConfig } from '../types';
import { checkApiKeySelection, promptForKeySelection, validateAccessCode } from '../services/geminiService';

export type AuthMode = 'key' | 'passcode';

export function useAuth() {
    // 1. Synchronous Initialization (Fixes FOUC)
    const [keyAuthorized, setKeyAuthorized] = useState(() => {
        if (typeof window === 'undefined') return false;
        return !!(
            localStorage.getItem('api_provider_config') ||
            localStorage.getItem('gemini_api_key_local') ||
            localStorage.getItem('gemini_access_code')
        );
    });

    const [authMode, setAuthMode] = useState<AuthMode>(() => {
        if (typeof window === 'undefined') return 'key';
        return localStorage.getItem('gemini_access_code') ? 'passcode' : 'key';
    });

    const [quota, setQuota] = useState<QuotaInfo | null>(() => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem('gemini_quota_cache');
        return saved ? JSON.parse(saved) : null;
    });

    // Handle keys from child components or other tabs
    const handleSaveLocalKey = useCallback((key: string, newQuota?: QuotaInfo) => {
        if (newQuota) {
            // Passcode Mode
            localStorage.setItem('gemini_access_code', key);
            localStorage.setItem('gemini_quota_cache', JSON.stringify(newQuota));
            setQuota(newQuota);
            setAuthMode('passcode');
        } else {
            // API Key Mode - clear access code if switching
            localStorage.removeItem('gemini_access_code');
            setQuota(null);
            setAuthMode('key');
        }
        setKeyAuthorized(true);
    }, []);

    // Save provider config (new multi-provider)
    const handleSaveApiConfig = useCallback((config: ApiProviderConfig) => {
        localStorage.setItem('api_provider_config', JSON.stringify(config));
        // Also save as legacy key for backward compat
        if (config.provider === 'google-gemini') {
            localStorage.setItem('gemini_api_key_local', config.apiKey);
        }
        localStorage.removeItem('gemini_access_code');
        setQuota(null);
        setAuthMode('key');
        setKeyAuthorized(true);
    }, []);

    const verifyKey = useCallback(async () => {
        const authorized = await checkApiKeySelection();
        setKeyAuthorized(authorized);
        return authorized;
    }, []);

    const handleSelectKey = useCallback(async () => {
        await promptForKeySelection();
        await verifyKey();
    }, [verifyKey]);

    // Sync from other tabs
    const handleStorageChange = useCallback((e: StorageEvent) => {
        if (e.key === 'api_provider_config' || e.key === 'gemini_api_key_local' || e.key === 'gemini_access_code') {
            verifyKey();
            if (e.key === 'gemini_access_code' && e.newValue) {
                setAuthMode('passcode');
            } else {
                setAuthMode('key');
            }
        }
        if (e.key === 'gemini_quota_cache' && e.newValue) {
            setQuota(JSON.parse(e.newValue));
        }
    }, [verifyKey]);

    // Async Quota Re-validation (Silent)
    useEffect(() => {
        const savedCode = localStorage.getItem('gemini_access_code');
        if (savedCode) {
            validateAccessCode(savedCode).then(result => {
                if (result.valid && result.quota) {
                    setQuota(result.quota);
                    setKeyAuthorized(true);
                    localStorage.setItem('gemini_quota_cache', JSON.stringify(result.quota));
                } else {
                    console.warn('[Auto-Sync] Validation failed:', result.error);
                }
            });
        } else {
            verifyKey();
        }

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return {
        keyAuthorized,
        authMode,
        quota,
        setQuota,
        handleSaveLocalKey,
        handleSaveApiConfig,
        handleSelectKey,
        verifyKey
    };
}
