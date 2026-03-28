interface Env {
  NOTEBOOKLM_KV: KVNamespace;
}

interface AccessCodeData {
  total: number;
  remaining: number;
  valid: boolean;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const { accessCode }: any = await request.json();

    if (!accessCode) {
      return Response.json(
        { error: "Access Code is required" },
        { status: 400 }
      );
    }

    const key = `ac:${accessCode}`;
    const dataStr = await env.NOTEBOOKLM_KV.get(key);

    if (!dataStr) {
      return Response.json({ valid: false, error: "Invalid Access Code" });
    }

    const data: AccessCodeData = JSON.parse(dataStr);

    if (data.remaining <= 0) {
      return Response.json({
        valid: false,
        error: "Quota Exceeded",
        quota: { total: data.total, remaining: 0 },
      });
    }

    if (!data.valid) {
      return Response.json({
        valid: false,
        error: "Code disabled",
      });
    }

    return Response.json({
      valid: true,
      quota: {
        total: data.total,
        remaining: data.remaining,
        valid: true,
      },
    });
  } catch (error) {
    console.error("Verify Code Error:", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
};
