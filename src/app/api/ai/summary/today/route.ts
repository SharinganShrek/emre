import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiCatch } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/summary/today — a compact read-only snapshot of today. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("habits", "read");
    assertPermission("tasks", "read");

    const today = new Date().toISOString().slice(0, 10);

    const [habitsRes, logsRes, tasksRes, journalRes] = await Promise.all([
      ctx.admin
        .from("habits")
        .select("id,name")
        .eq("user_id", ctx.userId)
        .eq("status", "active"),
      ctx.admin
        .from("habit_logs")
        .select("habit_id,completed")
        .eq("user_id", ctx.userId)
        .eq("log_date", today),
      ctx.admin
        .from("tasks")
        .select("id,title,priority,due_date,status")
        .eq("user_id", ctx.userId)
        .neq("status", "done")
        .lte("due_date", today),
      ctx.admin
        .from("journal_entries")
        .select("mood,content")
        .eq("user_id", ctx.userId)
        .eq("entry_date", today)
        .maybeSingle(),
    ]);

    const habits = habitsRes.data ?? [];
    const logs = logsRes.data ?? [];
    const doneIds = new Set(
      logs.filter((l) => l.completed).map((l) => l.habit_id),
    );
    const completed = habits.filter((h) => doneIds.has(h.id)).length;

    const summary = {
      date: today,
      habits: {
        total: habits.length,
        completed,
        completion_pct:
          habits.length > 0
            ? Math.round((completed / habits.length) * 100)
            : 0,
        remaining: habits
          .filter((h) => !doneIds.has(h.id))
          .map((h) => ({ id: h.id, name: h.name })),
      },
      tasks_due_or_overdue: tasksRes.data ?? [],
      journal_today: journalRes.data ?? null,
    };

    await logAiAction({
      ctx,
      route: "/api/ai/summary/today",
      action: "read",
      resource: "summary",
      summary: "Read today's summary",
    });

    return aiOk(summary);
  } catch (err) {
    return aiCatch(err);
  }
}
