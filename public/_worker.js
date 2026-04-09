// Cloudflare Pages Advanced Mode: _worker.js
// Handles /api/relay route + serves static assets for everything else

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle /api/relay — proxy to Google Generative AI API
    if (url.pathname === '/api/relay' && request.method === 'POST') {
      return handleRelay(request);
    }

    // All other requests: serve static assets
    return env.ASSETS.fetch(request);
  }
};

async function handleRelay(request) {
  try {
    const { apiKey, model, contents, config } = await request.json();

    if (!apiKey || !apiKey.startsWith('AIza')) {
      return jsonResponse({ error: 'Invalid API key' }, 400);
    }

    // Build Google REST API request
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const generationConfig = {
      responseModalities: ['TEXT', 'IMAGE'],
    };

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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse({
        error: data.error?.message || `Google API error ${response.status}`,
        detail: data.error,
      }, response.status);
    }

    return jsonResponse(data, 200);

  } catch (error) {
    return jsonResponse({ error: error.message || 'Relay error' }, 500);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
