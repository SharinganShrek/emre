import { extractAiApiKey, timingSafeEqual } from "@/lib/ai/permissions";
import { aiOk } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/health
 * Always 200 so Custom GPT can ping without auth.
 * `authenticated` tells you whether the Bearer key was accepted.
 */
export async function GET(request: Request) {
  const configured = process.env.AI_API_KEY ?? "";
  const provided = extractAiApiKey(request) ?? "";
  const authenticated =
    Boolean(configured) &&
    Boolean(provided) &&
    timingSafeEqual(provided, configured);

  return aiOk({
    status: "ok",
    service: "emre-os-ai",
    authenticated,
    timestamp: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, x-ai-api-key",
    },
  });
}
