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
  counselingItemExists,
  deleteCounselingItem,
  updateCounselingItem,
  type CounselingItemSection,
} from "./items";
import {
  asObject,
  omitEmptyLeaves,
  resolveWriteId,
} from "./write-normalize";

function upsertDocumentLists(
  current: CollegeCounselingData,
  data: Record<string, unknown>,
): CollegeCounselingData {
  let next = current;
  const lists: Array<[string, CounselingItemSection]> = [
    ["activities", "activities"],
    ["research", "research"],
    ["schools", "schools"],
    ["recommendations", "recommendations"],
  ];
  for (const [key, section] of lists) {
    const rows = data[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const obj = asObject(row);
      const id = resolveWriteId(obj.id, obj, {});
      if (id && counselingItemExists(next, section, id)) {
        next = updateCounselingItem(next, section, id, obj);
      } else {
        next = addCounselingItem(next, section, obj);
      }
    }
    delete data[key];
  }
  return next;
}

export function applyCounselingWrite(
  current: CollegeCounselingData,
  body: CollegeCounselingWrite,
): CollegeCounselingData {
  if (body.action === "replace" || body.action === "patch") {
    const data = omitEmptyLeaves(asObject(body.data));
    if (body.action === "replace") {
      return overlayCollegeCounseling(
        current,
        data as Partial<CollegeCounselingData>,
        { replaceLists: true },
      );
    }
    const withLists = upsertDocumentLists(current, data);
    return overlayCollegeCounseling(
      withLists,
      data as Partial<CollegeCounselingData>,
    );
  }

  if (body.action === "update_profile") {
    const patch = omitEmptyLeaves(asObject(body.patch)) as Partial<
      CollegeCounselingData["profile"]
    >;
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
          ? omitEmptyLeaves(asObject(body.data))
          : {};
      return overlayCollegeCounseling(current, {
        profile: {
          ...current.profile,
          ...(patch as Partial<CollegeCounselingData["profile"]>),
        },
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
