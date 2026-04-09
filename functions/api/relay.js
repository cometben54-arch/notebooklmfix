// Cloudflare Pages Function: /api/relay
// Routes Google Generative AI requests through server to bypass network restrictions
// Browser -> /api/relay (Cloudflare edge) -> Google API -> response back

export async function onRequest(context) {
    const { request } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { apiKey, model, contents, config } = await request.json();

        if (!apiKey || !apiKey.startsWith('AIza')) {
            return new Response(JSON.stringify({ error: 'Invalid API key' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Build Google REST API request body
        // Reference: https://ai.google.dev/gemini-api/docs/image-generation
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const generationConfig = {
            responseModalities: ['TEXT', 'IMAGE'],
        };

        // imageConfig (aspectRatio, imageSize) goes inside generationConfig
        if (config?.imageConfig) {
            generationConfig.imageConfig = config.imageConfig;
        }

        const body = {
            contents: Array.isArray(contents) ? contents : [contents],
            generationConfig,
        };

        if (config?.systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: config.systemInstruction }],
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: data.error?.message || `Google API error ${response.status}`,
                detail: data.error,
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message || 'Relay server error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
