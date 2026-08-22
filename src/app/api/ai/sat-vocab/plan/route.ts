import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import {
  loadSatProgress,
  planDayWithProgress,
  satVocabData,
} from "@/lib/sat-vocab/ai";
import { satVocabPlanQuery } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/sat-vocab/plan?week=1 */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_vocab", "read");

    const url = new URL(request.url);
    const { week, include_words } = satVocabPlanQuery.parse({
      week: url.searchParams.get("week"),
      include_words: url.searchParams.get("include_words"),
    });

    const progress = await loadSatProgress(ctx);
    const days = satVocabData.plan
      .filter((d) => (week ? d.week === week : true))
      .map((d) => {
        const row = planDayWithProgress(d, progress);
        return {
          plan_id: row.id,
          week: row.week,
          day_name: row.day_name,
          session_label: row.session_label,
          session_num: row.session_num,
          kind: row.kind,
          theme_focus: row.theme_focus,
          word_count: row.word_count,
          ...(include_words ? { words: row.words } : {}),
          task_note: row.task_note || undefined,
          complete: row.complete,
          learned: row.session_progress.learned,
          tested: row.session_progress.tested,
          scores: row.session_progress.scores ?? null,
        };
      });

    await logAiAction({
      ctx,
      route: "/api/ai/sat-vocab/plan",
      action: "read",
      resource: "sat_vocab",
      summary: week ? `Listed SAT plan week ${week}` : "Listed SAT 10-week plan",
    });

    return aiOk({
      plan_start: satVocabData.meta.plan_start,
      week: week ?? null,
      include_words,
      days,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
