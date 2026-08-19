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
    const incoming = existing.data.payload as Partial<CollegeCounselingData>;
    const merged = mergeCollegeCounseling(incoming);
    if ((incoming.activities_seed_rev ?? 0) < (merged.activities_seed_rev ?? 0)) {
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
  const { error } = await supabase.from("college_counseling").upsert(
    {
      user_id: userId,
      payload,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
