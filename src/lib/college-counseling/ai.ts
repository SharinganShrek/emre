import type { AiContext } from "@/lib/ai/permissions";
import { AiPermissionError } from "@/lib/ai/permissions";
import { isHubSyncConfigured } from "@/lib/access";
import {
  fetchCollegeCounseling,
  saveCollegeCounseling,
} from "@/lib/supabase/college-counseling-repository";
import { collegeCounselingData as seedData } from "@/lib/college-counseling/data";
import { mergeCollegeCounseling } from "@/lib/college-counseling/merge";
import type {
  ActivityItem,
  CollegeCounselingData,
} from "@/lib/college-counseling/types";
import type { CollegeCounselingWrite } from "@/lib/validation";
import { uid } from "@/lib/utils";

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

export function applyCounselingWrite(
  current: CollegeCounselingData,
  body: CollegeCounselingWrite,
): CollegeCounselingData {
  if (body.action === "replace") {
    return mergeCollegeCounseling(body.data as Partial<CollegeCounselingData>);
  }

  if (body.action === "add_activity") {
    const raw = body.activity;
    const activity: ActivityItem = {
      id: raw.id ?? uid("act"),
      title: raw.title,
      category: raw.category,
      role: raw.role,
      organization: raw.organization,
      grade_levels: raw.grade_levels,
      hours_per_week: raw.hours_per_week,
      weeks_per_year: raw.weeks_per_year,
      common_app_description: raw.common_app_description,
      expanded_description: raw.expanded_description,
      impact_metrics: raw.impact_metrics,
      evidence_link: raw.evidence_link ?? null,
      priority: raw.priority,
      framing_notes: raw.framing_notes,
      risk_notes: raw.risk_notes,
      status: raw.status,
    };
    if (current.activities.some((a) => a.id === activity.id)) {
      throw new AiPermissionError(
        `Activity id "${activity.id}" already exists.`,
        409,
      );
    }
    return { ...current, activities: [activity, ...current.activities] };
  }

  const index = current.activities.findIndex((a) => a.id === body.id);
  if (index < 0) {
    throw new AiPermissionError(`Activity "${body.id}" not found.`, 404);
  }
  const next = [...current.activities];
  next[index] = { ...next[index], ...body.patch };
  return { ...current, activities: next };
}
