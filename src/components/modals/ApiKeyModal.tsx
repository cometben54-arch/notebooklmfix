import React, { useState, useEffect } from 'react';
import { Key, X, ExternalLink, ShieldCheck, Save, Eye, EyeOff, Zap, Copy, Check, Settings, Globe, Cpu } from 'lucide-react';
import wechatQr from '../../assets/wechat.png';
import { QuotaInfo, ApiProviderConfig, ApiProvider, GEMINI_MODELS, OPENAI_MODELS } from '../../types';
import { TRANSLATIONS } from '../../i18n/translations';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string, quota?: QuotaInfo) => void;
    onSaveApiConfig?: (config: ApiProviderConfig) => void;
    lang: 'en' | 'cn';
}

type Tab = 'apikey' | 'passcode';

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, onSaveApiConfig, lang }) => {
    const [tab, setTab] = useState<Tab>('apikey');

    // API Key tab state
    const [provider, setProvider] = useState<ApiProvider>('google-gemini');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-3-pro-image-preview');
    const [baseUrl, setBaseUrl] = useState('');
    const [customModel, setCustomModel] = useState('');
    const [showKey, setShowKey] = useState(false);

    // Passcode tab state
    const [passcode, setPasscode] = useState('');

    // Shared state
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);

    const t = TRANSLATIONS[lang];

    // Load existing config when opening
    useEffect(() => {
        if (isOpen) {
            setError('');
            setSuccess('');

            // Load saved provider config
            const savedConfig = localStorage.getItem('api_provider_config');
            if (savedConfig) {
                try {
                    const config: ApiProviderConfig = JSON.parse(savedConfig);
                    setProvider(config.provider);
                    setApiKey(config.apiKey);
                    if (config.provider === 'google-gemini') {
                        setModel(config.model);
                    } else if (config.provider === 'openai-compatible') {
                        setModel(config.model);
                        setBaseUrl(config.baseUrl || '');
                    } else {
                        setCustomModel(config.model);
                        setBaseUrl(config.baseUrl || '');
                    }
                    setTab('apikey');
                    return;
                } catch { /* ignore */ }
            }

            // Legacy: load old-style key
            const savedKey = localStorage.getItem('gemini_api_key_local');
            const savedCode = localStorage.getItem('gemini_access_code');
            if (savedKey) {
                setApiKey(savedKey);
                setTab('apikey');
            } else if (savedCode) {
                setPasscode(savedCode);
                setTab('passcode');
            }
        }
    }, [isOpen]);

    const copyWechat = () => {
        navigator.clipboard.writeText('JaffryD');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;

        setError('');
        setVerifying(true);

        try {
            const selectedModel = provider === 'custom' ? customModel : model;
            const config: ApiProviderConfig = {
                provider,
                apiKey: apiKey.trim(),
                model: selectedModel,
                baseUrl: (provider !== 'google-gemini') ? baseUrl.trim() : undefined,
            };

            // Save config
            localStorage.setItem('api_provider_config', JSON.stringify(config));
            if (provider === 'google-gemini') {
                localStorage.setItem('gemini_api_key_local', config.apiKey);
            }
            localStorage.removeItem('gemini_access_code');

            if (onSaveApiConfig) {
                onSaveApiConfig(config);
            } else {
                onSave(config.apiKey);
            }

            setSuccess(t.configSaved);
            setTimeout(() => {
                setSuccess('');
                onClose();
            }, 800);
        } catch (err) {
            setError(t.networkError);
        } finally {
            setVerifying(false);
        }
    };

    const handleSavePasscode = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = passcode.trim();
        if (!value) return;

        setError('');
        setVerifying(true);

        try {
            const res = await fetch('/api/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessCode: value })
            });

            const data = await res.json();
            if (data.valid) {
                localStorage.setItem('gemini_access_code', value);
                localStorage.removeItem('gemini_api_key_local');
                localStorage.removeItem('api_provider_config');
                onSave(value, data.quota);
                onClose();
            } else {
                setError(data.error || t.invalidCode);
            }
        } catch (err) {
            setError(t.networkError);
        } finally {
            setVerifying(false);
        }
    };

    const getProviderModels = () => {
        switch (provider) {
            case 'google-gemini':
                return GEMINI_MODELS;
            case 'openai-compatible':
                return OPENAI_MODELS;
            default:
                return [];
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                            <Settings className="w-5 h-5" />
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

                {/* Tab Switcher */}
                <div className="flex border-b border-zinc-100 dark:border-white/5 shrink-0">
                    <button
                        onClick={() => { setTab('apikey'); setError(''); setSuccess(''); }}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'apikey'
                            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/5'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <Key className="w-4 h-4" />
                        {t.tabApiKey}
                    </button>
                    <button
                        onClick={() => { setTab('passcode'); setError(''); setSuccess(''); }}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'passcode'
                            ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-500/5'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <Zap className="w-4 h-4" />
                        {t.tabPasscode}
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">

                    {/* === API KEY TAB === */}
                    {tab === 'apikey' && (
                        <form onSubmit={handleSaveApiKey} className="space-y-5">

                            {/* Provider Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                                    {t.providerLabel}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {/* Google Gemini */}
                                    <button
                                        type="button"
                                        onClick={() => { setProvider('google-gemini'); setModel('gemini-3-pro-image-preview'); }}
                                        className={`p-3 rounded-xl border text-left transition-all ${provider === 'google-gemini'
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30'
                                            : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Cpu className="w-4 h-4 text-indigo-500" />
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{t.providerGemini}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500">Nano Banana Pro</p>
                                    </button>

                                    {/* OpenAI Compatible */}
                                    <button
                                        type="button"
                                        onClick={() => { setProvider('openai-compatible'); setModel('gpt-image-1'); }}
                                        className={`p-3 rounded-xl border text-left transition-all ${provider === 'openai-compatible'
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-500/30'
                                            : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Globe className="w-4 h-4 text-emerald-500" />
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{t.providerOpenAI}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500">GPT / DALL-E</p>
                                    </button>

                                    {/* Custom */}
                                    <button
                                        type="button"
                                        onClick={() => { setProvider('custom'); setCustomModel(''); }}
                                        className={`p-3 rounded-xl border text-left transition-all ${provider === 'custom'
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 ring-1 ring-purple-500/30'
                                            : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Settings className="w-4 h-4 text-purple-500" />
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{t.providerCustom}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500">{lang === 'en' ? 'Any API' : '任意接口'}</p>
                                    </button>
                                </div>
                            </div>

                            {/* API Key Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                                    {t.apiKeyLabel}
                                </label>
                                <div className="relative">
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
                            </div>

                            {/* Endpoint URL (for OpenAI-compatible and Custom) */}
                            {provider !== 'google-gemini' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                                        {t.endpointLabel}
                                    </label>
                                    <input
                                        type="text"
                                        value={baseUrl}
                                        onChange={(e) => setBaseUrl(e.target.value)}
                                        placeholder={t.endpointPlaceholder}
                                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    />
                                </div>
                            )}

                            {/* Model Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                                    {t.modelLabel}
                                </label>
                                {provider === 'custom' ? (
                                    <input
                                        type="text"
                                        value={customModel}
                                        onChange={(e) => setCustomModel(e.target.value)}
                                        placeholder={t.modelPlaceholder}
                                        className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    />
                                ) : (
                                    <div className="space-y-1.5">
                                        {getProviderModels().map((m) => (
                                            <label
                                                key={m.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${model === m.id
                                                    ? 'border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-500/5'
                                                    : 'border-zinc-100 dark:border-white/5 hover:border-zinc-200 dark:hover:border-white/10'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="model"
                                                    value={m.id}
                                                    checked={model === m.id}
                                                    onChange={() => setModel(m.id)}
                                                    className="accent-indigo-500"
                                                />
                                                <div>
                                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{m.label}</span>
                                                    <span className="ml-2 text-[10px] font-mono text-zinc-400">{m.id}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Get Key Link */}
                            {provider === 'google-gemini' && (
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-xs text-indigo-500 hover:text-indigo-600 transition-colors"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    {lang === 'en' ? 'Get API Key from Google AI Studio' : '从 Google AI Studio 获取 API Key'}
                                </a>
                            )}

                            {/* Error / Success Messages */}
                            {error && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {error}</p>}
                            {success && <p className="text-xs text-emerald-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> {success}</p>}

                            {/* Save Button */}
                            <button
                                type="submit"
                                disabled={!apiKey.trim() || verifying || (provider === 'custom' && !customModel.trim())}
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
                    )}

                    {/* === PASSCODE TAB === */}
                    {tab === 'passcode' && (
                        <div className="space-y-5">
                            <form onSubmit={handleSavePasscode} className="space-y-4">
                                <div className="space-y-2">
                                    <div className="relative">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={passcode}
                                            onChange={(e) => setPasscode(e.target.value)}
                                            placeholder={lang === 'en' ? 'Enter Passcode...' : '输入口令...'}
                                            className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                        >
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {error && <p className="text-xs text-red-500 font-medium flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {error}</p>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={!passcode.trim() || verifying}
                                    className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl hover:shadow-lg hover:translate-y-[-1px] active:translate-y-[0px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

                            {/* Passcode Info Card */}
                            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500 fill-current" />
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{t.passcodeTitle}</span>
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                    {t.passcodeDesc1}<br />
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t.passcodeDesc2}</span>
                                </p>

                                {/* Contact Section */}
                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-amber-100 dark:border-white/5">
                                    <span className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0">{t.contactMe}</span>
                                    <div className="flex gap-2">
                                        <div
                                            className="relative"
                                            onMouseEnter={() => setShowQr(true)}
                                            onMouseLeave={() => setShowQr(false)}
                                        >
                                            <button type="button" className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded text-[10px] border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 hover:shadow-sm transition-all whitespace-nowrap">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                                                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047.245.245 0 0 0 .241-.245c0-.06-.024-.12-.04-.177l-.327-1.233a.49.49 0 0 1 .177-.554C23.013 18.138 24 16.39 24 14.466c0-3.372-2.93-5.608-7.062-5.608zm-2.32 2.935c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.983.97-.983zm4.638 0c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.983.97-.983z" />
                                                </svg>
                                                <span>{t.wechat}</span>
                                            </button>

                                            {/* QR Popover */}
                                            <div className={`absolute bottom-full right-0 mb-1 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-100 dark:border-white/10 overflow-visible transform transition-all duration-200 ease-out z-[100] origin-bottom-right ${showQr ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}>
                                                <div className="absolute -bottom-2 left-0 w-full h-3"></div>
                                                <div className="p-4 flex items-center justify-center bg-white rounded-t-xl">
                                                    <img src={wechatQr} alt="WeChat QR" className="w-32 h-32 object-contain" />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); copyWechat(); }}
                                                    className="w-full bg-zinc-50 dark:bg-black/30 border-t border-zinc-100 dark:border-white/5 p-2.5 flex items-center justify-between group/copy hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors rounded-b-xl"
                                                >
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[9px] text-zinc-400 uppercase tracking-wider">微信号</span>
                                                        <span className={`text-xs font-bold font-mono transition-colors ${copied ? 'text-emerald-500' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                                            {copied ? '✓ 已复制' : 'JaffryD'}
                                                        </span>
                                                    </div>
                                                    <div className={`p-1.5 rounded-md shadow-sm border transition-all ${copied ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600 text-zinc-400 group-hover/copy:text-emerald-500'}`}>
                                                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        <a
                                            href="https://x.com/JaffryGao"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2 py-1 bg-zinc-50 dark:bg-black/20 rounded text-[10px] border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1 hover:text-black dark:hover:text-white transition-all whitespace-nowrap"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="text-[10px] text-center text-zinc-400">
                        {t.tip}
                    </p>

                </div>
            </div>
        </div>
    );
};
