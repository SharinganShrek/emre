import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";
import { collegeCounselingWrite } from "@/lib/validation";
import {
  loadCounseling,
  runCounselingWrite,
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
 * patch | update_profile | update_testing | update_section |
 * add_item | update_item | delete_item | add_activity | update_activity
 */
export async function POST(request: Request) {
  try {
    const body = collegeCounselingWrite.parse(await request.json());
    return runCounselingWrite(request, body);
  } catch (err) {
    return aiCatch(err);
  }
}
