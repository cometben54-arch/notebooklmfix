interface Env {
  NOTEBOOKLM_KV: KVNamespace;
}

const STATS_KEY = "stats:global";
const BASE_COUNT = 2849;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const countStr = await context.env.NOTEBOOKLM_KV.get(STATS_KEY);
    const count = parseInt(countStr || "0");
    const total = BASE_COUNT + count;

    return Response.json(
      { imagesFixed: total, successRate: 98 },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Stats GET Error:", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const increment = parseInt(body.count) || 1;

    const currentStr = await context.env.NOTEBOOKLM_KV.get(STATS_KEY);
    const current = parseInt(currentStr || "0");
    const newCount = current + increment;

    await context.env.NOTEBOOKLM_KV.put(STATS_KEY, String(newCount));

    const total = BASE_COUNT + newCount;

    return Response.json(
      { imagesFixed: total, added: increment },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Stats POST Error:", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders }
    );
  }
};
