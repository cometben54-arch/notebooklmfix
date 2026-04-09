import { GoogleGenAI } from "@google/genai";

import { SYSTEM_PROMPT, USER_PROMPT, ENHANCE_4K_PROMPT } from '../constants/prompts';

// Helper to calculate closest aspect ratio supported by Gemini image generation
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

// Compress an image to fit within maxDim while maintaining aspect ratio
const compressForApi = (base64: string, maxDim: number = 1536): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      // Only resize if exceeding maxDim
      if (w <= maxDim && h <= maxDim) {
        resolve(base64);
        return;
      }

      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, "");
        const sizeMB = (compressed.length * 0.75 / 1024 / 1024).toFixed(2);
        console.log(`[Compress] ${img.width}x${img.height} -> ${w}x${h} (${sizeMB}MB)`);
        resolve(compressed);
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
};

// Client-side upscale: scale a base64 image to 4K dimensions
const upscaleTo4K = (base64Image: string, originalWidth: number, originalHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX_4K = 3840;
      let targetW = originalWidth;
      let targetH = originalHeight;
      const scale = Math.min(MAX_4K / targetW, MAX_4K / targetH);
      if (scale > 1) {
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }

      // Two-pass upscaling for better quality
      const midCanvas = document.createElement('canvas');
      const midW = img.width * 2;
      const midH = img.height * 2;
      midCanvas.width = midW;
      midCanvas.height = midH;
      const midCtx = midCanvas.getContext('2d');
      if (midCtx) {
        midCtx.imageSmoothingEnabled = true;
        midCtx.imageSmoothingQuality = 'high';
        midCtx.drawImage(img, 0, 0, midW, midH);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(midCanvas, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Canvas context failed'));
      }
    };
    img.onerror = () => reject(new Error('Image load failed during upscale'));
    img.src = base64Image;
  });
};

export const checkApiKeySelection = async (): Promise<boolean> => {
  if (typeof window.aistudio !== 'undefined' && window.aistudio.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  // Check Local Storage for API Key
  if (localStorage.getItem('gemini_api_key_local')) return true;

  // Check Local Storage for Access Code (Commercial Mode)
  if (localStorage.getItem('gemini_access_code')) return true;

  // Security: Do NOT check process.env.GEMINI_API_KEY on client side
  return false;
};

export const promptForKeySelection = async (): Promise<void> => {
  if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    console.error("AI Studio key selection interface not available.");
  }
};

import { QuotaInfo } from '../types';

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
    // PROXY MODE - MANDATORY COMPRESSION FOR VERCEL (Hard Limit 4.5MB)
    // We strictly resize ALL images to max 1280px to ensure payload is tiny (<1MB).
    // This is necessary because Vercel Free Tier rejects anything > 4.5MB immediately.
    // NOTE: This does NOT affect the output quality, only the reference image sent to AI.
    try {
      console.log("Proxy Mode: Force compressing image to safe limit (Max 1280px)...");

      const compressImage = (base64: string): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');

            // Force Resize to Max 1280px (Safe & Fast)
            const MAX_DIM = 1280;
            let width = img.width;
            let height = img.height;

            // Resize logic: Maintain aspect ratio
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              // 1. Fill White Background (Critical for transparent PNGs -> JPEG)
              // Without this, transparent areas turn black in JPEG
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);

              // 2. High quality downscaling
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, width, height);
              // JPEG 0.7 is perfect for AI reference (small size, good details)
              resolve(canvas.toDataURL('image/jpeg', 0.7).replace(/^data:image\/jpeg;base64,/, ""));
            } else {
              // Canvas context failed? Return original (Should not happen)
              resolve(base64);
            }
          };
          img.onerror = (e) => {
            console.warn("Image load failed during compression, using original", e);
            resolve(base64);
          };
          img.src = `data:image/png;base64,${base64}`;
        });
      };

      cleanBase64 = await compressImage(cleanBase64);
      const newSize = (cleanBase64.length * 0.75) / (1024 * 1024);
      console.log(`Payload ready: ${newSize.toFixed(2)}MB`);

    } catch (e) {
      console.warn("Compression routine failed, sending original", e);
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
      // Extract image from response validation (Hybrid: R2 URL or Base64)
      let imageStr = '';
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        for (const part of data.candidates[0].content.parts) {
          // Case 1: Standard Base64 (Small Images)
          if (part.inlineData && part.inlineData.data) {
            imageStr = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
          // Case 2: R2 Signed URL (Large Images)
          if (part.imageUrl) {
            try {
              console.log("Fetching large image from R2...", part.imageUrl);
              const r2Res = await fetch(part.imageUrl);
              const blob = await r2Res.blob();
              const reader = new FileReader();
              imageStr = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              break;
            } catch (fetchErr) {
              console.error("Failed to fetch image from R2", fetchErr);
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

  // --- STANDARD MODE (Direct API Key) ---
  const localKey = localStorage.getItem('gemini_api_key_local');

  if (!localKey) {
    throw new Error("No API Key found. Please configure your key in settings.");
  }

  const ai = new GoogleGenAI({ apiKey: localKey });
  const aspectRatio = getClosestAspectRatio(width, height);
  const inputSizeMB = (cleanBase64.length * 0.75) / (1024 * 1024);
  console.log(`[Input] ${width}x${height}, ${inputSizeMB.toFixed(2)}MB`);

  // Core API call — matches the config that was proven to work for 2K
  const callGemini = async (prompt: string, imageBase64: string, size: '2K' | '4K', maxRetries: number = 2): Promise<string> => {
    let lastTextResponse = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Gemini] Attempt ${attempt}/${maxRetries} (${size})...`);

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageBase64,
              },
            },
          ],
        },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: size,
          }
        },
      });

      // Diagnostic: log what the API returned
      const parts = response.candidates?.[0]?.content?.parts || [];
      const partTypes = parts.map((p: any) => {
        if (p.inlineData?.data) return `IMAGE(${(p.inlineData.data.length * 0.75 / 1024).toFixed(0)}KB)`;
        if (p.text) return `TEXT("${p.text.substring(0, 100)}")`;
        return 'unknown';
      });
      console.log(`[Gemini] Response parts: [${partTypes.join(', ')}]`);

      // Also log finishReason and safety
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason) console.log(`[Gemini] finishReason: ${candidate.finishReason}`);

      // Extract image from response
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }

      // No image — capture text for diagnostics
      lastTextResponse = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
      console.warn(`[Gemini] Attempt ${attempt}: No image. Model said: ${lastTextResponse.substring(0, 300)}`);

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const reason = lastTextResponse
      ? `Model response: "${lastTextResponse.substring(0, 200)}"`
      : 'Model returned empty response';
    throw new Error(`No image generated. ${reason}`);
  };

  try {
    if (imageSize === '4K') {
      // 4K: generate at 2K, then upscale to 4K
      console.log("[4K] Generating at 2K, will upscale...");
      const base64 = await callGemini(USER_PROMPT, cleanBase64, '2K', 2);
      console.log("[4K] Upscaling to 4K dimensions...");
      const image4k = await upscaleTo4K(`data:image/png;base64,${base64}`, width, height);
      return { image: image4k };
    } else {
      const base64 = await callGemini(USER_PROMPT, cleanBase64, '2K', 2);
      return { image: `data:image/png;base64,${base64}` };
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
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