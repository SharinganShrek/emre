import type { AiContext } from "@/lib/ai/permissions";
import { AiPermissionError } from "@/lib/ai/permissions";
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
