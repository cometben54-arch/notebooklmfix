/// <reference types="@cloudflare/workers-types" />

interface Env {
  NOTEBOOKLM_KV: KVNamespace;
  R2_BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
}

type PagesFunction<E = Env> = import("@cloudflare/workers-types").PagesFunction<E>;
