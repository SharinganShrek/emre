import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/analytics/last-30-days — read-only aggregate life stats. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    for (const r of [
      "habit_logs",
      "study_sessions",
      "gym_sessions",
      "journal_entries",
      "movies",
      "books",
    ] as const) {
      assertPermission(r, "read");
    }

    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = new Date().toISOString().slice(0, 10);

    const [logs, study, gym, journal, movies, books] = await Promise.all([
      ctx.admin
        .from("habit_logs")
        .select("completed")
        .eq("user_id", ctx.userId)
        .gte("log_date", startISO),
      ctx.admin
        .from("study_sessions")
        .select("duration_minutes")
        .eq("user_id", ctx.userId)
        .gte("session_date", startISO),
      ctx.admin
        .from("gym_sessions")
        .select("id")
        .eq("user_id", ctx.userId)
        .gte("session_date", startISO),
      ctx.admin
        .from("journal_entries")
        .select("mood")
        .eq("user_id", ctx.userId)
        .gte("entry_date", startISO),
      ctx.admin
        .from("movies")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("status", "watched")
        .gte("watched_date", startISO),
      ctx.admin
        .from("books")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("status", "read")
        .gte("finished_date", startISO),
    ]);

    const logRows = logs.data ?? [];
    const completed = logRows.filter((l) => l.completed).length;
    const studyMinutes = (study.data ?? []).reduce(
      (s, x) => s + (x.duration_minutes ?? 0),
      0,
    );
    const moods = (journal.data ?? []).map((j) => j.mood);
    const avgMood =
      moods.length > 0
        ? Number((moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1))
        : null;

    const result = {
      range: { start: startISO, end: endISO },
      habit_completion_pct:
        logRows.length > 0
          ? Math.round((completed / logRows.length) * 100)
          : 0,
      study_hours: Number((studyMinutes / 60).toFixed(1)),
      gym_sessions: (gym.data ?? []).length,
      journal_entries: moods.length,
      avg_mood: avgMood,
      movies_watched: (movies.data ?? []).length,
      books_read: (books.data ?? []).length,
    };

    await logAiAction({
      ctx,
      route: "/api/ai/analytics/last-30-days",
      action: "read",
      resource: "analytics",
      summary: "Read 30-day analytics summary",
    });

    return aiOk(result);
  } catch (err) {
    return aiCatch(err);
  }
}
