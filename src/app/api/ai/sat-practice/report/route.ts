import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch, aiError } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import { AiPermissionError } from "@/lib/ai/permissions";
import { getAttempt, listAttempts } from "@/lib/sat-practice/repository";
import { flattenQuestions, pageReportQuestions } from "@/lib/sat-practice/report";

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
    const missesOnly = url.searchParams.get("misses_only") === "true";
    const offsetRaw = url.searchParams.get("offset");
    const queryOffset =
      offsetRaw == null || offsetRaw === "" ? null : Number(offsetRaw);
    if (queryOffset != null && (!Number.isInteger(queryOffset) || queryOffset < 0)) {
      return aiError("offset must be a non-negative integer.", 422);
    }
    const cursor = readReportCursor(
      url.searchParams.get("id") || url.searchParams.get("attempt_id"),
      queryOffset,
    );
    const offset = cursor.offset;

    const completed = (await listAttempts(ctx.admin, ctx.userId))
      .filter((attempt) => attempt.status === "completed")
      .sort((a, b) =>
        String(b.completed_at || "").localeCompare(String(a.completed_at || "")),
      );
    let id = cursor.id;
    if (!id) {
      id = completed[0]?.id || "";
      if (!id) return aiError("No completed SAT practice mocks yet.", 404);
    }
    const attemptIndex = completed.findIndex((attempt) => attempt.id === id);
    const attempt = await getAttempt(ctx.admin, id, ctx.userId);
    if (!attempt) return aiError("Attempt not found.", 404);
    if (attempt.status !== "completed") {
      return aiError("This mock is not finished yet.", 409);
    }

    const rows = flattenQuestions(
      attempt.section,
      attempt.modules,
      attempt.answers,
      attempt.flagged,
      attempt.seconds_spent,
    );
    const page = pageReportQuestions(rows, {
      offset,
      missesOnly,
      includeTiming: attempt.include_timing_in_report,
    });
    const nextAttemptId =
      page.next_offset == null && attemptIndex >= 0
        ? completed[attemptIndex + 1]?.id || null
        : null;

    await logAiAction({
      ctx,
      route: "/api/ai/sat-practice/report",
      action: "read",
      resource: "sat_practice",
      summary: `Read SAT practice report ${attempt.title} offset ${page.offset}`,
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
      domain_stats: offset === 0 ? attempt.domain_stats : undefined,
      misses_only: missesOnly,
      question_count: page.question_count,
      match_count: page.match_count,
      miss_count: page.miss_count,
      offset: page.offset,
      next_offset: page.next_offset,
      attempt_index: attemptIndex >= 0 ? attemptIndex + 1 : null,
      attempt_count: completed.length,
      next_attempt_id: nextAttemptId,
      questions: page.questions,
      note: pageNote(attempt.id, missesOnly, page.next_offset, nextAttemptId),
    });
  } catch (err) {
    return aiCatch(err);
  }
}

/** `id` may be `uuid:offset` so an action schema without an offset field can still page. */
function readReportCursor(rawId: string | null, queryOffset: number | null) {
  let id = rawId || "";
  let suffix: number | null = null;
  const colon = id.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(id.slice(colon + 1))) {
    suffix = Number(id.slice(colon + 1));
    id = id.slice(0, colon);
  }
  const offset =
    queryOffset != null && queryOffset > 0 ? queryOffset : (suffix ?? queryOffset ?? 0);
  return { id, offset };
}

function pageNote(
  attemptId: string,
  missesOnly: boolean,
  nextOffset: number | null,
  nextAttemptId: string | null,
) {
  const scope = missesOnly
    ? "These are incorrect questions only, with the stem, choices, and rationale. number is the original question number. offset walks the miss list."
    : "Each question includes the stem, A–D choice text, Emre's answer, the correct answer, and the rationale.";
  const more =
    nextOffset == null
      ? "This mock's pages are finished."
      : `Call getSatPracticeReport again with id=${attemptId}:${nextOffset}. The same call is id=${attemptId} and offset=${nextOffset}. Do not ask for the whole mock in one call.`;
  const next = nextAttemptId
    ? ` next_attempt_id is the next older completed mock. Use id=${nextAttemptId} only when Emre asked for more than this test.`
    : "";
  return `${scope} ${more}${next} If include_timing_in_report is false, ignore pacing.`;
}
