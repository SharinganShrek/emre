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
import { computeSatStreak } from "@/lib/sat-vocab/streak";
import { satVocabProgressWrite } from "@/lib/validation";
import { todayISO } from "@/lib/utils";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SyntaxError("Invalid JSON body");
  }
}

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
    const nextOpen = nextOpenDay(progress);
    const streak = computeSatStreak(progress.activity_dates ?? [], today);

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/progress",
      action: "read",
      resource: "sat_vocab",
      summary: "Read SAT vocabulary progress summary",
    });

    return aiOk({
      word_count: satVocabData.meta.word_count,
      summary,
      streak: {
        current: streak.current,
        studied_today: streak.studied_today,
        shield_available: streak.shield_available,
        shield_used_this_week: streak.shield_used_this_week,
      },
      next_open: nextOpen
        ? {
            plan_id: nextOpen.id,
            week: nextOpen.week,
            session_label: nextOpen.session_label,
            kind: nextOpen.kind,
            theme_focus: nextOpen.theme_focus,
          }
        : null,
      activity_dates: progress.activity_dates,
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

    const body = satVocabProgressWrite.parse(await readJsonBody(request));
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
      activity_dates: saved.activity_dates,
      streak: computeSatStreak(saved.activity_dates ?? []),
    });
  } catch (err) {
    return aiCatch(err);
  }
}
