import { GoogleGenAI } from "@google/genai";

import { SYSTEM_PROMPT, USER_PROMPT } from '../constants/prompts';

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

// Client-side upscale: scale a base64 image to 4K dimensions using high-quality canvas interpolation
const upscaleTo4K = (base64Image: string, originalWidth: number, originalHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate 4K target dimensions (max dimension ~3840px), maintaining aspect ratio
      const MAX_4K = 3840;
      let targetW = originalWidth;
      let targetH = originalHeight;
      const scale = Math.min(MAX_4K / targetW, MAX_4K / targetH);
      if (scale > 1) {
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }

      // Two-pass upscaling for better quality
      // Pass 1: scale to 2x of source image
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

      // Pass 2: scale to final 4K target
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

  // Helper: call Gemini API with given imageSize
  const callGemini = async (size: '2K' | '4K') => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: USER_PROMPT },
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
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

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated in response");
  };

  try {
    if (imageSize === '4K') {
      // Strategy: try native 4K first, fallback to 2K + client-side upscale
      try {
        console.log("[4K] Attempting native 4K generation...");
        const image = await callGemini('4K');
        return { image };
      } catch (err4k) {
        console.warn("[4K] Native 4K failed, falling back to 2K + upscale:", err4k);
        const image2k = await callGemini('2K');
        console.log("[4K] 2K generated, upscaling to 4K...");
        const image4k = await upscaleTo4K(image2k, width, height);
        return { image: image4k };
      }
    } else {
      const image = await callGemini('2K');
      return { image };
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