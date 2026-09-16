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
 * Write and read actions are best-effort: a missing audit table must not
 * roll back a counseling/habit write the user already asked to save.
 */
export async function logAiAction({
  ctx,
  route,
  action,
  resource,
  summary,
  metadata,
}: AuditArgs): Promise<void> {
  const { error } = await ctx.admin.from("ai_audit_logs").insert({
    user_id: ctx.userId,
    route,
    action,
    resource,
    summary,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error("[ai-audit] failed to write audit log", {
      route,
      resource,
      action,
      error,
    });
    if (action === "write") {
      console.error(
        "[ai-audit] write succeeded but audit insert failed; returning 200",
        { route, resource, error },
      );
    }
  }
}
