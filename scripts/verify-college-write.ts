import { collegeCounselingData as seed } from "../src/lib/college-counseling/data";
import { applyCounselingWrite } from "../src/lib/college-counseling/apply";
import { overlayCollegeCounseling } from "../src/lib/college-counseling/merge";
import {
  foldEnvelope,
  normalizeCollegeItemWrite,
  omitEmptyLeaves,
} from "../src/lib/college-counseling/write-normalize";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const current = structuredClone(seed);
const activityId = current.activities[0]?.id;
assert(activityId, "seed has an activity");
const originalTitle = current.activities[0].title;
const originalDesc = current.activities[0].expanded_description;
const schoolCount = current.schools.length;
const firstSchoolId = current.schools[0]?.id;
assert(firstSchoolId, "seed has a school");

// Empty GPT placeholders must not wipe a card.
const cleaned = omitEmptyLeaves({
  title: "",
  expanded_description: "rewritten by GPT",
  hours_per_week: 0,
});
assert(cleaned.title === undefined, "empty title dropped");
assert(cleaned.expanded_description === "rewritten by GPT", "real text kept");
assert(cleaned.hours_per_week === 0, "numeric 0 kept");

const leftoverUpdate = normalizeCollegeItemWrite({
  action: "update",
  section: "activity",
  id: activityId,
  item: {},
  patch: {},
  expanded_description: "rewritten by GPT",
  title: "",
});
assert(leftoverUpdate.action === "update_item", "leftover fields become patch");
assert(leftoverUpdate.action === "update_item" && leftoverUpdate.patch.expanded_description === "rewritten by GPT", "description in patch");
assert(leftoverUpdate.action === "update_item" && leftoverUpdate.patch.title === undefined, "blank title not in patch");

const updated = applyCounselingWrite(current, leftoverUpdate);
assert(updated.activities[0].title === originalTitle, "title not wiped");
assert(
  updated.activities[0].expanded_description === "rewritten by GPT",
  "description rewritten",
);
assert(updated.activities.length === current.activities.length, "no activity dropped");

const added = applyCounselingWrite(
  current,
  normalizeCollegeItemWrite({
    action: "add",
    section: "schools",
    id: "",
    item: { school_name: "Saarland", group: "europe_main", program: "CS" },
    patch: {},
  }),
);
assert(added.schools.length === schoolCount + 1, "school added");
assert(
  added.schools[0].school_name === "Saarland",
  "new school prepended",
);
assert(
  added.schools.some((s) => s.id === firstSchoolId),
  "existing school kept",
);

const deleted = applyCounselingWrite(added, {
  action: "delete_item",
  section: "schools",
  id: added.schools[0].id,
});
assert(deleted.schools.length === schoolCount, "add then delete restores count");
assert(
  deleted.schools.some((s) => s.id === firstSchoolId),
  "original school still present",
);

const patched = applyCounselingWrite(current, {
  action: "patch",
  data: {
    counselor_todo: "Check NL diploma",
    activities: [
      { id: activityId, expanded_description: "partial list must not wipe others" },
    ],
  },
});
assert(patched.counselor_todo === "Check NL diploma", "todo patched");
assert(
  patched.activities.length === current.activities.length,
  "document patch does not replace activity list",
);
assert(
  patched.activities[0].expanded_description ===
    "partial list must not wipe others",
  "named activity updated via document patch",
);
assert(patched.activities[0].title === originalTitle, "other activity fields kept");

const overlaySafe = overlayCollegeCounseling(current, {
  activities: [{ id: "x", title: "should not replace" }],
} as never);
assert(
  overlaySafe.activities.length === current.activities.length,
  "overlay default does not replace lists",
);

const folded = foldEnvelope(
  { patch: { current_grade: "11th grade" }, us_strategy: "need-blind only" },
  "patch",
);
assert(folded.current_grade === "11th grade", "nested patch kept");
assert(folded.us_strategy === "need-blind only", "top-level fields folded");

const jsonPatch = normalizeCollegeItemWrite({
  action: "update",
  section: "schools",
  id: firstSchoolId,
  patch: JSON.stringify({ notes: "test from GPT" }),
});
assert(jsonPatch.action === "update_item", "JSON string patch");
assert(
  jsonPatch.action === "update_item" && jsonPatch.patch.notes === "test from GPT",
  "notes from JSON string",
);

const topLevelNotes = normalizeCollegeItemWrite({
  action: "update",
  section: "schools",
  id: "eu_2",
  notes: "test from GPT",
});
assert(
  topLevelNotes.action === "update_item" && topLevelNotes.patch.notes === "test from GPT",
  "top-level notes become patch",
);

console.log("college counseling write checks passed");
