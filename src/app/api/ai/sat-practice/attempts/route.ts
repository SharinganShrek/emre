import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import { AiPermissionError } from "@/lib/ai/permissions";
import { allCompletedAttempts } from "@/lib/sat-practice/repository";
import { attemptCards } from "@/lib/sat-practice/analysis";

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
    const url = new URL(request.url);
    const section = url.searchParams.get("section");
    const filtered =
      section === "rw" || section === "math" || section === "full"
        ? attempts.filter((a) => a.section === section)
        : attempts;
    await logAiAction({
      ctx,
      route: "/api/ai/sat-practice/attempts",
      action: "read",
      resource: "sat_practice",
      summary: `Listed ${filtered.length} SAT practice mocks`,
    });
    return aiOk({ attempts: attemptCards(filtered) });
  } catch (err) {
    return aiCatch(err);
  }
}
