import {
  AI_CORS_HEADERS,
  aiKeysMatch,
  extractAiApiKeyDetailed,
  getConfiguredAiApiKey,
} from "@/lib/ai/key";
import { aiOk } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/health
 * Public ping. Always HTTP 200 with ok=true so ChatGPT never raises
 * ClientResponseError here. `authenticated` reports whether a key was sent.
 */
export async function GET(request: Request) {
  const configured = getConfiguredAiApiKey();
  const extracted = extractAiApiKeyDetailed(request);
  const authenticated = aiKeysMatch(extracted.key, configured);

  return aiOk({
    status: "ok",
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
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: AI_CORS_HEADERS,
  });
}
