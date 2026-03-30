import React, { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle, Languages, Sun, Moon, Zap, Archive } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { QuotaInfo } from '../../types';
import { useArchive } from '../../hooks/useArchive';
import { OnboardingTooltip } from '../ui/OnboardingTooltip';

interface HeaderProps {
    t: any;
    lang: 'en' | 'cn';
    theme: 'dark' | 'light';
    keyAuthorized: boolean;
    quota: QuotaInfo | null;
    toggleTheme: (event: React.MouseEvent) => void;
    toggleLanguage: () => void;
    handleSelectKey: () => void;
    openKeyModal: () => void;
    onReset: () => void;
    onOpenArchive: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    t,
    lang,
    theme,
    keyAuthorized,
    quota,
    toggleTheme,
    toggleLanguage,
    handleSelectKey,
    openKeyModal,
    onReset,
    onOpenArchive
}) => {
    const { totalCount } = useArchive();
    const [isShaking, setIsShaking] = useState(false);

    useEffect(() => {
        const handleSave = () => {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
        };
        window.addEventListener('archive-saved', handleSave);
        return () => window.removeEventListener('archive-saved', handleSave);
    }, []);

    return (
        <header className="sticky top-0 z-50 border-b border-zinc-200/50 dark:border-white/5 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo - Clickable to reset/home */}
                <button
                    onClick={onReset}
                    className="flex items-center space-x-4 hover:opacity-80 transition-opacity"
                >
                    {/* Logo Area */}
                    <div className="flex items-center gap-3">
                        <Logo size="md" />
                        <div className="flex flex-col items-start text-left">
                            <h1 className="text-lg md:text-xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                                {t.title}
                            </h1>
                            <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 font-medium tracking-wide">
                                {t.subtitle}
                            </p>
                        </div>
                    </div>
                </button>

                <div className="flex items-center gap-3">

                    {/* Key Status (First) */}
                    {!keyAuthorized ? (
                        <button
                            onClick={handleSelectKey}
                            className="hidden md:flex text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full hover:bg-amber-500/20 transition items-center gap-2 animate-pulse"
                        >
                            <AlertCircle className="w-3.5 h-3.5" />
                            {t.selectKey}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            {/* Quota Badge (Only show if quota exists) */}
                            {
                                quota && (
                                    <button
                                        onClick={openKeyModal}
                                        className="hidden md:flex text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-full items-center gap-1.5 hover:bg-indigo-500/20 transition-colors"
                                        title="点击充值 / Click to top up"
                                    >
                                        <Zap className="w-3 h-3 fill-current" />
                                        <span>剩余 {quota.remaining} 次</span>
                                    </button>
                                )
                            }

                            <button
                                onClick={openKeyModal}
                                className="hidden md:flex text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full items-center gap-2 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                title="点击配置 / Click to configure"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                {t.apiKeyActive}
                            </button>
                        </div>
                    )}

                    {/* Archive Box & Tooltip Container (Second) */}
                    <div className="relative w-9 h-9 flex items-center justify-center">
                        <button
                            onClick={onOpenArchive}
                            className={`relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-colors group ${isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
                            title={lang === 'en' ? 'Archive Box' : '本地档案盒'}
                            style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
                        >
                            <style>{`
                                @keyframes shake {
                                    0%, 100% { transform: rotate(0deg); }
                                    20% { transform: rotate(-10deg); }
                                    40% { transform: rotate(10deg); }
                                    60% { transform: rotate(-5deg); }
                                    80% { transform: rotate(5deg); }
                                }
                            `}</style>
                            <Archive className={`w-5 h-5 group-hover:text-indigo-500 transition-colors ${isShaking ? 'text-indigo-500' : ''}`} />

                            {(totalCount !== undefined && totalCount > 0) && (
                                <span key={totalCount} className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-950 ${isShaking ? 'scale-125' : 'scale-100'} transition-transform duration-200`}>
                                    {totalCount}
                                </span>
                            )}
                        </button>

                        {/* Tooltip inside flex relative container - perfect center */}
                        <OnboardingTooltip lang={lang} />
                    </div>

                    <div className="h-6 w-px bg-zinc-200 dark:bg-white/10 mx-2"></div>

                    {/* Toggles */}
                    <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200 dark:hover:border-white/10">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Languages className="w-4 h-4" />
                            <span className="font-mono-custom">{lang === 'en' ? 'CN' : 'EN'}</span>
                        </div>
                    </button>

                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200 dark:hover:border-white/10">
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </header>
    );
};
