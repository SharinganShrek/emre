import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch, aiError } from "@/lib/ai/response";
import {
  findPlanDay,
  loadSatProgress,
  nextOpenDay,
  sessionPayload,
} from "@/lib/sat-vocab/ai";
import { satVocabSessionQuery } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/sat-vocab/session?plan_id=plan-001
 * Also accepts date=YYYY-MM-DD or session_num=1
 */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    const url = new URL(request.url);
    const q = satVocabSessionQuery.parse({
      plan_id: url.searchParams.get("plan_id") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
      session_num: url.searchParams.get("session_num") ?? undefined,
      detail: url.searchParams.get("detail") ?? undefined,
    });

    const progress = await loadSatProgress(ctx);
    const day =
      findPlanDay({
        plan_id: q.plan_id,
        session_num: q.session_num,
      }) ?? nextOpenDay(progress);
    if (!day) return aiError("Session not found.", 404);
    const payload = sessionPayload(day, progress, q.detail);

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/session",
      action: "read",
      resource: "sat_vocab",
      summary: `Read SAT session ${day.id} (${q.detail})`,
    });

    return aiOk(payload);
  } catch (err) {
    return aiCatch(err);
  }
}
