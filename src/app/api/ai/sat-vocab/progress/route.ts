import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import { fetchSatVocabProgress } from "@/lib/supabase/sat-vocab-repository";
import {
  progressSummary,
  satVocabData,
  getWordsForPlanDay,
} from "@/lib/sat-vocab";
import { emptySatProgress } from "@/lib/sat-vocab/types";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/sat-vocab/progress — summary of SAT vocab progress. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    let progress = emptySatProgress(satVocabData.meta.plan_start);
    if (isHubSyncConfigured()) {
      progress = await fetchSatVocabProgress(ctx.admin, ctx.userId);
    }

    const summary = progressSummary(progress);
    const today = todayISO();
    const todayPlan = satVocabData.plan.find((p) => p.scheduled_date === today);

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
      completed_dates: progress.completed_dates,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
