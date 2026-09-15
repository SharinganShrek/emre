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
import {
  mergeTestingByName,
  overlayCollegeCounseling,
} from "@/lib/college-counseling/merge";
import type {
  CollegeCounselingData,
  TestPlanItem,
} from "@/lib/college-counseling/types";
import type { CollegeCounselingWrite } from "@/lib/validation";
import {
  addCounselingItem,
  deleteCounselingItem,
  updateCounselingItem,
  type CounselingItemSection,
} from "./items";

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
  if (body.action === "replace" || body.action === "patch") {
    return overlayCollegeCounseling(
      current,
      body.data as Partial<CollegeCounselingData>,
    );
  }

  if (body.action === "update_profile") {
    const patch = body.patch as Partial<CollegeCounselingData["profile"]>;
    const testing = patch.testing
      ? mergeTestingByName(current.profile.testing, patch.testing)
      : current.profile.testing;
    return overlayCollegeCounseling(current, {
      profile: { ...current.profile, ...patch, testing },
    });
  }

  if (body.action === "update_testing") {
    const incoming = body.testing.map((item) => ({
      name: item.name,
      status: item.status ?? "",
      score: item.score,
      target: item.target,
      notes: item.notes,
    })) as TestPlanItem[];
    return overlayCollegeCounseling(current, {
      profile: {
        ...current.profile,
        testing: mergeTestingByName(current.profile.testing, incoming),
      },
    });
  }

  if (body.action === "update_section") {
    if (body.section === "profile") {
      const patch =
        body.data && typeof body.data === "object"
          ? (body.data as Partial<CollegeCounselingData["profile"]>)
          : {};
      return overlayCollegeCounseling(current, {
        profile: { ...current.profile, ...patch },
      });
    }
    return overlayCollegeCounseling(current, {
      [body.section]:
        body.section === "counselor_todo" ||
        body.section === "research_narrative" ||
        body.section === "brag_sheet_notes"
          ? typeof body.data === "string"
            ? body.data
            : String(body.data ?? "")
          : body.data,
    } as Partial<CollegeCounselingData>);
  }

  if (body.action === "add_item") {
    return addCounselingItem(
      current,
      body.section as CounselingItemSection,
      body.item,
    );
  }

  if (body.action === "update_item") {
    return updateCounselingItem(
      current,
      body.section as CounselingItemSection,
      body.id,
      body.patch,
    );
  }

  if (body.action === "delete_item") {
    return deleteCounselingItem(
      current,
      body.section as CounselingItemSection,
      body.id,
    );
  }

  if (body.action === "add_activity") {
    return addCounselingItem(current, "activities", body.activity);
  }

  return updateCounselingItem(current, "activities", body.id, body.patch);
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
    action: body.action,
    activities_count: saved.activities.length,
    data: saved,
  });
}
