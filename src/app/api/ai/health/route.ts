import { authorizeAiRequest } from "@/lib/ai/permissions";
import { aiOk, aiCatch } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/health — lightweight connectivity check for Custom GPT Actions. */
export async function GET(request: Request) {
  try {
    authorizeAiRequest(request);
    return aiOk({
      status: "ok",
      service: "emre-os-ai",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return aiCatch(err);
  }
}
