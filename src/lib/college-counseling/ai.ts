import type { AiContext } from "@/lib/ai/permissions";
import {
  AiPermissionError,
  assertPermission,
  authorizeAiRequest,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import {
  fetchCollegeCounseling,
  saveCollegeCounseling,
} from "@/lib/supabase/college-counseling-repository";
import { collegeCounselingData as seedData } from "@/lib/college-counseling/data";
import type { CollegeCounselingData } from "@/lib/college-counseling/types";
import type { CollegeCounselingWrite } from "@/lib/validation";
import { applyCounselingWrite } from "./apply";

export { applyCounselingWrite } from "./apply";

export async function loadCounseling(
  ctx: AiContext,
): Promise<CollegeCounselingData> {
  if (!isHubSyncConfigured()) return structuredClone(seedData);
  return fetchCollegeCounseling(ctx.admin, ctx.userId);
}

export async function persistCounseling(
  ctx: AiContext,
  data: CollegeCounselingData,
): Promise<CollegeCounselingData> {
  if (!isHubSyncConfigured()) {
    throw new AiPermissionError(
      "Hub sync is not configured. College counseling writes need SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }
  await saveCollegeCounseling(ctx.admin, ctx.userId, data);
  return data;
}

function writeMeta(body: CollegeCounselingWrite, saved: CollegeCounselingData) {
  const section =
    "section" in body
      ? body.section
      : body.action === "add_activity" || body.action === "update_activity"
        ? "activities"
        : undefined;
  let id = "id" in body ? body.id : undefined;
  if (body.action === "add_item" && !id) {
    if (body.section === "activities") id = saved.activities[0]?.id;
    else if (body.section === "research") id = saved.research[0]?.id;
    else if (body.section === "schools") id = saved.schools[0]?.id;
    else if (body.section === "recommendations") {
      id = saved.recommendations[0]?.id;
    } else if (body.section === "testing") {
      id = saved.profile.testing[0]?.name;
    } else if (body.section === "academic_records") {
      id = saved.profile.academic_records.at(-1)?.period;
    }
  }
  return {
    action: body.action,
    section,
    id,
    counts: {
      activities: saved.activities.length,
      research: saved.research.length,
      schools: saved.schools.length,
      recommendations: saved.recommendations.length,
      testing: saved.profile.testing.length,
    },
    message: "Saved. In the app tap Reload from server to see it.",
  };
}

/** Shared write path for Custom GPT Actions (split OpenAPI operations). */
export async function runCounselingWrite(
  request: Request,
  body: CollegeCounselingWrite,
) {
  const ctx = authorizeAiRequest(request);
  assertPermission("college_counseling", "write");

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
    ...writeMeta(body, saved),
    data: saved,
  });
}
