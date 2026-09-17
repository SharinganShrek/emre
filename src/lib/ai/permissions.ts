import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHubUserId } from "@/lib/access";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiPermissionError } from "./errors";
import {
  aiKeysMatch,
  extractAiApiKey,
  getConfiguredAiApiKey,
} from "./key";

export { AiPermissionError } from "./errors";
export { extractAiApiKey, timingSafeEqual } from "./key";

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
  study_sessions: { read: true, write: true },
  books: { read: true, write: false },
  movies: { read: true, write: true },
  journal_entries: { read: true, write: true },
  college_counseling: { read: true, write: true },
  sat_vocab: { read: true, write: true },
  // Aggregations are read-only views over the above.
};

export interface AiContext {
  userId: string;
  admin: SupabaseClient;
}

/**
 * Validate the incoming AI request and return a scoped context.
 * Throws AiPermissionError (401/403/500) on failure.
 */
export function authorizeAiRequest(request: Request): AiContext {
  const configured = getConfiguredAiApiKey();

  if (!configured) {
    throw new AiPermissionError(
      "AI API is not configured. Set AI_API_KEY on the Vercel production environment.",
      500,
    );
  }

  const provided = extractAiApiKey(request);
  if (!provided) {
    throw new AiPermissionError(
      "Missing AI API key. GPT Actions Authentication must be None. Pass query param api_key with the Vercel AI_API_KEY value.",
      401,
    );
  }
  if (!aiKeysMatch(provided, configured)) {
    throw new AiPermissionError(
      "AI API key did not match the server. Re-copy AI_API_KEY from Vercel into the GPT instructions API_KEY line and pass it as api_key.",
      401,
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new AiPermissionError(
      "Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }

  return { userId: getHubUserId(), admin };
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
