import {
  AI_CORS_HEADERS,
  aiKeysMatch,
  extractAiApiKeyDetailed,
  getConfiguredAiApiKey,
} from "@/lib/ai/key";
import { aiError, aiOk } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/health
 * Always HTTP 200. `ok` and `authenticated` are true only when the request
 * sent a matching `X-Api-Key` (or a fallback Authorization / x-ai-api-key).
 */
export async function GET(request: Request) {
  const configured = getConfiguredAiApiKey();
  const extracted = extractAiApiKeyDetailed(request);
  const authenticated = aiKeysMatch(extracted.key, configured);
  const probe = {
    status: authenticated ? "ok" : "auth_failed",
    service: "emre-os-ai",
    authenticated,
    key_configured: Boolean(configured),
    key_sent: Boolean(extracted.key),
    key_source: extracted.source,
    key_length_match:
      Boolean(configured) &&
      Boolean(extracted.key) &&
      extracted.key.length === configured.length,
    timestamp: new Date().toISOString(),
  };

  if (!authenticated) {
    const message = !configured
      ? "AI API is not configured. Set AI_API_KEY on the Vercel production environment."
      : !extracted.key
        ? "Missing AI API key. GPT Actions Authentication must be API Key → Custom, header X-Api-Key. Paste only the Vercel AI_API_KEY value."
        : "AI API key did not match the server. Re-copy AI_API_KEY from Vercel into the GPT Action key box.";
    return aiError(message, 401, probe);
  }

  return aiOk(probe);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: AI_CORS_HEADERS,
  });
}
