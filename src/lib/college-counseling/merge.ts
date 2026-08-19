import type { ActivityItem, CollegeCounselingData } from "./types";
import { collegeCounselingData as seedData } from "./data";

/** Bump when seed activity copy should replace matching saved ids once. */
export const ACTIVITIES_SEED_REV = 3;

export function mergeCollegeCounseling(
  partial: Partial<CollegeCounselingData> | null | undefined,
): CollegeCounselingData {
  const saved = partial ?? {};
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
    profile: { ...seedData.profile, ...(saved.profile ?? {}) },
    overview: { ...seedData.overview, ...(saved.overview ?? {}) },
    financial_aid: {
      ...seedData.financial_aid,
      ...(saved.financial_aid ?? {}),
    },
    activities,
    research: Array.isArray(saved.research) ? saved.research : seedData.research,
    schools: Array.isArray(saved.schools) ? saved.schools : seedData.schools,
    timeline: Array.isArray(saved.timeline) ? saved.timeline : seedData.timeline,
    essays: Array.isArray(saved.essays) ? saved.essays : seedData.essays,
    recommendations: Array.isArray(saved.recommendations)
      ? saved.recommendations
      : seedData.recommendations,
    weekly_checkins: Array.isArray(saved.weekly_checkins)
      ? saved.weekly_checkins
      : seedData.weekly_checkins,
    research_narrative:
      saved.research_narrative ?? seedData.research_narrative,
    brag_sheet_notes: saved.brag_sheet_notes ?? seedData.brag_sheet_notes,
  };
}

function mergeActivitiesFromSeed(
  saved: ActivityItem[] | undefined,
  seed: ActivityItem[],
): ActivityItem[] {
  const seedIds = new Set(seed.map((a) => a.id));
  const extras = (saved ?? []).filter((a) => !seedIds.has(a.id));
  return [...seed, ...extras];
}
