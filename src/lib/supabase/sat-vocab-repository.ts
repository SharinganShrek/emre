import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptySatProgress,
  type SatVocabProgress,
} from "@/lib/sat-vocab/types";
import { mergeProgress, recomputeCompletedDates } from "@/lib/sat-vocab";
import { satVocabData } from "@/lib/sat-vocab";

export async function fetchSatVocabProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<SatVocabProgress> {
  const existing = await supabase
    .from("sat_vocab_progress")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.payload && typeof existing.data.payload === "object") {
    const merged = mergeProgress(
      existing.data.payload as Partial<SatVocabProgress>,
    );
    merged.completed_dates = recomputeCompletedDates(merged);
    return merged;
  }

  const seeded = emptySatProgress(satVocabData.meta.plan_start);
  const inserted = await supabase.from("sat_vocab_progress").insert({
    user_id: userId,
    payload: seeded,
  });
  if (inserted.error) throw inserted.error;
  return seeded;
}

export async function saveSatVocabProgress(
  supabase: SupabaseClient,
  userId: string,
  payload: SatVocabProgress,
): Promise<void> {
  const next = {
    ...payload,
    completed_dates: recomputeCompletedDates(payload),
  };
  const { error } = await supabase.from("sat_vocab_progress").upsert(
    {
      user_id: userId,
      payload: next,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
