import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/habits — list active habits with today's completion state. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("habits", "read");

    const today = new Date().toISOString().slice(0, 10);

    const { data: habits, error } = await ctx.admin
      .from("habits")
      .select("id,name,color,frequency,target_per_day,status")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .order("sort_order", { ascending: true });

    if (error) return aiError(error.message, 500);

    const { data: logs } = await ctx.admin
      .from("habit_logs")
      .select("habit_id,completed")
      .eq("user_id", ctx.userId)
      .eq("log_date", today);

    const doneIds = new Set(
      (logs ?? []).filter((l) => l.completed).map((l) => l.habit_id),
    );

    const result = (habits ?? []).map((h) => ({
      ...h,
      completed_today: doneIds.has(h.id),
    }));

    await logAiAction({
      ctx,
      route: "/api/ai/habits",
      action: "read",
      resource: "habits",
      summary: `Listed ${result.length} habits`,
    });

    return aiOk(result);
  } catch (err) {
    return aiCatch(err);
  }
}
