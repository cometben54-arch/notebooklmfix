export type Language = 'en' | 'cn';

type TranslationKeys = {
    // App General
    title: string;
    subtitle: string;
    description: string;
    selectKey: string;
    apiKeyActive: string;
    uploadTitle: string;
    uploadDesc: string;
    extracting: string;
    pages: string;
    start: string;
    exportPdf: string;
    exportPptx: string;
    restored: string;
    failed: string;
    enhancing: string;
    holdToView: string;
    clickToView: string;
    page: string;
    keyGuideTitle: string;
    keyGuideDesc: string;
    connectBtn: string;
    res2k: string;
    res4k: string;
    highCost: string;
    enhancingTo: string;
    selectAll: string;
    deselectAll: string;
    allDone: string;
    downloadNow: string;
    compareModalTitle: string;
    original: string;
    processed: string;
    close: string;
    stop: string;
    stopping: string;
    continue: string;
    stopped: string;
    uploadNew: string;

    // ApiKeyModal
    keyModalTitle: string;
    keyModalDesc: string;
    keyInputPlaceholder: string;
    invalidCode: string;
    networkError: string;
    verifying: string;
    save: string;
    savedSuccess: string;
    keySavedHint: string;
    getKey: string;
    googleTitle: string;
    googleDesc1: string;
    googleDesc2: string;
    passcodeTitle: string;
    passcodeDesc1: string;
    passcodeDesc2: string;
    contactMe: string;
    wechat: string;
    tip: string;

    // Footer
    footerInfo: string;
    disclaimerTitle: string;
    disclaimerText: string;
};

