import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import { AiPermissionError } from "@/lib/ai/permissions";
import { allCompletedAttempts } from "@/lib/sat-practice/repository";
import {
  attemptCards,
  focusNext,
  weakSkills,
} from "@/lib/sat-practice/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("sat_practice", "read");
    if (!isHubSyncConfigured()) {
      throw new AiPermissionError("Hub sync is not configured.", 503);
    }
    const attempts = await allCompletedAttempts(ctx.admin, ctx.userId);
    const rw = attempts.filter((a) => a.section === "rw");
    const math = attempts.filter((a) => a.section === "math");
    const full = attempts.filter((a) => a.section === "full");
    await logAiAction({
      ctx,
      route: "/api/ai/sat-practice/summary",
      action: "read",
      resource: "sat_practice",
      summary: `Summarized ${attempts.length} SAT practice mocks`,
    });
    return aiOk({
      completed_count: attempts.length,
      rw_count: rw.length,
      math_count: math.length,
      bluebook_count: full.length,
      latest_rw: rw[0]
        ? {
            id: rw[0].id,
            title: rw[0].title,
            raw: `${rw[0].raw_correct}/${rw[0].raw_total}`,
            scaled_estimated: rw[0].scaled_estimated,
          }
        : null,
      latest_math: math[0]
        ? {
            id: math[0].id,
            title: math[0].title,
            raw: `${math[0].raw_correct}/${math[0].raw_total}`,
            scaled_estimated: math[0].scaled_estimated,
          }
        : null,
      latest_bluebook: full[0]
        ? {
            id: full[0].id,
            title: full[0].title,
            raw: `${full[0].raw_correct}/${full[0].raw_total}`,
            official_total: full[0].official_total,
            official_rw: full[0].official_rw,
            official_math: full[0].official_math,
          }
        : null,
      weak_skills: weakSkills(attempts),
      focus_next: focusNext(attempts),
      attempts: attemptCards(attempts),
      note: "QBank R&W and Math mocks are separate; scaled_estimated is unofficial. Bluebook imports (source=bluebook, section=full) use official 400–1600 scores. Timing in reports is per-attempt include_timing_in_report.",
    });
  } catch (err) {
    return aiCatch(err);
  }
}
