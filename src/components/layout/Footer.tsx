import React from 'react';

interface FooterProps {
    t: any;
    onOpenLegal?: (tab: 'privacy' | 'terms') => void;
}

export const Footer: React.FC<FooterProps> = ({ t }) => {
    return (
        <footer className="w-full py-8 mt-auto border-t border-zinc-200/50 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-6">
                <div className="flex justify-center items-center text-[11px] text-zinc-400 dark:text-zinc-500 font-mono-custom text-center">
                    <span>{t.footerInfo}</span>
                </div>
            </div>
        </footer>
    );
};
