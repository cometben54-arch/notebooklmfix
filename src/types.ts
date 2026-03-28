
export interface ProcessedPage {
  originalUrl: string;
  processedUrl: string | null;
  pageIndex: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  width: number;
  height: number;
  aspectRatio: number; // width / height
  resolution?: '2K' | '4K'; // Track which resolution was used
  selected: boolean;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  startTime: number;
}

// Augment window for AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    pdfjsLib: any;
  }
}

export interface QuotaInfo {
  total: number;
  remaining: number;
}

// --- Multi-Provider API Config ---
export type ApiProvider = 'google-gemini' | 'openai-compatible' | 'custom';

export interface ApiProviderConfig {
  provider: ApiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // Custom endpoint URL (for openai-compatible / custom)
}

export const GEMINI_MODELS = [
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (Nano Banana)' },
  { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
  { id: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro Preview' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview' },
] as const;

export const OPENAI_MODELS = [
  { id: 'gpt-image-1', label: 'GPT Image 1' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'dall-e-3', label: 'DALL-E 3' },
] as const;
