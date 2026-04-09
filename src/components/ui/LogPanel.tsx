import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Copy, Check } from 'lucide-react';

export interface LogEntry {
    id: number;
    timestamp: Date;
    level: 'info' | 'success' | 'warn' | 'error';
    message: string;
    detail?: string;
}

interface LogPanelProps {
    logs: LogEntry[];
    isOpen: boolean;
    onToggle: () => void;
    onClear: () => void;
    lang: 'en' | 'cn';
}

const LevelIcon: React.FC<{ level: LogEntry['level'] }> = ({ level }) => {
    switch (level) {
        case 'success': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
        case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
        case 'error': return <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
        default: return <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
};

const levelColor: Record<LogEntry['level'], string> = {
    info: 'text-zinc-500 dark:text-zinc-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
};

export const LogPanel: React.FC<LogPanelProps> = ({ logs, isOpen, onToggle, onClear, lang }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const errorCount = logs.filter(l => l.level === 'error').length;
    const warnCount = logs.filter(l => l.level === 'warn').length;

    const copyLogs = () => {
        const text = logs.map(l => {
            const time = l.timestamp.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const prefix = l.level.toUpperCase().padEnd(7);
            return `[${time}] ${prefix} ${l.message}${l.detail ? '\n' + l.detail : ''}`;
        }).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Auto-scroll to bottom when new log arrives
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs.length, isOpen]);

    const formatTime = (d: Date) => {
        return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
            <div className="max-w-5xl mx-auto px-4 pointer-events-auto">
                {/* Toggle Bar */}
                <button
                    onClick={onToggle}
                    className={`w-full flex items-center justify-between px-4 py-2 text-xs font-mono-custom transition-all ${isOpen
                        ? 'bg-zinc-900 dark:bg-zinc-800 text-zinc-300 rounded-t-xl border-t border-x border-zinc-700'
                        : 'bg-zinc-900/90 dark:bg-zinc-800/90 text-zinc-400 rounded-t-xl border-t border-x border-zinc-700/50 backdrop-blur-sm hover:bg-zinc-800'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-zinc-500">{lang === 'en' ? 'Processing Log' : '处理日志'}</span>
                        {errorCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">
                                {errorCount} {lang === 'en' ? 'error' : '错误'}
                            </span>
                        )}
                        {warnCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">
                                {warnCount} {lang === 'en' ? 'warn' : '警告'}
                            </span>
                        )}
                        <span className="text-zinc-600">{logs.length} {lang === 'en' ? 'entries' : '条'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isOpen && logs.length > 0 && (
                            <>
                                <span
                                    onClick={(e) => { e.stopPropagation(); copyLogs(); }}
                                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center gap-1"
                                >
                                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {copied ? (lang === 'en' ? 'Copied' : '已复制') : (lang === 'en' ? 'Copy' : '复制')}
                                </span>
                                <span className="text-zinc-700">|</span>
                                <span
                                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                >
                                    {lang === 'en' ? 'Clear' : '清除'}
                                </span>
                            </>
                        )}
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                </button>

                {/* Log Content */}
                {isOpen && (
                    <div
                        ref={scrollRef}
                        className="bg-zinc-950 dark:bg-zinc-900 border-x border-b border-zinc-700 max-h-52 overflow-y-auto font-mono text-xs"
                    >
                        {logs.length === 0 ? (
                            <div className="py-6 text-center text-zinc-600">
                                {lang === 'en' ? 'No logs yet. Start processing to see activity.' : '暂无日志。开始处理后将显示活动记录。'}
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`flex items-start gap-2 px-4 py-1.5 border-b border-zinc-800/50 hover:bg-white/[0.02] ${log.level === 'error' ? 'bg-red-500/5' : ''}`}
                                >
                                    <span className="text-zinc-600 shrink-0 tabular-nums">{formatTime(log.timestamp)}</span>
                                    <LevelIcon level={log.level} />
                                    <div className="flex-1 min-w-0">
                                        <span className={levelColor[log.level]}>{log.message}</span>
                                        {log.detail && (
                                            <div className="text-[11px] text-zinc-600 mt-0.5 break-all whitespace-pre-wrap">
                                                {log.detail}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
