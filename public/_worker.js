// Cloudflare Pages Advanced Mode: _worker.js
// Handles /api/relay route + serves static assets for everything else
// Uses streaming API to avoid Cloudflare's 30s timeout

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/relay' && request.method === 'POST') {
      return handleRelay(request);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleRelay(request) {
  try {
    const { apiKey, model, contents, config } = await request.json();

    if (!apiKey || !apiKey.startsWith('AIza')) {
      return jsonResponse({ error: 'Invalid API key' }, 400);
    }

    // Use streamGenerateContent with SSE — first chunk arrives in ~1-2s,
    // keeping the Cloudflare Worker alive (no 30s timeout)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

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

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return jsonResponse({
        error: errData.error?.message || `Google API error ${response.status}`,
        detail: errData.error,
      }, response.status);
    }

    // Stream Google's SSE response directly to client — keeps connection alive
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });

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
