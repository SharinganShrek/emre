import {
  authorizeAiRequest,
  assertPermission,
} from "@/lib/ai/permissions";
import { logAiAction } from "@/lib/ai/audit";
import { aiOk, aiError, aiCatch } from "@/lib/ai/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/journal/recent — most recent journal entries (default 7). */
export async function GET(request: Request) {
  try {
    const ctx = authorizeAiRequest(request);
    assertPermission("journal_entries", "read");

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 7), 1),
      30,
    );

    const { data, error } = await ctx.admin
      .from("journal_entries")
      .select("id,entry_date,mood,content")
      .eq("user_id", ctx.userId)
      .order("entry_date", { ascending: false })
      .limit(limit);

    if (error) return aiError(error.message, 500);

    await logAiAction({
      ctx,
      route: "/api/ai/journal/recent",
      action: "read",
      resource: "journal_entries",
      summary: `Read ${data?.length ?? 0} recent journal entries`,
    });

    return aiOk(data ?? []);
  } catch (err) {
    return aiCatch(err);
  }
}
