import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHubUserId } from "@/lib/access";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AI permission layer.
 *
 * Design goals (see README "Security"):
 *  - The AI assistant authenticates with a single shared secret (AI_API_KEY).
 *  - Every request is scoped to ONE user id (same owner as hub sync) in this MVP.
 *  - Access is limited to an explicit allow-list of tables + operations.
 *  - No destructive deletes are permitted for AI routes.
 *  - All write actions are audit-logged.
 */

export type AiOperation = "read" | "write";

/** Allow-list: which tables the AI may read/write. Deletes are never allowed. */
export const AI_RESOURCE_POLICY: Record<
  string,
  { read: boolean; write: boolean }
> = {
  habits: { read: true, write: false },
  habit_logs: { read: true, write: true },
  tasks: { read: true, write: true },
  goals: { read: true, write: false },
  study_sessions: { read: true, write: false },
  books: { read: true, write: false },
  movies: { read: true, write: true },
  journal_entries: { read: true, write: true },
  college_counseling: { read: true, write: false },
  // Aggregations are read-only views over the above.
};

export class AiPermissionError extends Error {
  constructor(
    message: string,
    public status: number = 403,
  ) {
    super(message);
    this.name = "AiPermissionError";
  }
}

export interface AiContext {
  userId: string;
  admin: SupabaseClient;
}

/**
 * Validate the incoming AI request and return a scoped context.
 * Throws AiPermissionError (401/403/500) on failure.
 */
export function authorizeAiRequest(request: Request): AiContext {
  const configured = process.env.AI_API_KEY;

  if (!configured) {
    throw new AiPermissionError(
      "AI API is not configured. Set AI_API_KEY on the server.",
      500,
    );
  }

  const provided = extractBearer(request);
  if (!provided || !timingSafeEqual(provided, configured)) {
    throw new AiPermissionError("Invalid or missing AI API key.", 401);
  }

  return { userId: getHubUserId(), admin: createAdminClient() };
}

/** Assert the AI may perform `op` on `resource`, else throw. */
export function assertPermission(resource: string, op: AiOperation): void {
  const policy = AI_RESOURCE_POLICY[resource];
  if (!policy || !policy[op]) {
    throw new AiPermissionError(
      `AI is not permitted to ${op} "${resource}".`,
      403,
    );
  }
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  // Fallback header some clients use.
  return request.headers.get("x-ai-api-key");
}

/** Constant-time string comparison to avoid timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
