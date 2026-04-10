import React from 'react';
import {
    Check,
    CheckCircle,
    AlertCircle,
    Maximize2,
    Download
} from 'lucide-react';
import { ProcessedPage } from '../../types';

interface ImageCardProps {
    page: ProcessedPage;
    index: number;
    currentProcessingIndex: number | null;
    resolution: string;
    t: any;
    lang: 'en' | 'cn';
    isProcessing: boolean;
    toggleSelection: (index: number) => void;
    setViewingIndex: (index: number) => void;
    handleDownloadSingleImage: (page: ProcessedPage) => void;
    tileProgress?: { current: number; total: number } | null;
    onRetry?: (index: number) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
    page,
    index,
    currentProcessingIndex,
    resolution,
    t,
    lang,
    isProcessing,
    toggleSelection,
    setViewingIndex,
    handleDownloadSingleImage,
    tileProgress,
    onRetry
}) => {
    // No animation logic needed here anymore

    return (
        <div
            onClick={() => !page.processedUrl && toggleSelection(index)}
            className={`relative group bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/20 ${currentProcessingIndex === index
                ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50 scale-[1.02] z-10 opacity-100'
                : page.status === 'completed'
                    ? 'border-emerald-500/30 dark:border-emerald-500/20 opacity-100'
                    : !page.selected
                        ? 'border-zinc-200 dark:border-white/5 opacity-50 grayscale cursor-pointer'
                        : 'border-zinc-200 dark:border-white/5 opacity-100 cursor-pointer'
                }`}
        >
            {/* Selection Checkbox (Top Left) */}
            {!page.processedUrl && (
                <div className="absolute top-4 left-4 z-40">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${page.selected
                        ? 'bg-indigo-500 border-indigo-500 md:group-hover:scale-110'
                        : 'bg-transparent border-zinc-300 dark:border-zinc-600 hover:border-zinc-400'
                        }`}>
                        {page.selected && <Check className="w-4 h-4 text-white" />}
                    </div>
                </div>
            )}

            {/* Status Badges (Top Right) */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
                {page.status === 'completed' && (
                    <>
                        <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 backdrop-blur-md shadow-lg animate-in fade-in zoom-in">
                            <CheckCircle className="w-3.5 h-3.5" /> {t.restored}
                        </span>
                        {/* Resolution Badge */}
                        {page.resolution && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md shadow-lg border animate-in fade-in zoom-in delay-100 ${page.resolution === '4K'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30'
                                }`}>
                                {page.resolution}
                            </span>
                        )}
                    </>
                )}
                {page.status === 'error' && (
                    <div className="relative group/error">
                        <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium px-2.5 py-1 rounded-full border border-red-500/20 flex items-center gap-1.5 backdrop-blur-md shadow-lg cursor-help transition-colors hover:bg-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5" /> {t.failed}
                        </span>

                        {/* Premium Tooltip - Bug #2 Fixed: group-hover/error */}
                        <div className="absolute top-full right-0 mt-2 w-max max-w-[220px] p-3 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl origin-top-right transition-all duration-300 opacity-0 scale-95 translate-y-2 invisible group-hover/error:opacity-100 group-hover/error:scale-100 group-hover/error:translate-y-0 group-hover/error:visible z-50">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">✓ Quota Safe</span>
                                <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                                    {lang === 'en' ? 'No quota deducted for failures.' : '生成失败不扣除次数。'}
                                </p>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                                    {lang === 'en' ? 'Wait for batch to finish, then retry.' : '请等待当前批次结束后重试。'}
                                </p>
                                {/* Retry Button - Improvement #2 */}
                                {onRetry && !isProcessing && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRetry(index); }}
                                        className="mt-1 w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                        {lang === 'en' ? 'Retry' : '重试'}
                                    </button>
                                )}
                            </div>
                            {/* Arrow */}
                            <div className="absolute -top-1 right-3 w-2 h-2 bg-zinc-900/95 dark:bg-zinc-800/95 border-t border-l border-white/10 rotate-45"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Processing Overlay */}
            {page.status === 'processing' && (
                <div className="absolute inset-0 z-30 overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-[1px]"></div>
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>

                    {/* Tile progress bar */}
                    {tileProgress && tileProgress.total > 1 && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-black/20">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-700 ease-out"
                                style={{ width: `${(tileProgress.current / tileProgress.total) * 100}%` }}
                            />
                        </div>
                    )}

                    <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center gap-1.5">
                        {/* Tile progress info */}
                        {tileProgress && tileProgress.total > 1 && (
                            <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 shadow-lg text-center">
                                <span className="text-white/80 text-[10px] font-mono-custom block">
                                    {lang === 'en' ? 'Large image — processing in tiles' : '图片较大，正在分块处理'}
                                </span>
                                <span className="text-indigo-300 text-xs font-bold font-mono-custom">
                                    {tileProgress.current} / {tileProgress.total}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                            <span className="text-white/90 text-[10px] font-medium tracking-widest uppercase font-mono-custom">
                                {t.enhancing}
                            </span>
                            <span className="text-white/50 text-[10px] font-mono-custom pl-1 border-l border-white/10">
                                {page.resolution || resolution}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Clickable Area for Comparison */}
            <div
                onClick={() => page.status === 'completed' && setViewingIndex(index)}
                className={`aspect-[3/4] relative w-full bg-zinc-100 dark:bg-zinc-950 p-2 ${page.status === 'completed' ? 'cursor-zoom-in' : ''}`}
            >
                {page.processedUrl ? (
                    <div className="w-full h-full relative">
                        <img
                            src={page.processedUrl}
                            alt="Enhanced"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain rounded-lg shadow-inner bg-white dark:bg-zinc-900"
                        />
                        {/* Hover Prompt & Download */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg pointer-events-none">
                            <div className="px-4 py-2 bg-black/80 backdrop-blur-md rounded-full text-xs text-white border border-white/10 shadow-xl flex items-center gap-2 mb-2">
                                <Maximize2 className="w-3 h-3" />
                                {t.clickToView}
                            </div>

                            {/* Single Download Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadSingleImage(page);
                                }}
                                className="pointer-events-auto p-2 bg-white text-zinc-900 rounded-full shadow-xl hover:scale-110 transition-transform"
                                title="Download Image"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <img
                        src={page.originalUrl}
                        alt="Original"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain rounded-lg opacity-60 grayscale-[20%] mix-blend-multiply dark:mix-blend-normal"
                    />
                )}
            </div>

            {/* Page Number */}
            <div className="absolute bottom-2 left-2 text-[10px] font-mono-custom text-zinc-400 px-2 py-1 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded">
                {t.page} {page.pageIndex + 1}
            </div>
        </div>
    );
};
