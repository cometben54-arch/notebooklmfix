import { GoogleGenAI } from "@google/genai";

import { SYSTEM_PROMPT, USER_PROMPT, ENHANCE_4K_PROMPT } from '../constants/prompts';

// Tile-based processing constants
const TILE_SIZE = 768;   // Each tile dimension
const TILE_PADDING = 96; // Extra context around each tile to avoid edge artifacts

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

// Extract a tile from an image with padding for context
const extractTile = (
  img: HTMLImageElement,
  tileX: number, tileY: number,
  tileW: number, tileH: number,
  fullW: number, fullH: number
): { base64: string; padLeft: number; padTop: number; outW: number; outH: number } => {
  // Add padding (clamp to image bounds)
  const srcX = Math.max(0, tileX - TILE_PADDING);
  const srcY = Math.max(0, tileY - TILE_PADDING);
  const srcRight = Math.min(fullW, tileX + tileW + TILE_PADDING);
  const srcBottom = Math.min(fullH, tileY + tileH + TILE_PADDING);
  const srcW = srcRight - srcX;
  const srcH = srcBottom - srcY;

  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, srcW, srcH);
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return {
    base64: canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
    padLeft: tileX - srcX,
    padTop: tileY - srcY,
    outW: tileW,
    outH: tileH,
  };
};

// Crop padding from a processed tile and return just the tile area
const cropTile = async (
  tileBase64: string,
  padLeft: number, padTop: number,
  tileW: number, tileH: number,
  inputW: number, inputH: number
): Promise<string> => {
  const img = await loadImage(`data:image/png;base64,${tileBase64}`);

  // The API output might be different size than input, calculate scale
  const scaleX = img.width / inputW;
  const scaleY = img.height / inputH;

  const cropX = Math.round(padLeft * scaleX);
  const cropY = Math.round(padTop * scaleY);
  const cropW = Math.round(tileW * scaleX);
  const cropH = Math.round(tileH * scaleY);

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
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
  // Streaming keeps connection alive, avoiding Cloudflare's 30s timeout
  const callViaRelay = async (prompt: string, imageBase64: string, maxRetries: number = 2): Promise<string> => {
    let lastError = '';
    const payloadMB = (imageBase64.length * 0.75 / 1024 / 1024).toFixed(2);

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
              imageConfig: { aspectRatio, imageSize: '2K' },
            },
          }),
        });

        // Handle error responses (JSON)
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          lastError = `[${payloadMB}MB] HTTP ${res.status}: ${data.error || 'Unknown'}`;
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
        const msg = err?.message || String(err);
        if (msg.includes('HTTP')) { lastError = msg; }
        else { lastError = `[${payloadMB}MB] ${msg}`; }
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 3000)); continue; }
      }
    }

    throw new Error(`No image generated. ${lastError}`);
  };

  // Decide whether to use tile-based processing
  const imageArea = width * height;
  const useTiling = imageArea > 1200 * 1200; // Tile for images larger than ~1.4MP

  try {
    if (useTiling) {
      // === TILE-BASED PROCESSING ===
      // Split large image into small tiles, process each individually
      // Each tile gets the model's full attention for text clarity
      console.log(`[Tiling] Image ${width}x${height} — using tile-based processing`);

      const sourceImg = await loadImage(`data:image/png;base64,${cleanBase64}`);
      const cols = Math.ceil(width / TILE_SIZE);
      const rows = Math.ceil(height / TILE_SIZE);
      const tileW = Math.ceil(width / cols);
      const tileH = Math.ceil(height / rows);
      const totalTiles = cols * rows;

      console.log(`[Tiling] Grid: ${cols}x${rows} = ${totalTiles} tiles (${tileW}x${tileH} each)`);

      // Process each tile with rate limiting
      const processedTiles: { base64: string; x: number; y: number; w: number; h: number }[] = [];
      const tilePrompt = `${USER_PROMPT}\n\nNote: This is a cropped section of a larger document. Focus on making every character in this section razor-sharp.`;
      const DELAY_BETWEEN_TILES_MS = 3000; // 3s delay between API calls to avoid rate limiting

      onTileProgress?.(0, totalTiles); // Initial progress

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const tileIdx = row * cols + col + 1;
          const tx = col * tileW;
          const ty = row * tileH;
          const tw = Math.min(tileW, width - tx);
          const th = Math.min(tileH, height - ty);

          // Report progress to UI
          onTileProgress?.(tileIdx, totalTiles);
          console.log(`[Tiling] Processing tile ${tileIdx}/${totalTiles} (${tw}x${th})...`);

          // Rate limiting: wait between API calls (skip before first tile)
          if (tileIdx > 1) {
            console.log(`[Tiling] Waiting ${DELAY_BETWEEN_TILES_MS / 1000}s before next tile...`);
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_TILES_MS));
          }

          // Extract tile with padding
          const { base64: tileBase64, padLeft, padTop, outW, outH } = extractTile(
            sourceImg, tx, ty, tw, th, width, height
          );
          const paddedW = tw + padLeft + Math.min(TILE_PADDING, width - tx - tw);
          const paddedH = th + padTop + Math.min(TILE_PADDING, height - ty - th);

          // Process tile through API
          const resultBase64 = await callViaRelay(tilePrompt, tileBase64, 2);

          // Crop padding off the result
          const croppedBase64 = await cropTile(resultBase64, padLeft, padTop, outW, outH, paddedW, paddedH);

          processedTiles.push({ base64: croppedBase64, x: tx, y: ty, w: tw, h: th });
        }
      }

      // Reassemble tiles into final image
      console.log(`[Tiling] Reassembling ${totalTiles} tiles...`);
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outputCtx = outputCanvas.getContext('2d')!;

      for (const tile of processedTiles) {
        const tileImg = await loadImage(`data:image/png;base64,${tile.base64}`);
        outputCtx.drawImage(tileImg, 0, 0, tileImg.width, tileImg.height, tile.x, tile.y, tile.w, tile.h);
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