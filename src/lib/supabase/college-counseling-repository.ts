import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollegeCounselingData } from "@/lib/college-counseling/types";
import { collegeCounselingData as seedData } from "@/lib/college-counseling/data";

/** Load counseling payload for hub user; seed defaults if missing. */
export async function fetchCollegeCounseling(
  supabase: SupabaseClient,
  userId: string,
): Promise<CollegeCounselingData> {
  const existing = await supabase
    .from("college_counseling")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.payload && typeof existing.data.payload === "object") {
    return mergeWithSeed(
      existing.data.payload as Partial<CollegeCounselingData>,
    );
  }

  const seeded = structuredClone(seedData);
  const inserted = await supabase.from("college_counseling").insert({
    user_id: userId,
    payload: seeded,
  });
  if (inserted.error) throw inserted.error;
  return seeded;
}

/** Upsert full counseling document. */
export async function saveCollegeCounseling(
  supabase: SupabaseClient,
  userId: string,
  payload: CollegeCounselingData,
): Promise<void> {
  const { error } = await supabase.from("college_counseling").upsert(
    {
      user_id: userId,
      payload,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

function mergeWithSeed(
  partial: Partial<CollegeCounselingData>,
): CollegeCounselingData {
  return {
    ...seedData,
    ...partial,
    profile: { ...seedData.profile, ...(partial.profile ?? {}) },
    overview: { ...seedData.overview, ...(partial.overview ?? {}) },
    financial_aid: {
      ...seedData.financial_aid,
      ...(partial.financial_aid ?? {}),
    },
    activities: Array.isArray(partial.activities)
      ? partial.activities
      : seedData.activities,
    research: Array.isArray(partial.research)
      ? partial.research
      : seedData.research,
    schools: Array.isArray(partial.schools)
      ? partial.schools
      : seedData.schools,
    timeline: Array.isArray(partial.timeline)
      ? partial.timeline
      : seedData.timeline,
    essays: Array.isArray(partial.essays) ? partial.essays : seedData.essays,
    recommendations: Array.isArray(partial.recommendations)
      ? partial.recommendations
      : seedData.recommendations,
    weekly_checkins: Array.isArray(partial.weekly_checkins)
      ? partial.weekly_checkins
      : seedData.weekly_checkins,
    research_narrative:
      partial.research_narrative ?? seedData.research_narrative,
    brag_sheet_notes: partial.brag_sheet_notes ?? seedData.brag_sheet_notes,
  };
}
