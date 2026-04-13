import { useState, useRef, useCallback } from 'react';
import { ProcessedPage, QuotaInfo } from '../types';
import { processImageWithGemini, TileProgressCallback } from '../services/geminiService';
import { AuthMode } from './useAuth';
import { saveToArchive } from '../db/archive';
import { LogEntry } from '../components/ui/LogPanel';

interface UseImageProcessingProps {
    pages: ProcessedPage[];
    setPages: React.Dispatch<React.SetStateAction<ProcessedPage[]>>;
    quota: QuotaInfo | null;
    setQuota: React.Dispatch<React.SetStateAction<QuotaInfo | null>>;
    authMode: AuthMode;
    keyAuthorized: boolean;
    verifyKey: () => Promise<boolean>;
    handleSelectKey: () => Promise<void>;
}

// Helper: Convert Base64 Data URL to Blob
const dataURLtoBlob = async (dataurl: string): Promise<Blob> => {
    const res = await fetch(dataurl);
    return await res.blob();
};

let logIdCounter = 0;

export function useImageProcessing({
    pages,
    setPages,
    setQuota,
    keyAuthorized,
    verifyKey,
    handleSelectKey,
    authMode
}: UseImageProcessingProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);
    const [resolution, setResolution] = useState<'2K' | '4K'>('2K');
    const [resolutionLocked, setResolutionLocked] = useState(false);
    const [showCompletionBanner, setShowCompletionBanner] = useState(false);
    const [showStoppingToast, setShowStoppingToast] = useState(false);

    // Error Toast State
    const [showErrorToast, setShowErrorToast] = useState(false);
    const [errorToastMessage, setErrorToastMessage] = useState('');

    // Tile progress State
    const [tileProgress, setTileProgress] = useState<{ current: number; total: number } | null>(null);

    // Log State
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const addLog = useCallback((level: LogEntry['level'], message: string, detail?: string) => {
        setLogs(prev => [...prev, {
            id: ++logIdCounter,
            timestamp: new Date(),
            level,
            message,
            detail,
        }]);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    const abortRef = useRef(false);

    const triggerErrorToast = (msg: string) => {
        setErrorToastMessage(msg);
        setShowErrorToast(true);
        setTimeout(() => setShowErrorToast(false), 4000);
    };

    const startProcessing = async () => {
        // 1. Auth Check
        if (!keyAuthorized) {
            const success = await verifyKey();
            if (!success) {
                await handleSelectKey();
                return;
            }
        }

        // 2. Filter Processable Pages
        const pagesToProcess = pages.filter(p => p.selected && !p.processedUrl);
        if (pagesToProcess.length === 0) {
            if (pages.some(p => !p.selected)) {
                alert("No pages selected for processing.");
            }
            return;
        }

        addLog('info', `Starting processing: ${pagesToProcess.length} pages at ${resolution}`);

        // 3. Set Processing State
        setIsProcessing(true);
        setIsStopped(false);
        setIsStopping(false);
        setResolutionLocked(true);
        abortRef.current = false;

        // Create a working copy
        const newPages = [...pages];

        for (let i = 0; i < newPages.length; i++) {
            // Skip if already processed OR NOT SELECTED
            if (newPages[i].processedUrl || !newPages[i].selected) continue;

            // Check for Abort Signal
            if (abortRef.current) {
                setIsStopped(true);
                addLog('warn', 'Processing stopped by user');
                break;
            }

            setCurrentProcessingIndex(i);

            // Update status to processing
            newPages[i].status = 'processing';
            newPages[i].resolution = resolution;
            setPages([...newPages]); // Trigger UI update

            const pageLabel = `Page ${newPages[i].pageIndex + 1}`;
            addLog('info', `${pageLabel}: Starting ${resolution} enhancement (${newPages[i].width}x${newPages[i].height})`);
            setTileProgress(null);
            const startTime = Date.now();

            try {
                const onTileProgress: TileProgressCallback = (current, total) => {
                    setTileProgress({ current, total });
                    if (current > 0) {
                        addLog('info', `${pageLabel}: Tile ${current}/${total} processing...`);
                    }
                };

                const result = await processImageWithGemini(
                    newPages[i].originalUrl,
                    newPages[i].width,
                    newPages[i].height,
                    resolution,
                    onTileProgress
                );

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                newPages[i].processedUrl = result.image;
                newPages[i].status = 'completed';
                addLog('success', `${pageLabel}: Completed in ${elapsed}s`);

                // --- Archive Logic ---
                try {
                    const blob = await dataURLtoBlob(result.image);
                    await saveToArchive(blob, newPages[i].width, newPages[i].height, `Page ${newPages[i].pageIndex + 1}`, newPages[i].originalUrl);
                    window.dispatchEvent(new Event('archive-saved'));
                } catch (archiveErr) {
                    console.error("Failed to archive image:", archiveErr);
                }

                // Update Quota if returned (Access Code Mode)
                if (result.quota) {
                    setQuota(result.quota);
                }

            } catch (error: any) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.error(`${pageLabel} Error:`, error);
                newPages[i].status = 'error';

                const errMsg = error?.message || error?.toString() || 'Unknown error';
                const errDetail = extractErrorDetail(error);

                addLog('error', `${pageLabel}: Failed after ${elapsed}s — ${errMsg}`, errDetail);

                // Quota/billing error — abort entire batch
                if (error?.isQuotaError) {
                    addLog('error', '⛔ Quota exceeded — aborting all remaining pages. Please check your Google AI Studio billing at https://ai.studio/spend');
                    triggerErrorToast('⛔ 配额用完，已停止处理。请到 Google AI Studio 检查账单。');
                    setPages([...newPages]);
                    break;
                }

                if (!showErrorToast) {
                    triggerErrorToast(`${pageLabel} failed: ${errMsg}`);
                }
            }

            setPages([...newPages]);
        }

        // 4. Cleanup State
        setIsProcessing(false);
        setResolutionLocked(false);
        setIsStopping(false);
        setCurrentProcessingIndex(null);
        setTileProgress(null);

        // 5. Completion Check
        const selectedPages = newPages.filter(p => p.selected);
        const allSelectedDone = selectedPages.length > 0 && selectedPages.every(p => p.status === 'completed' || p.status === 'error');
        const hasSuccessfulPages = selectedPages.some(p => p.status === 'completed');

        const sc = selectedPages.filter(p => p.status === 'completed').length;
        const fc = selectedPages.filter(p => p.status === 'error').length;
        addLog('info', `Processing finished: ${sc} success, ${fc} failed`);

        if (hasSuccessfulPages && (allSelectedDone || abortRef.current)) {
            setShowCompletionBanner(true);

            if (sc > 0) {
                fetch('/api/stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: sc })
                }).catch(() => { /* Silent fail */ });
            }
        }
    };

    const stopProcessing = () => {
        abortRef.current = true;
        setIsStopping(true);
        setShowStoppingToast(true);
        setTimeout(() => setShowStoppingToast(false), 2000);
    };

    const retryPage = (index: number) => {
        setPages(prev => {
            const newPages = [...prev];
            if (newPages[index] && newPages[index].status === 'error') {
                newPages[index] = {
                    ...newPages[index],
                    status: 'pending',
                    selected: true,
                    processedUrl: undefined
                };
            }
            return newPages;
        });
        addLog('info', `Page ${index + 1}: Queued for retry`);
    };

    const successCount = pages.filter(p => p.status === 'completed').length;
    const failCount = pages.filter(p => p.status === 'error').length;

    return {
        isProcessing,
        isStopped,
        isStopping,
        currentProcessingIndex,
        resolution,
        setResolution,
        resolutionLocked,
        setResolutionLocked,
        showCompletionBanner,
        setShowCompletionBanner,
        showStoppingToast,
        showErrorToast,
        errorToastMessage,
        tileProgress,
        startProcessing,
        stopProcessing,
        retryPage,
        successCount,
        failCount,
        logs,
        clearLogs
    };
}

// Extract structured error detail for display
function extractErrorDetail(error: any): string | undefined {
    const parts: string[] = [];

    if (error?.status) parts.push(`HTTP ${error.status}`);
    if (error?.code) parts.push(`Code: ${error.code}`);

    // Google GenAI SDK errors
    if (error?.errorDetails) {
        for (const d of error.errorDetails) {
            if (d.reason) parts.push(`Reason: ${d.reason}`);
            if (d.message) parts.push(d.message);
        }
    }

    // Nested cause
    if (error?.cause?.message) parts.push(`Cause: ${error.cause.message}`);

    // Stack trace (first 3 lines)
    if (error?.stack) {
        const stackLines = error.stack.split('\n').slice(1, 4).map((l: string) => l.trim());
        if (stackLines.length) parts.push(stackLines.join('\n'));
    }

    return parts.length > 0 ? parts.join('\n') : undefined;
}
