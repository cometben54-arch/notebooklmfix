import { GoogleGenAI } from "@google/genai";

import { SYSTEM_PROMPT, USER_PROMPT } from '../constants/prompts';
import { QuotaInfo, ApiProviderConfig } from '../types';

// Helper to calculate closest aspect ratio supported by Gemini 3 Pro Image
// Supported: "1:1", "3:4", "4:3", "9:16", "16:9"
const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const supported = [
    { label: "1:1", value: 1.0 },
    { label: "3:4", value: 0.75 },
    { label: "4:3", value: 1.33 },
    { label: "9:16", value: 0.5625 },
    { label: "16:9", value: 1.77 },
  ];

  const closest = supported.reduce((prev, curr) => {
    return Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev;
  });

  return closest.label;
};

// --- Load API Config from localStorage ---
const getApiConfig = (): ApiProviderConfig | null => {
  const saved = localStorage.getItem('api_provider_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  // Backward compatibility: check for old-style key
  const oldKey = localStorage.getItem('gemini_api_key_local');
  if (oldKey) {
    return {
      provider: 'google-gemini',
      apiKey: oldKey,
      model: 'gemini-3-pro-image-preview',
    };
  }
  return null;
};

export const checkApiKeySelection = async (): Promise<boolean> => {
  if (typeof window.aistudio !== 'undefined' && window.aistudio.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  // Check for new config format
  if (localStorage.getItem('api_provider_config')) return true;
  // Check legacy key
  if (localStorage.getItem('gemini_api_key_local')) return true;
  // Check Access Code (Passcode Mode)
  if (localStorage.getItem('gemini_access_code')) return true;
  return false;
};

export const promptForKeySelection = async (): Promise<void> => {
  if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    console.error("AI Studio key selection interface not available.");
  }
};

// --- Compress image for proxy mode ---
const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 1280;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
        else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7).replace(/^data:image\/jpeg;base64,/, ""));
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/png;base64,${base64}`;
  });
};

// --- Google Gemini direct call ---
const callGemini = async (
  config: ApiProviderConfig,
  cleanBase64: string,
  aspectRatio: string,
  imageSize: '2K' | '4K'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  const response = await ai.models.generateContent({
    model: config.model || 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: USER_PROMPT },
        { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
      ],
    },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: imageSize,
      }
    },
  });

  if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("No image generated in Gemini response");
};

// --- OpenAI-compatible API call ---
const callOpenAICompatible = async (
  config: ApiProviderConfig,
  cleanBase64: string,
  imageSize: '2K' | '4K'
): Promise<string> => {
  const baseUrl = (config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '');
  const model = config.model || 'gpt-image-1';

  // Use Images API for image generation models
  const isImageModel = model.includes('dall-e') || model.includes('gpt-image');

  if (isImageModel) {
    // OpenAI Images Edit API
    const size = imageSize === '4K' ? '1536x1024' : '1024x1024';
    const response = await fetch(`${baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        image: `data:image/png;base64,${cleanBase64}`,
        prompt: `${SYSTEM_PROMPT}\n${USER_PROMPT}`,
        n: 1,
        size: size,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    if (data.data && data.data[0]) {
      if (data.data[0].b64_json) {
        return `data:image/png;base64,${data.data[0].b64_json}`;
      }
      if (data.data[0].url) {
        // Fetch the image from URL
        const imgRes = await fetch(data.data[0].url);
        const blob = await imgRes.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error("No image in OpenAI response");
  } else {
    // Chat Completions API with vision (for models like gpt-4o)
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${cleanBase64}` } },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    // Try to extract image from response
    const content = data.choices?.[0]?.message?.content;
    if (content && content.startsWith('data:image')) {
      return content;
    }
    throw new Error("No image generated. This model may not support image generation.");
  }
};

// --- Main Processing Function ---
export const processImageWithGemini = async (
  base64Image: string,
  width: number,
  height: number,
  imageSize: '2K' | '4K' = '2K'
): Promise<{ image: string; quota?: QuotaInfo }> => {
  // Check for Access Code first (Proxy Mode)
  const accessCode = localStorage.getItem('gemini_access_code');

  // Clean base64 string if it has prefix
  let cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  if (accessCode) {
    // --- PROXY MODE (Passcode) ---
    try {
      console.log("Proxy Mode: Compressing image...");
      cleanBase64 = await compressImage(cleanBase64);
      console.log(`Payload: ${(cleanBase64.length * 0.75 / (1024 * 1024)).toFixed(2)}MB`);
    } catch (e) {
      console.warn("Compression failed, using original", e);
    }

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: cleanBase64,
          prompt: USER_PROMPT,
          accessCode: accessCode,
          imageSize: imageSize,
          aspectRatio: getClosestAspectRatio(width, height)
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Proxy Error: ${response.status}`);
      }

      const data = await response.json();
      let imageStr = '';
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageStr = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
          if (part.imageUrl) {
            try {
              const r2Res = await fetch(part.imageUrl);
              const blob = await r2Res.blob();
              const reader = new FileReader();
              imageStr = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              break;
            } catch (fetchErr) {
              throw new Error("Failed to download large image");
            }
          }
        }
      }

      if (!imageStr) throw new Error("No image in proxy response");
      return { image: imageStr, quota: data.quota };
    } catch (e) {
      console.error("Proxy Request Failed", e);
      throw e;
    }
  }

  // --- DIRECT MODE (User's API Key) ---
  const apiConfig = getApiConfig();
  if (!apiConfig) {
    throw new Error("No API Key found. Please configure your key in settings.");
  }

  const aspectRatio = getClosestAspectRatio(width, height);

  try {
    let imageResult: string;

    switch (apiConfig.provider) {
      case 'google-gemini':
        imageResult = await callGemini(apiConfig, cleanBase64, aspectRatio, imageSize);
        break;
      case 'openai-compatible':
        imageResult = await callOpenAICompatible(apiConfig, cleanBase64, imageSize);
        break;
      case 'custom':
        // Custom provider uses same format as OpenAI-compatible
        imageResult = await callOpenAICompatible(apiConfig, cleanBase64, imageSize);
        break;
      default:
        throw new Error(`Unknown provider: ${apiConfig.provider}`);
    }

    return { image: imageResult };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const validateAccessCode = async (accessCode: string): Promise<{ valid: boolean; quota?: QuotaInfo; error?: string }> => {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessCode: accessCode,
        validateOnly: true
      })
    });

    if (!response.ok) {
      const data = await response.json();
      return { valid: false, error: data.error };
    }

    const data = await response.json();
    return { valid: true, quota: data.quota };
  } catch (error) {
    console.error("Validation Failed", error);
    return { valid: false, error: "Network Error" };
  }
};
