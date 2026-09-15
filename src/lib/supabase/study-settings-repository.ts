import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeSettings, type YptSettings } from "@/lib/study/ypt";

export async function fetchStudySettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<YptSettings | null> {
  const existing = await supabase
    .from("study_settings")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.payload && typeof existing.data.payload === "object") {
    return mergeSettings(existing.data.payload as Partial<YptSettings>);
  }
  return null;
}

export async function saveStudySettings(
  supabase: SupabaseClient,
  userId: string,
  payload: YptSettings,
): Promise<void> {
  const next = mergeSettings(payload);
  const { error } = await supabase.from("study_settings").upsert(
    {
      user_id: userId,
      payload: next,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
