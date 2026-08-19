import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";
import { isHubSyncConfigured } from "@/lib/access";
import { AiPermissionError } from "@/lib/ai/permissions";
import { addDaysISO, startOfWeekMonday } from "@/lib/study/ypt";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/study/stats — today / week / month totals by subject. */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("study_sessions", "read");
    if (!isHubSyncConfigured()) {
      throw new AiPermissionError(
        "Hub sync is not configured.",
        503,
      );
    }

    const today = todayISO();
    const weekStart = startOfWeekMonday(today);
    const weekEnd = addDaysISO(weekStart, 6);
    const monthPrefix = today.slice(0, 7);

    const { data, error } = await ctx.admin
      .from("study_sessions")
      .select("subject,duration_minutes,session_date")
      .eq("user_id", ctx.userId)
      .gte("session_date", addDaysISO(today, -40));

    if (error) return aiError(error.message, 500);
    const rows = data ?? [];

    const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
      rows.filter(pred).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);

    const todayMin = sum((r) => r.session_date === today);
    const weekMin = sum(
      (r) => r.session_date >= weekStart && r.session_date <= weekEnd,
    );
    const monthMin = sum((r) => r.session_date.startsWith(monthPrefix));

    const bySubject: Record<string, number> = {};
    for (const r of rows.filter((x) => x.session_date === today)) {
      bySubject[r.subject] = (bySubject[r.subject] ?? 0) + r.duration_minutes;
    }

    await logAiAction({
      ctx,
      route: "/api/ai/study/stats",
      action: "read",
      resource: "study_sessions",
      summary: "Read study stats",
    });

    return aiOk({
      today,
      today_minutes: todayMin,
      week_minutes: weekMin,
      month_minutes: monthMin,
      week_range: { start: weekStart, end: weekEnd },
      today_by_subject: bySubject,
    });
  } catch (err) {
    return aiCatch(err);
  }
}
