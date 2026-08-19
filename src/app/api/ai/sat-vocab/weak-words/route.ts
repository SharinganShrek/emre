import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { loadSatProgress, weakWords } from "@/lib/sat-vocab/ai";
import { satVocabWeakQuery } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/sat-vocab/weak-words */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    const url = new URL(request.url);
    const { limit } = satVocabWeakQuery.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const progress = await loadSatProgress(ctx);
    const items = weakWords(progress, limit);

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/weak-words",
      action: "read",
      resource: "sat_vocab",
      summary: `Listed ${items.length} weak SAT words`,
    });

    return aiOk({ count: items.length, words: items });
  } catch (err) {
    return aiCatch(err);
  }
}