export const TRANSLATIONS: Record<Language, TranslationKeys> = {
    en: {
        // App
        title: "NotebookLM Fixer",
        subtitle: "AI Image Restoration & Watermark Removal",
        description: "Fix blurry text, remove AI watermarks (Gemini, NotebookLM, Doubao, Grok, etc.), and restore clarity. Supports PDF & images, export to PPTX.",
        selectKey: "Select Billing Project",
        apiKeyActive: "API Key Active",
        uploadTitle: "Upload PDF Document",
        uploadDesc: "Upload PDF or images from any AI tool. We'll restore clarity, fix blurry text, and remove AI watermarks automatically.",
        extracting: "Extracting Pages...",
        pages: "Pages",
        start: "Start Restoration",
        exportPdf: "Export PDF",
        exportPptx: "Export PPTX",
        restored: "Restored",
        failed: "Failed",
        enhancing: "Enhancing...",
        holdToView: "Hold to compare",
        clickToView: "Click to compare",
        page: "Page",
        keyGuideTitle: "API Key Required",
        keyGuideDesc: "To process high-resolution images with Nano Banana Pro, you must select a Google Cloud project associated with billing.",
        connectBtn: "Connect API Key",
        res2k: "2K",
        res4k: "4K",
        highCost: "2-pass AI enhancement, uses more tokens",
        enhancingTo: "AI Repairing",
        selectAll: "Select All",
        deselectAll: "Deselect All",
        allDone: "All pages restored successfully!",
        downloadNow: "Download your files now",
        compareModalTitle: "Image Comparison",
        original: "Original",
        processed: "Restored",
        close: "Close",
        stop: "Stop",
        stopping: "Stopping...",
        continue: "Continue",
        stopped: "Processing paused",
        uploadNew: "Upload New File",

        // ApiKeyModal
        keyModalTitle: 'Configure API',
        keyModalDesc: 'Enter Key or Passcode to start',
        keyInputPlaceholder: 'Enter sk-xxxx (Key) or Passcode...',
        invalidCode: 'Invalid Passcode',
        networkError: 'Network Error',
        verifying: 'Verifying...',
        save: 'Confirm & Save',
        savedSuccess: 'Saved! Remembered on this device.',
        keySavedHint: 'API Key saved. No need to re-enter next time.',
        getKey: 'GET API KEY',
        googleTitle: 'Google AI Studio',
        googleDesc1: 'Free API Key · Requires Credit Card',
        googleDesc2: '* Supports 2K & 4K Ultra',
        passcodeTitle: 'Buy Passcode',
        passcodeDesc1: 'No VPN · Direct Connect',
        passcodeDesc2: '* Unlocks 4K Ultra',
        contactMe: 'Contact to buy:',
        wechat: '微信',
        tip: '* Get your free API key from Google AI Studio to unlock 2K & 4K restoration.',

        // Footer
        footerInfo: "Based on open-source software. For internal use by Zhixin Education Technology.",
        disclaimerTitle: "Disclaimer & Policy",
        disclaimerText: "AI restoration involves redrawing and is not 100% perfect. Extremely small or blurry text in the original image may not be fully restored. Policy: Quota is deducted upon success; failed attempts are automatically refunded."
    },
    cn: {
        // App
        title: "NotebookLM Fixer",
        subtitle: "AI 图片修复 & 去水印工具",
        description: "修复模糊文字，自动移除 Gemini、NotebookLM、豆包、Grok 等 AI 水印。支持 PDF 与图片，可导出 PDF 与 PPTX。",
        selectKey: "选择计费项目",
        apiKeyActive: "API 密钥已激活",
        uploadTitle: "上传文档或图片",
        uploadDesc: "上传任何 AI 工具生成的 PDF 或图片，自动修复模糊文字、移除 AI 水印、还原高清画质。",
        extracting: "正在提取页面...",
        pages: "页面",
        start: "开始增强",
        exportPdf: "导出 PDF",
        exportPptx: "导出 PPTX",
        restored: "已修复",
        failed: "失败",
        enhancing: "正在增强...",
        holdToView: "长按对比原图",
        clickToView: "点击查看大图对比",
        page: "页",
        keyGuideTitle: "需配置 API 密钥",
        keyGuideDesc: "为了使用 Nano Banana Pro 处理高分辨率图像，您需要选择一个关联了计费的 Google Cloud 项目。",
        connectBtn: "连接 API 密钥",
        res2k: "2K (快速)",
        res4k: "4K (极致)",
        highCost: "双重AI增强，消耗更多 Token",
        enhancingTo: "AI 正在修复",
        selectAll: "全选",
        deselectAll: "取消全选",
        allDone: "所有页面修复完成！",
        downloadNow: "立即下载您的文件",
        compareModalTitle: "画质对比",
        original: "原图",
        processed: "修复后",
        close: "关闭",
        stop: "停止处理",
        stopping: "正在停止...",
        continue: "继续处理",
        stopped: "处理已暂停",
        uploadNew: "上传新文件",

        // ApiKeyModal
        keyModalTitle: '配置 API',
        keyModalDesc: '输入密钥或口令以开始增强',
        keyInputPlaceholder: '输入 sk-xxxx (Key) 或 口令...',
        invalidCode: '无效的口令 (Invalid Passcode)',
        networkError: '验证失败，请检查网络',
        verifying: '验证中...',
        save: '确认并保存',
        savedSuccess: '已保存！下次打开无需重新输入',
        keySavedHint: 'API 密钥已保存，下次打开无需重新输入。',
        getKey: '获取 API 密钥',
        googleTitle: 'Google AI Studio',
        googleDesc1: '免费 API 密钥 · 需绑定信用卡',
        googleDesc2: '* 支持 2K & 极致 4K',
        passcodeTitle: '购买口令 (Passcode)',
        passcodeDesc1: '免 VPN · 国内直连 · 即开即用',
        passcodeDesc2: '* 解锁极致 4K',
        contactMe: '联系购买:',
        wechat: '微信',
        tip: '* 从 Google AI Studio 获取免费 API 密钥，即可使用 2K & 4K 高清修复。',

        // Footer
        footerInfo: "基于开源软件开发，质心教育科技内部使用。",
        disclaimerTitle: "免责声明 & 计费规则",
        disclaimerText: "AI 修复并非 100% 完美，对于原图中极小或极其模糊的文字，可能存在修复失败的情况，请予以理解。规则：修复成功扣费；若修复失败，额度会自动回退。"
    }
};
