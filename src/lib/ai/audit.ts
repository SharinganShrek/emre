import "server-only";
import type { AiContext } from "./permissions";
import { AiPermissionError } from "./permissions";

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
 * Write actions MUST succeed in logging (fail the request if audit insert fails).
 * Read actions are best-effort and never break the API response.
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
      throw new AiPermissionError(
        "Failed to audit AI write action. Request aborted.",
        500,
      );
    }
  }
}
