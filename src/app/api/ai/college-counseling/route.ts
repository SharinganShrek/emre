import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { collegeCounselingWrite } from "@/lib/validation";
import {
  applyCounselingWrite,
  loadCounseling,
  persistCounseling,
} from "@/lib/college-counseling/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/college-counseling — full counseling document. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("college_counseling", "read");

    const data = await loadCounseling(ctx);

    await logAiAction({
      ctx,
      route: "/api/ai/college-counseling",
      action: "read",
      resource: "college_counseling",
      summary: "Read college counseling document",
    });

    return aiOk({
      activities_count: data.activities.length,
      data,
    });
  } catch (err) {
    return aiCatch(err);
  }
}

/**
 * POST /api/ai/college-counseling
 * replace | add_activity | update_activity
 */
export async function POST(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("college_counseling", "write");

    const body = collegeCounselingWrite.parse(await request.json());
    const current = await loadCounseling(ctx);
    const next = applyCounselingWrite(current, body);
    const saved = await persistCounseling(ctx, next);

    await logAiAction({
      ctx,
      route: "/api/ai/college-counseling",
      action: "write",
      resource: "college_counseling",
      summary: `College counseling ${body.action}`,
      metadata: { action: body.action },
    });

    return aiOk({
      action: body.action,
      activities_count: saved.activities.length,
      data: saved,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
