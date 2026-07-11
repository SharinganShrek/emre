import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";
import { habitLogInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/ai/habits/log — mark a habit complete/incomplete for a date.
 * This is a non-destructive upsert; it never deletes rows.
 */
export async function PATCH(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("habit_logs", "write");

    const body = habitLogInput.parse(await request.json());
    const log_date = body.log_date ?? new Date().toISOString().slice(0, 10);

    // Ownership check: the habit must belong to this user.
    const { data: habit, error: habitErr } = await ctx.admin
      .from("habits")
      .select("id,name")
      .eq("user_id", ctx.userId)
      .eq("id", body.habit_id)
      .maybeSingle();

    if (habitErr) return aiError(habitErr.message, 500);
    if (!habit) return aiError("Habit not found for this user.", 404);

    const { data, error } = await ctx.admin
      .from("habit_logs")
      .upsert(
        {
          user_id: ctx.userId,
          habit_id: body.habit_id,
          log_date,
          completed: body.completed,
          count: body.completed ? 1 : 0,
          note: body.note ?? null,
        },
        { onConflict: "habit_id,log_date" },
      )
      .select()
      .single();

    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/habits/log",
      action: "write",
      resource: "habit_logs",
      summary: `Set "${habit.name}" to ${
        body.completed ? "completed" : "not completed"
      } on ${log_date}`,
      metadata: { habit_id: body.habit_id, log_date, completed: body.completed },
    });

    return aiOk(data);
  } catch (err) {
    return aiCatch(err);
  }
}
