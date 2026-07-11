import "server-only";
import type { AiContext } from "./permissions";

interface AuditArgs {
  ctx: AiContext;
  route: string;
  action: "read" | "write";
  resource: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an AI action in `ai_audit_logs`.
 *
 * Writes MUST always be logged. Reads are logged best-effort. Failures to log
 * never throw into the request path (logging must not break the API), but they
 * are surfaced in the server console for observability.
 */
export async function logAiAction({
  ctx,
  route,
  action,
  resource,
  summary,
  metadata,
}: AuditArgs): Promise<void> {
  try {
    await ctx.admin.from("ai_audit_logs").insert({
      user_id: ctx.userId,
      route,
      action,
      resource,
      summary,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("[ai-audit] failed to write audit log", {
      route,
      resource,
      err,
    });
  }
}
