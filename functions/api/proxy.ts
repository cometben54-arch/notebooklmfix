interface Env {
  NOTEBOOKLM_KV: KVNamespace;
  R2_BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
}

interface AccessCodeData {
  total: number;
  remaining: number;
  valid: boolean;
}

const SYSTEM_PROMPT = "你是一个专业的图像修复专家。";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();
    const { image, prompt, accessCode, imageSize, aspectRatio, validateOnly } = body;

    // 1. Validate Access Code & Quota via Cloudflare KV
    const key = `ac:${accessCode}`;
    const quotaDataStr = await env.NOTEBOOKLM_KV.get(key);

    if (!quotaDataStr) {
      return Response.json(
        { error: "无效的激活码 (Invalid Access Code)" },
        { status: 401 }
      );
    }

    const quotaData: AccessCodeData = JSON.parse(quotaDataStr);

    // --- VALIDATION ONLY MODE ---
    if (validateOnly) {
      return Response.json({
        valid: true,
        quota: {
          total: quotaData.total,
          remaining: Math.max(0, quotaData.remaining),
        },
      });
    }

    if (quotaData.remaining <= 0) {
      return Response.json(
        {
          error: "配额已用尽 (Quota Exceeded)",
          quota: quotaData,
        },
        { status: 403 }
      );
    }

    // 2. Validate Server API Key
    const SERVER_KEY = env.GEMINI_API_KEY;
    if (!SERVER_KEY) {
      return Response.json(
        { error: "Server Error: GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // 3. Call Google Gemini via REST API
    const cleanBase64 = image.replace(
      /^data:image\/(png|jpeg|jpg|webp);base64,/,
      ""
    );

    const model = "gemini-3-pro-image-preview";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${SERVER_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageGenerationConfig: {
            aspectRatio: aspectRatio || "1:1",
            imageSize: imageSize || "4K",
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API Error:", errText);
      throw new Error(`Gemini API Error: ${geminiResponse.status}`);
    }

    const geminiResult: any = await geminiResponse.json();

    // 4. Extract candidates
    const candidates = geminiResult.candidates;
    if (!candidates || !candidates[0] || !candidates[0].content) {
      throw new Error("No candidates returned from Gemini");
    }

    // 5. Check response size - if too large, store in R2
    const payloadJson = JSON.stringify({ candidates });
    const payloadSize = new TextEncoder().encode(payloadJson).length;
    const MAX_INLINE_SIZE = 20 * 1024 * 1024; // 20MB (CF Workers limit is ~25MB)

    let finalCandidates = candidates;

    if (payloadSize > MAX_INLINE_SIZE && env.R2_BUCKET) {
      // Upload to R2 and return URL
      const part = candidates[0].content.parts[0];
      if (part.inlineData && part.inlineData.data) {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";

        // Decode base64 to binary
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const fileName = `gen_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;

        await env.R2_BUCKET.put(fileName, bytes, {
          httpMetadata: { contentType: mimeType },
        });

        // Create lightweight payload with R2 reference
        finalCandidates = JSON.parse(JSON.stringify(candidates));
        finalCandidates[0].content.parts[0] = {
          imageUrl: `/api/r2/${fileName}`,
          mimeType: mimeType,
        };
      }
    }

    // 6. Deduct quota atomically (read-modify-write)
    quotaData.remaining = Math.max(0, quotaData.remaining - 1);
    await env.NOTEBOOKLM_KV.put(key, JSON.stringify(quotaData));

    // 7. Return result
    return Response.json({
      candidates: finalCandidates,
      quota: {
        total: quotaData.total,
        remaining: quotaData.remaining,
      },
    });
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return Response.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
};
