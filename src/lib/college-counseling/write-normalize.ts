export const COUNSELING_ITEM_SECTIONS = [
  "activities",
  "research",
  "schools",
  "recommendations",
  "testing",
  "academic_records",
] as const;

export type CounselingItemSection = (typeof COUNSELING_ITEM_SECTIONS)[number];

const ITEM_SECTIONS = new Set<string>(COUNSELING_ITEM_SECTIONS);

const SECTION_ALIASES: Record<string, CounselingItemSection> = {
  activity: "activities",
  activities: "activities",
  cv: "activities",
  research: "research",
  school: "schools",
  schools: "schools",
  rec: "recommendations",
  recs: "recommendations",
  recommendation: "recommendations",
  recommendations: "recommendations",
  test: "testing",
  testing: "testing",
  ap: "testing",
  exam: "testing",
  exams: "testing",
  academic: "academic_records",
  academics: "academic_records",
  academic_record: "academic_records",
  academic_records: "academic_records",
  gpa: "academic_records",
};

const RESERVED_ITEM_KEYS = new Set([
  "action",
  "section",
  "id",
  "item",
  "patch",
  "data",
]);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asObject(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

/** Drop blank placeholders GPT often fills for unused schema fields. */
export function omitEmptyLeaves(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value)) {
      out[key] = value;
      continue;
    }
    if (isPlainObject(value)) {
      const nested = omitEmptyLeaves(value);
      if (Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function hasKeys(value: unknown): boolean {
  return Object.keys(asObject(value)).length > 0;
}

export function pickFilledObject(
  primary: unknown,
  fallback: unknown,
): Record<string, unknown> {
  const first = omitEmptyLeaves(asObject(primary));
  if (Object.keys(first).length > 0) return first;
  return omitEmptyLeaves(asObject(fallback));
}

export function normalizeCounselingSection(
  value: unknown,
): CounselingItemSection | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const mapped = SECTION_ALIASES[key];
  if (mapped) return mapped;
  return ITEM_SECTIONS.has(value) ? (value as CounselingItemSection) : null;
}

export function resolveWriteId(
  id: unknown,
  item: Record<string, unknown>,
  patch: Record<string, unknown>,
): string {
  if (typeof id === "string" && id.trim()) return id.trim();
  for (const row of [item, patch]) {
    for (const key of ["id", "name", "period"] as const) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

/** Merge a nested `patch`/`data` object with leftover top-level fields. */
export function foldEnvelope(
  raw: unknown,
  nestedKey: "patch" | "data",
): Record<string, unknown> {
  const input = asObject(raw);
  const leftover = { ...input };
  delete leftover[nestedKey];
  return {
    ...omitEmptyLeaves(leftover),
    ...omitEmptyLeaves(asObject(input[nestedKey])),
  };
}

function leftoverFields(input: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (RESERVED_ITEM_KEYS.has(key)) continue;
    extra[key] = value;
  }
  return omitEmptyLeaves(extra);
}

export type NormalizedItemWrite =
  | {
      action: "add_item";
      section: CounselingItemSection;
      item: Record<string, unknown>;
    }
  | {
      action: "update_item";
      section: CounselingItemSection;
      id: string;
      patch: Record<string, unknown>;
    }
  | {
      action: "delete_item";
      section: CounselingItemSection;
      id: string;
    };

export function normalizeCollegeItemWrite(
  raw: unknown,
): NormalizedItemWrite {
  const input = asObject(raw);
  const action =
    input.action === "add" || input.action === "update" || input.action === "delete"
      ? input.action
      : null;
  const section = normalizeCounselingSection(input.section);
  if (!action) {
    throw new Error("action must be add, update, or delete");
  }
  if (!section) {
    throw new Error(
      'section must be activities, research, schools, recommendations, testing, or academic_records',
    );
  }

  const leftover = leftoverFields(input);
  const item = pickFilledObject(input.item, leftover);
  const patch = pickFilledObject(input.patch, leftover);
  const id = resolveWriteId(input.id, item, patch);

  if (action === "add") {
    const payload = Object.keys(item).length > 0 ? item : patch;
    if (Object.keys(payload).length === 0) {
      throw new Error("add needs item fields (title, school_name, name, …)");
    }
    return { action: "add_item", section, item: payload };
  }

  if (!id) {
    throw new Error(
      "update/delete needs id (testing uses exam name, academic_records uses period)",
    );
  }

  if (action === "delete") {
    return { action: "delete_item", section, id };
  }

  const updatePatch = Object.keys(patch).length > 0 ? patch : item;
  if (Object.keys(updatePatch).length === 0) {
    throw new Error("update needs patch fields to change");
  }
  return { action: "update_item", section, id, patch: updatePatch };
}
