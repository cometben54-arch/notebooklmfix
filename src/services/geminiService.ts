import { GoogleGenAI } from "@google/genai";

import { SYSTEM_PROMPT, USER_PROMPT, ENHANCE_4K_PROMPT } from '../constants/prompts';

// Helper to calculate closest aspect ratio
const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const supported = [
    { label: "1:1", value: 1.0 },
    { label: "3:4", value: 0.75 },
    { label: "4:3", value: 1.33 },
    { label: "9:16", value: 0.5625 },
    { label: "16:9", value: 1.77 },
  ];
  return supported.reduce((prev, curr) =>
    Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
  ).label;
};

// Load a base64 image into an HTMLImageElement
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  });
};

// Extract a tile from the source image (no padding — simple exact crop)
const extractTile = (
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
};

// Resize an API result to exact target dimensions
const resizeToExact = async (base64: string, targetW: number, targetH: number): Promise<HTMLImageElement> => {
  const img = await loadImage(`data:image/png;base64,${base64}`);
  // If already correct size, return as-is
  if (img.width === targetW && img.height === targetH) return img;
  // Resize via canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return loadImage(canvas.toDataURL('image/png'));
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

// Progress callback for tile-based processing
export type TileProgressCallback = (current: number, total: number) => void;

export const processImageWithGemini = async (
  base64Image: string,
  width: number,
  height: number,
  imageSize: '2K' | '4K' = '2K',
  onTileProgress?: TileProgressCallback
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

  // --- STANDARD MODE (via server relay to bypass network restrictions) ---
  const localKey = localStorage.getItem('gemini_api_key_local');

  if (!localKey) {
    throw new Error("No API Key found. Please configure your key in settings.");
  }

  const aspectRatio = getClosestAspectRatio(width, height);

  // Convert large PNG to JPEG (same resolution) to reduce transfer size
  const inputSizeMB = (cleanBase64.length * 0.75) / (1024 * 1024);
  if (inputSizeMB > 3) {
    cleanBase64 = await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92).replace(/^data:image\/jpeg;base64,/, ''));
      };
      img.onerror = () => resolve(cleanBase64);
      img.src = `data:image/png;base64,${cleanBase64}`;
    });
  }

  // Call Google API via server-side relay with SSE streaming
  const callViaRelay = async (prompt: string, imageBase64: string, maxRetries: number = 3, tileAspectRatio?: string): Promise<string> => {
    let lastError = '';
    const payloadMB = (imageBase64.length * 0.75 / 1024 / 1024).toFixed(2);
    const ar = tileAspectRatio || aspectRatio; // Use tile-specific AR if provided

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch('/api/relay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: localKey,
            model: 'gemini-3-pro-image-preview',
            contents: {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/png', data: imageBase64 } },
              ],
            },
            config: {
              systemInstruction: SYSTEM_PROMPT,
              imageConfig: { aspectRatio: ar, imageSize: '2K' },
            },
          }),
        });

        // Handle error responses (JSON)
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          const errMsg = data.error || 'Unknown';

          // Quota/billing errors — abort all processing immediately
          const isQuotaError = res.status === 429 || errMsg.includes('spending cap') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
          if (isQuotaError) {
            const quotaErr: any = new Error(`QUOTA_EXCEEDED: ${errMsg}`);
            quotaErr.isQuotaError = true;
            throw quotaErr;
          }

          // Location error — tell user to enable Smart Placement
          if (errMsg.includes('location is not supported')) {
            lastError = `[${payloadMB}MB] Google API rejected: region not supported. Please enable Smart Placement in Cloudflare Dashboard → Pages → Settings → Functions → Placement`;
          } else {
            lastError = `[${payloadMB}MB] HTTP ${res.status}: ${errMsg}`;
          }
          if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 3000)); continue; }
          throw new Error(lastError);
        }

        // Parse SSE stream from relay (Google's streamGenerateContent response)
        const sseText = await res.text();
        const lines = sseText.split('\n');
        let imageData = '';
        let modelText = '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            const parts = chunk.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                imageData = part.inlineData.data;
              }
              if (part.text) {
                modelText += part.text;
              }
            }
          } catch { /* skip unparseable lines */ }
        }

        if (imageData) {
          return imageData;
        }

        // No image found in stream
        lastError = `[${payloadMB}MB] No image in stream. ${modelText ? `Model: "${modelText.substring(0, 200)}"` : 'Empty response'}`;
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 2000)); continue; }

      } catch (err: any) {
        // Re-throw quota errors immediately without retry
        if (err?.isQuotaError) throw err;

        const msg = err?.message || String(err);
        if (msg.includes('HTTP')) { lastError = msg; }
        else { lastError = `[${payloadMB}MB] ${msg}`; }
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 3000)); continue; }
      }
    }

    throw new Error(`No image generated. ${lastError}`);
  };

  // Quality mode — default ECONOMY (single image call, ~5-10% cost of tile mode)
  // Users can opt into FINE mode via localStorage for best text clarity at higher cost
  const qualityMode = localStorage.getItem('quality_mode') || 'economy'; // 'economy' | 'fine'
  const imageArea = width * height;
  const longestSide = Math.max(width, height);

  let divisor: number;
  if (qualityMode === 'economy' || imageArea <= 1200 * 1200) {
    divisor = 1; // Economy mode or small image: single call
  } else if (longestSide <= 2000) {
    divisor = 2; // Fine mode - medium: 2x2 = 4 tiles
  } else if (longestSide <= 3200) {
    divisor = 3; // Fine mode - large: 3x3 = 9 tiles
  } else {
    divisor = 4; // Fine mode - very large: 4x4 = 16 tiles
  }

  const useTiling = divisor > 1;
  console.log(`[Mode] ${qualityMode}, tiling=${useTiling}${useTiling ? ` (${divisor}x${divisor})` : ''}`);

  try {
    if (useTiling) {
      console.log(`[Tiling] Image ${width}x${height} — ${divisor}x${divisor} grid = ${divisor * divisor} tiles`);

      const sourceImg = await loadImage(`data:image/png;base64,${cleanBase64}`);
      const cols = divisor;
      const rows = divisor;
      const totalTiles = cols * rows;

      // Compute integer boundaries so tiles cover the full image with no gaps
      const xBoundaries: number[] = [];
      const yBoundaries: number[] = [];
      for (let i = 0; i <= cols; i++) xBoundaries.push(Math.round((i * width) / cols));
      for (let i = 0; i <= rows; i++) yBoundaries.push(Math.round((i * height) / rows));

      // All tiles have the same aspect ratio as the full image
      // (because we divide both dimensions by the same number)
      const unifiedAspectRatio = getClosestAspectRatio(width, height);
      console.log(`[Tiling] Unified aspect ratio: ${unifiedAspectRatio} (from ${width}x${height})`);

      // Process each tile with rate limiting
      const tilePrompt = `${USER_PROMPT}\n\nThis is a cropped section of a larger document. Focus on making every character razor-sharp.`;
      const DELAY_MS = 3000;

      onTileProgress?.(0, totalTiles);

      // Output canvas — assemble tiles directly onto it
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outputCtx = outputCanvas.getContext('2d')!;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const tileIdx = row * cols + col + 1;

          // Use integer boundaries for exact gap-free coverage
          const tx = xBoundaries[col];
          const ty = yBoundaries[row];
          const tw = xBoundaries[col + 1] - tx;
          const th = yBoundaries[row + 1] - ty;

          onTileProgress?.(tileIdx, totalTiles);
          console.log(`[Tiling] Tile ${tileIdx}/${totalTiles}: pos(${tx},${ty}) size(${tw}x${th})`);

          // Rate limiting between API calls
          if (tileIdx > 1) {
            await new Promise(r => setTimeout(r, DELAY_MS));
          }

          // 1. Extract exact tile (no padding)
          const tileBase64 = extractTile(sourceImg, tx, ty, tw, th);

          // 2. Use unified aspect ratio (same as full image since NxN grid)
          // 3. Process through API
          const resultBase64 = await callViaRelay(tilePrompt, tileBase64, 3, unifiedAspectRatio);

          // 4. Resize API output to exactly match tile dimensions
          const resizedImg = await resizeToExact(resultBase64, tw, th);

          // 5. Place tile at exact position on output canvas
          outputCtx.drawImage(resizedImg, tx, ty);
        }
      }

      const resultDataUrl = outputCanvas.toDataURL('image/png');
      console.log(`[Tiling] Complete!`);
      return { image: resultDataUrl };

    } else {
      // === SMALL IMAGE: process whole image at once ===
      const base64 = await callViaRelay(USER_PROMPT, cleanBase64, 2);
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