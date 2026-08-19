import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch, aiError } from "@/lib/ai/response";
import {
  applyLearn,
  applyRest,
  applyTest,
  applyWordResults,
  loadSatProgress,
  persistSatProgress,
  progressSummary,
  satVocabData,
  findPlanDay,
  nextOpenDay,
} from "@/lib/sat-vocab/ai";
import { satVocabProgressWrite } from "@/lib/validation";
import { todayISO } from "@/lib/utils";
import { getWordsForPlanDay } from "@/lib/sat-vocab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/sat-vocab/progress */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    const progress = await loadSatProgress(ctx);
    const summary = progressSummary(progress);
    const today = todayISO();
    const todayPlan = satVocabData.plan.find((p) => p.scheduled_date === today);
    const nextOpen = nextOpenDay(progress);

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/progress",
      action: "read",
      resource: "sat_vocab",
      summary: "Read SAT vocabulary progress summary",
    });

    return aiOk({
      plan_start: satVocabData.meta.plan_start,
      word_count: satVocabData.meta.word_count,
      summary,
      today: todayPlan
        ? {
            date: today,
            plan_id: todayPlan.id,
            session_label: todayPlan.session_label,
            kind: todayPlan.kind,
            theme_focus: todayPlan.theme_focus,
            words: getWordsForPlanDay(todayPlan).map((w) => w.word),
            session_progress: progress.sessions[todayPlan.id] ?? null,
          }
        : { date: today, plan_id: null },
      next_open: nextOpen
        ? {
            plan_id: nextOpen.id,
            scheduled_date: nextOpen.scheduled_date,
            session_label: nextOpen.session_label,
            kind: nextOpen.kind,
          }
        : null,
      completed_dates: progress.completed_dates,
    });
  } catch (err) {
    return aiCatch(err);
  }
}

/**
 * POST /api/ai/sat-vocab/progress
 * Non-destructive upserts: learn / test / rest / word_results.
 */
export async function POST(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "write");

    const body = satVocabProgressWrite.parse(await request.json());
    let progress = await loadSatProgress(ctx);

    if (body.action !== "word_results") {
      const day = findPlanDay({ plan_id: body.plan_id });
      if (!day) return aiError("Unknown plan_id.", 404);
    }

    if (body.action === "learn") {
      progress = applyLearn(progress, body.plan_id, body.known_words);
    } else if (body.action === "test") {
      if (body.results?.length) {
        progress = applyWordResults(progress, body.results);
      }
      progress = applyTest(progress, body.plan_id, body.drill, body.score);
    } else if (body.action === "rest") {
      progress = applyRest(progress, body.plan_id);
    } else {
      progress = applyWordResults(progress, body.results);
    }

    const saved = await persistSatProgress(ctx, progress);

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/progress",
      action: "write",
      resource: "sat_vocab",
      summary: `SAT vocab ${body.action}`,
      metadata: { action: body.action },
    });

    return aiOk({
      action: body.action,
      summary: progressSummary(saved),
      completed_dates: saved.completed_dates,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
