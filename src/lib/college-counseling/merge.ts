import type {
  AcademicRecord,
  ActivityItem,
  CollegeCounselingData,
  TestPlanItem,
} from "./types";
import { collegeCounselingData as seedData } from "./data";
import { withoutNeedAwareSchools } from "./schools";

/** Bump when seed activity copy should replace matching saved ids once. */
export const ACTIVITIES_SEED_REV = 3;

const REMOVED_COUNSELING_KEYS = [
  "timeline",
  "essays",
  "weekly_checkins",
] as const;

function omitRemovedCounselingKeys<T extends Record<string, unknown>>(
  obj: T,
): Omit<T, (typeof REMOVED_COUNSELING_KEYS)[number]> {
  const next = { ...obj };
  for (const key of REMOVED_COUNSELING_KEYS) {
    delete next[key];
  }
  return next as Omit<T, (typeof REMOVED_COUNSELING_KEYS)[number]>;
}

export function mergeCollegeCounseling(
  partial: Partial<CollegeCounselingData> | null | undefined,
): CollegeCounselingData {
  const saved = omitRemovedCounselingKeys(
    (partial ?? {}) as Record<string, unknown>,
  ) as Partial<CollegeCounselingData>;
  const savedRev = saved.activities_seed_rev ?? 0;
  const activities =
    savedRev < ACTIVITIES_SEED_REV
      ? mergeActivitiesFromSeed(saved.activities, seedData.activities)
      : Array.isArray(saved.activities)
        ? saved.activities
        : seedData.activities;

  return {
    ...seedData,
    ...saved,
    activities_seed_rev: Math.max(savedRev, ACTIVITIES_SEED_REV),
    profile: {
      ...seedData.profile,
      ...(saved.profile ?? {}),
      testing: normalizeTesting(
        saved.profile?.testing ?? seedData.profile.testing,
      ),
    },
    overview: {
      ...seedData.overview,
      ...omitLegacyOverview(saved.overview),
    },
    financial_aid: {
      ...seedData.financial_aid,
      ...(saved.financial_aid ?? {}),
    },
    activities,
    research: Array.isArray(saved.research) ? saved.research : seedData.research,
    schools: withoutNeedAwareSchools(
      Array.isArray(saved.schools) ? saved.schools : seedData.schools,
    ),
    recommendations: Array.isArray(saved.recommendations)
      ? saved.recommendations
      : seedData.recommendations,
    research_narrative:
      saved.research_narrative ?? seedData.research_narrative,
    brag_sheet_notes: saved.brag_sheet_notes ?? seedData.brag_sheet_notes,
    counselor_todo: saved.counselor_todo ?? "",
  };
}

/** Merge a GPT/UI patch onto the live document. Never resets to seed. */
export function overlayCollegeCounseling(
  current: CollegeCounselingData,
  patch: Partial<CollegeCounselingData> | null | undefined,
  options?: { replaceLists?: boolean },
): CollegeCounselingData {
  const replaceLists = options?.replaceLists === true;
  const next = omitRemovedCounselingKeys(
    (patch ?? {}) as Record<string, unknown>,
  ) as Partial<CollegeCounselingData>;
  return {
    ...current,
    ...next,
    activities_seed_rev:
      current.activities_seed_rev ?? next.activities_seed_rev ?? ACTIVITIES_SEED_REV,
    profile: {
      ...current.profile,
      ...(next.profile ?? {}),
      positioning: {
        ...current.profile.positioning,
        ...(next.profile?.positioning ?? {}),
      },
      academic_records: Array.isArray(next.profile?.academic_records)
        ? replaceLists
          ? next.profile.academic_records
          : mergeAcademicByPeriod(
              current.profile.academic_records,
              next.profile.academic_records,
            )
        : current.profile.academic_records,
      testing: Array.isArray(next.profile?.testing)
        ? replaceLists
          ? normalizeTesting(next.profile.testing)
          : mergeTestingByName(current.profile.testing, next.profile.testing)
        : current.profile.testing,
      citizenship: next.profile?.citizenship ?? current.profile.citizenship,
      intended_fields:
        next.profile?.intended_fields ?? current.profile.intended_fields,
      constraints: next.profile?.constraints ?? current.profile.constraints,
      preferences: next.profile?.preferences ?? current.profile.preferences,
    },
    overview: {
      ...current.overview,
      ...omitLegacyOverview(next.overview),
    },
    financial_aid: {
      ...current.financial_aid,
      ...(next.financial_aid ?? {}),
    },
    activities:
      replaceLists && Array.isArray(next.activities)
        ? next.activities
        : current.activities,
    research:
      replaceLists && Array.isArray(next.research)
        ? next.research
        : current.research,
    schools: withoutNeedAwareSchools(
      replaceLists && Array.isArray(next.schools)
        ? next.schools
        : current.schools,
    ),
    recommendations:
      replaceLists && Array.isArray(next.recommendations)
        ? next.recommendations
        : current.recommendations,
    research_narrative:
      next.research_narrative ?? current.research_narrative,
    brag_sheet_notes: next.brag_sheet_notes ?? current.brag_sheet_notes,
    counselor_todo:
      next.counselor_todo !== undefined
        ? String(next.counselor_todo)
        : current.counselor_todo ?? "",
  };
}

export function mergeAcademicByPeriod(
  current: AcademicRecord[],
  incoming: AcademicRecord[],
): AcademicRecord[] {
  const map = new Map(current.map((item) => [item.period, item]));
  for (const item of incoming) {
    const key = item.period || "Untitled period";
    const prev = map.get(key);
    map.set(key, {
      period: item.period || prev?.period || key,
      gpa: item.gpa !== undefined ? item.gpa : (prev?.gpa ?? 0),
      notes: item.notes !== undefined ? item.notes : prev?.notes,
    });
  }
  return [...map.values()];
}

export function mergeTestingByName(
  current: TestPlanItem[],
  incoming: TestPlanItem[],
): TestPlanItem[] {
  const map = new Map(
    current.map((item) => [item.name.trim().toLowerCase(), item]),
  );
  for (const item of incoming) {
    const key = item.name.trim().toLowerCase();
    const prev = map.get(key);
    map.set(key, {
      name: item.name || prev?.name || key,
      status: item.status || prev?.status || "",
      score: item.score !== undefined ? item.score : (prev?.score ?? null),
      target: item.target !== undefined ? item.target : prev?.target,
      notes: item.notes !== undefined ? item.notes : prev?.notes,
    });
  }
  return normalizeTesting([...map.values()]);
}

function normalizeTesting(items: TestPlanItem[] | undefined): TestPlanItem[] {
  return (items ?? []).map((item) => {
    const expectedPending =
      item.status.toLowerCase() === "taken" &&
      (item.target ?? "").toLowerCase().includes("expected 5") &&
      (item.score == null || item.score === "");
    if (!expectedPending) return item;
    return { ...item, score: 5, target: "Score 5" };
  });
}

function omitLegacyOverview(
  overview: Partial<CollegeCounselingData["overview"]> | undefined,
): Partial<CollegeCounselingData["overview"]> {
  if (!overview) return {};
  const { essays_drafted: _removed, ...rest } = overview as Partial<
    CollegeCounselingData["overview"]
  > & { essays_drafted?: number };
  return rest;
}

function mergeActivitiesFromSeed(
  saved: ActivityItem[] | undefined,
  seed: ActivityItem[],
): ActivityItem[] {
  const seedIds = new Set(seed.map((a) => a.id));
  const extras = (saved ?? []).filter((a) => !seedIds.has(a.id));
  return [...seed, ...extras];
}
