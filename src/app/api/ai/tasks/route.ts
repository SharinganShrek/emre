import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";
import { taskInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/tasks — list tasks (most recent first). */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("tasks", "read");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let query = ctx.admin
      .from("tasks")
      .select("id,title,notes,status,priority,due_date,project,created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/tasks",
      action: "read",
      resource: "tasks",
      summary: `Listed ${data?.length ?? 0} tasks`,
    });

    return aiOk(data ?? []);
  } catch (err) {
    return aiCatch(err);
  }
}

/** POST /api/ai/tasks — create a task. */
export async function POST(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("tasks", "write");

    const body = taskInput.parse(await request.json());

    const { data, error } = await ctx.admin
      .from("tasks")
      .insert({
        user_id: ctx.userId,
        title: body.title,
        notes: body.notes ?? null,
        status: body.status,
        priority: body.priority,
        due_date: body.due_date ?? null,
        project: body.project ?? null,
      })
      .select()
      .single();

    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/tasks",
      action: "write",
      resource: "tasks",
      summary: `Created task "${body.title}"`,
      metadata: { task_id: data.id },
    });

    return aiOk(data, { status: 201 });
  } catch (err) {
    return aiCatch(err);
  }
}

// NOTE: Destructive operations (DELETE) are intentionally NOT implemented for
// AI routes in the MVP. A future delete endpoint must require explicit user
// confirmation (e.g. a signed confirmation token) before removing data.
