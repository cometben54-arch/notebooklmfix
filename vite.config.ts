import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'configure-server',
        configureServer(server) {
          // Local dev proxy for /api/* routes
          // In production, Cloudflare Pages Functions handle these routes
          server.middlewares.use('/api/proxy', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            try {
              const buffers: Buffer[] = [];
              for await (const chunk of req) { buffers.push(chunk); }
              const data = JSON.parse(Buffer.concat(buffers).toString());
              const { prompt, image, accessCode, imageSize, aspectRatio, validateOnly } = data;

              // Mock access code validation for local dev
              const ACCESS_CODES = ["notebook888", "vip666", "jaffry"];
              if (!ACCESS_CODES.includes(accessCode)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Invalid Access Code" }));
                return;
              }

              if (validateOnly) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ valid: true, quota: { total: 100, remaining: 99 } }));
                return;
              }

              // Call Gemini with env key
              const { GoogleGenAI } = await import('@google/genai');
              const apiKey = env.GEMINI_API_KEY || env.API_KEY;
              if (!apiKey) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "Server API Key not found in .env" }));
                return;
              }

              const ai = new GoogleGenAI({ apiKey });
              const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: {
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: image } },
                  ],
                },
                config: {
                  systemInstruction: "你是一个专业的图像修复专家。",
                  imageConfig: {
                    aspectRatio: aspectRatio || '16:9',
                    imageSize: imageSize || '2K',
                  }
                },
              });

              const candidates = response.candidates;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ candidates, quota: { total: 100, remaining: 98 } }));
            } catch (e: any) {
              console.error("Local Proxy Error:", e);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.toString() }));
            }
          });

          server.middlewares.use('/api/verify-code', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
            const buffers: Buffer[] = [];
            for await (const chunk of req) { buffers.push(chunk); }
            const { accessCode } = JSON.parse(Buffer.concat(buffers).toString());

            if (accessCode === 'vip666') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ valid: true, quota: { total: 100, remaining: 99, valid: true } }));
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ valid: false, error: "Mock: Try 'vip666'" }));
            }
          });
        },
      }
    ],
    define: {
      // Security: Do NOT inject API keys into client-side code
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
