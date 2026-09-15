import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollegeCounselingData } from "@/lib/college-counseling/types";
import { collegeCounselingData as seedData } from "@/lib/college-counseling/data";
import { mergeCollegeCounseling } from "@/lib/college-counseling/merge";

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
    const incoming = existing.data.payload as Partial<CollegeCounselingData> &
      Record<string, unknown>;
    const merged = mergeCollegeCounseling(incoming);
    const hasLegacySections =
      incoming.timeline != null ||
      incoming.essays != null ||
      incoming.weekly_checkins != null ||
      (incoming.overview as { essays_drafted?: number } | undefined)
        ?.essays_drafted != null;
    const testingChanged =
      JSON.stringify(incoming.profile?.testing ?? []) !==
      JSON.stringify(merged.profile.testing);
    const schoolsDropped =
      (Array.isArray(incoming.schools)
        ? incoming.schools.filter(
            (s) => (s as { group?: string }).group === "us_need_aware",
          ).length
        : 0) > 0;
    if (
      (incoming.activities_seed_rev ?? 0) < (merged.activities_seed_rev ?? 0) ||
      testingChanged ||
      schoolsDropped ||
      incoming.counselor_todo == null ||
      hasLegacySections
    ) {
      await saveCollegeCounseling(supabase, userId, merged);
    }
    return merged;
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
  const normalized = mergeCollegeCounseling(payload);
  const { error } = await supabase.from("college_counseling").upsert(
    {
      user_id: userId,
      payload: normalized,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
