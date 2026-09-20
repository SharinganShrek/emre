import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch, aiError } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import { AiPermissionError } from "@/lib/ai/permissions";
import {
  allCompletedAttempts,
  getAttempt,
} from "@/lib/sat-practice/repository";
import { buildResultsReport } from "@/lib/sat-practice/report";
import { flattenQuestions } from "@/lib/sat-practice/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_practice", "read");
    if (!isHubSyncConfigured()) {
      throw new AiPermissionError("Hub sync is not configured.", 503);
    }
    const url = new URL(request.url);
    let id = url.searchParams.get("id") || url.searchParams.get("attempt_id");
    const missesOnly = url.searchParams.get("misses_only") === "true";
    if (!id) {
      const all = await allCompletedAttempts(ctx.admin, ctx.userId);
      id = all[0]?.id || "";
      if (!id) return aiError("No completed SAT practice mocks yet.", 404);
    }
    const attempt = await getAttempt(ctx.admin, id, ctx.userId);
    if (!attempt) return aiError("Attempt not found.", 404);
    if (attempt.status !== "completed") {
      return aiError("This mock is not finished yet.", 409);
    }
    const report = buildResultsReport(attempt, {
      includeTiming: attempt.include_timing_in_report,
    });
    const rows = flattenQuestions(
      attempt.section,
      attempt.modules,
      attempt.answers,
      attempt.flagged,
      attempt.seconds_spent,
    );
    const misses = rows
      .filter((r) => !r.isCorrect)
      .map((r) => ({
        module: r.module,
        question: r.index + 1,
        domain: r.question.domain,
        skill: r.question.skill,
        difficulty: r.question.difficulty,
        chosen: r.chosen,
        correct: r.correct,
        seconds_spent: attempt.include_timing_in_report
          ? r.secondsSpent
          : null,
      }));

    await logAiAction({
      ctx,
      route: "/api/ai/sat-practice/report",
      action: "read",
      resource: "sat_practice",
      summary: `Read SAT practice report ${attempt.title}`,
    });

    return aiOk({
      id: attempt.id,
      title: attempt.title,
      section: attempt.section,
      source: attempt.source,
      raw: `${attempt.raw_correct}/${attempt.raw_total}`,
      scaled_estimated: attempt.scaled_estimated,
      official_total: attempt.official_total,
      official_rw: attempt.official_rw,
      official_math: attempt.official_math,
      include_timing_in_report: attempt.include_timing_in_report,
      domain_stats: attempt.domain_stats,
      misses,
      report: missesOnly ? undefined : report,
      note: attempt.include_timing_in_report
        ? "Time spent lines are included because Emre enabled timing for this mock."
        : "Time spent is omitted for this mock. Do not infer pacing.",
    });
  } catch (err) {
    return aiCatch(err);
  }
}
