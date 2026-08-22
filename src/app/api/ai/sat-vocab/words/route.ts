import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { lookupWords } from "@/lib/sat-vocab/ai";
import { satVocabWordsQuery } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/sat-vocab/words
 * Lookup one word, search, or list a theme (paginated).
 */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    const url = new URL(request.url);
    const q = satVocabWordsQuery.parse({
      word: url.searchParams.get("word"),
      q: url.searchParams.get("q"),
      theme: url.searchParams.get("theme"),
      offset: url.searchParams.get("offset"),
      limit: url.searchParams.get("limit"),
      detail: url.searchParams.get("detail"),
    });

    const result = lookupWords(q);

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/words",
      action: "read",
      resource: "sat_vocab",
      summary: `Looked up SAT words (${result.words.length}/${result.total})`,
    });

    return aiOk(result);
  } catch (err) {
    return aiCatch(err);
  }
}
