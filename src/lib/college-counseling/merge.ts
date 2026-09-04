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

/** Merge a GPT/UI patch onto the live document. Never resets to seed. */
export function overlayCollegeCounseling(
  current: CollegeCounselingData,
  patch: Partial<CollegeCounselingData> | null | undefined,
): CollegeCounselingData {
  const next = patch ?? {};
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
      academic_records:
        next.profile?.academic_records ?? current.profile.academic_records,
      testing: next.profile?.testing ?? current.profile.testing,
      citizenship: next.profile?.citizenship ?? current.profile.citizenship,
      intended_fields:
        next.profile?.intended_fields ?? current.profile.intended_fields,
      constraints: next.profile?.constraints ?? current.profile.constraints,
      preferences: next.profile?.preferences ?? current.profile.preferences,
    },
    overview: { ...current.overview, ...(next.overview ?? {}) },
    financial_aid: {
      ...current.financial_aid,
      ...(next.financial_aid ?? {}),
    },
    activities: Array.isArray(next.activities)
      ? next.activities
      : current.activities,
    research: Array.isArray(next.research) ? next.research : current.research,
    schools: Array.isArray(next.schools) ? next.schools : current.schools,
    timeline: Array.isArray(next.timeline) ? next.timeline : current.timeline,
    essays: Array.isArray(next.essays) ? next.essays : current.essays,
    recommendations: Array.isArray(next.recommendations)
      ? next.recommendations
      : current.recommendations,
    weekly_checkins: Array.isArray(next.weekly_checkins)
      ? next.weekly_checkins
      : current.weekly_checkins,
    research_narrative:
      next.research_narrative ?? current.research_narrative,
    brag_sheet_notes: next.brag_sheet_notes ?? current.brag_sheet_notes,
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
