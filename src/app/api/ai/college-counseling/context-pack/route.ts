import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { buildCounselorContextPack } from "@/lib/college-counseling/context-pack";
import { collegeCounselingData as seedData } from "@/lib/college-counseling/data";
import { fetchCollegeCounseling } from "@/lib/supabase/college-counseling-repository";
import { isHubSyncConfigured } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/college-counseling/context-pack
 *
 * Read-only Markdown context pack for a future counselor / Custom GPT Action.
 * Does NOT call any LLM. Uses the same bearer auth as other AI routes.
 */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("college_counseling", "read");

    let markdown: string;
    if (isHubSyncConfigured()) {
      const data = await fetchCollegeCounseling(ctx.admin, ctx.userId);
      markdown = buildCounselorContextPack(data);
    } else {
      markdown = buildCounselorContextPack(seedData);
    }

    await logAiAction({
      ctx,
      route: "/api/ai/college-counseling/context-pack",
      action: "read",
      resource: "college_counseling",
      summary: "Read college counseling context pack (Markdown)",
    });

    return aiOk({
      format: "markdown",
      generated_at: new Date().toISOString(),
      markdown,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
