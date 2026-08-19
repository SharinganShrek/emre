import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";
import {
  studySessionInput,
  studySessionPatch,
  studySessionQuery,
} from "@/lib/validation";
import { isHubSyncConfigured } from "@/lib/access";
import { AiPermissionError } from "@/lib/ai/permissions";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/study/sessions */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("study_sessions", "read");
    requireSync();

    const url = new URL(request.url);
    const q = studySessionQuery.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      subject: url.searchParams.get("subject") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    let query = ctx.admin
      .from("study_sessions")
      .select(
        "id,subject,duration_minutes,session_date,notes,created_at,updated_at",
      )
      .eq("user_id", ctx.userId)
      .order("session_date", { ascending: false })
      .limit(q.limit);

    if (q.from) query = query.gte("session_date", q.from);
    if (q.to) query = query.lte("session_date", q.to);
    if (q.subject) query = query.eq("subject", q.subject);

    const { data, error } = await query;
    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/study/sessions",
      action: "read",
      resource: "study_sessions",
      summary: `Listed ${data?.length ?? 0} study sessions`,
    });

    return aiOk(data ?? []);
  } catch (err) {
    return aiCatch(err);
  }
}

/** POST /api/ai/study/sessions — create or update a session. */
export async function POST(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("study_sessions", "write");
    requireSync();

    const raw = await request.json();
    const asPatch = studySessionPatch.safeParse(raw);

    if (asPatch.success && asPatch.data.id) {
      const { id, ...patch } = asPatch.data;
      const { data, error } = await ctx.admin
        .from("study_sessions")
        .update({
          ...(patch.subject != null ? { subject: patch.subject } : {}),
          ...(patch.duration_minutes != null
            ? { duration_minutes: patch.duration_minutes }
            : {}),
          ...(patch.session_date != null
            ? { session_date: patch.session_date }
            : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", ctx.userId)
        .select()
        .maybeSingle();

      if (error) return aiError(error.message, 500);
      if (!data) return aiError("Study session not found.", 404);

      await logAiAction({
        ctx,
        route: "/api/ai/study/sessions",
        action: "write",
        resource: "study_sessions",
        summary: `Updated study session ${id}`,
        metadata: { session_id: id },
      });
      return aiOk(data);
    }

    const body = studySessionInput.parse(raw);
    const { data, error } = await ctx.admin
      .from("study_sessions")
      .insert({
        user_id: ctx.userId,
        subject: body.subject,
        duration_minutes: body.duration_minutes,
        session_date: body.session_date ?? todayISO(),
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/study/sessions",
      action: "write",
      resource: "study_sessions",
      summary: `Logged ${body.duration_minutes}m ${body.subject}`,
      metadata: { session_id: data.id },
    });

    return aiOk(data, { status: 201 });
  } catch (err) {
    return aiCatch(err);
  }
}

function requireSync() {
  if (!isHubSyncConfigured()) {
    throw new AiPermissionError(
      "Hub sync is not configured. Study writes need SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }
}
