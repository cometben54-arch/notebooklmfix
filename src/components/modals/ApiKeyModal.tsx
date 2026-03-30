import React, { useState, useEffect } from 'react';
import { Key, X, ExternalLink, ShieldCheck, Save, Eye, EyeOff } from 'lucide-react';
import { QuotaInfo } from '../../types';
import { TRANSLATIONS } from '../../i18n/translations';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string, quota?: QuotaInfo) => void;
    lang: 'en' | 'cn';
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, lang }) => {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    // Dictionary
    const t = TRANSLATIONS[lang];

    // Load existing key or code when opening
    useEffect(() => {
        if (isOpen) {
            const savedKey = localStorage.getItem('gemini_api_key_local');
            const savedCode = localStorage.getItem('gemini_access_code');
            if (savedKey) setApiKey(savedKey);
            else if (savedCode) setApiKey(savedCode);
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = apiKey.trim();
        if (!value) return;

        setError('');
        setVerifying(true);

        try {
            // Smart Detection
            if (value.startsWith('AIza')) {
                // It's an API Key (Standard Mode)
                localStorage.setItem('gemini_api_key_local', value);
                localStorage.removeItem('gemini_access_code');
                onSave(value);
                onClose();
            } else {
                // It's likely an Access Code (Proxy Mode) -> Verify with Server
                const res = await fetch('/api/verify-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessCode: value })
                });

                const data = await res.json();

                if (data.valid) {
                    localStorage.setItem('gemini_access_code', value);
                    localStorage.removeItem('gemini_api_key_local');
                    onSave(value, data.quota); // Pass initial quota info back
                    onClose();
                } else {
                    setError(data.error || t.invalidCode);
                }
            }
        } catch (err) {
            setError(t.networkError);
        } finally {
            setVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-heading font-bold text-zinc-900 dark:text-white leading-none">
                                {t.keyModalTitle}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {t.keyModalDesc}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Unified Input */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative group">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={t.keyInputPlaceholder}
                                    className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                >
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {error && <p className="text-xs text-red-500 font-medium animate-in fade-in flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {error}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={!apiKey.trim() || verifying}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl hover:shadow-lg hover:translate-y-[-1px] active:translate-y-[0px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {verifying ? (
                                <span className="animate-pulse flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> {t.verifying}
                                </span>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>{t.save}</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-zinc-200 dark:border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400 font-mono-custom tracking-widest">
                                {t.getKey}
                            </span>
                        </div>
                    </div>

                    {/* Get API Key */}
                    <div className="flex justify-center">
                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="group relative w-full p-4 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all flex flex-col gap-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t.googleTitle}</span>
                                <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-indigo-500" />
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-tight">
                                {t.googleDesc1}<br />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t.googleDesc2}</span>
                            </p>
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-zinc-300 rounded-full group-hover:bg-indigo-500 transition-colors"></div>
                        </a>
                    </div>

                    <p className="text-[10px] text-center text-zinc-400">
                        {t.tip}
                    </p>

                </div>
            </div>
        </div>
    );
};
