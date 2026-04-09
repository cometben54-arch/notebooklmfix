// Server-side relay for Google Generative AI API
// Solves: browser cannot reach generativelanguage.googleapis.com directly
// Flow: Browser -> /api/relay -> Google API -> response back to browser

export const config = {
    maxDuration: 120,
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { apiKey, model, contents, config: genConfig } = req.body;

        if (!apiKey || !apiKey.startsWith('AIza')) {
            return res.status(400).json({ error: 'Invalid API key' });
        }

        // Build the Google API request
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const generationConfig = {
            responseModalities: ['TEXT', 'IMAGE'],
        };

        if (genConfig?.imageConfig) {
            generationConfig.imageConfig = genConfig.imageConfig;
        }

        const body = {
            contents: Array.isArray(contents) ? contents : [contents],
            generationConfig,
        };

        if (genConfig?.systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: genConfig.systemInstruction }]
            };
        }

        console.log(`[relay] Model: ${model}, Payload parts: ${body.contents[0]?.parts?.length || 0}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`[relay] Google API error ${response.status}:`, JSON.stringify(data).substring(0, 500));
            return res.status(response.status).json({
                error: data.error?.message || `Google API error ${response.status}`,
                detail: data.error,
            });
        }

        // Return the full response (may contain large base64 images)
        return res.status(200).json(data);

    } catch (error) {
        console.error('[relay] Error:', error);
        return res.status(500).json({
            error: error.message || 'Relay server error',
        });
    }
}
