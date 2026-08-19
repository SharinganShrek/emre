import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { satVocabData } from "@/lib/sat-vocab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/sat-vocab/themes */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/themes",
      action: "read",
      resource: "sat_vocab",
      summary: "Listed SAT vocab themes",
    });

    return aiOk({
      theme_count: satVocabData.meta.theme_count,
      themes: satVocabData.themes,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
