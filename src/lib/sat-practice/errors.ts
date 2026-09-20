export function satPracticeErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const row = err as { code?: string; message?: unknown };
    if (row.code === "42P01") {
      return "Database table missing. Run supabase/sat_practice_schema.sql in the Supabase SQL Editor.";
    }
    if (typeof row.message === "string" && row.message.trim()) return row.message;
  }
  return fallback;
}
